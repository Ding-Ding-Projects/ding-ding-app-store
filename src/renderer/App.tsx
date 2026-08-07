import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppStoreUpdateState,
  CatalogApp,
  CatalogSnapshot,
  OperationResult,
  UserSettings,
} from '../shared/contracts';

type TabId = 'catalog' | 'installed' | 'updates' | 'docs' | 'activity' | 'settings';
type ActionKind = 'install' | 'build' | 'uninstall';

const tabs: Array<{ id: TabId; icon: string; en: string; yue: string }> = [
  { id: 'catalog', icon: 'apps', en: 'Discover', yue: '搵 App' },
  { id: 'installed', icon: 'inventory_2', en: 'Installed', yue: '已安裝' },
  { id: 'updates', icon: 'system_update', en: 'Updates', yue: '更新' },
  { id: 'docs', icon: 'menu_book', en: 'Documentation', yue: '文件' },
  { id: 'activity', icon: 'history', en: 'Activity', yue: '記錄' },
  { id: 'settings', icon: 'settings', en: 'Settings', yue: '設定' },
];

const defaultSettings: UserSettings = {
  language: 'bilingual',
  englishFunnyLevel: 2,
  cantoneseFunnyLevel: 4,
  theme: 'system',
  density: 'comfortable',
  accent: '#6750A4',
  displayName: 'Ding Ding App Store',
};

const docs = [
  { id: 'catalog', title: 'Catalog discovery · App 目錄', body: 'The catalog is a reviewed allowlist of public Ding Ding Projects applications. Live repository and stable-release metadata refreshes from GitHub; private repositories and infrastructure are excluded.' },
  { id: 'install', title: 'Verified silent install · 驗證靜默安裝', body: 'Only a reviewed adapter may install. The main process selects the asset, requires a GitHub SHA-256 digest, enforces size and origin limits, and observes the installer exit code.' },
  { id: 'source', title: 'Build from source · 由 source build', body: 'Source recipes are declared per app. Execution is withheld unless a disposable Windows Sandbox runner is available; repository scripts never run directly on the host.' },
  { id: 'uninstall', title: 'Protected uninstall · 安全解除安裝', body: 'Removal uses the exact uninstall entry recorded after install. Both key controls and the full confirmation slider are required before the action can run.' },
  { id: 'updates', title: 'Update checker · 更新檢查', body: 'Installed versions are compared with trusted stable releases. The store self-updater stages unsigned Squirrel packages but restarts only after the user chooses Restart to install update.' },
  { id: 'security', title: 'Security boundaries · 安全邊界', body: 'The renderer is sandboxed with no Node access. It can request only typed app IDs and confirmations; URLs, commands, paths, and installer arguments remain main-process-owned.' },
];

function label(settings: UserSettings, en: string, yue: string): string {
  if (settings.language === 'en') return en;
  if (settings.language === 'yue') return yue;
  return `${en} · ${yue}`;
}

const iconMap: Record<string, string> = {
  apps: '⊞', inventory_2: '▣', system_update: '↻', menu_book: '▤', history: '◴', settings: '⚙',
  close: '×', search: '⌕', regular_expression: '.*', deployed_code: '◆', download: '↓', star: '★',
  build: '⌁', delete: '⌫', storefront: '◈', remove: '−', crop_square: '□', refresh: '↻', wifi_off: '⌁',
  search_off: '∅', arrow_forward: '→', check_circle: '✓', error: '!',
};

function Icon({ children }: { children: string }) {
  return <span className="material-symbol" aria-hidden="true">{iconMap[children] ?? '•'}</span>;
}

