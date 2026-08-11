import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { watch as watchDirectory, type FSWatcher } from 'node:fs';
import { mkdir, open, link, readdir as readDirectory, unlink, type FileHandle } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { z } from 'zod';
import type {
  SchoolModeConfigureRequest,
  SchoolModeCredentialChangeRequest,
  SchoolModeMutationCode,
  SchoolModeMutationResult,
  SchoolModeRenameRequest,
  SchoolModeSnapshot,
  SchoolModeState,
  SchoolModeSyncStatus,
  SchoolModeToggleRequest,
  SchoolModeUnavailableReason,
  SchoolModeVerifyRequest,
  SchoolSupportedUnlockKind,
} from '../shared/contracts.js';
import { writeJsonAtomic } from './json-store.js';

const DEFAULT_NAME = 'School mode';
const MAX_NAME = 64;
const MAX_CREDENTIAL = 512;
const MAX_RECORD_BYTES = 32 * 1024;
const DEFAULT_LOCK_TIMEOUT_MS = 2_000;
const DEFAULT_LOCK_RETRY_MS = 25;
const DEFAULT_WATCH_DEBOUNCE_MS = 60;
const DEFAULT_POLL_INTERVAL_MS = 2_000;
const MAX_LOCK_BYTES = 2_048;
const MAX_RECOVERY_DEPTH = 8;

const credentialSchema = z.string().min(4).max(MAX_CREDENTIAL);
const pinSchema = z.string().regex(/^\d{4,64}$/);
const passwordSchema = credentialSchema;
const nameSchema = z.string().trim().min(1).max(MAX_NAME);
const storedUnlockKindSchema = z.enum(['pin', 'password', 'passkey']);
const supportedUnlockKindSchema = z.enum(['pin', 'password']);
const recordIdSchema = z.string().regex(/^[A-Za-z0-9_-]{22,64}$/);
const expectedRecordIdSchema = recordIdSchema.nullable();
const expectedRevisionSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const configureRequestSchema = z.strictObject({ expectedRecordId: expectedRecordIdSchema, expectedRevision: expectedRevisionSchema, displayName: nameSchema, unlockKind: supportedUnlockKindSchema, credential: credentialSchema });
const renameRequestSchema = z.strictObject({ expectedRecordId: expectedRecordIdSchema, expectedRevision: expectedRevisionSchema, displayName: nameSchema, credential: credentialSchema.optional() });
const toggleRequestSchema = z.strictObject({ expectedRecordId: expectedRecordIdSchema, expectedRevision: expectedRevisionSchema, enabled: z.boolean(), credential: credentialSchema.optional() });
const verifyRequestSchema = z.strictObject({ credential: credentialSchema });
const credentialChangeRequestSchema = z.strictObject({
  expectedRecordId: expectedRecordIdSchema,
  expectedRevision: expectedRevisionSchema,
  currentCredential: credentialSchema,
  nextCredential: credentialSchema,
  unlockKind: supportedUnlockKindSchema,
});
const recordFields = {
  enabled: z.boolean(),
  displayName: nameSchema,
  unlockKind: storedUnlockKindSchema.nullable(),
  salt: z.string().regex(/^[A-Za-z0-9+/]{16,128}={0,2}$/),
  verifier: z.string().regex(/^[A-Za-z0-9+/]{32,128}={0,2}$/),
} as const;
const hasUnlockWhenEnabled = <T extends { enabled: boolean; unlockKind: string | null }>(record: T) => !record.enabled || record.unlockKind !== null;
const recordV1Schema = z.strictObject({ schemaVersion: z.literal(1), ...recordFields }).refine(hasUnlockWhenEnabled);
const recordV2Schema = z.strictObject({ schemaVersion: z.literal(2), recordId: recordIdSchema, revision: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER), ...recordFields }).refine(hasUnlockWhenEnabled);
const lockOwnerSchema = z.strictObject({ token: recordIdSchema, pid: z.number().int().positive(), createdAt: z.number().int().nonnegative() });
const recoveryClaimSchema = z.strictObject({
  expectedOwnerToken: recordIdSchema,
  claimantPid: z.number().int().positive(),
  claimantToken: recordIdSchema,
  predecessorToken: recordIdSchema.nullable(),
  createdAt: z.number().int().nonnegative(),
});

type LegacyStoredRecord = z.infer<typeof recordV1Schema>;
type StoredRecord = z.infer<typeof recordV2Schema>;
type ReadResult =
  | { kind: 'missing' }
  | { kind: 'record'; record: StoredRecord }
  | { kind: 'legacy'; record: LegacyStoredRecord }
  | { kind: 'failure'; reason: Extract<SchoolModeUnavailableReason, 'read-failed' | 'parse-failed'> };
