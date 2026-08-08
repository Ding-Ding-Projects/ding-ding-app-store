import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const normalizeNewlines = (value) => value?.replaceAll('\r\n', '\n');

// Hand-written coverage inventory. Adding a feature requires choosing its public category,
// canonical article, wiki title, and related reading here before any bundle can pass.
const categories = [
  { id: 'discovery', title: 'Discovery and catalog', summary: 'Finding reviewed public applications and understanding their release state.' },
  { id: 'installation', title: 'Installation and removal', summary: 'Verified install adapters, fail-closed source builds, removal, and pending automation.' },
  { id: 'installed', title: 'Installed apps and history', summary: 'Windows discovery, owned records, operation history, snapshots, and export.' },
  { id: 'updates', title: 'Updates and schedules', summary: 'Catalog comparisons, the App Store updater, repeat checks, and quiet hours.' },
  { id: 'experience', title: 'Workspace and customization', summary: 'Tabs, search, command palette, settings, appearance, and notifications.' },
  { id: 'documentation', title: 'Documentation', summary: 'The complete offline in-app browser and its generated public mirrors.' },
  { id: 'security', title: 'Security and privacy', summary: 'Renderer isolation, privileged validation, local data, and evidence boundaries.' },
  { id: 'verification', title: 'Verification', summary: 'What static checks, tests, runtime captures, workflows, and releases prove.' },
];

const articles = [
  ['catalog-discovery', 'Catalog discovery', '目錄探索', 'discovery', 'Catalog-Discovery', 'shipped', ['verified-installer-operations', 'per-app-update-checker', 'privacy-and-security']],
  ['verified-installer-operations', 'Verified installer operations', '已驗證安裝操作', 'installation', 'Verified-Installer-Operations', 'limited', ['catalog-discovery', 'source-build-security', 'uninstall']],
  ['one-click-installation', 'One-click installation and adapter coverage', '一按安裝同配接器覆蓋', 'installation', 'One-Click-Installation', 'limited', ['verified-installer-operations', 'source-build-security', 'uninstall']],
  ['source-build-security', 'Source-build security', '原始碼建置安全', 'installation', 'Source-Build-Security', 'limited', ['verified-installer-operations', 'automatic-repair-and-universal-adapters', 'privacy-and-security']],
  ['uninstall', 'Protected uninstall', '安全解除安裝', 'installation', 'Uninstall', 'shipped', ['installed-app-discovery', 'verified-installer-operations', 'activity-history']],
  ['automatic-repair-and-universal-adapters', 'Automatic repair and universal adapters', '自動修復同通用安裝配接器', 'installation', 'Automatic-Repair-and-Universal-Adapters', 'limited', ['verified-installer-operations', 'source-build-security', 'verification']],
  ['installed-app-discovery', 'Installed app discovery', '已安裝 App 偵測', 'installed', 'Installed-App-Discovery', 'shipped', ['uninstall', 'activity-history', 'privacy-and-security']],
  ['activity-history', 'Activity history and export', '操作記錄同匯出', 'installed', 'Activity-History', 'shipped', ['installed-app-discovery', 'verified-installer-operations', 'privacy-and-security']],
  ['per-app-update-checker', 'Per-app update checker', '每個 App 更新檢查', 'updates', 'Per-App-Update-Checker', 'limited', ['catalog-discovery', 'app-store-self-updater', 'update-schedule']],
  ['app-store-self-updater', 'App Store self-updater', 'App Store 自己更新', 'updates', 'App-Store-Self-Updater', 'limited', ['update-schedule', 'notifications-and-status', 'verification']],
  ['update-schedule', 'Update schedule', '更新排程', 'updates', 'Update-Schedule', 'shipped', ['app-store-self-updater', 'catalog-discovery', 'notifications-and-status']],
  ['tab-navigation', 'Tab workspace', '分頁工作區', 'experience', 'Tab-Navigation', 'shipped', ['search-and-regex-builder', 'command-palette', 'appearance-editor']],
  ['search-and-regex-builder', 'Search and regex builder', '搜尋同 Regex 建造器', 'experience', 'Search-and-Regex-Builder', 'shipped', ['tab-navigation', 'command-palette', 'offline-documentation-browser']],
  ['command-palette', 'Command palette', '指令板', 'experience', 'Command-Palette', 'shipped', ['search-and-regex-builder', 'settings-language-and-display-name', 'appearance-editor']],
  ['settings-language-and-display-name', 'Settings, language, and display name', '設定、語言同顯示名稱', 'experience', 'Settings-Language-and-Display-Name', 'shipped', ['command-palette', 'appearance-editor', 'update-schedule']],
  ['appearance-editor', 'Appearance editor', '外觀編輯器', 'experience', 'Appearance-Editor', 'limited', ['settings-language-and-display-name', 'tab-navigation', 'privacy-and-security']],
  ['notifications-and-status', 'Notifications and operation status', '通知同操作狀態', 'experience', 'Notifications-and-Status', 'limited', ['activity-history', 'app-store-self-updater', 'update-schedule']],
  ['offline-documentation-browser', 'Offline documentation browser', '離線文件瀏覽器', 'documentation', 'Offline-Documentation-Browser', 'shipped', ['search-and-regex-builder', 'command-palette', 'verification']],
  ['privacy-and-security', 'Privacy and security', '私隱同安全', 'security', 'Privacy-and-Security', 'shipped', ['verified-installer-operations', 'source-build-security', 'verification']],
  ['verification', 'Verification and evidence', '驗證同證據', 'verification', 'Verification', 'shipped', ['catalog-discovery', 'offline-documentation-browser', 'app-store-self-updater']],
].map(([id, title, titleYue, category, wiki, status, related]) => ({ id, title, titleYue, category, wiki, status, related }));

