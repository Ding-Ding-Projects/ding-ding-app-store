import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SCHEDULE, TAB_GROUP_COLORS } from '../shared/contracts';
import type {
  AppStoreUpdateState,
  CatalogApp,
  CatalogSnapshot,
  ElementKey,
  HistoryEntry,
  HistoryRevision,
  InstalledAppRecord,
  ManagedUpdateState,
  OperationProgressEvent,
  SourceTerminalEvent,
  SourceIsolationStatus,
  TabGroup,
  TabGroupColor,
  TabId,
  TabRailLayout,
  TokenId,
  UserSettings,
  DimSumSurprise,
  LockTarget,
} from '../shared/contracts';
import { resolveScheduledSettings } from '../shared/scheduled-settings';
import { applySchoolModePresentation, schoolModeAllowsHistoryEntry, schoolModeAllowsNotification, schoolModeDisplayText, schoolModeHiddenApp, schoolModeHiddenContent, schoolModeProjectManagedUpdates, schoolModeRestrictedText } from '../shared/school-mode';
import { ActionDialog } from './components/ActionDialog';
import type { ActionKind, ImmediateActionKind } from './components/ActionDialog';
import { AppearancePanel } from './components/AppearancePanel';
import { CommandPalette } from './components/CommandPalette';
import { NotificationCenter } from './components/NotificationCenter';
import { SnackbarStack } from './components/SnackbarStack';
import { SourceTerminalPanel } from './components/SourceTerminalPanel';
import { SourceIsolationStatusCard } from './components/SourceIsolationStatusCard';
import { TabRail } from './components/TabRail';
import { el } from './el';
import { downloadText, pickTextFile } from './files';
import { Icon } from './icons';
import { formatAbsolute, label, setPersonalVocabulary } from './i18n';
import { AppsPage } from './pages/AppsPage';
import type { RunningAction } from './pages/AppsPage';
import { ActivityPage } from './pages/ActivityPage';
import { AuthenticatorPage } from './pages/AuthenticatorPage';
import { DocsPage } from './pages/DocsPage';
import { SettingsPage } from './pages/SettingsPage';
import { buildRegistry, SETTING_FIELDS, TAB_META } from './registry';
import type { Action, EntryTarget, SettingsSubTabId, TokenValue } from './registry';
import { SearchContext, useSearchStates } from './search';
import type { SurfaceId } from './search';
import { useAppearance, useAppearanceVars } from './state/use-appearance';
import { useSchedule } from './state/use-schedule';
import { useSettings } from './state/use-settings';
import { schoolModeMutationMessage, useSchoolMode } from './state/use-school-mode';
import { useAuthenticator } from './state/use-authenticator';
import { useLocks } from './state/use-locks';
import { useSupport } from './state/use-support';
import { useNotifications } from './state/use-notifications';
import { useNarrator } from './state/use-narrator';
import { newGroupId, orderedTabIds, useWorkspace } from './state/use-workspace';
import type { Notice, RecoveryAction } from './notify';
import { openExportInVsCode } from './external-editor';

const PAGE_SUBTITLE: Partial<Record<TabId, { en: string; yue: string }>> = {
  catalog: { en: 'Trusted apps, their releases, and their complete documentation in one place.', yue: '可信 apps、release 同完整文件，一個位睇晒。' },
  updates: { en: 'Check every installed app and the store itself without surprise restarts.', yue: '檢查所有已安裝 app 同商店自己，唔會突然重開。' },
  authenticator: { en: 'Pair local TOTP entries with a credential-vault boundary and live codes.', yue: '喺憑證庫邊界配對本機 TOTP 項目，同埋睇即時驗證碼。' },
  activity: { en: 'Every install, build, and uninstall you ran, with exact results and export.', yue: '你做過嘅安裝、build 同解除安裝，連結果同匯出都齊。' },
  docs: { en: 'Every shipped feature has an offline article, including tabs, appearance, and the schedule.', yue: '每個功能都有離線文章，分頁、外觀同排程都有。' },
  settings: { en: 'Every section has its own search, its own tab navigation, and its own reset.', yue: '每個分類都有自己嘅搜尋、分頁同重設。' },
};

