import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { app, safeStorage, shell } from 'electron';
import { z } from 'zod';
import type {
  ElementKey,
  LockCredentialRequest,
  LockBulkRemoveRequest,
  LockBulkMutationResult,
  LockMutationResult,
  LockSetRequest,
  LockState,
  LockTarget,
  LockTotpAlgorithm,
  LockUnlockDuration,
  SupportOpenRecoveryResult,
  SupportState,
  SupportTicket,
  SupportTicketCreateRequest,
  SupportTicketMutationResult,
  SupportTicketStatus,
} from '../shared/contracts.js';
import { ELEMENT_KEYS, LOCK_TOTP_ALGORITHMS, LOCK_TOTP_DIGITS, LOCK_TOTP_PERIOD_MAX_SECONDS, LOCK_TOTP_PERIOD_MIN_SECONDS, TOKEN_IDS } from '../shared/contracts.js';
import type { HistoryService } from './history-service.js';
import { writeJsonAtomic } from './json-store.js';
import { generateTotp, normalizeBase32Secret } from './totp.js';

const MAX_LOCKS = 64;
const MAX_TICKETS = 1_000;
const MAX_CREDENTIAL = 512;
const MAX_DESCRIPTION = 2_000;
const DEFAULT_UNLOCK_DURATION: LockUnlockDuration = 'session';
const unlockDurationSchema = z.enum(['session', '15m', '60m']);
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
const lockTotpAlgorithmSchema = z.enum(LOCK_TOTP_ALGORITHMS);
const lockTotpDigitsSchema = z.union(LOCK_TOTP_DIGITS.map((value) => z.literal(value)) as [z.ZodLiteral<6>, z.ZodLiteral<7>, z.ZodLiteral<8>]);
const lockTotpPeriodSchema = z.number().int().min(LOCK_TOTP_PERIOD_MIN_SECONDS).max(LOCK_TOTP_PERIOD_MAX_SECONDS);
const lockSetSchema = lockTargetSchema.extend({ credentialKind: z.enum(['password', 'totp']).optional(), totpAlgorithm: lockTotpAlgorithmSchema.optional(), totpDigits: lockTotpDigitsSchema.optional(), totpPeriodSeconds: lockTotpPeriodSchema.optional(), credential: credentialSchema, currentCredential: credentialSchema.optional(), confirmationCode: z.string().regex(/^\d{6,8}$/).optional(), unlockDuration: unlockDurationSchema.optional() }).strict().superRefine((value, context) => {
  if (value.credentialKind !== 'totp' && (value.totpAlgorithm !== undefined || value.totpDigits !== undefined || value.totpPeriodSeconds !== undefined || value.confirmationCode !== undefined)) context.addIssue({ code: 'custom', path: ['credentialKind'], message: 'TOTP fields require the TOTP credential method.' });
  if (value.credentialKind === 'totp' && value.confirmationCode !== undefined && value.totpDigits !== undefined && value.confirmationCode.length !== value.totpDigits) context.addIssue({ code: 'custom', path: ['confirmationCode'], message: 'The pairing code length must match the TOTP digit count.' });
});
const lockCredentialSchema = lockTargetSchema.extend({ credential: credentialSchema, unlockDuration: unlockDurationSchema.optional() }).strict();
const lockRecordSchema = lockTargetSchema.extend({
  credentialKind: z.enum(['password', 'totp']).optional(),
  totpAlgorithm: lockTotpAlgorithmSchema.optional(),
  totpDigits: lockTotpDigitsSchema.optional(),
  totpPeriodSeconds: lockTotpPeriodSchema.optional(),
  unlockDuration: unlockDurationSchema.optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
}).strict();
const lockFileSchema = z.strictObject({ schemaVersion: z.literal(1), records: z.array(lockRecordSchema).max(MAX_LOCKS) });
const passwordVaultEntrySchema = z.strictObject({ kind: z.literal('password'), salt: z.string().base64(), verifier: z.string().base64() });
const totpVaultEntrySchema = z.strictObject({ kind: z.literal('totp'), secret: z.string().min(1).max(256), algorithm: lockTotpAlgorithmSchema.optional(), digits: lockTotpDigitsSchema.optional(), periodSeconds: lockTotpPeriodSchema.optional() });
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
  private readonly unlocked = new Map<string, number | null>();
  /** Per-target mutation fence prevents a slower credential read from undoing Lock again. */
  private readonly unlockGenerations = new Map<string, number>();
  private locks: StoredLock[] = [];
  private tickets: SupportTicket[] = [];
  private locksLoaded = false;
  private locksLoadPromise: Promise<void> | null = null;
  private ticketsLoaded = false;
  private vaultReadFailed = false;
  private locksReadFailed = false;
  private readonly attempts = new Map<string, { count: number; windowStartedAt: number }>();
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(private readonly history?: Pick<HistoryService, 'record'>, private readonly isRestricted: () => Promise<boolean> = async () => false) {}

  async loadLocks(): Promise<LockState> {
    await this.ensureLocksLoaded();
    if (await this.isRestricted()) return this.restrictedState();
    return this.lockState();
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> { const run = this.mutationTail.then(operation, operation); this.mutationTail = run.then(() => undefined, () => undefined); return run; }
  async setLock(input: LockSetRequest): Promise<LockMutationResult> { return this.enqueue(() => this.setLockImpl(input)); }
  private async setLockImpl(input: LockSetRequest): Promise<LockMutationResult> {
    await this.ensureLocksLoaded();
    if (await this.isRestricted()) return this.restrictedFailure();
    const parsed = lockSetSchema.safeParse(input);
    if (!parsed.success) return this.lockFailure('Lock details are invalid.', 'invalid');
    if (!this.vaultAvailable()) return this.lockFailure('The operating-system credential vault is unavailable; this local UX lock was not created.', this.vaultReadFailed ? 'credential-store-read-failed' : 'credential-store-unavailable');
    const target = { targetKind: parsed.data.targetKind, targetId: parsed.data.targetId } as const;
    const existing = this.locks.find((record) => keyOf(record) === keyOf(target));
    const targetKey = keyOf(target);
    this.unlockGenerations.set(targetKey, (this.unlockGenerations.get(targetKey) ?? 0) + 1);
    const credentialKind = parsed.data.credentialKind ?? existing?.credentialKind ?? 'password';
    const totpAlgorithm = parsed.data.totpAlgorithm ?? existing?.totpAlgorithm ?? 'sha1';
    const totpDigits = parsed.data.totpDigits ?? existing?.totpDigits ?? 6;
    const totpPeriodSeconds = parsed.data.totpPeriodSeconds ?? existing?.totpPeriodSeconds ?? 30;
    const vault = await this.readVault();
    if (await this.isRestricted()) return this.restrictedFailure();
    if (!vault) return this.lockFailure('The operating-system credential vault could not be read; no lock change was made.', 'credential-store-read-failed');
    if (existing && (!parsed.data.currentCredential || !this.verifyCredential(keyOf(target), parsed.data.currentCredential, this.normalizeVaultEntry(vault[keyOf(target)])))) return this.lockFailure('The current lock credential did not match; the new credential was not saved.', 'credential-mismatch');
    let vaultEntry: VaultEntry;
    if (credentialKind === 'totp') {
      let normalized: string;
      try { normalized = normalizeBase32Secret(parsed.data.credential); } catch { return this.lockFailure('The TOTP secret is not a valid Base32 value.', 'invalid'); }
      if (!parsed.data.confirmationCode || !this.verifyTotpSecret(normalized, parsed.data.confirmationCode, { algorithm: totpAlgorithm, digits: totpDigits, periodSeconds: totpPeriodSeconds })) return this.lockFailure(`Enter the current ${totpDigits}-digit code to confirm this TOTP lock.`, 'invalid-otp');
      vaultEntry = { kind: 'totp', secret: normalized, algorithm: totpAlgorithm, digits: totpDigits, periodSeconds: totpPeriodSeconds };
    } else {
      vaultEntry = { kind: 'password', ...this.makeVerifier(parsed.data.credential) };
    }
    const now = new Date().toISOString();
    const unlockDuration = parsed.data.unlockDuration ?? existing?.unlockDuration ?? DEFAULT_UNLOCK_DURATION;
    const record: StoredLock = existing ? { ...existing, credentialKind, ...(credentialKind === 'totp' ? { totpAlgorithm, totpDigits, totpPeriodSeconds } : {}), unlockDuration, updatedAt: now } : { ...target, credentialKind, ...(credentialKind === 'totp' ? { totpAlgorithm, totpDigits, totpPeriodSeconds } : {}), unlockDuration, createdAt: now, updatedAt: now };
    const nextLocks = existing ? this.locks.map((candidate) => keyOf(candidate) === keyOf(target) ? record : candidate) : [...this.locks, record];
    const nextVault = { ...vault, [keyOf(target)]: vaultEntry };
    const previousLocks = this.locks;
    try {
      // Each file is individually atomic, and a failed second write rolls the first
      // one back. The verifier remains encrypted even in the brief crash window.
      await writeJsonAtomic(this.lockPath, { schemaVersion: 1, records: nextLocks });
      await this.writeVault(nextVault);
      this.locks = nextLocks;
      this.unlocked.delete(targetKey);
      const targetLabel = target.targetKind === 'appearance-property' ? `Appearance property ${target.targetId}` : target.targetKind === 'tab' ? 'Tab' : 'Group';
      return { ok: true, state: this.lockState(), message: `${targetLabel} lock saved. This is a local UX lock, not security or encryption.` };
    } catch {
      try { await writeJsonAtomic(this.lockPath, { schemaVersion: 1, records: previousLocks }); } catch { /* preserve the honest failure state */ }
      return this.lockFailure('The lock could not be saved; no credential was exposed and the previous state remains.', 'credential-store-read-failed');
    }
  }

  async unlock(input: LockCredentialRequest): Promise<LockMutationResult> { return this.enqueue(() => this.unlockImpl(input)); }
  private async unlockImpl(input: LockCredentialRequest): Promise<LockMutationResult> {
    await this.ensureLocksLoaded();
    if (await this.isRestricted()) return this.restrictedFailure();
    const parsed = lockCredentialSchema.safeParse(input);
    if (!parsed.success) return this.lockFailure('Unlock details are invalid.', 'invalid');
    const target = { targetKind: parsed.data.targetKind, targetId: parsed.data.targetId } as const;
    const key = keyOf(target);
    const generation = this.unlockGenerations.get(key) ?? 0;
    if (!this.locks.some((record) => keyOf(record) === key)) return this.lockFailure('That lock does not exist.', 'not-found');
    if (!this.vaultAvailable()) return this.lockFailure('The operating-system credential vault is unavailable; the lock remains honest and unavailable.', this.vaultReadFailed ? 'credential-store-read-failed' : 'credential-store-unavailable');
    const vault = await this.readVault();
    if (await this.isRestricted()) return this.restrictedFailure();
    if (!vault || !this.verifyCredential(key, parsed.data.credential, this.normalizeVaultEntry(vault[key]))) return this.lockFailure('The credential did not match. If it is forgotten, use Support Tickets and delete the application-data folder yourself.', this.isRateLimited(key) ? 'rate-limited' : 'credential-mismatch');
    if ((this.unlockGenerations.get(key) ?? 0) !== generation) return this.lockFailure('The lock changed while the credential was being checked; unlock was discarded.', 'invalid');
    const record = this.locks.find((candidate) => keyOf(candidate) === keyOf(target));
    const duration = parsed.data.unlockDuration ?? record?.unlockDuration ?? DEFAULT_UNLOCK_DURATION;
    const unlockedUntil = duration === 'session' ? null : Date.now() + (duration === '15m' ? 15 : 60) * 60_000;
    this.unlocked.set(key, unlockedUntil);
    return { ok: true, state: this.lockState(), message: duration === 'session' ? 'Unlocked until this app closes. Use Lock again when you want the UX speed bump back.' : `Unlocked for ${duration === '15m' ? '15 minutes' : '60 minutes'}. It will lock again automatically.` };
  }

  async lockAgain(input: LockTarget): Promise<LockMutationResult> { return this.enqueue(() => this.lockAgainImpl(input)); }
  private async lockAgainImpl(input: LockTarget): Promise<LockMutationResult> {
    await this.ensureLocksLoaded();
    if (await this.isRestricted()) return this.restrictedFailure();
    const parsed = lockTargetSchema.safeParse(input);
    if (!parsed.success) return this.lockFailure('Lock target is invalid.', 'invalid');
    const key = keyOf(parsed.data);
    if (!this.locks.some((record) => keyOf(record) === key)) return this.lockFailure('That lock does not exist.', 'not-found');
    this.unlockGenerations.set(key, (this.unlockGenerations.get(key) ?? 0) + 1);
    this.unlocked.delete(key);
    return { ok: true, state: this.lockState(), message: 'Lock restored for this app session.' };
  }

  async remove(input: LockCredentialRequest): Promise<LockMutationResult> { return this.enqueue(() => this.removeImpl(input)); }
  private async removeImpl(input: LockCredentialRequest): Promise<LockMutationResult> {
    await this.ensureLocksLoaded();
    if (await this.isRestricted()) return this.restrictedFailure();
    const parsed = lockCredentialSchema.safeParse(input);
    if (!parsed.success) return this.lockFailure('Lock details are invalid.', 'invalid');
    const target = { targetKind: parsed.data.targetKind, targetId: parsed.data.targetId } as const;
    const key = keyOf(target);
    if (!this.locks.some((record) => keyOf(record) === key)) return this.lockFailure('That lock does not exist.', 'not-found');
    this.unlockGenerations.set(key, (this.unlockGenerations.get(key) ?? 0) + 1);
    if (!this.vaultAvailable()) return this.lockFailure('The operating-system credential vault is unavailable; the lock was not removed.', this.vaultReadFailed ? 'credential-store-read-failed' : 'credential-store-unavailable');
    const vault = await this.readVault();
    if (await this.isRestricted()) return this.restrictedFailure();
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
  async bulkLockAgain(inputs: LockTarget[]): Promise<LockBulkMutationResult> { return this.enqueue(() => this.bulkLockAgainImpl(inputs)); }
  private async bulkLockAgainImpl(inputs: LockTarget[]): Promise<LockBulkMutationResult> {
    await this.ensureLocksLoaded(); if (await this.isRestricted()) return this.bulkRestrictedFailure(); const unique = new Map<string, LockTarget>(); for (const input of inputs) { const parsed = lockTargetSchema.safeParse(input); if (!parsed.success) return { ok: false, state: this.lockState(), affectedCount: 0, skippedCount: 0, skippedTargets: [], message: 'The bulk lock selection was invalid; no locks were changed.', reason: 'invalid' }; unique.set(keyOf(parsed.data), parsed.data); }
    const skippedTargets: LockTarget[] = []; const affected = [...unique.values()].filter((target) => { if (!this.locks.some((record) => keyOf(record) === keyOf(target))) { skippedTargets.push(target); return false; } return true; });
    if (await this.isRestricted()) return this.bulkRestrictedFailure(); for (const target of affected) { const key = keyOf(target); this.unlockGenerations.set(key, (this.unlockGenerations.get(key) ?? 0) + 1); this.unlocked.delete(key); }
    if (affected.length) await this.recordHistory(`Bulk lock-again changed ${affected.length} selected locks; ${skippedTargets.length} skipped.`);
    return { ok: affected.length > 0, state: this.lockState(), affectedCount: affected.length, skippedCount: skippedTargets.length, skippedTargets, message: `${affected.length} lock${affected.length === 1 ? '' : 's'} locked again${skippedTargets.length ? `; ${skippedTargets.length} skipped` : ''}.`, reason: affected.length ? undefined : 'not-found' };
  }
  async bulkRemove(input: LockBulkRemoveRequest): Promise<LockBulkMutationResult> { return this.enqueue(() => this.bulkRemoveImpl(input)); }
  private async bulkRemoveImpl(input: LockBulkRemoveRequest): Promise<LockBulkMutationResult> {
    await this.ensureLocksLoaded(); if (await this.isRestricted()) return this.bulkRestrictedFailure(); if (!input || input.confirmed !== true || !Array.isArray(input.items) || input.items.length > 64) return { ok: false, state: this.lockState(), affectedCount: 0, skippedCount: 0, skippedTargets: [], message: 'Bulk lock removal requires the completed confirmation.', reason: 'invalid' };
    const unique = new Map<string, LockCredentialRequest>(); for (const item of input.items) { const parsed = lockCredentialSchema.safeParse(item); if (!parsed.success) return { ok: false, state: this.lockState(), affectedCount: 0, skippedCount: 0, skippedTargets: [], message: 'The bulk lock credentials were invalid; no locks were changed.', reason: 'invalid' }; unique.set(keyOf(parsed.data), parsed.data); }
    if (!this.vaultAvailable()) return { ok: false, state: this.lockState(), affectedCount: 0, skippedCount: unique.size, skippedTargets: [...unique.values()].map(({ targetKind, targetId }) => ({ targetKind, targetId })), message: 'The operating-system credential vault is unavailable; no locks were removed.', reason: 'credential-store-unavailable' };
    const vault = await this.readVault(); if (await this.isRestricted()) return this.bulkRestrictedFailure(); if (!vault) return { ok: false, state: this.lockState(), affectedCount: 0, skippedCount: unique.size, skippedTargets: [...unique.values()].map(({ targetKind, targetId }) => ({ targetKind, targetId })), message: 'The credential vault could not be read; no locks were removed.', reason: 'credential-store-read-failed' };
    const skippedTargets: LockTarget[] = []; const removable: LockCredentialRequest[] = []; for (const request of unique.values()) { const key = keyOf(request); if (!this.locks.some((record) => keyOf(record) === key) || !this.verifyCredential(key, request.credential, this.normalizeVaultEntry(vault[key]))) skippedTargets.push({ targetKind: request.targetKind, targetId: request.targetId }); else removable.push(request); }
    if (!removable.length) return { ok: false, state: this.lockState(), affectedCount: 0, skippedCount: skippedTargets.length, skippedTargets, message: 'No selected locks were removed; each was missing or its credential did not match.', reason: 'credential-mismatch' };
    const keys = new Set(removable.map(keyOf)); const previousLocks = this.locks; const nextLocks = this.locks.filter((record) => !keys.has(keyOf(record))); const nextVault = { ...vault }; for (const key of keys) delete nextVault[key];
    try { await writeJsonAtomic(this.lockPath, { schemaVersion: 1, records: nextLocks }); await this.writeVault(nextVault); this.locks = nextLocks; for (const key of keys) { this.unlockGenerations.set(key, (this.unlockGenerations.get(key) ?? 0) + 1); this.unlocked.delete(key); } await this.recordHistory(`Bulk lock removal changed ${removable.length} selected locks; ${skippedTargets.length} skipped.`); return { ok: true, state: this.lockState(), affectedCount: removable.length, skippedCount: skippedTargets.length, skippedTargets, message: `${removable.length} lock${removable.length === 1 ? '' : 's'} removed${skippedTargets.length ? `; ${skippedTargets.length} skipped` : ''}.` }; }
    catch { let rollbackOk = true; try { await writeJsonAtomic(this.lockPath, { schemaVersion: 1, records: previousLocks }); } catch { rollbackOk = false; } try { await this.writeVault(vault); } catch { rollbackOk = false; } if (!rollbackOk) { this.locksLoaded = false; this.locksLoadPromise = null; this.vaultReadFailed = true; } return { ok: false, state: this.lockState(), affectedCount: 0, skippedCount: skippedTargets.length, skippedTargets, message: rollbackOk ? 'Bulk removal could not be committed atomically; no content was deleted.' : 'Bulk removal failed and rollback could not be proven; restart the app before changing any lock.', reason: 'credential-store-read-failed' }; }
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
    if (!this.locksLoadPromise) this.locksLoadPromise = (async () => {
      try {
        const parsed = lockFileSchema.safeParse(JSON.parse(await readFile(this.lockPath, 'utf8')) as unknown);
        if (!parsed.success) { this.locksReadFailed = true; this.locks = []; }
        else this.locks = parsed.data.records.map((record) => ({ ...record, credentialKind: record.credentialKind ?? 'password', ...(record.credentialKind === 'totp' ? { totpAlgorithm: record.totpAlgorithm ?? 'sha1', totpDigits: record.totpDigits ?? 6, totpPeriodSeconds: record.totpPeriodSeconds ?? 30 } : {}), unlockDuration: record.unlockDuration ?? DEFAULT_UNLOCK_DURATION }));
      } catch { this.locksReadFailed = true; this.locks = []; }
      finally { this.locksLoaded = true; }
    })();
    await this.locksLoadPromise;
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
    try { return safeStorage.isEncryptionAvailable() && !this.vaultReadFailed && !this.locksReadFailed; } catch { return false; }
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
    if ('kind' in entry) return entry.kind === 'totp' ? { kind: 'totp', secret: entry.secret, algorithm: entry.algorithm ?? 'sha1', digits: entry.digits ?? 6, periodSeconds: entry.periodSeconds ?? 30 } : entry;
    return { kind: 'password', salt: entry.salt, verifier: entry.verifier };
  }

  private verifyTotpSecret(secret: string, code: string, parameters: { algorithm: 'sha1' | 'sha256' | 'sha512'; digits: 6 | 7 | 8; periodSeconds: number }): boolean {
    try {
      const now = Date.now();
      const period = parameters.periodSeconds * 1_000;
      return [-1, 0, 1].some((offset) => generateTotp({ secret, ...parameters, timestampMs: now + offset * period }).code === code);
    } catch { return false; }
  }

  private verifyCredential(key: string, credential: string, entry: VaultEntry | undefined): boolean {
    if (!entry || this.isRateLimited(key)) return false;
    const allowed = entry.kind === 'totp' ? this.verifyTotpSecret(entry.secret, credential, { algorithm: entry.algorithm ?? 'sha1', digits: entry.digits ?? 6, periodSeconds: entry.periodSeconds ?? 30 }) : this.matches(credential, entry);
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

  isLocked(target: LockTarget): boolean {
    const key = keyOf(target);
    if (!this.locks.some((record) => keyOf(record) === key)) return false;
    const expiry = this.unlocked.get(key);
    if (expiry === undefined) return true;
    if (expiry !== null && expiry <= Date.now()) { this.unlocked.delete(key); return true; }
    return false;
  }

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
      unavailableReason: vaultAvailable ? null : (this.vaultReadFailed || this.locksReadFailed) ? 'credential-store-read-failed' : 'credential-store-unavailable',
      records: this.locks.map((record) => {
        const key = keyOf(record);
        const expiry = this.unlocked.get(key);
        const expired = expiry !== undefined && expiry !== null && expiry <= Date.now();
        if (expired) this.unlocked.delete(key);
        const currentExpiry = expired ? undefined : expiry;
        return { ...record, credentialKind: record.credentialKind ?? 'password', unlockDuration: record.unlockDuration ?? DEFAULT_UNLOCK_DURATION, locked: currentExpiry === undefined, unlockedUntil: currentExpiry === undefined || currentExpiry === null ? null : new Date(currentExpiry).toISOString() };
      }),
      recoveryPath: this.recoveryPath,
    };
  }

  private restrictedState(): LockState { return { schemaVersion: 1, vaultAvailable: false, unavailableReason: 'credential-store-unavailable', records: [], recoveryPath: '' }; }
  private restrictedFailure(): LockMutationResult { return { ok: false, state: this.restrictedState(), message: 'Lock management is unavailable while the shared restricted mode is active.', reason: 'credential-store-unavailable' }; }
  private bulkRestrictedFailure(): LockBulkMutationResult { return { ok: false, state: this.restrictedState(), affectedCount: 0, skippedCount: 0, skippedTargets: [], message: 'Bulk lock management is unavailable while the shared restricted mode is active.', reason: 'credential-store-unavailable' }; }

  async hasLockedAppearanceProperties(): Promise<boolean> {
    await this.ensureLocksLoaded();
    return this.locks.some((record) => record.targetKind === 'appearance-property' && this.isLocked(record));
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
