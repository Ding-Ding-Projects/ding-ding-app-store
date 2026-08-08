import { describe, expect, it } from 'vitest';
import { compactReleaseInventory, MAX_RAW_INVENTORY_BYTES } from '../scripts/compact-release-inventory.mjs';
import { generateReleaseManifest } from '../scripts/generate-release-changelog.mjs';

const sha = '1111111111111111111111111111111111111111';
const row = {
  tag_name: 'v0.1.0-1', draft: false, published_at: '2026-08-07T16:35:52Z',
  html_url: 'https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v0.1.0-1',
  body: `Title and a long generated table\n- Source commit: \`${sha}\`\n- Dim sum code name: Classic Har Gow · 蝦餃\n- Public dish photo: [classic-har-gow.png](https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/classic-har-gow.png)\n`,
  assets: Array.from({ length: 100 }, (_, index) => ({ name: `asset-${index}.zip`, size: 123 })),
};

describe('release inventory compactor', () => {
  it('flattens pages and keeps only manifest fields plus release evidence lines', () => {
    const compacted = compactReleaseInventory([[row], [{ ...row, tag_name: 'v0.1.0-2', draft: true }]]);
    expect(compacted).toHaveLength(2);
    expect(compacted[0]).toEqual({
      tag_name: row.tag_name,
      draft: false,
      published_at: row.published_at,
      html_url: row.html_url,
      body: `- Source commit: \`${sha}\`\n- Dim sum code name: Classic Har Gow · 蝦餃\n- Public dish photo: [classic-har-gow.png](https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/classic-har-gow.png)`,
    });
  });

  it('preserves a missing body as an explicit empty value so the downstream generator fails closed', () => {
    expect(compactReleaseInventory([[{ ...row, body: undefined, draft: true }]])[0].body).toBe('');
  });

  it('deduplicates byte-identical pagination repeats but preserves conflicting same-tag rows', () => {
    expect(compactReleaseInventory([[row], [{ ...row }]])).toHaveLength(1);
    expect(compactReleaseInventory([[row], [{ ...row, body: `${row.body}\n- Source commit: \`${sha}\`` }]])).toHaveLength(2);
  });

  it('feeds compacted rows through the real manifest generator', () => {
    const compacted = compactReleaseInventory([[row]]);
    const manifest = generateReleaseManifest({
      repository: 'Ding-Ding-Projects/ding-ding-app-store',
      inventory: compacted,
      prospective: { version: 'v0.1.0-2', commit: '2222222222222222222222222222222222222222', releasedAt: '2026-08-08T01:12:15Z' },
      commitMetadata: {
        [sha]: { subject: 'Ship the initial application', files: ['src/main/main.ts'] },
        '2222222222222222222222222222222222222222': { subject: 'Generate bounded release metadata', files: ['scripts/compact-release-inventory.mjs'] },
      },
      dish: null,
    });
    expect(manifest.entries[1].commit).toBe(sha);
  });

  it('rejects malformed rows, oversized bodies, and sensitive text', () => {
    expect(() => compactReleaseInventory([[{ ...row, draft: 'false' }]])).toThrow(/invalid draft/);
    expect(() => compactReleaseInventory([[{ ...row, body: 'x'.repeat(64 * 1024 + 1) }]])).toThrow(/oversized body/);
    expect(() => compactReleaseInventory([[{ ...row, body: 'Authorization: Bearer definitely-not-public' }]])).toThrow(/private data/);
  });

  it('keeps the raw input bound explicit for the workflow contract', () => {
    expect(MAX_RAW_INVENTORY_BYTES).toBe(16 * 1024 * 1024);
  });
});
