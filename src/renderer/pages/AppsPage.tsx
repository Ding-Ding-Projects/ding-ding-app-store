import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { installationManagementState } from '../../shared/contracts';
import type { CatalogApp, InstalledAppRecord, ManagedUpdateState, OperationProgressEvent, OperationProgressPhase, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import { highlight, makeMatcher, useSurfaceSearch } from '../search';
import type { ActionKind, ImmediateActionKind } from '../components/ActionDialog';
import { SearchBox } from '../components/SearchBox';
import { downloadText } from '../files';
import { serializeStructuredExport } from '../../shared/export-registry';
import { isExternalEditorBridgeAvailable, openExportInVsCode } from '../external-editor';
import type { Notify } from '../notify';

export type AppsMode = 'catalog' | 'installed' | 'updates';

export interface RunningAction {
  kind: ImmediateActionKind;
  appId: string;
  completed: number;
  total: number;
}

function operationPhaseLabel(settings: UserSettings, phase: OperationProgressPhase): string {
  const copy: Record<OperationProgressPhase, [string, string]> = {
    queued: ['Preparing installation…', '準備緊安裝…'],
    resolving: ['Resolving the reviewed release…', '搵緊已審核 release…'],
    downloading: ['Downloading and verifying the release…', '下載同驗證緊 release…'],
    extracting: ['Extracting the verified portable package…', '解壓緊已驗證 portable package…'],
    launching: ['Starting the reviewed installer…', '啟動緊已審核安裝程式…'],
    committing: ['Applying the verified portable package…', '套用緊已驗證 portable package…'],
    'installer-running': ['Installer running; cancellation is unavailable.', '安裝程式運行緊，暫時唔可以取消。'],
    cancelling: ['Cancelling and cleaning up…', '取消緊，同時清理中…'],
    succeeded: ['Installation complete.', '安裝完成。'],
    failed: ['Installation failed.', '安裝失敗。'],
    cancelled: ['Installation cancelled.', '安裝已取消。'],
    unknown: ['Installer outcome unknown; locked until restart.', '安裝結果未能確認；重啟前會鎖住。'],
  };
  const [en, yue] = copy[phase];
  return label(settings, en, yue);
}

function appStatusLabel(settings: UserSettings, status: CatalogApp['updateState']): string {
  const copy: Record<CatalogApp['updateState'], [string, string]> = {
    unknown: ['Unknown', '未知'], 'up-to-date': ['Up to date', '已經係最新'], available: ['Update available', '有更新'],
    unsupported: ['Unsupported', '未支援'], failed: ['Update check failed', '更新檢查失敗'],
  };
  const [en, yue] = copy[status];
  return label(settings, en, yue);
}

function appMark(name: string, id: string): { letters: string; tone: string } {
  const letters = name.trim().split(/\s+/).map((part) => part[0] ?? '').join('').slice(0, 2).toUpperCase() || 'DD';
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return { letters, tone: ['violet', 'teal', 'coral', 'amber', 'blue'][hash % 5] };
}

export function AppCard({ app, installedRecord, settings, onAction, onManagedUpdate, onCancelInstall, managedUpdate, operationProgress, searchLabel, runningAction, selected, onSelect }: { app: CatalogApp; installedRecord: InstalledAppRecord | undefined; settings: UserSettings; onAction: (kind: ActionKind, app: CatalogApp, trigger: HTMLButtonElement) => void; onManagedUpdate: (kind: 'download' | 'cancel' | 'install', app: CatalogApp, trigger: HTMLButtonElement) => void; onCancelInstall: (app: CatalogApp, trigger: HTMLButtonElement) => void; managedUpdate: ManagedUpdateState | undefined; operationProgress: OperationProgressEvent | undefined; searchLabel: ReactNode; runningAction: RunningAction | null; selected: boolean; onSelect(checked: boolean, shiftKey: boolean): void }) {
  const management = installationManagementState(installedRecord);
  const managed = management === 'store-managed';
  const discoveryOnly = management === 'discovery-only';
  const proofBlocked = app.proofStatus !== 'verified';
  const proofReason = app.proofStatus === 'blocked-until-proof'
    ? label(settings, `Unavailable until clean-Windows lifecycle proof is verified${app.proofTargetId ? ` (${app.proofTargetId})` : ''}. Install, launch, build, and update actions remain blocked.`, `未能使用，要等 clean-Windows 生命週期證據驗證${app.proofTargetId ? `（${app.proofTargetId}）` : ''}。安裝、啟動、建置同更新操作都會封鎖。`)
    : label(settings, 'Unavailable because this catalog row has no verified proof status. Install, launch, build, and update actions remain blocked.', '未能使用，因為呢個目錄項目冇已驗證嘅證據狀態。安裝、啟動、建置同更新操作都會封鎖。');
  const operationBusy = runningAction !== null || (operationProgress && !operationProgress.final) || operationProgress?.locked === true || managedUpdate?.status === 'downloading' || managedUpdate?.status === 'installing';
  const installBusy = (runningAction?.appId === app.id && runningAction.kind === 'install') || (operationProgress?.kind === 'install' && !operationProgress.final);
  const launchBusy = runningAction?.appId === app.id && runningAction.kind === 'launch';
  const sourceBusy = runningAction?.appId === app.id && runningAction.kind === 'build';
  const installProgress = operationProgress?.kind === 'install' ? operationProgress : undefined;
  const managedUpdateBusy = managedUpdate?.appId === app.id && (managedUpdate.status === 'downloading' || managedUpdate.status === 'installing');
  const mark = appMark(app.name, app.id);
  const busyExplanation = operationProgress?.locked
    ? label(settings, 'This application remains locked until restart because installer termination could not be proven.', '安裝程式終止未能確認，呢個 app 會鎖住直到重啟。')
    : operationBusy ? label(settings, 'Wait for the current application operation to finish before starting another action.', '等目前應用程式操作完成先做下一步。') : undefined;
  return (
    <article className="app-card" data-app-id={app.id} data-availability={app.availability} {...el('app-card')}>
      <label className="selection-check app-selection"><input type="checkbox" checked={selected} onClick={(event) => onSelect(event.currentTarget.checked, event.shiftKey)} onChange={() => undefined} /><span className="visually-hidden">{label(settings, `Select ${app.name}`, `揀選 ${app.name}`)}</span></label>
      <div className="app-avatar" data-app-tone={mark.tone} {...el('app-avatar')} aria-hidden="true"><span className="app-avatar-glyph">{mark.letters}</span><span className="app-avatar-spark" /></div>
      <div className="app-copy">
      <div className="card-heading"><h3 {...el('app-card-title')}>{searchLabel}</h3><span className={`status-pill ${proofBlocked ? 'blocked' : app.updateState}`} {...el('status-pill')}>{proofBlocked ? label(settings, 'Blocked until proof', '證據未齊，暫停') : appStatusLabel(settings, app.updateState)}</span></div>
        <p {...el('app-card-description')}>{app.description}</p>
        <div className="meta" aria-label={label(settings, 'Application facts', '應用資料')}><span><Icon>deployed_code</Icon>{app.latestVersion ?? label(settings, 'No stable release', '冇穩定版本')}</span><span><Icon>download</Icon>{app.packageType}</span><span><Icon>star</Icon>{app.stars}</span>{installedRecord && <span><Icon>{managed ? 'verified_user' : 'visibility'}</Icon>{managed ? label(settings, 'Managed by App Store', '由 App Store 管理') : label(settings, 'Detected outside App Store', '偵測到外部安裝')}</span>}</div>
        <span className={`availability-note ${proofBlocked ? 'blocked' : app.availability}`} role="status">{proofBlocked ? proofReason : app.availability === 'installable' ? label(settings, 'Reviewed installer', '已審核安裝程式') : app.availability === 'source-build' ? label(settings, 'Reviewed source route', '已審核 source 路線') : app.availability === 'documentation-only' ? label(settings, 'Documentation only', '只有文件') : label(settings, 'Not currently available', '目前未能使用')}</span>
        {discoveryOnly && <p className="operation-status warning" role="status">{label(settings, `Detected ${installedRecord?.version ?? 'unknown version'} from the reviewed ${installedRecord?.source ?? 'registry'} identity. This App Store did not install it, so install, update, and uninstall actions stay unavailable.`, `由已審核嘅 ${installedRecord?.source ?? 'registry'} 身份偵測到版本 ${installedRecord?.version ?? '不明'}。唔係呢個 App Store 安裝，所以安裝、更新同解除安裝操作都唔會開放。`)}</p>}
        <div className="card-actions">
          {!proofBlocked && managed && app.launchAvailable && <button className="filled-button" data-launch-action={app.id} {...el('button-filled')} disabled={operationBusy} aria-busy={launchBusy} aria-label={label(settings, `${launchBusy ? 'Launching' : 'Launch'} ${app.name}`, `${launchBusy ? '啟動緊' : '啟動'} ${app.name}`)} title={busyExplanation ?? label(settings, `Start ${app.name} from this App Store-managed installation.`, `由呢個 App Store 管理嘅安裝位置啟動 ${app.name}。`)} onClick={(event) => onAction('launch', app, event.currentTarget)}><Icon>open_in_new</Icon>{launchBusy ? label(settings, 'Launching…', '啟動緊…') : label(settings, 'Launch', '啟動')}</button>}
          {!proofBlocked && managed && !app.launchAvailable && <button className="tonal-button" disabled aria-label={label(settings, `Launch ${app.name} unavailable`, `${app.name} 未能啟動`)} title={label(settings, `Launch unavailable for ${app.name}: this adapter has no reviewed installed executable identity.`, `${app.name} 未能啟動：呢個適配器未有已審核嘅安裝程式身份。`)}><Icon>block</Icon>{label(settings, 'Launch unavailable', '未能啟動')}</button>}
          {!proofBlocked && app.availability === 'installable' && !discoveryOnly && <button className={managed ? 'tonal-button' : 'filled-button'} data-install-action={app.id} {...el(managed ? 'button-tonal' : 'button-filled')} disabled={operationBusy} aria-busy={installBusy} aria-label={label(settings, `${managed ? 'Reinstall' : 'Install'} ${app.name}`, `${managed ? '重新安裝' : '安裝'} ${app.name}`)} title={busyExplanation} onClick={(event) => onAction('install', app, event.currentTarget)}><Icon>download</Icon>{installBusy ? label(settings, 'Installing…', '安裝緊…') : label(settings, managed ? 'Reinstall' : 'Install', managed ? '重新安裝' : '安裝')}</button>}
          {!proofBlocked && app.availability === 'source-build' && !installedRecord && <button className="tonal-button" data-install-action={app.id} {...el('button-tonal')} disabled={operationBusy} aria-busy={sourceBusy} aria-label={label(settings, `Install ${app.name} from source`, `由 source 安裝 ${app.name}`)} title={busyExplanation} onClick={(event) => onAction('build', app, event.currentTarget)}><Icon>build</Icon>{sourceBusy ? label(settings, 'Preparing source install…', '準備緊 source 安裝…') : label(settings, 'Install from source', '由 source 安裝')}</button>}
          {managed && <button className="text-button danger" disabled={operationBusy} aria-label={label(settings, `Uninstall ${app.name}`, `解除安裝 ${app.name}`)} title={busyExplanation} onClick={(event) => onAction('uninstall', app, event.currentTarget)}><Icon>delete</Icon>{label(settings, 'Uninstall', '解除安裝')}</button>}
          {installBusy && installProgress?.cancellable && <button className="text-button" aria-label={label(settings, `Cancel installation of ${app.name}`, `取消 ${app.name} 安裝`)} onClick={(event) => onCancelInstall(app, event.currentTarget)}><Icon>cancel</Icon>{label(settings, 'Cancel install', '取消安裝')}</button>}
          {installBusy && installProgress?.phase === 'installer-running' && <span className="operation-status" role="status" aria-live="polite">{operationPhaseLabel(settings, installProgress.phase)}</span>}
          {installProgress?.final && installProgress.phase === 'unknown' && <span className="operation-status warning" role="alert" tabIndex={-1} data-operation-status={app.id}>{operationPhaseLabel(settings, installProgress.phase)}</span>}
          {!proofBlocked && managed && app.updateState === 'available' && app.installedVersion && managedUpdate?.status !== 'ready' && (
            <button className="tonal-button" data-update-download-action={app.id} disabled={operationBusy} aria-busy={managedUpdateBusy} aria-label={label(settings, `Download update for ${app.name}`, `下載 ${app.name} 更新`)} title={label(settings, `Download and verify the ${app.name} stable release. Installation starts only after you choose Install update.`, `下載同驗證 ${app.name} 穩定版本；只會喺你揀「安裝更新」之後先安裝。`)} onClick={(event) => onManagedUpdate('download', app, event.currentTarget)}>
              <Icon>download_for_offline</Icon>{managedUpdate?.status === 'downloading' ? label(settings, `Downloading ${managedUpdate.progress}%`, `下載緊 ${managedUpdate.progress}%`) : managedUpdate?.status === 'failed' || managedUpdate?.status === 'cancelled' ? label(settings, 'Retry update', '再試更新') : label(settings, 'Download update', '下載更新')}
            </button>
          )}
          {!proofBlocked && managed && managedUpdate?.status === 'downloading' && managedUpdate.appId === app.id && <button className="text-button" data-update-cancel-action={app.id} aria-label={label(settings, `Cancel ${app.name} update download`, `取消 ${app.name} 更新下載`)} title={label(settings, `Cancel the ${app.name} update download.`, `取消 ${app.name} 更新下載。`)} onClick={(event) => onManagedUpdate('cancel', app, event.currentTarget)}>{label(settings, 'Cancel', '取消')}</button>}
          {!proofBlocked && managed && managedUpdate?.status === 'ready' && managedUpdate.appId === app.id && <button className="filled-button" data-update-install-action={app.id} disabled={operationBusy} aria-label={label(settings, `Install update for ${app.name}`, `安裝 ${app.name} 更新`)} onClick={(event) => onManagedUpdate('install', app, event.currentTarget)} title={label(settings, `The verified ${app.name} installer is staged. Close the target application, then choose this explicit action to install it.`, `${app.name} 已驗證嘅安裝程式已暫存。先關閉目標應用程式，再揀呢個明確操作安裝。`)}><Icon>system_update_alt</Icon>{label(settings, 'Install update', '安裝更新')}</button>}
          {!proofBlocked && managed && managedUpdate?.status === 'ready' && managedUpdate.releaseNotesUrl && <a className="text-button" href={managedUpdate.releaseNotesUrl} target="_blank" rel="noreferrer">{label(settings, 'Release notes', '發行說明')}</a>}
          <button className="text-button" {...el('button-text')} onClick={() => window.document.getElementById(`docs-${app.id}`)?.focus()}><Icon>menu_book</Icon>{label(settings, 'Docs', '文件')}</button>
        </div>
        {installBusy && installProgress && <div className="operation-progress" role="status" aria-live="polite">
          {installProgress.progress === null ? <progress aria-label={label(settings, `${app.name} install progress`, `${app.name} 安裝進度`)} /> : <progress max={100} value={installProgress.progress} aria-label={label(settings, `${app.name} install progress`, `${app.name} 安裝進度`)} />}
          <span>{operationPhaseLabel(settings, installProgress.phase)}</span>
          {installProgress.bytesTotal !== null && <small>{installProgress.bytesReceived.toLocaleString()} / {installProgress.bytesTotal.toLocaleString()} bytes</small>}
        </div>}
        {managedUpdateBusy && managedUpdate?.status === 'downloading' && <div className="operation-progress managed-update-progress" role="status" aria-live="polite" data-update-progress={app.id}>
          <progress max={100} value={managedUpdate.progress} aria-label={label(settings, `${app.name} update download progress`, `${app.name} 更新下載進度`)} />
          <span>{label(settings, `Downloading ${app.name} update: ${managedUpdate.progress}%`, `下載緊 ${app.name} 更新：${managedUpdate.progress}%`)}</span>
          <small>{managedUpdate.bytesDownloaded.toLocaleString()} / {managedUpdate.bytesTotal.toLocaleString()} bytes</small>
        </div>}
      </div>
    </article>
  );
}

export function AppsPage({ mode, apps, installed, settings, loading, onAction, onManagedUpdate, onCancelInstall, managedUpdates, operationProgress, onBulkAction, runningAction, openRegex, onRegexHandled, notify }: {
  mode: AppsMode;
  apps: CatalogApp[];
  installed: InstalledAppRecord[];
  settings: UserSettings;
  loading: boolean;
  onAction(kind: ActionKind, app: CatalogApp, trigger: HTMLButtonElement): void;
  onManagedUpdate(kind: 'download' | 'cancel' | 'install', app: CatalogApp, trigger: HTMLButtonElement): void;
  onCancelInstall(app: CatalogApp, trigger: HTMLButtonElement): void;
  managedUpdates: Readonly<Record<string, ManagedUpdateState>>;
  operationProgress: Readonly<Record<string, OperationProgressEvent>>;
  onBulkAction(kind: ActionKind, apps: CatalogApp[], trigger: HTMLButtonElement): void;
  runningAction: RunningAction | null;
  openRegex: boolean;
  onRegexHandled(): void;
  notify: Notify;
}) {
  const search = useSurfaceSearch(mode);
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const lastSelected = useRef<number | null>(null);
  const installedById = useMemo(() => new Map(installed.map((record) => [record.appId, record])), [installed]);
  const scoped = useMemo(() => mode === 'installed' ? apps.filter((app) => app.installedVersion) : mode === 'updates' ? apps.filter((app) => app.proofStatus === 'verified' && app.updateState === 'available') : apps, [apps, mode]);
  const shown = useMemo(() => scoped.filter((app) => matcher(`${app.name}\n${app.description}\n${app.repository}`)), [scoped, matcher]);
  useEffect(() => {
    const ids = new Set(apps.map((app) => app.id));
    setSelected((current) => new Set([...current].filter((id) => ids.has(id))));
  }, [apps]);
  const selectedApps = shown.filter((app) => selected.has(app.id));
  const installable = selectedApps.filter((app) => app.proofStatus === 'verified' && app.availability === 'installable' && installationManagementState(installedById.get(app.id)) !== 'discovery-only');
  const sourceBuilds = selectedApps.filter((app) => app.proofStatus === 'verified' && app.availability === 'source-build' && !installedById.has(app.id));
  const installedApps = selectedApps.filter((app) => installationManagementState(installedById.get(app.id)) === 'store-managed');
  const launchableApps = installedApps.filter((app) => app.proofStatus === 'verified' && app.launchAvailable);
  const selectAt = (index: number, checked: boolean, shiftKey: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      const start = shiftKey && lastSelected.current !== null ? Math.min(lastSelected.current, index) : index;
      const end = shiftKey && lastSelected.current !== null ? Math.max(lastSelected.current, index) : index;
      for (let cursor = start; cursor <= end; cursor += 1) {
        const id = shown[cursor]?.id;
        if (!id) continue;
        if (checked) next.add(id); else next.delete(id);
      }
      return next;
    });
    lastSelected.current = index;
  };
  const exportSelection = async (openInCode: boolean) => {
    const records = selectedApps.length ? selectedApps : shown;
    const content = serializeStructuredExport({ kind: 'ding-ding-app-store.apps', schemaVersion: 1, scope: mode, exportedAt: new Date().toISOString(), apps: records });
    if (!openInCode) { downloadText(`ding-ding-app-store-${mode}.json`, content, 'application/json'); notify({ ok: true, message: `Exported ${records.length} ${mode} records.` }); return; }
    const result = await openExportInVsCode({ recordKind: mode === 'installed' ? 'installed' : 'catalog', suggestedName: `ding-ding-app-store-${mode}.json`, mime: 'application/json', content });
    notify({ ok: result.ok, message: result.ok ? `Opened ${records.length} ${mode} records in Visual Studio Code.` : result.message });
  };

  return (
    <>
      <SearchBox surface={mode} settings={settings} placeholder={label(settings, 'Search apps, descriptions, and repositories', '搵 app、描述同 repository')} openBuilder={openRegex} onBuilderHandled={onRegexHandled} />
      <div className="bulk-toolbar" aria-label={label(settings, `${mode} bulk actions`, `${mode} 批量操作`)}>
        <strong aria-live="polite">{label(settings, `${selectedApps.length} selected · ${shown.length} shown · ${scoped.length} total`, `揀咗 ${selectedApps.length} · 顯示 ${shown.length} · 總共 ${scoped.length}`)}</strong>
          {runningAction && <span className="bulk-progress" role="status" aria-live="polite"><progress max={runningAction.total} value={runningAction.completed} aria-label={label(settings, 'Bulk operation progress', '批量操作進度')} /> {label(settings, `${runningAction.completed} of ${runningAction.total} finished`, `完成 ${runningAction.completed}／${runningAction.total}`)}{operationProgress[runningAction.appId] ? ` · ${operationPhaseLabel(settings, operationProgress[runningAction.appId].phase)}` : ''}</span>}
        <button className="text-button" disabled={!shown.length} onClick={() => setSelected(new Set(shown.map((app) => app.id)))}>{label(settings, 'Select all shown', '揀晒目前顯示')}</button>
        <button className="text-button" disabled={!shown.length} onClick={() => setSelected((current) => new Set(shown.filter((app) => !current.has(app.id)).map((app) => app.id)))}>{label(settings, 'Invert shown', '反轉目前顯示')}</button>
        <button className="text-button" disabled={!selected.size} onClick={() => setSelected(new Set())}>{label(settings, 'Clear', '清除')}</button>
        <button className="tonal-button" disabled={!installable.length || runningAction !== null} onClick={(event) => onBulkAction('install', installable, event.currentTarget)}>{label(settings, `Install ${installable.length}`, `安裝 ${installable.length}`)}</button>
        <button className="tonal-button" disabled={!launchableApps.length || runningAction !== null} onClick={(event) => onBulkAction('launch', launchableApps, event.currentTarget)}>{label(settings, `Launch ${launchableApps.length}`, `啟動 ${launchableApps.length}`)}</button>
        <button className="tonal-button" disabled={!sourceBuilds.length || runningAction !== null} onClick={(event) => onBulkAction('build', sourceBuilds, event.currentTarget)}>{label(settings, `Build ${sourceBuilds.length}`, `建置 ${sourceBuilds.length}`)}</button>
        <button className="text-button danger" disabled={!installedApps.length || runningAction !== null} onClick={(event) => onBulkAction('uninstall', installedApps, event.currentTarget)}>{label(settings, `Uninstall ${installedApps.length}`, `解除安裝 ${installedApps.length}`)}</button>
        <button className="text-button" disabled={!shown.length} onClick={() => void exportSelection(false)}><Icon>download</Icon>{label(settings, `Export ${selectedApps.length || shown.length}`, `匯出 ${selectedApps.length || shown.length}`)}</button>
        <button className="text-button" disabled={!shown.length || !isExternalEditorBridgeAvailable()} title={isExternalEditorBridgeAvailable() ? undefined : label(settings, 'Unavailable: this build has no reviewed Visual Studio Code adapter.', '未能使用：呢個版本冇已審核嘅 Visual Studio Code 適配器。')} onClick={() => void exportSelection(true)}><Icon>code</Icon>{isExternalEditorBridgeAvailable() ? label(settings, 'Open in VS Code', '喺 VS Code 開') : label(settings, 'VS Code unavailable', 'VS Code 未能使用')}</button>
      </div>
      {loading && <div className="loading-grid" aria-label={label(settings, 'Loading catalog', '載入緊目錄')}>{Array.from({ length: 6 }, (_, index) => <div className="skeleton" key={index} />)}</div>}
      {!loading && (shown.length
        ? <section className="app-grid">{shown.map((app, index) => <AppCard key={app.id} app={app} installedRecord={installedById.get(app.id)} settings={settings} onAction={onAction} onManagedUpdate={onManagedUpdate} onCancelInstall={onCancelInstall} managedUpdate={managedUpdates[app.id]} operationProgress={operationProgress[app.id]} runningAction={runningAction} searchLabel={highlight(search.state, app.name)} selected={selected.has(app.id)} onSelect={(checked, shiftKey) => selectAt(index, checked, shiftKey)} />)}</section>
        : <div className="empty-state" {...el('empty-state')}><Icon>search_off</Icon><h2>{label(settings, 'No matching apps', '冇符合嘅 app')}</h2><p>{label(settings, 'The current search and tab filters found nothing. Clear the query or refresh the catalog.', '目前搜尋同分頁篩選冇搵到結果。清除搜尋或者重新整理目錄。')}</p></div>)}
    </>
  );
}
