import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AppCard } from '../src/renderer/pages/AppsPage';
import type { CatalogApp, InstalledAppRecord, UserSettings } from '../src/shared/contracts';

const settings: UserSettings = {
  language: 'en',
  englishFunnyLevel: 1,
  cantoneseFunnyLevel: 1,
  theme: 'system',
  density: 'comfortable',
  accent: '#6750A4',
  displayName: 'Ding Ding App Store',
  automaticRepairConsent: false,
};

const app: CatalogApp = {
  id: 'codex-material',
  name: 'Codex Material',
  repository: 'codex-material',
  description: 'Reviewed application.',
  homepageUrl: null,
  repositoryUrl: 'https://github.com/Ding-Ding-Projects/codex-material',
  defaultBranch: 'main',
  topics: [],
  stars: 0,
  updatedAt: '2026-08-08T00:00:00.000Z',
  latestVersion: '2.0.0',
  latestReleaseUrl: 'https://github.com/Ding-Ding-Projects/codex-material/releases/tag/v2.0.0',
  availability: 'installable',
  packageType: 'msi',
  installedVersion: '1.0.0',
  updateState: 'available',
  docsAvailable: true,
};

function render(installedRecord: InstalledAppRecord) {
  return renderToStaticMarkup(createElement(AppCard, {
    app,
    installedRecord,
    settings,
    onAction: vi.fn(),
    onManagedUpdate: vi.fn(),
    onCancelInstall: vi.fn(),
    managedUpdate: { appId: app.id, status: 'ready', installedVersion: '1.0.0', version: '2.0.0', releaseNotesUrl: app.latestReleaseUrl, progress: 100, bytesDownloaded: 1, bytesTotal: 1, unsigned: true },
    operationProgress: undefined,
    searchLabel: app.name,
    runningAction: null,
    selected: false,
    onSelect: vi.fn(),
  }));
}

describe('discovery-only app card', () => {
  it('renders external detection facts without any privileged install, update, or uninstall control', () => {
    const markup = render({
      appId: app.id,
      displayName: app.name,
      version: '1.0.0',
      packageType: 'msi',
      source: 'msi-registry',
      installRoot: null,
      uninstall: null,
      ownership: null,
      installedAt: null,
      detectedAt: '2026-08-08T00:00:00.000Z',
    });
    expect(markup).toContain('Detected outside App Store');
    expect(markup).toContain('This App Store did not install it');
    expect(markup).not.toContain('data-install-action');
    expect(markup).not.toContain('>Uninstall<');
    expect(markup).not.toContain('Download update');
    expect(markup).not.toContain('Restart to install update');
  });
});