type MutationDecision = { ok: false; code: SchoolModeMutationCode } | { ok: true; record: StoredRecord; code: SchoolModeMutationCode };
type DirectoryWatchFactory = (directory: string, listener: (eventType: string, filename: string | Buffer | null) => void) => FSWatcher;
type PublishCheck = () => boolean;
type RecordWriter = (filePath: string, value: unknown, shouldPublish: PublishCheck) => Promise<void>;
type LockFileSystem = {
  open(filePath: string, flags: 'wx' | 'r', mode: number): Promise<FileHandle>;
  link(existingPath: string, newPath: string): Promise<void>;
  readdir?(directory: string): Promise<string[]>;
  unlink(filePath: string): Promise<void>;
};
type BoundedReadResult = { kind: 'missing' } | { kind: 'text'; text: string } | { kind: 'too-large' } | { kind: 'failure' };

export interface SchoolModeServiceOptions {
  watchFactory?: DirectoryWatchFactory;
  writeRecord?: RecordWriter;
  lockFileSystem?: LockFileSystem;
  isProcessAlive?: (pid: number) => boolean | Promise<boolean>;
  lockTimeoutMs?: number;
  lockRetryMs?: number;
  watchDebounceMs?: number;
  pollIntervalMs?: number;
  processId?: number;
}

class LockConflictError extends Error {}

function publicState(record: Pick<StoredRecord, 'recordId' | 'revision' | 'enabled' | 'displayName' | 'unlockKind'>): SchoolModeState {
  return { schemaVersion: 2, recordId: record.recordId, revision: record.revision, enabled: record.enabled, displayName: record.displayName, unlockKind: record.unlockKind };
}

function emptyState(): SchoolModeState {
  return { schemaVersion: 2, recordId: null, revision: 0, enabled: false, displayName: DEFAULT_NAME, unlockKind: null };
}

function encode(value: Uint8Array): string { return Buffer.from(value).toString('base64'); }
function decode(value: string): Buffer { return Buffer.from(value, 'base64'); }
function newRecordId(): string { return encode(randomBytes(18)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }

function verifier(secret: string, salt: Buffer): Buffer {
  // The clear credential never enters the JSON file, renderer snapshot,
  // history, exports, notifications, diagnostics, or watcher events.
  return scryptSync(secret, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
}

function recordsEqual(left: StoredRecord, right: StoredRecord): boolean {
  return left.recordId === right.recordId
    && left.revision === right.revision
    && left.enabled === right.enabled
    && left.displayName === right.displayName
    && left.unlockKind === right.unlockKind
    && left.salt === right.salt
    && left.verifier === right.verifier;
}

function snapshotsEqual(left: SchoolModeSnapshot, right: SchoolModeSnapshot): boolean {
  return JSON.stringify({ ...left, observationSequence: 0 }) === JSON.stringify({ ...right, observationSequence: 0 });
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref?.();
  });
}

export class SchoolModeService {
  private readonly filePath: string;
  private readonly lockPath: string;
  private readonly releaseMarkerPrefix: string;
  private readonly watchFactory: DirectoryWatchFactory;
  private readonly writeRecord: RecordWriter;
  private readonly lockFileSystem: LockFileSystem;
  private readonly isProcessAlive: (pid: number) => boolean | Promise<boolean>;
  private readonly lockTimeoutMs: number;
  private readonly lockRetryMs: number;
  private readonly watchDebounceMs: number;
  private readonly pollIntervalMs: number;
  private readonly processId: number;
  private readonly listeners = new Set<(snapshot: SchoolModeSnapshot) => void>();
  private readonly orphanedLockTokens = new Set<string>();
  private readonly ownedRecoveryClaimTokens = new Set<string>();
  private readonly releasePromises = new Map<string, Promise<boolean>>();
  private record: StoredRecord | null = null;
  private known = false;
  private observationSequence = 0;
  private sync: SchoolModeSyncStatus = { status: 'ready', watching: false };
  private watcher: FSWatcher | null = null;
  private watchTimer: NodeJS.Timeout | null = null;
  private pollTimer: NodeJS.Timeout | null = null;
  private started = false;
  private disposed = false;
  private disposing = false;
  private disposePromise: Promise<void> | null = null;
  private serial: Promise<void> = Promise.resolve();

  constructor(filePath = path.join(app.getPath('appData'), 'Ding-Ding-Projects', 'global', 'school-mode.v1.json'), options: SchoolModeServiceOptions = {}) {
    this.filePath = filePath;
    this.lockPath = `${filePath}.lock`;
    this.releaseMarkerPrefix = `${this.lockPath}.releasing.`;
    this.watchFactory = options.watchFactory ?? ((directory, listener) => watchDirectory(directory, { persistent: false }, listener));
    this.writeRecord = options.writeRecord ?? ((target, value, shouldPublish) => writeJsonAtomic(target, value, { shouldPublish }));
    this.lockFileSystem = options.lockFileSystem ?? { open, link, unlink };
    this.isProcessAlive = options.isProcessAlive ?? ((pid) => {
      try { process.kill(pid, 0); return true; }
      catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
    });
    this.lockTimeoutMs = options.lockTimeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
    this.lockRetryMs = options.lockRetryMs ?? DEFAULT_LOCK_RETRY_MS;
    this.watchDebounceMs = options.watchDebounceMs ?? DEFAULT_WATCH_DEBOUNCE_MS;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.processId = options.processId ?? process.pid;
  }

