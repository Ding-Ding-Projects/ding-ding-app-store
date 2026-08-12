import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, open, readFile, readdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { writeJsonAtomic } from './json-store.js';

export type RestoreTransactionPhase = 'prepared' | 'applying' | 'applied' | 'recording' | 'recorded' | 'rolling-back' | 'rolled-back';

export interface RestoreTransactionFile {
  /** A basename under the application-data directory, never an arbitrary path. */
  targetName: string;
  stagedName: string;
  previousName: string | null;
  stagedBytes: number;
  stagedSha256: string;
  previousBytes: number | null;
  previousSha256: string | null;
}

export interface RestoreTransactionManifest {
  schemaVersion: 1;
  phase: RestoreTransactionPhase;
  files: RestoreTransactionFile[];
  recordLabel?: string;
}

export interface RestoreTransactionInput {
  targetName: string;
  content: string;
  previous: string | null;
}

/** Optional non-file participant for the fixed authenticator snapshot slot. */
export interface RestoreTransactionParticipant {
  restore(content: string, options?: { shouldCommit?: () => boolean; recovery?: boolean }): Promise<void>;
}

const MANIFEST_NAME = 'manifest.json';
const MANIFEST_VERSION = 1;
const ALLOWED_PHASES = new Set<RestoreTransactionPhase>(['prepared', 'applying', 'applied', 'recording', 'recorded', 'rolling-back', 'rolled-back']);
const CORE_RESTORE_TARGET_NAMES = [
  'installed-apps.v1.json',
  'settings.v1.json',
  'workspace.v1.json',
  'appearance.v1.json',
  'schedule.v1.json',
  'schedule-runs.v1.json',
  'external-editor.v1.json',
] as const;
/**
 * Authenticator history is an optional eighth participant. Seven-file
 * journals predate it and must remain recoverable; new journals place the
 * fixed participant record last so the old positional contract is unchanged.
 */
const AUTHENTICATOR_RESTORE_TARGET_NAME = 'authenticator-history.v1.json' as const;
const RESTORE_TARGET_NAMES = [...CORE_RESTORE_TARGET_NAMES, AUTHENTICATOR_RESTORE_TARGET_NAME] as const;
const RESTORE_TARGET_SET = new Set<string>(RESTORE_TARGET_NAMES);
const LEGACY_RESTORE_FILE_COUNT = CORE_RESTORE_TARGET_NAMES.length;
const CURRENT_RESTORE_FILE_COUNT = RESTORE_TARGET_NAMES.length;
const MAX_MANIFEST_BYTES = 32_000;
const MAX_RESTORE_FILE_BYTES = 2_000_000;
const RECORD_LABEL_PATTERN = /^restore: [0-9a-f]{40} \([0-9a-f-]{36}\)$/i;

function manifestPath(transactionRoot: string): string {
  return path.join(transactionRoot, MANIFEST_NAME);
}

function safeBasename(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value === path.basename(value) && value !== '.' && value !== '..' && !value.includes('\\') && !value.includes('/');
}

function sha256(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

function assertManifest(value: unknown): asserts value is RestoreTransactionManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The restore transaction manifest was invalid.');
  const record = value as Record<string, unknown>;
  if (record.schemaVersion !== MANIFEST_VERSION || typeof record.phase !== 'string' || !ALLOWED_PHASES.has(record.phase as RestoreTransactionPhase) || !Array.isArray(record.files) || !new Set<number>([LEGACY_RESTORE_FILE_COUNT, CURRENT_RESTORE_FILE_COUNT]).has(record.files.length)) {
    throw new Error('The restore transaction manifest was invalid.');
  }
  if (record.recordLabel !== undefined && (typeof record.recordLabel !== 'string' || !RECORD_LABEL_PATTERN.test(record.recordLabel))) {
    throw new Error('The restore transaction manifest was invalid.');
  }
  if (record.phase === 'recording' && typeof record.recordLabel !== 'string') throw new Error('The restore transaction manifest was invalid.');
  const targets = new Set<string>();
  const staged = new Set<string>();
  const previous = new Set<string>();
  const expectedTargets = record.files.length === LEGACY_RESTORE_FILE_COUNT ? CORE_RESTORE_TARGET_NAMES : RESTORE_TARGET_NAMES;
  for (const [index, item] of record.files.entries()) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('The restore transaction manifest was invalid.');
    const file = item as Record<string, unknown>;
    if (!safeBasename(file.targetName) || !RESTORE_TARGET_SET.has(file.targetName) || file.targetName !== expectedTargets[index] || targets.has(file.targetName)) {
      throw new Error('The restore transaction manifest was invalid.');
    }
    if (!safeBasename(file.stagedName) || file.stagedName !== `staged-${index}.json` || staged.has(file.stagedName)) {
      throw new Error('The restore transaction manifest was invalid.');
    }
    if (file.previousName !== null && (!safeBasename(file.previousName) || file.previousName !== `previous-${index}.json` || previous.has(file.previousName))) {
      throw new Error('The restore transaction manifest was invalid.');
    }
    if (typeof file.stagedBytes !== 'number' || !Number.isSafeInteger(file.stagedBytes) || file.stagedBytes < 0 || file.stagedBytes > MAX_RESTORE_FILE_BYTES || typeof file.stagedSha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(file.stagedSha256)) {
      throw new Error('The restore transaction manifest was invalid.');
    }
    if (file.previousName === null) {
      if (file.previousBytes !== null || file.previousSha256 !== null) throw new Error('The restore transaction manifest was invalid.');
    } else if (typeof file.previousBytes !== 'number' || !Number.isSafeInteger(file.previousBytes) || file.previousBytes < 0 || file.previousBytes > MAX_RESTORE_FILE_BYTES || typeof file.previousSha256 !== 'string' || !/^[0-9a-f]{64}$/i.test(file.previousSha256)) {
      throw new Error('The restore transaction manifest was invalid.');
    }
    targets.add(file.targetName);
    staged.add(file.stagedName);
    if (file.previousName !== null) previous.add(file.previousName as string);
  }
  if (targets.size !== expectedTargets.length || staged.size !== expectedTargets.length) {
    throw new Error('The restore transaction manifest was invalid.');
  }
}

