import {
  addTab,
  closeTab as closeTabState,
  moveTab as moveTabState,
  parseTabState,
  routeHash,
  tabIdFromHash,
  togglePinned,
} from './tab-state.mjs';
import {
  clearCachedVocabulary,
  loadCachedVocabulary,
  parsePersonalVocabularyJson,
  personalizeOwnedText,
  saveCachedVocabulary,
} from './personal-vocabulary.mjs';
import { readDialogEmojiPreference, shouldShowDialogEmoji, writeDialogEmojiPreference } from './dialog-emoji.mjs';
import { DEFAULT_DISPLAY_NAME, displayNameForPresentation, loadDisplayName, resetDisplayName, saveDisplayName } from './display-name.mjs';
import { EMPTY_SCHEDULE, loadSchedule, resolveSchedule, saveSchedule } from './schedule.mjs';
import { scheduleRuleMarkup } from './schedule-ui.mjs';

(() => {
  'use strict';
  const bundle = window.DING_DING_DOCS;
  if (!bundle?.articles?.length) throw new Error('The generated documentation bundle is missing.');
  const articles = bundle.articles;
  const categories = bundle.categories;
  const $ = (id) => document.getElementById(id);
  const storage = 'ding-ding-docs:';
  const articleIds = articles.map((article) => article.id);
  const legacyArticle = localStorage.getItem(storage + 'article') || 'home';
  const readStoredSearch = (kind) => {
    try {
      const value = JSON.parse(localStorage.getItem(storage + `search:${kind}`) || 'null');
      return {
        regex: Boolean(value?.regex),
        pattern: typeof value?.pattern === 'string' ? value.pattern : '',
        flags: typeof value?.flags === 'string' ? value.flags : 'iu',
        query: typeof value?.query === 'string' ? value.query : '',
      };
    } catch {
      return { regex: false, pattern: '', flags: 'iu', query: '' };
    }
  };
  const state = {
    article: legacyArticle,
    tabs: parseTabState(localStorage.getItem(storage + 'tabs'), articleIds, legacyArticle),
    mode: localStorage.getItem(storage + 'mode') || 'en',
    funnyEn: +(localStorage.getItem(storage + 'funnyEn') || 2),
    funnyYue: +(localStorage.getItem(storage + 'funnyYue') || 3),
    theme: localStorage.getItem(storage + 'theme') || 'system',
    density: localStorage.getItem(storage + 'density') || 'comfortable',
    accent: localStorage.getItem(storage + 'accent') || '#4f378b',
    settingsTab: localStorage.getItem(storage + 'settingsTab') || 'general',
    siteRestricted: localStorage.getItem(storage + 'siteRestricted') === 'true',
    displayName: loadDisplayName(),
    showEmojisInDialogs: readDialogEmojiPreference(),
    schedule: loadSchedule(),
  };
  let scheduleDraft = structuredClone(state.schedule);
  let renderedSchedulePresentation = null;
  let currentScheduleStatus = ['No schedule rules are saved. Base settings remain active.', '未儲存任何排程規則；而家使用基本設定。'];
  let vocabulary = loadCachedVocabulary();
  const search = { docs: readStoredSearch('docs'), settings: readStoredSearch('settings'), palette: readStoredSearch('palette') };

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const articleId = (href) => href.match(/(?:^|\/)([a-z0-9-]+)\.md(?:#.*)?$/i)?.[1] || null;
  function inline(raw, allowVocabulary = true) {
    const pattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g;
    let output = ''; let cursor = 0;
    for (const match of raw.matchAll(pattern)) {
      output += escapeHtml(allowVocabulary ? copy(raw.slice(cursor, match.index)) : raw.slice(cursor, match.index));
      const token = match[0];
      if (token.startsWith('[')) {
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/); const id = link && articleId(link[2]);
        output += id ? `<button class="article-link" data-open="${escapeHtml(id)}">${escapeHtml(allowVocabulary ? copy(link[1]) : link[1])}</button>` : escapeHtml(allowVocabulary ? copy(link?.[1] || token) : (link?.[1] || token));
      } else if (token.startsWith('`')) output += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
      else output += `<strong>${escapeHtml(allowVocabulary ? copy(token.slice(2, -2)) : token.slice(2, -2))}</strong>`;
      cursor = match.index + token.length;
    }
    return output + escapeHtml(allowVocabulary ? copy(raw.slice(cursor)) : raw.slice(cursor));
  }

  function markdown(body, allowVocabulary = true) {
    const output = []; let paragraph = []; let bullets = [];
    const flushParagraph = () => { if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '), allowVocabulary)}</p>`); paragraph = []; };
    const flushBullets = () => { if (bullets.length) output.push(`<ul>${bullets.map((line) => `<li>${inline(line, allowVocabulary)}</li>`).join('')}</ul>`); bullets = []; };
    for (const line of body.replace(/\r/g, '').split('\n')) {
      if (line.startsWith('# ')) continue;
      if (line.startsWith('## ')) { flushParagraph(); flushBullets(); output.push(`<h2>${escapeHtml(allowVocabulary ? copy(line.slice(3)) : line.slice(3))}</h2>`); }
      else if (line.startsWith('### ')) { flushParagraph(); flushBullets(); output.push(`<h3>${escapeHtml(allowVocabulary ? copy(line.slice(4)) : line.slice(4))}</h3>`); }
      else if (line.startsWith('- ')) { flushParagraph(); bullets.push(line.slice(2)); }
      else if (!line.trim()) { flushParagraph(); flushBullets(); }
      else paragraph.push(line.trim());
    }
    flushParagraph(); flushBullets(); return output.join('');
  }

  function restricted() { return state.siteRestricted; }
  function effectiveMode() {
    if (restricted()) return 'en';
    return resolveSchedule({ mode: state.mode, funnyEn: state.funnyEn, funnyYue: state.funnyYue, theme: state.theme, density: state.density, accent: state.accent, displayName: state.displayName }, state.schedule).effective.mode;
  }
  function copy(value) { return personalizeOwnedText(value, vocabulary.entries, restricted()); }
  function funnyLevel() { const base = { mode: state.mode, funnyEn: state.funnyEn, funnyYue: state.funnyYue, theme: state.theme, density: state.density, accent: state.accent, displayName: state.displayName }; const effective = restricted() ? { ...base, funnyEn: 1, funnyYue: 1 } : resolveSchedule(base, state.schedule).effective; return effectiveMode() === 'yue' ? effective.funnyYue : effective.funnyEn; }
  function localized(en, yue) { const mode = effectiveMode(); const text = mode === 'yue' ? yue : mode === 'both' ? `${en} · ${yue}` : en; const level = funnyLevel(); if (level <= 1) return text; if (level >= 5) return `${text} ✨`; return text; }
  function title(article) { const mode = effectiveMode(); const raw = mode === 'en' ? article.title : mode === 'yue' ? article.titleYue : `${article.title} · ${article.titleYue}`; return article.source === 'canonical' ? copy(raw) : raw; }
  function displayName() {
    const base = { mode: state.mode, funnyEn: state.funnyEn, funnyYue: state.funnyYue, theme: state.theme, density: state.density, accent: state.accent, displayName: state.displayName };
    const effective = restricted() ? { ...base, mode: 'en' } : resolveSchedule(base, state.schedule).effective;
    return displayNameForPresentation(effective.displayName);
  }
  function setStatus(message) { $('status').textContent = message; }
  function saveControls() {
    for (const key of ['mode', 'funnyEn', 'funnyYue', 'theme', 'density', 'accent', 'settingsTab', 'siteRestricted']) localStorage.setItem(storage + key, state[key]);
  }
  function saveTabs() {
    localStorage.setItem(storage + 'tabs', JSON.stringify(state.tabs));
    localStorage.setItem(storage + 'article', state.tabs.activeTab);
  }
  function saveSearch(kind) {
    localStorage.setItem(storage + `search:${kind}`, JSON.stringify(search[kind]));
  }
  function syncRoute(id, mode = 'push') {
    if (!window.history?.pushState || !window.location) return;
    const hash = routeHash(id);
    if (window.location.hash === hash || mode === 'none') return;
    const method = mode === 'replace' ? 'replaceState' : 'pushState';
    try {
      window.history[method]({ article: id }, '', `${window.location.pathname}${window.location.search}${hash}`);
    } catch {
      window.location.hash = hash;
    }
  }
  function applyAppearance() {
    const resolved = restricted() ? { effective: { mode: 'en', funnyEn: 1, funnyYue: 1, theme: state.theme, density: state.density, accent: state.accent, displayName: state.displayName } } : resolveSchedule({ mode: state.mode, funnyEn: state.funnyEn, funnyYue: state.funnyYue, theme: state.theme, density: state.density, accent: state.accent, displayName: state.displayName }, state.schedule);
    const effective = resolved.effective;
    document.documentElement.dataset.theme = effective.theme;
    document.documentElement.dataset.density = effective.density;
    document.documentElement.style.setProperty('--primary', effective.accent);
    document.documentElement.lang = effectiveMode() === 'yue' ? 'yue-Hant-HK' : 'en';
    const name = displayNameForPresentation(effective.displayName);
    const brand = $('site-brand-name'); if (brand) brand.textContent = name;
    const title = $('document-title'); if (title) title.textContent = `${name} — complete documentation`;
    const displayInput = $('site-display-name'); if (displayInput) { displayInput.value = state.displayName; displayInput.disabled = restricted(); }
    document.querySelectorAll('[data-site-copy]').forEach((node) => {
      const source = node.dataset.siteCopy;
      const labels = {
        'restricted-label': ['Restricted presentation (site-only)', '受限顯示（只限網站）'],
        'restricted-help': ["This site-only restricted switch is separate from the desktop app's shared School mode. It forces English and suppresses personal vocabulary on this browser only; it is not a security boundary.", '呢個只限網站嘅受限顯示開關，同桌面 app 共用嘅 School mode 分開。佢只會喺呢個瀏覽器強制用英文同收起個人詞彙；唔係保安界線。'],
        'dialog-emoji-label': ['Show emojis in dialogs and message boxes', '喺對話框同訊息框顯示 emoji'],
        'dialog-emoji-help': ['Adds a non-semantic emoji to the command palette dialog title while leaving controls and accessible names unchanged.', '只會喺 command palette 對話框標題加非語意 emoji；控制項同無障礙名稱完全不變。'],
        'display-name-label': ['Display name', '顯示名稱'],
        'display-name-save': ['Save display name', '儲存顯示名稱'],
        'display-name-reset': ['Reset to Ding Ding App Store', '重設做 Ding Ding App Store'],
        'display-name-help': ['This changes the label shown by this site only. Routes, asset names, URLs, and application identity never change.', '只會改呢個網站顯示嘅名稱；route、asset 名、網址同應用程式身份永遠唔會改。'],
        'vocabulary-title': ['Personal vocabulary', '個人詞彙'],
        'vocabulary-file-label': ['Choose a local JSON file', '揀本機 JSON 檔案'],
        'vocabulary-replace': ['Replace vocabulary', '取代詞彙'],
        'vocabulary-clear': ['Clear vocabulary', '清除詞彙'],
        'vocabulary-help': ['The file is parsed and cached in this browser only. Its path, metadata, and private values are never sent over the network or included in exports.', '檔案只會喺呢個瀏覽器解析同快取；路徑、metadata 同私人內容永遠唔會經網絡送出或放入匯出檔。'],
        'schedule-tab': ['Schedule', '排程'],
        'schedule-help': ["Schedule temporary local browser overrides for language, funny levels, theme, density, accent, and display name. Values use this device's local timezone; daylight-saving changes follow the browser clock. Lower priority numbers win, and base settings return when no rule is active.", '排定語言、幽默程度、主題、密度、主色同顯示名稱嘅臨時本機瀏覽器覆蓋。所有日期時間都用呢部裝置嘅本地時區；夏令時間轉換跟瀏覽器時鐘。優先數字越細越先，冇規則生效時會還原基本設定。'],
        'schedule-reset': ['Reset schedule', '重設排程'],
        'schedule-add': ['Add rule', '新增規則'],
        'schedule-save': ['Save schedule', '儲存排程'],
        'schedule-boundary': ['This static site intentionally supports local browser data only. It does not read an operating-system vault, Home Assistant, or an external API; those sources belong to the desktop app and are not silently emulated here.', '呢個靜態網站刻意只支援本機瀏覽器資料。佢唔會讀取作業系統憑證庫、Home Assistant 或外部 API；嗰啲來源屬於桌面 app，呢度唔會靜雞雞扮到有。'],
        'schedule-empty': ['No valid schedule rules are present.', '而家冇有效排程規則。'],
      };
      if (labels[source]) node.textContent = restricted() ? labels[source][0] : localized(copy(labels[source][0]), copy(labels[source][1]));
    });
    const restrictedInput = $('site-restricted');
    if (restrictedInput) restrictedInput.checked = state.siteRestricted;
    const card = $('personal-vocabulary-card');
    if (card) card.hidden = restricted();
    document.querySelectorAll('[data-restricted-hide]').forEach((node) => { node.hidden = restricted(); });
    const scheduleTab = $('settings-tab-schedule');
    if (scheduleTab) { scheduleTab.hidden = restricted(); if (restricted() && state.settingsTab === 'schedule') openSettingsTab('general'); }
    const schedulePanel = $('settings-panel-schedule'); if (schedulePanel) schedulePanel.hidden = restricted() || state.settingsTab !== 'schedule';
    const emoji = $('palette-title-emoji');
    if (emoji) emoji.hidden = !shouldShowDialogEmoji(state.showEmojisInDialogs, restricted());
    const emojiInput = $('show-emojis-in-dialogs');
    if (emojiInput) emojiInput.checked = state.showEmojisInDialogs;
    const schedulePresentation = `${effectiveMode()}:${funnyLevel()}`;
    if (!restricted() && renderedSchedulePresentation !== schedulePresentation) renderSchedule();
    renderScheduleStatus();
  }

  function vocabularyStatus(message, messageYue = message) {
    const status = $('personal-vocabulary-status');
    if (status) status.textContent = localized(message, messageYue);
  }
  function refreshVocabularyStatus() {
    vocabulary = loadCachedVocabulary();
    if (vocabulary.corrupt) vocabularyStatus('The cached vocabulary was rejected; original wording is active. Choose a valid local JSON file to replace it.', '快取詞彙被拒絕；而家使用原本文字。請揀有效本機 JSON 檔案取代。');
    else if (vocabulary.loaded) vocabularyStatus(`${vocabulary.entries.length} local vocabulary entries are active. Source path and file metadata were not saved.`, `而家本機啟用緊 ${vocabulary.entries.length} 項詞彙；來源路徑同檔案資料冇被儲存。`);
    else vocabularyStatus('No local JSON file is loaded. Original wording is active.', '未載入本機 JSON 檔案，而家使用原本文字。');
  }
  async function replaceVocabulary() {
    if (restricted()) return;
    const input = $('personal-vocabulary-file');
    const file = input?.files?.[0];
    if (!file) { vocabularyStatus('Choose one local JSON file before replacing vocabulary.', '請先揀一個本機 JSON 檔案，先可以取代詞彙。'); return; }
    if (file.size > 64_000) { vocabularyStatus('The local JSON file is too large; the last valid cache remains active.', '本機 JSON 檔案太大；上一次有效快取會繼續啟用。'); return; }
    try {
      const result = parsePersonalVocabularyJson(new Uint8Array(await file.arrayBuffer()));
      if (!result.ok) { vocabularyStatus(`The local vocabulary file was rejected (${result.reason}); the last valid cache remains active.`, `本機詞彙檔案被拒絕（${result.reason}）；上一次有效快取會繼續啟用。`); return; }
      vocabulary = saveCachedVocabulary(result.document);
      input.value = '';
      refreshVocabularyStatus();
      openArticle(state.article, false, { addTab: false, route: 'none' });
    } catch { vocabularyStatus('The local vocabulary file could not be cached; the last valid cache remains active.', '本機詞彙檔案未能寫入快取；上一次有效快取會繼續啟用。'); }
  }
  function clearVocabulary() {
    if (restricted()) return;
    try { vocabulary = clearCachedVocabulary(); } catch { vocabularyStatus('The local vocabulary cache could not be cleared; original wording remains active only after browser storage is available.', '未能清除本機詞彙快取；瀏覽器儲存可用後先會恢復原本文字。'); return; }
    const input = $('personal-vocabulary-file'); if (input) input.value = '';
    refreshVocabularyStatus();
    openArticle(state.article, false, { addTab: false, route: 'none' });
  }

  function renderScheduleStatus() { const node = $('schedule-status'); if (node) node.textContent = localized(currentScheduleStatus[0], currentScheduleStatus[1]); }
  function scheduleStatus(message, messageYue) { currentScheduleStatus = [message, messageYue]; renderScheduleStatus(); }
  function newRule(index = scheduleDraft.rules.length) {
    return { id: `rule-${Date.now().toString(36)}-${index}`, label: `Scheduled override ${index + 1}`, enabled: true, priority: 0, startDate: '', endDate: '', startTime: '', endTime: '', weekdays: [], values: { mode: state.mode } };
  }
  function renderSchedule(requestedFocusId = null) {
    const host = $('schedule-rules'); if (!host) return;
    const previousFocusId = host.contains(document.activeElement) ? document.activeElement.id : null;
    renderedSchedulePresentation = `${effectiveMode()}:${funnyLevel()}`;
    const l = (en, yue) => localized(en, yue);
    host.innerHTML = scheduleDraft.rules.map((rule, index) => scheduleRuleMarkup(rule, index, l, escapeHtml, displayName())).join('');
    host.querySelectorAll('[data-schedule-index]').forEach((card) => {
      const index = Number(card.dataset.scheduleIndex); const rule = scheduleDraft.rules[index];
      const field = (name) => card.querySelector(`[data-schedule-field="${name}"]`);
      field('valueField').value = Object.keys(rule.values)[0] ?? 'mode'; field('valueValue').value = String(rule.values[field('valueField').value] ?? '');
      card.querySelectorAll('[data-schedule-field]').forEach((control) => control.addEventListener('change', () => {
        const name = control.dataset.scheduleField;
        if (name === 'valueField') { const next = field('valueField').value; rule.values = { [next]: rule.values[next] ?? (next.startsWith('funny') ? 1 : next === 'accent' ? '#4f378b' : next === 'displayName' ? displayName() : next === 'mode' ? 'en' : next === 'theme' ? 'system' : 'comfortable') }; renderSchedule(`schedule-rule-${index}-valueField`); return; }
        if (name === 'weekdays') rule.weekdays = control.value.split(',').filter(Boolean).map(Number);
        else if (name === 'priority') rule.priority = Number(control.value);
        else if (name === 'enabled') rule.enabled = control.checked;
        else if (name === 'valueValue') { const valueField = field('valueField').value; rule.values[valueField] = valueField === 'funnyEn' || valueField === 'funnyYue' ? Number(control.value) : control.value; }
        else rule[name] = control.value;
      }));
    });
    host.querySelectorAll('[data-schedule-delete]').forEach((button) => button.addEventListener('click', () => {
      const index = Number(button.dataset.scheduleDelete);
      scheduleDraft.rules.splice(index, 1);
      const targetIndex = Math.min(index, scheduleDraft.rules.length - 1);
      renderSchedule(targetIndex >= 0 ? `schedule-rule-${targetIndex}-label` : 'schedule-add');
      paletteResults();
    }));
    $('schedule-empty').hidden = scheduleDraft.rules.length > 0;
    if (state.settingsTab === 'schedule') filterSettings();
    const focusId = requestedFocusId || previousFocusId;
    const focusTarget = focusId ? $(focusId) : null;
    if (focusTarget && !focusTarget.closest('[hidden]')) { focusTarget.focus(); focusTarget.scrollIntoView({ block: 'center' }); }
  }
  function saveScheduleDraft() {
    if (restricted()) return;
    const result = saveSchedule(scheduleDraft);
    if (!result.ok) { scheduleStatus(`Schedule was not saved (${result.reason}); the previous valid schedule remains active.`, `排程未能儲存（${result.reason}）；之前有效嘅排程會繼續生效。`); return; }
    state.schedule = result.schedule; scheduleDraft = structuredClone(state.schedule); scheduleStatus(`${state.schedule.rules.length} local schedule rule${state.schedule.rules.length === 1 ? '' : 's'} saved. Base settings remain recoverable.`, `已儲存 ${state.schedule.rules.length} 條本機排程規則；基本設定仍然可以還原。`); applyAppearance(); renderSchedule();
  }
  function reevaluateSchedule() { applyAppearance(); openArticle(state.article, false, { addTab: false, route: 'none' }); }
  function resetSchedule() {
    if (restricted()) return;
    const previous = state.schedule;
    try {
      if (!globalThis.localStorage || typeof globalThis.localStorage.removeItem !== 'function') throw new Error('storage-unavailable');
      globalThis.localStorage.removeItem('ding-ding-docs:schedule:v1');
      if (globalThis.localStorage.getItem('ding-ding-docs:schedule:v1') !== null) throw new Error('storage-readback-mismatch');
      scheduleDraft = { ...EMPTY_SCHEDULE, rules: [] }; state.schedule = scheduleDraft; scheduleStatus('Schedule reset. Base settings are active.', '排程已重設，而家使用基本設定。'); renderSchedule(); applyAppearance();
    } catch { state.schedule = previous; scheduleDraft = structuredClone(previous); scheduleStatus('Schedule reset could not be confirmed; the previous valid schedule remains active.', '未能確認排程已重設；之前有效嘅排程會繼續生效。'); renderSchedule(); }
  }

  function bindOpen() { document.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => openArticle(button.dataset.open))); }
  function homeContent() {
    return `<h1>${escapeHtml(copy(`${displayName()} complete documentation`))}</h1><p class="lede">${escapeHtml(copy('Every implemented feature and every explicit limit is documented from one canonical categorized source. Pending work is labelled pending and never presented as shipped.'))}</p>${categories.map((category) => { const rows = articles.filter((article) => article.category === category.id); return `<section class="feature-category"><h2>${escapeHtml(copy(category.title))}</h2><p>${escapeHtml(copy(category.summary))}</p><div class="suggestion-list">${rows.map((article) => `<button class="result-card" data-open="${article.id}"><strong>${escapeHtml(title(article))}</strong><span class="tag ${article.status}">${article.status}</span><br>${escapeHtml(copy(article.summary))}</button>`).join('')}</div></section>`; }).join('')}`;
  }
  function articleContent(article) {
    if (!article) return homeContent();
    return `<span class="tag ${article.status}">${escapeHtml(article.source === 'canonical' ? copy(article.status) : article.status)}</span><h1>${escapeHtml(title(article))}</h1><p class="lede">${escapeHtml(article.source === 'canonical' ? copy(article.summary) : article.summary)}</p>${markdown(article.body, article.source === 'canonical')}`;
  }

  function browserTabTitle(id) {
    const article = articles.find((item) => item.id === id);
    return article ? title(article) : 'Home';
  }

  function renderBrowserTabs() {
    const target = $('browser-tabs');
    if (!target) return;
    target.innerHTML = state.tabs.openTabs.map((id) => {
      const label = browserTabTitle(id);
      const active = state.tabs.activeTab === id;
      const pinned = state.tabs.pinnedTabs.includes(id);
      return `<div class="browser-tab-shell" role="presentation">
        <button class="browser-tab ${active ? 'active' : ''}" type="button" role="tab" aria-selected="${active}" aria-controls="article" tabindex="${active ? '0' : '-1'}" data-route-tab="${escapeHtml(id)}" title="Open ${escapeHtml(label)}">${pinned ? '<span class="tab-pin-mark" aria-hidden="true">•</span>' : ''}<span>${escapeHtml(label)}</span></button>
        <button class="tab-tool" type="button" data-pin-tab="${escapeHtml(id)}" aria-pressed="${pinned}" aria-label="${pinned ? 'Unpin' : 'Pin'} ${escapeHtml(label)} tab">${pinned ? 'Unpin' : 'Pin'}</button>
        <button class="tab-tool" type="button" data-close-tab="${escapeHtml(id)}" aria-label="Close ${escapeHtml(label)} tab">×</button>
      </div>`;
    }).join('');

    const routeButtons = [...target.querySelectorAll('[data-route-tab]')];
    routeButtons.forEach((button, index) => {
      button.addEventListener('click', () => openArticle(button.dataset.routeTab));
      button.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openArticle(button.dataset.routeTab);
          return;
        }
        if (event.ctrlKey && event.key.toLowerCase() === 'w') {
          event.preventDefault();
          closeOpenTab(button.dataset.routeTab);
          return;
        }
        if (event.altKey && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
          event.preventDefault();
          moveOpenTab(button.dataset.routeTab, event.key === 'ArrowLeft' ? -1 : 1);
          return;
        }
        const targetIndex = event.key === 'Home' ? 0 : event.key === 'End' ? routeButtons.length - 1 : event.key === 'ArrowLeft' ? index - 1 : event.key === 'ArrowRight' ? index + 1 : -1;
        if (targetIndex < 0) return;
        event.preventDefault();
        const next = routeButtons[(targetIndex + routeButtons.length) % routeButtons.length];
        next.focus();
        openArticle(next.dataset.routeTab, false);
      });
    });
    target.querySelectorAll('[data-close-tab]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      closeOpenTab(button.dataset.closeTab);
    }));
    target.querySelectorAll('[data-pin-tab]').forEach((button) => button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleOpenTabPin(button.dataset.pinTab);
    }));
  }

  function closeOpenTab(id) {
    const next = closeTabState(state.tabs, id, articleIds);
    if (next.openTabs.length === state.tabs.openTabs.length) {
      setStatus('Keep at least one documentation tab open.');
      return;
    }
    const activeChanged = next.activeTab !== state.article;
    state.tabs = next;
    openArticle(next.activeTab, activeChanged, { addTab: false, route: activeChanged ? 'push' : 'none' });
  }

  function moveOpenTab(id, direction) {
    const before = state.tabs.openTabs.join('|');
    const next = moveTabState(state.tabs, id, direction, articleIds);
    if (next.openTabs.join('|') === before) {
      setStatus(`${browserTabTitle(id)} is already at that edge.`);
      return;
    }
    state.tabs = next;
    saveTabs();
    renderBrowserTabs();
    const button = [...document.querySelectorAll('[data-route-tab]')].find((candidate) => candidate.dataset.routeTab === id);
    if (button) button.focus();
    setStatus(`Moved ${browserTabTitle(id)} ${direction < 0 ? 'left' : 'right'}.`);
  }

  function toggleOpenTabPin(id) {
    state.tabs = togglePinned(state.tabs, id, articleIds);
    saveTabs();
    renderBrowserTabs();
    setStatus(`${state.tabs.pinnedTabs.includes(id) ? 'Pinned' : 'Unpinned'} ${browserTabTitle(id)}.`);
  }

  function tabs() {
    $('article-tabs').innerHTML = categories.map((category) => `<div class="article-tab-group" role="group" aria-label="${escapeHtml(category.title)}"><p>${escapeHtml(category.title)}</p>${articles.filter((article) => article.category === category.id).map((article) => `<button id="site-tab-${article.id}" class="rail-tab ${state.article === article.id ? 'active' : ''}" data-article="${article.id}" role="tab" aria-selected="${state.article === article.id}" aria-controls="article" tabindex="${state.article === article.id ? '0' : '-1'}"><span>${escapeHtml(title(article))}</span><small>${article.status}</small></button>`).join('')}</div>`).join('');
    const buttons = [...document.querySelectorAll('[data-article]')];
    buttons.forEach((button, index) => {
      button.onclick = () => openArticle(button.dataset.article);
      button.onkeydown = (event) => {
        let target = index;
        if (event.key === 'ArrowDown' || event.key === 'ArrowRight') target = (index + 1) % buttons.length;
        else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') target = (index - 1 + buttons.length) % buttons.length;
        else if (event.key === 'Home') target = 0;
        else if (event.key === 'End') target = buttons.length - 1;
        else return;
        event.preventDefault(); buttons[target].focus(); openArticle(buttons[target].dataset.article, false);
      };
    });
  }

  function openArticle(id, focus = true, options = {}) {
    const target = articles.some((article) => article.id === id) ? id : 'home';
    state.tabs = options.addTab === false
      ? { ...state.tabs, activeTab: target }
      : addTab(state.tabs, target, articleIds);
    state.article = state.tabs.activeTab;
    saveTabs();
    syncRoute(state.article, options.route ?? 'push');
    const article = articles.find((item) => item.id === state.article);
    $('article').innerHTML = articleContent(article);
    bindOpen(); tabs(); renderBrowserTabs();
    $('home-tab').classList.toggle('active', state.article === 'home');
    $('home-tab').setAttribute('aria-selected', String(state.article === 'home'));
    $('home-tab').tabIndex = state.article === 'home' ? 0 : -1;
    if (focus) $('article').focus({ preventScroll: true });
    setStatus(article ? `Opened ${title(article)} in ${displayName()}. Status: ${article.status}.` : `Ready. ${articles.length} complete feature articles are available for ${displayName()}.`);
  }

  function matcher(kind, query) {
    const mode = search[kind]; const key = mode.regex ? mode.pattern : query;
    if (!key) return () => true;
    try {
      const expression = mode.regex ? new RegExp(mode.pattern.slice(0, 256), mode.flags.replace('g', '')) : null;
      const needle = key.toLocaleLowerCase();
      return (text) => expression ? (expression.lastIndex = 0, expression.test(text)) : text.toLocaleLowerCase().includes(needle);
    } catch { return () => false; }
  }

  function renderDocsResults() {
    const query = $('docs-search').value.trim(); const mode = search.docs; const key = mode.regex ? mode.pattern : query;
    if (!mode.regex) mode.query = query;
    saveSearch('docs');
    if (!key) { $('results').innerHTML = ''; return; }
    const match = matcher('docs', query);
    const rows = articles.filter((article) => match([article.title, article.titleYue, article.category, article.status, article.summary, article.body].join('\n')));
    $('results').innerHTML = rows.length ? `<h2>Search results (${rows.length})</h2>${rows.map((article) => `<button class="result-card" data-open="${article.id}"><strong>${escapeHtml(title(article))}</strong><br>${escapeHtml(article.source === 'canonical' ? copy(article.summary) : article.summary)}</button>`).join('')}` : `<p class="empty">No documentation matches “${escapeHtml(key)}”. Clear the query or adjust the pattern.</p>`;
    bindOpen();
  }

  function buildRegexPanel(kind, onApply) {
    const panel = $(`${kind}-regex-panel`);
    panel.innerHTML = `<label>Pattern <input data-regex="pattern" maxlength="256" aria-label="Regex pattern"></label><fieldset><legend>Flags</legend>${['i', 'm', 's', 'u'].map((flag) => `<label class="flag"><input type="checkbox" data-flag="${flag}" ${search[kind].flags.includes(flag) ? 'checked' : ''}>${flag}</label>`).join('')}</fieldset><label>Sample text <textarea data-regex="sample" maxlength="2048">Catalog\nInstaller\nAppearance</textarea></label><p data-regex="result" role="status">Plain-text search is active.</p><div class="regex-actions"><button data-token="literal">Literal</button><button data-token="[A-Za-z]">Class</button><button data-token="^">Anchor</button><button data-token="()">Group</button><button data-token="|">Alternation</button><button data-token="{1,3}">Quantifier</button></div><footer><button data-regex="plain" class="text-button">Use plain text</button><button data-regex="apply" class="text-button">Apply regex to search</button></footer>`;
    const pattern = panel.querySelector('[data-regex="pattern"]'); const result = panel.querySelector('[data-regex="result"]');
    pattern.value = search[kind].pattern || $(`${kind}-search`).value;
    const update = () => {
      search[kind].pattern = pattern.value; search[kind].flags = [...panel.querySelectorAll('[data-flag]:checked')].map((input) => input.dataset.flag).join('');
      try { const expression = new RegExp(pattern.value, search[kind].flags.replace('g', '') + 'g'); const matches = [...panel.querySelector('[data-regex="sample"]').value.matchAll(expression)].slice(0, 100); result.textContent = `${matches.length} matches. ${matches.map((item) => item[0] || 'zero-width').join(', ') || 'No match.'}`; }
      catch (error) { result.textContent = `Invalid regex: ${error.message}`; }
    };
    panel.querySelectorAll('input, textarea').forEach((input) => input.addEventListener('input', update));
    panel.querySelectorAll('[data-token]').forEach((button) => button.addEventListener('click', () => { pattern.setRangeText(button.dataset.token, pattern.selectionStart, pattern.selectionEnd, 'end'); pattern.focus(); update(); }));
    panel.querySelector('[data-regex="plain"]').addEventListener('click', () => { search[kind].regex = false; search[kind].query = $(`${kind}-search`).value; search[kind].pattern = ''; saveSearch(kind); panel.hidden = true; $(`${kind}-regex-toggle`).setAttribute('aria-expanded', 'false'); onApply(); });
    panel.querySelector('[data-regex="apply"]').addEventListener('click', () => { update(); search[kind].regex = true; search[kind].query = pattern.value; $(`${kind}-search`).value = pattern.value; saveSearch(kind); panel.hidden = true; $(`${kind}-regex-toggle`).setAttribute('aria-expanded', 'false'); onApply(); });
    update();
  }

  function setupBuilder(kind, onApply) {
    buildRegexPanel(kind, onApply);
    $(`${kind}-regex-toggle`).addEventListener('click', () => {
      const panel = $(`${kind}-regex-panel`); panel.hidden = !panel.hidden;
      $(`${kind}-regex-toggle`).setAttribute('aria-expanded', String(!panel.hidden));
      if (!panel.hidden) {
        const pattern = panel.querySelector('[data-regex="pattern"]');
        if (!search[kind].regex) pattern.value = $(`${kind}-search`).value;
        pattern.dispatchEvent(new Event('input', { bubbles: true }));
        pattern.focus();
      }
    });
  }

  function openSettingsTab(id, focus = false) {
    state.settingsTab = ['general', 'appearance', 'schedule', 'about'].includes(id) && !(restricted() && id === 'schedule') ? id : 'general'; saveControls();
    document.querySelectorAll('[data-settings-tab]').forEach((tab) => { const active = tab.dataset.settingsTab === state.settingsTab; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    document.querySelectorAll('[data-settings-panel]').forEach((panel) => { panel.hidden = panel.dataset.settingsPanel !== state.settingsTab; });
    $('settings-search').value = search.settings.regex ? search.settings.pattern : search.settings.query;
    filterSettings();
    if (focus) $(`settings-tab-${state.settingsTab}`).focus();
  }
  function visibleSettingsTabs() { return [...document.querySelectorAll('[data-settings-tab]')].filter((tab) => !tab.hidden); }
  function filterSettings() {
    const panel = $(`settings-panel-${state.settingsTab}`); const match = matcher('settings', $('settings-search').value.trim()); let visible = 0;
    if (!search.settings.regex) search.settings.query = $('settings-search').value.trim();
    saveSearch('settings');
    panel.querySelectorAll('[data-settings-text]').forEach((row) => { const inVocabularyCard = Boolean(row.closest('#personal-vocabulary-card')); const show = !((restricted() && inVocabularyCard) || (restricted() && row.hasAttribute('data-restricted-hide'))) && match(`${row.dataset.settingsText} ${row.textContent}`); row.hidden = !show; if (show) visible += 1; });
    $('settings-empty').hidden = visible > 0;
  }

  function schedulePaletteControls() {
    if (restricted()) return [];
    return [...document.querySelectorAll('#settings-panel-schedule [data-settings-focus]')].map((row) => {
      const focusId = row.dataset.settingsFocus;
      const card = row.closest('[data-schedule-index]');
      const ruleNumber = Number(card?.dataset.scheduleIndex ?? 0) + 1;
      const ruleLabel = card?.querySelector('h3')?.textContent.trim() || localized('Unnamed rule', '未命名規則');
      const controlLabel = row.textContent.replace(/\s+/g, ' ').trim();
      const label = localized(`Rule ${ruleNumber}: ${ruleLabel} — ${controlLabel}`, `規則 ${ruleNumber}：${ruleLabel} — ${controlLabel}`);
      return { id: `setting-schedule-control-${focusId}`, label, type: localized('Schedule rule control', '排程規則控制') };
    });
  }

  function focusSettingsControl(tab, focusId) {
    search.settings.regex = false;
    search.settings.pattern = '';
    search.settings.query = '';
    openSettingsTab(tab);
    const control = $(focusId);
    if (!control) return false;
    control.focus();
    control.scrollIntoView({ block: 'center' });
    return document.activeElement === control;
  }

  function paletteResults() {
    const value = $('palette-search').value.trim(); const match = matcher('palette', value);
    if (!search.palette.regex) search.palette.query = value;
    saveSearch('palette');
    const destinationSettings = ['general', 'appearance', ...(restricted() ? [] : ['schedule']), 'about'].map((id) => ({ id: `setting-${id}`, label: id === 'schedule' ? localized('Schedule settings', '排程設定') : `${id[0].toUpperCase()}${id.slice(1)} settings`, type: id === 'schedule' ? localized('Setting destination', '設定目的地') : 'Setting destination' }));
    const scheduleControls = restricted() ? [] : ['schedule-add', 'schedule-save', 'schedule-reset'].map((id) => ({ id: `setting-${id}`, label: localized(id.replace('schedule-', '').replace('-', ' '), id === 'schedule-add' ? '新增規則' : id === 'schedule-save' ? '儲存排程' : '重設排程'), type: localized('Schedule control', '排程控制') }));
    const rows = [{ id: 'home', label: displayName(), type: 'Destination' }, ...articles.map((article) => ({ id: article.id, label: title(article), type: `${article.category} · ${article.status}` })), ...destinationSettings, ...scheduleControls, ...schedulePaletteControls(), ...(restricted() ? [] : [{ id: 'setting-display-name', label: localized('Display name', '顯示名稱'), type: localized('Settings control · local label', '設定控制 · 本機標籤') }, { id: 'setting-show-emojis-in-dialogs', label: localized('Show emojis in dialogs and message boxes', '喺對話框同訊息框顯示 emoji'), type: localized('Settings control · dialog decoration', '設定控制 · 對話框裝飾') }, { id: 'setting-personal-vocabulary-import', label: localized('Import personal vocabulary JSON', '匯入本機個人詞彙 JSON'), type: localized('Settings control · local upload', '設定控制 · 本機上載') }, { id: 'setting-personal-vocabulary-clear', label: localized('Clear personal vocabulary', '清除本機個人詞彙'), type: localized('Settings control · local reset', '設定控制 · 本機重設') }, { id: 'setting-schedule', label: localized('Scheduled settings', '設定排程'), type: localized('Settings control · local browser schedule', '設定控制 · 本機瀏覽器排程') }]), { id: 'setting-site-restricted', label: localized('Restricted presentation (site-only)', '受限顯示（只限網站）'), type: localized('Settings control · local mode', '設定控制 · 本機模式') }].filter((row) => match(`${row.label} ${row.type}`));
    $('palette-results').innerHTML = rows.length ? rows.map((row) => `<button class="palette-row" data-command="${row.id}" role="option"><strong>${escapeHtml(row.label)}</strong><br><small>${escapeHtml(row.type)}</small></button>`).join('') : '<p class="empty">No command or destination matches.</p>';
    document.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => { $('palette').close(); const id = button.dataset.command; if (id === 'setting-display-name') { openSettingsTab('general'); $('site-display-name').focus(); $('settings-title').scrollIntoView(); } else if (id === 'setting-show-emojis-in-dialogs') { openSettingsTab('general'); $('show-emojis-in-dialogs').focus(); $('settings-title').scrollIntoView(); } else if (id === 'setting-personal-vocabulary-import') { openSettingsTab('general'); $('personal-vocabulary-file').focus(); $('settings-title').scrollIntoView(); } else if (id === 'setting-personal-vocabulary-clear') { openSettingsTab('general'); $('personal-vocabulary-clear').focus(); $('settings-title').scrollIntoView(); } else if (id === 'setting-site-restricted') { openSettingsTab('general'); $('site-restricted').focus(); $('settings-title').scrollIntoView(); } else if (id.startsWith('setting-schedule-control-')) { focusSettingsControl('schedule', id.slice('setting-schedule-control-'.length)); } else if (id === 'setting-schedule-add' || id === 'setting-schedule-save' || id === 'setting-schedule-reset') { focusSettingsControl('schedule', id.slice(8)); } else if (id.startsWith('setting-')) { openSettingsTab(id.slice(8)); $('settings-title').scrollIntoView(); } else openArticle(id); }));
  }

  ['docs', 'settings', 'palette'].forEach((kind) => {
    const input = $(`${kind}-search`);
    input.value = search[kind].regex ? search[kind].pattern : search[kind].query;
  });
  $('docs-search').addEventListener('input', () => { if (search.docs.regex) search.docs.pattern = $('docs-search').value; else search.docs.query = $('docs-search').value; saveSearch('docs'); renderDocsResults(); });
  $('settings-search').addEventListener('input', () => { if (search.settings.regex) search.settings.pattern = $('settings-search').value; else search.settings.query = $('settings-search').value; saveSearch('settings'); filterSettings(); });
  $('palette-search').addEventListener('input', () => { if (search.palette.regex) search.palette.pattern = $('palette-search').value; else search.palette.query = $('palette-search').value; saveSearch('palette'); paletteResults(); });
  setupBuilder('docs', renderDocsResults); setupBuilder('settings', filterSettings); setupBuilder('palette', paletteResults);

    document.querySelectorAll('[data-settings-tab]').forEach((tab) => {
    tab.addEventListener('click', () => openSettingsTab(tab.dataset.settingsTab));
    tab.addEventListener('keydown', (event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; const tabs = visibleSettingsTabs(); const index = tabs.indexOf(tab); event.preventDefault(); const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; openSettingsTab(tabs[target].dataset.settingsTab, true); });
  });

  $('language').value = state.mode; $('funny-en').value = state.funnyEn; $('funny-yue').value = state.funnyYue; $('funny-en-value').textContent = state.funnyEn; $('funny-yue-value').textContent = state.funnyYue;
  $('theme').value = state.theme; $('density').value = state.density; $('accent').value = state.accent;
  $('site-restricted').checked = state.siteRestricted;
  $('show-emojis-in-dialogs').checked = state.showEmojisInDialogs;
  $('show-emojis-in-dialogs').addEventListener('change', (event) => { const enabled = Boolean(event.target.checked); if (!writeDialogEmojiPreference(enabled)) { state.showEmojisInDialogs = true; event.target.checked = true; setStatus('Browser storage is unavailable; dialog emojis remain enabled for this session.'); } else state.showEmojisInDialogs = enabled; applyAppearance(); });
  $('site-restricted').addEventListener('change', (event) => { state.siteRestricted = Boolean(event.target.checked); saveControls(); applyAppearance(); openSettingsTab('general'); openArticle(state.article, false, { addTab: false, route: 'none' }); });
  $('schedule-add').addEventListener('click', () => { if (restricted() || scheduleDraft.rules.length >= 32) return; const index = scheduleDraft.rules.length; scheduleDraft.rules.push(newRule()); renderSchedule(`schedule-rule-${index}-label`); paletteResults(); });
  $('schedule-save').addEventListener('click', saveScheduleDraft);
  $('schedule-reset').addEventListener('click', resetSchedule);
  window.setInterval(reevaluateSchedule, 30_000);
  window.addEventListener('visibilitychange', () => { if (!document.hidden) reevaluateSchedule(); });
  function commitDisplayName(value) {
    if (restricted()) return;
    const result = saveDisplayName(value);
    if (!result.ok) { setStatus('Display name must be 1–64 characters with no control characters; the previous label remains active.'); applyAppearance(); return; }
    state.displayName = result.value;
    applyAppearance();
    openArticle(state.article, false, { addTab: false, route: 'none' });
    setStatus(`Display name saved as ${state.displayName}. Routes and URLs are unchanged.`);
    paletteResults();
  }
  $('site-display-name-save').addEventListener('click', () => commitDisplayName($('site-display-name').value));
  $('site-display-name-reset').addEventListener('click', () => { if (restricted()) return; const result = resetDisplayName(); if (!result.ok) { setStatus('Browser storage could not reset the display name; the previous label remains active.'); return; } state.displayName = result.value; applyAppearance(); openArticle(state.article, false, { addTab: false, route: 'none' }); setStatus(`Display name reset to ${DEFAULT_DISPLAY_NAME}. Routes and URLs are unchanged.`); paletteResults(); });
  $('personal-vocabulary-replace').addEventListener('click', () => void replaceVocabulary());
  $('personal-vocabulary-clear').addEventListener('click', clearVocabulary);
  refreshVocabularyStatus();
  $('language').addEventListener('change', (event) => { state.mode = event.target.value; saveControls(); applyAppearance(); openArticle(state.article, false); });
  [['funny-en', 'funnyEn', 'funny-en-value'], ['funny-yue', 'funnyYue', 'funny-yue-value']].forEach(([id, key, output]) => $(id).addEventListener('input', (event) => { state[key] = +event.target.value; $(output).textContent = event.target.value; saveControls(); setStatus(`${id === 'funny-en' ? 'English' : 'Cantonese'} funny level set to ${event.target.value}; factual article content is unchanged.`); }));
  [['theme', 'theme'], ['density', 'density'], ['accent', 'accent']].forEach(([id, key]) => $(id).addEventListener('input', (event) => { state[key] = event.target.value; saveControls(); applyAppearance(); }));

  $('palette-button').addEventListener('click', () => { $('palette').showModal(); $('palette-search').value = search.palette.regex ? search.palette.pattern : search.palette.query; paletteResults(); $('palette-search').focus(); });
  $('palette-close').addEventListener('click', () => $('palette').close());
  $('new-doc-tab').addEventListener('click', () => {
    const next = ['home', ...articleIds].find((id) => !state.tabs.openTabs.includes(id)) || 'home';
    openArticle(next);
  });
  window.addEventListener('keydown', (event) => { if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); $('palette-button').click(); } });
  window.addEventListener('hashchange', () => {
    const id = tabIdFromHash(window.location.hash, articleIds);
    if (id) openArticle(id, false, { route: 'none' });
  });

  renderSchedule();
  if (state.schedule.corrupt) scheduleStatus('The saved schedule was rejected; base settings are active. Add valid rules and save to replace it.', '已儲存嘅排程被拒絕；而家使用基本設定。請新增有效規則再儲存取代。');
  else if (state.schedule.unavailable) scheduleStatus('Browser storage is unavailable; schedule changes stay in this session only.', '瀏覽器儲存不可用；排程變更只會留喺今次工作階段。');
  else if (state.schedule.rules.length) scheduleStatus(`${state.schedule.rules.length} local schedule rule${state.schedule.rules.length === 1 ? '' : 's'} loaded. Base settings remain recoverable.`, `已載入 ${state.schedule.rules.length} 條本機排程規則；基本設定仍然可以還原。`);
  else scheduleStatus('No schedule rules are saved. Base settings remain active.', '未儲存任何排程規則；而家使用基本設定。');
  applyAppearance(); openSettingsTab(state.settingsTab);
  openArticle(tabIdFromHash(window.location.hash, articleIds) || state.tabs.activeTab, false, { route: 'replace' });
})();
