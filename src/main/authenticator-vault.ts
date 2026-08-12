import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, safeStorage } from 'electron';
import { AUTHENTICATOR_MAX_ENTRIES, AUTHENTICATOR_MAX_SECRET_LENGTH } from '../shared/contracts.js';
import type { AuthenticatorEntryMetadata } from '../shared/contracts.js';
import { writeJsonAtomic } from './json-store.js';
import type { AuthenticatorVault, AuthenticatorVaultHistoryOptions, AuthenticatorVaultHistorySnapshot, AuthenticatorVaultMetadataWriteOptions, AuthenticatorVaultSaveOptions, AuthenticatorVaultStatus } from './authenticator-vault-contract.js';
import { authenticatorGroupSchema, entryMetadataSchema, metadataDocumentSchema, normalizeAuthenticatorGroups } from './authenticator-metadata.js';
import type { AuthenticatorGroup } from '../shared/contracts.js';
import { normalizeBase32Secret } from './totp.js';

export interface SafeStorageAuthenticatorVaultOptions {
  metadataPath?: string;
  secretsDirectory?: string;
  isEncryptionAvailable?: () => boolean;
  encryptString?: (value: string) => Buffer;
  decryptString?: (value: Buffer) => string;
  writeMetadata?: (filePath: string, value: unknown, options?: { shouldPublish?: () => boolean }) => Promise<void>;
  renameSecret?: (from: string, to: string) => Promise<void>;
  supportsAtomicNoFollow?: () => boolean;
}

const MAX_HISTORY_CIPHERTEXT_BYTES = 2_000_000;
const MAX_HISTORY_TOTAL_BYTES = 8_000_000;
const UUID_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.dpapi$/i;

function canonicalLegacySecret(value: string): string | null {
  try {
    const normalized = normalizeBase32Secret(value);
    const compact = value.replace(/[\s-]/g, '').toUpperCase().replace(/=+$/, '');
    return normalized === compact ? normalized : null;
  } catch { return null; }
}

function assertCanonicalSecret(value: unknown): asserts value is string {
  if (typeof value !== 'string' || canonicalLegacySecret(value) === null) throw new Error('The authenticator secret was not canonical Base32.');
}

