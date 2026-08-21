import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { validateArticleLinks } from './docs-link-graph.mjs';
import { catalogAdapterDocumentation, catalogArticleId } from './catalog-doc-metadata.mjs';

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
  { id: 'product', title: 'Product design', summary: 'Deterministic public design references and the boundaries of comparison evidence.' },
  { id: 'documentation', title: 'Documentation', summary: 'The complete offline in-app browser and its generated public mirrors.' },
  { id: 'memory-sync', title: 'Memory synchronization', summary: 'Shared instruction provenance, offline bundles, and safe synchronization boundaries.' },
  { id: 'security', title: 'Security and privacy', summary: 'Renderer isolation, privileged validation, local data, and evidence boundaries.' },
  { id: 'verification', title: 'Verification', summary: 'What static checks, tests, runtime captures, workflows, and releases prove.' },
];

const articles = [
  ['catalog-discovery', 'Catalog discovery', '目錄探索', 'discovery', 'Catalog-Discovery', 'shipped', ['verified-installer-operations', 'per-app-update-checker', 'privacy-and-security']],
  ['verified-installer-operations', 'Verified installer operations', '已驗證安裝操作', 'installation', 'Verified-Installer-Operations', 'limited', ['catalog-discovery', 'source-build-security', 'uninstall']],
  ['one-click-installation', 'One-click installation and adapter coverage', '一按安裝同配接器覆蓋', 'installation', 'One-Click-Installation', 'limited', ['verified-installer-operations', 'source-build-security', 'uninstall']],
  ['source-build-security', 'Source-build security', '原始碼建置安全', 'installation', 'Source-Build-Security', 'limited', ['verified-installer-operations', 'automatic-repair-and-universal-adapters', 'privacy-and-security']],
  ['source-build-recipes', 'Reviewed source-build recipes', '已審閱原始碼建置食譜', 'installation', 'Source-Build-Recipes', 'limited', ['source-build-security', 'automatic-repair-and-universal-adapters', 'one-click-installation']],
  ['uninstall', 'Protected uninstall', '安全解除安裝', 'installation', 'Uninstall', 'shipped', ['installed-app-discovery', 'verified-installer-operations', 'activity-history']],
  ['automatic-repair-and-universal-adapters', 'Automatic repair and universal adapters', '自動修復同通用安裝配接器', 'installation', 'Automatic-Repair-and-Universal-Adapters', 'limited', ['verified-installer-operations', 'source-build-security', 'verification']],
  ['installed-app-discovery', 'Installed app discovery', '已安裝 App 偵測', 'installed', 'Installed-App-Discovery', 'shipped', ['launch-installed-applications', 'uninstall', 'activity-history', 'privacy-and-security']],
  ['launch-installed-applications', 'Launch installed applications', '啟動已安裝應用程式', 'installed', 'Launch-Installed-Applications', 'limited', ['installed-app-discovery', 'per-app-update-checker', 'verified-installer-operations', 'verification']],
  ['activity-history', 'Activity history and export', '操作記錄同匯出', 'installed', 'Activity-History', 'shipped', ['installed-app-discovery', 'verified-installer-operations', 'privacy-and-security']],
  ['history-versioning', 'Local history and version restore', '本機歷史同版本還原', 'installed', 'History-Versioning', 'limited', ['activity-history', 'installed-app-discovery', 'privacy-and-security']],
  ['per-app-update-checker', 'Per-app update checker', '每個 App 更新檢查', 'updates', 'Per-App-Update-Checker', 'limited', ['catalog-discovery', 'launch-installed-applications', 'app-store-self-updater', 'update-schedule']],
  ['app-store-self-updater', 'App Store self-updater', 'App Store 自己更新', 'updates', 'App-Store-Self-Updater', 'limited', ['update-schedule', 'notifications-and-status', 'verification']],
  ['update-schedule', 'Update schedule', '更新排程', 'updates', 'Update-Schedule', 'shipped', ['app-store-self-updater', 'catalog-discovery', 'notifications-and-status', 'dim-sum-surprise']],
  ['tab-navigation', 'Tab workspace', '分頁工作區', 'experience', 'Tab-Navigation', 'shipped', ['search-and-regex-builder', 'command-palette', 'appearance-editor']],
  ['tab-and-group-locks-and-support-tickets', 'Tab and group UX locks with local Support Tickets', '分頁同分組 UX 鎖連本機支援票', 'experience', 'Tab-And-Group-Locks-And-Support-Tickets', 'limited', ['tab-navigation', 'notifications-and-status', 'privacy-and-security', 'history-versioning']],
  ['search-and-regex-builder', 'Search and regex builder', '搜尋同 Regex 建造器', 'experience', 'Search-and-Regex-Builder', 'shipped', ['tab-navigation', 'command-palette', 'offline-documentation-browser']],
  ['command-palette', 'Command palette', '指令板', 'experience', 'Command-Palette', 'shipped', ['search-and-regex-builder', 'settings-language-and-display-name', 'appearance-editor']],
  ['settings-language-and-display-name', 'Settings, language, and display name', '設定、語言同顯示名稱', 'experience', 'Settings-Language-and-Display-Name', 'shipped', ['command-palette', 'appearance-editor', 'update-schedule']],
  ['personal-vocabulary-site', 'Local personal vocabulary on the documentation site', '文件網站本機個人詞彙', 'experience', 'Personal-Vocabulary-Site', 'shipped', ['settings-language-and-display-name', 'school-mode', 'search-and-regex-builder', 'privacy-and-security']],
  ['school-mode', 'Universal School mode', '通用 School mode', 'experience', 'School-Mode', 'shipped', ['settings-language-and-display-name', 'command-palette', 'privacy-and-security']],
  ['optional-spoken-narrator', 'Optional spoken narrator', '可選語音旁白', 'experience', 'Optional-Spoken-Narrator', 'shipped', ['settings-language-and-display-name', 'notifications-and-status', 'update-schedule']],
  ['external-editor-exports', 'External editor exports', '外置編輯器匯出', 'experience', 'External-Editor-Exports', 'shipped', ['settings-language-and-display-name', 'activity-history', 'offline-documentation-browser', 'privacy-and-security']],
  ['appearance-editor', 'Appearance editor', '外觀編輯器', 'experience', 'Appearance-Editor', 'limited', ['settings-language-and-display-name', 'tab-navigation', 'privacy-and-security']],
  ['notifications-and-status', 'Notifications and operation status', '通知同操作狀態', 'experience', 'Notifications-and-Status', 'limited', ['activity-history', 'app-store-self-updater', 'update-schedule']],
  ['dim-sum-surprise', 'Dim-sum startup surprise', '開機點心驚喜', 'experience', 'Dim-Sum-Surprise', 'shipped', ['update-schedule', 'notifications-and-status', 'privacy-and-security']],
  ['changelog-viewer', 'Changelog viewer', '更新記錄瀏覽器', 'experience', 'Changelog-Viewer', 'shipped', ['command-palette', 'external-editor-exports', 'verification']],
  ['catalog-language', 'Catalog language coverage', '目錄語言覆蓋', 'experience', 'Catalog-Language', 'shipped', ['catalog-discovery', 'settings-language-and-display-name', 'verified-installer-operations', 'search-and-regex-builder']],
  ['expressive-storefront', 'Expressive storefront shell', 'Expressive storefront 外殼', 'experience', 'Expressive-Storefront', 'shipped', ['tab-navigation', 'appearance-editor', 'catalog-language', 'privacy-and-security']],
  ['design-reference', 'Public design reference', '公開設計參考', 'product', 'Public-Design-Reference', 'limited', ['command-palette', 'tab-navigation', 'privacy-and-security']],
  ['offline-documentation-browser', 'Offline documentation browser', '離線文件瀏覽器', 'documentation', 'Offline-Documentation-Browser', 'shipped', ['search-and-regex-builder', 'command-palette', 'verification']],
  ['status-hub', 'Shared Status Hub', '共用 Status Hub', 'memory-sync', 'Status-Hub', 'limited', ['convenience-skills', 'offline-documentation-browser', 'privacy-and-security', 'verification']],
  ['convenience-skills', 'Shared convenience skills', '共用便利技能', 'memory-sync', 'Convenience-Skills', 'limited', ['status-hub', 'privacy-and-security', 'source-build-security', 'verification']],
  ['authenticator', 'Local authenticator registration and entries', '本機驗證器登記同項目', 'memory-sync', 'Authenticator', 'limited', ['secret-and-display-name-history', 'tab-navigation', 'search-and-regex-builder', 'school-mode', 'privacy-and-security', 'verification']],
  ['secret-and-display-name-history', 'Secret and display-name mutation history', '秘密同顯示名稱變更歷史', 'memory-sync', 'Secret-And-Display-Name-History', 'limited', ['history-versioning', 'settings-language-and-display-name', 'privacy-and-security', 'verification']],
  ['privacy-and-security', 'Privacy and security', '私隱同安全', 'security', 'Privacy-and-Security', 'shipped', ['verified-installer-operations', 'source-build-security', 'verification']],
  ['verification', 'Verification and evidence', '驗證同證據', 'verification', 'Verification', 'shipped', ['catalog-discovery', 'offline-documentation-browser', 'app-store-self-updater']],
  ['lifecycle-proof', 'Thirteen-product lifecycle proof', '十三產品生命週期驗證', 'verification', 'Lifecycle-Proof', 'limited', ['verification', 'source-build-security', 'verified-installer-operations', 'uninstall']],
].map(([id, title, titleYue, category, wiki, status, related]) => ({ id, title, titleYue, category, wiki, status, related }));

