import { randomInt } from 'node:crypto';
import { z } from 'zod';
import type { DimSumSurprise } from '../shared/contracts.js';

const CATALOG_URL = 'https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json';
const RELEASES_URL = 'https://api.github.com/repos/Ding-Ding-Projects/dim-sum-photos/releases?per_page=20';
const catalogSchema = z.object({
  schemaVersion: z.union([z.literal(1), z.string()]),
  dishes: z.array(z.object({
    id: z.string().min(1).max(120),
    name: z.object({ en: z.string().min(1).max(120), zhHant: z.string().min(1).max(120) }).strict(),
    image: z.object({
      path: z.string().min(1).max(240),
      alt: z.object({ en: z.string().min(1).max(160) }).partial().default({}),
    }).partial().default({}),
  }).strict()).max(500),
}).strict();
const releasesSchema = z.array(z.object({ draft: z.boolean(), tag_name: z.string(), assets: z.array(z.object({ name: z.string(), browser_download_url: z.string().url() }).strict()) }).strict()).max(100);
type Catalog = z.infer<typeof catalogSchema>;
type Releases = z.infer<typeof releasesSchema>;

function isPublishedPhotoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === 'https://github.com' && url.pathname.startsWith('/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1');
  } catch { return false; }
}

async function fetchJson(url: string): Promise<unknown> {
  const parsed = new URL(url);
  if (!['raw.githubusercontent.com', 'api.github.com'].includes(parsed.hostname) || parsed.protocol !== 'https:') throw new Error('Blocked dim-sum catalog origin.');
  const response = await fetch(parsed, { redirect: 'error', headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Ding-Ding-App-Store' }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Dim-sum catalog returned HTTP ${response.status}.`);
  const text = await response.text();
  if (text.length > 4_000_000) throw new Error('Dim-sum catalog response exceeded 4 MB.');
  return JSON.parse(text) as unknown;
}

export class DimSumService {
  async startup(): Promise<DimSumSurprise> {
    try {
      const [catalogValue, releasesValue] = await Promise.all([fetchJson(CATALOG_URL), fetchJson(RELEASES_URL)]);
      const catalog = catalogSchema.parse(catalogValue);
      const releases = releasesSchema.parse(releasesValue);
      const published = new Map<string, string>();
      for (const release of releases) {
        if (release.draft || !release.tag_name.startsWith('catalog-v1')) continue;
        for (const asset of release.assets) {
          const url = new URL(asset.browser_download_url);
          if (url.origin === 'https://github.com' && url.pathname.startsWith('/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1') && /\.(?:png|jpe?g|webp)$/i.test(asset.name)) published.set(asset.name, asset.browser_download_url);
        }
      }
      const available = selectAvailableDish(catalog, releases, published);
      if (available.length === 0) return { available: false, reason: 'No published catalog-v1 dim-sum photo is available right now.' };
      return available[randomInt(available.length)];
    } catch (error) {
      return { available: false, reason: `Dim-sum surprise unavailable: ${(error as Error).message}`.slice(0, 220) };
    }
  }
}

export function selectAvailableDish(catalog: Catalog, releases: Releases, published = new Map<string, string>()) {
  if (published.size === 0) {
    for (const release of releases) {
      if (release.draft || !release.tag_name.startsWith('catalog-v1')) continue;
      for (const asset of release.assets) {
        const url = new URL(asset.browser_download_url);
        if (url.origin === 'https://github.com' && url.pathname.startsWith('/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1') && /\.(?:png|jpe?g|webp)$/i.test(asset.name)) published.set(asset.name, asset.browser_download_url);
      }
    }
  }
  return catalog.dishes.flatMap((dish) => {
    const assetName = dish.image?.path?.split('/').pop() ?? '';
    const photoUrl = published.get(assetName);
    if (!photoUrl || !isPublishedPhotoUrl(photoUrl)) return [];
    return [{ available: true as const, id: dish.id, nameEn: dish.name.en, nameZhHant: dish.name.zhHant, photoUrl, alt: dish.image?.alt?.en ?? `${dish.name.en} dim sum` }];
  });
}
