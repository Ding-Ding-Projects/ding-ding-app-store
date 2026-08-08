import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { CatalogApp, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import { highlight, makeMatcher, useSurfaceSearch } from '../search';
import type { ActionKind, ImmediateActionKind } from '../components/ActionDialog';
import { SearchBox } from '../components/SearchBox';
import { downloadText } from '../files';
import { openExportInVsCode } from '../external-editor';
import type { Notify } from '../notify';

export type AppsMode = 'catalog' | 'installed' | 'updates';

export interface RunningAction {
  kind: ImmediateActionKind;
  appId: string;
}

export function AppCard({ app, settings, onAction, searchLabel, runningAction, selected, onSelect }: { app: CatalogApp; settings: UserSettings; onAction: (kind: ActionKind, app: CatalogApp, trigger: HTMLButtonElement) => void; searchLabel: ReactNode; runningAction: RunningAction | null; selected: boolean; onSelect(checked: boolean, shiftKey: boolean): void }) {
  const operationBusy = runningAction !== null;
  const installBusy = runningAction?.appId === app.id && runningAction.kind === 'install';
  const sourceBusy = runningAction?.appId === app.id && runningAction.kind === 'build';
  const busyExplanation = operationBusy ? 'Wait for the current installation to finish before starting another action.' : undefined;
  return (
    <article className="app-card" {...el('app-card')}>
      <label className="selection-check app-selection"><input type="checkbox" checked={selected} onClick={(event) => onSelect(event.currentTarget.checked, event.shiftKey)} onChange={() => undefined} /><span className="visually-hidden">Select {app.name}</span></label>
      <div className="app-avatar" aria-hidden="true">{app.name.slice(0, 2).toUpperCase()}</div>
      <div className="app-copy">
        <div className="card-heading"><h3 {...el('app-card-title')}>{searchLabel}</h3><span className={`status-pill ${app.updateState}`} {...el('status-pill')}>{app.updateState.replaceAll('-', ' ')}</span></div>
        <p {...el('app-card-description')}>{app.description}</p>
        <div className="meta"><span><Icon>deployed_code</Icon>{app.latestVersion ?? 'No stable release'}</span><span><Icon>download</Icon>{app.packageType}</span><span><Icon>star</Icon>{app.stars}</span></div>
        <div className="card-actions">
          {app.availability === 'installable' && <button className="filled-button" {...el('button-filled')} disabled={operationBusy} aria-busy={installBusy} title={busyExplanation} onClick={(event) => onAction('install', app, event.currentTarget)}><Icon>download</Icon>{installBusy ? label(settings, 'Installing…', '安裝緊…') : label(settings, app.installedVersion ? 'Reinstall' : 'Install', app.installedVersion ? '重新安裝' : '安裝')}</button>}
          {app.availability === 'source-build' && <button className="tonal-button" {...el('button-tonal')} disabled={operationBusy} aria-busy={sourceBusy} title={busyExplanation} onClick={(event) => onAction('build', app, event.currentTarget)}><Icon>build</Icon>{sourceBusy ? label(settings, 'Preparing source install…', '準備緊 source 安裝…') : label(settings, 'Install from source', '由 source 安裝')}</button>}
          {app.installedVersion && <button className="text-button danger" disabled={operationBusy} title={busyExplanation} onClick={(event) => onAction('uninstall', app, event.currentTarget)}><Icon>delete</Icon>{label(settings, 'Uninstall', '解除安裝')}</button>}
          <button className="text-button" {...el('button-text')} onClick={() => window.document.getElementById(`docs-${app.id}`)?.focus()}><Icon>menu_book</Icon>{label(settings, 'Docs', '文件')}</button>
        </div>
      </div>
    </article>
  );
}

export function AppsPage({ mode, apps, settings, loading, onAction, onBulkAction, runningAction, openRegex, onRegexHandled, notify }: {
  mode: AppsMode;
  apps: CatalogApp[];
  settings: UserSettings;
  loading: boolean;
  onAction(kind: ActionKind, app: CatalogApp, trigger: HTMLButtonElement): void;
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
  const shown = useMemo(() => {
    const scoped = mode === 'installed' ? apps.filter((app) => app.installedVersion) : mode === 'updates' ? apps.filter((app) => app.updateState === 'available') : apps;
    return scoped.filter((app) => matcher(`${app.name}\n${app.description}\n${app.repository}`));
  }, [apps, mode, matcher]);
  useEffect(() => {
    const ids = new Set(apps.map((app) => app.id));
    setSelected((current) => new Set([...current].filter((id) => ids.has(id))));
  }, [apps]);
  const selectedApps = shown.filter((app) => selected.has(app.id));
  const installable = selectedApps.filter((app) => app.availability === 'installable');
  const sourceBuilds = selectedApps.filter((app) => app.availability === 'source-build');
  const installedApps = selectedApps.filter((app) => Boolean(app.installedVersion));
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
    const content = JSON.stringify({ schemaVersion: 1, scope: mode, exportedAt: new Date().toISOString(), apps: records }, null, 2);
    if (!openInCode) { downloadText(`ding-ding-app-store-${mode}.json`, content, 'application/json'); notify({ ok: true, message: `Exported ${records.length} ${mode} records.` }); return; }
    const result = await openExportInVsCode({ recordKind: mode === 'catalog' ? 'catalog' : 'installed', suggestedName: `ding-ding-app-store-${mode}.json`, mime: 'application/json', content });
    notify({ ok: result.ok, message: result.ok ? `Opened ${records.length} ${mode} records in Visual Studio Code.` : result.message });
  };

  return (
    <>
      <SearchBox surface={mode} placeholder={label(settings, 'Search apps, descriptions, and repositories', '搵 app、描述同 repository')} openBuilder={openRegex} onBuilderHandled={onRegexHandled} />
      <div className="bulk-toolbar" aria-label={`${mode} bulk actions`}>
        <strong aria-live="polite">{selectedApps.length} selected · {shown.length} shown · {apps.length} total</strong>
        <button className="text-button" disabled={!shown.length} onClick={() => setSelected(new Set(shown.map((app) => app.id)))}>Select all shown</button>
        <button className="text-button" disabled={!shown.length} onClick={() => setSelected((current) => new Set(shown.filter((app) => !current.has(app.id)).map((app) => app.id)))}>Invert shown</button>
        <button className="text-button" disabled={!selected.size} onClick={() => setSelected(new Set())}>Clear</button>
        <button className="tonal-button" disabled={!installable.length || runningAction !== null} onClick={(event) => onBulkAction('install', installable, event.currentTarget)}>Install {installable.length}</button>
        <button className="tonal-button" disabled={!sourceBuilds.length || runningAction !== null} onClick={(event) => onBulkAction('build', sourceBuilds, event.currentTarget)}>Build {sourceBuilds.length}</button>
        <button className="text-button danger" disabled={!installedApps.length || runningAction !== null} onClick={(event) => onBulkAction('uninstall', installedApps, event.currentTarget)}>Uninstall {installedApps.length}</button>
        <button className="text-button" disabled={!shown.length} onClick={() => void exportSelection(false)}><Icon>download</Icon>Export {selectedApps.length || shown.length}</button>
        <button className="text-button" disabled={!shown.length} onClick={() => void exportSelection(true)}><Icon>code</Icon>Open in VS Code</button>
      </div>
      {loading && <div className="loading-grid" aria-label="Loading catalog">{Array.from({ length: 6 }, (_, index) => <div className="skeleton" key={index} />)}</div>}
      {!loading && (shown.length
        ? <section className="app-grid">{shown.map((app, index) => <AppCard key={app.id} app={app} settings={settings} onAction={onAction} runningAction={runningAction} searchLabel={highlight(search.state, app.name)} selected={selected.has(app.id)} onSelect={(checked, shiftKey) => selectAt(index, checked, shiftKey)} />)}</section>
        : <div className="empty-state" {...el('empty-state')}><Icon>search_off</Icon><h2>No matching apps</h2><p>The current search and tab filters found nothing. Clear the query or refresh the catalog.</p></div>)}
    </>
  );
}