function articlePath(row) {
  return row.source === 'catalog-metadata'
    ? `docs/catalog-apps/${row.id}.md`
    : `docs/features/${row.category}/${row.id}.md`;
}

function relativeArticleHref(from, row) {
  const relative = path.posix.relative(path.posix.dirname(from), articlePath(row));
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function catalogMetadataArticle(record) {
  const adapter = catalogAdapterDocumentation(record);
  const articleId = catalogArticleId(record.id);
  const availability = record.availability === 'installable' ? 'Installable through a reviewed adapter' : 'Unavailable through this catalog';
  const adapterStatus = adapter.status === 'reviewed'
    ? `Reviewed ${adapter.family} adapter. The adapter has a fixed, application-specific release contract; this article deliberately does not reproduce executable names, arguments, download URLs, or filesystem locations.${record.proofStatus === 'blocked-until-proof' ? ` Lifecycle status is **blocked until clean-Windows proof**${record.proofTargetId ? ` (target ${record.proofTargetId})` : ''}; the catalog does not claim installation, launch, ownership, or uninstall evidence yet.` : record.proofStatus === 'verified' ? ' Lifecycle status is **verified** for the reviewed catalog route; installation and update actions remain subject to their live byte, ownership, and process checks.' : ' Lifecycle proof is not required for this unavailable catalog route.'}`
    : `Blocked. ${adapter.blocker}`;
  const body = `# ${record.displayName} catalog record

> **Generated catalog metadata.** This article is assembled from the reviewed local catalog and adapter inventory. It is not provider-authored documentation and does not scrape repository text, copy external assets, or expose installer commands.

## Behaviour

This record describes the reviewed catalog entry \`${record.id}\`. Its public source repository is [${record.repository}](https://github.com/Ding-Ding-Projects/${record.repository}). The current availability is **${availability}** and the declared package type is **${record.packageType}**. The closed adapter identifier is \`${record.adapterId}\`.

The current adapter state is: ${adapterStatus}

${record.iconProvenance ? `The icon is first-party reviewed from repository asset \`${record.iconProvenance.path}\`; if that asset is unavailable, the UI uses the declared ${record.iconProvenance.fallback} fallback rather than a remote or guessed image.` : 'No icon provenance metadata is declared for this legacy record; the renderer keeps its neutral catalog fallback.'}

## Configuration

The catalog record is source-controlled. The renderer may request this application by its typed identifier and a user decision, but it cannot alter the repository, source manifest, package type, adapter, download, command, argument, or local destination. The source manifest marker is \`${record.sourceManifest ?? 'not declared'}\`; it is metadata only and is not a source-build recipe.

## Failure modes

Catalog metadata does not prove that a public repository, release, asset, installer, update, or source build is currently usable. A missing release, ambiguous asset, digest failure, network failure, unsupported adapter, or unavailable source-build boundary fails closed and reports its typed outcome. ${adapter.status === 'blocked' ? 'This record remains unavailable until a reviewed public route exists; the application does not guess a target or fallback command.' : 'A reviewed adapter can still reject a release that does not meet its immutable validation contract.'}

## Security considerations

This generated record contains only reviewed identifiers and public repository links. It intentionally excludes provider README content, release-body text, external images, download URLs, executable paths, command lines, installer arguments, credentials, and private infrastructure. Privileged install, update, uninstall, and source-build decisions remain in the main-process adapters.

## Verification

The documentation generator checks this article against the hand-written catalog and adapter metadata inventories, then includes it in the offline TypeScript bundle, static-site article bundle, wiki mirror, documentation search, and command palette. That proves generated metadata coverage only. It does not claim a clean-Windows installation, update, source build, application launch, or published release verification for this application.

## Suggested articles

- [Catalog discovery](../features/discovery/catalog-discovery.md)
- [Verified installer operations](../features/installation/verified-installer-operations.md)
- [Per-app update checker](../features/updates/per-app-update-checker.md)
- [Source-build security](../features/installation/source-build-security.md)
- [Privacy and security](../features/security/privacy-and-security.md)
- [Verification and evidence](../features/verification/verification.md)
`;
  return {
    id: articleId,
    title: `${record.displayName} catalog record`,
    titleYue: `${record.displayName} · 目錄資料`,
    category: 'discovery',
    wiki: `Catalog-App-${record.id}`,
    status: 'limited',
    related: ['catalog-discovery', 'verified-installer-operations', 'per-app-update-checker', 'source-build-security', 'privacy-and-security', 'verification'],
    summary: `Generated reviewed metadata for ${record.displayName}: ${record.availability}, ${record.packageType}, and adapter ${record.adapterId}.`,
    body,
    source: 'catalog-metadata',
    catalogAppId: record.id,
  };
}

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
  const destination = `docs/features/${category.id}/README.md`;
  return `# ${category.title}\n\n${category.summary}\n\n## Articles\n\n${rows.map((row) => `- [${row.title}](${relativeArticleHref(destination, row)}) — ${row.summary}${row.source === 'catalog-metadata' ? ' *(generated catalog metadata)*' : ''}`).join('\n')}\n`;
}

