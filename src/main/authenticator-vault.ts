import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, safeStorage } from 'electron';
import type { AuthenticatorEntryMetadata } from '../shared/contracts.js';
import { writeJsonAtomic } from './json-store.js';
import type { AuthenticatorVault, AuthenticatorVaultSaveOptions, AuthenticatorVaultStatus } from './authenticator-vault-contract.js';
import { entryMetadataSchema, metadataDocumentSchema } from './authenticator-metadata.js';

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
  private readonly writeMetadata: (filePath: string, value: unknown, options?: { shouldPublish?: () => boolean }) => Promise<void>;
  private readonly renameSecret: (from: string, to: string) => Promise<void>;
  constructor(options: SafeStorageAuthenticatorVaultOptions = {}) {
    const userData = options.metadataPath && options.secretsDirectory ? '' : app.getPath('userData');
    this.metadataPath = options.metadataPath ?? path.join(userData, 'authenticator.v1.json');
    this.secretsDirectory = options.secretsDirectory ?? path.join(userData, 'authenticator-secrets');
    this.isEncryptionAvailable = options.isEncryptionAvailable ?? (() => safeStorage.isEncryptionAvailable());
    this.encryptString = options.encryptString ?? ((value) => safeStorage.encryptString(value));
    this.decryptString = options.decryptString ?? ((value) => safeStorage.decryptString(value));
    this.writeMetadata = options.writeMetadata ?? ((filePath, value, writeOptions) => writeJsonAtomic(filePath, value, { shouldPublish: writeOptions?.shouldPublish }));
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
    return parsed.data.entries
      .slice()
      .sort((left, right) => left.order - right.order || left.createdAt.localeCompare(right.createdAt)) as AuthenticatorEntryMetadata[];
  }

  async save(entry: AuthenticatorEntryMetadata, secret: string, options: AuthenticatorVaultSaveOptions = {}): Promise<void> {
    return this.withSharedSerial(() => this.saveUnlocked(entry, secret, options));
  }

  private async saveUnlocked(entry: AuthenticatorEntryMetadata, secret: string, options: AuthenticatorVaultSaveOptions): Promise<void> {
    if (await this.status() === 'unavailable') throw new Error('The operating-system credential vault is unavailable.');
    const metadata = entryMetadataSchema.parse(entry) as AuthenticatorEntryMetadata;
    const encrypted = this.encryptString(secret);
    await mkdir(this.secretsDirectory, { recursive: true });
    const entriesBefore = await this.listMetadata();
    const documentBefore = { schemaVersion: 1, entries: entriesBefore };
    const secretPath = this.secretPath(metadata.id);
    let previousSecret: Buffer | null = null;
    try { previousSecret = await readFile(secretPath); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('The previous authenticator ciphertext could not be read safely.');
    }
    const temporarySecretPath = path.join(this.secretsDirectory, `.${metadata.id}.${randomUUID()}.tmp`);
    let published = false;
    let metadataPublished = false;
    try {
      this.ensureCommit(options);
      await writeFile(temporarySecretPath, encrypted, { mode: 0o600, flag: 'wx' });
      this.ensureCommit(options);
      await this.renameSecret(temporarySecretPath, secretPath);
      published = true;
      const entries = entriesBefore.filter((item) => item.id !== metadata.id);
      entries.push(metadata);
      this.ensureCommit(options);
      await this.writeMetadata(this.metadataPath, { schemaVersion: 1, entries }, { shouldPublish: options.shouldCommit });
      metadataPublished = true;
      this.ensureCommit(options);
    } catch (error) {
      await unlink(temporarySecretPath).catch(() => undefined);
      if (published) {
        if (previousSecret) await writeFile(secretPath, previousSecret, { mode: 0o600 }).catch(() => undefined);
        else await unlink(secretPath).catch(() => undefined);
      }
      if (metadataPublished) await this.writeMetadata(this.metadataPath, documentBefore).catch(() => undefined);
      throw error;
    }
  }

  async remove(entryId: string): Promise<void> {
    return this.withSharedSerial(() => this.removeUnlocked(entryId));
  }

  private async removeUnlocked(entryId: string): Promise<void> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entryId)) return;
    if (await this.status() === 'unavailable') throw new Error('The operating-system credential vault is unavailable.');
    const entriesBefore = await this.listMetadata();
    const found = entriesBefore.some((entry) => entry.id === entryId);
    const secretPath = this.secretPath(entryId);
    let previousSecret: Buffer | null = null;
    try { previousSecret = await readFile(secretPath); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('The authenticator ciphertext could not be read safely.');
    }
    if (!found) {
      await unlink(secretPath).catch(() => undefined);
      return;
    }
    try {
      await unlink(secretPath).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      });
      await this.writeMetadata(this.metadataPath, { schemaVersion: 1, entries: entriesBefore.filter((entry) => entry.id !== entryId) });
    } catch (error) {
      if (previousSecret) await writeFile(secretPath, previousSecret, { mode: 0o600 }).catch(() => undefined);
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
