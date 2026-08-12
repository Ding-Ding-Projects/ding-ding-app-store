import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, safeStorage } from 'electron';

const MAX_CREDENTIAL_LENGTH = 512;
const MIN_CREDENTIAL_LENGTH = 4;
const FILE_NAME = 'history-access.v1.dpapi';
const MAX_FAILURES = 5;

export interface HistoryAccessStatus {
  available: boolean;
  configured: boolean;
  unlocked: boolean;
  reason: 'unavailable' | 'not-configured' | 'locked' | 'ready';
}

export interface HistoryAccessUnlockRequest {
  credential: string;
  create?: boolean;
}

export interface HistoryAccessResult {
  ok: boolean;
  status: HistoryAccessStatus;
  message: string;
}

type StoredVerifier = { schemaVersion: 1; salt: string; verifier: string };

function validCredential(value: unknown): value is string {
  return typeof value === 'string' && value.length >= MIN_CREDENTIAL_LENGTH && value.length <= MAX_CREDENTIAL_LENGTH;
}

function derive(credential: string, salt: Buffer): Buffer {
  return scryptSync(credential, salt, 32, { N: 16_384, r: 8, p: 1 });
}

function encoded(value: Uint8Array): string { return Buffer.from(value).toString('base64'); }
function decoded(value: string): Buffer { return Buffer.from(value, 'base64'); }
function strictDecoded(value: string): Buffer {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) throw new Error('invalid base64');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) throw new Error('invalid base64');
  return bytes;
}

/**
 * Dedicated local-history access gate. The verifier is encrypted through the
 * operating-system credential vault; only an in-memory session boolean crosses
 * the renderer boundary. This is a UX gate, not encryption of user files.
 */
export class HistoryAccessService {
  private readonly filePath: string;
  private unlocked = false;
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private generation = 0;
  private available = false;
  private configured = false;
  private verifier: StoredVerifier | null = null;
  private failures = 0;

  constructor(options: { filePath?: string; isEncryptionAvailable?: () => boolean; encryptString?: (value: string) => Buffer; decryptString?: (value: Buffer) => string } = {}) {
    this.filePath = options.filePath ?? path.join(app.getPath('userData'), 'credential-vault', FILE_NAME);
    this.isEncryptionAvailable = options.isEncryptionAvailable ?? (() => safeStorage.isEncryptionAvailable());
    this.encryptString = options.encryptString ?? ((value) => safeStorage.encryptString(value));
    this.decryptString = options.decryptString ?? ((value) => safeStorage.decryptString(value));
  }

  private readonly isEncryptionAvailable: () => boolean;
  private readonly encryptString: (value: string) => Buffer;
  private readonly decryptString: (value: Buffer) => string;

  async status(): Promise<HistoryAccessStatus> {
    await this.load();
    return this.statusValue();
  }

  async unlock(request: HistoryAccessUnlockRequest): Promise<HistoryAccessResult> {
    await this.load();
    if (!this.available) return this.failure('The operating-system credential vault is unavailable; protected local history remains locked.');
    if (!validCredential(request?.credential)) return this.failure(`Use a protected-history credential that is ${MIN_CREDENTIAL_LENGTH}-${MAX_CREDENTIAL_LENGTH} characters.`);
    if (this.failures >= MAX_FAILURES) return this.failure('Too many protected-history attempts were rejected; lock again or restart the app before trying again.');
    if (!this.verifier) {
      if (request.create !== true) return this.failure('Protected local history has no credential yet. Create one before unlocking it.');
      const salt = randomBytes(16);
      const next: StoredVerifier = { schemaVersion: 1, salt: encoded(salt), verifier: encoded(derive(request.credential, salt)) };
      try {
        await mkdir(path.dirname(this.filePath), { recursive: true });
        await writeFile(this.filePath, this.encryptString(JSON.stringify(next)), { mode: 0o600, flag: 'wx' });
      } catch {
        return this.failure('The protected-history credential could not be saved; no credential material was exposed.');
      }
      this.verifier = next;
      this.configured = true;
      this.unlocked = true;
      this.generation += 1;
      return { ok: true, status: this.statusValue(), message: 'Protected local history is unlocked for this app session.' };
    }
    let matches = false;
    try {
      const expected = strictDecoded(this.verifier.verifier);
      const actual = derive(request.credential, strictDecoded(this.verifier.salt));
      matches = expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch { matches = false; }
    if (!matches) { this.failures += 1; return this.failure('The protected-history credential did not match; no history state was opened.'); }
    this.unlocked = true;
    this.failures = 0;
    this.generation += 1;
    return { ok: true, status: this.statusValue(), message: 'Protected local history is unlocked for this app session.' };
  }

  lock(): HistoryAccessResult {
    this.unlocked = false;
    this.generation += 1;
    return { ok: true, status: this.statusValue(), message: 'Protected local history is locked again.' };
  }

  invalidate(): void { this.unlocked = false; this.generation += 1; }
  isUnlocked(): boolean { return this.unlocked; }
  sessionToken(): number | null { return this.unlocked ? this.generation : null; }
  isSessionCurrent(token: number): boolean { return this.unlocked && this.generation === token; }

  private failure(message: string): HistoryAccessResult { this.unlocked = false; this.generation += 1; return { ok: false, status: this.statusValue(), message }; }

  private statusValue(): HistoryAccessStatus {
    if (!this.available) return { available: false, configured: false, unlocked: false, reason: 'unavailable' };
    if (!this.configured) return { available: true, configured: false, unlocked: false, reason: 'not-configured' };
    return { available: true, configured: true, unlocked: this.unlocked, reason: this.unlocked ? 'ready' : 'locked' };
  }

  private async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    if (this.loaded) return;
    this.loadPromise = this.loadOnce();
    await this.loadPromise;
  }

  private async loadOnce(): Promise<void> {
    this.loaded = true;
    try { this.available = this.isEncryptionAvailable(); } catch { this.available = false; }
    if (!this.available) return;
    try {
      const bytes = await readFile(this.filePath);
      const parsed = JSON.parse(this.decryptString(bytes)) as StoredVerifier;
      if (parsed?.schemaVersion !== 1 || typeof parsed.salt !== 'string' || typeof parsed.verifier !== 'string') throw new Error('invalid');
      const salt = strictDecoded(parsed.salt);
      const verifier = strictDecoded(parsed.verifier);
      if (salt.length !== 16 || verifier.length !== 32) throw new Error('invalid');
      this.verifier = parsed;
      this.configured = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      this.available = false;
      this.verifier = null;
      this.configured = false;
    }
  }
}
