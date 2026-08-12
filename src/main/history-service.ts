import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { historyArchiveRequestSchema, type HistoryArchiveExport, type HistoryArchiveRequest, type HistoryEntry, type HistoryExportFormat, type HistoryMutationResult, type HistoryRevision, type OperationKind } from '../shared/contracts.js';
import { serializeHistoryEntries } from '../shared/export-registry.js';
import { createHistoryArchive } from './history-archive.js';
import { applyRestoreTransaction, cleanupRestoreTransaction, markRestoreTransactionRecorded, markRestoreTransactionRecording, prepareRestoreTransaction, recoverRestoreTransaction, rollbackRestoreTransaction, type RestoreTransactionManifest } from './history-restore-transaction.js';

const MAX_HISTORY_BYTES = 10_000_000;
const MAX_HISTORY_ENTRIES = 10_000;
const MAX_REVISIONS = 200;
const MAX_REVISION_BYTES = 2_000_000;
const MAX_LABEL_LENGTH = 80;
const MAX_HISTORY_FIELD_LENGTH = 20_000;
const REVISION_ID = /^[0-9a-f]{40}$/i;
const SNAPSHOT_DEFINITIONS = [
  { sourceName: 'installed-apps.v1.json', stateName: 'installed-apps.json', fallback: '[]\n' },
  { sourceName: 'settings.v1.json', stateName: 'settings.json', fallback: '{}\n' },
  { sourceName: 'workspace.v1.json', stateName: 'workspace.json', fallback: '{}\n' },
  { sourceName: 'appearance.v1.json', stateName: 'appearance.json', fallback: '{"schemaVersion":1,"elements":{}}\n' },
  { sourceName: 'schedule.v1.json', stateName: 'schedule.json', fallback: '{}\n' },
  { sourceName: 'schedule-runs.v1.json', stateName: 'schedule-runs.json', fallback: '{"selfUpdate":null,"catalogRefresh":null}\n' },
  { sourceName: 'external-editor.v1.json', stateName: 'external-editor.json', fallback: '{"schemaVersion":1,"editor":"vscode","edition":"stable"}\n' },
] as const;
const SNAPSHOT_FILES = SNAPSHOT_DEFINITIONS.map(({ stateName }) => `state/${stateName}`);
const CORE_SNAPSHOT_FILES = SNAPSHOT_FILES;
const LEGACY_SNAPSHOT_FILES = ['state/installed-apps.json', 'state/settings.json'] as const;
const HISTORY_METADATA_FILES = ['state/labels.v1.json'] as const;

async function git(cwd: string, args: string[]): Promise<number> {
  return await new Promise<number>((resolve) => {
    const child = spawn('git', args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_NOGLOBAL: '1',
        GIT_CONFIG_SYSTEM: 'NUL',
        GIT_CONFIG_GLOBAL: 'NUL',
        GIT_CONFIG_COUNT: '1',
        GIT_CONFIG_KEY_0: 'core.hooksPath',
        GIT_CONFIG_VALUE_0: 'NUL',
        GIT_AUTHOR_NAME: 'Ding Ding App Store',
        GIT_AUTHOR_EMAIL: 'local-history@ding-ding.invalid',
        GIT_COMMITTER_NAME: 'Ding Ding App Store',
        GIT_COMMITTER_EMAIL: 'local-history@ding-ding.invalid',
      },
    });
    child.once('error', () => resolve(-1));
    child.once('exit', (code) => resolve(code ?? -1));
  });
}

async function gitText(cwd: string, args: string[], limit = MAX_REVISION_BYTES): Promise<string | null> {
  return await new Promise<string | null>((resolve) => {
    const child = spawn('git', args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
      env: {
        ...process.env,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_NOGLOBAL: '1',
        GIT_CONFIG_SYSTEM: 'NUL',
        GIT_CONFIG_GLOBAL: 'NUL',
      },
    });
    let output = '';
    let overflow = false;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      if (output.length + chunk.length > limit) overflow = true;
      else output += chunk;
    });
    child.once('error', () => resolve(null));
    child.once('exit', (code) => resolve(code === 0 && !overflow ? output : null));
  });
}

