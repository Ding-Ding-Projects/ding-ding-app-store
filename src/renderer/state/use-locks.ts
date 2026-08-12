import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  LockCredentialRequest,
  LockMutationResult,
  LockSetRequest,
  LockState,
  LockTarget,
} from '../../shared/contracts';
import type { Notify } from '../notify';

export const EMPTY_LOCK_STATE: LockState = {
  schemaVersion: 1,
  vaultAvailable: false,
  unavailableReason: 'credential-store-unavailable',
  records: [],
  recoveryPath: '',
};

export interface LocksApi {
  state: LockState;
  loading: boolean;
  reload(): Promise<void>;
  set(request: LockSetRequest): Promise<LockMutationResult>;
  unlock(request: LockCredentialRequest): Promise<LockMutationResult>;
  lockAgain(target: LockTarget): Promise<LockMutationResult>;
  remove(request: LockCredentialRequest): Promise<LockMutationResult>;
  isLocked(target: LockTarget): boolean;
}
export function useLocks(notify: Notify): LocksApi {
  const [state, setState] = useState<LockState>(EMPTY_LOCK_STATE);
  const [loading, setLoading] = useState(true);
  const requestEpoch = useRef(0);
  const reload = useCallback(async () => {
    setLoading(true);
    const epoch = ++requestEpoch.current;
    try { const next = await window.dingDingStore.locks.load(); if (epoch === requestEpoch.current) setState(next); }
    catch (error) { notify({ ok: false, message: `Local locks could not be loaded: ${(error as Error).message}` }); }
    finally { setLoading(false); }
  }, [notify]);
  useEffect(() => { void reload(); }, [reload]);
  // Timed unlocks are authoritative in the main process. Refresh just after the
  // advertised deadline so tab/group activation cannot keep a stale unlocked
  // projection indefinitely; the renderer never decides expiry itself.
  useEffect(() => {
    const deadlines = state.records.map((record) => record.unlockedUntil ? Date.parse(record.unlockedUntil) : Number.POSITIVE_INFINITY).filter(Number.isFinite);
    if (!deadlines.length) return;
    const delay = Math.max(0, Math.min(...deadlines) - Date.now()) + 25;
    const timer = window.setTimeout(() => { void reload(); }, Math.min(delay, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [reload, state.records]);
  const apply = useCallback(async (operation: () => Promise<LockMutationResult>) => {
      ++requestEpoch.current;
      try {
      const result = await operation();
      setState(result.state);
      notify({ ok: result.ok, message: result.message });
      return result;
    } catch (error) {
      const message = (error as Error).message;
      notify({ ok: false, message });
      return { ok: false, state, message, reason: 'invalid' as const };
    }
  }, [notify, state]);
  const set = useCallback((request: LockSetRequest) => apply(() => window.dingDingStore.locks.set(request)), [apply]);
  const unlock = useCallback((request: LockCredentialRequest) => apply(() => window.dingDingStore.locks.unlock(request)), [apply]);
  const lockAgain = useCallback((target: LockTarget) => apply(() => window.dingDingStore.locks.lockAgain(target)), [apply]);
  const remove = useCallback((request: LockCredentialRequest) => apply(() => window.dingDingStore.locks.remove(request)), [apply]);
  const byKey = useMemo(() => new Map(state.records.map((record) => [`${record.targetKind}:${record.targetId}`, record])), [state.records]);
  const isLocked = useCallback((target: LockTarget) => {
    const record = byKey.get(`${target.targetKind}:${target.targetId}`);
    if (!record) return false;
    if (record.locked) return true;
    return record.unlockedUntil !== null && Date.parse(record.unlockedUntil) <= Date.now();
  }, [byKey]);
  return { state, loading, reload, set, unlock, lockAgain, remove, isLocked };
}
