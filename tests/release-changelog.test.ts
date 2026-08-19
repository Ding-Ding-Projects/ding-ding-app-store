import { describe, expect, it } from 'vitest';
import {
  MAX_RELEASES,
  assertProspectiveCommitIsHead,
  assertNoSensitiveData,
  flattenReleasePages,
  generateFallbackManifest,
  generateReleaseManifest,
  reconcilePublishedManifest,
  renderGeneratedModule,
  renderGeneratedSiteModule,
  validateManifest,
} from '../scripts/generate-release-changelog.mjs';

const repository = 'Ding-Ding-Projects/ding-ding-app-store';
const publishedSha = '1111111111111111111111111111111111111111';
const currentSha = '2222222222222222222222222222222222222222';

const publishedRelease = {
  tag_name: 'v0.1.0',
  draft: false,
  prerelease: false,
  published_at: '2026-08-07T16:35:52Z',
  html_url: `https://github.com/${repository}/releases/tag/v0.1.0`,
  body: `Unsigned release.\n\n- Source commit: \`${publishedSha}\``,
};

const metadata = {
  [publishedSha]: { subject: 'Ship the initial application', files: ['src/main/main.ts'] },
  [currentSha]: { subject: 'Generate bounded release metadata', files: ['scripts/generate-release-changelog.mjs'] },
};

const input = (overrides = {}) => ({
  repository,
  inventory: [[publishedRelease]],
  prospective: { version: 'v0.1.42', commit: currentSha, releasedAt: '2026-08-08T01:12:15Z' },
  commitMetadata: metadata,
  dish: null,
  ...overrides,
});

