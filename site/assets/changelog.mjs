// Safe local fallback for the static documentation site.
// Release automation may replace this module from the canonical generated manifest
// before publishing; the site never fetches release data at runtime.
export const CHANGELOG_SCHEMA_VERSION = 1;
export const CHANGELOG_REPOSITORY = 'Ding-Ding-Projects/ding-ding-app-store';
const SHA = /^[0-9a-f]{40}$/;
const VERSION = /^v\d+\.\d+\.\d+(?:-\d+)+$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_ENTRIES = 2000;
const MAX_CHANGE_LENGTH = 240;

const fallbackEntries = [
  ['v0.1.0-14', '2026-08-08T01:15:09.000Z', '5265d74a7f428f014be7fa08a5847c676efdad82', ['Integration: Merge pull request #4 from Ding-Ding-Projects/claude/ultracode-opus-agents-s59hks']],
  ['v0.1.0-13', '2026-08-07T18:09:39.000Z', 'b4a94f3e64ee30d9b72d0c440267d765ebd8b6ee', ['Documentation: Fix site/assets/app.css content corrupted by a prior double-base64-encoded API push']],
  ['v0.1.0-9', '2026-08-07T18:06:26.000Z', '60d4aaabf2474bad0b38d860be980fb43b2681db', ['Documentation: Fix HANDOFF.md content corrupted by a prior double-base64-encoded API push']],
  ['v0.1.0-8', '2026-08-07T17:41:11.000Z', '4b140cdc6397b716ad76f1c7219061855e8dd96f', ['Documentation: Style select/range on the docs site to match MD3 too']],
  ['v0.1.0-7', '2026-08-07T17:37:18.000Z', 'e1ebe28f95799a4db1aa4ac17e30feb03d1ef747', ['Interface: Replace native OS controls with MD3-styled select/range/checkbox']],
  ['v0.1.0-6', '2026-08-07T17:23:01.000Z', '183ce737b6661d92cc4caae42a123c0e8cebb396', ['Documentation: Fix mobile clipping: hide palette kbd hints and wrap settings labels under narrow widths']],
  ['v0.1.0-4', '2026-08-07T17:19:37.000Z', '492c9ef79115348847d3490836426fed048921b9', ['Documentation: Fix mobile clipping on the Pages site; confirm Pages is live']],
  ['v0.1.0-3', '2026-08-07T16:45:12.000Z', '459f3b9f850c42dd9aca932aef06be5af1aa917a', ['Documentation: Record real CI/release/Pages evidence']],
  ['v0.1.0-2', '2026-08-07T16:41:28.000Z', '468566de96d8fdee150cfaf24b860724ff6526a9', ['Delivery: Fix Pages deploy: enable Pages via configure-pages action']],
  ['v0.1.0-1', '2026-08-07T16:35:52.000Z', '4ad8430385cf4950b3c386fb35f97f45649fffaa', ['Interface: Real local operation history, CI, unsigned Squirrel release, and GitHub Pages (#3)']],
].map(([version, releasedAt, commit, changes]) => ({ version, releasedAt, commit, changes, releaseUrl: `https://github.com/${CHANGELOG_REPOSITORY}/releases/tag/${version}` }));

let generatedManifest = null;
try {
  const module = await import('./generated-changelog.mjs');
  generatedManifest = module.GENERATED_SITE_RELEASE_MANIFEST;
} catch (error) {
  if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error;
}

export function validateChangelogManifest(manifest) {
  const plain = (value) => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
  const exact = (value, keys) => { if (!plain(value) || Object.keys(value).some((key) => !keys.includes(key))) throw new Error('The local changelog manifest contains an unexpected field.'); };
  exact(manifest, ['schemaVersion', 'repository', 'generatedAt', 'entries']);
  if (!manifest || typeof manifest !== 'object' || manifest.schemaVersion !== CHANGELOG_SCHEMA_VERSION || manifest.repository !== CHANGELOG_REPOSITORY || !ISO.test(manifest.generatedAt) || Number.isNaN(Date.parse(manifest.generatedAt)) || new Date(manifest.generatedAt).toISOString() !== manifest.generatedAt || !Array.isArray(manifest.entries) || !manifest.entries.length || manifest.entries.length > MAX_ENTRIES) {
    throw new Error('The local changelog manifest schema is invalid.');
  }
  const versions = new Set(); let previous = null;
  for (const entry of manifest.entries) {
    exact(entry, ['version', 'releasedAt', 'commit', 'changes', 'releaseUrl']);
    if (!VERSION.test(entry.version) || versions.has(entry.version) || !ISO.test(entry.releasedAt) || Number.isNaN(Date.parse(entry.releasedAt)) || new Date(entry.releasedAt).toISOString() !== entry.releasedAt || !SHA.test(entry.commit) || entry.releaseUrl !== `https://github.com/${CHANGELOG_REPOSITORY}/releases/tag/${entry.version}` || !Array.isArray(entry.changes) || !entry.changes.length || entry.changes.length > 20 || entry.changes.some((change) => typeof change !== 'string' || !change.trim() || change.length > MAX_CHANGE_LENGTH || /[\u0000-\u000A\u000B\u000C\u000E-\u001F\u007F]/.test(change))) throw new Error(`The local changelog entry ${entry?.version ?? 'unknown'} is invalid.`);
    if (previous && previous < entry.releasedAt) throw new Error('The local changelog entries must be newest first.');
    previous = entry.releasedAt; versions.add(entry.version);
  }
  return Object.freeze({ ...manifest, entries: Object.freeze(manifest.entries.map((entry) => Object.freeze({ ...entry, changes: Object.freeze([...entry.changes]) }))) });
}

export const SITE_CHANGELOG_MANIFEST = validateChangelogManifest(generatedManifest ?? { schemaVersion: CHANGELOG_SCHEMA_VERSION, repository: CHANGELOG_REPOSITORY, generatedAt: fallbackEntries[0].releasedAt, entries: fallbackEntries });
export const SITE_CHANGELOG_ENTRIES = SITE_CHANGELOG_MANIFEST.entries;

export function changelogCommitUrl(validatedSha) {
  if (typeof validatedSha !== 'string' || !SHA.test(validatedSha)) throw new Error('A full commit SHA is required.');
  return `https://github.com/${CHANGELOG_REPOSITORY}/commit/${validatedSha}`;
}

export function changelogMarkdown(entries = SITE_CHANGELOG_ENTRIES, displayName = 'Ding Ding App Store') {
  if (!Array.isArray(entries)) throw new Error('Changelog export entries must be an array.');
  for (const entry of entries) validateChangelogManifest({ schemaVersion: 1, repository: CHANGELOG_REPOSITORY, generatedAt: entry.releasedAt, entries: [entry] });
  const safeLine = (value) => String(value).replace(/[\r\n\u2028\u2029]/g, ' ').replace(/[<>`*_\[\]()!#>|]/g, '').replace(/^[#>*-]+\s*/, '').trim();
  const safeName = safeLine(displayName) || 'Ding Ding App Store';
  return [`# ${safeName} changelog`, '', ...entries.flatMap((entry) => [`## ${safeLine(entry.version)} — ${safeLine(entry.releasedAt.slice(0, 10))}`, '', ...entry.changes.map((change) => `- ${safeLine(change)}`), `- Commit: ${safeLine(entry.commit)}`, `- Release: ${safeLine(entry.releaseUrl)}`, ''])].join('\n');
}
