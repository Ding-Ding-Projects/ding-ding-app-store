import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_SCHEDULE, TAB_GROUP_COLORS } from '../shared/contracts';
import type {
  AppStoreUpdateState,
  CatalogApp,
  CatalogSnapshot,
  ElementKey,
  HistoryEntry,
  InstalledAppRecord,
  TabGroup,
  TabGroupColor,
  TabId,
  TabRailLayout,
  TokenId,
  UserSettings,
} from '../shared/contracts';
import { ActionDialog } from './components/ActionDialog';
import type { ActionKind } from './components/ActionDialog';
import { AppearancePanel } from './components/AppearancePanel';
import { CommandPalette } from './components/CommandPalette';
import { TabRail } from './components/TabRail';
import { el } from './el';
import { downloadText, pickTextFile } from './files';
import { Icon } from './icons';
import { formatAbsolute, label } from './i18n';
import type { Notice } from './notify';
import { AppsPage } from './pages/AppsPage';
import { ActivityPage } from './pages/ActivityPage';
import { DocsPage } from './pages/DocsPage';
import { SettingsPage } from './pages/SettingsPage';
import { buildRegistry, SETTING_FIELDS, TAB_META } from './registry';
import type { Action, SettingsSubTabId, TokenValue } from './registry';
import { SearchContext, useSearchStates } from './search';
import type { SurfaceId } from './search';
import { useAppearance, useAppearanceVars } from './state/use-appearance';
import { useSchedule } from './state/use-schedule';
import { useSettings } from './state/use-settings';
import { newGroupId, orderedTabIds, useWorkspace } from './state/use-workspace';

const PAGE_SUBTITLE: Partial<Record<TabId, { en: string; yue: string }>> = {
  catalog: { en: 'Trusted apps, their releases, and their complete documentation in one place.', yue: '可信 apps、release 同完整文件，一個位睇晒。' },
  updates: { en: 'Check every installed app and the store itself without surprise restarts.', yue: '檢查所有已安裝 app 同商店自己，唔會突然重開。' },
  activity: { en: 'Every install, build, and uninstall you ran, with exact results and export.', yue: '你做過嘅安裝、build 同解除安裝，連結果同匯出都齊。' },
  docs: { en: 'Every shipped feature has an offline article, including tabs, appearance, and the schedule.', yue: '每個功能都有離線文章，分頁、外觀同排程都有。' },
  settings: { en: 'Every section has its own search, its own tab navigation, and its own reset.', yue: '每個分類都有自己嘅搜尋、分頁同重設。' },
};

