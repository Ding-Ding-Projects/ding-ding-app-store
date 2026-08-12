import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuthenticatorBulkDeleteRequest, AuthenticatorBulkDeleteResult, AuthenticatorDeleteRequest, AuthenticatorDeleteResult, AuthenticatorExportRequest, AuthenticatorExportResult, AuthenticatorSecretExportRequest, AuthenticatorSecretExportResult, AuthenticatorGroupBulkMoveRequest, AuthenticatorGroupCollapseRequest, AuthenticatorGroupCreateRequest, AuthenticatorGroupDeleteRequest, AuthenticatorGroupMutationResult, AuthenticatorGroupRenameRequest, AuthenticatorGroupReorderRequest, AuthenticatorGroupRequest, AuthenticatorListResult, AuthenticatorMutationResult, AuthenticatorPreviewRequest, AuthenticatorPreviewResult, AuthenticatorRegistrationConfirmRequest, AuthenticatorRegistrationPreviewResult, AuthenticatorRegistrationRequest, AuthenticatorRenameRequest, AuthenticatorReorderRequest, AuthenticatorStatus } from '../../shared/contracts';

export interface AuthenticatorApi {
  status: AuthenticatorStatus | null;
  loading: boolean;
  preview(request: AuthenticatorPreviewRequest): Promise<AuthenticatorPreviewResult>;
  entries: AuthenticatorListResult['entries'];
  groups: AuthenticatorListResult['groups'];
  listLoading: boolean;
  refresh(): Promise<AuthenticatorListResult>;
  prepare(request: AuthenticatorRegistrationRequest): Promise<AuthenticatorRegistrationPreviewResult>;
  cancelAttempt(attemptId: string): Promise<void>;
  confirm(request: AuthenticatorRegistrationConfirmRequest): Promise<AuthenticatorMutationResult>;
  cancel(registrationId: string): Promise<void>;
  rename(request: AuthenticatorRenameRequest): Promise<AuthenticatorMutationResult>;
  setGroup(request: AuthenticatorGroupRequest): Promise<AuthenticatorMutationResult>;
  reorder(request: AuthenticatorReorderRequest): Promise<AuthenticatorMutationResult>;
  remove(request: AuthenticatorDeleteRequest): Promise<AuthenticatorDeleteResult>;
  bulkRemove(request: AuthenticatorBulkDeleteRequest): Promise<AuthenticatorBulkDeleteResult>;
  export(request: AuthenticatorExportRequest): Promise<AuthenticatorExportResult>;
  secretExport(request: AuthenticatorSecretExportRequest): Promise<AuthenticatorSecretExportResult>;
  createGroup(request: AuthenticatorGroupCreateRequest): Promise<AuthenticatorGroupMutationResult>;
  renameGroup(request: AuthenticatorGroupRenameRequest): Promise<AuthenticatorGroupMutationResult>;
  reorderGroup(request: AuthenticatorGroupReorderRequest): Promise<AuthenticatorGroupMutationResult>;
  collapseGroup(request: AuthenticatorGroupCollapseRequest): Promise<AuthenticatorGroupMutationResult>;
  deleteGroup(request: AuthenticatorGroupDeleteRequest): Promise<AuthenticatorGroupMutationResult>;
  moveToGroup(request: AuthenticatorGroupBulkMoveRequest): Promise<{ ok: boolean; movedIds: string[]; skippedIds: string[]; message: string; messageYue: string }>;
}

/**
 * Reconcile a confirmation rejection before the renderer tells the user what
 * happened. A main-process save can finish before IPC/parser failure, so the
 * list refresh is deliberately attempted for every typed result and rejection.
 */
export async function confirmAuthenticatorWithRefresh(
  confirm: () => Promise<AuthenticatorMutationResult>,
  refresh: () => Promise<unknown>,
): Promise<AuthenticatorMutationResult> {
  try {
    const value = await confirm();
    // A typed false result can still describe a committed/uncertain vault
    // publication (for example a School-mode rollback fence). Reconcile every
    // response before the page decides whether another retry is safe.
    try { await refresh(); } catch { /* keep the typed mutation result truthful */ }
    return value;
  } catch (error) {
    try { await refresh(); } catch { /* retain the original typed rejection */ }
    throw error;
  }
}

