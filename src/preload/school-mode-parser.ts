import type {
  SchoolModeMutationCode,
  SchoolModeMutationResult,
  SchoolModeSnapshot,
  SchoolModeState,
} from '../shared/contracts.js';

const SCHOOL_SNAPSHOT_KEYS = new Set(['schemaVersion', 'observationSequence', 'state', 'configured', 'sync']);
const SCHOOL_STATE_KEYS = new Set(['schemaVersion', 'recordId', 'revision', 'enabled', 'displayName', 'unlockKind']);
const SCHOOL_SYNC_REASONS = new Set(['read-failed', 'parse-failed', 'watch-failed', 'write-failed', 'conflict', 'service-closed', 'bridge-failed']);
const SCHOOL_MUTATION_CODES = new Set<string>([
  'invalid-configure', 'invalid-name', 'invalid-toggle', 'invalid-credential-change',
  'invalid-pin', 'invalid-password', 'already-configured', 'configured', 'credential-rejected',
  'name-unchanged', 'name-saved', 'not-configured', 'passkey-unsupported', 'already-enabled',
  'already-disabled', 'enabled', 'disabled', 'credential-changed-pin', 'credential-changed-password',
  'read-failed', 'parse-failed', 'write-failed', 'conflict', 'service-closed', 'revision-exhausted',
  'state-unavailable', 'bridge-failed',
]);
const SCHOOL_MUTATION_KEYS = new Set(['ok', 'snapshot', 'code']);

function hasExactKeys(value: Record<string, unknown>, expected: Set<string>): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.size && keys.every((key) => expected.has(key));
}

export function parseSchoolModeState(value: unknown): Readonly<SchoolModeState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The shared mode state response was invalid.');
  const state = value as Record<string, unknown>;
  if (!hasExactKeys(state, SCHOOL_STATE_KEYS)
    || state.schemaVersion !== 2
    || (state.recordId !== null && (typeof state.recordId !== 'string' || !/^[A-Za-z0-9_-]{22,64}$/.test(state.recordId)))
    || !Number.isSafeInteger(state.revision) || Number(state.revision) < 0
    || typeof state.enabled !== 'boolean'
    || typeof state.displayName !== 'string' || state.displayName.trim().length < 1 || state.displayName.length > 64
    || (state.unlockKind !== null && state.unlockKind !== 'pin' && state.unlockKind !== 'password' && state.unlockKind !== 'passkey')
    || (state.recordId === null) !== (state.revision === 0)
    || (state.recordId === null && (state.enabled !== false || state.unlockKind !== null))
    || (state.enabled === true && state.unlockKind === null)) throw new Error('The shared mode state response was invalid.');
  return Object.freeze({
    schemaVersion: 2,
    recordId: state.recordId as string | null,
    revision: Number(state.revision),
    enabled: state.enabled,
    displayName: state.displayName,
    unlockKind: state.unlockKind as SchoolModeState['unlockKind'],
  });
}

export function parseSchoolModeSnapshot(value: unknown): Readonly<SchoolModeSnapshot> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The shared mode snapshot response was invalid.');
  const snapshot = value as Record<string, unknown>;
  if (!hasExactKeys(snapshot, SCHOOL_SNAPSHOT_KEYS)
    || snapshot.schemaVersion !== 1
    || !Number.isSafeInteger(snapshot.observationSequence) || Number(snapshot.observationSequence) < 0
    || typeof snapshot.configured !== 'boolean'
    || !snapshot.sync || typeof snapshot.sync !== 'object' || Array.isArray(snapshot.sync)) throw new Error('The shared mode snapshot response was invalid.');
  const state = snapshot.state === null ? null : parseSchoolModeState(snapshot.state);
  if (snapshot.configured !== Boolean(state?.unlockKind)) throw new Error('The shared mode snapshot response was invalid.');
  const sync = snapshot.sync as Record<string, unknown>;
  let frozenSync: SchoolModeSnapshot['sync'];
  if (sync.status === 'ready') {
    if (!hasExactKeys(sync, new Set(['status', 'watching'])) || typeof sync.watching !== 'boolean') throw new Error('The shared mode snapshot response was invalid.');
    if (!state) throw new Error('The shared mode snapshot response was invalid.');
    frozenSync = Object.freeze({ status: 'ready', watching: sync.watching });
  } else {
    if (!hasExactKeys(sync, new Set(['status', 'watching', 'reason'])) || sync.status !== 'unavailable' || typeof sync.watching !== 'boolean' || typeof sync.reason !== 'string' || !SCHOOL_SYNC_REASONS.has(sync.reason)) throw new Error('The shared mode snapshot response was invalid.');
    frozenSync = Object.freeze({ status: 'unavailable', watching: sync.watching, reason: sync.reason as Exclude<SchoolModeSnapshot['sync'], { status: 'ready' }>['reason'] });
  }
  return Object.freeze({
    schemaVersion: 1,
    observationSequence: Number(snapshot.observationSequence),
    state,
    configured: snapshot.configured,
    sync: frozenSync,
  });
}

export function parseSchoolModeMutationResult(value: unknown): Readonly<SchoolModeMutationResult> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The shared mode change response was invalid.');
  const result = value as Record<string, unknown>;
  if (!hasExactKeys(result, SCHOOL_MUTATION_KEYS) || typeof result.ok !== 'boolean' || typeof result.code !== 'string' || !SCHOOL_MUTATION_CODES.has(result.code)) throw new Error('The shared mode change response was invalid.');
  return Object.freeze({ ok: result.ok, snapshot: parseSchoolModeSnapshot(result.snapshot), code: result.code as SchoolModeMutationCode });
}

export function parseSchoolModeVerifyResult(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('The shared mode verification response was invalid.');
  return value;
}
