import { describe, expect, it } from 'vitest';
import { SITE_CHANGELOG_MANIFEST, SITE_CHANGELOG_ENTRIES, changelogCommitUrl, changelogMarkdown, validateChangelogManifest } from '../site/assets/changelog.mjs';

describe('static site changelog boundary', () => {
  it('keeps the checked-in manifest local, published, bounded, and newest-first', () => {
    expect(validateChangelogManifest(SITE_CHANGELOG_MANIFEST)).toStrictEqual(SITE_CHANGELOG_MANIFEST);
    expect(SITE_CHANGELOG_ENTRIES.every((entry) => entry.commit.length === 40 && entry.releaseUrl.startsWith('https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/'))).toBe(true);
    expect(changelogCommitUrl(SITE_CHANGELOG_ENTRIES[0].commit)).toBe(`https://github.com/Ding-Ding-Projects/ding-ding-app-store/commit/${SITE_CHANGELOG_ENTRIES[0].commit}`);
    expect(() => changelogCommitUrl('b4a94f3')).toThrow();
  });

  it('rejects unknown fields, inherited records, and impossible timestamps', () => {
    expect(() => validateChangelogManifest({ ...SITE_CHANGELOG_MANIFEST, unexpected: true })).toThrow();
    expect(() => validateChangelogManifest({ ...SITE_CHANGELOG_MANIFEST, entries: [{ ...SITE_CHANGELOG_ENTRIES[0], unexpected: true }] })).toThrow();
    const inherited = Object.create({ schemaVersion: 1, repository: SITE_CHANGELOG_MANIFEST.repository, generatedAt: SITE_CHANGELOG_MANIFEST.generatedAt, entries: SITE_CHANGELOG_ENTRIES });
    expect(() => validateChangelogManifest(inherited)).toThrow();
    expect(() => validateChangelogManifest({ ...SITE_CHANGELOG_MANIFEST, generatedAt: '2026-02-31T01:15:09.000Z' })).toThrow();
    expect(() => validateChangelogManifest({ ...SITE_CHANGELOG_MANIFEST, entries: [{ ...SITE_CHANGELOG_ENTRIES[0], releasedAt: '2026-02-31T01:15:09.000Z' }] })).toThrow();
    expect(() => validateChangelogManifest({ ...SITE_CHANGELOG_MANIFEST, generatedAt: 'not-a-date' })).toThrow();
    expect(() => validateChangelogManifest({ ...SITE_CHANGELOG_MANIFEST, entries: [{ ...SITE_CHANGELOG_ENTRIES[0], version: 'release-latest' }] })).toThrow();
  });

  it('exports validated records without allowing line-leading Markdown injection', () => {
    const malicious = { ...SITE_CHANGELOG_ENTRIES[0], changes: ['safe\n# injected\n- forged'] };
    expect(() => changelogMarkdown([malicious])).toThrow();
    const markdown = changelogMarkdown(SITE_CHANGELOG_ENTRIES.slice(0, 1), '# My Store\nInjected');
    expect(markdown).toContain('# My Store Injected changelog');
    expect(markdown).not.toContain('\n# injected');
  });
});
