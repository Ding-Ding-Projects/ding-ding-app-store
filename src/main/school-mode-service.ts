import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import { z } from 'zod';
import type {
  SchoolModeConfigureRequest,
  SchoolModeMutationResult,
  SchoolModeRenameRequest,
  SchoolModeState,
  SchoolModeToggleRequest,
  SchoolModeVerifyRequest,
} from '../shared/contracts.js';
import { writeJsonAtomic } from './json-store.js';

const DEFAULT_NAME = 'School mode';
const MAX_NAME = 64;
const MAX_CREDENTIAL = 512;

const credentialSchema = z.string().min(4).max(MAX_CREDENTIAL);
const nameSchema = z.string().trim().min(1).max(MAX_NAME);
const unlockKindSchema = z.enum(['pin', 'password', 'passkey']);
const configureRequestSchema = z.strictObject({ displayName: nameSchema, unlockKind: unlockKindSchema, credential: credentialSchema });
const renameRequestSchema = z.strictObject({ displayName: nameSchema, credential: credentialSchema.optional() });
const toggleRequestSchema = z.strictObject({ enabled: z.boolean(), credential: credentialSchema.optional() });
const verifyRequestSchema = z.strictObject({ credential: credentialSchema });
const recordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  enabled: z.boolean(),
  displayName: nameSchema,
  unlockKind: unlockKindSchema.nullable(),
  salt: z.string().regex(/^[A-Za-z0-9+/]{16,128}={0,2}$/),
  verifier: z.string().regex(/^[A-Za-z0-9+/]{32,128}={0,2}$/),
});

type StoredRecord = z.infer<typeof recordSchema>;

function publicState(record: Pick<StoredRecord, 'enabled' | 'displayName' | 'unlockKind'>): SchoolModeState {
  return { schemaVersion: 1, enabled: record.enabled, displayName: record.displayName, unlockKind: record.unlockKind };
}

function emptyState(): SchoolModeState {
  return { schemaVersion: 1, enabled: false, displayName: DEFAULT_NAME, unlockKind: null };
}

function encode(value: Uint8Array): string { return Buffer.from(value).toString('base64'); }
function decode(value: string): Buffer { return Buffer.from(value, 'base64'); }

function verifier(secret: string, salt: Buffer): Buffer {
  // A bounded, local verifier; the clear credential never enters the JSON file,
  // history snapshots, exports, notifications, or diagnostic output.
  return scryptSync(secret, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
}

export class SchoolModeService {
  private readonly filePath: string;
  private record: StoredRecord | null = null;
  private loaded = false;

  constructor(filePath = path.join(app.getPath('appData'), 'Ding-Ding-Projects', 'global', 'school-mode.v1.json')) {
    this.filePath = filePath;
  }

  async load(): Promise<SchoolModeState> {
    await this.ensureLoaded();
    return this.record ? publicState(this.record) : emptyState();
  }

  async configure(request: SchoolModeConfigureRequest): Promise<SchoolModeMutationResult> {
    await this.ensureLoaded();
    const parsedRequest = configureRequestSchema.parse(request);
    const displayName = parsedRequest.displayName;
    const unlockKind = parsedRequest.unlockKind;
    const credential = parsedRequest.credential;
    if (this.record?.unlockKind && this.record.verifier && !this.matches(credential, this.record)) return this.failure(`The ${this.record.displayName} unlock credential was not accepted.`);
    const salt = randomBytes(16);
    this.record = { schemaVersion: 1, enabled: true, displayName, unlockKind, salt: encode(salt), verifier: encode(verifier(credential, salt)) };
    await this.persist();
    return { ok: true, state: publicState(this.record), message: `${displayName} is enabled and its local unlock verifier is configured.` };
  }

  async rename(request: SchoolModeRenameRequest): Promise<SchoolModeMutationResult> {
    await this.ensureLoaded();
    const parsedRequest = renameRequestSchema.parse(request);
    const displayName = parsedRequest.displayName;
    if (this.record?.verifier && this.record.enabled && (!parsedRequest.credential || !this.matches(parsedRequest.credential, this.record))) return this.failure(`The ${this.record.displayName} unlock credential was not accepted; the name was not changed.`);
    if (!this.record) {
      // Keep the setting useful before first credential setup; enabling still
      // requires configure(), so this cannot create an unlocked enabled state.
      this.record = { schemaVersion: 1, enabled: false, displayName, unlockKind: null, salt: encode(randomBytes(16)), verifier: encode(randomBytes(32)) };
    } else this.record.displayName = displayName;
    await this.persist();
    return { ok: true, state: publicState(this.record), message: `${displayName} display name saved.` };
  }

  async setEnabled(request: SchoolModeToggleRequest): Promise<SchoolModeMutationResult> {
    await this.ensureLoaded();
    const parsedRequest = toggleRequestSchema.parse(request);
    if (!this.record || !this.record.unlockKind || !this.record.verifier) return this.failure(`Configure a local ${this.record?.displayName ?? DEFAULT_NAME} unlock credential before enabling the mode.`);
    if (!parsedRequest.enabled && (!parsedRequest.credential || !this.matches(parsedRequest.credential, this.record))) return this.failure(`The ${this.record.displayName} unlock credential was not accepted; the mode remains enabled.`);
    this.record.enabled = parsedRequest.enabled;
    await this.persist();
    return { ok: true, state: publicState(this.record), message: parsedRequest.enabled ? `${this.record.displayName} is enabled.` : `${this.record.displayName} is disabled and the previous language and voice choices are available again.` };
  }

  async verify(request: SchoolModeVerifyRequest): Promise<boolean> {
    await this.ensureLoaded();
    const parsedRequest = verifyRequestSchema.parse(request);
    return Boolean(this.record?.verifier && this.matches(parsedRequest.credential, this.record));
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const parsed = recordSchema.safeParse(JSON.parse(await readFile(this.filePath, 'utf8')) as unknown);
      // A malformed or legacy record fails closed and is treated as an
      // unconfigured state. Deleting the file is the documented local reset.
      this.record = parsed.success ? parsed.data : null;
    } catch { this.record = null; }
  }

  private matches(secret: string, record: StoredRecord): boolean {
    const parsed = credentialSchema.safeParse(secret);
    if (!parsed.success) return false;
    try {
      const expected = decode(record.verifier);
      const actual = verifier(parsed.data, decode(record.salt));
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch { return false; }
  }

  private async persist(): Promise<void> {
    if (!this.record) return;
    await writeJsonAtomic(this.filePath, this.record);
  }

  private async failure(message: string): Promise<SchoolModeMutationResult> {
    return { ok: false, state: this.record ? publicState(this.record) : emptyState(), message };
  }
}

export const SCHOOL_MODE_DEFAULT_NAME = DEFAULT_NAME;