const requiredSections = ['Behaviour', 'Configuration', 'Failure modes', 'Security considerations', 'Verification', 'Suggested articles'];

function parseArticle(raw, expected) {
  raw = normalizeNewlines(raw);
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${expected.id}: missing front matter`);
  const meta = Object.fromEntries(match[1].split(/\r?\n/).filter(Boolean).map((line) => {
    const index = line.indexOf(':');
    if (index < 1) throw new Error(`${expected.id}: malformed front matter line ${line}`);
    return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
  }));
  for (const key of ['id', 'title', 'titleYue', 'category', 'status']) {
    if (meta[key] !== String(expected[key])) throw new Error(`${expected.id}: ${key} must be ${expected[key]}`);
  }
  const body = match[2].trim() + '\n';
  const headings = [...body.matchAll(/^## (.+)$/gm)].map((item) => item[1].trim());
  for (const section of requiredSections) if (!headings.includes(section)) throw new Error(`${expected.id}: missing ## ${section}`);
  if (headings.join('|') !== requiredSections.join('|')) throw new Error(`${expected.id}: required sections must appear once and in order`);
  if (/\b(will|planned)\b/i.test(body) && expected.status === 'shipped' && !/not (?:yet )?implemented|pending|future|does not/i.test(body)) {
    throw new Error(`${expected.id}: shipped article contains an unqualified future claim`);
  }
  const suggested = body.split(/^## Suggested articles$/m)[1] ?? '';
  for (const related of expected.related) if (!suggested.includes(related)) throw new Error(`${expected.id}: suggested articles must link ${related}`);
  return { ...expected, summary: meta.summary, body, raw };
}

function categoryReadme(category, rows) {
  return `# ${category.title}\n\n${category.summary}\n\n## Articles\n\n${rows.map((row) => `- [${row.title}](./${row.id}.md) — ${row.summary}`).join('\n')}\n`;
}

function docsIndex(rows) {
  return `# Feature documentation\n\nThis hand-written category inventory is the canonical map for the public site, wiki mirror, and offline in-app bundle. Status labels mean **shipped**, **limited** (implemented with explicit boundaries), or **pending** (not implemented and never presented as available).\n\n${categories.map((category) => { const items = rows.filter((row) => row.category === category.id); return `## ${category.title}\n\n${category.summary}\n\n${items.map((row) => `- [${row.title}](./${category.id}/${row.id}.md) — **${row.status}** — ${row.summary}`).join('\n')}`; }).join('\n\n')}\n`;
}

function rootReadme(rows) {
  return `# Ding Ding App Store documentation\n\nThese articles describe the current application at the exact boundary implemented in source. **Limited** and **pending** labels are intentional: a catalog record is not proof that its installer works, a check is not a download, and a static test is not runtime evidence.\n\n- [Complete categorized feature index](features/README.md)\n- [Static documentation site](../site/README.md)\n- [Verification and evidence](features/verification/verification.md)\n\n## Feature inventory\n\n${categories.map((category) => `- **${category.title}:** ${rows.filter((row) => row.category === category.id).map((row) => `${row.title} (${row.status})`).join(', ')}`).join('\n')}\n\n## Documentation contract\n\nEvery feature article covers behaviour, configuration, failure modes, security considerations, verification, and suggested articles. The generator validates that the canonical articles, category indexes, wiki pages, static-site bundle, and offline in-app bundle remain synchronized. Run \`npm run docs:generate\` after editing an article and \`npm run docs:check\` before committing.\n`;
}

function rewriteWikiLinks(body, rows) {
  const byId = new Map(rows.map((row) => [row.id, row.wiki]));
  return body.replace(/\((?:\.\.\/)?(?:[a-z-]+\/)?([a-z0-9-]+)\.md\)/g, (_all, id) => `(${byId.get(id) ?? id})`);
}

function wikiHome(rows) {
  return `# Ding Ding App Store documentation\n\nThe wiki mirrors the same canonical feature articles bundled into the application and static site. Status labels distinguish shipped behaviour from limited and pending work.\n\n${categories.map((category) => `## ${category.title}\n\n${rows.filter((row) => row.category === category.id).map((row) => `- [${row.title}](${row.wiki}) — **${row.status}** — ${row.summary}`).join('\n')}`).join('\n\n')}\n`;
}

function generatedTypeScript(rows) {
  const payload = rows.map(({ raw: _raw, ...row }) => row);
  return `// Generated by scripts/docs-generate.mjs. Edit docs/features instead.\nexport interface GeneratedDocArticle { id: string; title: string; titleYue: string; category: string; wiki: string; status: 'shipped' | 'limited' | 'pending'; related: string[]; summary: string; body: string }\nexport const GENERATED_DOCS: readonly GeneratedDocArticle[] = ${JSON.stringify(payload, null, 2)} as const;\n`;
}

function generatedSite(rows) {
  const payload = rows.map(({ raw: _raw, ...row }) => row);
  return `// Generated by scripts/docs-generate.mjs. Edit docs/features instead.\nwindow.DING_DING_DOCS = ${JSON.stringify({ categories, articles: payload })};\n`;
}

async function expectedOutputs(rows) {
  const outputs = new Map();
  outputs.set('docs/README.md', rootReadme(rows));
  outputs.set('docs/features/README.md', docsIndex(rows));
  for (const category of categories) outputs.set(`docs/features/${category.id}/README.md`, categoryReadme(category, rows.filter((row) => row.category === category.id)));
  outputs.set('src/renderer/generated-docs.ts', generatedTypeScript(rows));
  outputs.set('site/assets/articles.js', generatedSite(rows));
  outputs.set('wiki/Home.md', wikiHome(rows));
  for (const row of rows) {
    outputs.set(`site/articles/${row.category}/${row.id}.md`, row.raw);
    outputs.set(`wiki/${row.wiki}.md`, `# ${row.title}\n\n> **Status: ${row.status}.** This wiki page is generated from the canonical categorized article.\n\n${rewriteWikiLinks(row.body.replace(/^# .+\r?\n+/, ''), rows)}`);
  }
  return outputs;
}

async function listMarkdown(relative) {
  const base = path.join(root, relative);
  const output = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.name.endsWith('.md')) output.push(path.relative(root, full).replaceAll('\\', '/'));
    }
  }
  await walk(base);
  return output.sort();
}

