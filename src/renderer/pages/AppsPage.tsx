import { useMemo } from 'react';
import type { ReactNode } from 'react';
import type { CatalogApp, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import { highlight, makeMatcher, useSurfaceSearch } from '../search';
import type { ActionKind, ImmediateActionKind } from '../components/ActionDialog';
import { SearchBox } from '../components/SearchBox';

export type AppsMode = 'catalog' | 'installed' | 'updates';

export interface RunningAction {
  kind: ImmediateActionKind;
  appId: string;
}

export function AppCard({ app, settings, onAction, searchLabel, runningAction }: { app: CatalogApp; settings: UserSettings; onAction: (kind: ActionKind, app: CatalogApp, trigger: HTMLButtonElement) => void; searchLabel: ReactNode; runningAction: RunningAction | null }) {
  const operationBusy = runningAction !== null;
  const installBusy = runningAction?.appId === app.id && runningAction.kind === 'install';
  const sourceBusy = runningAction?.appId === app.id && runningAction.kind === 'build';
  const busyExplanation = operationBusy ? 'Wait for the current installation to finish before starting another action.' : undefined;
  return (
    <article className="app-card" {...el('app-card')}>
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

export function AppsPage({ mode, apps, settings, loading, onAction, runningAction, openRegex, onRegexHandled }: {
  mode: AppsMode;
  apps: CatalogApp[];
  settings: UserSettings;
  loading: boolean;
  onAction(kind: ActionKind, app: CatalogApp, trigger: HTMLButtonElement): void;
  runningAction: RunningAction | null;
  openRegex: boolean;
  onRegexHandled(): void;
}) {
  const search = useSurfaceSearch(mode);
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const shown = useMemo(() => {
    const scoped = mode === 'installed' ? apps.filter((app) => app.installedVersion) : mode === 'updates' ? apps.filter((app) => app.updateState === 'available') : apps;
    return scoped.filter((app) => matcher(`${app.name}\n${app.description}\n${app.repository}`));
  }, [apps, mode, matcher]);

  return (
    <>
      <SearchBox surface={mode} placeholder={label(settings, 'Search apps, descriptions, and repositories', '搵 app、描述同 repository')} openBuilder={openRegex} onBuilderHandled={onRegexHandled} />
      {loading && <div className="loading-grid" aria-label="Loading catalog">{Array.from({ length: 6 }, (_, index) => <div className="skeleton" key={index} />)}</div>}
      {!loading && (shown.length
        ? <section className="app-grid">{shown.map((app) => <AppCard key={app.id} app={app} settings={settings} onAction={onAction} runningAction={runningAction} searchLabel={highlight(search.state, app.name)} />)}</section>
        : <div className="empty-state" {...el('empty-state')}><Icon>search_off</Icon><h2>No matching apps</h2><p>The current search and tab filters found nothing. Clear the query or refresh the catalog.</p></div>)}
    </>
  );
}
