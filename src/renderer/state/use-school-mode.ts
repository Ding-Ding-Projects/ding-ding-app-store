import { useCallback, useEffect, useState } from 'react';
import type {
  SchoolModeConfigureRequest,
  SchoolModeMutationResult,
  SchoolModeRenameRequest,
  SchoolModeState,
  SchoolModeToggleRequest,
  SchoolModeVerifyRequest,
} from '../../shared/contracts';
import type { Notify } from '../notify';

export const DEFAULT_SCHOOL_MODE: SchoolModeState = {
  schemaVersion: 1,
  enabled: false,
  displayName: 'School mode',
  unlockKind: null,
};

export interface SchoolModeApi {
  state: SchoolModeState;
  loading: boolean;
  reload(): Promise<void>;
  configure(request: SchoolModeConfigureRequest): Promise<SchoolModeMutationResult>;
  rename(request: SchoolModeRenameRequest): Promise<SchoolModeMutationResult>;
  setEnabled(request: SchoolModeToggleRequest): Promise<SchoolModeMutationResult>;
  verify(request: SchoolModeVerifyRequest): Promise<boolean>;
}

export function useSchoolMode(notify: Notify): SchoolModeApi {
  const [state, setState] = useState(DEFAULT_SCHOOL_MODE);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setState(await window.dingDingStore.schoolMode.load()); }
    catch (error) { notify({ ok: false, message: `School mode could not be loaded: ${(error as Error).message}` }); }
    finally { setLoading(false); }
  }, [notify]);
  useEffect(() => { void reload(); }, [reload]);

  const apply = useCallback(async (operation: () => Promise<SchoolModeMutationResult>) => {
    try {
      const result = await operation();
      setState(result.state);
      notify({ ok: result.ok, message: result.message });
      return result;
    } catch (error) {
      const message = (error as Error).message;
      notify({ ok: false, message });
      return { ok: false, state, message };
    }
  }, [notify, state]);

  const configure = useCallback((request: SchoolModeConfigureRequest) => apply(() => window.dingDingStore.schoolMode.configure(request)), [apply]);
  const rename = useCallback((request: SchoolModeRenameRequest) => apply(() => window.dingDingStore.schoolMode.rename(request)), [apply]);
  const setEnabled = useCallback((request: SchoolModeToggleRequest) => apply(() => window.dingDingStore.schoolMode.setEnabled(request)), [apply]);
  const verify = useCallback((request: SchoolModeVerifyRequest) => window.dingDingStore.schoolMode.verify(request), []);
  return { state, loading, reload, configure, rename, setEnabled, verify };
}