function RegexBuilder({ query, onApply, onClose }: { query: string; onApply: (pattern: string, flags: string) => void; onClose: () => void }) {
  const [pattern, setPattern] = useState(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const [flags, setFlags] = useState('iu');
  const [sample, setSample] = useState('Material BlueMap\nDesktop Material\nWimForge');
  const result = useMemo(() => {
    try {
      const expression = new RegExp(pattern.slice(0, 160), flags.replace('g', '') + 'g');
      const matches = Array.from(sample.slice(0, 10_000).matchAll(expression)).slice(0, 100);
      return { error: '', matches: matches.map((match) => ({ text: match[0], groups: match.slice(1) })) };
    } catch (error) {
      return { error: (error as Error).message, matches: [] };
    }
  }, [pattern, flags, sample]);
  const add = (value: string) => setPattern((current) => `${current}${value}`.slice(0, 160));

  return (
    <section className="popover regex-builder" role="dialog" aria-label="Regex builder">
      <header><strong>Regex builder · Regex 建造器</strong><button className="icon-button" onClick={onClose} aria-label="Close regex builder"><Icon>close</Icon></button></header>
      <div className="chip-row" aria-label="Guided regex parts">
        <button onClick={() => add('literal')}>Literal</button><button onClick={() => add('[A-Za-z]')}>Class</button>
        <button onClick={() => add('^')}>Anchor</button><button onClick={() => add('(group)')}>Group</button>
        <button onClick={() => add('|')}>Alternation</button><button onClick={() => add('{1,3}')}>Quantifier</button>
      </div>
      <label>Pattern<input value={pattern} maxLength={160} onChange={(event) => setPattern(event.target.value)} /></label>
      <fieldset><legend>Flags</legend>{['i', 'm', 's', 'u'].map((flag) => <label className="flag" key={flag}><input type="checkbox" checked={flags.includes(flag)} onChange={(event) => setFlags((current) => event.target.checked ? `${current}${flag}` : current.replace(flag, ''))} />{flag}</label>)}</fieldset>
      <label>Sample text<textarea value={sample} maxLength={10_000} onChange={(event) => setSample(event.target.value)} /></label>
      {result.error ? <p className="field-error" role="alert">{result.error}</p> : <p className="match-result">{result.matches.length} matches · {result.matches.map((match) => match.text || 'zero-width').join(', ') || 'No match'}</p>}
      <footer><button className="text-button" onClick={() => navigator.clipboard.writeText(`/${pattern}/${flags}`)}>Copy</button><button className="filled-button" disabled={Boolean(result.error) || !pattern} onClick={() => onApply(pattern, flags)}>Apply to search</button></footer>
    </section>
  );
}

function SearchBox({ value, onChange, regexMode, onRegexMode, placeholder }: { value: string; onChange: (value: string) => void; regexMode: { pattern: string; flags: string } | null; onRegexMode: (mode: { pattern: string; flags: string } | null) => void; placeholder: string }) {
  const [builderOpen, setBuilderOpen] = useState(false);
  return (
    <div className="search-wrap">
      <Icon>search</Icon><input type="search" value={value} maxLength={160} onChange={(event) => { onChange(event.target.value); if (regexMode) onRegexMode({ ...regexMode, pattern: event.target.value }); }} placeholder={placeholder} aria-label={placeholder} />
      {regexMode && <span className="regex-chip">/{regexMode.flags}</span>}
      <button className="icon-button" aria-label="Open full regex builder" aria-expanded={builderOpen} onClick={() => setBuilderOpen((open) => !open)}><Icon>regular_expression</Icon></button>
      {builderOpen && <RegexBuilder query={value} onClose={() => setBuilderOpen(false)} onApply={(pattern, flags) => { onChange(pattern); onRegexMode({ pattern, flags }); setBuilderOpen(false); }} />}
    </div>
  );
}

function AppCard({ app, settings, onAction }: { app: CatalogApp; settings: UserSettings; onAction: (kind: ActionKind, app: CatalogApp) => void }) {
  return (
    <article className="app-card">
      <div className="app-avatar" aria-hidden="true">{app.name.slice(0, 2).toUpperCase()}</div>
      <div className="app-copy">
        <div className="card-heading"><h3>{app.name}</h3><span className={`status-pill ${app.updateState}`}>{app.updateState.replaceAll('-', ' ')}</span></div>
        <p>{app.description}</p>
        <div className="meta"><span><Icon>deployed_code</Icon>{app.latestVersion ?? 'No stable release'}</span><span><Icon>download</Icon>{app.packageType}</span><span><Icon>star</Icon>{app.stars}</span></div>
        <div className="card-actions">
          {app.availability === 'installable' && <button className="filled-button" onClick={() => onAction('install', app)}><Icon>download</Icon>{label(settings, app.installedVersion ? 'Reinstall' : 'Install', app.installedVersion ? '重新安裝' : '安裝')}</button>}
          {app.availability === 'source-build' && <button className="tonal-button" onClick={() => onAction('build', app)}><Icon>build</Icon>{label(settings, 'Build source', '由 source build')}</button>}
          {app.installedVersion && <button className="text-button danger" onClick={() => onAction('uninstall', app)}><Icon>delete</Icon>{label(settings, 'Uninstall', '解除安裝')}</button>}
          <button className="text-button" onClick={() => document.getElementById(`docs-${app.id}`)?.focus()}><Icon>menu_book</Icon>{label(settings, 'Docs', '文件')}</button>
        </div>
      </div>
    </article>
  );
}

function ActionDialog({ action, settings, onClose, onResult }: { action: { kind: ActionKind; app: CatalogApp }; settings: UserSettings; onClose: () => void; onResult: (result: OperationResult) => void }) {
  const [confirmation, setConfirmation] = useState('');
  const [firstKey, setFirstKey] = useState(false);
  const [secondKey, setSecondKey] = useState(false);
  const [slider, setSlider] = useState(0);
  const [busy, setBusy] = useState(false);
  const prefix = action.kind.toUpperCase();
  const expected = `${prefix} ${action.app.name}`;
  const destructiveReady = action.kind !== 'uninstall' || (firstKey && secondKey && slider === 100);
  const typedReady = action.kind === 'uninstall' ? destructiveReady : confirmation === expected;
  const submit = async () => {
    if (!typedReady || busy) return;
    setBusy(true);
    const request = { appId: action.app.id, confirmation: action.kind === 'uninstall' ? expected : confirmation };
    const result = await window.dingDingStore.operations[action.kind](request);
    onResult(result);
    setBusy(false);
    if (result.ok) onClose();
  };
  return (
    <div className="scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="action-title">
        <header><div><span className="eyebrow">{prefix}</span><h2 id="action-title">{action.app.name}</h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Emergency exit"><Icon>close</Icon></button></header>
        <p>{action.kind === 'install' && label(settings, 'A verified release will download and run silently. No restart is automatic.', '會下載驗證過嘅 release 再靜默安裝，唔會自動重開機。')}{action.kind === 'build' && label(settings, 'The reviewed source recipe runs only inside the disposable build runner.', '只會喺即棄 build runner 跑審核過嘅 source recipe。')}{action.kind === 'uninstall' && label(settings, 'This removes the recorded installation. The local action history keeps the result.', '會移除記錄中嘅安裝；本機 action history 會留低結果。')}</p>
        {action.kind === 'uninstall' ? <div className="super-confirm">
          <div className="key-row"><button className={firstKey ? 'key active' : 'key'} onClick={() => setFirstKey((value) => !value)} aria-pressed={firstKey}>Turn key A</button><button className={secondKey ? 'key active' : 'key'} onClick={() => setSecondKey((value) => !value)} aria-pressed={secondKey}>Turn key B</button></div>
          <label>Slide to authorize · 拉盡先授權<input type="range" min="0" max="100" value={slider} disabled={!firstKey || !secondKey} onChange={(event) => setSlider(Number(event.target.value))} /><span>{slider}%</span></label>
        </div> : <label>Type <strong>{expected}</strong><input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>}
        <footer><button className="text-button" onClick={onClose} disabled={busy}>Emergency exit · 緊急離開</button><button className={action.kind === 'uninstall' ? 'filled-button danger-fill' : 'filled-button'} onClick={submit} disabled={!typedReady || busy}>{busy ? 'Working…' : `${prefix} ${action.app.name}`}</button></footer>
      </section>
    </div>
  );
}

function SettingsPanel({ settings, onSave }: { settings: UserSettings; onSave: (value: UserSettings) => void }) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <section className="settings-grid">
    <div className="settings-card"><h2>Language & voice · 語言同語氣</h2><label>Language mode<select value={draft.language} onChange={(event) => set('language', event.target.value as UserSettings['language'])}><option value="en">English</option><option value="yue">香港粵語</option><option value="bilingual">English + 香港粵語</option></select></label><label>English funny level <span>{draft.englishFunnyLevel}</span><input type="range" min="1" max="5" value={draft.englishFunnyLevel} onChange={(event) => set('englishFunnyLevel', Number(event.target.value))} /></label><label>粵語 funny level <span>{draft.cantoneseFunnyLevel}</span><input type="range" min="1" max="5" value={draft.cantoneseFunnyLevel} onChange={(event) => set('cantoneseFunnyLevel', Number(event.target.value))} /></label><p className="supporting">Funny levels style all messages, including warnings and errors, but never change facts. You can reset them any time.</p></div>
    <div className="settings-card"><h2>Appearance · 外觀</h2><label>Theme<select value={draft.theme} onChange={(event) => set('theme', event.target.value as UserSettings['theme'])}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label>Density<select value={draft.density} onChange={(event) => set('density', event.target.value as UserSettings['density'])}><option value="compact">Compact</option><option value="comfortable">Comfortable</option><option value="spacious">Spacious</option></select></label><label>Accent colour<input type="color" value={draft.accent} onChange={(event) => set('accent', event.target.value)} /></label><label>Display name<input value={draft.displayName} maxLength={64} onChange={(event) => set('displayName', event.target.value)} /></label><p className="supporting">Display name changes labels only. Package identity, update feed, and data location never move.</p></div>
    <div className="settings-actions"><button className="text-button" onClick={() => setDraft(defaultSettings)}>Reset</button><button className="filled-button" onClick={() => onSave(draft)}>Save settings</button></div>
  </section>;
}