  subscribe(listener: (snapshot: SchoolModeSnapshot) => void): () => void {
    if (this.isClosed()) return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async start(): Promise<SchoolModeSnapshot> {
    return this.runSerial(async () => {
      if (this.isClosed()) return this.snapshot();
      this.started = true;
      await this.ensureWatcher();
      await this.refreshFromDisk();
      this.schedulePoll();
      return this.snapshot();
    });
  }

  async load(): Promise<SchoolModeSnapshot> {
    return this.runSerial(async () => {
      if (this.isClosed()) return this.snapshot();
      if (this.started) await this.ensureWatcher();
      await this.refreshFromDisk();
      if (this.started) this.schedulePoll();
      return this.snapshot();
    });
  }

  async configure(request: SchoolModeConfigureRequest): Promise<SchoolModeMutationResult> {
    if (this.isClosed()) return this.serviceClosedFailure();
    const parsed = configureRequestSchema.safeParse(request);
    if (!parsed.success) return this.validationFailure('invalid-configure');
    const credentialCode = this.validateNewCredential(parsed.data.unlockKind, parsed.data.credential);
    if (credentialCode) return this.validationFailure(credentialCode);
    return this.mutate(parsed.data.expectedRecordId, parsed.data.expectedRevision, (latest) => {
      if (latest?.unlockKind) return { ok: false, code: 'already-configured' };
      const salt = randomBytes(16);
      const record: StoredRecord = {
        schemaVersion: 2,
        recordId: latest?.recordId ?? newRecordId(),
        revision: (latest?.revision ?? 0) + 1,
        enabled: true,
        displayName: parsed.data.displayName,
        unlockKind: parsed.data.unlockKind,
        salt: encode(salt),
        verifier: encode(verifier(parsed.data.credential, salt)),
      };
      return { ok: true, record, code: 'configured' };
    });
  }

  async rename(request: SchoolModeRenameRequest): Promise<SchoolModeMutationResult> {
    if (this.isClosed()) return this.serviceClosedFailure();
    const parsed = renameRequestSchema.safeParse(request);
    if (!parsed.success) return this.validationFailure('invalid-name');
    return this.mutate(parsed.data.expectedRecordId, parsed.data.expectedRevision, (latest) => {
      if (latest?.enabled && (!parsed.data.credential || !this.matches(parsed.data.credential, latest))) {
        return { ok: false, code: 'credential-rejected' };
      }
      const base = latest ?? this.unconfiguredRecord();
      if (base.displayName === parsed.data.displayName) return { ok: false, code: 'name-unchanged' };
      return {
        ok: true,
        record: { ...base, revision: base.revision + 1, displayName: parsed.data.displayName },
        code: 'name-saved',
      };
    });
  }

  async setEnabled(request: SchoolModeToggleRequest): Promise<SchoolModeMutationResult> {
    if (this.isClosed()) return this.serviceClosedFailure();
    const parsed = toggleRequestSchema.safeParse(request);
    if (!parsed.success) return this.validationFailure('invalid-toggle');
    return this.mutate(parsed.data.expectedRecordId, parsed.data.expectedRevision, (latest) => {
      if (!latest?.unlockKind) return { ok: false, code: 'not-configured' };
      if (latest.unlockKind === 'passkey') return { ok: false, code: 'passkey-unsupported' };
      if (!parsed.data.enabled && (!parsed.data.credential || !this.matches(parsed.data.credential, latest))) {
        return { ok: false, code: 'credential-rejected' };
      }
      if (latest.enabled === parsed.data.enabled) return { ok: false, code: latest.enabled ? 'already-enabled' : 'already-disabled' };
      const record = { ...latest, revision: latest.revision + 1, enabled: parsed.data.enabled };
      return {
        ok: true,
        record,
        code: record.enabled ? 'enabled' : 'disabled',
      };
    });
  }

  async changeCredential(request: SchoolModeCredentialChangeRequest): Promise<SchoolModeMutationResult> {
    if (this.isClosed()) return this.serviceClosedFailure();
    const parsed = credentialChangeRequestSchema.safeParse(request);
    if (!parsed.success) return this.validationFailure('invalid-credential-change');
    const credentialCode = this.validateNewCredential(parsed.data.unlockKind, parsed.data.nextCredential);
    if (credentialCode) return this.validationFailure(credentialCode);
    return this.mutate(parsed.data.expectedRecordId, parsed.data.expectedRevision, (latest) => {
      if (!latest?.unlockKind) return { ok: false, code: 'not-configured' };
      if (latest.unlockKind === 'passkey') return { ok: false, code: 'passkey-unsupported' };
      if (!this.matches(parsed.data.currentCredential, latest)) return { ok: false, code: 'credential-rejected' };
      const salt = randomBytes(16);
      return {
        ok: true,
        record: {
          ...latest,
          revision: latest.revision + 1,
          unlockKind: parsed.data.unlockKind,
          salt: encode(salt),
          verifier: encode(verifier(parsed.data.nextCredential, salt)),
        },
        code: parsed.data.unlockKind === 'pin' ? 'credential-changed-pin' : 'credential-changed-password',
      };
    });
  }

  async verify(request: SchoolModeVerifyRequest): Promise<boolean> {
    const parsed = verifyRequestSchema.safeParse(request);
    if (!parsed.success || this.isClosed()) return false;
    return this.runSerial(async () => {
      if (this.isClosed()) return false;
      await this.refreshFromDisk();
      return Boolean(this.sync.status === 'ready' && this.record?.unlockKind !== 'passkey' && this.record?.verifier && this.matches(parsed.data.credential, this.record));
    });
  }

  async dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;
    this.disposing = true;
    this.started = false;
    if (this.watchTimer) clearTimeout(this.watchTimer);
    this.watchTimer = null;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    this.closeWatcher();
    this.listeners.clear();
    this.sync = { status: 'unavailable', watching: false, reason: 'service-closed' };
    // The serial queue owns the complete mutation, including the final lock
    // release. Drain it before resolving disposal so a custom writer cannot
    // finish a filesystem write after the service is considered closed.
    const pending = this.serial;
    this.disposePromise = Promise.allSettled([pending]).then(() => {
      this.disposed = true;
      this.disposing = false;
    });
    return this.disposePromise;
  }

