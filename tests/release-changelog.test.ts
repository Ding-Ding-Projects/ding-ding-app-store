import { describe, expect, it } from 'vitest';
import {
  MAX_RELEASES,
  assertNoSensitiveData,
  flattenReleasePages,
  generateReleaseManifest,
  reconcilePublishedManifest,
  renderGeneratedModule,
  validateManifest,
} from '../scripts/generate-release-changelog.mjs';

const repository = 'Ding-Ding-Projects/ding-ding-app-store';
const publishedSha = '1111111111111111111111111111111111111111';
const currentSha = '2222222222222222222222222222222222222222';

const publishedRelease = {
  tag_name: 'v0.1.0-1',
  draft: false,
  prerelease: false,
  published_at: '2026-08-07T16:35:52Z',
  html_url: `https://github.com/${repository}/releases/tag/v0.1.0-1`,
  body: `Unsigned release.\n\n- Source commit: \`${publishedSha}\``,
};

const metadata = {
  [publishedSha]: { subject: 'Ship the initial application', files: ['src/main/main.ts'] },
  [currentSha]: { subject: 'Generate bounded release metadata', files: ['scripts/generate-release-changelog.mjs'] },
};

const input = (overrides = {}) => ({
  repository,
  inventory: [[publishedRelease]],
  prospective: { version: 'v0.1.0-2', commit: currentSha, releasedAt: '2026-08-08T01:12:15Z' },
  commitMetadata: metadata,
  dish: null,
  ...overrides,
});

describe('release changelog generator', () => {
  it('flattens bounded paginated inventory without losing page order', () => {
    expect(flattenReleasePages([[{ tag_name: 'one' }], [{ tag_name: 'two' }]])).toEqual([
      { tag_name: 'one' }, { tag_name: 'two' },
    ]);
  });

  it('adds the prospective entry first with an explicit pending state and exact UI rows', () => {
    const manifest = generateReleaseManifest(input());
    expect(manifest.entries.map((entry) => entry.version)).toEqual(['v0.1.0-2', 'v0.1.0-1']);
    expect(manifest.entries[0]).toMatchObject({
      commit: currentSha,
      publicationState: 'pending',
      releaseUrl: `https://github.com/${repository}/releases/tag/v0.1.0-2`,
      changes: ['Delivery: Generate bounded release metadata'],
      dimSum: null,
    });
    const module = renderGeneratedModule(manifest);
    expect(module).toContain('export const GENERATED_CHANGELOG_ENTRIES =');
    expect(module).toContain('export const GENERATED_RELEASE_MANIFEST =');
    expect(module.indexOf('"version"')).toBeLessThan(module.indexOf('"releaseUrl"'));
  });

  it('rejects duplicate published or prospective tags', () => {
    expect(() => generateReleaseManifest(input({ inventory: [[publishedRelease, { ...publishedRelease }]] }))).toThrow(/Duplicate release tag/);
    expect(() => generateReleaseManifest(input({ prospective: { version: 'v0.1.0-1', commit: currentSha, releasedAt: '2026-08-08T01:12:15Z' } }))).toThrow(/duplicates published tag/);
  });

  it('rejects malformed and untrusted release metadata', () => {
    expect(() => generateReleaseManifest(input({
      inventory: [[{ ...publishedRelease, html_url: 'https://attacker.invalid/release' }]],
    }))).toThrow(/untrusted release URL/);
    expect(() => generateReleaseManifest(input({
      inventory: [[{ ...publishedRelease, published_at: 'tomorrowish' }]],
    }))).toThrow(/valid UTC ISO-8601/);
  });

  it('fails closed when a published release lacks an exact source SHA', () => {
    expect(() => generateReleaseManifest(input({
      inventory: [[{ ...publishedRelease, body: 'No source commit was recorded.' }]],
    }))).toThrow(/exactly one full Source commit SHA/);
  });

  it('keeps a missing catalog code name explicit and non-blocking', () => {
    const manifest = generateReleaseManifest(input({ dish: { available: false, reason: 'catalog offline' } }));
    expect(manifest.entries[0].dimSum).toBeNull();
  });

  it('sorts newest first and reconciles the prospective entry without a source change', () => {
    const pending = generateReleaseManifest(input());
    const published = reconcilePublishedManifest(pending, '2026-08-08T01:15:09Z');
    expect(published.entries[0]).toMatchObject({ version: 'v0.1.0-2', releasedAt: '2026-08-08T01:15:09.000Z', publicationState: 'published' });
    expect(published.entries.every((entry) => entry.publicationState === 'published')).toBe(true);
    expect(() => validateManifest(published, { allowPending: false })).not.toThrow();
  });

  it('enforces page, release-count, and emitted-text bounds', () => {
    expect(() => flattenReleasePages([Array.from({ length: 101 }, () => ({}))])).toThrow(/page exceeded 100/);
    const pages = [Array.from({ length: 100 }, () => ({})), Array.from({ length: 100 }, () => ({})), [{}]];
    expect(() => flattenReleasePages(pages)).toThrow(new RegExp(`exceeded ${MAX_RELEASES} records`));
    expect(() => generateReleaseManifest(input({
      commitMetadata: { ...metadata, [currentSha]: { subject: 'x'.repeat(181), files: [] } },
    }))).toThrow(/too long/);
  });

  it('rejects token-like and private data before it can reach generated output', () => {
    expect(() => assertNoSensitiveData('Authorization: Bearer definitely-not-public')).toThrow(/private data/);
    expect(() => generateReleaseManifest(input({
      commitMetadata: { ...metadata, [currentSha]: { subject: 'Use C:\\Users\\someone\\secret.txt', files: [] } },
    }))).toThrow(/private data/);
    expect(() => generateReleaseManifest(input({
      inventory: [[{ ...publishedRelease, body: `${publishedRelease.body}\n- token: gho_abcdefghijklmnopqrstuvwxyz123456` }]],
    }))).toThrow(/private data/);
  });
});