export function App() {
  const [settings, setSettings] = useState(defaultSettings);
  const [activeTab, setActiveTab] = useState<TabId>('catalog');
  const [catalog, setCatalog] = useState<CatalogSnapshot | null>(null);
  const [query, setQuery] = useState('');
  const [regexMode, setRegexMode] = useState<{ pattern: string; flags: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<{ kind: ActionKind; app: CatalogApp } | null>(null);
  const [toast, setToast] = useState<OperationResult | null>(null);
  const [updateState, setUpdateState] = useState<AppStoreUpdateState>({ status: 'idle' });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const loadCatalog = useCallback(async (refresh = false) => {
    setLoading(true);
    try { setCatalog(refresh ? await window.dingDingStore.catalog.refresh() : await window.dingDingStore.catalog.list()); }
    catch (error) { setToast({ ok: false, appId: 'catalog', message: (error as Error).message }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void window.dingDingStore.settings.load().then(setSettings);
    void loadCatalog();
    return window.dingDingStore.updates.subscribe(setUpdateState);
  }, [loadCatalog]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => { if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); setPaletteOpen(true); } if (event.key === 'Escape') { setPaletteOpen(false); setAction(null); } };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    document.documentElement.dataset.density = settings.density;
    document.documentElement.style.setProperty('--seed', settings.accent);
  }, [settings]);

  const filtered = useMemo(() => {
    const source = catalog?.apps ?? [];
    if (!query) return source;
    if (regexMode) {
      try { const expression = new RegExp(regexMode.pattern, regexMode.flags.replace('g', '')); return source.filter((item) => expression.test(`${item.name}\n${item.description}\n${item.repository}`)); }
      catch { return []; }
    }
    const needle = query.toLocaleLowerCase();
    return source.filter((item) => `${item.name}\n${item.description}\n${item.repository}`.toLocaleLowerCase().includes(needle));
  }, [catalog, query, regexMode]);

  const shownApps = activeTab === 'installed' ? filtered.filter((item) => item.installedVersion) : activeTab === 'updates' ? filtered.filter((item) => item.updateState === 'available') : filtered;
  const saveSettings = async (value: UserSettings) => { const saved = await window.dingDingStore.settings.save(value); setSettings(saved); setToast({ ok: true, appId: 'settings', message: 'Settings saved and applied.' }); };
  const pageTitle = tabs.find((tab) => tab.id === activeTab)!;
  const moveTabFocus = (index: number, direction: number) => { const target = (index + direction + tabs.length) % tabs.length; tabRefs.current[target]?.focus(); };

  return <div className="app-shell">
    <header className="titlebar"><div className="brand-mark" aria-hidden="true"><Icon>storefront</Icon></div><strong>{settings.displayName}</strong><span className="dev-badge">Preview 0.1.0</span><div className="drag-space" /><button onClick={() => window.dingDingStore.window.minimize()} aria-label="Minimize"><Icon>remove</Icon></button><button onClick={() => window.dingDingStore.window.toggleMaximize()} aria-label="Maximize or restore"><Icon>crop_square</Icon></button><button className="close-window" onClick={() => window.dingDingStore.window.close()} aria-label="Close"><Icon>close</Icon></button></header>
    <aside className="navigation" aria-label="Primary navigation"><div className="nav-title">Ding Ding</div><div role="tablist" aria-orientation="vertical">{tabs.map((tab, index) => <button key={tab.id} ref={(node) => { tabRefs.current[index] = node; }} role="tab" aria-selected={activeTab === tab.id} tabIndex={activeTab === tab.id ? 0 : -1} onKeyDown={(event) => { if (event.key === 'ArrowDown') moveTabFocus(index, 1); if (event.key === 'ArrowUp') moveTabFocus(index, -1); if (event.key === 'Enter' || event.key === ' ') setActiveTab(tab.id); }} onClick={() => setActiveTab(tab.id)}><Icon>{tab.icon}</Icon><span>{label(settings, tab.en, tab.yue)}</span>{tab.id === 'updates' && (catalog?.apps.some((app) => app.updateState === 'available') || updateState.status === 'ready') && <span className="nav-dot" aria-label="Updates available" />}</button>)}</div><button className="palette-hint" onClick={() => setPaletteOpen(true)}><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd><span>Commands</span></button></aside>
    <main className="content" role="tabpanel" aria-label={pageTitle.en}>
      {(updateState.status === 'available' || updateState.status === 'downloading' || updateState.status === 'ready' || updateState.status === 'failed') && <section className={`update-banner ${updateState.status}`} role="status"><Icon>system_update</Icon><div><strong>{updateState.status === 'ready' ? `Ding Ding App Store ${updateState.version} is ready` : updateState.status === 'available' ? `Version ${updateState.version} is available` : updateState.status === 'downloading' ? 'Downloading update…' : 'Update check failed'}</strong><p>{updateState.status === 'failed' ? updateState.message : 'Unsigned artifact: HTTPS feed metadata and package hashes protect transport integrity; no code signature is claimed.'}</p></div>{updateState.status === 'available' && <button className="filled-button" onClick={() => void window.dingDingStore.updates.downloadStore().then(setUpdateState)}>Download</button>}{updateState.status === 'ready' && <><button className="text-button">Later</button><button className="filled-button" onClick={() => void window.dingDingStore.updates.restartStore()}>Restart to install update</button></>}</section>}
      <div className="page-heading"><div><span className="eyebrow">DING DING PROJECTS</span><h1>{label(settings, pageTitle.en, pageTitle.yue)}</h1><p>{activeTab === 'catalog' ? label(settings, 'Trusted apps, their releases, and their complete documentation in one place.', '可信 apps、release 同完整文件，一個位睇晒。') : activeTab === 'updates' ? label(settings, 'Check every installed app and the store itself without surprise restarts.', '檢查所有已安裝 app 同商店自己，唔會突然重開。') : ''}</p></div>{['catalog', 'installed', 'updates'].includes(activeTab) && <button className="tonal-button" disabled={loading} onClick={() => void loadCatalog(true)}><Icon>refresh</Icon>{loading ? 'Refreshing…' : 'Refresh'}</button>}</div>
      {['catalog', 'installed', 'updates'].includes(activeTab) && <SearchBox value={query} onChange={setQuery} regexMode={regexMode} onRegexMode={setRegexMode} placeholder="Search apps, descriptions, and repositories" />}
      {catalog?.warning && <div className="notice warning" role="status"><Icon>wifi_off</Icon>{catalog.warning}</div>}
      {loading && <div className="loading-grid" aria-label="Loading catalog">{Array.from({ length: 6 }, (_, index) => <div className="skeleton" key={index} />)}</div>}
      {!loading && ['catalog', 'installed', 'updates'].includes(activeTab) && (shownApps.length ? <section className="app-grid">{shownApps.map((app) => <AppCard key={app.id} app={app} settings={settings} onAction={(kind, selected) => setAction({ kind, app: selected })} />)}</section> : <div className="empty-state"><Icon>search_off</Icon><h2>No matching apps</h2><p>The current search and tab filters found nothing. Clear the query or refresh the catalog.</p></div>)}
      {activeTab === 'docs' && <section className="docs-layout"><nav aria-label="Documentation articles">{docs.map((article) => <a href={`#docs-${article.id}`} key={article.id}>{article.title}</a>)}</nav><div>{docs.map((article) => <article key={article.id} id={`docs-${article.id}`} tabIndex={-1}><h2>{article.title}</h2><p>{article.body}</p><h3>Suggested articles</h3><p>Security boundaries · Update checker · Verification</p></article>)}</div></section>}
      {activeTab === 'activity' && <div className="empty-state"><Icon>history</Icon><h2>No operations yet · 仲未有操作</h2><p>Installs, builds, updates, uninstalls, failures, and recoveries will appear here with exact results and export controls.</p></div>}
      {activeTab === 'settings' && <><SearchBox value={query} onChange={setQuery} regexMode={regexMode} onRegexMode={setRegexMode} placeholder="Search every setting" /><SettingsPanel settings={settings} onSave={(value) => void saveSettings(value)} /></>}
    </main>
    {action && <ActionDialog action={action} settings={settings} onClose={() => setAction(null)} onResult={(result) => { setToast(result); if (result.ok) void loadCatalog(true); }} />}
    {paletteOpen && <div className="scrim" role="presentation"><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette"><header><h2>Command palette · 指令板</h2><button className="icon-button" onClick={() => setPaletteOpen(false)} aria-label="Close command palette"><Icon>close</Icon></button></header><SearchBox value={paletteQuery} onChange={setPaletteQuery} regexMode={null} onRegexMode={() => undefined} placeholder="Search commands, pages, settings, and apps" /><div className="command-list">{tabs.filter((tab) => `${tab.en} ${tab.yue}`.toLowerCase().includes(paletteQuery.toLowerCase())).map((tab) => <button key={tab.id} onClick={() => { setActiveTab(tab.id); setPaletteOpen(false); }}><Icon>{tab.icon}</Icon><span><strong>{tab.en} · {tab.yue}</strong><small>Open exact page</small></span><Icon>arrow_forward</Icon></button>)}</div></section></div>}
    {toast && <div className={`snackbar ${toast.ok ? 'success' : 'error'}`} role="status"><Icon>{toast.ok ? 'check_circle' : 'error'}</Icon><span>{toast.message}</span><button className="icon-button" onClick={() => setToast(null)} aria-label="Dismiss notification"><Icon>close</Icon></button></div>}
  </div>;
}