  private async mutate(expectedRecordId: string | null, expectedRevision: number, decide: (latest: StoredRecord | null) => MutationDecision): Promise<SchoolModeMutationResult> {
    return this.runSerial(async () => {
      if (this.isClosed()) return this.serviceClosedFailure();
      let release: (() => Promise<void>) | null = null;
      try {
        release = await this.acquireLock();
      } catch (error) {
        const reason: Extract<SchoolModeUnavailableReason, 'conflict' | 'write-failed'> = error instanceof LockConflictError ? 'conflict' : 'write-failed';
        this.setUnavailable(reason);
        return { ok: false, snapshot: this.snapshot(), code: reason };
      }

      try {
        if (this.isClosed()) return this.serviceClosedFailure();
        const disk = await this.readFromDisk();
        if (this.isClosed()) return this.serviceClosedFailure();
        if (disk.kind === 'failure') {
          this.setUnavailable(disk.reason);
          return { ok: false, snapshot: this.snapshot(), code: disk.reason };
        }
        const latest = disk.kind === 'missing' ? null : disk.kind === 'legacy' ? this.fromLegacy(disk.record, 1) : disk.record;
        const latestRevision = latest?.revision ?? 0;
        const latestRecordId = latest?.recordId ?? null;
        if (expectedRecordId !== latestRecordId || expectedRevision !== latestRevision) {
          this.acceptKnownRecord(latest, { status: 'unavailable', watching: Boolean(this.watcher), reason: 'conflict' });
          return { ok: false, snapshot: this.snapshot(), code: 'conflict' };
        }
        const decision = decide(latest);
        if (!decision.ok) {
          this.acceptKnownRecord(latest, this.readyStatus());
          return { ok: false, snapshot: this.snapshot(), code: decision.code };
        }
        if (latestRevision >= Number.MAX_SAFE_INTEGER) {
          this.acceptKnownRecord(latest, this.readyStatus());
          return { ok: false, snapshot: this.snapshot(), code: 'revision-exhausted' };
        }
        if (this.isClosed()) return this.serviceClosedFailure();
        try {
          await this.writeRecord(this.filePath, decision.record, () => !this.isClosed());
        } catch {
          if (this.isClosed()) return this.serviceClosedFailure();
          this.setUnavailable('write-failed');
          return { ok: false, snapshot: this.snapshot(), code: 'write-failed' };
        }
        if (this.isClosed()) return this.serviceClosedFailure();
        const readback = await this.readFromDisk();
        if (this.isClosed()) return this.serviceClosedFailure();
        if (readback.kind !== 'record' || !recordsEqual(readback.record, decision.record)) {
          const reason: Extract<SchoolModeUnavailableReason, 'read-failed' | 'parse-failed' | 'conflict'> = readback.kind === 'failure' ? readback.reason : 'conflict';
          this.setUnavailable(reason);
          return { ok: false, snapshot: this.snapshot(), code: reason };
        }
        this.acceptKnownRecord(readback.record, this.readyStatus(), true);
        return { ok: true, snapshot: this.snapshot(), code: decision.code };
      } finally {
        await release();
      }
    });
  }

  private async refreshFromDisk(): Promise<void> {
    if (this.isClosed()) return;
    const disk = await this.readFromDisk();
    if (this.isClosed()) return;
    if (disk.kind === 'failure') {
      this.setUnavailable(disk.reason);
      return;
    }
    if (disk.kind === 'missing') {
      this.acceptKnownRecord(null, this.readyStatus());
      return;
    }
    if (disk.kind === 'legacy') {
      await this.migrateLegacy();
      return;
    }
    if (this.known && this.record && disk.record.recordId === this.record.recordId && disk.record.revision < this.record.revision) {
      this.setUnavailable('conflict');
      return;
    }
    if (this.known && this.record && disk.record.recordId === this.record.recordId && disk.record.revision === this.record.revision && !recordsEqual(disk.record, this.record)) {
      this.setUnavailable('conflict');
      return;
    }
    this.acceptKnownRecord(disk.record, this.readyStatus());
  }

