import { useCallback, useEffect, useState } from 'react';
import type { AuthenticatorPreviewRequest, AuthenticatorPreviewResult, AuthenticatorStatus } from '../../shared/contracts';

export interface AuthenticatorApi {
  status: AuthenticatorStatus | null;
  loading: boolean;
  preview(request: AuthenticatorPreviewRequest): Promise<AuthenticatorPreviewResult>;
}

export function useAuthenticator(enabled = true): AuthenticatorApi {
  const [status, setStatus] = useState<AuthenticatorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      setLoading(false);
      return;
    }
    let active = true;
    void window.dingDingStore.authenticator.status().then((value) => { if (active) { setStatus(value); setLoading(false); } }, () => {
      if (active) { setStatus(null); setLoading(false); }
    });
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
  return { status, loading, preview };
}
