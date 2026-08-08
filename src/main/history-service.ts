import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { historyArchiveRequestSchema, type HistoryArchiveExport, type HistoryArchiveRequest, type HistoryEntry, type HistoryExportFormat, type HistoryMutationResult, type HistoryRevision, type OperationKind } from '../shared/contracts.js';
import { serializeHistoryEntries } from '../shared/export-registry.js';
import { createHistoryArchive } from './history-archive.js';

const MAX_HISTORY_BYTES = 10_000_000;
const MAX_HISTORY_ENTRIES = 10_000;
const MAX_REVISIONS = 200;
const MAX_REVISION_BYTES = 2_000_000;
const MAX_LABEL_LENGTH = 80;
const REVISION_ID = /^[0-9a-f]{40}$/i;
const SNAPSHOT_FILES = ['state/installed-apps.json', 'state/settings.json'] as const;

async function git(cwd: string, args: string[]): Promise<number> {
  return await new Promise<number>((resolve) => {
    const child = spawn('git', args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
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
      env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
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
}

export class HistoryService {
  private readonly root = path.join(app.getPath('userData'), 'history');
  private readonly logPath = path.join(this.root, 'operations.v1.jsonl');
  private readonly repositoryPath = path.join(this.root, 'repository');
  private readonly installedPath = path.join(app.getPath('userData'), 'installed-apps.v1.json');
  private readonly settingsPath = path.join(app.getPath('userData'), 'settings.v1.json');

  async list(): Promise<HistoryEntry[]> {
    try {
      const text = await readFile(this.logPath, 'utf8');
      if (text.length > MAX_HISTORY_BYTES) throw new Error('Operation history exceeded 10 MB.');
      return text
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-MAX_HISTORY_ENTRIES)
        .map((line) => JSON.parse(line) as HistoryEntry)
        .filter((entry) => Boolean(entry?.id && entry?.appId && entry?.occurredAt))
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
      const changedFiles = (changed ?? '').split(/\r?\n/).filter((file): file is string => SNAPSHOT_FILES.includes(file as typeof SNAPSHOT_FILES[number]) || file === 'state/labels.v1.json');
      rows.push({ id: id.toLowerCase(), occurredAt, subject, label: labels[id.toLowerCase()] ?? subject, changedFiles, restorable: await this.revisionHasSnapshots(id) });
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
    const id = this.validateRevisionId(revisionId);
    if (!await this.revisionHasSnapshots(id)) return { ok: false, message: 'That local revision is unavailable or has no complete App Store snapshots.' };
    const restored: Array<[string, string]> = [];
    const previous: Array<[string, string]> = [];
    for (const [source, target] of [[`${id}:state/installed-apps.json`, this.installedPath], [`${id}:state/settings.json`, this.settingsPath]] as const) {
      const content = await gitText(this.repositoryPath, ['show', source]);
      if (content === null || content.length > MAX_REVISION_BYTES) return { ok: false, message: 'The selected revision could not be read safely; no files were changed.' };
      try { JSON.parse(content); } catch { return { ok: false, message: 'The selected revision contains invalid JSON; no files were changed.' }; }
      restored.push([target, content]);
      let current = target === this.installedPath ? '[]\n' : '{}\n';
      try { current = await readFile(target, 'utf8'); } catch { /* explicit empty state */ }
      if (current.length > MAX_REVISION_BYTES) return { ok: false, message: 'The current App Store state is too large to preserve safely; no files were changed.' };
      previous.push([target, current]);
    }
    // Preserve the current state before applying the requested revision. This
    // makes restore an append-only operation that can itself be undone.
    if (!await this.snapshot(`before restore: ${id}`)) return { ok: false, message: 'The current state could not be preserved in local history; no files were changed.' };
    for (const [target, content] of restored) {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, content, { encoding: 'utf8', mode: 0o600 });
    }
    if (!await this.snapshot(`restore: ${id}`, true)) {
      for (const [target, content] of previous) await writeFile(target, content, { encoding: 'utf8', mode: 0o600 });
      return { ok: false, message: 'The restored state could not be recorded as a new local revision; the prior state was reinstated.' };
    }
    return { ok: true, message: `Restored local App Store state from ${id.slice(0, 12)}.` };
  }

  private validateRevisionId(value: string): string {
    if (typeof value !== 'string' || !REVISION_ID.test(value)) throw new Error('The local history revision identifier was invalid.');
    return value.toLowerCase();
  }

  private async revisionHasSnapshots(id: string): Promise<boolean> {
    if (!REVISION_ID.test(id)) return false;
    // A full hash is not enough: reject dangling/unreachable objects that are
    // not part of the user-visible local history branch.
    if (await gitText(this.repositoryPath, ['merge-base', '--is-ancestor', id, 'HEAD'], 100) === null) return false;
    const files = await Promise.all(SNAPSHOT_FILES.map((file) => gitText(this.repositoryPath, ['cat-file', '-e', `${id}:${file}`], 100)));
    return files.every((value) => value === '');
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
    try {
      const state = path.join(this.repositoryPath, 'state');
      await mkdir(state, { recursive: true });
      if (await git(this.repositoryPath, ['rev-parse', '--git-dir']) !== 0) await git(this.repositoryPath, ['init']);
      for (const [source, target, fallback] of [[this.installedPath, 'installed-apps.json', '[]\n'], [this.settingsPath, 'settings.json', '{}\n']] as const) {
        let content: string = fallback;
        try { content = await readFile(source, 'utf8'); } catch { /* explicit empty snapshot */ }
        await writeFile(path.join(state, target), content, { encoding: 'utf8', mode: 0o600 });
      }
      await git(this.repositoryPath, ['add', '--', 'state']);
      if (force) return await git(this.repositoryPath, ['commit', '--allow-empty', '-m', label]) === 0;
      if (await git(this.repositoryPath, ['diff', '--cached', '--quiet']) === 0) return true;
      return await git(this.repositoryPath, ['commit', '-m', label]) === 0;
    } catch {
      // History snapshots must never fail the operation the user requested.
      return false;
    }
  }
}