describe('release changelog generator', () => {
  it('flattens bounded paginated inventory without losing page order', () => {
    expect(flattenReleasePages([[{ tag_name: 'one' }], [{ tag_name: 'two' }]])).toEqual([
      { tag_name: 'one' }, { tag_name: 'two' },
    ]);
    expect(flattenReleasePages(Array.from({ length: 101 }, (_, index) => ({ tag_name: String(index) })))).toHaveLength(101);
  });

  it('adds the prospective entry first with an explicit pending state and exact UI rows', () => {
    const manifest = generateReleaseManifest(input());
    expect(manifest.entries.map((entry) => entry.version)).toEqual(['v0.1.42', 'v0.1.0']);
    expect(manifest.entries[0]).toMatchObject({
      commit: currentSha,
      publicationState: 'pending',
      releaseUrl: `https://github.com/${repository}/releases/tag/v0.1.42`,
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
    expect(() => generateReleaseManifest(input({ prospective: { version: 'v0.1.0', commit: currentSha, releasedAt: '2026-08-08T01:12:15Z' } }))).toThrow(/duplicates published tag/);
  });

  it('retains exact historical release tags and URLs while requiring a new exact tag', () => {
    const legacy = {
      ...publishedRelease,
      tag_name: 'v0.1.0-1002-1',
      html_url: `https://github.com/${repository}/releases/tag/v0.1.0-1002-1`,
    };
    const manifest = generateReleaseManifest(input({
      inventory: [[legacy]],
      prospective: { version: 'v0.1.42', commit: currentSha, releasedAt: '2026-08-08T01:12:15Z' },
    }));
    expect(manifest.entries).toEqual(expect.arrayContaining([
      expect.objectContaining({ version: 'v0.1.0-1002-1', releaseUrl: legacy.html_url, commit: publishedSha }),
      expect.objectContaining({ version: 'v0.1.42', releaseUrl: `https://github.com/${repository}/releases/tag/v0.1.42`, commit: currentSha }),
    ]));
    expect(renderGeneratedSiteModule(manifest)).toContain('v0.1.0-1002-1');
    expect(generateReleaseManifest(input({ prospective: { version: 'v0.1.42-42-1', commit: currentSha, releasedAt: '2026-08-08T01:12:15Z' } }))).toMatchObject({
      entries: expect.arrayContaining([expect.objectContaining({ version: 'v0.1.42-42-1', publicationState: 'pending' })]),
    });
  });

  it('rejects malformed or misaddressed historical tags and retains their identity through fallback and reconciliation', () => {
    const legacy = {
      ...publishedRelease,
      tag_name: 'v0.1.0-1002-1',
      html_url: `https://github.com/${repository}/releases/tag/v0.1.0-1002-1`,
    };
    for (const tag_name of ['v0.1.0-1002-x', 'v0.1.0-', 'v0.1.0-alpha']) {
      expect(() => generateReleaseManifest(input({ inventory: [[{ ...legacy, tag_name }]], prospective: { version: 'v0.1.42', commit: currentSha, releasedAt: '2026-08-08T01:12:15Z' } }))).toThrow(/historical release-tag contract/i);
    }
    expect(() => generateReleaseManifest(input({ inventory: [[{ ...legacy, html_url: `https://github.com/${repository}/releases/tag/v0.1.0-1002-2` }]], prospective: { version: 'v0.1.42', commit: currentSha, releasedAt: '2026-08-08T01:12:15Z' } }))).toThrow(/untrusted release URL/i);
    const fallback = generateFallbackManifest({ repository, inventory: [[legacy]], commitMetadata: metadata });
    expect(fallback.entries[0]).toMatchObject({ version: legacy.tag_name, releaseUrl: legacy.html_url, commit: publishedSha });
    const reconciled = reconcilePublishedManifest(generateReleaseManifest(input({ inventory: [[legacy]], prospective: { version: 'v0.1.42', commit: currentSha, releasedAt: '2026-08-08T01:12:15Z' } })), '2026-08-08T01:15:09Z');
    expect(reconciled.entries.find((entry) => entry.version === legacy.tag_name)).toMatchObject({ releaseUrl: legacy.html_url, commit: publishedSha });
  });

  it('rejects malformed and untrusted release metadata', () => {
    expect(() => generateReleaseManifest(input({
      inventory: [[{ ...publishedRelease, html_url: 'https://attacker.invalid/release' }]],
    }))).toThrow(/untrusted release URL/);
    expect(() => generateReleaseManifest(input({
      inventory: [[{ ...publishedRelease, published_at: 'tomorrowish' }]],
    }))).toThrow(/valid UTC ISO-8601/);
    expect(() => generateReleaseManifest(input({ inventory: [[null]] }))).toThrow(/row 0 is malformed/);
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

  it('accepts the selector known fields but emits only bounded dim-sum metadata', () => {
    const manifest = generateReleaseManifest(input({ dish: {
      available: true,
      id: 'hk-dish-0001',
      codeName: 'Classic Har Gow · 蝦餃',
      nameEn: 'Classic Har Gow',
      nameZhHant: '蝦餃',
      assetName: 'classic-har-gow.png',
      photoUrl: 'https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/classic-har-gow.png',
      alt: 'Classic Har Gow',
    } }));
    expect(manifest.entries[0].dimSum).toEqual({
      codeName: 'Classic Har Gow · 蝦餃',
      assetName: 'classic-har-gow.png',
      photoUrl: 'https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/classic-har-gow.png',
    });
  });

  it('builds a published-only safe fallback for local and unreleased builds', () => {
    const manifest = generateFallbackManifest({ repository, inventory: [[publishedRelease]], commitMetadata: metadata });
    expect(manifest.generatedAt).toBe('2026-08-07T16:35:52.000Z');
    expect(manifest.entries).toHaveLength(1);
    expect(manifest.entries[0]).toMatchObject({ version: 'v0.1.0', publicationState: 'published' });
  });

  it('sorts newest first and reconciles the prospective entry without a source change', () => {
    const pending = generateReleaseManifest(input());
    const published = reconcilePublishedManifest(pending, '2026-08-08T01:15:09Z');
    expect(published.entries[0]).toMatchObject({ version: 'v0.1.42', releasedAt: '2026-08-08T01:15:09.000Z', publicationState: 'published' });
    expect(published.entries.every((entry) => entry.publicationState === 'published')).toBe(true);
    expect(() => validateManifest(published, { allowPending: false })).not.toThrow();
  });

  it('rejects unknown fields and invalid equal-time tie ordering during reconciliation', () => {
    const pending = generateReleaseManifest(input());
    expect(() => reconcilePublishedManifest({ ...pending, unexpected: true }, '2026-08-08T01:15:09Z')).toThrow(/unknown fields/);
    expect(() => reconcilePublishedManifest({
      ...pending,
      entries: pending.entries.map((entry, index) => index === 0 ? { ...entry, unexpected: true } : entry),
    }, '2026-08-08T01:15:09Z')).toThrow(/unknown fields/);
    const first = { ...pending.entries[0], version: 'v0.1.42', releasedAt: '2026-08-08T01:12:15.000Z' };
    const second = { ...pending.entries[1], version: 'v0.1.99', releasedAt: '2026-08-08T01:12:15.000Z' };
    expect(() => validateManifest({ ...pending, entries: [first, second] })).toThrow(/equal-time tag ordering/);
  });

  it('requires the prospective workflow SHA to equal the checked-out HEAD', () => {
    expect(() => assertProspectiveCommitIsHead('0000000000000000000000000000000000000000')).toThrow(/does not match checked-out HEAD/);
  });

  it('enforces page, release-count, and emitted-text bounds', () => {
    expect(() => flattenReleasePages([Array.from({ length: 101 }, () => ({}))])).toThrow(/page exceeded 100/);
    const pages = Array.from({ length: 20 }, () => Array.from({ length: 100 }, () => ({})));
    pages.push([{}]);
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