async function assertSafeSecretsDirectory(directory: string, allowMissing = true): Promise<void> {
  const absolute = path.resolve(directory);
  const ancestors: string[] = [];
  let cursor = absolute;
  while (true) {
    ancestors.push(cursor);
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  for (const ancestor of ancestors.reverse()) {
    try {
      const info = await lstat(ancestor);
      if (info.isSymbolicLink() || !info.isDirectory() && ancestor !== path.parse(ancestor).root) throw new Error('The authenticator ciphertext path was not safe.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
  }
  try {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('The authenticator ciphertext directory was not a safe directory.');
  } catch (error) {
    if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw error;
  }
}

// Electron normally has one main process, but tests and embedders can create
// more than one vault object for the same application-data paths. Keep those
// writers behind one shared in-process queue so ciphertext and its metadata
// cannot diverge when two confirmations arrive together.
const sharedVaultSerials = new Map<string, Promise<void>>();

function assertMetadataInvariants(entries: readonly AuthenticatorEntryMetadata[]): void {
  if (entries.length > AUTHENTICATOR_MAX_ENTRIES) throw new Error('The authenticator metadata list exceeded its bounded size.');
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const entry of entries) {
    if (ids.has(entry.id) || orders.has(entry.order)) throw new Error('The authenticator metadata file contained duplicate identifiers or order values.');
    ids.add(entry.id);
    orders.add(entry.order);
  }
  for (let index = 0; index < entries.length; index += 1) if (!orders.has(index)) throw new Error('The authenticator metadata file contained a non-contiguous order.');
}

/**
 * Stores only redacted metadata in JSON and each secret as a separate
 * safeStorage ciphertext. The per-entry filename is an opaque UUID; no secret
 * or URI is ever written to the metadata file, history, exports, or renderer.
 */
export class SafeStorageAuthenticatorVault implements AuthenticatorVault {
  private readonly metadataPath: string;
  private readonly secretsDirectory: string;
  private readonly isEncryptionAvailable: () => boolean;
  private readonly encryptString: (value: string) => Buffer;
  private readonly decryptString: (value: Buffer) => string;
  private readonly writeMetadataFile: (filePath: string, value: unknown, options?: { shouldPublish?: () => boolean }) => Promise<void>;
  private readonly renameSecret: (from: string, to: string) => Promise<void>;
  private readonly atomicNoFollow: () => boolean;
  private groups: AuthenticatorGroup[] = [];
  constructor(options: SafeStorageAuthenticatorVaultOptions = {}) {
    const userData = options.metadataPath && options.secretsDirectory ? '' : app.getPath('userData');
    this.metadataPath = options.metadataPath ?? path.join(userData, 'authenticator.v1.json');
    this.secretsDirectory = options.secretsDirectory ?? path.join(userData, 'authenticator-secrets');
    this.isEncryptionAvailable = options.isEncryptionAvailable ?? (() => safeStorage.isEncryptionAvailable());
    this.encryptString = options.encryptString ?? ((value) => safeStorage.encryptString(value));
    this.decryptString = options.decryptString ?? ((value) => safeStorage.decryptString(value));
    this.writeMetadataFile = options.writeMetadata ?? ((filePath, value, writeOptions) => writeJsonAtomic(filePath, value, { shouldPublish: writeOptions?.shouldPublish }));
    this.renameSecret = options.renameSecret ?? rename;
    this.atomicNoFollow = options.supportsAtomicNoFollow ?? (() => false);
  }

  async status(): Promise<AuthenticatorVaultStatus> {
    return this.isEncryptionAvailable() ? 'os-credential-vault' : 'unavailable';
  }

  async listMetadata(): Promise<AuthenticatorEntryMetadata[]> {
    if (await this.status() === 'unavailable') return [];
    let value: unknown;
    try { value = JSON.parse(await readFile(this.metadataPath, 'utf8')); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw new Error('The authenticator metadata file could not be read.');
    }
    const parsed = metadataDocumentSchema.safeParse(value);
    if (!parsed.success) throw new Error('The authenticator metadata file was invalid.');
    this.groups = normalizeAuthenticatorGroups('groups' in parsed.data ? (parsed.data.groups ?? []) : []);
    const byLabel = new Map<string, AuthenticatorGroup>();
    for (const entry of parsed.data.entries) {
      const label = 'group' in entry ? (entry.group ?? null) : null;
      if (label && !byLabel.has(label)) {
        const hex = createHash('sha256').update(`ding-ding-authenticator-group:${label}`, 'utf8').digest('hex').slice(0, 32) + '0000';
        const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hex.slice(18, 20)}-${hex.slice(20, 32)}`;
        byLabel.set(label, { id, name: label, color: '#6750A4', order: byLabel.size, collapsed: false });
      }
    }
    if (byLabel.size && !this.groups.length) this.groups = normalizeAuthenticatorGroups([...byLabel.values()]);
    const labelToId = new Map(this.groups.map((group) => [group.name, group.id]));
    const entries = parsed.data.entries
      .map((entry) => ({ ...entry, group: 'group' in entry ? (entry.group ?? null) : null, groupId: 'groupId' in entry && entry.groupId ? entry.groupId : ('group' in entry && entry.group ? labelToId.get(entry.group) ?? null : null) }))
      .slice()
      .sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt)) as AuthenticatorEntryMetadata[];
    assertMetadataInvariants(entries);
    return entries;
  }

  async listGroups(): Promise<AuthenticatorGroup[]> {
    await this.listMetadata();
    return this.groups.map((group) => ({ ...group }));
  }

  async writeMetadata(entries: readonly AuthenticatorEntryMetadata[], options: AuthenticatorVaultMetadataWriteOptions = {}): Promise<void> {
    return this.withSharedSerial(async () => {
      if (await this.status() === 'unavailable') throw new Error('The operating-system credential vault is unavailable.');
      const parsed = entries.map((entry) => entryMetadataSchema.parse(entry) as AuthenticatorEntryMetadata);
      assertMetadataInvariants(parsed);
      const groups = normalizeAuthenticatorGroups(options.groups ?? await this.listGroups());
      const document = metadataDocumentSchema.parse(groups.length ? { schemaVersion: 3, entries: parsed, groups } : { schemaVersion: 2, entries: parsed });
      const documentBefore = { schemaVersion: 3, entries: await this.listMetadata(), groups: await this.listGroups() };
      const metadataBeforeBytes = await this.readMetadataBytes();
      let metadataPublished = false;
      let metadataWriteAttempted = false;
      if (options.shouldCommit && !options.shouldCommit()) {
        const cancelled = new Error('Authenticator metadata publication was cancelled.') as NodeJS.ErrnoException;
        cancelled.code = 'ECANCELED';
        throw cancelled;
      }
      try {
        // The injected writer is a deliberately narrow seam for tests and
        // embedders. It may publish and then reject, so record that a write
        // was attempted and verify the on-disk bytes before deciding whether
        // rollback is required.
        metadataWriteAttempted = true;
        await this.writeMetadataFile(this.metadataPath, document, { shouldPublish: options.shouldCommit });
        this.groups = groups;
        metadataPublished = true;
        if (options.shouldCommit && !options.shouldCommit()) {
          const cancelled = new Error('Authenticator metadata publication was cancelled.') as NodeJS.ErrnoException;
          cancelled.code = 'ECANCELED';
          throw cancelled;
        }
      } catch (error) {
        let metadataChanged = metadataPublished;
        if (metadataWriteAttempted && !metadataChanged) {
          metadataChanged = await this.metadataChangedSince(metadataBeforeBytes);
        }
        if (metadataChanged) {
          try { await this.writeMetadataFile(this.metadataPath, documentBefore); }
          catch {
            const uncertain = new Error('Authenticator metadata publication failed and its rollback could not be verified.') as NodeJS.ErrnoException;
            uncertain.code = 'EINTEGRITY';
            (uncertain as NodeJS.ErrnoException & { committed?: boolean }).committed = true;
            throw uncertain;
          }
        }
        throw error;
      }
    });
  }

  async save(entry: AuthenticatorEntryMetadata, secret: string, options: AuthenticatorVaultSaveOptions = {}): Promise<void> {
    return this.withSharedSerial(() => this.saveUnlocked(entry, secret, options));
  }

  private async saveUnlocked(entry: AuthenticatorEntryMetadata, secret: string, options: AuthenticatorVaultSaveOptions): Promise<void> {
    if (await this.status() === 'unavailable') throw new Error('The operating-system credential vault is unavailable.');
    const metadata = entryMetadataSchema.parse(entry) as AuthenticatorEntryMetadata;
    assertCanonicalSecret(secret);
    const encrypted = this.encryptString(JSON.stringify({ schemaVersion: 1, entryId: metadata.id, secret: canonicalLegacySecret(secret) }));
    await mkdir(this.secretsDirectory, { recursive: true });
    const entriesBefore = (await this.listMetadata()).map((entry, index) => ({ ...entry, order: index }));
    const documentBefore = { schemaVersion: 3, entries: entriesBefore, groups: await this.listGroups() };
    const metadataBeforeBytes = await this.readMetadataBytes();
    const secretPath = this.secretPath(metadata.id);
    let previousSecret: Buffer | null = null;
    try { previousSecret = await readFile(secretPath); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('The previous authenticator ciphertext could not be read safely.');
    }
    const temporarySecretPath = path.join(this.secretsDirectory, `.${metadata.id}.${randomUUID()}.tmp`);
    let published = false;
    let metadataPublished = false;
    let metadataWriteAttempted = false;
    try {
      this.ensureCommit(options);
      await writeFile(temporarySecretPath, encrypted, { mode: 0o600, flag: 'wx' });
      this.ensureCommit(options);
      await this.renameSecret(temporarySecretPath, secretPath);
      published = true;
      const entries = entriesBefore.filter((item) => item.id !== metadata.id);
      entries.push({ ...metadata, order: entries.length });
      this.ensureCommit(options);
      metadataWriteAttempted = true;
      await this.writeMetadataFile(this.metadataPath, { schemaVersion: 3, entries, groups: await this.listGroups() }, { shouldPublish: options.shouldCommit });
      metadataPublished = true;
      this.ensureCommit(options);
    } catch (error) {
      let rollbackFailed = false;
      let metadataChanged = metadataPublished;
      if (metadataWriteAttempted && !metadataChanged) metadataChanged = await this.metadataChangedSince(metadataBeforeBytes);
      await unlink(temporarySecretPath).catch(() => undefined);
      if (metadataChanged) await this.writeMetadataFile(this.metadataPath, documentBefore).catch(() => { rollbackFailed = true; });
      if (published) {
        if (previousSecret) await writeFile(secretPath, previousSecret, { mode: 0o600 }).catch(() => { rollbackFailed = true; });
        else await unlink(secretPath).catch(() => { rollbackFailed = true; });
      }
      if (rollbackFailed) {
        const uncertain = new Error('Authenticator vault publication failed and its rollback could not be verified.') as NodeJS.ErrnoException;
        uncertain.code = 'EINTEGRITY';
        (uncertain as NodeJS.ErrnoException & { committed?: boolean }).committed = published || metadataChanged;
        throw uncertain;
      }
      throw error;
    }
  }

  async remove(entryId: string, options: AuthenticatorVaultSaveOptions = {}): Promise<void> {
    return this.withSharedSerial(() => this.removeUnlocked(entryId, options));
  }

  private async removeUnlocked(entryId: string, options: AuthenticatorVaultSaveOptions): Promise<void> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entryId)) return;
    if (await this.status() === 'unavailable') throw new Error('The operating-system credential vault is unavailable.');
    const entriesBefore = (await this.listMetadata()).map((entry, index) => ({ ...entry, order: index }));
    const found = entriesBefore.some((entry) => entry.id === entryId);
    const secretPath = this.secretPath(entryId);
    let previousSecret: Buffer | null = null;
    try { previousSecret = await readFile(secretPath); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('The authenticator ciphertext could not be read safely.');
    }
    if (!found) {
      // Do not mutate an orphan ciphertext for an unknown identifier. A stale
      // request must be a no-op even if the capability flips while it runs.
      return;
    }
    this.ensureCommit(options);
    const documentBefore = { schemaVersion: 3, entries: entriesBefore, groups: await this.listGroups() };
    const metadataBeforeBytes = await this.readMetadataBytes();
    let metadataPublished = false;
    let metadataWriteAttempted = false;
    let secretRemoved = false;
    try {
      try {
        await unlink(secretPath);
        secretRemoved = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      this.ensureCommit(options);
      metadataWriteAttempted = true;
      await this.writeMetadataFile(this.metadataPath, { schemaVersion: 3, entries: entriesBefore.filter((entry) => entry.id !== entryId).map((entry, index) => ({ ...entry, order: index })), groups: await this.listGroups() }, { shouldPublish: options.shouldCommit });
      metadataPublished = true;
      this.ensureCommit(options);
    } catch (error) {
      let rollbackFailed = false;
      let metadataChanged = metadataPublished;
      if (metadataWriteAttempted && !metadataChanged) metadataChanged = await this.metadataChangedSince(metadataBeforeBytes);
      if (previousSecret) await writeFile(secretPath, previousSecret, { mode: 0o600 }).catch(() => { rollbackFailed = true; });
      if (metadataChanged) await this.writeMetadataFile(this.metadataPath, documentBefore).catch(() => { rollbackFailed = true; });
      if (rollbackFailed) {
        const uncertain = new Error('Authenticator deletion failed and its rollback could not be verified.') as NodeJS.ErrnoException;
        uncertain.code = 'EINTEGRITY';
        (uncertain as NodeJS.ErrnoException & { committed?: boolean }).committed = metadataChanged || secretRemoved;
        throw uncertain;
      }
      throw error;
    }
  }

  async readSecret(entryId: string): Promise<string | null> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entryId)) return null;
    return this.withSharedSerial(async () => {
      if (await this.status() === 'unavailable') return null;
      try {
        await assertSafeSecretsDirectory(this.secretsDirectory);
        const secretPath = this.secretPath(entryId);
        const info = await lstat(secretPath);
        if (!info.isFile() || info.isSymbolicLink()) return null;
        const plaintext = this.decryptString(await readFile(secretPath));
        let parsed: unknown;
        try { parsed = JSON.parse(plaintext); } catch { parsed = undefined; }
        if (parsed !== undefined) {
          const envelope = parsed as { schemaVersion?: unknown; entryId?: unknown; secret?: unknown };
          if (envelope.schemaVersion !== 1 || envelope.entryId !== entryId || typeof envelope.secret !== 'string' || !envelope.secret || envelope.secret.length > AUTHENTICATOR_MAX_SECRET_LENGTH) return null;
          assertCanonicalSecret(envelope.secret);
          return envelope.secret;
        }
        if (!plaintext || plaintext.length > AUTHENTICATOR_MAX_SECRET_LENGTH) return null;
        const secret = canonicalLegacySecret(plaintext);
        if (!secret) return null;
        const migrated = this.encryptString(JSON.stringify({ schemaVersion: 1, entryId, secret }));
        const temporary = `${secretPath}.${randomUUID()}.migration.tmp`;
        try { await writeFile(temporary, migrated, { mode: 0o600, flag: 'wx' }); await assertSafeSecretsDirectory(this.secretsDirectory, false); await rename(temporary, secretPath); } finally { await unlink(temporary).catch(() => undefined); }
        return plaintext;
      } catch {
        return null;
      }
    });
  }

  supportsAtomicNoFollow(): boolean { return this.atomicNoFollow(); }

  async createHistorySnapshot(): Promise<AuthenticatorVaultHistorySnapshot | null> {
    return this.withSharedSerial(async () => {
      if (await this.status() === 'unavailable') return null;
      if (!this.supportsAtomicNoFollow()) return null;
      const metadata = await this.listMetadata();
      const groups = await this.listGroups();
      const metadataIds = new Set(metadata.map((entry) => entry.id));
      await assertSafeSecretsDirectory(this.secretsDirectory);
      let names: string[] = [];
      try { names = await readdir(this.secretsDirectory); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('The authenticator ciphertext directory could not be read safely.'); }
      for (const name of names) {
        const info = await lstat(path.join(this.secretsDirectory, name));
        if (!info.isFile() || info.isSymbolicLink() || !UUID_FILE.test(name) || !metadataIds.has(name.slice(0, -'.dpapi'.length))) throw new Error('The authenticator ciphertext directory contained an unexpected or unsafe file.');
      }
      let total = 0;
      const ciphertext: Array<{ entryId: string; base64: string }> = [];
      for (const entry of metadata) {
        const bytes = await readFile(this.secretPath(entry.id));
        if (bytes.length > MAX_HISTORY_CIPHERTEXT_BYTES || (total += bytes.length) > MAX_HISTORY_TOTAL_BYTES) throw new Error('The authenticator history snapshot exceeded its bounded ciphertext size.');
        let plaintext: string;
        try { plaintext = this.decryptString(bytes); } catch { throw new Error('The authenticator ciphertext could not be opened safely for history.'); }
        let parsed: unknown;
        try { parsed = JSON.parse(plaintext); } catch { parsed = undefined; }
        if (parsed !== undefined) {
          const envelope = parsed as { schemaVersion?: unknown; entryId?: unknown; secret?: unknown };
          if (envelope.schemaVersion !== 1 || envelope.entryId !== entry.id || typeof envelope.secret !== 'string' || !envelope.secret || envelope.secret.length > AUTHENTICATOR_MAX_SECRET_LENGTH) throw new Error('The authenticator ciphertext envelope was invalid.');
          assertCanonicalSecret(envelope.secret);
          ciphertext.push({ entryId: entry.id, base64: bytes.toString('base64') });
        } else {
          if (!plaintext || plaintext.length > AUTHENTICATOR_MAX_SECRET_LENGTH) throw new Error('The legacy authenticator ciphertext was invalid.');
          const secret = canonicalLegacySecret(plaintext);
          if (!secret) throw new Error('The legacy authenticator ciphertext was invalid.');
          ciphertext.push({ entryId: entry.id, base64: this.encryptString(JSON.stringify({ schemaVersion: 1, entryId: entry.id, secret })).toString('base64') });
        }
      }
      return { schemaVersion: 1, metadata: metadata.map((entry) => ({ ...entry })), groups: groups.map((group) => ({ ...group })), ciphertext };
    });
  }

  async restoreHistorySnapshot(snapshot: AuthenticatorVaultHistorySnapshot, options: AuthenticatorVaultHistoryOptions = {}): Promise<void> {
    return this.withSharedSerial(async () => {
      if (await this.status() === 'unavailable') throw new Error('The operating-system credential vault is unavailable.');
      if (!this.supportsAtomicNoFollow()) {
        const unsupported = new Error('Protected authenticator restore is unavailable because this platform cannot guarantee atomic no-follow vault operations.') as NodeJS.ErrnoException;
        unsupported.code = 'EUNSUPPORTED';
        throw unsupported;
      }
      if (!snapshot || snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.metadata) || !Array.isArray(snapshot.groups) || !Array.isArray(snapshot.ciphertext)) throw new Error('The authenticator history snapshot was invalid.');
      const metadata = snapshot.metadata.map((entry) => entryMetadataSchema.parse(entry) as AuthenticatorEntryMetadata);
      assertMetadataInvariants(metadata);
      const groups = normalizeAuthenticatorGroups(snapshot.groups);
      const ids = new Set(metadata.map((entry) => entry.id));
      if (snapshot.ciphertext.length !== ids.size || new Set(snapshot.ciphertext.map((item) => item.entryId)).size !== snapshot.ciphertext.length || snapshot.ciphertext.some((item) => !ids.has(item.entryId) || typeof item.base64 !== 'string' || item.base64.length === 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/.test(item.base64))) throw new Error('The authenticator history snapshot ciphertext set was invalid.');
      const decoded = snapshot.ciphertext.map((item) => ({ entryId: item.entryId, bytes: Buffer.from(item.base64, 'base64') }));
      if (decoded.some((item) => item.bytes.length > MAX_HISTORY_CIPHERTEXT_BYTES) || decoded.reduce((sum, item) => sum + item.bytes.length, 0) > MAX_HISTORY_TOTAL_BYTES) throw new Error('The authenticator history snapshot exceeded its bounded ciphertext size.');
      for (const item of decoded) {
        let plaintext: string;
        try { plaintext = this.decryptString(item.bytes); } catch { throw new Error('The authenticator history ciphertext could not be opened by this credential vault.'); }
        let envelope: { schemaVersion?: unknown; entryId?: unknown; secret?: unknown };
        try { envelope = JSON.parse(plaintext) as typeof envelope; }
        catch {
          // History created before the stable-ID envelope used raw vault
          // ciphertext. Keep that migration bounded and immediately bind the
          // recovered secret to the stable identifier before any write.
          if (!plaintext || plaintext.length > AUTHENTICATOR_MAX_SECRET_LENGTH) throw new Error('The legacy authenticator history ciphertext was invalid.');
          const secret = canonicalLegacySecret(plaintext);
          if (!secret) throw new Error('The legacy authenticator history ciphertext was invalid.');
          item.bytes = Buffer.from(this.encryptString(JSON.stringify({ schemaVersion: 1, entryId: item.entryId, secret })));
          continue;
        }
        if (envelope.schemaVersion !== 1 || envelope.entryId !== item.entryId || typeof envelope.secret !== 'string' || !envelope.secret || envelope.secret.length > AUTHENTICATOR_MAX_SECRET_LENGTH) throw new Error('The authenticator history ciphertext envelope was invalid.');
        assertCanonicalSecret(envelope.secret);
      }
      if (options.shouldCommit && !options.shouldCommit()) throw new Error('Authenticator history restore was cancelled.');
      const currentMetadata = await this.listMetadata();
      const currentGroups = await this.listGroups();
      const currentFiles = new Map<string, Buffer>();
      try {
        await assertSafeSecretsDirectory(this.secretsDirectory);
        let currentTotal = 0;
        for (const file of await readdir(this.secretsDirectory)) if (UUID_FILE.test(file)) {
          const filePath = path.join(this.secretsDirectory, file);
          const info = await lstat(filePath);
          if (!info.isFile() || info.isSymbolicLink()) throw new Error('The authenticator ciphertext file was not a safe regular file.');
          const bytes = await readFile(filePath);
          if (bytes.length > MAX_HISTORY_CIPHERTEXT_BYTES || (currentTotal += bytes.length) > MAX_HISTORY_TOTAL_BYTES) throw new Error('The current authenticator ciphertext exceeded its bounded rollback size.');
          currentFiles.set(file.slice(0, -'.dpapi'.length), bytes);
        }
      } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('The authenticator ciphertext directory could not be read safely.'); }
      const currentMetadataBytes = await this.readMetadataBytes();
      const temporary = new Map<string, string>();
      try {
        await assertSafeSecretsDirectory(this.secretsDirectory);
        await mkdir(this.secretsDirectory, { recursive: true });
        for (const item of decoded) {
          const temp = path.join(this.secretsDirectory, `.${item.entryId}.${randomUUID()}.restore.tmp`);
          await writeFile(temp, item.bytes, { mode: 0o600, flag: 'wx' });
          temporary.set(item.entryId, temp);
        }
        if (options.shouldCommit && !options.shouldCommit()) throw new Error('Authenticator history restore was cancelled.');
        for (const [entryId, temp] of temporary) {
          await assertSafeSecretsDirectory(this.secretsDirectory, false);
          await rename(temp, this.secretPath(entryId));
          await assertSafeSecretsDirectory(this.secretsDirectory, false);
        }
        const nextDocument = { schemaVersion: 3, entries: metadata, groups };
        await this.writeMetadataFile(this.metadataPath, nextDocument);
        await assertSafeSecretsDirectory(this.secretsDirectory, false);
        for (const file of await readdir(this.secretsDirectory)) if (UUID_FILE.test(file) && !ids.has(file.slice(0, -'.dpapi'.length))) {
          await assertSafeSecretsDirectory(this.secretsDirectory, false);
          const filePath = path.join(this.secretsDirectory, file);
          const info = await lstat(filePath);
          if (!info.isFile() || info.isSymbolicLink()) throw new Error('The authenticator ciphertext file was not a safe regular file.');
          await unlink(filePath);
        }
        this.groups = groups;
        if (options.shouldCommit && !options.shouldCommit()) throw new Error('Authenticator history restore was cancelled.');
      } catch (error) {
        for (const temp of temporary.values()) await unlink(temp).catch(() => undefined);
        try {
          if (currentMetadataBytes === null) await unlink(this.metadataPath).catch(() => undefined);
          else await this.writeMetadataFile(this.metadataPath, JSON.parse(currentMetadataBytes.toString('utf8')));
          await mkdir(this.secretsDirectory, { recursive: true });
          await assertSafeSecretsDirectory(this.secretsDirectory, false);
          for (const [entryId, bytes] of currentFiles) {
            await assertSafeSecretsDirectory(this.secretsDirectory, false);
            await writeFile(this.secretPath(entryId), bytes, { mode: 0o600 });
          }
          await assertSafeSecretsDirectory(this.secretsDirectory, false);
          for (const file of await readdir(this.secretsDirectory)) if (UUID_FILE.test(file) && !currentFiles.has(file.slice(0, -'.dpapi'.length))) {
            await assertSafeSecretsDirectory(this.secretsDirectory, false);
            const filePath = path.join(this.secretsDirectory, file);
            const info = await lstat(filePath);
            if (!info.isFile() || info.isSymbolicLink()) throw new Error('The authenticator ciphertext file was not a safe regular file.');
            await unlink(filePath);
          }
          this.groups = currentGroups;
        } catch {
          const uncertain = new Error('Authenticator history restore failed and its rollback could not be verified.') as NodeJS.ErrnoException;
          uncertain.code = 'EINTEGRITY';
          throw uncertain;
        }
        throw error;
      }
    });
  }

  private secretPath(entryId: string): string {
    return path.join(this.secretsDirectory, `${entryId}.dpapi`);
  }

  private ensureCommit(options: AuthenticatorVaultSaveOptions): void {
    if (options.shouldCommit && !options.shouldCommit()) {
      const cancelled = new Error('Authenticator vault publication was cancelled.');
      (cancelled as NodeJS.ErrnoException).code = 'ECANCELED';
      throw cancelled;
    }
  }

  private async readMetadataBytes(): Promise<Buffer | null> {
    try {
      return await readFile(this.metadataPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new Error('The previous authenticator metadata could not be read safely.');
    }
  }

  private async metadataChangedSince(before: Buffer | null): Promise<boolean> {
    try {
      const after = await readFile(this.metadataPath);
      return before === null || !after.equals(before);
    } catch (error) {
      // A missing or unreadable target after an attempted write is a mutation
      // we cannot safely classify; restore the prior document and surface an
      // integrity failure if that recovery also fails.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return before !== null;
      return true;
    }
  }

  private withSharedSerial<T>(operation: () => Promise<T>): Promise<T> {
    const key = `${this.metadataPath}\u0000${this.secretsDirectory}`;
    const previous = sharedVaultSerials.get(key) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    const settled = current.then(() => undefined, () => undefined);
    sharedVaultSerials.set(key, settled);
    settled.then(() => {
      if (sharedVaultSerials.get(key) === settled) sharedVaultSerials.delete(key);
    }, () => undefined);
    return current;
  }
}