export interface HistoryRecordInput {
  appId: string;
  displayName: string;
  kind: OperationKind;
  ok: boolean;
  message: string;
  /** Optional Cantonese projection for records whose action copy is localized. */
  messageYue?: string;
}

export interface HistorySnapshotParticipant {
  snapshot(): Promise<string | null>;
  restore(content: string, options?: { shouldCommit?: () => boolean }): Promise<void>;
  restoreAvailable?(): boolean;
}

/** Parses one append-only log line without allowing malformed records to poison the whole Activity list. */
export function parseHistoryEntry(value: unknown): HistoryEntry | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entry = value as Record<string, unknown>;
  const textFields = ['id', 'appId', 'displayName', 'message', 'occurredAt'] as const;
  if (textFields.some((field) => typeof entry[field] !== 'string' || !String(entry[field]).trim() || String(entry[field]).length > MAX_HISTORY_FIELD_LENGTH)) return null;
  if ('messageYue' in entry && (typeof entry.messageYue !== 'string' || !entry.messageYue.trim() || entry.messageYue.length > MAX_HISTORY_FIELD_LENGTH)) return null;
  if (typeof entry.kind !== 'string' || !(['install', 'build', 'uninstall', 'update', 'settings'] as const).includes(entry.kind as OperationKind)) return null;
  if (typeof entry.ok !== 'boolean' || !Number.isFinite(Date.parse(entry.occurredAt as string))) return null;
  return {
    id: entry.id as string,
    appId: entry.appId as string,
    displayName: entry.displayName as string,
    kind: entry.kind as OperationKind,
    ok: entry.ok,
    message: entry.message as string,
    ...(typeof entry.messageYue === 'string' ? { messageYue: entry.messageYue } : {}),
    occurredAt: entry.occurredAt as string,
  };
}

export class HistoryService {
  private readonly root = path.join(app.getPath('userData'), 'history');
  private readonly logPath = path.join(this.root, 'operations.v1.jsonl');
  private readonly repositoryPath = path.join(this.root, 'repository');
  private readonly restoreTransactionPath = path.join(this.root, 'restore-transaction');
  private stateQueue: Promise<void> = Promise.resolve();
  constructor(private readonly authenticatorHistory?: HistorySnapshotParticipant) {}

  /** Repairs an interrupted restore before any state service reads application data. */
  async recoverPendingRestore(): Promise<void> {
    try {
      await this.enqueueState(() => recoverRestoreTransaction(this.restoreTransactionPath, app.getPath('userData'), async (manifest) => {
        const label = manifest.recordLabel;
        if (!label) return false;
        return (await gitText(this.repositoryPath, ['log', '-1', '--format=%s', 'HEAD'], 256))?.trim() === label;
      }, this.authenticatorHistory));
    } catch (error) {
      // An outer journal may contain the protected authenticator slot. If the
      // native no-follow adapter is unavailable, the participant must retain
      // both journals and let the app start with the safe pre-authenticator
      // files restored; never abort launch or attempt a path-based fallback.
      if ((error as NodeJS.ErrnoException).code === 'EUNSUPPORTED') return;
      throw error;
    }
  }

