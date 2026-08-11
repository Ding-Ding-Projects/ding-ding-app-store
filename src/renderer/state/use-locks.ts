import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const reload = useCallback(async () => {
    setLoading(true);
    try { setState(await window.dingDingStore.locks.load()); }
    catch (error) { notify({ ok: false, message: `Local locks could not be loaded: ${(error as Error).message}` }); }
    finally { setLoading(false); }
  }, [notify]);
  useEffect(() => { void reload(); }, [reload]);
  const apply = useCallback(async (operation: () => Promise<LockMutationResult>) => {
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
  const byKey = useMemo(() => new Map(state.records.map((record) => [`${record.targetKind}:${record.targetId}`, record.locked])), [state.records]);
  const isLocked = useCallback((target: LockTarget) => byKey.get(`${target.targetKind}:${target.targetId}`) === true, [byKey]);
  return { state, loading, reload, set, unlock, lockAgain, remove, isLocked };
}