const rows = [];
for (const expected of articles) {
  const relative = `docs/features/${expected.category}/${expected.id}.md`;
  rows.push(parseArticle(await readFile(path.join(root, relative), 'utf8'), expected));
}
const outputs = await expectedOutputs(rows);

const expectedCanonical = new Set(['docs/features/README.md', ...categories.map((row) => `docs/features/${row.id}/README.md`), ...articles.map((row) => `docs/features/${row.category}/${row.id}.md`)]);
for (const actual of await listMarkdown('docs/features')) if (!expectedCanonical.has(actual)) throw new Error(`Uninventoried canonical article or index: ${actual}`);

const expectedWiki = new Set(['wiki/Home.md', ...articles.map((row) => `wiki/${row.wiki}.md`)]);
for (const actual of await listMarkdown('wiki')) if (!expectedWiki.has(actual)) throw new Error(`Stale or uninventoried wiki page: ${actual}`);

const failures = [];
for (const [relative, content] of outputs) {
  const target = path.join(root, relative);
  if (check) {
    const actual = await readFile(target, 'utf8').catch(() => null);
    if (normalizeNewlines(actual) !== normalizeNewlines(content)) failures.push(relative);
  } else {
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, 'utf8');
  }
}

const docsPage = await readFile(path.join(root, 'src/renderer/pages/DocsPage.tsx'), 'utf8');
if (!docsPage.includes("from '../generated-docs'")) failures.push('src/renderer/pages/DocsPage.tsx does not consume generated offline docs');
if (!docsPage.includes('<SearchBox surface="docs"')) failures.push('offline docs search lacks the shared adjacent regex builder');
if (!docsPage.includes('role="tablist"') || !docsPage.includes('role="tab"') || !docsPage.includes('role="tabpanel"')) failures.push('offline docs browser lacks browser-style article tabs');

const siteIndex = await readFile(path.join(root, 'site/index.html'), 'utf8');
if (!siteIndex.includes('assets/articles.js')) failures.push('site/index.html does not load the generated article bundle');
for (const id of ['docs-search', 'docs-regex-toggle', 'settings-search', 'settings-regex-toggle', 'settings-tabs']) if (!siteIndex.includes(`id="${id}"`)) failures.push(`site/index.html missing ${id}`);

if (failures.length) {
  console.error(`Documentation completeness check failed (${failures.length}):\n${failures.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(check ? `Documentation complete: ${categories.length} categories, ${rows.length} articles, offline/site/wiki bundles synchronized.` : `Generated ${outputs.size} documentation outputs from ${rows.length} canonical articles.`);
