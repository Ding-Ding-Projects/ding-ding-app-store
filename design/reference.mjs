const pages = [
  { id: 'catalog', icon: '⌂', en: 'Catalog', yue: '目錄', count: '' },
  { id: 'installed', icon: '▣', en: 'Installed', yue: '已安裝', count: '2' },
  { id: 'updates', icon: '↻', en: 'Updates', yue: '更新', count: '1' },
  { id: 'authenticator', icon: '♢', en: 'Authenticator', yue: '驗證器', count: '' },
  { id: 'docs', icon: '▤', en: 'Documentation', yue: '說明文件', count: '' },
  { id: 'activity', icon: '◷', en: 'Activity', yue: '活動', count: '' },
  { id: 'settings', icon: '⚙', en: 'Settings', yue: '設定', count: '' },
];

const settingsTabs = [
  { id: 'general', icon: '⚙', en: 'General', yue: '一般' },
  { id: 'appearance', icon: '✦', en: 'Appearance', yue: '外觀' },
  { id: 'schedule', icon: '◷', en: 'Schedule', yue: '排程' },
  { id: 'about', icon: 'ⓘ', en: 'About', yue: '關於' },
  { id: 'support', icon: '♧', en: 'Locks & Support', yue: '鎖同支援' },
];

const fixtureApps = [
  { name: 'Lantern Notes', initials: 'LN', category: 'Writing', version: '2.4.1', copy: 'A quiet, local notebook for everyday ideas.' },
  { name: 'Orbit Timer', initials: 'OT', category: 'Focus', version: '1.8.0', copy: 'Small timers for focused work sessions.' },
  { name: 'Harbour Sketch', initials: 'HS', category: 'Creative', version: '0.9.6', copy: 'A lightweight canvas for quick diagrams.' },
];

const copy = {
  en: { workspace: 'WORKSPACE', manageTabs: 'Manage tabs', notifications: 'Notifications', offline: 'Offline reference', refresh: 'Refresh', search: 'Search pages, settings, commands', open: 'Open', view: 'View details', regex: 'Regex builder', noResults: 'No matching records', language: 'English' },
  yue: { workspace: '工作區', manageTabs: '管理分頁', notifications: '通知', offline: '離線參考', refresh: '重新整理', search: '搜尋頁面、設定、指令', open: '開啟', view: '睇詳情', regex: '正則表達式建立器', noResults: '冇符合嘅記錄', language: '廣東話' },
  bilingual: { workspace: 'WORKSPACE · 工作區', manageTabs: 'Manage tabs · 管理分頁', notifications: 'Notifications · 通知', offline: 'Offline reference · 離線參考', refresh: 'Refresh · 重新整理', search: 'Search pages, settings, commands · 搜尋頁面、設定、指令', open: 'Open · 開啟', view: 'View details · 睇詳情', regex: 'Regex builder · 正則表達式建立器', noResults: 'No matching records · 冇符合嘅記錄', language: 'Bilingual · 雙語' },
};

const state = {
  page: 'catalog',
  settingsTab: 'general',
  language: 'bilingual',
  theme: 'light',
  overlay: null,
  query: '',
  mode: 'reference',
  row: 'shell',
};

