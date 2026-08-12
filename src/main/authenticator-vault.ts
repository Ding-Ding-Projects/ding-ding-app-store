import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, safeStorage } from 'electron';
import { AUTHENTICATOR_MAX_ENTRIES } from '../shared/contracts.js';
import type { AuthenticatorEntryMetadata } from '../shared/contracts.js';
import { writeJsonAtomic } from './json-store.js';
import type { AuthenticatorVault, AuthenticatorVaultMetadataWriteOptions, AuthenticatorVaultSaveOptions, AuthenticatorVaultStatus } from './authenticator-vault-contract.js';
import { authenticatorGroupSchema, entryMetadataSchema, metadataDocumentSchema, normalizeAuthenticatorGroups } from './authenticator-metadata.js';
import type { AuthenticatorGroup } from '../shared/contracts.js';

export interface SafeStorageAuthenticatorVaultOptions {
  metadataPath?: string;
  secretsDirectory?: string;
  isEncryptionAvailable?: () => boolean;
  encryptString?: (value: string) => Buffer;
  decryptString?: (value: Buffer) => string;
  writeMetadata?: (filePath: string, value: unknown, options?: { shouldPublish?: () => boolean }) => Promise<void>;
  renameSecret?: (from: string, to: string) => Promise<void>;
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
    const encrypted = this.encryptString(secret);
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
    if (await this.status() === 'unavailable') return null;
    try {
      return this.decryptString(await readFile(this.secretPath(entryId)));
    } catch {
      return null;
    }
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
