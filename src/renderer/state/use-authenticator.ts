import { useCallback, useEffect, useState } from 'react';
import type { AuthenticatorListResult, AuthenticatorMutationResult, AuthenticatorPreviewRequest, AuthenticatorPreviewResult, AuthenticatorRegistrationConfirmRequest, AuthenticatorRegistrationPreviewResult, AuthenticatorRegistrationRequest, AuthenticatorStatus } from '../../shared/contracts';

export interface AuthenticatorApi {
  status: AuthenticatorStatus | null;
  loading: boolean;
  preview(request: AuthenticatorPreviewRequest): Promise<AuthenticatorPreviewResult>;
  entries: AuthenticatorListResult['entries'];
  listLoading: boolean;
  refresh(): Promise<AuthenticatorListResult>;
  prepare(request: AuthenticatorRegistrationRequest): Promise<AuthenticatorRegistrationPreviewResult>;
  confirm(request: AuthenticatorRegistrationConfirmRequest): Promise<AuthenticatorMutationResult>;
  cancel(registrationId: string): Promise<void>;
}

export function useAuthenticator(enabled = true): AuthenticatorApi {
  const [status, setStatus] = useState<AuthenticatorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AuthenticatorListResult['entries']>([]);
  const [listLoading, setListLoading] = useState(false);
  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      setEntries([]);
      setLoading(false);
      return;
    }
    let active = true;
    void window.dingDingStore.authenticator.status().then((value) => { if (active) { setStatus(value); setLoading(false); } }, () => {
      if (active) { setStatus(null); setLoading(false); }
    });
    void window.dingDingStore.authenticator.list().then((value) => { if (active) setEntries(value.entries); }, () => { if (active) setEntries([]); });
    return () => { active = false; };
  }, [enabled]);
  const preview = useCallback(async (request: AuthenticatorPreviewRequest) => {
    try {
      return await window.dingDingStore.authenticator.preview(request);
    } catch {
      const result: AuthenticatorPreviewResult = {
        ok: false,
        storage: 'memory-only',
        message: 'Authenticator preview is unavailable.',
        messageYue: 'Authenticator 預覽暫時用唔到。',
      };
      return result;
    }
  }, []);
  const refresh = useCallback(async () => {
    setListLoading(true);
    try {
      const value = await window.dingDingStore.authenticator.list();
      setEntries(value.entries);
      return value;
    } finally {
      setListLoading(false);
    }
  }, []);
  const prepare = useCallback((request: AuthenticatorRegistrationRequest) => window.dingDingStore.authenticator.prepare(request), []);
  const cancel = useCallback((registrationId: string) => window.dingDingStore.authenticator.cancel(registrationId), []);
  const confirm = useCallback(async (request: AuthenticatorRegistrationConfirmRequest) => {
    const value = await window.dingDingStore.authenticator.confirm(request);
    if (value.ok) await refresh();
    return value;
  }, [refresh]);
  return { status, loading, preview, entries, listLoading, refresh, prepare, confirm, cancel };
}
