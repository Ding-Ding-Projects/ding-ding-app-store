import type { LockCredentialRequest, LockMutationResult, LockSetRequest, LockState, LockTarget, LockUnlockDuration } from '../shared/contracts.js';

const DURATIONS = new Set<LockUnlockDuration>(['session', '15m', '60m']);
const TARGETS = new Set(['tab', 'group', 'appearance-property']);
function object(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(message);
  return value as Record<string, unknown>;
}
function target(value: unknown, message: string) {
  const record = object(value, message);
  if (!TARGETS.has(String(record.targetKind)) || typeof record.targetId !== 'string' || record.targetId.length < 1 || record.targetId.length > 128) throw new Error(message);
  return { targetKind: record.targetKind as LockState['records'][number]['targetKind'], targetId: record.targetId };
}
export function parseLockTarget(value: unknown): LockTarget {
  const input = object(value, 'The lock target request was invalid.');
  if (Object.keys(input).some((key) => key !== 'targetKind' && key !== 'targetId')) throw new Error('The lock target request was invalid.');
  return target(input, 'The lock target request was invalid.');
}
export function parseLockSetRequest(value: unknown): LockSetRequest {
  const input = object(value, 'The lock set request was invalid.');
  const allowed = new Set(['targetKind', 'targetId', 'credentialKind', 'credential', 'currentCredential', 'confirmationCode', 'unlockDuration']);
  if (Object.keys(input).some((key) => !allowed.has(key)) || typeof input.credential !== 'string' || input.credential.length < 4 || input.credential.length > 512 || (input.currentCredential !== undefined && (typeof input.currentCredential !== 'string' || input.currentCredential.length < 4 || input.currentCredential.length > 512)) || (input.credentialKind !== undefined && input.credentialKind !== 'password' && input.credentialKind !== 'totp') || (input.unlockDuration !== undefined && !DURATIONS.has(input.unlockDuration as LockUnlockDuration)) || (input.confirmationCode !== undefined && (typeof input.confirmationCode !== 'string' || !/^\d{6,8}$/.test(input.confirmationCode)))) throw new Error('The lock set request was invalid.');
  return { ...parseLockTarget({ targetKind: input.targetKind, targetId: input.targetId }), credential: input.credential, credentialKind: input.credentialKind as LockSetRequest['credentialKind'], currentCredential: input.currentCredential as string | undefined, confirmationCode: input.confirmationCode as string | undefined, unlockDuration: input.unlockDuration as LockUnlockDuration | undefined };
}
export function parseLockCredentialRequest(value: unknown): LockCredentialRequest {
  const input = object(value, 'The lock credential request was invalid.');
  const allowed = new Set(['targetKind', 'targetId', 'credential', 'unlockDuration']);
  if (Object.keys(input).some((key) => !allowed.has(key)) || typeof input.credential !== 'string' || input.credential.length < 4 || input.credential.length > 512 || (input.unlockDuration !== undefined && !DURATIONS.has(input.unlockDuration as LockUnlockDuration))) throw new Error('The lock credential request was invalid.');
  return { ...parseLockTarget({ targetKind: input.targetKind, targetId: input.targetId }), credential: input.credential, unlockDuration: input.unlockDuration as LockUnlockDuration | undefined };
}
function record(value: unknown): LockState['records'][number] {
  const input = object(value, 'The lock record response was invalid.');
  const keys = new Set(['targetKind', 'targetId', 'credentialKind', 'unlockDuration', 'locked', 'createdAt', 'updatedAt', 'unlockedUntil']);
  if (Object.keys(input).some((key) => !keys.has(key)) || (input.credentialKind !== 'password' && input.credentialKind !== 'totp') || !DURATIONS.has(input.unlockDuration as LockUnlockDuration) || typeof input.locked !== 'boolean' || typeof input.createdAt !== 'string' || !Number.isFinite(Date.parse(input.createdAt)) || typeof input.updatedAt !== 'string' || !Number.isFinite(Date.parse(input.updatedAt)) || (input.unlockedUntil !== null && (typeof input.unlockedUntil !== 'string' || !Number.isFinite(Date.parse(input.unlockedUntil)))) || (input.locked && input.unlockedUntil !== null) || (!input.locked && (input.unlockDuration === 'session' ? input.unlockedUntil !== null : input.unlockedUntil === null))) throw new Error('The lock record response was invalid.');
  return Object.freeze({ ...target(input, 'The lock record response was invalid.'), credentialKind: input.credentialKind as 'password' | 'totp', unlockDuration: input.unlockDuration as LockUnlockDuration, locked: input.locked, createdAt: input.createdAt, updatedAt: input.updatedAt, unlockedUntil: input.unlockedUntil as string | null });
}
export function parseLockState(value: unknown): LockState {
  const input = object(value, 'The lock state response was invalid.');
  const keys = new Set(['schemaVersion', 'vaultAvailable', 'unavailableReason', 'records', 'recoveryPath']);
  if (Object.keys(input).some((key) => !keys.has(key)) || input.schemaVersion !== 1 || typeof input.vaultAvailable !== 'boolean' || (input.unavailableReason !== null && input.unavailableReason !== 'credential-store-unavailable' && input.unavailableReason !== 'credential-store-read-failed') || !Array.isArray(input.records) || input.records.length > 64 || input.records.some((item) => { record(item); return false; }) || typeof input.recoveryPath !== 'string') throw new Error('The lock state response was invalid.');
  return Object.freeze({ schemaVersion: 1, vaultAvailable: input.vaultAvailable, unavailableReason: input.unavailableReason as LockState['unavailableReason'], records: input.records.map(record), recoveryPath: input.recoveryPath });
}
export function parseLockMutationResult(value: unknown): LockMutationResult {
  const input = object(value, 'The lock mutation response was invalid.');
  const reasons = new Set(['credential-store-unavailable', 'credential-store-read-failed', 'credential-mismatch', 'invalid-otp', 'rate-limited', 'not-found', 'appearance-locked', 'invalid']);
  if (typeof input.ok !== 'boolean' || typeof input.message !== 'string' || input.message.length > 2_000 || !input.state || (input.reason !== undefined && (typeof input.reason !== 'string' || !reasons.has(input.reason)))) throw new Error('The lock mutation response was invalid.');
  return Object.freeze({ ok: input.ok, state: parseLockState(input.state), message: input.message, reason: input.reason as LockMutationResult['reason'] });
}
