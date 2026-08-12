import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { app, safeStorage, shell } from 'electron';
import { z } from 'zod';
import type {
  ElementKey,
  LockCredentialRequest,
  LockMutationResult,
  LockSetRequest,
  LockState,
  LockTarget,
  SupportOpenRecoveryResult,
  SupportState,
  SupportTicket,
  SupportTicketCreateRequest,
  SupportTicketMutationResult,
  SupportTicketStatus,
} from '../shared/contracts.js';
import { ELEMENT_KEYS, TOKEN_IDS } from '../shared/contracts.js';
import type { HistoryService } from './history-service.js';
import { writeJsonAtomic } from './json-store.js';
import { generateTotp, normalizeBase32Secret } from './totp.js';

const MAX_LOCKS = 64;
const MAX_TICKETS = 1_000;
const MAX_CREDENTIAL = 512;
const MAX_DESCRIPTION = 2_000;
const lockTargetSchema = z.strictObject({
  targetKind: z.enum(['tab', 'group', 'appearance-property']),
  targetId: z.string().min(1).max(128),
}).superRefine((value, context) => {
  if (value.targetKind === 'appearance-property') {
    const [element, token, ...rest] = value.targetId.split(':');
    if (rest.length || !(ELEMENT_KEYS as readonly string[]).includes(element ?? '') || !(TOKEN_IDS as readonly string[]).includes(token ?? '')) context.addIssue({ code: 'custom', path: ['targetId'], message: 'Appearance locks must name one known element and token.' });
  } else if (!/^(?:[a-z][a-z0-9-]{0,31}|grp_[a-z0-9]{8})$/.test(value.targetId)) {
    context.addIssue({ code: 'custom', path: ['targetId'], message: 'The tab or group identifier is invalid.' });
  }
});
const credentialSchema = z.string().min(4).max(MAX_CREDENTIAL);
const lockSetSchema = lockTargetSchema.extend({ credentialKind: z.enum(['password', 'totp']).optional(), credential: credentialSchema, currentCredential: credentialSchema.optional(), confirmationCode: z.string().regex(/^\d{6,8}$/).optional() }).strict();
const lockCredentialSchema = lockTargetSchema.extend({ credential: credentialSchema }).strict();
const lockRecordSchema = lockTargetSchema.extend({
  credentialKind: z.enum(['password', 'totp']).optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();
const lockFileSchema = z.strictObject({ schemaVersion: z.literal(1), records: z.array(lockRecordSchema).max(MAX_LOCKS) });
const passwordVaultEntrySchema = z.strictObject({ kind: z.literal('password'), salt: z.string().base64(), verifier: z.string().base64() });
const totpVaultEntrySchema = z.strictObject({ kind: z.literal('totp'), secret: z.string().min(1).max(256) });
const legacyVaultEntrySchema = z.strictObject({ salt: z.string().base64(), verifier: z.string().base64() });
const vaultEntrySchema = z.union([passwordVaultEntrySchema, totpVaultEntrySchema, legacyVaultEntrySchema]);
const vaultSchema = z.record(z.string().regex(/^(?:tab|group):[a-z][a-z0-9-]{0,31}$|^(?:tab|group):grp_[a-z0-9]{8}$|^appearance-property:[a-z0-9-]+:[a-z0-9-]+$/), vaultEntrySchema);
const supportTicketSchema = z.strictObject({
  id: z.uuid(),
  number: z.string().regex(/^DDAS-[0-9]{4}-[A-Z0-9]{8}$/),
  category: z.enum(['unlock', 'lock', 'other']),
  description: z.string().min(1).max(MAX_DESCRIPTION),
  severity: z.enum(['low', 'normal', 'high']),
  status: z.enum(['created', 'reviewed', 'resolved']),
  firstResponse: z.string().max(500),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const supportFileSchema = z.strictObject({ schemaVersion: z.literal(1), tickets: z.array(supportTicketSchema).max(MAX_TICKETS) });
const supportCreateSchema = z.strictObject({ category: z.enum(['unlock', 'lock', 'other']), description: z.string().trim().min(1).max(MAX_DESCRIPTION), severity: z.enum(['low', 'normal', 'high']) });

type StoredLock = z.infer<typeof lockRecordSchema>;
type VaultEntry = z.infer<typeof passwordVaultEntrySchema> | z.infer<typeof totpVaultEntrySchema>;

function keyOf(target: LockTarget): string { return `${target.targetKind}:${target.targetId}`; }
function encode(value: Uint8Array): string { return Buffer.from(value).toString('base64'); }
function decode(value: string): Buffer { return Buffer.from(value, 'base64'); }

/**
 * Local tab/group UX locks and the fictional on-device Support Tickets desk.
 * No network is used. Passwords are never written in plaintext: only a
 * salted verifier is encrypted through Electron safeStorage and kept in an
 * app-owned file. If the operating-system vault is unavailable, lock changes
 * fail closed instead of pretending that a local file is a credential store.
 */
export class LockSupportService {
  private readonly lockPath = path.join(app.getPath('userData'), 'locks.v1.json');
  private readonly vaultPath = path.join(app.getPath('userData'), 'credential-vault', 'tab-locks.dpapi');
  private readonly ticketPath = path.join(app.getPath('userData'), 'support-tickets.v1.json');
  private readonly recoveryPath = path.resolve(app.getPath('userData'));
  private readonly unlocked = new Set<string>();
  private locks: StoredLock[] = [];
  private tickets: SupportTicket[] = [];
  private locksLoaded = false;
  private ticketsLoaded = false;
  private vaultReadFailed = false;
  private readonly attempts = new Map<string, { count: number; windowStartedAt: number }>();

  constructor(private readonly history?: Pick<HistoryService, 'record'>) {}

  async loadLocks(): Promise<LockState> {
    await this.ensureLocksLoaded();
    return this.lockState();
  }

  async setLock(input: LockSetRequest): Promise<LockMutationResult> {
    await this.ensureLocksLoaded();
    const parsed = lockSetSchema.safeParse(input);
    if (!parsed.success) return this.lockFailure('Lock details are invalid.', 'invalid');
    if (!this.vaultAvailable()) return this.lockFailure('The operating-system credential vault is unavailable; this local UX lock was not created.', this.vaultReadFailed ? 'credential-store-read-failed' : 'credential-store-unavailable');
    const target = { targetKind: parsed.data.targetKind, targetId: parsed.data.targetId } as const;
    const existing = this.locks.find((record) => keyOf(record) === keyOf(target));
    const credentialKind = parsed.data.credentialKind ?? existing?.credentialKind ?? 'password';
    const vault = await this.readVault();
    if (!vault) return this.lockFailure('The operating-system credential vault could not be read; no lock change was made.', 'credential-store-read-failed');
    if (existing && (!parsed.data.currentCredential || !this.verifyCredential(keyOf(target), parsed.data.currentCredential, this.normalizeVaultEntry(vault[keyOf(target)])))) return this.lockFailure('The current lock credential did not match; the new credential was not saved.', 'credential-mismatch');
    let vaultEntry: VaultEntry;
    if (credentialKind === 'totp') {
      let normalized: string;
      try { normalized = normalizeBase32Secret(parsed.data.credential); } catch { return this.lockFailure('The TOTP secret is not a valid Base32 value.', 'invalid'); }
      if (!parsed.data.confirmationCode || !this.verifyTotpSecret(normalized, parsed.data.confirmationCode)) return this.lockFailure('Enter the current six-digit code to confirm this TOTP lock.', 'invalid-otp');
      vaultEntry = { kind: 'totp', secret: normalized };
    } else {
      vaultEntry = { kind: 'password', ...this.makeVerifier(parsed.data.credential) };
    }
    const now = new Date().toISOString();
    const record: StoredLock = existing ? { ...existing, credentialKind, updatedAt: now } : { ...target, credentialKind, createdAt: now, updatedAt: now };
    const nextLocks = existing ? this.locks.map((candidate) => keyOf(candidate) === keyOf(target) ? record : candidate) : [...this.locks, record];
    const nextVault = { ...vault, [keyOf(target)]: vaultEntry };
    const previousLocks = this.locks;
    try {
      // Each file is individually atomic, and a failed second write rolls the first
      // one back. The verifier remains encrypted even in the brief crash window.
      await writeJsonAtomic(this.lockPath, { schemaVersion: 1, records: nextLocks });
      await this.writeVault(nextVault);
      this.locks = nextLocks;
      this.unlocked.delete(keyOf(target));
      return { ok: true, state: this.lockState(), message: `${target.targetKind === 'tab' ? 'Tab' : 'Group'} lock saved. This is a local UX lock, not security or encryption.` };
    } catch {
      try { await writeJsonAtomic(this.lockPath, { schemaVersion: 1, records: previousLocks }); } catch { /* preserve the honest failure state */ }
      return this.lockFailure('The lock could not be saved; no credential was exposed and the previous state remains.', 'credential-store-read-failed');
    }
  }

  async unlock(input: LockCredentialRequest): Promise<LockMutationResult> {
    await this.ensureLocksLoaded();
    const parsed = lockCredentialSchema.safeParse(input);
    if (!parsed.success) return this.lockFailure('Unlock details are invalid.', 'invalid');
    const target = { targetKind: parsed.data.targetKind, targetId: parsed.data.targetId } as const;
    if (!this.locks.some((record) => keyOf(record) === keyOf(target))) return this.lockFailure('That lock does not exist.', 'not-found');
    if (!this.vaultAvailable()) return this.lockFailure('The operating-system credential vault is unavailable; the lock remains honest and unavailable.', this.vaultReadFailed ? 'credential-store-read-failed' : 'credential-store-unavailable');
    const vault = await this.readVault();
    if (!vault || !this.verifyCredential(keyOf(target), parsed.data.credential, this.normalizeVaultEntry(vault[keyOf(target)]))) return this.lockFailure('The credential did not match. If it is forgotten, use Support Tickets and delete the application-data folder yourself.', this.isRateLimited(keyOf(target)) ? 'rate-limited' : 'credential-mismatch');
    this.unlocked.add(keyOf(target));
    return { ok: true, state: this.lockState(), message: 'Unlocked for this app session. Use Lock again when you want the UX speed bump back.' };
  }

  async lockAgain(input: LockTarget): Promise<LockMutationResult> {
    await this.ensureLocksLoaded();
    const parsed = lockTargetSchema.safeParse(input);
    if (!parsed.success) return this.lockFailure('Lock target is invalid.', 'invalid');
    const key = keyOf(parsed.data);
    if (!this.locks.some((record) => keyOf(record) === key)) return this.lockFailure('That lock does not exist.', 'not-found');
    this.unlocked.delete(key);
    return { ok: true, state: this.lockState(), message: 'Lock restored for this app session.' };
  }

  async remove(input: LockCredentialRequest): Promise<LockMutationResult> {
    await this.ensureLocksLoaded();
    const parsed = lockCredentialSchema.safeParse(input);
    if (!parsed.success) return this.lockFailure('Lock details are invalid.', 'invalid');
    const target = { targetKind: parsed.data.targetKind, targetId: parsed.data.targetId } as const;
    const key = keyOf(target);
    if (!this.locks.some((record) => keyOf(record) === key)) return this.lockFailure('That lock does not exist.', 'not-found');
    if (!this.vaultAvailable()) return this.lockFailure('The operating-system credential vault is unavailable; the lock was not removed.', this.vaultReadFailed ? 'credential-store-read-failed' : 'credential-store-unavailable');
    const vault = await this.readVault();
    if (!vault || !this.verifyCredential(key, parsed.data.credential, this.normalizeVaultEntry(vault[key]))) return this.lockFailure('The credential did not match; the lock was not removed.', 'credential-mismatch');
    const nextVault = { ...vault };
    delete nextVault[key];
    const nextLocks = this.locks.filter((record) => keyOf(record) !== key);
    const previousLocks = this.locks;
    try {
      await writeJsonAtomic(this.lockPath, { schemaVersion: 1, records: nextLocks });
      await this.writeVault(nextVault);
      this.locks = nextLocks;
      this.unlocked.delete(key);
      return { ok: true, state: this.lockState(), message: 'Lock removed. Nothing else was deleted.' };
    } catch {
      try { await writeJsonAtomic(this.lockPath, { schemaVersion: 1, records: previousLocks }); } catch { /* preserve the honest failure state */ }
      return this.lockFailure('The lock could not be removed; no content was deleted.', 'credential-store-read-failed');
    }
  }

  async loadSupport(): Promise<SupportState> {
    await this.ensureTicketsLoaded();
    return this.supportState();
  }

  async createTicket(input: SupportTicketCreateRequest): Promise<SupportTicketMutationResult> {
    await this.ensureTicketsLoaded();
    const parsed = supportCreateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, state: this.supportState(), message: 'Choose a category, severity, and a description up to 2,000 characters.', reason: 'invalid' };
    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      id: randomUUID(),
      number: `DDAS-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`,
      category: parsed.data.category,
      description: parsed.data.description,
      severity: parsed.data.severity,
      status: 'created',
      firstResponse: 'First response: the desk has read the manual once. Nothing was sent anywhere; delete the application-data folder yourself to reset a forgotten lock.',
      createdAt: now,
      updatedAt: now,
    };
    const previousTickets = this.tickets;
    try {
      const nextTickets = [...this.tickets, ticket].slice(-MAX_TICKETS);
      this.tickets = nextTickets;
      await writeJsonAtomic(this.ticketPath, { schemaVersion: 1, tickets: this.tickets });
      await this.recordHistory(`Support ticket ${ticket.number} created locally.`);
      return { ok: true, state: this.supportState(), message: `${ticket.number} was created on this device. No network request was made.` };
    } catch {
      this.tickets = previousTickets;
      return { ok: false, state: this.supportState(), message: 'The local ticket could not be saved. Nothing was sent anywhere.', reason: 'storage-failed' };
    }
  }

  async advanceTicket(ticketId: string): Promise<SupportTicketMutationResult> {
    await this.ensureTicketsLoaded();
    const index = this.tickets.findIndex((ticket) => ticket.id === ticketId);
    if (index < 0) return { ok: false, state: this.supportState(), message: 'That local ticket no longer exists.', reason: 'not-found' };
    const current = this.tickets[index];
    const nextStatus: SupportTicketStatus = current.status === 'created' ? 'reviewed' : current.status === 'reviewed' ? 'resolved' : 'resolved';
    if (nextStatus === current.status) return { ok: true, state: this.supportState(), message: `${current.number} is already marked resolved.` };
    const next = { ...current, status: nextStatus, updatedAt: new Date().toISOString() };
    const previousTickets = this.tickets;
    this.tickets = this.tickets.map((ticket) => ticket.id === ticketId ? next : ticket);
    try {
      await writeJsonAtomic(this.ticketPath, { schemaVersion: 1, tickets: this.tickets });
      await this.recordHistory(`Support ticket ${current.number} advanced to ${nextStatus} locally.`);
      return { ok: true, state: this.supportState(), message: `${current.number} is now ${nextStatus}.` };
    } catch {
      this.tickets = previousTickets;
      return { ok: false, state: this.supportState(), message: 'The local ticket status could not be saved.', reason: 'storage-failed' };
    }
  }

  async openRecoveryFolder(): Promise<SupportOpenRecoveryResult> {
    const error = await shell.openPath(this.recoveryPath);
    return error
      ? { ok: false, path: this.recoveryPath, message: `The file manager could not open ${this.recoveryPath}. You can copy the path and open it yourself.` }
      : { ok: true, path: this.recoveryPath, message: `Opened ${this.recoveryPath}. Delete this folder yourself only if you want to reset local locks and tickets.` };
  }

  private async ensureLocksLoaded(): Promise<void> {
    if (this.locksLoaded) return;
    this.locksLoaded = true;
    try {
      const parsed = lockFileSchema.safeParse(JSON.parse(await readFile(this.lockPath, 'utf8')) as unknown);
      this.locks = parsed.success ? parsed.data.records : [];
    } catch { this.locks = []; }
  }

  private async ensureTicketsLoaded(): Promise<void> {
    if (this.ticketsLoaded) return;
    this.ticketsLoaded = true;
    try {
      const parsed = supportFileSchema.safeParse(JSON.parse(await readFile(this.ticketPath, 'utf8')) as unknown);
      this.tickets = parsed.success ? parsed.data.tickets : [];
    } catch { this.tickets = []; }
  }

  private vaultAvailable(): boolean {
    try { return safeStorage.isEncryptionAvailable() && !this.vaultReadFailed; } catch { return false; }
  }

  private async readVault(): Promise<Record<string, VaultEntry> | null> {
    if (!this.vaultAvailable()) return null;
    try {
      const encrypted = await readFile(this.vaultPath);
      const parsed = vaultSchema.safeParse(JSON.parse(safeStorage.decryptString(encrypted)) as unknown);
      if (!parsed.success) { this.vaultReadFailed = true; return null; }
      return Object.fromEntries(Object.entries(parsed.data).map(([key, entry]) => [key, this.normalizeVaultEntry(entry)!]));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
      this.vaultReadFailed = true;
      return null;
    }
  }

  private async writeVault(value: Record<string, VaultEntry>): Promise<void> {
    if (!this.vaultAvailable()) throw new Error('Credential vault unavailable.');
    const encrypted = safeStorage.encryptString(JSON.stringify(value));
    await mkdir(path.dirname(this.vaultPath), { recursive: true });
    const temporary = `${this.vaultPath}.${process.pid}.tmp`;
    await writeFile(temporary, encrypted, { mode: 0o600 });
    await rename(temporary, this.vaultPath);
  }

  private makeVerifier(secret: string): { salt: string; verifier: string } {
    const salt = randomBytes(16);
    return { salt: encode(salt), verifier: encode(scryptSync(secret, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 })) };
  }

  private normalizeVaultEntry(entry: VaultEntry | z.infer<typeof legacyVaultEntrySchema> | undefined): VaultEntry | undefined {
    if (!entry) return undefined;
    if ('kind' in entry) return entry;
    return { kind: 'password', salt: entry.salt, verifier: entry.verifier };
  }

  private verifyTotpSecret(secret: string, code: string): boolean {
    try { return generateTotp({ secret, algorithm: 'sha1', digits: 6, periodSeconds: 30 }).code === code; } catch { return false; }
  }

  private verifyCredential(key: string, credential: string, entry: VaultEntry | undefined): boolean {
    if (!entry || this.isRateLimited(key)) return false;
    const allowed = entry.kind === 'totp' ? this.verifyTotpSecret(entry.secret, credential) : this.matches(credential, entry);
    if (!allowed) this.noteAttempt(key); else this.attempts.delete(key);
    return allowed;
  }

  private isRateLimited(key: string): boolean {
    const attempt = this.attempts.get(key);
    if (!attempt) return false;
    if (Date.now() - attempt.windowStartedAt >= 30_000) { this.attempts.delete(key); return false; }
    return attempt.count >= 5;
  }

  private noteAttempt(key: string): void {
    const now = Date.now();
    const current = this.attempts.get(key);
    if (!current || now - current.windowStartedAt >= 30_000) this.attempts.set(key, { count: 1, windowStartedAt: now });
    else this.attempts.set(key, { ...current, count: current.count + 1 });
  }

  async assertAppearanceMutation(key: ElementKey, next: Record<string, unknown>, current: Record<string, unknown>): Promise<void> {
    await this.ensureLocksLoaded();
    for (const token of TOKEN_IDS) {
      const target = { targetKind: 'appearance-property' as const, targetId: `${key}:${token}` };
      if (this.isLocked(target) && JSON.stringify(next[token]) !== JSON.stringify(current[token])) throw new Error('This appearance property is locked. Unlock it in Settings → Locks & Support before changing it.');
    }
  }

  isLocked(target: LockTarget): boolean { return this.locks.some((record) => keyOf(record) === keyOf(target) && !this.unlocked.has(keyOf(target))); }

  private matches(secret: string, entry: VaultEntry | undefined): boolean {
    if (!entry || entry.kind === 'totp') return false;
    try {
      const expected = decode(entry.verifier);
      const actual = scryptSync(secret, decode(entry.salt), expected.length, { N: 16_384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 });
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    } catch { return false; }
  }

  private lockState(): LockState {
    const vaultAvailable = this.vaultAvailable();
    return {
      schemaVersion: 1,
      vaultAvailable,
      unavailableReason: vaultAvailable ? null : this.vaultReadFailed ? 'credential-store-read-failed' : 'credential-store-unavailable',
      records: this.locks.map((record) => ({ ...record, credentialKind: record.credentialKind ?? 'password', locked: !this.unlocked.has(keyOf(record)) })),
      recoveryPath: this.recoveryPath,
    };
  }

  private lockFailure(message: string, reason: LockMutationResult['reason']): LockMutationResult {
    return { ok: false, state: this.lockState(), message, reason };
  }

  private supportState(): SupportState {
    return {
      schemaVersion: 1,
      tickets: this.tickets.map((ticket) => ({ ...ticket })),
      recoveryPath: this.recoveryPath,
      disclosure: 'Nothing is sent anywhere. No ticket exists outside this machine, no network request is made, no data is collected, and nobody is reading it.',
    };
  }

  private async recordHistory(message: string): Promise<void> {
    if (!this.history) return;
    try { await this.history.record({ appId: 'ding-ding-app-store', displayName: 'Ding Ding App Store', kind: 'settings', ok: true, message }); }
    catch { /* A local history hiccup never changes the ticket result. */ }
  }
}
