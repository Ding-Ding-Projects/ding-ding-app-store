import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import catalog from '../data/catalog.v1.json';
import { GENERATED_DOCS } from '../src/renderer/generated-docs';
import { buildRegistry } from '../src/renderer/registry';
import { DEFAULT_SCHEDULE, DEFAULT_TAB_WORKSPACE, type UserSettings } from '../src/shared/contracts';
import { catalogAdapterDocumentation, catalogArticleId } from '../scripts/catalog-doc-metadata.mjs';

// Hand-written completeness inventory: a catalog edit must explicitly preserve every reviewed app.
const CATALOG_APP_IDS = [
  'lowlevel-computer-use-mcp', 'material-download-manager', 'material-designer', 'material-bluemap',
  'desktop-material', 'home-assistant-ac-defender', 'material-email', 'opencodex',
  'qbittorrent-material', 'material-winscp', 'dim-sum-atlas', 'win-ssh-copy-id',
  'material-office', 'minecraft-world-downloader', 'codex-material', 'libreoffice-material',
  'thunderbird-desktop', 'bambu-studio', 'keepassxc', 'jdownloader-material', 'ha-bambulab',
  'winforge', 'wimforge', 'photo-viewer', 'material-minecraft-map-editor', 'material-gitlab', 'material-tax-reporting',
  'farming-game', 'material-cookie-clicker', 'material-encryption', 'material-ollama', 'material-sandbox',
  'material-tools', 'material-virtualbox', 'material-winforge', 'material-winutil', 'meadowmark',
  'minecraft-server-command-center', 'minecraft-server-studio', 'sprout-hollow-valley',
] as const;

const settings: UserSettings = {
  language: 'english', englishFunnyLevel: 1, cantoneseFunnyLevel: 1,
  theme: 'system', density: 'comfortable', accent: '#6750A4', displayName: 'Ding Ding App Store', automaticRepairConsent: false,
};

describe('generated catalog offline documentation', () => {
  it('bundles all 40 hand-written catalog IDs as metadata-only articles', async () => {
    expect(CATALOG_APP_IDS).toHaveLength(40);
    expect(catalog.apps.map((app) => app.id)).toEqual(CATALOG_APP_IDS);
    const generated = GENERATED_DOCS.filter((article) => article.source === 'catalog-metadata');
    expect(generated).toHaveLength(40);

    for (const appId of CATALOG_APP_IDS) {
      const article = generated.find((item) => item.catalogAppId === appId);
      expect(article).toMatchObject({ id: catalogArticleId(appId), source: 'catalog-metadata', catalogAppId: appId });
      expect(article?.body).toContain('Generated catalog metadata');
      expect(article?.body).toContain('does not scrape repository text');
      await expect(readFile(new URL(`../docs/catalog-apps/${catalogArticleId(appId)}.md`, import.meta.url), 'utf8')).resolves.toContain(appId);
    }
  });

  it('fails closed for an application ID outside the reviewed catalog inventory', () => {
    expect(() => catalogArticleId('unknown-app')).toThrow('Unknown catalog application ID: unknown-app');
    expect(() => catalogAdapterDocumentation({ id: 'unknown-app', adapterId: 'unknown-adapter', availability: 'unsupported' })).toThrow('Unknown catalog application ID: unknown-app');
  });

  it('keeps generated adapter states tied to the reviewed adapter source', async () => {
    const adapterSource = await readFile(new URL('../src/main/install-adapters.ts', import.meta.url), 'utf8');
    for (const record of catalog.apps) {
      const metadata = catalogAdapterDocumentation(record);
      expect(adapterSource).toContain(record.adapterId);
      if (metadata.status === 'blocked') expect(adapterSource).toContain(metadata.blocker);
    }
  });

  it('makes every generated catalog record searchable through a command-palette documentation destination', () => {
    const registry = buildRegistry({ settings, workspace: structuredClone(DEFAULT_TAB_WORKSPACE), appearance: {}, schedule: structuredClone(DEFAULT_SCHEDULE), apps: [] });
    for (const appId of CATALOG_APP_IDS) {
      expect(registry.find((entry) => entry.id === `cmd:open-doc:${catalogArticleId(appId)}`)?.action).toMatchObject({
        type: 'command', target: { surface: 'docs', articleId: catalogArticleId(appId), focusId: `docs-tab-${catalogArticleId(appId)}` },
      });
    }
  });
});