export function App() {
  const [toast, setToast] = useState<Notice | null>(null);
  const notify = useCallback((notice: Notice) => setToast(notice), []);

  const { settings, save: saveSettings, patch: patchSetting } = useSettings(notify);
  const workspace = useWorkspace(notify);
  const appearance = useAppearance(notify);
  const schedule = useSchedule(notify);
  const search = useSearchStates();
  useAppearanceVars(appearance.elements);

  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [installed, setInstalled] = useState<InstalledAppRecord[]>([]);
  const [action, setAction] = useState<{ kind: ActionKind; app: CatalogApp } | null>(null);
  const [updateState, setUpdateState] = useState<AppStoreUpdateState>({ status: 'idle' });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [regexRequest, setRegexRequest] = useState<SurfaceId | null>(null);
  const [overflowRequest, setOverflowRequest] = useState(false);
  const [renameRequest, setRenameRequest] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SettingsSubTabId>('settings.general');
  const [docRequest, setDocRequest] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [pendingToken, setPendingToken] = useState<{ token: TokenId; value: TokenValue } | null>(null);

  const activeTab = workspace.workspace.activeTabId;
  const announce = useCallback((message: string) => setAnnouncement(message), []);

  const loadCatalog = useCallback(async (refresh = false) => {
    setLoading(true);
    try { setCatalog(refresh ? await window.dingDingStore.catalog.refresh() : await window.dingDingStore.catalog.list()); }
    catch (error) { notify({ ok: false, message: (error as Error).message }); }
    finally { setLoading(false); }
  }, [notify]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try { setHistory(await window.dingDingStore.history.list()); }
    finally { setHistoryLoading(false); }
  }, []);

  const loadInstalled = useCallback(async () => {
    try { setInstalled(await window.dingDingStore.operations.installed()); }
    catch (error) { notify({ ok: false, message: (error as Error).message }); }
  }, [notify]);

  useEffect(() => {
    void loadCatalog();
    void loadHistory();
    void loadInstalled();
    return window.dingDingStore.updates.subscribe(setUpdateState);
  }, [loadCatalog, loadHistory, loadInstalled]);

  const apps = useMemo(() => {
    const versions = new Map(installed.map((record) => [record.appId, record.version]));
    return (catalog?.apps ?? []).map((item) => ({ ...item, installedVersion: versions.get(item.id) ?? item.installedVersion }));
  }, [catalog, installed]);

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
    if (surface.startsWith('settings.')) {
      workspace.dispatch({ type: 'activate', id: 'settings' });
      setSubTab(surface as SettingsSubTabId);
      return;
    }
    if (surface === 'tabs' || surface === 'palette' || surface === 'appearance.elements') return;
    workspace.dispatch({ type: 'activate', id: surface as TabId });
  }, [workspace]);

  const focusLater = (id: string) => window.setTimeout(() => window.document.getElementById(id)?.focus(), 0);

  const selectElement = useCallback((key: ElementKey) => {
    appearance.select(key);
    appearance.setEditMode(true);
    setPanelOpen(true);
  }, [appearance]);

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
    switch (verb) {
      case 'refresh-catalog': case 'refresh-catalog-now': void loadCatalog(true); return;
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
      case 'export-tabs': void workspace.exportLayout().then((content) => downloadText('ding-ding-app-store-tabs.json', content, 'application/json')); return;
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
      case 'export-appearance': void appearance.exportDocument().then((content) => downloadText('ding-ding-app-store-appearance.json', content, 'application/json')); return;
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
  }, [loadCatalog, search, openSurface, workspace, deleteGroup, createGroup, notify, railPatch, appearance, selectElement, schedule, patchSetting, catalog]);

  const dispatchAction = useCallback((next: Action) => {
    switch (next.type) {
      case 'open-surface': openSurface(next.surface); return;
      case 'set-setting': {
        if (next.value === null) {
          const field = SETTING_FIELDS.find((row) => row.key === next.key);
          openSurface(field?.section === 'general' ? 'settings.general' : 'settings.appearance');
          focusLater(`setting-${next.key}`);
          return;
        }
        void patchSetting(next.key, next.value as UserSettings[keyof UserSettings]);
        return;
      }
      case 'set-appearance': {
        selectElement(next.target);
        if (next.value !== null) setPendingToken({ token: next.token, value: next.value });
        return;
      }
      case 'set-schedule': {
        if (next.value === null) {
          openSurface('settings.schedule');
          focusLater(`schedule-${next.key.replace('.', '-')}`);
          return;
        }
        void schedule.applyNow([[next.key, next.value]]);
        return;
      }
      case 'command': runCommand(next.command); return;
      default: return;
    }
  }, [openSurface, patchSetting, selectElement, appearance, schedule, runCommand]);

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
        const order = orderedTabIds(workspace.workspace);
        const index = order.indexOf(activeTab);
        const target = order[(index + (event.shiftKey ? -1 : 1) + order.length) % order.length];
        workspace.dispatch({ type: 'activate', id: target });
        announce(`${TAB_META[target].en} tab`);
        return;
      }
      if (event.ctrlKey && !event.shiftKey && /^[1-6]$/.test(event.key)) {
        const order = orderedTabIds(workspace.workspace);
        const target = order[Number(event.key) - 1];
        if (target) { event.preventDefault(); workspace.dispatch({ type: 'activate', id: target }); announce(`${TAB_META[target].en} tab`); }
        return;
      }
      if (event.key === 'Escape') {
        if (paletteOpen) { setPaletteOpen(false); return; }
        if (action) { setAction(null); return; }
        if (panelOpen) { setPanelOpen(false); return; }
        if (appearance.editMode) { appearance.setEditMode(false); announce('Appearance edit mode off'); return; }
        search.dispatch({ type: 'clear', surface: 'tabs' });
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [activeTab, workspace, runCommand, createGroup, announce, paletteOpen, action, panelOpen, appearance, search]);

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

  const updatesBadge = Boolean(catalog?.apps.some((app) => app.updateState === 'available') || updateState.status === 'ready');
  const entries = useMemo(() => buildRegistry({
    settings,
    workspace: workspace.workspace,
    appearance: appearance.document.elements,
    schedule: schedule.draft ?? DEFAULT_SCHEDULE,
    apps: catalog?.apps ?? [],
  }), [settings, workspace.workspace, appearance.document, schedule.draft, catalog]);

  const meta = TAB_META[activeTab];
  const subtitle = PAGE_SUBTITLE[activeTab];
  const rail = workspace.workspace.rail;

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
          <div className="brand-mark" aria-hidden="true"><Icon>storefront</Icon></div>
          <strong {...el('titlebar-brand')}>{settings.displayName}</strong>
          <span className="dev-badge" {...el('titlebar-badge')}>Preview 0.1.0</span>
          <div className="drag-space" />
          <button onClick={() => window.dingDingStore.window.minimize()} aria-label="Minimize"><Icon>remove</Icon></button>
          <button onClick={() => window.dingDingStore.window.toggleMaximize()} aria-label="Maximize or restore"><Icon>crop_square</Icon></button>
          <button className="close-window" onClick={() => window.dingDingStore.window.close()} aria-label="Close"><Icon>close</Icon></button>
        </header>

        <TabRail
          settings={settings}
          workspace={workspace.workspace}
          dispatch={workspace.dispatch}
          updatesBadge={updatesBadge}
          onOpenPalette={() => setPaletteOpen(true)}
          announce={announce}
          openOverflow={overflowRequest}
          onOverflowHandled={() => setOverflowRequest(false)}
          openTabRegex={regexRequest === 'tabs'}
          onTabRegexHandled={() => setRegexRequest(null)}
          renameGroupId={renameRequest}
          onRenameHandled={() => setRenameRequest(null)}
        />

        <main className="content" id="surface-panel" role="tabpanel" aria-labelledby={`tab-${activeTab}`} {...el('content-surface')}>
          {(updateState.status === 'available' || updateState.status === 'downloading' || updateState.status === 'ready' || updateState.status === 'failed') && (
            <section className={`update-banner ${updateState.status}`} role="status" {...el('update-banner')}>
              <Icon>system_update</Icon>
              <div>
                <strong>{updateState.status === 'ready' ? `Ding Ding App Store ${updateState.version} is ready` : updateState.status === 'available' ? `Version ${updateState.version} is available` : updateState.status === 'downloading' ? 'Downloading update…' : 'Update check failed'}</strong>
                <p>{updateState.status === 'failed' ? updateState.message : 'Unsigned artifact: HTTPS feed metadata and package hashes protect transport integrity; no code signature is claimed.'}</p>
              </div>
              {updateState.status === 'available' && <button className="filled-button" onClick={() => void window.dingDingStore.updates.downloadStore().then(setUpdateState)}>Download</button>}
              {updateState.status === 'ready' && <><button className="text-button">Later</button><button className="filled-button" onClick={() => void window.dingDingStore.updates.restartStore()}>Restart to install update</button></>}
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
              settings={settings}
              loading={loading}
              onAction={(kind, app) => setAction({ kind, app })}
              openRegex={regexRequest === activeTab}
              onRegexHandled={() => setRegexRequest(null)}
            />
          )}
          {activeTab === 'docs' && <DocsPage settings={settings} openRegex={regexRequest === 'docs'} onRegexHandled={() => setRegexRequest(null)} articleRequest={docRequest} onArticleHandled={() => setDocRequest(null)} />}
          {activeTab === 'activity' && <ActivityPage entries={history} loading={historyLoading} settings={settings} openRegex={regexRequest === 'activity'} onRegexHandled={() => setRegexRequest(null)} />}
          {activeTab === 'settings' && (
            <SettingsPage
              settings={settings}
              onSave={(value) => void saveSettings(value)}
              workspace={workspace}
              appearance={appearance}
              schedule={schedule}
              notify={notify}
              subTab={subTab}
              onSubTab={setSubTab}
              regexRequest={regexRequest}
              onRegexHandled={() => setRegexRequest(null)}
            />
          )}
        </main>

        {panelOpen && appearance.editMode && <AppearancePanel appearance={appearance} settings={settings} notify={notify} onClose={() => setPanelOpen(false)} />}

        {action && <ActionDialog action={action} settings={settings} onClose={() => setAction(null)} onResult={(result) => { notify({ ok: result.ok, message: result.message }); void loadHistory(); void loadInstalled(); if (result.ok) void loadCatalog(true); }} />}

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

        {toast && (
          <div className={`snackbar ${toast.ok ? 'success' : 'error'}`} role="status" {...el('snackbar')}>
            <Icon>{toast.ok ? 'check_circle' : 'error'}</Icon>
            <span>{toast.message}</span>
            {toast.undo && <button className="text-button" onClick={() => { toast.undo?.run(); setToast(null); }}>{toast.undo.label}</button>}
            <button className="icon-button" {...el('icon-button')} onClick={() => setToast(null)} aria-label="Dismiss notification"><Icon>close</Icon></button>
          </div>
        )}

        <div className="visually-hidden" role="status" aria-live="polite">{announcement}</div>
      </div>
    </SearchContext.Provider>
  );
}