async function writeDurable(filePath: string, content: string): Promise<void> {
  const handle = await open(filePath, 'wx', 0o600);
  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function verifyDurable(filePath: string, expectedBytes: number, expectedSha256: string): Promise<void> {
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error('The restore transaction file was not a regular file.');
  const content = await readFile(filePath, 'utf8');
  if (Buffer.byteLength(content, 'utf8') !== expectedBytes || sha256(content) !== expectedSha256) throw new Error('The restore transaction file failed its integrity check.');
}

async function writeManifest(transactionRoot: string, manifest: RestoreTransactionManifest): Promise<void> {
  await mkdir(transactionRoot, { recursive: true });
  await writeJsonAtomic(manifestPath(transactionRoot), manifest);
}

async function readManifest(transactionRoot: string): Promise<RestoreTransactionManifest | null> {
  try {
    const manifestFile = manifestPath(transactionRoot);
    if ((await stat(manifestFile)).size > MAX_MANIFEST_BYTES) throw new Error('The restore transaction manifest was too large.');
    const text = await readFile(manifestFile, 'utf8');
    if (Buffer.byteLength(text, 'utf8') > MAX_MANIFEST_BYTES) throw new Error('The restore transaction manifest was too large.');
    const parsed: unknown = JSON.parse(text);
    assertManifest(parsed);
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

async function replaceFromStage(source: string, target: string): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  try {
    await rename(source, target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!['EACCES', 'EBUSY', 'EEXIST', 'EPERM'].includes(code ?? '')) throw error;
    await rm(target, { force: true });
    await rename(source, target);
  }
}

export async function prepareRestoreTransaction(transactionRoot: string, files: RestoreTransactionInput[]): Promise<RestoreTransactionManifest> {
  if (!new Set<number>([LEGACY_RESTORE_FILE_COUNT, CURRENT_RESTORE_FILE_COUNT]).has(files.length)) throw new Error('The restore transaction must contain the legacy seven files or the current seven files plus its fixed authenticator participant.');
  const expectedTargets = files.length === LEGACY_RESTORE_FILE_COUNT ? CORE_RESTORE_TARGET_NAMES : RESTORE_TARGET_NAMES;
  if (files.some((file, index) => !safeBasename(file.targetName) || file.targetName !== expectedTargets[index])) throw new Error('The restore transaction targets were invalid or out of order.');
  try {
    const existing = await readdir(transactionRoot);
    if (existing.length > 0) {
      const integrity = new Error('An unfinished restore transaction is retained for startup recovery.') as NodeJS.ErrnoException;
      integrity.code = 'EINTEGRITY';
      throw integrity;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  await rm(transactionRoot, { recursive: true, force: true });
  await mkdir(transactionRoot, { recursive: true });
  const manifestFiles: RestoreTransactionFile[] = [];
  for (const [index, file] of files.entries()) {
    if (!safeBasename(file.targetName)) throw new Error('The restore transaction target was invalid.');
    const stagedBytes = Buffer.byteLength(file.content, 'utf8');
    if (stagedBytes > MAX_RESTORE_FILE_BYTES) throw new Error('The restore transaction file was too large.');
    const stagedName = `staged-${index}.json`;
    const previousName = file.previous === null ? null : `previous-${index}.json`;
    await writeDurable(path.join(transactionRoot, stagedName), file.content);
    let previousBytes: number | null = null;
    let previousSha256: string | null = null;
    if (previousName) {
      previousBytes = Buffer.byteLength(file.previous as string, 'utf8');
      if (previousBytes > MAX_RESTORE_FILE_BYTES) throw new Error('The restore transaction file was too large.');
      previousSha256 = sha256(file.previous as string);
      await writeDurable(path.join(transactionRoot, previousName), file.previous as string);
    }
    manifestFiles.push({ targetName: file.targetName, stagedName, previousName, stagedBytes, stagedSha256: sha256(file.content), previousBytes, previousSha256 });
  }
  const manifest: RestoreTransactionManifest = { schemaVersion: MANIFEST_VERSION, phase: 'prepared', files: manifestFiles };
  await writeManifest(transactionRoot, manifest);
  return manifest;
}

export async function applyRestoreTransaction(transactionRoot: string, targetRoot: string, manifest: RestoreTransactionManifest, participant?: RestoreTransactionParticipant): Promise<RestoreTransactionManifest> {
  assertManifest(manifest);
  const applying = { ...manifest, phase: 'applying' as const };
  await writeManifest(transactionRoot, applying);
  for (const file of applying.files) {
    await verifyDurable(path.join(transactionRoot, file.stagedName), file.stagedBytes, file.stagedSha256);
    if (file.targetName === AUTHENTICATOR_RESTORE_TARGET_NAME) {
      if (!participant) throw new Error('The authenticator restore participant was unavailable.');
      await participant.restore(await readFile(path.join(transactionRoot, file.stagedName), 'utf8'));
    } else await replaceFromStage(path.join(transactionRoot, file.stagedName), path.join(targetRoot, file.targetName));
  }
  const applied = { ...applying, phase: 'applied' as const };
  await writeManifest(transactionRoot, applied);
  return applied;
}

export async function markRestoreTransactionRecording(transactionRoot: string, manifest: RestoreTransactionManifest, recordLabel: string): Promise<RestoreTransactionManifest> {
  assertManifest(manifest);
  if (!RECORD_LABEL_PATTERN.test(recordLabel)) throw new Error('The restore transaction record label was invalid.');
  const recording = { ...manifest, phase: 'recording' as const, recordLabel };
  await writeManifest(transactionRoot, recording);
  return recording;
}

export async function rollbackRestoreTransaction(transactionRoot: string, targetRoot: string, manifest: RestoreTransactionManifest, participant?: RestoreTransactionParticipant): Promise<RestoreTransactionManifest> {
  assertManifest(manifest);
  const rollingBack = { ...manifest, phase: 'rolling-back' as const };
  await writeManifest(transactionRoot, rollingBack);
  for (const file of rollingBack.files) {
    const target = path.join(targetRoot, file.targetName);
    if (file.targetName === AUTHENTICATOR_RESTORE_TARGET_NAME) {
      if (!participant) throw new Error('The authenticator restore participant was unavailable.');
      if (file.previousName === null) throw new Error('The authenticator restore participant had no rollback snapshot.');
      await verifyDurable(path.join(transactionRoot, file.previousName), file.previousBytes as number, file.previousSha256 as string);
      await participant.restore(await readFile(path.join(transactionRoot, file.previousName), 'utf8'), { recovery: true });
    } else if (file.previousName === null) await rm(target, { force: true });
    else {
      await verifyDurable(path.join(transactionRoot, file.previousName), file.previousBytes as number, file.previousSha256 as string);
      const previous = await readFile(path.join(transactionRoot, file.previousName), 'utf8');
      // Keep the rollback staging byte stream inside the journal root so an
      // interrupted process cannot leave an orphaned state-looking file in
      // the live application-data directory. The journal is removed during
      // normal completion and startup recovery.
      const temporary = path.join(transactionRoot, `rollback-${file.targetName}-${process.pid}-${randomUUID()}.tmp`);
      try {
        await writeDurable(temporary, previous);
        await replaceFromStage(temporary, target);
      } finally {
        await rm(temporary, { force: true }).catch(() => undefined);
      }
    }
  }
  const rolledBack = { ...rollingBack, phase: 'rolled-back' as const };
  await writeManifest(transactionRoot, rolledBack);
  await rm(transactionRoot, { recursive: true, force: true });
  return rolledBack;
}

export async function markRestoreTransactionRecorded(transactionRoot: string, manifest: RestoreTransactionManifest): Promise<RestoreTransactionManifest> {
  assertManifest(manifest);
  const recorded = { ...manifest, phase: 'recorded' as const };
  await writeManifest(transactionRoot, recorded);
  return recorded;
}

export async function cleanupRestoreTransaction(transactionRoot: string): Promise<void> {
  await rm(transactionRoot, { recursive: true, force: true });
}

/** Recovers an interrupted restore before any state service reads application data. */
export async function recoverRestoreTransaction(transactionRoot: string, targetRoot: string, keepRecorded?: (manifest: RestoreTransactionManifest) => Promise<boolean>, participant?: RestoreTransactionParticipant): Promise<void> {
  const manifest = await readManifest(transactionRoot);
  if (!manifest) {
    await cleanupRestoreTransaction(transactionRoot);
    return;
  }
  if (manifest.phase === 'recorded' || manifest.phase === 'rolled-back' || (manifest.phase === 'recording' && keepRecorded && await keepRecorded(manifest))) {
    await cleanupRestoreTransaction(transactionRoot);
    return;
  }
  await rollbackRestoreTransaction(transactionRoot, targetRoot, manifest, participant);
}
