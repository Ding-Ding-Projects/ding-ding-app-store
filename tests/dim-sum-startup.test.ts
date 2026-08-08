import { describe, expect, it } from 'vitest';
import { selectAvailableDish } from '../src/main/dim-sum-service';

const catalog = { schemaVersion: 1 as const, dishes: [
  { id: 'har-gow', name: { en: 'Classic Har Gow', zhHant: '蝦餃' }, image: { path: 'images/har-gow.png', alt: { en: 'Classic Har Gow' } } },
  { id: 'siu-mai', name: { en: 'Siu Mai', zhHant: '燒賣' }, image: { path: 'images/siu-mai.png', alt: { en: 'Siu Mai' } } },
] };

describe('startup dim-sum catalog boundary', () => {
  it('selects only dishes with published catalog-v1 image assets', () => {
    const result = selectAvailableDish(catalog, [{ draft: false, tag_name: 'catalog-v1', assets: [{ name: 'har-gow.png', browser_download_url: 'https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/har-gow.png' }] }]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'har-gow', nameZhHant: '蝦餃' });
  });

  it('returns an empty list when the public catalog has no published photo', () => {
    expect(selectAvailableDish(catalog, [])).toEqual([]);
  });

  it('ignores assets outside the public catalog-v1 release path', () => {
    expect(selectAvailableDish(catalog, [{ draft: false, tag_name: 'catalog-v1', assets: [{ name: 'har-gow.png', browser_download_url: 'https://example.test/har-gow.png' }] }])).toEqual([]);
  });
});
