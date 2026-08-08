(() => {
  'use strict';
  const bundle = window.DING_DING_DOCS;
  if (!bundle?.articles?.length) throw new Error('The generated documentation bundle is missing.');
  const articles = bundle.articles;
  const categories = bundle.categories;
  const $ = (id) => document.getElementById(id);
  const storage = 'ding-ding-docs:';
  const state = {
    article: localStorage.getItem(storage + 'article') || 'home',
    mode: localStorage.getItem(storage + 'mode') || 'en',
    funnyEn: +(localStorage.getItem(storage + 'funnyEn') || 2),
    funnyYue: +(localStorage.getItem(storage + 'funnyYue') || 3),
    theme: localStorage.getItem(storage + 'theme') || 'system',
    density: localStorage.getItem(storage + 'density') || 'comfortable',
    accent: localStorage.getItem(storage + 'accent') || '#4f378b',
    settingsTab: localStorage.getItem(storage + 'settingsTab') || 'general',
  };
  const search = { docs: { regex: false, pattern: '', flags: 'iu' }, settings: { regex: false, pattern: '', flags: 'iu' }, palette: { regex: false, pattern: '', flags: 'iu' } };

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
  const articleId = (href) => href.match(/(?:^|\/)([a-z0-9-]+)\.md(?:#.*)?$/i)?.[1] || null;
  function inline(raw) {
    const pattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*)/g;
    let output = ''; let cursor = 0;
    for (const match of raw.matchAll(pattern)) {
      output += escapeHtml(raw.slice(cursor, match.index));
      const token = match[0];
      if (token.startsWith('[')) {
        const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/); const id = link && articleId(link[2]);
        output += id ? `<button class="article-link" data-open="${escapeHtml(id)}">${escapeHtml(link[1])}</button>` : escapeHtml(link?.[1] || token);
      } else if (token.startsWith('`')) output += `<code>${escapeHtml(token.slice(1, -1))}</code>`;
      else output += `<strong>${escapeHtml(token.slice(2, -2))}</strong>`;
      cursor = match.index + token.length;
    }
    return output + escapeHtml(raw.slice(cursor));
  }

  function markdown(body) {
    const output = []; let paragraph = []; let bullets = [];
    const flushParagraph = () => { if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; };
    const flushBullets = () => { if (bullets.length) output.push(`<ul>${bullets.map((line) => `<li>${inline(line)}</li>`).join('')}</ul>`); bullets = []; };
    for (const line of body.replace(/\r/g, '').split('\n')) {
      if (line.startsWith('# ')) continue;
      if (line.startsWith('## ')) { flushParagraph(); flushBullets(); output.push(`<h2>${escapeHtml(line.slice(3))}</h2>`); }
      else if (line.startsWith('### ')) { flushParagraph(); flushBullets(); output.push(`<h3>${escapeHtml(line.slice(4))}</h3>`); }
      else if (line.startsWith('- ')) { flushParagraph(); bullets.push(line.slice(2)); }
      else if (!line.trim()) { flushParagraph(); flushBullets(); }
      else paragraph.push(line.trim());
    }
    flushParagraph(); flushBullets(); return output.join('');
  }

  function title(article) { return state.mode === 'en' ? article.title : state.mode === 'yue' ? article.titleYue : `${article.title} · ${article.titleYue}`; }
  function setStatus(message) { $('status').textContent = message; }
  function saveControls() {
    for (const key of ['mode', 'funnyEn', 'funnyYue', 'theme', 'density', 'accent', 'settingsTab']) localStorage.setItem(storage + key, state[key]);
  }
  function applyAppearance() {
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.dataset.density = state.density;
    document.documentElement.style.setProperty('--primary', state.accent);
    document.documentElement.lang = state.mode === 'yue' ? 'yue-Hant-HK' : 'en';
  }

  function bindOpen() { document.querySelectorAll('[data-open]').forEach((button) => button.addEventListener('click', () => openArticle(button.dataset.open))); }
  function homeContent() {
    return `<h1>Ding Ding App Store complete documentation</h1><p class="lede">Every implemented feature and every explicit limit is documented from one canonical categorized source. Pending work is labelled pending and never presented as shipped.</p>${categories.map((category) => { const rows = articles.filter((article) => article.category === category.id); return `<section class="feature-category"><h2>${escapeHtml(category.title)}</h2><p>${escapeHtml(category.summary)}</p><div class="suggestion-list">${rows.map((article) => `<button class="result-card" data-open="${article.id}"><strong>${escapeHtml(title(article))}</strong><span class="tag ${article.status}">${article.status}</span><br>${escapeHtml(article.summary)}</button>`).join('')}</div></section>`; }).join('')}`;
  }
  function articleContent(article) {
    if (!article) return homeContent();
    return `<span class="tag ${article.status}">${article.status}</span><h1>${escapeHtml(title(article))}</h1><p class="lede">${escapeHtml(article.summary)}</p>${markdown(article.body)}`;
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

  function openArticle(id, focus = true) {
    state.article = articles.some((article) => article.id === id) ? id : 'home';
    localStorage.setItem(storage + 'article', state.article);
    const article = articles.find((item) => item.id === state.article);
    $('article').innerHTML = articleContent(article);
    bindOpen(); tabs();
    $('home-tab').classList.toggle('active', state.article === 'home');
    $('home-tab').setAttribute('aria-selected', String(state.article === 'home'));
    $('home-tab').tabIndex = state.article === 'home' ? 0 : -1;
    if (focus) $('article').focus({ preventScroll: true });
    setStatus(article ? `Opened ${title(article)}. Status: ${article.status}.` : `Ready. ${articles.length} complete feature articles are available.`);
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
    if (!key) { $('results').innerHTML = ''; return; }
    const match = matcher('docs', query);
    const rows = articles.filter((article) => match([article.title, article.titleYue, article.category, article.status, article.summary, article.body].join('\n')));
    $('results').innerHTML = rows.length ? `<h2>Search results (${rows.length})</h2>${rows.map((article) => `<button class="result-card" data-open="${article.id}"><strong>${escapeHtml(title(article))}</strong><br>${escapeHtml(article.summary)}</button>`).join('')}` : `<p class="empty">No documentation matches “${escapeHtml(key)}”. Clear the query or adjust the pattern.</p>`;
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
    panel.querySelector('[data-regex="plain"]').addEventListener('click', () => { search[kind].regex = false; search[kind].pattern = ''; panel.hidden = true; $(`${kind}-regex-toggle`).setAttribute('aria-expanded', 'false'); onApply(); });
    panel.querySelector('[data-regex="apply"]').addEventListener('click', () => { update(); search[kind].regex = true; $(`${kind}-search`).value = pattern.value; panel.hidden = true; $(`${kind}-regex-toggle`).setAttribute('aria-expanded', 'false'); onApply(); });
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
    state.settingsTab = ['general', 'appearance', 'about'].includes(id) ? id : 'general'; saveControls();
    document.querySelectorAll('[data-settings-tab]').forEach((tab) => { const active = tab.dataset.settingsTab === state.settingsTab; tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1; });
    document.querySelectorAll('[data-settings-panel]').forEach((panel) => { panel.hidden = panel.dataset.settingsPanel !== state.settingsTab; });
    $('settings-search').value = ''; search.settings.pattern = ''; search.settings.regex = false; filterSettings();
    if (focus) $(`settings-tab-${state.settingsTab}`).focus();
  }
  function filterSettings() {
    const panel = $(`settings-panel-${state.settingsTab}`); const match = matcher('settings', $('settings-search').value.trim()); let visible = 0;
    panel.querySelectorAll('[data-settings-text]').forEach((row) => { const show = match(`${row.dataset.settingsText} ${row.textContent}`); row.hidden = !show; if (show) visible += 1; });
    $('settings-empty').hidden = visible > 0;
  }

  function paletteResults() {
    const value = $('palette-search').value.trim(); const match = matcher('palette', value);
    const rows = [{ id: 'home', label: 'Home', type: 'Destination' }, ...articles.map((article) => ({ id: article.id, label: title(article), type: `${article.category} · ${article.status}` })), ...['general', 'appearance', 'about'].map((id) => ({ id: `setting-${id}`, label: `${id[0].toUpperCase()}${id.slice(1)} settings`, type: 'Setting destination' }))].filter((row) => match(`${row.label} ${row.type}`));
    $('palette-results').innerHTML = rows.length ? rows.map((row) => `<button class="palette-row" data-command="${row.id}" role="option"><strong>${escapeHtml(row.label)}</strong><br><small>${escapeHtml(row.type)}</small></button>`).join('') : '<p class="empty">No command or destination matches.</p>';
    document.querySelectorAll('[data-command]').forEach((button) => button.addEventListener('click', () => { $('palette').close(); const id = button.dataset.command; if (id.startsWith('setting-')) { openSettingsTab(id.slice(8)); $('settings-title').scrollIntoView(); } else openArticle(id); }));
  }

  $('docs-search').addEventListener('input', () => { if (search.docs.regex) search.docs.pattern = $('docs-search').value; renderDocsResults(); });
  $('settings-search').addEventListener('input', () => { if (search.settings.regex) search.settings.pattern = $('settings-search').value; filterSettings(); });
  $('palette-search').addEventListener('input', () => { if (search.palette.regex) search.palette.pattern = $('palette-search').value; paletteResults(); });
  setupBuilder('docs', renderDocsResults); setupBuilder('settings', filterSettings); setupBuilder('palette', paletteResults);

  document.querySelectorAll('[data-settings-tab]').forEach((tab, index, tabs) => {
    tab.addEventListener('click', () => openSettingsTab(tab.dataset.settingsTab));
    tab.addEventListener('keydown', (event) => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const target = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length; openSettingsTab(tabs[target].dataset.settingsTab, true); });
  });

  $('language').value = state.mode; $('funny-en').value = state.funnyEn; $('funny-yue').value = state.funnyYue; $('funny-en-value').textContent = state.funnyEn; $('funny-yue-value').textContent = state.funnyYue;
  $('theme').value = state.theme; $('density').value = state.density; $('accent').value = state.accent;
  $('language').addEventListener('change', (event) => { state.mode = event.target.value; saveControls(); applyAppearance(); openArticle(state.article, false); });
  [['funny-en', 'funnyEn', 'funny-en-value'], ['funny-yue', 'funnyYue', 'funny-yue-value']].forEach(([id, key, output]) => $(id).addEventListener('input', (event) => { state[key] = +event.target.value; $(output).textContent = event.target.value; saveControls(); setStatus(`${id === 'funny-en' ? 'English' : 'Cantonese'} funny level set to ${event.target.value}; factual article content is unchanged.`); }));
  [['theme', 'theme'], ['density', 'density'], ['accent', 'accent']].forEach(([id, key]) => $(id).addEventListener('input', (event) => { state[key] = event.target.value; saveControls(); applyAppearance(); }));

  $('palette-button').addEventListener('click', () => { $('palette').showModal(); $('palette-search').value = ''; search.palette.pattern = ''; search.palette.regex = false; paletteResults(); $('palette-search').focus(); });
  $('palette-close').addEventListener('click', () => $('palette').close());
  window.addEventListener('keydown', (event) => { if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f') { event.preventDefault(); $('palette-button').click(); } });

  applyAppearance(); openSettingsTab(state.settingsTab); openArticle(state.article, false);
})();
