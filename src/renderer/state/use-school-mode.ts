import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SchoolModeConfigureRequest,
  SchoolModeCredentialChangeRequest,
  SchoolModeMutationCode,
  SchoolModeMutationResult,
  SchoolModeRenameRequest,
  SchoolModeSnapshot,
  SchoolModeState,
  SchoolModeToggleRequest,
  SchoolModeVerifyRequest,
  UserSettings,
} from '../../shared/contracts';
import { label } from '../i18n';
import type { Notify } from '../notify';

export const DEFAULT_SCHOOL_MODE: SchoolModeState = {
  schemaVersion: 2,
  recordId: null,
  revision: 0,
  enabled: false,
  // A cold unreadable state must not reveal the shipped name after the user
  // may already have renamed the shared control in another app.
  displayName: 'Shared mode',
  unlockKind: null,
};

const UNKNOWN_SNAPSHOT: SchoolModeSnapshot = {
  schemaVersion: 1,
  observationSequence: 0,
  state: null,
  configured: false,
  sync: { status: 'unavailable', watching: false, reason: 'read-failed' },
};

export interface SchoolModeObservationProjection {
  snapshot: SchoolModeSnapshot | null;
  observationSequence: number;
  loading: boolean;
  bridgeUnavailable: boolean;
}

/** Pure ordering seam used by the hook and its runtime contract tests. */
export function projectSchoolModeObservation(
  current: SchoolModeObservationProjection,
  next: SchoolModeSnapshot,
): SchoolModeObservationProjection {
  if (next.observationSequence < current.observationSequence) return current;
  return { snapshot: next, observationSequence: next.observationSequence, loading: false, bridgeUnavailable: false };
}

export function schoolModeSnapshotIsAvailable(snapshot: SchoolModeSnapshot | null): boolean {
  return Boolean(snapshot?.state && snapshot.sync.status === 'ready' && snapshot.sync.watching);
}

export function schoolModeMutationMessage(code: SchoolModeMutationCode, displayName: string, settings: UserSettings, restricted: boolean): string {
  const activeSettings = restricted && settings.language !== 'en' ? { ...settings, language: 'en' as const } : settings;
  switch (code) {
    case 'invalid-configure': return label(activeSettings, `Choose a valid name and local PIN or password before enabling ${displayName}.`, `開啟 ${displayName} 之前，請揀有效名稱同本機 PIN 或密碼。`);
    case 'invalid-name': return label(activeSettings, 'Choose a non-empty shared mode name of at most 64 characters.', '請揀一個唔可以留空、最多 64 個字元嘅共用模式名稱。');
    case 'invalid-toggle': return label(activeSettings, `The ${displayName} change request was invalid. Reload and try again.`, `${displayName} 變更要求無效；重新載入再試。`);
    case 'invalid-credential-change': return label(activeSettings, `Enter the current ${displayName} credential and a valid new PIN or password.`, `請輸入目前 ${displayName} 憑證，同有效嘅新 PIN 或密碼。`);
    case 'invalid-pin': return label(activeSettings, 'A PIN must contain 4 to 64 digits and no other characters.', 'PIN 必須有 4 至 64 個數字，唔可以有其他字元。');
    case 'invalid-password': return label(activeSettings, 'A password must contain 4 to 512 characters.', '密碼必須有 4 至 512 個字元。');
    case 'already-configured': return label(activeSettings, `${displayName} is already configured. Use Change credential to replace its unlock record.`, `${displayName} 已經設定好；用「更改憑證」先可以換解鎖記錄。`);
    case 'configured': return label(activeSettings, `${displayName} is enabled and its local unlock verifier is configured.`, `${displayName} 已開啟，本機解鎖驗證亦已設定。`);
    case 'credential-rejected': return label(activeSettings, `The ${displayName} credential was not accepted. Nothing was changed.`, `${displayName} 憑證唔啱，冇改到任何嘢。`);
    case 'name-unchanged': return label(activeSettings, `${displayName} already uses that display name.`, `${displayName} 已經用緊呢個顯示名稱。`);
    case 'name-saved': return label(activeSettings, `${displayName} display name saved.`, `${displayName} 顯示名稱已儲存。`);
    case 'not-configured': return label(activeSettings, `Configure a local PIN or password for ${displayName} before changing it.`, `更改 ${displayName} 之前，請先設定本機 PIN 或密碼。`);
    case 'passkey-unsupported': return label(activeSettings, `${displayName} uses an unsupported preview passkey record. Reset the shared record before configuring a PIN or password.`, `${displayName} 用緊未支援嘅預覽 passkey 記錄；重設共用記錄之後先設定 PIN 或密碼。`);
    case 'already-enabled': return label(activeSettings, `${displayName} is already enabled.`, `${displayName} 已經開啟。`);
    case 'already-disabled': return label(activeSettings, `${displayName} is already disabled.`, `${displayName} 已經關閉。`);
    case 'enabled': return label(activeSettings, `${displayName} is enabled.`, `${displayName} 已開啟。`);
    case 'disabled': return label(activeSettings, `${displayName} is disabled. The previous language and voice choices are available again.`, `${displayName} 已關閉；之前嘅語言同語氣選擇返晒嚟。`);
    case 'credential-changed-pin': return label(activeSettings, `${displayName} now uses the new local PIN.`, `${displayName} 而家用新嘅本機 PIN。`);
    case 'credential-changed-password': return label(activeSettings, `${displayName} now uses the new local password.`, `${displayName} 而家用新嘅本機密碼。`);
    case 'read-failed': return label(activeSettings, 'The shared record could not be read. The last verified state was kept and restricted presentation remains active.', '讀唔到共用記錄；已保留最後驗證狀態，限制顯示會繼續開住。');
    case 'parse-failed': return label(activeSettings, 'The shared record is malformed or unsupported. It was left unchanged and restricted presentation remains active.', '共用記錄格式損壞或者未支援；記錄冇被改動，限制顯示會繼續開住。');
    case 'write-failed': return label(activeSettings, 'The shared mode change could not be saved. The previously verified shared state was kept.', '共用模式變更儲存唔到；已保留之前驗證過嘅共用狀態。');
    case 'conflict': return label(activeSettings, 'Another running app changed or reset the shared record first. Reload before retrying.', '另一個運行中 app 搶先更改或重設咗共用記錄；重新載入先再試。');
    case 'service-closed': return label(activeSettings, 'This shared-state service is closed. Restart the app before making another change.', '共用狀態服務已關閉；重新啟動 app 先再更改。');
    case 'revision-exhausted': return label(activeSettings, 'The shared record cannot accept another revision. Reset it intentionally before making another change.', '共用記錄已經加唔到新修訂；要再更改，請先有意重設記錄。');
    case 'state-unavailable': return label(activeSettings, 'The shared mode state is unavailable. Reload it before making a change.', '共用模式狀態暫時用唔到；重新載入先再更改。');
    case 'bridge-failed': return label(activeSettings, 'The shared mode change could not be completed. The last verified shared state was kept.', '共用模式變更完成唔到；已保留最後驗證過嘅共用狀態。');
  }
}

