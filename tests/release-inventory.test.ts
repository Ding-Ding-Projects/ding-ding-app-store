import { describe, expect, it } from 'vitest';
import { compactReleaseInventory, MAX_RAW_INVENTORY_BYTES } from '../scripts/compact-release-inventory.mjs';

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

  it('rejects malformed rows, oversized bodies, and sensitive text', () => {
    expect(() => compactReleaseInventory([[{ ...row, draft: 'false' }]])).toThrow(/invalid draft/);
    expect(() => compactReleaseInventory([[{ ...row, body: 'x'.repeat(64 * 1024 + 1) }]])).toThrow(/oversized body/);
    expect(() => compactReleaseInventory([[{ ...row, body: 'Authorization: Bearer definitely-not-public' }]])).toThrow(/private data/);
  });

  it('keeps the raw input bound explicit for the workflow contract', () => {
    expect(MAX_RAW_INVENTORY_BYTES).toBe(16 * 1024 * 1024);
  });
});
