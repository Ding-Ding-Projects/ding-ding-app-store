import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { proofStatusAllowsPrivilegedAction, proofStatusBlockMessage } from '../src/main/catalog-service.js';
import { AppCard } from '../src/renderer/pages/AppsPage';
import type { CatalogApp, UserSettings } from '../src/shared/contracts';

const settings: UserSettings = {
  language: 'en', englishFunnyLevel: 1, cantoneseFunnyLevel: 1, theme: 'system', density: 'comfortable',
  accent: '#6750A4', displayName: 'Ding Ding App Store', showEmojisInDialogs: false,
  automaticRepairConsent: false, narratorEnabled: false, narratorLanguage: 'en', narratorReducedSound: false,
};

const baseApp: CatalogApp = {
  id: 'farming-game', name: 'Sprout Hollow', repository: 'farming-game', description: 'Reviewed application.',
  homepageUrl: null, repositoryUrl: 'https://github.com/Ding-Ding-Projects/farming-game', defaultBranch: 'main',
  topics: [], stars: 0, updatedAt: '2026-08-19T00:00:00.000Z', latestVersion: '1.0.0',
  latestReleaseUrl: 'https://github.com/Ding-Ding-Projects/farming-game/releases/tag/v1.0.0', availability: 'installable',
  packageType: 'squirrel', proofStatus: 'blocked-until-proof', proofTargetId: 'farming-game-clean-windows',
  installedVersion: '0.9.0', updateState: 'available', docsAvailable: true,
};

function render(app: CatalogApp): string {
  return renderToStaticMarkup(createElement(AppCard, {
    app, installedRecord: undefined, settings, onAction: vi.fn(), onManagedUpdate: vi.fn(), onCancelInstall: vi.fn(),
    managedUpdate: { appId: app.id, status: 'ready', installedVersion: '0.9.0', version: '1.0.0', releaseNotesUrl: app.latestReleaseUrl!, progress: 100, bytesDownloaded: 1, bytesTotal: 1, unsigned: true },
    operationProgress: undefined, searchLabel: app.name, runningAction: null, selected: false, onSelect: vi.fn(),
  }));
}

describe('catalog proof-status enforcement', () => {
  it('allows only verified rows to reach privileged actions and gives blocked rows a truthful reason', () => {
    expect(proofStatusAllowsPrivilegedAction('verified')).toBe(true);
    expect(proofStatusAllowsPrivilegedAction('blocked-until-proof')).toBe(false);
    expect(proofStatusAllowsPrivilegedAction(undefined)).toBe(false);
    expect(proofStatusBlockMessage({ displayName: baseApp.name, proofStatus: baseApp.proofStatus, proofTargetId: baseApp.proofTargetId })).toContain('farming-game-clean-windows');
  });

  it('requires an explicit proof status and target discipline for every catalog row', async () => {
    const manifest = JSON.parse(await readFile(new URL('../data/catalog.v1.json', import.meta.url), 'utf8')) as { apps: Array<Record<string, unknown>> };
    expect(manifest.apps).toHaveLength(40);
    for (const row of manifest.apps) {
      expect(['not-required', 'blocked-until-proof', 'verified']).toContain(row.proofStatus);
      if (row.proofStatus === 'blocked-until-proof') expect(row.proofTargetId).toMatch(/^[a-z0-9][a-z0-9-]{1,127}$/);
      else expect(row.proofTargetId).toBeNull();
    }
  });

  it('keeps the audited catalog shard aligned with its real lifecycle evidence', async () => {
    const manifest = JSON.parse(await readFile(new URL('../data/catalog.v1.json', import.meta.url), 'utf8')) as {
      apps: Array<{ id: string; proofStatus: string; proofTargetId: string | null }>;
    };
    const scoped = Object.fromEntries(manifest.apps
      .filter((row) => ['material-email', 'opencodex', 'qbittorrent-material'].includes(row.id))
      .map((row) => [row.id, { proofStatus: row.proofStatus, proofTargetId: row.proofTargetId }]));
    expect(scoped).toEqual({
      'material-email': { proofStatus: 'verified', proofTargetId: null },
      opencodex: { proofStatus: 'blocked-until-proof', proofTargetId: 'opencodex-clean-windows' },
      'qbittorrent-material': { proofStatus: 'verified', proofTargetId: null },
    });
  });

  it('renders blocked rows as unavailable and with no install, build, or update controls', () => {
    const blocked = render(baseApp);
    expect(blocked).toContain('Blocked until proof');
    expect(blocked).toContain('farming-game-clean-windows');
    expect(blocked).not.toContain('data-install-action');
    expect(blocked).not.toContain('Restart to install update');
    expect(blocked).not.toContain('Download update');
    const verified = render({ ...baseApp, proofStatus: 'verified', proofTargetId: null });
    expect(verified).toContain('data-install-action');
  });

  it('keeps negative regressions exact: removing any enforcement marker turns this Chut red', async () => {
    const filesAndMarkers = [
      ['src/main/operation-service.ts', "if (!proofStatusAllowsPrivilegedAction(record.proofStatus))"],
      ['src/main/managed-update-service.ts', "if (!proofStatusAllowsPrivilegedAction(record.proofStatus))"],
      ['src/main/source-job-service.ts', "if (!proofStatusAllowsPrivilegedAction(record.proofStatus))"],
      ['src/main/main.ts', 'const blocked = await blockedCatalogRecord(catalog, request);'],
      ['src/renderer/pages/AppsPage.tsx', 'const proofBlocked = app.proofStatus !== \'verified\';'],
    ] as const;
    for (const [relative, marker] of filesAndMarkers) {
      const source = await readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
      const assertMarker = (candidate: string) => {
        if (!candidate.includes(marker)) throw new Error(`${relative} is missing exact proof enforcement marker: ${marker}`);
      };
      assertMarker(source);
      const broken = source.replaceAll(marker, '');
      expect(() => assertMarker(broken)).toThrow(/missing exact proof enforcement marker/);
    }
  });
});