type ExpectedFields = 'expectedRecordId' | 'expectedRevision';
export type SchoolModeConfigureInput = Omit<SchoolModeConfigureRequest, ExpectedFields>;
export type SchoolModeRenameInput = Omit<SchoolModeRenameRequest, ExpectedFields>;
export type SchoolModeToggleInput = Omit<SchoolModeToggleRequest, ExpectedFields>;
export type SchoolModeCredentialChangeInput = Omit<SchoolModeCredentialChangeRequest, ExpectedFields>;

export interface SchoolModeApi {
  snapshot: SchoolModeSnapshot | null;
  state: SchoolModeState;
  loading: boolean;
  available: boolean;
  restricted: boolean;
  reload(): Promise<void>;
  configure(request: SchoolModeConfigureInput): Promise<SchoolModeMutationResult>;
  rename(request: SchoolModeRenameInput): Promise<SchoolModeMutationResult>;
  setEnabled(request: SchoolModeToggleInput): Promise<SchoolModeMutationResult>;
  changeCredential(request: SchoolModeCredentialChangeInput): Promise<SchoolModeMutationResult>;
  verify(request: SchoolModeVerifyRequest): Promise<boolean>;
}

export function useSchoolMode(notify: Notify, settings: UserSettings): SchoolModeApi {
  const [snapshot, setSnapshot] = useState<SchoolModeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [bridgeUnavailable, setBridgeUnavailable] = useState(false);
  const sequence = useRef(-1);
  const latest = useRef<SchoolModeSnapshot | null>(null);

  const accept = useCallback((next: SchoolModeSnapshot) => {
    const projected = projectSchoolModeObservation({ snapshot: latest.current, observationSequence: sequence.current, loading: true, bridgeUnavailable: false }, next);
    if (projected.snapshot === latest.current && projected.observationSequence === sequence.current) return;
    sequence.current = projected.observationSequence;
    latest.current = projected.snapshot;
    setSnapshot(projected.snapshot);
    setBridgeUnavailable(projected.bridgeUnavailable);
    setLoading(projected.loading);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try { accept(await window.dingDingStore.schoolMode.load()); }
    catch {
      setLoading(false);
      setBridgeUnavailable(true);
      notify({ ok: false, message: schoolModeMutationMessage('bridge-failed', latest.current?.state?.displayName ?? DEFAULT_SCHOOL_MODE.displayName, settings, true), schoolModeCode: 'bridge-failed' });
    }
  }, [accept, notify, settings]);

  useEffect(() => {
    let active = true;
    // Subscribe before the initial request so a watcher event cannot be lost
    // between renderer startup and the IPC reply.
    const unavailable = () => {
      if (!active) return;
      setLoading(false);
      setBridgeUnavailable(true);
      notify({ ok: false, message: schoolModeMutationMessage('bridge-failed', latest.current?.state?.displayName ?? DEFAULT_SCHOOL_MODE.displayName, settings, true), schoolModeCode: 'bridge-failed' });
    };
    const unsubscribe = window.dingDingStore.schoolMode.subscribe((next) => { if (active) accept(next); }, unavailable);
    void window.dingDingStore.schoolMode.load().then((next) => { if (active) accept(next); }).catch(() => {
      if (!active) return;
      setLoading(false);
      setBridgeUnavailable(true);
      notify({ ok: false, message: schoolModeMutationMessage('bridge-failed', latest.current?.state?.displayName ?? DEFAULT_SCHOOL_MODE.displayName, settings, true), schoolModeCode: 'bridge-failed' });
    });
    return () => { active = false; unsubscribe(); };
  }, [accept, notify, settings]);

  const apply = useCallback(async (
    operation: (expected: { expectedRecordId: string | null; expectedRevision: number }) => Promise<SchoolModeMutationResult>,
  ): Promise<SchoolModeMutationResult> => {
    const current = latest.current;
    if (bridgeUnavailable || !current?.state || current.sync.status !== 'ready') {
      const unavailable = current ?? UNKNOWN_SNAPSHOT;
      const message = schoolModeMutationMessage('state-unavailable', unavailable.state?.displayName ?? DEFAULT_SCHOOL_MODE.displayName, settings, true);
      notify({ ok: false, message, schoolModeCode: 'state-unavailable' });
      return { ok: false, snapshot: unavailable, code: 'state-unavailable' };
    }
    try {
      const result = await operation({ expectedRecordId: current.state.recordId, expectedRevision: current.state.revision });
      accept(result.snapshot);
      const resultRestricted = result.snapshot.sync.status !== 'ready' || !result.snapshot.state || result.snapshot.state.enabled;
      notify({ ok: result.ok, message: schoolModeMutationMessage(result.code, result.snapshot.state?.displayName ?? DEFAULT_SCHOOL_MODE.displayName, settings, resultRestricted), schoolModeCode: result.code });
      return result;
    } catch {
      setBridgeUnavailable(true);
      const fallback = latest.current ?? UNKNOWN_SNAPSHOT;
      const message = schoolModeMutationMessage('bridge-failed', fallback.state?.displayName ?? DEFAULT_SCHOOL_MODE.displayName, settings, true);
      notify({ ok: false, message, schoolModeCode: 'bridge-failed' });
      return { ok: false, snapshot: fallback, code: 'bridge-failed' };
    }
  }, [accept, bridgeUnavailable, notify, settings]);

  const configure = useCallback((request: SchoolModeConfigureInput) => apply((expected) => window.dingDingStore.schoolMode.configure({ ...request, ...expected })), [apply]);
  const rename = useCallback((request: SchoolModeRenameInput) => apply((expected) => window.dingDingStore.schoolMode.rename({ ...request, ...expected })), [apply]);
  const setEnabled = useCallback((request: SchoolModeToggleInput) => apply((expected) => window.dingDingStore.schoolMode.setEnabled({ ...request, ...expected })), [apply]);
  const changeCredential = useCallback((request: SchoolModeCredentialChangeInput) => apply((expected) => window.dingDingStore.schoolMode.changeCredential({ ...request, ...expected })), [apply]);
  const verify = useCallback(async (request: SchoolModeVerifyRequest) => {
    try { return await window.dingDingStore.schoolMode.verify(request); }
    catch { return false; }
  }, []);

  const visibleSnapshot = bridgeUnavailable
    ? { ...(snapshot ?? UNKNOWN_SNAPSHOT), sync: { status: 'unavailable' as const, watching: false, reason: 'bridge-failed' as const } }
    : snapshot;
  const state = visibleSnapshot?.state ?? DEFAULT_SCHOOL_MODE;
  const available = Boolean(!bridgeUnavailable && schoolModeSnapshotIsAvailable(visibleSnapshot));
  const restricted = loading || !available || state.enabled;
  return useMemo(() => ({ snapshot: visibleSnapshot, state, loading, available, restricted, reload, configure, rename, setEnabled, changeCredential, verify }), [visibleSnapshot, state, loading, available, restricted, reload, configure, rename, setEnabled, changeCredential, verify]);
}
