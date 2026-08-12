import { useCallback, useEffect, useState } from 'react';
import type { SupportState, SupportTicketCreateRequest, SupportTicketBulkAdvanceRequest, SupportTicketBulkAdvanceResult, SupportTicketMutationResult } from '../../shared/contracts';
import type { Notify } from '../notify';

export const EMPTY_SUPPORT_STATE: SupportState = {
  schemaVersion: 1,
  tickets: [],
  recoveryPath: '',
  disclosure: 'Nothing is sent anywhere. No ticket exists outside this machine, no network request is made, no data is collected, and nobody is reading it.',
};

export interface SupportApi {
  state: SupportState;
  loading: boolean;
  reload(): Promise<void>;
  create(request: SupportTicketCreateRequest): Promise<SupportTicketMutationResult>;
  advance(ticketId: string): Promise<SupportTicketMutationResult>;
  bulkAdvance(request: SupportTicketBulkAdvanceRequest): Promise<SupportTicketBulkAdvanceResult>;
  openRecoveryFolder(): Promise<{ ok: boolean; path: string; message: string }>;
}
export function useSupport(notify: Notify): SupportApi {
  const [state, setState] = useState<SupportState>(EMPTY_SUPPORT_STATE);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { setState(await window.dingDingStore.support.load()); }
    catch (error) { notify({ ok: false, message: `Support Tickets could not be loaded: ${(error as Error).message}` }); }
    finally { setLoading(false); }
  }, [notify]);
  useEffect(() => { void reload(); }, [reload]);
  const apply = useCallback(async (operation: () => Promise<SupportTicketMutationResult>) => {
    try {
      const result = await operation();
      setState(result.state);
      notify({ ok: result.ok, message: result.message });
      return result;
    } catch (error) {
      const message = (error as Error).message;
      notify({ ok: false, message });
      return { ok: false, state, message, reason: 'storage-failed' as const };
    }
  }, [notify, state]);
  const create = useCallback((request: SupportTicketCreateRequest) => apply(() => window.dingDingStore.support.create(request)), [apply]);
  const advance = useCallback((ticketId: string) => apply(() => window.dingDingStore.support.advance(ticketId)), [apply]);
  const bulkAdvance = useCallback(async (request: SupportTicketBulkAdvanceRequest) => {
    try { const result = await window.dingDingStore.support.bulkAdvance(request); setState(result.state); notify({ ok: result.ok, message: result.message }); return result; }
    catch (error) { const message = (error as Error).message; notify({ ok: false, message }); return { ok: false, state, message, committed: [], skipped: [], uncertain: [], reason: 'storage-failed' as const }; }
  }, [notify, state]);
  const openRecoveryFolder = useCallback(() => window.dingDingStore.support.openRecoveryFolder().then((result) => {
    notify({ ok: result.ok, message: result.message });
    return result;
  }).catch((error) => {
    const message = (error as Error).message;
    notify({ ok: false, message });
    return { ok: false, path: state.recoveryPath, message };
  }), [notify, state.recoveryPath]);
  return { state, loading, reload, create, advance, bulkAdvance, openRecoveryFolder };
}