export function useAuthenticator(enabled = true): AuthenticatorApi {
  const [status, setStatus] = useState<AuthenticatorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AuthenticatorListResult['entries']>([]);
  const [groups, setGroups] = useState<AuthenticatorListResult['groups']>([]);
  const [listLoading, setListLoading] = useState(false);
  const refreshGeneration = useRef(0);
  useEffect(() => {
    if (!enabled) {
      setStatus(null);
      setEntries([]); setGroups([]);
      setLoading(false);
      return;
    }
    let active = true;
    const requestGeneration = ++refreshGeneration.current;
    void window.dingDingStore.authenticator.status().then((value) => { if (active) { setStatus(value); setLoading(false); } }, () => {
      if (active) { setStatus(null); setLoading(false); }
    });
    void window.dingDingStore.authenticator.list().then((value) => { if (active && requestGeneration === refreshGeneration.current) { setEntries(value.entries); setGroups(value.groups); } }, () => { if (active && requestGeneration === refreshGeneration.current) { setEntries([]); setGroups([]); } });
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
    const requestGeneration = ++refreshGeneration.current;
    setListLoading(true);
    try {
      const value = await window.dingDingStore.authenticator.list();
      if (requestGeneration === refreshGeneration.current) { setEntries(value.entries); setGroups(value.groups); }
      return value;
    } finally {
      if (requestGeneration === refreshGeneration.current) setListLoading(false);
    }
  }, []);
  const prepare = useCallback(async (request: AuthenticatorRegistrationRequest) => {
    try {
      return await window.dingDingStore.authenticator.prepare(request);
    } catch (error) {
      // A lost response can leave a one-shot pending secret in main memory. The
      // renderer-owned attempt id gives the bridge a bounded cleanup route
      // without ever returning the registration id or secret.
      if (request.attemptId) {
        try { await window.dingDingStore.authenticator.cancelAttempt(request.attemptId); } catch { /* transport may be the reason prepare failed */ }
      }
      throw error;
    }
  }, []);
  const cancelAttempt = useCallback((attemptId: string) => window.dingDingStore.authenticator.cancelAttempt(attemptId), []);
  const cancel = useCallback((registrationId: string) => window.dingDingStore.authenticator.cancel(registrationId), []);
  const confirm = useCallback((request: AuthenticatorRegistrationConfirmRequest) => confirmAuthenticatorWithRefresh(() => window.dingDingStore.authenticator.confirm(request), refresh), [refresh]);
  const rename = useCallback(async (request: AuthenticatorRenameRequest) => { const value = await window.dingDingStore.authenticator.rename(request); if (value.ok) await refresh(); return value; }, [refresh]);
  const setGroup = useCallback(async (request: AuthenticatorGroupRequest) => { const value = await window.dingDingStore.authenticator.setGroup(request); if (value.ok) await refresh(); return value; }, [refresh]);
  const reorder = useCallback(async (request: AuthenticatorReorderRequest) => { const value = await window.dingDingStore.authenticator.reorder(request); if (value.ok) await refresh(); return value; }, [refresh]);
  const remove = useCallback(async (request: AuthenticatorDeleteRequest) => { const value = await window.dingDingStore.authenticator.remove(request); if (value.ok || value.deletedId || value.uncertain) await refresh(); return value; }, [refresh]);
  const bulkRemove = useCallback(async (request: AuthenticatorBulkDeleteRequest) => { const value = await window.dingDingStore.authenticator.bulkRemove(request); if (value.deletedIds.length || value.uncertainIds.length) await refresh(); return value; }, [refresh]);
  const exportMetadata = useCallback((request: AuthenticatorExportRequest) => window.dingDingStore.authenticator.export(request), []);
  const secretExport = useCallback((request: AuthenticatorSecretExportRequest) => window.dingDingStore.authenticator.secretExport(request), []);
  const createGroup = useCallback((request: AuthenticatorGroupCreateRequest) => window.dingDingStore.authenticator.createGroup(request).then(async (value) => { if (value.ok) await refresh(); return value; }), [refresh]);
  const renameGroup = useCallback((request: AuthenticatorGroupRenameRequest) => window.dingDingStore.authenticator.renameGroup(request).then(async (value) => { if (value.ok) await refresh(); return value; }), [refresh]);
  const reorderGroup = useCallback((request: AuthenticatorGroupReorderRequest) => window.dingDingStore.authenticator.reorderGroup(request).then(async (value) => { if (value.ok) await refresh(); return value; }), [refresh]);
  const collapseGroup = useCallback((request: AuthenticatorGroupCollapseRequest) => window.dingDingStore.authenticator.collapseGroup(request).then(async (value) => { if (value.ok) await refresh(); return value; }), [refresh]);
  const deleteGroup = useCallback((request: AuthenticatorGroupDeleteRequest) => window.dingDingStore.authenticator.deleteGroup(request).then(async (value) => { if (value.ok) await refresh(); return value; }), [refresh]);
  const moveToGroup = useCallback((request: AuthenticatorGroupBulkMoveRequest) => window.dingDingStore.authenticator.moveToGroup(request).then(async (value) => { if (value.movedIds.length) await refresh(); return value; }), [refresh]);
  return { status, loading, preview, entries, groups, listLoading, refresh, prepare, cancelAttempt, confirm, cancel, rename, setGroup, reorder, remove, bulkRemove, export: exportMetadata, secretExport, createGroup, renameGroup, reorderGroup, collapseGroup, deleteGroup, moveToGroup };
}