export function App() {
  const notifications = useNotifications();
  const notify = notifications.notify;

  const { settings: baseSettings, provenance: settingsProvenance, reload: reloadSettings, save: saveSettings, patch: patchSetting } = useSettings(notify);
  const schoolMode = useSchoolMode(notify, baseSettings);
  useEffect(() => {
    const loadVocabulary = () => void window.dingDingStore.personalVocabulary.status().then((status) => setPersonalVocabulary(status.entries, schoolMode.restricted)).catch(() => setPersonalVocabulary([], schoolMode.restricted));
    loadVocabulary();
    window.addEventListener('personal-vocabulary-changed', loadVocabulary);
    return () => window.removeEventListener('personal-vocabulary-changed', loadVocabulary);
  }, [schoolMode.restricted]);
  const authenticator = useAuthenticator(!schoolMode.loading && !schoolMode.restricted);
  const locks = useLocks(notify);
  const support = useSupport(notify);
  const workspace = useWorkspace(notify);
  const appearance = useAppearance(notify);
  const schedule = useSchedule(notify);
  const [scheduleClock, setScheduleClock] = useState(0);
  useEffect(() => {
    const handle = window.setTimeout(() => setScheduleClock((value) => value + 1), 30_000);
    return () => window.clearTimeout(handle);
  }, [scheduleClock]);
  const externalOverrides = useMemo(() => Object.fromEntries((schedule.status?.externalSources ?? [])
    .filter((source) => source.state === 'active' && source.values)
    .map((source) => [source.ruleId, source.values!])), [schedule.status?.externalSources]);
  const settings = useMemo(() => {
    const resolved = resolveScheduledSettings(baseSettings, schedule.draft, new Date(), externalOverrides);
    // School mode is an explicit presentation lock. The user's base language
    // and funny-level choices remain untouched and return when it is disabled.
    return applySchoolModePresentation(resolved, schoolMode.restricted);
  }, [baseSettings, schedule.draft, scheduleClock, externalOverrides, schoolMode.restricted]);
  const schoolProjectionRef = useRef({ restricted: schoolMode.restricted, displayName: schoolMode.state.displayName });
  schoolProjectionRef.current = { restricted: schoolMode.restricted, displayName: schoolMode.state.displayName };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const projectRuntimeText = useCallback((value: string, fallbackEn = 'Operation details unavailable while restricted.', fallbackYue = '限制時操作資料未提供.') => {
    const current = schoolProjectionRef.current;
    if (!current.restricted) return schoolModeDisplayText(value, current.displayName);
    return schoolModeRestrictedText(value, current.displayName, label(settingsRef.current, fallbackEn, fallbackYue));
  }, []);
  const projectRuntimeAppName = useCallback((appId: string, name: string) => schoolProjectionRef.current.restricted || schoolModeHiddenApp(appId)
    ? label(settingsRef.current, 'Application', '應用程式')
    : name, []);
  const visibleNotificationRecords = useMemo(() => notifications.records
    .filter((record) => schoolModeAllowsNotification(record, schoolMode.restricted))
    .filter((record) => !schoolMode.restricted || !schoolModeHiddenContent(JSON.stringify(record)))
    .map((record) => ({
      ...record,
      title: schoolModeDisplayText(record.title, schoolMode.state.displayName),
      message: record.schoolModeCode
        ? schoolModeMutationMessage(record.schoolModeCode, schoolMode.state.displayName, settings, schoolMode.restricted)
        : schoolModeDisplayText(record.message, schoolMode.state.displayName),
    })), [notifications.records, schoolMode.restricted, schoolMode.state.displayName, settings]);
  const visibleActiveNotices = useMemo(() => notifications.active
    .filter((record) => schoolModeAllowsNotification(record, schoolMode.restricted))
    .filter((record) => !schoolMode.restricted || !schoolModeHiddenContent(JSON.stringify(record)))
    .map((record) => ({
      ...record,
      title: schoolModeDisplayText(record.title, schoolMode.state.displayName),
      message: record.schoolModeCode
        ? schoolModeMutationMessage(record.schoolModeCode, schoolMode.state.displayName, settings, schoolMode.restricted)
        : schoolModeDisplayText(record.message, schoolMode.state.displayName),
      undo: record.undo ? { ...record.undo, label: schoolModeDisplayText(record.undo.label, schoolMode.state.displayName) } : undefined,
    })), [notifications.active, schoolMode.restricted, schoolMode.state.displayName, settings]);
  const visibleUnreadCount = useMemo(() => visibleNotificationRecords.filter((record) => record.dismissedAt === null).length, [visibleNotificationRecords]);
  useNarrator(settings, schedule.draft, visibleActiveNotices);
  const search = useSearchStates();
  useAppearanceVars(appearance.elements);

  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyRevisions, setHistoryRevisions] = useState<HistoryRevision[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [installed, setInstalled] = useState<InstalledAppRecord[]>([]);
  const [action, setAction] = useState<{ kind: 'uninstall'; apps: CatalogApp[]; returnFocus: HTMLButtonElement } | null>(null);
  const [runningAction, setRunningAction] = useState<RunningAction | null>(null);
  const [operationProgress, setOperationProgress] = useState<Record<string, OperationProgressEvent>>({});
  const latestOperationIds = useRef(new Map<string, string>());
  const cancellationFocusTargets = useRef(new Map<string, HTMLElement>());
  const [sourceTerminal, setSourceTerminal] = useState<{
    appId: string;
    appName: string;
    jobId: string | null;
    events: Readonly<SourceTerminalEvent>[];
    fallbackMessage?: string;
    returnFocus: HTMLButtonElement;
  } | null>(null);
  const [sourceIsolationStatus, setSourceIsolationStatus] = useState<SourceIsolationStatus | null>(null);
  const [sourceIsolationLoading, setSourceIsolationLoading] = useState(false);
  const operationRunningRef = useRef(false);
  const [updateState, setUpdateState] = useState<AppStoreUpdateState>({ status: 'idle' });
  const lastStoreFailure = useRef<string | null>(null);
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<string | null>(null);
  const [managedUpdates, setManagedUpdates] = useState<Record<string, ManagedUpdateState>>({});
  const managedChecks = useRef(new Set<string>());
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const appearanceReturnFocusRef = useRef<HTMLElement | null>(null);
  const [notificationCenterOpen, setNotificationCenterOpen] = useState(false);
  const notificationTriggerRef = useRef<HTMLButtonElement>(null);
  const [regexRequest, setRegexRequest] = useState<SurfaceId | null>(null);
  const [overflowRequest, setOverflowRequest] = useState(false);
  const [renameRequest, setRenameRequest] = useState<string | null>(null);
  const [lockTargetRequest, setLockTargetRequest] = useState<LockTarget | null>(null);
  const [subTab, setSubTab] = useState<SettingsSubTabId>('settings.general');
  const [settingsReloadKey, setSettingsReloadKey] = useState(0);
  const [docRequest, setDocRequest] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const safeFocusRef = useRef<HTMLElement>(null);
  const previousSchoolRestriction = useRef(schoolMode.restricted);
  const [pendingToken, setPendingToken] = useState<{ token: TokenId; value: TokenValue } | null>(null);
  const [dimSum, setDimSum] = useState<DimSumSurprise | null>(null);
  const dimSumAttempted = useRef(false);

  useEffect(() => {
    // Do not draw the opt-out-free surprise until the shared mode record has
    // loaded; a slow IPC response must not leak a dim-sum surface first.
    if (schoolMode.restricted) {
      dimSumAttempted.current = true;
      setDimSum(null);
      return;
    }
    if (dimSumAttempted.current || loading || !catalog || catalog.warning || ['available', 'downloading', 'ready', 'failed'].includes(updateState.status)) return;
    let cancelled = false;
    let firstRun = false;
    try {
      firstRun = window.localStorage.getItem('ding-ding-first-run-complete') !== '1';
      window.localStorage.setItem('ding-ding-first-run-complete', '1');
    } catch { firstRun = false; }
    if (firstRun) { dimSumAttempted.current = true; return; }
    const timer = window.setTimeout(() => {
      dimSumAttempted.current = true;
      if (Math.random() >= 0.1) return;
      void window.dingDingStore.dimSum.startup().then((result) => { if (!cancelled && result.available) setDimSum(result); });
    }, 6_000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [catalog, loading, schoolMode.restricted, updateState.status]);

  const activeTab = workspace.workspace.activeTabId;
  useEffect(() => {
    if (schoolMode.state.enabled && activeTab === 'authenticator') workspace.dispatch({ type: 'activate', id: 'catalog' });
  }, [activeTab, schoolMode.state.enabled, workspace]);
  const announce = useCallback((message: string) => setAnnouncement(message), []);

  useEffect(() => {
    const becameRestricted = !previousSchoolRestriction.current && schoolMode.restricted;
    previousSchoolRestriction.current = schoolMode.restricted;
    if (!becameRestricted) return;
    // ActionDialog is aria-modal and may contain an app title that cannot be
    // projected safely after a live restriction transition. Close every
    // mounted confirmation, then return focus to the stable main target.
    setAction(null);
    setDimSum(null);
    setPaletteOpen(false);
    announce(label(settings, `${schoolMode.state.displayName} restricted presentation is active.`, `${schoolMode.state.displayName} 限制顯示已開啟。`));
    window.setTimeout(() => safeFocusRef.current?.focus(), 0);
  }, [announce, schoolMode.restricted, schoolMode.state.displayName, settings]);
  const closeNotificationCenter = useCallback(() => {
    setNotificationCenterOpen(false);
    window.setTimeout(() => notificationTriggerRef.current?.focus(), 0);
  }, []);

  const loadCatalog = useCallback(async (refresh = false) => {
    setLoading(true);
    try {
      const snapshot = refresh ? await window.dingDingStore.catalog.refresh() : await window.dingDingStore.catalog.list();
      setCatalog(snapshot);
      if (snapshot.warning) notify({
        ok: false,
        message: projectRuntimeText(snapshot.warning, 'Catalog details unavailable while restricted.', '限制時目錄資料未提供。'),
        recovery: { kind: 'retry-catalog-refresh', run: () => loadCatalog(true) },
      });
    } catch (error) {
      notify({
        ok: false,
        message: projectRuntimeText((error as Error).message, 'Catalog details unavailable while restricted.', '限制時目錄資料未提供。'),
        recovery: { kind: 'retry-catalog-refresh', run: () => loadCatalog(true) },
      });
    }
    finally { setLoading(false); }
  }, [notify, projectRuntimeText]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const [entries, revisions] = await Promise.all([window.dingDingStore.history.list(), window.dingDingStore.history.revisions()]);
      setHistory(entries);
      setHistoryRevisions(revisions);
    }
    finally { setHistoryLoading(false); }
  }, []);

  const loadInstalled = useCallback(async (discover = true) => {
    try { setInstalled(await window.dingDingStore.operations.installed(discover)); }
    catch (error) { notify({ ok: false, message: projectRuntimeText((error as Error).message) }); }
  }, [notify, projectRuntimeText]);

  const reloadHistoryAndSettings = useCallback(async () => {
    await Promise.all([
      loadHistory(),
      // History restore writes the installed snapshot deliberately. Read it
      // back without registry discovery so the refresh cannot immediately
      // replace the restored bytes with the current machine projection.
      loadInstalled(false),
      // A protected history restore replaces authenticator metadata and
      // ciphertext in the main process. Refresh the renderer cache in the
      // same barrier instead of waiting for the page's periodic refresh.
      authenticator.refresh(),
      reloadSettings(),
      workspace.reload(),
      appearance.reload(),
      schedule.reload(),
    ]);
    setSettingsReloadKey((value) => value + 1);
  }, [appearance, authenticator, loadHistory, loadInstalled, reloadSettings, schedule, workspace]);

  const refreshSourceIsolation = useCallback(async () => {
    setSourceIsolationLoading(true);
    try {
      setSourceIsolationStatus(await window.dingDingStore.sourceJobs.status());
    } catch (error) {
      notify({ ok: false, message: projectRuntimeText((error as Error).message) });
    } finally {
      setSourceIsolationLoading(false);
    }
  }, [notify, projectRuntimeText]);

  useEffect(() => { void refreshSourceIsolation(); }, [refreshSourceIsolation]);

  const reportOperation = useCallback((result: { ok: boolean; message: string; messageYue?: string; operationId?: string }, recovery?: RecoveryAction) => {
    const message = schoolProjectionRef.current.restricted
      ? label(settingsRef.current, result.ok ? 'Operation completed.' : 'Operation could not be completed.', result.ok ? '操作完成。' : '操作未能完成。')
      : result.messageYue ? label(settingsRef.current, result.message, result.messageYue) : projectRuntimeText(result.message);
    notify({ ok: result.ok, message, operationId: result.operationId, recovery: result.ok ? undefined : recovery });
    announce(message);
    void loadHistory();
    void loadInstalled();
    if (result.ok) void loadCatalog(true);
  }, [announce, loadCatalog, loadHistory, loadInstalled, notify, projectRuntimeText]);

  const retryStoreUpdateCheck = useCallback(async () => {
    try {
      setUpdateState(await window.dingDingStore.updates.checkStore());
    } catch (error) {
      notify({
        ok: false,
        message: projectRuntimeText((error as Error).message, 'Update details unavailable while restricted.', '限制時更新資料未提供。'),
        recovery: { kind: 'retry-store-update-check', run: retryStoreUpdateCheck },
      });
    }
  }, [notify, projectRuntimeText]);

  useEffect(() => {
    if (updateState.status !== 'failed') return;
    const signature = `${updateState.message}\n${updateState.recoverable}`;
    if (lastStoreFailure.current === signature) return;
    lastStoreFailure.current = signature;
    notify({
      ok: false,
      message: projectRuntimeText(updateState.message, 'Update details unavailable while restricted.', '限制時更新資料未提供。'),
      recovery: updateState.recoverable ? { kind: 'retry-store-update-check', run: retryStoreUpdateCheck } : undefined,
    });
  }, [notify, projectRuntimeText, retryStoreUpdateCheck, updateState]);

  const handleManagedUpdate = useCallback(async (kind: 'download' | 'cancel' | 'restart', app: CatalogApp, trigger: HTMLButtonElement) => {
    try {
      if (kind === 'download') {
        const state = await window.dingDingStore.updates.downloadApp({ appId: app.id, decision: 'download-update' });
        setManagedUpdates((current) => ({ ...current, [app.id]: state }));
        const message = 'message' in state ? state.message : undefined;
        const appLabel = projectRuntimeAppName(app.id, app.name);
        const safeMessage = message ? projectRuntimeText(message, 'Update details unavailable while restricted.', '限制時更新資料未提供。') : undefined;
        announce(state.status === 'ready' ? `${appLabel} update is ready. Choose Restart to install update when the app is safe to restart.` : safeMessage ?? `${appLabel} update ${state.status}.`);
        notify({ ok: state.status === 'ready', message: state.status === 'ready' ? `${appLabel} is downloaded and verified. It will not install until you choose Restart to install update.` : safeMessage ?? `${appLabel} update ${state.status}.` });
      } else if (kind === 'cancel') {
        const state = await window.dingDingStore.updates.cancelApp({ appId: app.id, decision: 'cancel-update' });
        setManagedUpdates((current) => ({ ...current, [app.id]: state }));
        const appLabel = projectRuntimeAppName(app.id, app.name);
        const safeMessage = 'message' in state ? projectRuntimeText(state.message, 'Update details unavailable while restricted.', '限制時更新資料未提供.') : undefined;
        notify({ ok: state.status === 'cancelled', message: safeMessage ?? `${appLabel} update cancellation requested.` });
      } else {
        const result = await window.dingDingStore.updates.restartApp({ appId: app.id, decision: 'restart-to-install' });
        reportOperation(result);
        if (!result.ok) {
          const state = await window.dingDingStore.updates.checkApp(app.id);
          setManagedUpdates((current) => ({ ...current, [app.id]: state }));
        }
      }
    } catch (error) {
      const message = projectRuntimeText((error as Error).message, 'Update details unavailable while restricted.', '限制時更新資料未提供。');
      notify({ ok: false, message, recovery: kind === 'download' ? {
        kind: 'retry-managed-update',
        run: () => handleManagedUpdate('download', app, trigger),
      } : undefined });
      announce(message);
    } finally {
      window.setTimeout(() => trigger.focus(), 0);
    }
  }, [announce, notify, projectRuntimeAppName, projectRuntimeText, reportOperation]);

  const retrySourceJob = useCallback(async (jobId: string, appId: string, appName: string, returnFocus: HTMLButtonElement) => {
    if (operationRunningRef.current) return;
    operationRunningRef.current = true;
    setRunningAction({ kind: 'build', appId, completed: 0, total: 1 });
    setSourceTerminal({ appId, appName: projectRuntimeAppName(appId, appName), jobId, events: [], returnFocus });
    try {
      const result = await window.dingDingStore.sourceJobs.retry({ jobId, decision: 'retry' });
      if (result.ok && result.jobId) {
        setSourceTerminal((current) => current?.appId === appId ? { ...current, jobId: result.jobId!, events: [], fallbackMessage: undefined } : current);
        return;
      }
      setSourceTerminal((current) => current?.appId === appId ? { ...current, fallbackMessage: projectRuntimeText(result.message) } : current);
      reportOperation(result, { kind: 'retry-source-job', run: () => retrySourceJob(jobId, appId, appName, returnFocus) });
    } catch (error) {
      const message = projectRuntimeText((error as Error).message);
      setSourceTerminal((current) => current?.appId === appId ? { ...current, fallbackMessage: message } : current);
      reportOperation({ ok: false, message }, { kind: 'retry-source-job', run: () => retrySourceJob(jobId, appId, appName, returnFocus) });
    } finally {
      operationRunningRef.current = false;
      setRunningAction(null);
    }
  }, [projectRuntimeAppName, projectRuntimeText, reportOperation]);

  const cancelInstall = useCallback(async (app: CatalogApp, trigger: HTMLButtonElement) => {
    const fallback = trigger.closest('.app-card')?.querySelector<HTMLElement>(`[data-install-action="${app.id}"]`) ?? trigger;
    cancellationFocusTargets.current.set(app.id, fallback);
    try {
      const result = await window.dingDingStore.operations.cancelInstall({ appId: app.id, decision: 'cancel-install' });
      const message = schoolProjectionRef.current.restricted
        ? label(settingsRef.current, result.ok ? 'Cancellation completed.' : 'Cancellation could not be completed.', result.ok ? '取消完成。' : '取消未能完成。')
        : result.messageYue ? label(settingsRef.current, result.message, result.messageYue) : projectRuntimeText(result.message);
      notify({ ok: result.ok, message });
      announce(message);
      if (!result.ok) {
        window.setTimeout(() => { if (fallback.isConnected) fallback.focus(); cancellationFocusTargets.current.delete(app.id); }, 0);
      }
    } catch (error) {
      const message = projectRuntimeText((error as Error).message);
      notify({ ok: false, message });
      announce(message);
      window.setTimeout(() => { if (fallback.isConnected) fallback.focus(); cancellationFocusTargets.current.delete(app.id); }, 0);
    } finally {
      // A successful cancellation unmounts the Cancel button on the next
      // progress event; focus is restored by the final event handler below.
    }
  }, [announce, notify, projectRuntimeText]);

  const receiveOperationProgress = useCallback((event: OperationProgressEvent) => {
    setOperationProgress((current) => {
      const previous = current[event.appId];
      const latest = latestOperationIds.current.get(event.appId);
      if (latest && latest !== event.operationId) {
        // A new queued event starts a new operation; every other mismatched
        // event is stale and must not overwrite the current operation.
        if (event.phase !== 'queued' || (previous && !previous.final)) return current;
      }
      latestOperationIds.current.set(event.appId, event.operationId);
      if (event.final) {
        const target = cancellationFocusTargets.current.get(event.appId);
        if (target) window.setTimeout(() => {
          const lockedStatus = event.phase === 'unknown'
            ? window.document.querySelector<HTMLElement>(`[data-operation-status="${event.appId}"]`)
            : null;
          if (lockedStatus?.isConnected) lockedStatus.focus();
          else if (target.isConnected && (!(target instanceof HTMLButtonElement) || !target.disabled)) target.focus();
          cancellationFocusTargets.current.delete(event.appId);
        }, 0);
      }
      return { ...current, [event.appId]: event };
    });
  }, []);

  useEffect(() => {
    let active = true;
    void window.dingDingStore.operations.status().then((events) => {
      if (!active) return;
      for (const event of events) receiveOperationProgress(event);
    }).catch((error) => notify({
      ok: false,
      message: projectRuntimeText((error as Error).message, 'Operation details unavailable while restricted.', '限制時操作資料未提供。'),
    }));
    const remove = window.dingDingStore.operations.subscribe(receiveOperationProgress);
    return () => { active = false; remove(); };
  }, [notify, projectRuntimeText, receiveOperationProgress]);

  useEffect(() => window.dingDingStore.sourceJobs.subscribe((event) => {
    setSourceTerminal((current) => {
      if (!current || current.appId !== event.appId || (current.jobId && current.jobId !== event.jobId)) return current;
      return { ...current, jobId: event.jobId, events: [...current.events, event] };
    });
    if (event.final) {
      operationRunningRef.current = false;
      setRunningAction(null);
      reportOperation(
        { ok: event.state === 'succeeded', message: event.text },
        event.state === 'failed' || event.state === 'cancelled'
          ? {
            kind: 'retry-source-job',
            run: () => retrySourceJob(event.jobId, event.appId, sourceTerminal?.appName ?? event.appId, sourceTerminal?.returnFocus ?? notificationTriggerRef.current!),
          }
          : undefined,
      );
    }
  }), [reportOperation, retrySourceJob, sourceTerminal]);

  const closeSourceTerminal = useCallback(() => {
    const target = sourceTerminal?.returnFocus;
    setSourceTerminal(null);
    if (target) window.setTimeout(() => target.focus(), 0);
  }, [sourceTerminal]);

  const retrySourceTerminal = useCallback(async () => {
    if (!sourceTerminal?.jobId) return;
    await retrySourceJob(sourceTerminal.jobId, sourceTerminal.appId, sourceTerminal.appName, sourceTerminal.returnFocus);
  }, [retrySourceJob, sourceTerminal]);

  const closeAction = useCallback(() => {
    const returnFocus = action?.returnFocus;
    setAction(null);
    if (returnFocus) window.setTimeout(() => returnFocus.focus(), 0);
  }, [action]);

  const runImmediateBatch = useCallback(async (kind: ImmediateActionKind, selectedApps: CatalogApp[], trigger: HTMLButtonElement) => {
    if (operationRunningRef.current) return;
    if (kind === 'build' && selectedApps.length !== 1) {
      notify({ ok: false, message: `Source repair supports one selected application at a time. ${selectedApps.length} were selected; none were started.` });
      return;
    }
    operationRunningRef.current = true;
    if (kind === 'build') {
      const selectedApp = selectedApps[0];
      setRunningAction({ kind, appId: selectedApp.id, completed: 0, total: 1 });
      const selectedAppName = projectRuntimeAppName(selectedApp.id, selectedApp.name);
      announce(`Preparing the source install for ${selectedAppName}`);
      setSourceTerminal({ appId: selectedApp.id, appName: selectedAppName, jobId: null, events: [], returnFocus: trigger });
      try {
        const result = await window.dingDingStore.sourceJobs.start({ appId: selectedApp.id, decision: 'build' });
        if (!result.ok || !result.jobId) {
          setSourceTerminal((current) => current && current.appId === selectedApp.id ? { ...current, fallbackMessage: projectRuntimeText(result.message) } : current);
          reportOperation(result);
          operationRunningRef.current = false;
          setRunningAction(null);
        } else {
          const jobId = result.jobId;
          setSourceTerminal((current) => current && current.appId === selectedApp.id ? { ...current, jobId } : current);
        }
      } catch (error) {
        const message = projectRuntimeText((error as Error).message);
        setSourceTerminal((current) => current && current.appId === selectedApp.id ? { ...current, fallbackMessage: message } : current);
        reportOperation({ ok: false, message });
        operationRunningRef.current = false;
        setRunningAction(null);
      }
      return;
    }
    try {
      for (const [index, selectedApp] of selectedApps.entries()) {
        const next: RunningAction = { kind, appId: selectedApp.id, completed: index, total: selectedApps.length };
        setRunningAction(next);
        announce(`Installing ${projectRuntimeAppName(selectedApp.id, selectedApp.name)}`);
        try {
          const result = await window.dingDingStore.operations.install({ appId: selectedApp.id, decision: 'install' });
            reportOperation(result, result.ok ? undefined : { kind: 'retry-installer', run: () => runImmediateBatch(kind, [selectedApp], trigger) });
          } catch (error) {
            reportOperation({ ok: false, message: (error as Error).message }, { kind: 'retry-installer', run: () => runImmediateBatch(kind, [selectedApp], trigger) });
        }
        setRunningAction({ kind, appId: selectedApp.id, completed: index + 1, total: selectedApps.length });
      }
    } finally {
      operationRunningRef.current = false;
      setRunningAction(null);
    }
  }, [announce, notify, projectRuntimeAppName, projectRuntimeText, reportOperation]);

  const startAction = useCallback(async (kind: ActionKind, selectedApp: CatalogApp, trigger: HTMLButtonElement) => {
    if (kind === 'uninstall') { setAction({ kind, apps: [selectedApp], returnFocus: trigger }); return; }
    await runImmediateBatch(kind, [selectedApp], trigger);
  }, [runImmediateBatch]);

  const startBulkAction = useCallback(async (kind: ActionKind, selectedApps: CatalogApp[], trigger: HTMLButtonElement) => {
    if (!selectedApps.length) return;
    if (kind === 'uninstall') { setAction({ kind, apps: selectedApps, returnFocus: trigger }); return; }
    await runImmediateBatch(kind, selectedApps, trigger);
  }, [runImmediateBatch]);

  useEffect(() => {
    void loadCatalog();
    void loadHistory();
    void loadInstalled();
    const removeStoreListener = window.dingDingStore.updates.subscribe(setUpdateState);
    const removeAppListener = window.dingDingStore.updates.subscribeApp((state) => setManagedUpdates((current) => ({ ...current, [state.appId]: state })));
    return () => { removeStoreListener(); removeAppListener(); };
  }, [loadCatalog, loadHistory, loadInstalled]);

  const apps = useMemo(() => {
    const versions = new Map(installed.map((record) => [record.appId, record.version]));
    return (catalog?.apps ?? [])
      .map((item) => ({
        ...item,
        installedVersion: versions.get(item.id) ?? item.installedVersion,
        description: schoolMode.restricted
          ? (schoolModeRestrictedText(item.description, schoolMode.state.displayName, label(settings, 'Description unavailable while restricted.', '限制時描述未提供。')) || label(settings, 'Description unavailable while restricted.', '限制時描述未提供。'))
          : item.description,
        repository: schoolMode.restricted && schoolModeHiddenContent(item.repository) ? '' : item.repository,
        latestReleaseUrl: schoolMode.restricted && schoolModeHiddenContent(item.latestReleaseUrl ?? '') ? null : item.latestReleaseUrl,
      }))
      .filter((item) => !schoolMode.restricted || !schoolModeHiddenApp(item.id));
  }, [catalog, installed, schoolMode.restricted, schoolMode.state.displayName, settings]);
  const visibleAppIds = useMemo(() => new Set(apps.map((app) => app.id)), [apps]);
  const visibleManagedUpdates = useMemo(() => {
    const projected = schoolModeProjectManagedUpdates(managedUpdates, visibleAppIds, schoolMode.restricted);
    return schoolMode.restricted
      ? Object.fromEntries(Object.entries(projected).map(([appId, state]) => [appId, state && 'message' in state ? { ...state, message: schoolModeRestrictedText(state.message, schoolMode.state.displayName, label(settings, 'Update details unavailable while restricted.', '限制時更新資料未提供。')) } : state]))
      : projected;
  }, [managedUpdates, schoolMode.restricted, schoolMode.state.displayName, settings, visibleAppIds]);
  const visibleInstalled = useMemo(() => installed.filter((record) => visibleAppIds.has(record.appId)), [installed, visibleAppIds]);
  const visibleHistory = useMemo(() => history
    .filter(() => schoolModeAllowsHistoryEntry(schoolMode.restricted))
    .filter((entry) => !schoolMode.restricted || !schoolModeHiddenContent(JSON.stringify(entry)))
    .map((entry) => ({
      ...entry,
      displayName: schoolModeDisplayText(entry.displayName, schoolMode.state.displayName),
      message: schoolModeDisplayText(entry.message, schoolMode.state.displayName),
    })), [history, schoolMode.restricted, schoolMode.state.displayName]);
  const visibleHistoryRevisions = useMemo(() => (schoolMode.restricted ? [] : historyRevisions)
    .map((revision) => ({
      ...revision,
      subject: schoolModeDisplayText(revision.subject, schoolMode.state.displayName),
      label: schoolModeDisplayText(revision.label, schoolMode.state.displayName),
    })), [historyRevisions, schoolMode.restricted, schoolMode.state.displayName]);

  useEffect(() => {
    if (activeTab !== 'updates' || loading || !catalog) return;
    const managedIds = new Set(visibleInstalled.filter((record) => record.ownership && record.uninstall).map((record) => record.appId));
    for (const app of apps.filter((item) => item.installedVersion && managedIds.has(item.id) && !managedChecks.current.has(item.id))) {
      managedChecks.current.add(app.id);
      void window.dingDingStore.updates.checkApp(app.id)
        .then((state) => setManagedUpdates((current) => ({ ...current, [app.id]: state })))
        .catch((error) => notify({
          ok: false,
          message: projectRuntimeText((error as Error).message, 'Update details unavailable while restricted.', '限制時更新資料未提供。'),
          recovery: {
            kind: 'retry-managed-update',
            run: async () => {
              const state = await window.dingDingStore.updates.checkApp(app.id);
              setManagedUpdates((current) => ({ ...current, [app.id]: state }));
            },
          },
        }));
    }
  }, [activeTab, apps, catalog, loading, notify, projectRuntimeText, visibleInstalled]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.dataset.theme = settings.theme;
    root.dataset.density = settings.density;
    root.style.setProperty('--seed', settings.accent);
  }, [settings]);

  useEffect(() => {
    window.document.documentElement.style.setProperty('--rail-width', `${workspace.workspace.rail.width}px`);
  }, [workspace.workspace.rail.width]);

  const openSurface = useCallback((surface: SurfaceId) => {
    if (surface === 'notifications') { setNotificationCenterOpen(true); return; }
    if (schoolMode.state.enabled && surface === 'authenticator') return;
    if (surface === 'changelog') {
      workspace.dispatch({ type: 'activate', id: 'settings' });
      setSubTab('settings.about');
      return;
    }
    if (surface.startsWith('settings.')) {
      workspace.dispatch({ type: 'activate', id: 'settings' });
      setSubTab(surface as SettingsSubTabId);
      return;
    }
    if (surface === 'tabs' || surface === 'palette' || surface === 'appearance.elements') return;
    workspace.dispatch({ type: 'activate', id: surface as TabId });
  }, [schoolMode.state.enabled, workspace]);

  const focusLater = (id: string) => window.setTimeout(() => window.document.getElementById(id)?.focus(), 0);

  const openLockSupport = useCallback((target: LockTarget) => {
    workspace.dispatch({ type: 'activate', id: 'settings' });
    setSubTab('settings.support');
    setLockTargetRequest(target);
    focusLater('lock-target');
  }, [workspace]);

  const selectElement = useCallback((key: ElementKey) => {
    appearance.select(key);
    appearance.setEditMode(true);
    setPanelOpen(true);
  }, [appearance]);

  const editTabOrGroupAppearance = useCallback((target: { kind: 'tab'; id: TabId } | { kind: 'group'; groupId: string }, returnFocus: HTMLElement | null) => {
    appearanceReturnFocusRef.current = returnFocus;
    appearance.select(target.kind === 'tab' ? 'nav-tab' : 'tab-group-header');
    appearance.setEditMode(true);
    setPanelOpen(true);
  }, [appearance]);

  const closeAppearancePanel = useCallback(() => {
    setPanelOpen(false);
    window.setTimeout(() => {
      const target = appearanceReturnFocusRef.current;
      appearanceReturnFocusRef.current = null;
      if (target?.isConnected) target.focus();
    }, 0);
  }, []);

  /**
   * Palette results carry a typed destination instead of an opaque callback.
   * Navigation happens before focus, then a short-lived marker makes the exact
   * target visible without changing unrelated workspace state.
   */
  const applyPaletteTarget = useCallback((target?: EntryTarget) => {
    if (!target) return;
    if (schoolMode.state.enabled && (target.surface === 'authenticator' || target.tabId === 'authenticator')) return;
    if (target.surface) openSurface(target.surface);
    if (target.tabId) workspace.dispatch({ type: 'activate', id: target.tabId });
    if (target.element) selectElement(target.element);
    const focusId = target.focusId;
    window.setTimeout(() => {
      const node = focusId ? window.document.getElementById(focusId) : target.element ? window.document.querySelector(`[data-el="${target.element}"]`) : null;
      if (!(node instanceof HTMLElement)) return;
      node.focus({ preventScroll: false });
      node.setAttribute('data-palette-highlight', 'true');
      window.setTimeout(() => node.removeAttribute('data-palette-highlight'), 1_200);
    }, 0);
  }, [openSurface, schoolMode.state.enabled, selectElement, workspace]);

  const railPatch = useCallback((patch: Partial<TabRailLayout>) => workspace.dispatch({ type: 'rail', patch }), [workspace]);

  const createGroup = useCallback((memberId: TabId | null) => {
    const group: TabGroup = {
      id: newGroupId(),
      name: `Group ${workspace.workspace.groups.length + 1}`,
      color: TAB_GROUP_COLORS[(workspace.workspace.groups.length + 1) % TAB_GROUP_COLORS.length],
      collapsed: false,
    };
    workspace.dispatch({ type: 'group-create', group, memberId });
    setRenameRequest(group.id);
    announce(`Group created${memberId ? ` with ${TAB_META[memberId].en}` : ''}`);
  }, [workspace, announce]);

  const deleteGroup = useCallback((groupId: string) => {
    const group = workspace.workspace.groups.find((item) => item.id === groupId);
    if (!group) return;
    const members = workspace.workspace.tabs.filter((tab) => tab.groupId === groupId).map((tab) => tab.id);
    workspace.dispatch({ type: 'group-delete', groupId });
    notify({
      ok: true,
      message: `Group ${group.name} was deleted. Its tabs were kept.`,
      undo: {
        label: 'Undo',
        run: () => {
          workspace.dispatch({ type: 'group-create', group, memberId: null });
          for (const id of members) workspace.dispatch({ type: 'group-assign', id, groupId });
        },
      },
    });
  }, [workspace, notify]);

  const runCommand = useCallback((command: string) => {
    const [verb, ...rest] = command.split(':');
    const arg = rest.join(':');
    const [first, second] = rest;
    if (schoolMode.state.enabled && (arg === 'authenticator' || first === 'authenticator' || command.startsWith('authenticator-'))) return;
    switch (verb) {
      case 'refresh-catalog': case 'refresh-catalog-now': void loadCatalog(true); return;
      case 'open-notifications': setNotificationCenterOpen(true); return;
      case 'open-changelog': openSurface('settings.about'); focusLater('changelog-title'); return;
      case 'open-school-mode': openSurface('settings.general'); focusLater('school-mode-title'); return;
      case 'open-source-details': openSurface('settings.general'); focusLater('source-isolation-title'); return;
      case 'personal-vocabulary-import': openSurface('settings.general'); focusLater('personal-vocabulary-import'); return;
      case 'personal-vocabulary-clear': openSurface('settings.general'); focusLater('personal-vocabulary-clear'); return;
      case 'authenticator-rename': case 'authenticator-group': case 'authenticator-reorder': case 'authenticator-select':
      case 'authenticator-export': case 'authenticator-secret-export': case 'authenticator-delete': case 'authenticator-bulk-delete':
        openSurface('authenticator'); focusLater('authenticator-entry-management'); return;
      case 'clear-all-searches': search.dispatch({ type: 'clear-all' }); announce('All searches cleared'); return;
      case 'focus-tab-search': focusLater('search-tabs'); return;
      case 'open-regex': openSurface(arg as SurfaceId); setRegexRequest(arg as SurfaceId); return;
      case 'clear-search': search.dispatch({ type: 'clear', surface: arg as SurfaceId }); return;
      case 'pin': workspace.dispatch({ type: 'pin', id: arg as TabId, pinned: 'toggle' }); announce(`${TAB_META[arg as TabId].en} pin toggled`); return;
      case 'move-up': workspace.dispatch({ type: 'move', id: arg as TabId, direction: -1 }); announce(`${TAB_META[arg as TabId].en} moved up`); return;
      case 'move-down': workspace.dispatch({ type: 'move', id: arg as TabId, direction: 1 }); announce(`${TAB_META[arg as TabId].en} moved down`); return;
      case 'group-add': workspace.dispatch({ type: 'group-assign', id: first as TabId, groupId: second }); return;
      case 'group-remove': workspace.dispatch({ type: 'group-remove', id: arg as TabId }); return;
      case 'group-rename': setRenameRequest(arg); return;
      case 'group-color': workspace.dispatch({ type: 'group-color', groupId: first, color: second as TabGroupColor }); return;
      case 'group-collapse': workspace.dispatch({ type: 'group-collapse', groupId: arg, collapsed: 'toggle' }); return;
      case 'group-delete': deleteGroup(arg); return;
      case 'new-group': createGroup(null); return;
      case 'collapse-all-groups': workspace.dispatch({ type: 'group-collapse-all' }); return;
      case 'show-overflow': setOverflowRequest(true); return;
      case 'reset-tabs': void workspace.reset(); return;
      case 'export-tabs': void workspace.exportLayout().then((content) => downloadText('ding-ding-app-store-tabs.json', content, 'application/json')).catch((error) => notify({ ok: false, message: (error as Error).message })); return;
      case 'open-tabs-in-code': void workspace.exportLayout().then(async (content) => {
        const result = await openExportInVsCode({ recordKind: 'tabs', suggestedName: 'ding-ding-app-store-tabs.json', mime: 'application/json', content });
        notify({ ok: result.ok, message: result.ok ? 'Tab layout export opened in Visual Studio Code.' : result.message });
      }).catch((error) => notify({ ok: false, message: (error as Error).message })); return;
      case 'import-tabs': void pickTextFile().then((picked) => { if (!picked) return; if (!picked.ok) { notify({ ok: false, message: picked.message.slice(0, 200) }); return; } void workspace.importLayout(picked.text); }); return;
      case 'rail-side': railPatch({ side: arg as TabRailLayout['side'] }); return;
      case 'label-mode': railPatch({ labelMode: arg as TabRailLayout['labelMode'] }); return;
      case 'tab-height': railPatch({ tabHeight: arg as TabRailLayout['tabHeight'] }); return;
      case 'overflow-mode': railPatch({ overflowMode: arg as TabRailLayout['overflowMode'] }); return;
      case 'toggle-badges': railPatch({ showBadges: !workspace.workspace.rail.showBadges }); return;
      case 'toggle-color-bar': railPatch({ showGroupColorBar: !workspace.workspace.rail.showGroupColorBar }); return;
      case 'toggle-pinned-icon-only': railPatch({ pinnedIconOnly: !workspace.workspace.rail.pinnedIconOnly }); return;
      case 'toggle-appearance-edit': appearance.setEditMode('toggle'); setPanelOpen(!appearance.editMode); announce(appearance.editMode ? 'Appearance edit mode off' : 'Appearance edit mode on'); return;
      case 'edit-element': selectElement(arg as ElementKey); return;
      case 'reset-element': appearance.resetElement(arg as ElementKey); return;
      case 'reset-appearance-all': appearance.resetAll(); return;
      case 'export-appearance': void appearance.exportDocument().then((content) => downloadText('ding-ding-app-store-appearance.json', content, 'application/json')).catch((error) => notify({ ok: false, message: (error as Error).message })); return;
      case 'open-appearance-in-code': void appearance.exportDocument().then(async (content) => {
        const result = await openExportInVsCode({ recordKind: 'appearance', suggestedName: 'ding-ding-app-store-appearance.json', mime: 'application/json', content });
        notify({ ok: result.ok, message: result.ok ? 'Appearance export opened in Visual Studio Code.' : result.message });
      }).catch((error) => notify({ ok: false, message: (error as Error).message })); return;
      case 'import-appearance': void pickTextFile().then((picked) => { if (!picked) return; if (!picked.ok) { notify({ ok: false, message: picked.message.slice(0, 200) }); return; } void appearance.importDocument(picked.text); }); return;
      case 'open-schedule': openSurface('settings.schedule'); return;
      case 'check-store-update': void schedule.runNow('self-update'); return;
      case 'toggle-self-update-repeat': void schedule.applyNow([['selfUpdate.repeatEnabled', !schedule.draft.selfUpdate.repeatEnabled]]); return;
      case 'toggle-catalog-refresh': void schedule.applyNow([['catalogRefresh.enabled', !schedule.draft.catalogRefresh.enabled]]); return;
      case 'toggle-quiet-hours': void schedule.applyNow([['quietHours.enabled', !schedule.draft.quietHours.enabled]]); return;
      case 'apply-quiet-night': void schedule.applyNow([['quietHours.enabled', true], ['quietHours.startMinute', 1320], ['quietHours.endMinute', 420]]); return;
      case 'self-interval': void schedule.applyNow([['selfUpdate.intervalMinutes', Number(arg)]]); return;
      case 'catalog-interval': void schedule.applyNow([['catalogRefresh.intervalMinutes', Number(arg)]]); return;
      case 'save-schedule': void schedule.save(); return;
      case 'reset-schedule': schedule.resetDefaults(); openSurface('settings.schedule'); return;
      case 'show-next-runs': {
        const tasks = schedule.status?.tasks;
        notify({
          ok: true,
          message: tasks
            ? `App Store check: ${tasks['self-update'].nextRunAt ? formatAbsolute(tasks['self-update'].nextRunAt) : 'not scheduled'} · Catalog refresh: ${tasks['catalog-refresh'].nextRunAt ? formatAbsolute(tasks['catalog-refresh'].nextRunAt) : 'not scheduled'}`
            : 'The schedule has not been read yet.',
        });
        return;
      }
      case 'set-option': void patchSetting(first as keyof UserSettings, second as UserSettings[keyof UserSettings]); return;
      case 'open-app': {
        workspace.dispatch({ type: 'activate', id: 'catalog' });
        const app = catalog?.apps.find((item) => item.id === arg);
        if (app) search.dispatch({ type: 'set', surface: 'catalog', patch: { query: app.name, regex: null } });
        return;
      }
      case 'open-doc': {
        workspace.dispatch({ type: 'activate', id: 'docs' });
        setDocRequest(arg);
        return;
      }
      default: return;
    }
  }, [loadCatalog, search, openSurface, workspace, deleteGroup, createGroup, notify, railPatch, appearance, selectElement, schedule, patchSetting, catalog, schoolMode.state.enabled]);

  const dispatchAction = useCallback((next: Action) => {
    if (next.type === 'command') applyPaletteTarget(next.target);
    switch (next.type) {
      case 'open-surface': applyPaletteTarget(next.target ?? { surface: next.surface }); return;
      case 'set-setting': {
        if (next.value === null) {
          const field = SETTING_FIELDS.find((row) => row.key === next.key);
          applyPaletteTarget(next.target ?? {
            surface: field?.section === 'general' ? 'settings.general' : 'settings.appearance',
            focusId: `setting-${String(next.key)}`,
          });
          return;
        }
        void patchSetting(next.key, next.value as UserSettings[keyof UserSettings]);
        return;
      }
      case 'set-appearance': {
        applyPaletteTarget(next.destination ?? { surface: 'settings.appearance', element: next.target });
        if (next.value !== null) setPendingToken({ token: next.token, value: next.value });
        return;
      }
      case 'set-schedule': {
        if (next.value === null) {
          applyPaletteTarget(next.target ?? { surface: 'settings.schedule', focusId: `schedule-${next.key.replace('.', '-')}` });
          return;
        }
        void schedule.applyNow([[next.key, next.value]]);
        return;
      }
      case 'command': runCommand(next.command); return;
      default: return;
    }
  }, [applyPaletteTarget, patchSetting, appearance, schedule, runCommand]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); setPaletteOpen(true); return; }
      if (event.ctrlKey && event.shiftKey && key === 'p') { event.preventDefault(); runCommand(`pin:${activeTab}`); return; }
      if (event.ctrlKey && event.shiftKey && key === 'g') { event.preventDefault(); createGroup(activeTab); return; }
      if (event.ctrlKey && event.shiftKey && key === 'k') { event.preventDefault(); runCommand('focus-tab-search'); return; }
      if (event.ctrlKey && event.shiftKey && key === 'e') { event.preventDefault(); runCommand('toggle-appearance-edit'); return; }
      if (event.ctrlKey && event.key === 'Tab') {
        event.preventDefault();
        const order = orderedTabIds(workspace.workspace).filter((id) => !(schoolMode.state.enabled && id === 'authenticator'));
        const index = Math.max(0, order.indexOf(activeTab));
        const target = order[(index + (event.shiftKey ? -1 : 1) + order.length) % order.length];
        if (target) {
          workspace.dispatch({ type: 'activate', id: target });
          announce(`${TAB_META[target].en} tab`);
        }
        return;
      }
      if (event.ctrlKey && !event.shiftKey && /^[1-7]$/.test(event.key)) {
        const order = orderedTabIds(workspace.workspace).filter((id) => !(schoolMode.state.enabled && id === 'authenticator'));
        const target = order[Number(event.key) - 1];
        if (target) { event.preventDefault(); workspace.dispatch({ type: 'activate', id: target }); announce(`${TAB_META[target].en} tab`); }
        return;
      }
      if (event.key === 'Escape') {
        if (notificationCenterOpen) { closeNotificationCenter(); return; }
        if (paletteOpen) { setPaletteOpen(false); return; }
        if (action) { closeAction(); return; }
        if (panelOpen) { closeAppearancePanel(); return; }
        if (appearance.editMode) { appearance.setEditMode(false); announce('Appearance edit mode off'); return; }
        search.dispatch({ type: 'clear', surface: 'tabs' });
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [activeTab, workspace, runCommand, createGroup, announce, paletteOpen, action, closeAction, panelOpen, notificationCenterOpen, closeNotificationCenter, appearance, search, closeAppearancePanel, schoolMode.state.enabled]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (!appearance.editMode) { delete root.dataset.appearanceEdit; return; }
    root.dataset.appearanceEdit = 'on';
    const resolve = (target: EventTarget | null): ElementKey | null => {
      const element = target instanceof Element ? target : null;
      // The panel edits itself out of the way, and the window controls must keep working in edit mode.
      if (!element || element.closest('.appearance-panel') || element.closest('.titlebar button')) return null;
      const host = element.closest('[data-el]');
      const value = host?.getAttribute('data-el');
      return value ? (value as ElementKey) : null;
    };
    const onClick = (event: MouseEvent) => {
      const key = resolve(event.target);
      if (!key) return;
      event.preventDefault();
      event.stopPropagation();
      selectElement(key);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const key = resolve(event.target);
      if (!key) return;
      event.preventDefault();
      event.stopPropagation();
      selectElement(key);
    };
    const onFocusIn = (event: FocusEvent) => {
      const key = resolve(event.target);
      if (key) appearance.select(key);
    };
    window.document.addEventListener('click', onClick, true);
    window.document.addEventListener('keydown', onKeyDown, true);
    window.document.addEventListener('focusin', onFocusIn, true);
    return () => {
      window.document.removeEventListener('click', onClick, true);
      window.document.removeEventListener('keydown', onKeyDown, true);
      window.document.removeEventListener('focusin', onFocusIn, true);
      delete root.dataset.appearanceEdit;
    };
  }, [appearance, selectElement]);

  useEffect(() => {
    if (!pendingToken || !appearance.selectedKey) return;
    appearance.setToken(pendingToken.token, pendingToken.value);
    appearance.commit();
    setPendingToken(null);
  }, [pendingToken, appearance]);

  useEffect(() => {
    for (const node of Array.from(window.document.querySelectorAll('[data-el-selected]'))) node.removeAttribute('data-el-selected');
    if (appearance.selectedKey) window.document.querySelector(`[data-el="${appearance.selectedKey}"]`)?.setAttribute('data-el-selected', 'true');
  }, [appearance.selectedKey, appearance.elements, activeTab, subTab]);

  const updatesBadge = Boolean(apps.some((app) => app.updateState === 'available') || Object.values(visibleManagedUpdates).some((state) => state.status === 'ready' || state.status === 'downloading') || updateState.status === 'ready');
  const updateVersion = updateState.status === 'available' || updateState.status === 'downloading' || updateState.status === 'ready' ? updateState.version : null;
  useEffect(() => {
    if (updateVersion && updateVersion !== dismissedUpdateVersion) setDismissedUpdateVersion(null);
  }, [dismissedUpdateVersion, updateVersion]);
  const restartUpdate = useCallback(async () => {
    if (operationRunningRef.current || runningAction || sourceTerminal || action || schedule.dirty) {
      notify({ ok: false, message: 'Save or finish the current operation before restarting to install the update.' });
      return;
    }
    const result = await window.dingDingStore.updates.restartStore();
    notify({
      ok: result.ok,
      message: projectRuntimeText(result.message, 'Update details unavailable while restricted.', '限制時更新資料未提供。'),
    });
  }, [action, notify, projectRuntimeText, runningAction, schedule.dirty, sourceTerminal]);
  const entries = useMemo(() => buildRegistry({
    settings,
    workspace: workspace.workspace,
    appearance: appearance.document.elements,
    schedule: schedule.draft ?? DEFAULT_SCHEDULE,
    apps,
    schoolModeEnabled: schoolMode.restricted,
    schoolModeName: schoolMode.state.displayName,
  }), [settings, workspace.workspace, appearance.document, schedule.draft, apps, schoolMode.restricted, schoolMode.state.displayName]);

  const meta = TAB_META[activeTab];
  const subtitle = PAGE_SUBTITLE[activeTab];
  const rail = workspace.workspace.rail;
  const hiddenSourceTerminal = Boolean(sourceTerminal && schoolMode.restricted && schoolModeHiddenApp(sourceTerminal.appId));
  const visibleSourceTerminal = useMemo(() => {
    if (!sourceTerminal || !hiddenSourceTerminal) return sourceTerminal;
    const latest = sourceTerminal.events.at(-1);
    const neutralEvent: Readonly<SourceTerminalEvent> = {
      jobId: sourceTerminal.jobId ?? '00000000-0000-4000-8000-000000000000',
      appId: 'restricted-operation',
      sequence: 0,
      at: latest?.at ?? '1970-01-01T00:00:00.000Z',
      stream: 'progress',
      state: latest?.state ?? 'queued',
      text: label(settings, 'Restricted operation status', '限制操作狀態'),
      progress: latest?.progress ?? 0,
      final: latest?.final ?? false,
    };
    return { ...sourceTerminal, appName: label(settings, 'Restricted operation', '限制操作'), events: [neutralEvent], fallbackMessage: undefined };
  }, [hiddenSourceTerminal, settings, sourceTerminal]);

  return (
    <SearchContext.Provider value={search}>
      <div
        className="app-shell"
        data-tab-side={rail.side}
        data-tab-height={rail.tabHeight}
        data-label-mode={rail.labelMode}
        data-overflow-mode={rail.overflowMode}
        data-color-bar={rail.showGroupColorBar}
        {...el('app-shell')}
      >
        <header className="titlebar" {...el('titlebar')}>
          <img className="titlebar-logo" src="/ding-ding-app-store.svg" alt="" aria-hidden="true" />
          <div className="brand-mark" aria-hidden="true"><Icon>storefront</Icon></div>
          <strong {...el('titlebar-brand')}>{settings.displayName}</strong>
          <span className="dev-badge" {...el('titlebar-badge')}>Preview 0.1.0</span>
          <div className="drag-space" />
          <button ref={notificationTriggerRef} className="notification-button" onClick={() => setNotificationCenterOpen(true)} aria-label={`Open notification centre, ${visibleUnreadCount} unread`}><Icon>notifications</Icon>{visibleUnreadCount > 0 && <span className="notification-count" aria-hidden="true">{Math.min(visibleUnreadCount, 99)}</span>}</button>
          <button onClick={() => window.dingDingStore.window.minimize()} aria-label="Minimize"><Icon>remove</Icon></button>
          <button onClick={() => window.dingDingStore.window.toggleMaximize()} aria-label="Maximize or restore"><Icon>crop_square</Icon></button>
          <button className="close-window" onClick={() => window.dingDingStore.window.close()} aria-label="Close"><Icon>close</Icon></button>
        </header>

      <TabRail
        settings={settings}
        workspace={workspace.workspace}
        dispatch={workspace.dispatch}
          locks={locks}
          onManageLock={openLockSupport}
          updatesBadge={updatesBadge}
          onOpenPalette={() => setPaletteOpen(true)}
          announce={announce}
          openOverflow={overflowRequest}
          onOverflowHandled={() => setOverflowRequest(false)}
          openTabRegex={regexRequest === 'tabs'}
          onTabRegexHandled={() => setRegexRequest(null)}
          renameGroupId={renameRequest}
          onRenameHandled={() => setRenameRequest(null)}
          onEditAppearance={editTabOrGroupAppearance}
          schoolModeEnabled={schoolMode.state.enabled}
        />

        <main ref={safeFocusRef} className="content" id="surface-panel" role="tabpanel" tabIndex={-1} aria-labelledby={`tab-${activeTab}`} {...el('content-surface')}>
          {(((updateState.status === 'available' || updateState.status === 'downloading' || updateState.status === 'ready') && updateVersion !== dismissedUpdateVersion) || updateState.status === 'failed') && (
            <section className={`update-banner ${updateState.status}`} role="status" {...el('update-banner')}>
              <Icon>system_update</Icon>
              <div>
                <strong>{updateState.status === 'ready' ? label(settings, `${settings.displayName} ${updateState.version} is ready`, `${settings.displayName} ${updateState.version} 準備好喇`) : updateState.status === 'available' ? label(settings, `Version ${updateState.version} is available`, `版本 ${updateState.version} 有得更新`) : updateState.status === 'downloading' ? label(settings, 'Downloading update…', '下載緊更新…') : label(settings, 'Update check failed', '更新檢查失敗')}</strong>
                <p>{updateState.status === 'failed'
                  ? projectRuntimeText(updateState.message, 'Update details unavailable while restricted.', '限制時更新資料未提供。')
                  : label(settings, 'Unsigned artifact: HTTPS feed metadata and package hashes protect transport integrity; no code signature is claimed.', '未簽名檔案：HTTPS feed metadata 同 package hash 保護傳輸完整性，但唔宣稱有程式簽名。')}</p>
                {(updateState.status === 'available' || updateState.status === 'downloading' || updateState.status === 'ready') && <p className="supporting">{schoolMode.restricted ? label(settings, 'Package details unavailable while restricted.', '限制時套件資料未提供。') : <>{label(settings, 'Package', '套件')} {updateState.package.fileName} · SHA-1 {updateState.package.sha1} · {updateState.package.bytes.toLocaleString()} bytes</>}</p>}
                {updateState.status === 'failed' && updateState.rollbackAvailable && <p className="supporting">{label(settings, 'The previous version remains untouched. Squirrel.Windows rollback was detected or may still be available; retry only after reviewing the release notes.', '上一個版本原封不動。偵測到 Squirrel.Windows rollback，或者 rollback 仍然可用；睇完 release notes 先再試。')}</p>}
              </div>
              {!schoolMode.restricted && (updateState.status === 'available' || updateState.status === 'ready') && <a className="text-button" href={updateState.releaseNotesUrl} onClick={(event) => { event.preventDefault(); void window.dingDingStore.updates.openReleaseNotes(updateState.releaseNotesUrl).then((result) => notify({ ok: result.ok, message: projectRuntimeText(result.message) })); }}>{label(settings, 'Release notes', 'Release notes')}</a>}
              {updateState.status === 'available' && <button className="filled-button" onClick={() => void window.dingDingStore.updates.downloadStore().then(setUpdateState).catch((error) => notify({ ok: false, message: projectRuntimeText((error as Error).message), recovery: { kind: 'retry-store-update-check', run: retryStoreUpdateCheck } }))}>{label(settings, 'Download', '下載')}</button>}
              {updateState.status === 'downloading' && <button className="text-button" onClick={() => void window.dingDingStore.updates.cancelStoreDownload().then(setUpdateState)}>{label(settings, 'Cancel download', '取消下載')}</button>}
              {updateState.status === 'failed' && updateState.recoverable && <button className="filled-button" onClick={() => void retryStoreUpdateCheck()}>{label(settings, 'Retry check', '再檢查')}</button>}
              {updateState.status === 'ready' && <><button className="text-button" onClick={() => setDismissedUpdateVersion(updateState.version)}>{label(settings, 'Later', '遲啲先')}</button><button className="filled-button" onClick={() => void restartUpdate()}>{label(settings, 'Restart to install update', '重新啟動安裝更新')}</button></>}
            </section>
          )}

          <div className="page-heading" {...el('page-heading')}>
            <div>
              <span className="eyebrow">DING DING PROJECTS</span>
              <h1 {...el('page-title')}>{label(settings, meta.en, meta.yue)}</h1>
              <p>{subtitle ? label(settings, subtitle.en, subtitle.yue) : ''}</p>
            </div>
            {(activeTab === 'catalog' || activeTab === 'installed' || activeTab === 'updates') && (
              <button className="tonal-button" {...el('button-tonal')} disabled={loading} onClick={() => void loadCatalog(true)}><Icon>refresh</Icon>{loading ? 'Refreshing…' : 'Refresh'}</button>
            )}
          </div>

          {catalog?.warning && <div className="notice warning" role="status" {...el('notice')}><Icon>wifi_off</Icon>{catalog.warning}</div>}

          {(activeTab === 'catalog' || activeTab === 'installed' || activeTab === 'updates') && (
            <AppsPage
              mode={activeTab}
              apps={apps}
              installed={visibleInstalled}
              settings={settings}
              loading={loading}
              onAction={(kind, app, trigger) => void startAction(kind, app, trigger)}
              onManagedUpdate={(kind, app, trigger) => void handleManagedUpdate(kind, app, trigger)}
              managedUpdates={visibleManagedUpdates}
              onBulkAction={(kind, selectedApps, trigger) => void startBulkAction(kind, selectedApps, trigger)}
              runningAction={runningAction}
              operationProgress={operationProgress}
              onCancelInstall={(app, trigger) => void cancelInstall(app, trigger)}
              notify={notify}
              openRegex={regexRequest === activeTab}
              onRegexHandled={() => setRegexRequest(null)}
            />
          )}
          {activeTab === 'authenticator' && !schoolMode.restricted && <AuthenticatorPage settings={settings} authenticator={authenticator} notify={notify} openRegex={regexRequest === 'authenticator'} onRegexHandled={() => setRegexRequest(null)} />}
          {activeTab === 'docs' && <DocsPage settings={settings} schoolModeEnabled={schoolMode.restricted} schoolModeName={schoolMode.state.displayName} notify={notify} openRegex={regexRequest === 'docs'} onRegexHandled={() => setRegexRequest(null)} articleRequest={docRequest} onArticleHandled={() => setDocRequest(null)} onOpenSupport={() => openLockSupport({ targetKind: 'tab', targetId: workspace.workspace.activeTabId })} />}
          {activeTab === 'activity' && <ActivityPage entries={visibleHistory} revisions={visibleHistoryRevisions} loading={historyLoading} settings={settings} openRegex={regexRequest === 'activity'} onRegexHandled={() => setRegexRequest(null)} notify={notify} onHistoryChanged={reloadHistoryAndSettings} schoolRestricted={schoolMode.restricted} />}
          {activeTab === 'settings' && (
            <SettingsPage
              key={settingsReloadKey}
              settings={baseSettings}
              settingsProvenance={settingsProvenance}
              sourceIsolationStatus={sourceIsolationStatus}
              sourceIsolationLoading={sourceIsolationLoading}
              onRefreshSourceIsolation={() => void refreshSourceIsolation()}
              onSave={(value) => void saveSettings(value)}
              workspace={workspace}
              appearance={appearance}
              schedule={schedule}
              schoolMode={schoolMode}
              locks={locks}
              support={support}
              lockTargetRequest={lockTargetRequest}
              notify={notify}
              subTab={subTab}
              onSubTab={setSubTab}
              regexRequest={regexRequest}
              onRegexHandled={() => setRegexRequest(null)}
            />
          )}
        </main>

        {panelOpen && appearance.editMode && <AppearancePanel appearance={appearance} settings={settings} notify={notify} locks={locks} schoolModeEnabled={schoolMode.state.enabled} onManageLock={(target, returnFocus) => { appearanceReturnFocusRef.current = returnFocus; setPanelOpen(false); openLockSupport(target); }} onClose={closeAppearancePanel} />}

        {action && !schoolMode.restricted && <ActionDialog action={action} settings={settings} onClose={closeAction} onResult={reportOperation} />}

        {notificationCenterOpen && <NotificationCenter records={visibleNotificationRecords} settings={settings} persistenceAvailable={notifications.persistenceAvailable} onDismissMany={notifications.dismissMany} onDeleteMany={notifications.deleteMany} notify={notify} onClose={closeNotificationCenter} openRegex={regexRequest === 'notifications'} onRegexHandled={() => setRegexRequest(null)} />}
        {visibleSourceTerminal && (
          <SourceTerminalPanel
            appName={visibleSourceTerminal.appName}
            events={visibleSourceTerminal.events}
            fallbackMessage={visibleSourceTerminal.fallbackMessage}
            isolationStatus={sourceIsolationStatus}
            isolationLoading={sourceIsolationLoading}
            onRefreshIsolation={() => void refreshSourceIsolation()}
            settings={settings}
            onCancel={() => sourceTerminal?.jobId && void window.dingDingStore.sourceJobs.cancel({ jobId: sourceTerminal.jobId, decision: 'cancel' })}
            onRetry={() => void retrySourceTerminal()}
            onClose={closeSourceTerminal}
            allowRetry={!hiddenSourceTerminal}
          />
        )}

        {paletteOpen && (
          <CommandPalette
            settings={settings}
            entries={entries}
            onAction={dispatchAction}
            onClose={() => setPaletteOpen(false)}
            openRegex={regexRequest === 'palette'}
            onRegexHandled={() => setRegexRequest(null)}
          />
        )}

        <SnackbarStack notices={visibleActiveNotices} settings={settings} onDismiss={notifications.dismiss} />

        {dimSum && !schoolMode.restricted && (
          <aside className="dim-sum-surprise" role="status" aria-live="polite">
            <img src={dimSum.photoUrl} alt={`${dimSum.alt ?? dimSum.nameEn ?? 'Dim sum'} · ${dimSum.nameZhHant ?? ''}`} />
            <div><strong>{label(settings, 'A little dim sum surprise', '有少少點心驚喜')}</strong><span>{label(settings, `${dimSum.nameEn} · ${dimSum.nameZhHant}`, `${dimSum.nameZhHant} · ${dimSum.nameEn}`)}</span></div>
            <button className="icon-button" aria-label={label(settings, 'Dismiss dim sum surprise', '關閉點心驚喜')} onClick={() => setDimSum(null)}><Icon>close</Icon></button>
          </aside>
        )}

        <div className="visually-hidden" role="status" aria-live="polite">{announcement}</div>
      </div>
    </SearchContext.Provider>
  );
}