function docsIndex(rows) {
  const destination = 'docs/features/README.md';
  return `# Feature documentation\n\nThis hand-written category inventory is the canonical map for feature articles. It also indexes generated catalog metadata that is built only from reviewed local catalog and adapter records. Status labels mean **shipped**, **limited** (implemented with explicit boundaries), or **pending** (not implemented and never presented as available).\n\n${categories.map((category) => { const items = rows.filter((row) => row.category === category.id); return `## ${category.title}\n\n${category.summary}\n\n${items.map((row) => `- [${row.title}](${relativeArticleHref(destination, row)}) — **${row.status}**${row.source === 'catalog-metadata' ? ' — *(generated catalog metadata)*' : ''} — ${row.summary}`).join('\n')}`; }).join('\n\n')}\n`;
}

function rootReadme(rows) {
  return `# Ding Ding App Store documentation\n\nThese articles describe the current application at the exact boundary implemented in source. **Limited** and **pending** labels are intentional: a catalog record is not proof that its installer works, a check is not a download, and a static test is not runtime evidence.\n\n- [Complete categorized feature index](features/README.md)\n- [Static documentation site](../site/README.md)\n- [Verification and evidence](features/verification/verification.md)\n\n## Feature inventory\n\n${categories.map((category) => `- **${category.title}:** ${rows.filter((row) => row.category === category.id).map((row) => `${row.title} (${row.status})`).join(', ')}`).join('\n')}\n\n## Documentation contract\n\nEvery feature article covers behaviour, configuration, failure modes, security considerations, verification, and suggested articles. The generator validates that the canonical articles, category indexes, wiki pages, static-site bundle, and offline in-app bundle remain synchronized. Run \`npm run docs:generate\` after editing an article and \`npm run docs:check\` before committing.\n`;
}

