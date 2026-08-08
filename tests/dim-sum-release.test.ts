import { describe, expect, it } from 'vitest';
import { selectPublishedDish } from '../scripts/select-dim-sum-release.mjs';

const catalog = {
  dishes: [
    { id: 'hk-dish-0001', name: { en: 'Classic Har Gow', zhHant: '蝦餃' }, image: { path: 'images/hk-dish-0001-classic-har-gow.png', alt: { en: 'Classic Har Gow' } } },
    { id: 'hk-dish-0002', name: { en: 'Siu Mai', zhHant: '燒賣' }, image: { path: 'images/hk-dish-0002-siu-mai.png', alt: { en: 'Siu Mai' } } },
  ],
};

const published = [{
  tag_name: 'catalog-v1',
  draft: false,
  assets: [
    { name: 'hk-dish-0001-classic-har-gow.png', browser_download_url: 'https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/hk-dish-0001-classic-har-gow.png' },
    { name: 'hk-dish-0002-siu-mai.png', browser_download_url: 'https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/hk-dish-0002-siu-mai.png' },
  ],
}];

describe('dim sum release code names', () => {
  it('selects the first unused dish whose photo is a published catalog asset', () => {
    expect(selectPublishedDish(catalog, published, [])).toMatchObject({
      available: true,
      codeName: 'Classic Har Gow · 蝦餃',
      assetName: 'hk-dish-0001-classic-har-gow.png',
    });
  });

  it('never silently reuses a code name already recorded in release notes', () => {
    expect(selectPublishedDish(catalog, published, [{ body: 'Dim sum code name: Classic Har Gow · 蝦餃' }])).toMatchObject({
      available: true,
      codeName: 'Siu Mai · 燒賣',
    });
  });

  it('returns an honest non-blocking result when no public photo is available', () => {
    expect(selectPublishedDish(catalog, [], [])).toEqual({
      available: false,
      reason: 'No unused dish with a published catalog-v1 photo asset was available.',
    });
  });
});