  private async migrateLegacy(): Promise<void> {
    if (this.isClosed()) return;
    let release: (() => Promise<void>) | null = null;
    try {
      release = await this.acquireLock();
      if (this.isClosed()) return;
      const disk = await this.readFromDisk();
      if (this.isClosed()) return;
      if (disk.kind === 'failure') {
        this.setUnavailable(disk.reason);
        return;
      }
      if (disk.kind === 'missing') {
        this.acceptKnownRecord(null, this.readyStatus());
        return;
      }
      if (disk.kind === 'record') {
        this.acceptKnownRecord(disk.record, this.readyStatus());
        return;
      }
      const migrated = this.fromLegacy(disk.record, 1);
      if (this.isClosed()) return;
      try {
      await this.writeRecord(this.filePath, migrated, () => !this.isClosed());
      } catch {
        this.setUnavailable('write-failed');
        return;
      }
      if (this.isClosed()) return;
      const readback = await this.readFromDisk();
      if (this.isClosed()) return;
      if (readback.kind !== 'record' || !recordsEqual(readback.record, migrated)) {
        this.setUnavailable(readback.kind === 'failure' ? readback.reason : 'conflict');
        return;
      }
      this.acceptKnownRecord(readback.record, this.readyStatus(), true);
    } catch (error) {
      const reason: SchoolModeUnavailableReason = error instanceof LockConflictError ? 'conflict' : 'write-failed';
      this.setUnavailable(reason);
    } finally {
      if (release) await release();
    }
  }

  private async readFromDisk(): Promise<ReadResult> {
    const bounded = await this.readBoundedFile(this.filePath, MAX_RECORD_BYTES);
    if (bounded.kind === 'missing') return { kind: 'missing' };
    if (bounded.kind === 'too-large') return { kind: 'failure', reason: 'parse-failed' };
    if (bounded.kind === 'failure') return { kind: 'failure', reason: 'read-failed' };
    const text = bounded.text;
    let raw: unknown;
    try { raw = JSON.parse(text) as unknown; }
    catch { return { kind: 'failure', reason: 'parse-failed' }; }
    const current = recordV2Schema.safeParse(raw);
    if (current.success) {
      if (current.data.unlockKind === 'passkey') return { kind: 'failure', reason: 'parse-failed' };
      return { kind: 'record', record: current.data };
    }
    const legacy = recordV1Schema.safeParse(raw);
    if (legacy.success) {
      if (legacy.data.unlockKind === 'passkey') return { kind: 'failure', reason: 'parse-failed' };
      return { kind: 'legacy', record: legacy.data };
    }
    return { kind: 'failure', reason: 'parse-failed' };
  }

  private fromLegacy(record: LegacyStoredRecord, revision: number): StoredRecord {
    return { ...record, schemaVersion: 2, recordId: newRecordId(), revision };
  }

  private unconfiguredRecord(): StoredRecord {
    return {
      schemaVersion: 2,
      recordId: newRecordId(),
      revision: 0,
      enabled: false,
      displayName: DEFAULT_NAME,
      unlockKind: null,
      salt: encode(randomBytes(16)),
      verifier: encode(randomBytes(32)),
    };
  }

  private validateNewCredential(kind: SchoolSupportedUnlockKind, credential: string): Extract<SchoolModeMutationCode, 'invalid-pin' | 'invalid-password'> | null {
    if (kind === 'pin' && !pinSchema.safeParse(credential).success) return 'invalid-pin';
    if (kind === 'password' && !passwordSchema.safeParse(credential).success) return 'invalid-password';
    return null;
  }