const byId = (id) => document.getElementById(id);
const selectedCopy = () => copy[state.language];
function label(item) {
  if (state.language === 'en') return item.en;
  if (state.language === 'yue') return item.yue;
  return `${item.en} · ${item.yue}`;
}
function esc(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function icon(name) { return `<span class="material-symbol" aria-hidden="true">${name}</span>`; }

function renderRail() {
  const t = selectedCopy();
  document.querySelector('[data-i18n="workspaces"]').textContent = t.workspace;
  document.querySelector('[data-i18n="manageTabs"]').textContent = t.manageTabs;
  document.querySelector('[data-i18n="notifications"]').textContent = t.notifications;
  document.querySelector('[data-i18n="offline"]').textContent = t.offline;
  byId('page-tabs').innerHTML = pages.map((page) => `<button class="page-tab" data-page="${page.id}" aria-current="${state.page === page.id ? 'page' : 'false'}" title="${esc(label(page))}">${icon(page.icon)}<span class="tab-label">${esc(label(page))}</span>${page.count ? `<span class="tab-count">${page.count}</span>` : ''}</button>`).join('');
  document.querySelectorAll('[data-page]').forEach((button) => button.addEventListener('click', () => setPage(button.dataset.page)));
}

function pageHeader(page, subtitle, actions = '') {
  return `<div class="page-heading"><div class="page-icon" aria-hidden="true">${page.icon}</div><div><h1>${esc(label(page))}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function filterToolbar(placeholder = 'Filter this surface') {
  const t = selectedCopy();
  return `<div class="toolbar"><input value="${esc(state.query)}" data-surface-filter placeholder="${esc(placeholder)}" aria-label="${esc(placeholder)}"><button class="tonal-button" data-overlay="regex">${esc(t.regex)}</button><button class="text-button" data-toast="Fixture refreshed">${esc(t.refresh)}</button></div>`;
}
function visible(value) { return !state.query || value.toLowerCase().includes(state.query.toLowerCase()); }

function catalogPage() {
  const page = pages[0];
  return `${pageHeader(page, 'Discover reviewed public applications with clear status and ownership boundaries.', '<button class="tonal-button" data-overlay="dim-sum">Today\'s surprise</button>')}
    <section class="surface"><div class="notice"><strong>Reference fixture</strong><br><span>All records are local examples. No release metadata or download begins from this page.</span></div>${filterToolbar('Search catalog fixtures')}<div class="card-grid">${fixtureApps.filter((app) => visible(`${app.name} ${app.category}`)).map((app) => `<article class="app-card"><header><div class="app-logo">${app.initials}</div><h3>${app.name}</h3></header><span class="pill neutral">${app.category}</span><p>${app.copy}</p><footer><small>v${app.version}</small><button class="filled-button" data-overlay="action">${selectedCopy().open}</button></footer></article>`).join('')}</div></section>
    <section class="surface"><h2>Clear paths through the store</h2><p class="supporting">Search, compare, read documentation, or review an operation without leaving the current tab.</p></section>`;
}
function installedPage() {
  const page = pages[1];
  const rows = fixtureApps.slice(0, 2).filter((app) => visible(app.name));
  return `${pageHeader(page, 'App Store-managed records stay separate from outside discovery.')}
    <section class="surface">${filterToolbar('Search installed records')}<div class="list">${rows.map((app) => `<div class="list-row"><div class="app-logo">${app.initials}</div><div class="row-copy"><strong>${app.name}</strong><small>Managed record · v${app.version} · Ready</small></div><span class="pill">Installed</span><div class="row-actions"><button class="text-button" data-overlay="action">Details</button><button class="text-button" data-overlay="super-confirm">Remove</button></div></div>`).join('')}</div>${rows.length ? '' : `<div class="empty-state">${selectedCopy().noResults}</div>`}</section>`;
}
function updatesPage() {
  const page = pages[2];
  return `${pageHeader(page, 'Review available versions before any update action.', '<button class="filled-button" data-overlay="action">Update selected</button>')}
    <section class="surface">${filterToolbar('Search available updates')}<div class="list"><div class="list-row"><div class="app-logo">LN</div><div class="row-copy"><strong>Lantern Notes</strong><small>2.4.1 → 2.5.0 · Release notes available</small></div><span class="pill">Update available</span><button class="tonal-button" data-overlay="action">Review</button></div></div></section>
    <section class="surface"><h2>Update policy</h2><p class="supporting">Discovery and installation are separate states. A review never starts a download.</p></section>`;
}
function authenticatorPage() {
  const page = pages[3];
  return `${pageHeader(page, 'Local one-time-code entries with redacted display by default.', '<button class="filled-button" data-overlay="action">Add entry</button>')}
    <section class="surface">${filterToolbar('Search entries or groups')}<div class="list"><div class="list-row"><div class="page-icon" style="width:40px;height:40px;border-radius:13px;font-size:18px">♢</div><div class="row-copy"><strong>Example workspace</strong><small>6 digits · 30 second period · SHA-256</small></div><code>••••••</code><button class="text-button" data-overlay="super-confirm">Delete</button></div><div class="list-row"><div class="page-icon" style="width:40px;height:40px;border-radius:13px;font-size:18px">♢</div><div class="row-copy"><strong>Design review</strong><small>8 digits · 60 second period · SHA-1</small></div><code>••••••••</code><button class="text-button" data-overlay="action">Show</button></div></div></section>`;
}
function docsPage() {
  const page = pages[4];
  return `${pageHeader(page, 'Offline articles explain behavior, configuration, failure modes, and security.')}
    <section class="surface">${filterToolbar('Search documentation')}<div class="card-grid"><article class="app-card"><span class="pill neutral">Experience</span><h3>Command palette</h3><p>Reach pages, commands, settings, and appearance controls with one search.</p><footer><button class="text-button" data-overlay="palette">Read article</button></footer></article><article class="app-card"><span class="pill neutral">Security</span><h3>Safe application actions</h3><p>Understand typed identifiers, review boundaries, and honest result states.</p><footer><button class="text-button" data-overlay="source-terminal">Read article</button></footer></article><article class="app-card"><span class="pill neutral">Updates</span><h3>Update schedule</h3><p>See how discovery, policy validation, and explicit restart stay separate.</p><footer><button class="text-button" data-overlay="changelog">Read article</button></footer></article></div></section>`;
}
function activityPage() {
  const page = pages[5];
  return `${pageHeader(page, 'Append-only operation history with bounded, redacted exports.', '<button class="tonal-button" data-overlay="action">Export</button>')}
    <section class="surface">${filterToolbar('Search activity')}<div class="list"><div class="list-row"><span class="pill">Success</span><div class="row-copy"><strong>Catalog refresh</strong><small>Today · local fixture · No files changed</small></div><button class="text-button" data-overlay="notification-center">Details</button></div><div class="list-row"><span class="pill neutral">Review</span><div class="row-copy"><strong>Lantern Notes update available</strong><small>Yesterday · version comparison</small></div><button class="text-button" data-overlay="action">Review</button></div></div></section>
    <section class="surface"><h2>Local versions</h2><p class="supporting">Metadata-only revision records can be inspected and exported independently from operation rows.</p><div class="overlay-actions"><button class="tonal-button" data-overlay="super-confirm">Restore selected</button></div></section>`;
}
function settingsPage() {
  const page = pages[6];
  const tab = settingsTabs.find((item) => item.id === state.settingsTab) ?? settingsTabs[0];
  return `${pageHeader(page, 'Per-surface search, tab navigation, and appearance controls.')}
    <section class="surface"><div class="settings-tabs" role="tablist">${settingsTabs.map((item) => `<button class="settings-tab" role="tab" aria-selected="${item.id === tab.id}" data-settings-tab="${item.id}">${item.icon} ${esc(label(item))}</button>`).join('')}</div>
    ${settingsContent(tab)}</section>`;
}
function settingsContent(tab) {
  if (tab.id === 'general') return `${filterToolbar('Search general settings')}<div class="setting-row"><div class="row-copy"><label>Language · 語言</label><small>English, Cantonese, or bilingual presentation.</small></div><select id="language-select"><option value="bilingual">Bilingual · 雙語</option><option value="en">English</option><option value="yue">廣東話</option></select></div><div class="setting-row"><div class="row-copy"><label>Reduced motion</label><small>Respect the system preference for calmer transitions.</small></div><button class="switch" role="switch" aria-checked="true"><span></span></button></div><div class="setting-row"><div class="row-copy"><label>Funny level controls</label><small>English and Cantonese voice levels are independent; facts stay exact.</small></div><button class="text-button" data-overlay="action">Preview</button></div>`;
  if (tab.id === 'appearance') return `${filterToolbar('Search appearance settings')}<div class="setting-row"><div class="row-copy"><label>Theme</label><small>Switch between light and dark without leaving the reference.</small></div><button class="tonal-button" data-theme-toggle>Use ${state.theme === 'light' ? 'dark' : 'light'} theme</button></div><div class="setting-row"><div class="row-copy"><label>Tab rail</label><small>Persistent browser-style tabs stay on the left by default.</small></div><button class="text-button" data-overlay="appearance">Edit appearance</button></div>`;
  if (tab.id === 'schedule') return `${filterToolbar('Search schedule settings')}<div class="setting-row"><div class="row-copy"><label>Catalog check</label><small>Next check: tomorrow · quiet hours respected.</small></div><span class="pill">Scheduled</span></div><div class="setting-row"><div class="row-copy"><label>Quiet hours</label><small>Hold informational notifications without delaying checks.</small></div><button class="text-button" data-overlay="action">Configure</button></div>`;
  if (tab.id === 'about') return `${filterToolbar('Search about and changelog')}<div class="setting-row"><div class="row-copy"><label>Ding Ding App Store</label><small>Public design reference · unsigned local fixture</small></div><button class="text-button" data-overlay="changelog">View changelog</button></div><div class="setting-row"><div class="row-copy"><label>Documentation and export</label><small>All content stays on this device in the reference.</small></div><button class="text-button" data-overlay="source-terminal">View security details</button></div>`;
  return `${filterToolbar('Search locks and support')}<div class="setting-row"><div class="row-copy"><label>Appearance property locks</label><small>Review target, state, and recovery action before changing a locked property.</small></div><span class="pill neutral">2 protected</span></div><div class="setting-row"><div class="row-copy"><label>Support tickets</label><small>Local, bounded, and exportable as redacted metadata.</small></div><button class="text-button" data-overlay="action">Open desk</button></div>`;
}

function renderPage() {
  const page = pages.find((item) => item.id === state.page) ?? pages[0];
  const content = { catalog: catalogPage, installed: installedPage, updates: updatesPage, authenticator: authenticatorPage, docs: docsPage, activity: activityPage, settings: settingsPage }[page.id]();
  const compareBanner = state.mode === 'compare' ? `<section class="surface compare-banner"><div><strong>Comparison row: ${esc(state.row)}</strong><p class="supporting">The viewer uses a fixed task-owned evidence slot. No renderer-provided path or URL is accepted.</p></div><span class="pill neutral">Reference · side by side</span></section>` : '';
  byId('page-area').innerHTML = compareBanner + content;
  byId('global-search').value = state.query;
  byId('global-search').placeholder = selectedCopy().search;
  document.querySelectorAll('[data-surface-filter]').forEach((input) => input.addEventListener('input', (event) => { state.query = event.target.value; renderPage(); }));
  document.querySelectorAll('[data-overlay]').forEach((button) => button.addEventListener('click', () => openOverlay(button.dataset.overlay)));
  document.querySelectorAll('[data-settings-tab]').forEach((button) => button.addEventListener('click', () => { state.settingsTab = button.dataset.settingsTab; renderPage(); }));
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => button.addEventListener('click', () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; applyTheme(); renderPage(); }));
  const languageSelect = byId('language-select');
  if (languageSelect) { languageSelect.value = state.language; languageSelect.addEventListener('change', (event) => { state.language = event.target.value; renderAll(); }); }
}

const overlayTitles = {
  palette: ['Command palette', 'Jump to any page, command, setting, or appearance control.'],
  regex: ['Regex builder', 'Compose a bounded regular expression for this surface.'],
  tabs: ['Manage tabs', 'Search, pin, group, and recover the persistent browser-style workspace.'],
  'notification-center': ['Notification center', 'Informational state remains available without blocking the page.'],
  appearance: ['Appearance editor', 'Edit the selected element with persisted CSS-token values.'],
  action: ['Review action', 'This fixture shows the progress and result boundary before work begins.'],
  'super-confirm': ['Confirm destructive action', 'Two-key confirmation and a full slider are required for destructive changes.'],
  'source-terminal': ['Source terminal · execution isolation', 'A read-only status surface explains why source execution remains bounded.'],
  changelog: ['Changelog', 'Browse local release notes with exact fixture facts.'],
  'dim-sum': ['Dim-sum surprise', 'A small non-blocking public catalog moment.'],
};
const overlayAliases = {
  'command-palette': 'palette',
  'regex-builder': 'regex',
  'tab-management': 'tabs',
  'context-menu': 'tabs-context',
  'notification-center': 'notification-center',
  'appearance-panel': 'appearance',
  'action-progress': 'action',
  'destructive-super-confirm': 'super-confirm',
  'source-terminal': 'source-terminal',
  changelog: 'changelog',
  'dim-sum-surprise': 'dim-sum',
};
function openOverlay(kind) {
  kind = overlayAliases[kind] ?? kind;
  state.overlay = kind;
  const [title, subtitle] = overlayTitles[kind] ?? overlayTitles.palette;
  let body = '';
  if (kind === 'palette') body = `<input class="palette-input" autofocus placeholder="Search commands and pages"><div class="command-list"><div class="command-row">${icon('⌂')}<div class="row-copy"><strong>Open Catalog</strong><small>Page · workspace</small></div><kbd>Enter</kbd></div><div class="command-row">${icon('⚙')}<div class="row-copy"><strong>Settings · Appearance</strong><small>Setting · theme, density, tab rail</small></div><kbd>⌘2</kbd></div><div class="command-row" data-overlay="regex">${icon('⌕')}<div class="row-copy"><strong>Open regex builder</strong><small>Command · current surface</small></div><kbd>⌘R</kbd></div></div>`;
  if (kind === 'regex') body = `<div class="notice">The builder is local-only and never evaluates a shell expression or sends a query to a server.</div><div class="field"><label for="regex-pattern">Pattern</label><input id="regex-pattern" value="^(Lantern|Orbit)"></div><div class="field"><label for="regex-flags">Flags</label><input id="regex-flags" value="i"></div><div class="field"><label>Preview</label><div class="surface"><code>Lantern Notes · Orbit Timer</code></div></div><div class="overlay-actions"><button class="tonal-button" data-close>Cancel</button><button class="filled-button" data-toast="Regex applied to this fixture">Apply pattern</button></div>`;
  if (kind === 'tabs') body = `<div class="toolbar"><input placeholder="Search tabs"><button class="tonal-button">New group</button></div><div class="list"><div class="list-row"><span class="pill">Pinned</span><div class="row-copy"><strong>Catalog</strong><small>Default group · active</small></div><button class="text-button">Unpin</button></div><div class="list-row"><span class="pill neutral">Open</span><div class="row-copy"><strong>Documentation</strong><small>Reading group</small></div><button class="text-button">Move</button></div></div><div class="overlay-actions"><button class="text-button" data-overlay="tabs-context">Open context menu</button></div>`;
  if (kind === 'tabs-context') body = `<div class="command-list"><div class="command-row"><strong>Pin tab</strong></div><div class="command-row"><strong>Move to group…</strong></div><div class="command-row"><strong>Close other tabs</strong></div></div>`;
  if (kind === 'notification-center') body = `<div class="toolbar"><span class="pill">3 unread</span><button class="text-button">Mark all read</button></div><div class="list"><div class="list-row"><span class="pill">Ready</span><div class="row-copy"><strong>Catalog refreshed</strong><small>Just now · no network in reference</small></div></div><div class="list-row"><span class="pill neutral">Info</span><div class="row-copy"><strong>Appearance saved</strong><small>Yesterday · local fixture</small></div></div></div>`;
  if (kind === 'appearance') body = `<div class="appearance-drawer"><div class="notice">Editing <strong>content-surface</strong> · selected token <strong>surface</strong></div><div><label>Accent</label><div class="swatches"><button class="swatch selected" style="background:#6750a4" aria-label="Purple accent"></button><button class="swatch" style="background:#006a6a" aria-label="Teal accent"></button><button class="swatch" style="background:#9b405d" aria-label="Rose accent"></button></div></div><div class="setting-row"><div class="row-copy"><label>Corner radius</label><small>20 px · surface token</small></div><button class="text-button">Reset</button></div><div class="overlay-actions"><button class="tonal-button" data-toast="Appearance export prepared">Export</button><button class="filled-button" data-close>Save</button></div></div>`;
  if (kind === 'action') body = `<div class="notice">Review-only fixture. A real operation would show bounded progress, cancellation, and an honest exit result.</div><div class="field"><label>Application</label><input value="Lantern Notes" readonly></div><div class="field"><label>Stage</label><div class="surface"><strong>Ready for review</strong><p class="supporting">No download, installer, or executable path is present in this reference.</p></div></div><div class="overlay-actions"><button class="tonal-button" data-close>Cancel</button><button class="filled-button" data-toast="Fixture action reviewed">Continue</button></div>`;
  if (kind === 'super-confirm') body = `<div class="notice warning"><strong>Destructive action</strong><br>Review the target and recovery path before continuing. This control is intentionally explicit.</div><div class="field"><label for="confirm-key">Two-key phrase</label><input id="confirm-key" placeholder="Type REMOVE to continue"></div><div class="field"><label for="confirm-slider">Full-slider confirmation</label><input id="confirm-slider" type="range" min="0" max="100" value="0"></div><div class="overlay-actions"><button class="tonal-button" data-close>Emergency exit</button><button class="filled-button" data-toast="Confirmation remains a fixture">Confirm action</button></div>`;
  if (kind === 'source-terminal') body = `<div class="notice">Status: <strong>blocked until guest transport is attested</strong></div><div class="surface"><h3>Source terminal</h3><p class="supporting">Read-only diagnostics are shown as typed status, never as an editable command prompt.</p><div class="list"><div class="list-row"><div class="row-copy"><strong>Network scope</strong><small>Fixed and bounded · no host credentials</small></div><span class="pill neutral">Read-only</span></div><div class="list-row"><div class="row-copy"><strong>Host mounts</strong><small>None declared · fail closed when unavailable</small></div><span class="pill neutral">Verified contract</span></div></div></div><div class="overlay-actions"><button class="tonal-button" data-close>Close details</button></div>`;
  if (kind === 'changelog') body = `<div class="toolbar"><input placeholder="Search release notes"><button class="tonal-button">Date range</button></div><div class="list"><div class="list-row"><div class="row-copy"><strong>0.1.0 · Design reference</strong><small>Fixture entry · complete shell and safe overlay states</small></div><code>abc1234</code></div><div class="list-row"><div class="row-copy"><strong>0.0.9 · Offline docs</strong><small>Fixture entry · local article browser</small></div><code>def5678</code></div></div><div class="overlay-actions"><button class="text-button" data-toast="Changelog export prepared">Export filtered notes</button></div>`;
  if (kind === 'dim-sum') body = `<div class="dim-sum-art" style="font-size:72px;text-align:center;padding:22px">🥟 🫖</div><p class="supporting">A local, dismissible surprise card. The reference keeps this playful moment non-blocking and does not fetch an image.</p><div class="overlay-actions"><button class="filled-button" data-close>Lovely, thanks</button></div>`;
  byId('overlay').innerHTML = `<div class="overlay-header"><div><h2 id="overlay-title">${title}</h2><p>${subtitle}</p></div><button class="overlay-close" data-close aria-label="Close overlay">×</button></div>${body}`;
  byId('overlay').hidden = false; byId('scrim').hidden = false; byId('overlay').classList.toggle('drawer', kind === 'appearance' || kind === 'notification-center');
  byId('overlay').querySelectorAll('[data-overlay]').forEach((button) => button.addEventListener('click', () => openOverlay(button.dataset.overlay)));
  byId('overlay').querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', closeOverlay));
  byId('overlay').querySelectorAll('[data-toast]').forEach((button) => button.addEventListener('click', () => { showToast(button.dataset.toast); closeOverlay(); }));
  byId('overlay').querySelector('input')?.focus();
}
function closeOverlay() { state.overlay = null; byId('overlay').hidden = true; byId('scrim').hidden = true; }
function showToast(message) { const toast = document.createElement('div'); toast.className = 'toast'; toast.textContent = message; byId('toast-stack').append(toast); setTimeout(() => toast.remove(), 2600); }
function applyTheme() { byId('app-shell').dataset.theme = state.theme; byId('overlay').dataset.theme = state.theme; document.documentElement.dataset.theme = state.theme; }
function renderAll() { applyTheme(); renderRail(); renderPage(); }
function setPage(page) { state.page = page; state.query = ''; renderAll(); }

const params = new URLSearchParams(location.search);
if (pages.some((page) => page.id === params.get('page'))) state.page = params.get('page');
if (settingsTabs.some((tab) => tab.id === (params.get('settings') ?? params.get('subtab')))) state.settingsTab = params.get('settings') ?? params.get('subtab');
if (['en', 'yue', 'bilingual'].includes(params.get('lang'))) state.language = params.get('lang');
if (['light', 'dark'].includes(params.get('theme'))) state.theme = params.get('theme');
if (['reference', 'compare'].includes(params.get('mode'))) state.mode = params.get('mode');
if (params.get('row') && /^[a-z-]{1,32}$/.test(params.get('row'))) state.row = params.get('row');
if (params.get('overlay')) state.overlay = params.get('overlay');

byId('global-search').addEventListener('input', (event) => { state.query = event.target.value; renderPage(); });
byId('open-palette').addEventListener('click', () => openOverlay('palette'));
byId('tab-manager').addEventListener('click', () => openOverlay('tabs'));
byId('notification-button').addEventListener('click', () => openOverlay('notification-center'));
byId('new-tab').addEventListener('click', () => showToast('New tab is available in the persistent workspace.'));
byId('scrim').addEventListener('click', closeOverlay);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && state.overlay) closeOverlay();
  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); openOverlay('palette'); }
});
renderAll();
if (state.overlay) openOverlay(state.overlay);