  async list(): Promise<HistoryEntry[]> {
    try {
      const text = await readFile(this.logPath, 'utf8');
      if (text.length > MAX_HISTORY_BYTES) throw new Error('Operation history exceeded 10 MB.');
      return text
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-MAX_HISTORY_ENTRIES)
        .flatMap((line) => {
          try { return [parseHistoryEntry(JSON.parse(line))].filter((entry): entry is HistoryEntry => entry !== null); }
          catch { return []; }
        })
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async record(input: HistoryRecordInput): Promise<HistoryEntry> {
    const entry: HistoryEntry = { id: randomUUID(), occurredAt: new Date().toISOString(), ...input };
    await mkdir(this.root, { recursive: true });
    await appendFile(this.logPath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
    if (entry.ok) await this.snapshot(`${entry.kind}: ${entry.appId}`);
    return entry;
  }

  async export(format: HistoryExportFormat): Promise<string> {
    return serializeHistoryEntries(await this.list(), format);
  }

  /**
   * Archives only records that currently exist in the append-only store. The
   * renderer sends opaque record IDs, never record contents or filesystem
   * paths; persisted entries are re-read before the ZIP is built.
   */
  async archive(request: HistoryArchiveRequest): Promise<HistoryArchiveExport> {
    const parsed = historyArchiveRequestSchema.parse(request);
    const available = await this.list();
    const wanted = new Set(parsed.entryIds);
    const selected = available.filter((entry) => wanted.has(entry.id));
    if (selected.length !== wanted.size) throw new Error('One or more selected Activity records are no longer available for archive export.');
    return createHistoryArchive(selected);
  }

  /**
   * Lists only commits in the isolated local repository. No user repository,
   * network remote, or arbitrary ref is consulted.
   */
  async revisions(): Promise<HistoryRevision[]> {
    const log = await gitText(this.repositoryPath, ['log', '--format=%H%x09%aI%x09%s', `--max-count=${MAX_REVISIONS}`, '--', 'state']);
    if (!log) return [];
    const labels = await this.readLabels('HEAD');
    const rows: HistoryRevision[] = [];
    for (const line of log.split(/\r?\n/).filter(Boolean)) {
      const [id, occurredAt, ...subjectParts] = line.split('\t');
      if (!id || !REVISION_ID.test(id) || !occurredAt || !Number.isFinite(Date.parse(occurredAt))) continue;
      const subject = subjectParts.join('\t').slice(0, MAX_LABEL_LENGTH);
      const changed = await gitText(this.repositoryPath, ['diff-tree', '--no-commit-id', '--name-only', '-r', id, '--', 'state'], 32_000);
      const changedFiles = (changed ?? '').split(/\r?\n/).filter((file): file is string => SNAPSHOT_FILES.includes(file) || file === 'state/labels.v1.json');
      const hasAuthenticatorSnapshot = await gitText(this.repositoryPath, ['cat-file', '-e', `${id}:state/authenticator-history.json`], 100) === '';
      const protectedRestoreAvailable = !hasAuthenticatorSnapshot || this.authenticatorRestoreAvailable();
      rows.push({ id: id.toLowerCase(), occurredAt, subject, label: labels[id.toLowerCase()] ?? subject, changedFiles, restorable: protectedRestoreAvailable && await this.revisionHasSnapshots(id) });
    }
    return rows;
  }

  async diff(revisionId: string): Promise<string> {
    const id = this.validateRevisionId(revisionId);
    if (!await this.revisionHasSnapshots(id)) return '';
    const parent = await gitText(this.repositoryPath, ['rev-parse', `${id}^`], 100);
    const output = await gitText(this.repositoryPath, parent ? ['diff', '--no-ext-diff', '--unified=3', `${parent.trim()}..${id}`, '--', 'state'] : ['show', '--format=fuller', '--stat', id], 120_000);
    return output ?? '';
  }

  async label(revisionId: string, requestedLabel: string): Promise<HistoryMutationResult> {
    return this.enqueueState(() => this.labelUnlocked(revisionId, requestedLabel));
  }

  private async labelUnlocked(revisionId: string, requestedLabel: string): Promise<HistoryMutationResult> {
    const id = this.validateRevisionId(revisionId);
    const label = requestedLabel.trim();
    if (!label || label.length > MAX_LABEL_LENGTH || /[\r\n]/.test(label)) return { ok: false, message: `Revision labels must be 1-${MAX_LABEL_LENGTH} characters on one line.` };
    if (!await this.revisionHasSnapshots(id)) return { ok: false, message: 'That local revision is unavailable or is not a restorable snapshot.' };
    await mkdir(path.join(this.repositoryPath, 'state'), { recursive: true });
    const labels = await this.readLabels('HEAD');
    labels[id] = label;
    await writeFile(path.join(this.repositoryPath, 'state', 'labels.v1.json'), `${JSON.stringify(labels, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    await git(this.repositoryPath, ['add', '--', 'state/labels.v1.json']);
    if (await git(this.repositoryPath, ['diff', '--cached', '--quiet']) === 0) return { ok: true, message: 'That revision already carries this label.' };
    const committed = await git(this.repositoryPath, ['commit', '-m', `label: ${label}`]);
    return committed === 0 ? { ok: true, message: `Saved label “${label}” in local history.` } : { ok: false, message: 'The local history label could not be saved.' };
  }

  async restore(revisionId: string): Promise<HistoryMutationResult> {
    return this.enqueueState(() => this.restoreUnlocked(revisionId));
  }

  private async restoreUnlocked(revisionId: string): Promise<HistoryMutationResult> {
    const id = this.validateRevisionId(revisionId);
    const mode = await this.revisionSnapshotMode(id);
    if (!mode) return { ok: false, message: 'That local revision is unavailable or has no complete App Store snapshots.' };
    const restored: Array<[string, string]> = [];
    const previous: Array<[string, string | null]> = [];
    const authenticatorTarget = this.authenticatorHistory ? await gitText(this.repositoryPath, ['show', `${id}:state/authenticator-history.json`], MAX_REVISION_BYTES) : null;
    if (authenticatorTarget !== null && !this.authenticatorRestoreAvailable()) return { ok: false, message: 'Protected authenticator restore is unavailable until native atomic no-follow vault operations are available; no files were changed.' };
    const authenticatorPrevious = authenticatorTarget !== null && this.authenticatorHistory ? await this.authenticatorHistory.snapshot() : null;
    if (authenticatorTarget !== null && authenticatorPrevious === null) return { ok: false, message: 'The current authenticator state could not be preserved safely; no files were changed.' };
    for (const definition of SNAPSHOT_DEFINITIONS) {
      const source = `${id}:state/${definition.stateName}`;
      const target = path.join(app.getPath('userData'), definition.sourceName);
      const content = mode === 'legacy' && !LEGACY_SNAPSHOT_FILES.includes(`state/${definition.stateName}` as typeof LEGACY_SNAPSHOT_FILES[number])
        ? definition.fallback
        : await gitText(this.repositoryPath, ['show', source]);
      if (content === null || content.length > MAX_REVISION_BYTES) return { ok: false, message: 'The selected revision could not be read safely; no files were changed.' };
      try { JSON.parse(content); } catch { return { ok: false, message: 'The selected revision contains invalid JSON; no files were changed.' }; }
      restored.push([target, content]);
      let current: string | null = null;
      try { current = await readFile(target, 'utf8'); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') return { ok: false, message: 'The current App Store state could not be read safely; no files were changed.' };
      }
      if (current !== null && current.length > MAX_REVISION_BYTES) return { ok: false, message: 'The current App Store state is too large to preserve safely; no files were changed.' };
      previous.push([target, current]);
    }
    if (authenticatorTarget !== null && authenticatorPrevious !== null) {
      restored.push([path.join(app.getPath('userData'), 'authenticator-history.v1.json'), authenticatorTarget]);
      previous.push([path.join(app.getPath('userData'), 'authenticator-history.v1.json'), authenticatorPrevious]);
    }
    // Preserve the current state before applying the requested revision. This
    // makes restore an append-only operation that can itself be undone.
    if (!await this.snapshotUnlocked(`before restore: ${id}`)) return { ok: false, message: 'The current state could not be preserved in local history; no files were changed.' };
    let transaction: RestoreTransactionManifest | null = null;
    try {
      transaction = await prepareRestoreTransaction(this.restoreTransactionPath, restored.map(([target, content], index) => ({
        targetName: path.basename(target),
        content,
        previous: previous[index]?.[1] ?? null,
      })));
      transaction = await applyRestoreTransaction(this.restoreTransactionPath, app.getPath('userData'), transaction, this.authenticatorHistory);
    } catch {
      const rolledBack = await this.rollbackRestoreTransaction(transaction ?? null);
      return { ok: false, message: rolledBack ? 'The selected App Store state could not be written safely; the prior state was reinstated.' : 'The selected App Store state could not be written safely, and automatic rollback was incomplete; open local versions to recover the last recorded state.' };
    }
    const restoreLabel = `restore: ${id} (${randomUUID()})`;
    try {
      transaction = await markRestoreTransactionRecording(this.restoreTransactionPath, transaction, restoreLabel);
    } catch {
      const rolledBack = await this.rollbackRestoreTransaction(transaction);
      return { ok: false, message: rolledBack ? 'The restored state could not begin its durable history record; the prior state was reinstated.' : 'The restored state could not begin its durable history record and automatic rollback was incomplete; open local versions to recover the last recorded state.' };
    }
    if (!await this.snapshotUnlocked(restoreLabel, true)) {
      const rolledBack = await this.rollbackRestoreTransaction(transaction);
      return { ok: false, message: rolledBack ? 'The restored state could not be recorded as a new local revision; the prior state was reinstated.' : 'The restored state could not be recorded and automatic rollback was incomplete; open local versions to recover the last recorded state.' };
    }
    try {
      await markRestoreTransactionRecorded(this.restoreTransactionPath, transaction);
    } catch {
      const rolledBack = await this.rollbackRestoreTransaction(transaction);
      return { ok: false, message: rolledBack ? 'The restored state could not finish its durable transaction; the prior state was reinstated.' : 'The restored state could not finish its durable transaction and automatic rollback was incomplete; open local versions to recover the last recorded state.' };
    }
    await cleanupRestoreTransaction(this.restoreTransactionPath).catch(() => undefined);
    return { ok: true, message: `Restored local App Store state from ${id.slice(0, 12)}.` };
  }

  private validateRevisionId(value: string): string {
    if (typeof value !== 'string' || !REVISION_ID.test(value)) throw new Error('The local history revision identifier was invalid.');
    return value.toLowerCase();
  }

  private async revisionHasSnapshots(id: string): Promise<boolean> {
    const mode = await this.revisionSnapshotMode(id);
    return mode !== null;
  }

  private async revisionSnapshotMode(id: string): Promise<'complete' | 'legacy-auth' | 'legacy' | null> {
    if (!REVISION_ID.test(id)) return null;
    // A full hash is not enough: reject dangling/unreachable objects that are
    // not part of the user-visible local history branch.
    if (await gitText(this.repositoryPath, ['merge-base', '--is-ancestor', id, 'HEAD'], 100) === null) return null;
    const files = await Promise.all(SNAPSHOT_FILES.map((file) => gitText(this.repositoryPath, ['cat-file', '-e', `${id}:${file}`], 100)));
    if (files.every((value) => value === '')) {
      if (!this.authenticatorHistory) return 'complete';
      const authenticatorFile = await gitText(this.repositoryPath, ['cat-file', '-e', `${id}:state/authenticator-history.json`], 100);
      return authenticatorFile === '' ? 'complete' : 'legacy-auth';
    }
    const coreFiles = await Promise.all(CORE_SNAPSHOT_FILES.map((file) => gitText(this.repositoryPath, ['cat-file', '-e', `${id}:${file}`], 100)));
    if (coreFiles.every((value) => value === '')) return 'legacy';
    const legacyFiles = await Promise.all(LEGACY_SNAPSHOT_FILES.map((file) => gitText(this.repositoryPath, ['cat-file', '-e', `${id}:${file}`], 100)));
    return legacyFiles.every((value) => value === '') ? 'legacy' : null;
  }

  private async readLabels(revision: string): Promise<Record<string, string>> {
    const content = await gitText(this.repositoryPath, ['show', `${revision}:state/labels.v1.json`], 64_000);
    if (!content) return {};
    try {
      const parsed: unknown = JSON.parse(content);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
      const valid = Object.entries(parsed as Record<string, unknown>).flatMap(([key, value]) => REVISION_ID.test(key) && typeof value === 'string' && value.length <= MAX_LABEL_LENGTH ? [[key, value] as [string, string]] : []);
      return Object.fromEntries(valid) as Record<string, string>;
    } catch { return {}; }
  }

  private async snapshot(label: string, force = false): Promise<boolean> {
    return this.enqueueState(() => this.snapshotUnlocked(label, force));
  }

  private authenticatorRestoreAvailable(): boolean {
    if (!this.authenticatorHistory?.restoreAvailable) return false;
    try { return this.authenticatorHistory.restoreAvailable() === true; } catch { return false; }
  }

  private enqueueState<T>(task: () => Promise<T>): Promise<T> {
    const next = this.stateQueue.then(task);
    this.stateQueue = next.then(() => undefined, () => undefined);
    return next;
  }

  private async rollbackRestoreTransaction(transaction: RestoreTransactionManifest | null): Promise<boolean> {
    try {
      if (transaction) await rollbackRestoreTransaction(this.restoreTransactionPath, app.getPath('userData'), transaction, this.authenticatorHistory);
      else await recoverRestoreTransaction(this.restoreTransactionPath, app.getPath('userData'), undefined, this.authenticatorHistory);
      return true;
    } catch {
      return false;
    }
  }

  private async snapshotUnlocked(label: string, force = false): Promise<boolean> {
    try {
      const state = path.join(this.repositoryPath, 'state');
      await mkdir(state, { recursive: true });
      if (await git(this.repositoryPath, ['rev-parse', '--git-dir']) !== 0) await git(this.repositoryPath, ['init']);
      const definitions: Array<{ sourceName: string; stateName: string; fallback: string }> = SNAPSHOT_DEFINITIONS.map((definition) => ({ ...definition }));
      let authenticatorContent: string | null = null;
      if (this.authenticatorHistory) authenticatorContent = await this.authenticatorHistory.snapshot();
      if (authenticatorContent) definitions.push({ sourceName: 'authenticator-history.v1.json', stateName: 'authenticator-history.json', fallback: '' });
      for (const definition of definitions) {
        const source = path.join(app.getPath('userData'), definition.sourceName);
        let content: string = definition.fallback;
        if (definition.sourceName === 'authenticator-history.v1.json') content = authenticatorContent as string;
        else { try { content = await readFile(source, 'utf8'); } catch { /* explicit empty snapshot */ } }
        if (content.length > MAX_REVISION_BYTES) throw new Error(`State file ${definition.sourceName} exceeded the local history bound.`);
        JSON.parse(content);
        await writeFile(path.join(state, definition.stateName), content, { encoding: 'utf8', mode: 0o600 });
      }
      const tracked = (await gitText(this.repositoryPath, ['ls-files', '--', 'state'], 32_000) ?? '').split(/\r?\n/).filter(Boolean);
      // Labels describe revisions rather than live App Store state. Retain
      // them across later snapshots so an append-only label is not silently
      // deleted the next time an operation records a state commit.
      const allowed = new Set([...SNAPSHOT_FILES, ...HISTORY_METADATA_FILES]);
      for (const { stateName } of definitions) allowed.add(`state/${stateName}`);
      for (const file of tracked) if (!allowed.has(file)) await git(this.repositoryPath, ['rm', '--cached', '--ignore-unmatch', '--', file]);
      // The seven-file path remains the original exact add contract:
      // git(this.repositoryPath, ['add', '--', ...SNAPSHOT_FILES])
      await git(this.repositoryPath, ['add', '--', ...definitions.map(({ stateName }) => `state/${stateName}`)]);
      if (force) return await git(this.repositoryPath, ['commit', '--allow-empty', '-m', label]) === 0;
      if (await git(this.repositoryPath, ['diff', '--cached', '--quiet']) === 0) return true;
      return await git(this.repositoryPath, ['commit', '-m', label]) === 0;
    } catch {
      // History snapshots must never fail the operation the user requested.
      return false;
    }
  }
}