  private matches(secret: string, record: StoredRecord): boolean {
    if (record.unlockKind === 'passkey') return false;
    const parsed = credentialSchema.safeParse(secret);
    if (!parsed.success) return false;
    try {
      const expected = decode(record.verifier);
      const actual = verifier(parsed.data, decode(record.salt));
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch { return false; }
  }

  private async ensureWatcher(): Promise<void> {
    if (!this.started || this.isClosed() || this.watcher) return;
    try {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      if (!this.started || this.isClosed()) return;
      const watchedName = path.basename(this.filePath).toLocaleLowerCase();
      const watcher = this.watchFactory(path.dirname(this.filePath), (_eventType, filename) => {
        if (this.isClosed()) return;
        const changedName = typeof filename === 'string' ? filename : filename?.toString();
        if (changedName && changedName.toLocaleLowerCase() !== watchedName) return;
        if (this.watchTimer) clearTimeout(this.watchTimer);
        this.watchTimer = setTimeout(() => {
          this.watchTimer = null;
          void this.runSerial(() => this.refreshFromDisk());
        }, this.watchDebounceMs);
        this.watchTimer.unref?.();
      });
      watcher.on('error', () => {
        void this.runSerial(async () => {
          this.closeWatcher();
          this.setUnavailable('watch-failed');
        });
      });
      this.watcher = watcher;
      // Attaching a watcher does not verify what changed while observation was
      // unavailable. The caller must complete refreshFromDisk before ready is
      // published, preventing a stale disabled snapshot from opening the UI.
    } catch {
      this.closeWatcher();
      this.setUnavailable('watch-failed');
    }
  }

  private schedulePoll(): void {
    if (!this.started || this.isClosed() || this.pollTimer) return;
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.runSerial(async () => {
        if (this.isClosed() || !this.started) return;
        await this.ensureWatcher();
        await this.refreshFromDisk();
        this.schedulePoll();
      });
    }, this.pollIntervalMs);
    this.pollTimer.unref?.();
  }

  private closeWatcher(): void {
    const watcher = this.watcher;
    this.watcher = null;
    if (!watcher) return;
    watcher.removeAllListeners();
    try { watcher.close(); } catch { /* Closing a failed watcher is best effort. */ }
  }

  private readyStatus(): SchoolModeSyncStatus {
    if (this.watcher) return { status: 'ready', watching: true };
    if (this.started) return { status: 'unavailable', watching: false, reason: 'watch-failed' };
    return { status: 'ready', watching: false };
  }

  private acceptKnownRecord(record: StoredRecord | null, sync: SchoolModeSyncStatus, force = false): void {
    if (this.isClosed()) return;
    const previous = this.snapshot();
    this.record = record;
    this.known = true;
    this.sync = sync;
    const next = this.snapshot();
    if (force || !snapshotsEqual(previous, next)) this.publish();
  }

  private setSync(sync: SchoolModeSyncStatus): void {
    if (this.isClosed()) return;
    const previous = this.snapshot();
    this.sync = sync;
    const next = this.snapshot();
    if (!snapshotsEqual(previous, next)) this.publish();
  }

  private setUnavailable(reason: SchoolModeUnavailableReason): void {
    this.setSync({ status: 'unavailable', watching: Boolean(this.watcher), reason });
  }

  private snapshot(): SchoolModeSnapshot {
    const state = this.known ? this.record ? publicState(this.record) : emptyState() : null;
    return {
      schemaVersion: 1,
      observationSequence: this.observationSequence,
      state,
      configured: Boolean(state?.unlockKind),
      sync: { ...this.sync },
    };
  }

  private publish(): void {
    if (this.isClosed()) return;
    this.observationSequence += 1;
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      try { listener(snapshot); } catch { /* One listener cannot break shared persistence. */ }
    }
  }

  private validationFailure(code: SchoolModeMutationCode): Promise<SchoolModeMutationResult> {
    if (this.isClosed()) return Promise.resolve(this.serviceClosedFailure());
    return Promise.resolve({ ok: false, snapshot: this.snapshot(), code });
  }

  private serviceClosedFailure(): SchoolModeMutationResult {
    return { ok: false, snapshot: this.snapshot(), code: 'service-closed' };
  }

  private async acquireLock(): Promise<() => Promise<void>> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await this.cleanupOwnedLocks();
    const deadline = Date.now() + this.lockTimeoutMs;
    for (;;) {
      if (await this.releaseInProgress()) {
        if (Date.now() >= deadline) throw new LockConflictError('lock release in progress');
        await delay(this.lockRetryMs);
        continue;
      }
      const token = newRecordId();
      const candidatePath = `${this.lockPath}.candidate.${this.processId}.${token}`;
      let handle: FileHandle | null = null;
      try {
        handle = await this.lockFileSystem.open(candidatePath, 'wx', 0o600);
        try {
          await handle.writeFile(JSON.stringify({ token, pid: this.processId, createdAt: Date.now() }), 'utf8');
          await handle.sync();
        } catch (error) {
          await handle.close().catch(() => undefined);
          handle = null;
          await this.lockFileSystem.unlink(candidatePath).catch(() => undefined);
          throw error;
        }
        await handle.close();
        handle = null;
        await this.lockFileSystem.link(candidatePath, this.lockPath);
        await this.lockFileSystem.unlink(candidatePath).catch(() => undefined);
        this.orphanedLockTokens.add(token);
        let released = false;
        return async () => {
          if (released) return;
          released = true;
          if (await this.releaseOwnedLock(token)) this.orphanedLockTokens.delete(token);
          else this.setUnavailable('write-failed');
        };
      } catch (error) {
        if (handle) await handle.close().catch(() => undefined);
        await this.lockFileSystem.unlink(candidatePath).catch(() => undefined);
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'EEXIST') throw error;
        await this.recoverDeadLock();
        if (Date.now() >= deadline) throw new LockConflictError('lock unavailable');
        await delay(this.lockRetryMs);
      }
    }
  }

  private async readBoundedFile(filePath: string, maxBytes: number): Promise<BoundedReadResult> {
    let handle: FileHandle | null = null;
    try {
      handle = await this.lockFileSystem.open(filePath, 'r', 0o600);
      const buffer = Buffer.alloc(maxBytes + 1);
      let total = 0;
      while (total < buffer.length) {
        const { bytesRead } = await handle.read(buffer, total, buffer.length - total, total);
        if (bytesRead === 0) break;
        total += bytesRead;
      }
      if (total > maxBytes) return { kind: 'too-large' };
      return { kind: 'text', text: buffer.subarray(0, total).toString('utf8') };
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT' ? { kind: 'missing' } : { kind: 'failure' };
    } finally {
      if (handle) await handle.close().catch(() => undefined);
    }
  }

  private async readLockOwner(filePath: string): Promise<z.infer<typeof lockOwnerSchema> | null> {
    const bounded = await this.readBoundedFile(filePath, MAX_LOCK_BYTES);
    if (bounded.kind !== 'text') return null;
    try {
      const parsed = lockOwnerSchema.safeParse(JSON.parse(bounded.text) as unknown);
      return parsed.success ? parsed.data : null;
    } catch { return null; }
  }

  /**
   * A releasing owner fences the fixed lock with a tiny, fully-published
   * marker. New owners wait for the marker to disappear, so a delayed release
   * cannot remove a lock that a successor has already acquired. The marker is
   * itself published through a candidate + hard-link pair; an empty marker is
   * never treated as an owner.
   */
  private releaseMarkerPath(token: string): string {
    return `${this.releaseMarkerPrefix}${token}`;
  }

  private async readReleaseMarker(filePath: string): Promise<{ kind: 'missing' | 'invalid' | 'marker'; marker?: z.infer<typeof lockOwnerSchema> }> {
    const bounded = await this.readBoundedFile(filePath, MAX_LOCK_BYTES);
    if (bounded.kind === 'missing') return { kind: 'missing' };
    if (bounded.kind !== 'text') return { kind: 'invalid' };
    try {
      const parsed = lockOwnerSchema.safeParse(JSON.parse(bounded.text) as unknown);
      return parsed.success ? { kind: 'marker', marker: parsed.data } : { kind: 'invalid' };
    } catch { return { kind: 'invalid' }; }
  }

  private async publishReleaseMarker(token: string): Promise<boolean> {
    const markerPath = this.releaseMarkerPath(token);
    const existing = await this.readReleaseMarker(markerPath);
    if (existing.kind === 'marker') return existing.marker?.token === token;
    if (existing.kind === 'invalid') return false;
    const candidatePath = `${markerPath}.candidate.${this.processId}.${token}`;
    let handle: FileHandle | null = null;
    try {
      handle = await this.lockFileSystem.open(candidatePath, 'wx', 0o600);
      await handle.writeFile(JSON.stringify({ token, pid: this.processId, createdAt: Date.now() }), 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await this.lockFileSystem.link(candidatePath, markerPath);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      const after = await this.readReleaseMarker(markerPath);
      return after.kind === 'marker' && after.marker?.token === token;
    } finally {
      if (handle) await handle.close().catch(() => undefined);
      await this.lockFileSystem.unlink(candidatePath).catch(() => undefined);
    }
  }

  private async clearReleaseMarker(token: string): Promise<boolean> {
    const markerPath = this.releaseMarkerPath(token);
    const marker = await this.readReleaseMarker(markerPath);
    if (marker.kind === 'missing') return true;
    if (marker.kind !== 'marker' || marker.marker?.token !== token) return false;
    try {
      await this.lockFileSystem.unlink(markerPath);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code === 'ENOENT';
    }
  }

  /** Return true while another process has a release in progress. */
  private async releaseInProgress(): Promise<boolean> {
    let names: string[];
    try {
      const list = this.lockFileSystem.readdir ?? readDirectory;
      names = await list(path.dirname(this.filePath));
    } catch {
      // If marker discovery is unavailable, fail closed instead of acquiring
      // a lock beside an owner whose release may still be in flight.
      return true;
    }
    const prefix = path.basename(this.releaseMarkerPrefix);
    for (const name of names.filter((candidate) => candidate.startsWith(prefix) && !candidate.includes('.candidate.'))) {
      const token = name.slice(prefix.length);
      if (!recordIdSchema.safeParse(token).success) return true;
      const marker = await this.readReleaseMarker(path.join(path.dirname(this.filePath), name));
      if (marker.kind === 'invalid') return true;
      if (marker.kind === 'missing') continue;
      // The basename is the fencing identity. A valid JSON marker carrying a
      // different token is swapped/corrupt data, not permission to clear the
      // other owner's marker; fail closed and leave both records intact.
      if (marker.marker?.token !== token) return true;
      try {
        if (await this.isProcessAlive(marker.marker!.pid)) return true;
      } catch { return true; }
      const cleared = await this.clearReleaseMarker(token);
      if (!cleared) return true;
    }
    return false;
  }

  private async releaseOwnedLock(token: string): Promise<boolean> {
    const active = this.releasePromises.get(token);
    if (active) return active;
    const release = this.performReleaseOwnedLock(token).finally(() => this.releasePromises.delete(token));
    this.releasePromises.set(token, release);
    return release;
  }

  private async performReleaseOwnedLock(token: string): Promise<boolean> {
    let markerPublished = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        if (!markerPublished) {
          markerPublished = await this.publishReleaseMarker(token);
          if (!markerPublished) return false;
        }
        const owner = await this.readLockOwner(this.lockPath);
        if (!owner) {
          return await this.clearReleaseMarker(token);
        }
        if (owner.token !== token) {
          return await this.clearReleaseMarker(token);
        }
        // Re-read immediately before unlinking. The first read may have been
        // delayed while a crashed owner was reclaimed and a new token was
        // published; never remove a lock whose token is no longer ours.
        const current = await this.readLockOwner(this.lockPath);
        if (!current || current.token !== token) {
          return await this.clearReleaseMarker(token);
        }
        await this.lockFileSystem.unlink(this.lockPath);
        return await this.clearReleaseMarker(token);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return await this.clearReleaseMarker(token);
        }
        if (attempt < 4) await delay(this.lockRetryMs);
      }
    }
    await this.clearReleaseMarker(token);
    return false;
  }

  private async cleanupOwnedLocks(): Promise<void> {
    for (const token of [...this.orphanedLockTokens]) {
      if (await this.releaseOwnedLock(token)) this.orphanedLockTokens.delete(token);
    }
  }

  private recoveryRootPath(ownerToken: string): string {
    return `${this.lockPath}.recover.${ownerToken}.root`;
  }

  private recoverySuccessorPath(ownerToken: string, predecessorToken: string): string {
    return `${this.lockPath}.recover.${ownerToken}.after.${predecessorToken}`;
  }

  private async readRecoveryClaim(filePath: string): Promise<z.infer<typeof recoveryClaimSchema> | null> {
    const bounded = await this.readBoundedFile(filePath, MAX_LOCK_BYTES);
    if (bounded.kind !== 'text') return null;
    try {
      const parsed = recoveryClaimSchema.safeParse(JSON.parse(bounded.text) as unknown);
      return parsed.success ? parsed.data : null;
    } catch { return null; }
  }

  private async publishRecoveryClaim(
    nodePath: string,
    expectedOwnerToken: string,
    predecessorToken: string | null,
  ): Promise<z.infer<typeof recoveryClaimSchema> | null> {
    const claimantToken = newRecordId();
    const candidatePath = `${nodePath}.candidate.${this.processId}.${claimantToken}`;
    const claim = {
      expectedOwnerToken,
      claimantPid: this.processId,
      claimantToken,
      predecessorToken,
      createdAt: Date.now(),
    };
    let handle: FileHandle | null = null;
    try {
      handle = await this.lockFileSystem.open(candidatePath, 'wx', 0o600);
      await handle.writeFile(JSON.stringify(claim), 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await this.lockFileSystem.link(candidatePath, nodePath);
      this.ownedRecoveryClaimTokens.add(claimantToken);
      return claim;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      return null;
    } finally {
      if (handle) await handle.close().catch(() => undefined);
      await this.lockFileSystem.unlink(candidatePath).catch(() => undefined);
    }
  }

  private async recoverDeadLock(): Promise<void> {
    const owner = await this.readLockOwner(this.lockPath);
    if (!owner) return;
    let alive = true;
    try { alive = await this.isProcessAlive(owner.pid); } catch { return; }
    if (alive) return;

    // Recovery claims form an append-only, bounded fencing chain. A crashed
    // claimant can be succeeded without reusing its node, while every delayed
    // predecessor sees the successor fence before it may remove the fixed lock.
    let predecessor: z.infer<typeof recoveryClaimSchema> | null = null;
    for (let depth = 0; depth < MAX_RECOVERY_DEPTH; depth += 1) {
      const nodePath = predecessor
        ? this.recoverySuccessorPath(owner.token, predecessor.claimantToken)
        : this.recoveryRootPath(owner.token);
      let claim = await this.readRecoveryClaim(nodePath);
      if (!claim) {
        claim = await this.publishRecoveryClaim(nodePath, owner.token, predecessor?.claimantToken ?? null);
        if (!claim) claim = await this.readRecoveryClaim(nodePath);
      }
      if (!claim || claim.expectedOwnerToken !== owner.token || claim.predecessorToken !== (predecessor?.claimantToken ?? null)) return;

      const owned = this.ownedRecoveryClaimTokens.has(claim.claimantToken);
      if (!owned) {
        try { if (await this.isProcessAlive(claim.claimantPid)) return; } catch { return; }
        predecessor = claim;
        continue;
      }

      const successorPath = this.recoverySuccessorPath(owner.token, claim.claimantToken);
      if (await this.readRecoveryClaim(successorPath)) return;
      if (predecessor) {
        try { if (await this.isProcessAlive(predecessor.claimantPid)) return; } catch { return; }
      }
      try { if (await this.isProcessAlive(owner.pid)) return; } catch { return; }
      const current = await this.readLockOwner(this.lockPath);
      if (current?.token !== owner.token) return;
      if (await this.readRecoveryClaim(successorPath)) return;
      await this.lockFileSystem.unlink(this.lockPath);
      return;
    }
  }

  private runSerial<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.serial.then(operation, operation);
    this.serial = result.then(() => undefined, () => undefined);
    return result;
  }

  private isClosed(): boolean {
    return this.disposed || this.disposing;
  }
}

export const SCHOOL_MODE_DEFAULT_NAME = DEFAULT_NAME;