function rewriteWikiLinks(body, rows) {
  const byId = new Map(rows.map((row) => [row.id, row.wiki]));
  return body.replace(/\(([^)]+)\)/g, (all, href) => {
    if (/^(?:[a-z]+:|#|\/)/i.test(href)) return all;
    const id = path.posix.basename(href).replace(/\.md$/i, '');
    return byId.has(id) ? `(${byId.get(id)})` : all;
  });
}

function catalogMetadataIndex(rows) {
  return `# Generated catalog application metadata\n\nThese records are generated from the reviewed local catalog allowlist and adapter documentation inventory. They are **metadata only**: they are not provider README imports, installer instructions, release proof, or source-build recipes.\n\n## Application records\n\n${rows.map((row) => `- [${row.title}](./${row.id}.md) — ${row.summary}`).join('\n')}\n\n## Boundaries\n\nEach record links to the canonical catalog, installation, update, source-build, security, and verification articles. Those canonical articles remain authoritative for application behaviour; a generated record only reports the current catalog fields and reviewed adapter/blocker state.\n`;
}

function wikiHome(rows) {
  return `# Ding Ding App Store documentation\n\nThe wiki mirrors the same canonical feature articles bundled into the application and static site. Status labels distinguish shipped behaviour from limited and pending work.\n\n${categories.map((category) => `## ${category.title}\n\n${rows.filter((row) => row.category === category.id).map((row) => `- [${row.title}](${row.wiki}) — **${row.status}** — ${row.summary}`).join('\n')}`).join('\n\n')}\n`;
}

function generatedTypeScript(rows) {
  const payload = rows.map(({ raw: _raw, sourcePath: _sourcePath, ...row }) => row);
  return `// Generated by scripts/docs-generate.mjs. Edit docs/features for canonical articles; catalog metadata is derived from reviewed local records.\nexport interface GeneratedDocArticle { id: string; title: string; titleYue: string; category: string; wiki: string; status: 'shipped' | 'limited' | 'pending'; related: string[]; summary: string; body: string; source?: 'canonical' | 'catalog-metadata'; catalogAppId?: string }\nexport const GENERATED_DOCS: readonly GeneratedDocArticle[] = ${JSON.stringify(payload, null, 2)} as const;\n`;
}

function generatedSite(rows) {
  const payload = rows.map(({ raw: _raw, sourcePath: _sourcePath, ...row }) => row);
  return `// Generated by scripts/docs-generate.mjs. Edit docs/features instead.\nwindow.DING_DING_DOCS = ${JSON.stringify({ categories, articles: payload })};\n`;
}

async function expectedOutputs(rows) {
  const outputs = new Map();
  const catalogMetadataRows = rows.filter((row) => row.source === 'catalog-metadata');
  outputs.set('docs/README.md', rootReadme(rows));
  outputs.set('docs/features/README.md', docsIndex(rows));
  outputs.set('docs/catalog-apps/README.md', catalogMetadataIndex(catalogMetadataRows));
  for (const category of categories) outputs.set(`docs/features/${category.id}/README.md`, categoryReadme(category, rows.filter((row) => row.category === category.id)));
  outputs.set('src/renderer/generated-docs.ts', generatedTypeScript(rows));
  outputs.set('site/assets/articles.js', generatedSite(rows));
  outputs.set('wiki/Home.md', wikiHome(rows));
  for (const row of rows) {
    if (row.source === 'catalog-metadata') outputs.set(articlePath(row), row.body);
    outputs.set(`site/articles/${row.category}/${row.id}.md`, row.raw ?? row.body);
    const origin = row.source === 'catalog-metadata' ? 'reviewed local catalog metadata' : 'the canonical categorized article';
    outputs.set(`wiki/${row.wiki}.md`, `# ${row.title}\n\n> **Status: ${row.status}.** This wiki page is generated from ${origin}.\n\n${rewriteWikiLinks(row.body.replace(/^# .+\r?\n+/, ''), rows)}`);
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
  rows.push({ ...parseArticle(await readFile(path.join(root, relative), 'utf8'), expected), source: 'canonical', sourcePath: relative });
}
const catalog = JSON.parse(await readFile(path.join(root, 'data/catalog.v1.json'), 'utf8'));
if (!Array.isArray(catalog.apps)) throw new Error('data/catalog.v1.json: apps must be an array');
for (const record of catalog.apps) {
  if (!record || typeof record !== 'object' || typeof record.id !== 'string') throw new Error('data/catalog.v1.json: every app must have an ID');
  const row = catalogMetadataArticle(record);
  rows.push({ ...row, raw: row.body, sourcePath: articlePath(row) });
}
const linkFailures = validateArticleLinks(rows);
if (linkFailures.length) throw new Error(`Documentation link graph failed:\n${linkFailures.map((item) => `- ${item}`).join('\n')}`);
const outputs = await expectedOutputs(rows);

const expectedCanonical = new Set(['docs/features/README.md', ...categories.map((row) => `docs/features/${row.id}/README.md`), ...articles.map((row) => `docs/features/${row.category}/${row.id}.md`)]);
for (const actual of await listMarkdown('docs/features')) if (!expectedCanonical.has(actual)) throw new Error(`Uninventoried canonical article or index: ${actual}`);

const catalogMetadataRows = rows.filter((row) => row.source === 'catalog-metadata');
const expectedCatalogMetadata = new Set(['docs/catalog-apps/README.md', ...catalogMetadataRows.map(articlePath)]);
if (check) for (const actual of await listMarkdown('docs/catalog-apps')) if (!expectedCatalogMetadata.has(actual)) throw new Error(`Stale or uninventoried generated catalog article: ${actual}`);

const expectedWiki = new Set(['wiki/Home.md', ...rows.map((row) => `wiki/${row.wiki}.md`)]);
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
for (const id of ['docs-search', 'docs-regex-toggle', 'settings-search', 'settings-regex-toggle', 'settings-tabs', 'changelog-search', 'changelog-regex-toggle', 'changelog-card']) if (!siteIndex.includes(`id="${id}"`)) failures.push(`site/index.html missing ${id}`);
for (const id of ['browser-tabs', 'new-doc-tab']) if (!siteIndex.includes(`id="${id}"`)) failures.push(`site/index.html missing persisted site tab control ${id}`);
if (!siteIndex.includes('<script type="module" src="assets/app.js"></script>')) failures.push('site/index.html must load the module-based site navigation runtime');
const siteApp = await readFile(path.join(root, 'site/assets/app.js'), 'utf8');
for (const marker of ['parseTabState', 'localStorage', 'hashchange', 'data-route-tab', 'data-close-tab', 'setupBuilder', 'buildRegexPanel', 'SITE_CHANGELOG_ENTRIES', 'renderChangelog', 'changelog-start']) if (!siteApp.includes(marker)) failures.push(`site/assets/app.js missing site parity marker ${marker}`);
const siteChangelog = await readFile(path.join(root, 'site/assets/changelog.mjs'), 'utf8');
for (const marker of ['validateChangelogManifest', 'SITE_CHANGELOG_MANIFEST', 'changelogMarkdown']) if (!siteChangelog.includes(marker)) failures.push(`site/assets/changelog.mjs missing ${marker}`);
const siteTabState = await readFile(path.join(root, 'site/assets/tab-state.mjs'), 'utf8');
for (const marker of ['normalizeTabState', 'closeTab', 'moveTab', 'togglePinned', 'routeHash']) if (!siteTabState.includes(`function ${marker}`) && !siteTabState.includes(`export function ${marker}`)) failures.push(`site/assets/tab-state.mjs missing ${marker}`);

if (failures.length) {
  console.error(`Documentation completeness check failed (${failures.length}):\n${failures.map((item) => `- ${item}`).join('\n')}`);
  process.exit(1);
}
console.log(check ? `Documentation complete: ${categories.length} categories, ${articles.length} canonical articles, ${catalogMetadataRows.length} generated catalog records, offline/site/wiki bundles synchronized.` : `Generated ${outputs.size} documentation outputs from ${articles.length} canonical articles and ${catalogMetadataRows.length} generated catalog records.`);
