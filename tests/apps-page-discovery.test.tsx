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
  launchAvailable: false,
  proofStatus: 'verified',
  proofTargetId: null,
  installedVersion: '1.0.0',
  updateState: 'available',
  docsAvailable: true,
};

function render(installedRecord: InstalledAppRecord, userSettings: UserSettings = settings, catalogApp: CatalogApp = app) {
  return renderToStaticMarkup(createElement(AppCard, {
    app: catalogApp,
    installedRecord,
    settings: userSettings,
    onAction: vi.fn(),
    onManagedUpdate: vi.fn(),
    onCancelInstall: vi.fn(),
    managedUpdate: { appId: catalogApp.id, status: 'ready', installedVersion: '1.0.0', version: '2.0.0', releaseNotesUrl: catalogApp.latestReleaseUrl!, progress: 100, bytesDownloaded: 1, bytesTotal: 1, unsigned: true },
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
    expect(markup).not.toContain('data-launch-action');
    expect(markup).not.toContain('>Uninstall<');
    expect(markup).not.toContain('data-update-download-action');
    expect(markup).not.toContain('data-update-install-action');
  });

  it('shows a real launch action only for a proof-verified App Store-managed row with a reviewed launch identity', () => {
    const managed: InstalledAppRecord = {
      appId: app.id, displayName: app.name, version: '1.0.0', packageType: 'msi', source: 'store', installRoot: 'C:\\Program Files\\Codex Material',
      uninstall: { kind: 'msi', executable: 'msiexec.exe', arguments: ['/x', '{12345678-1234-1234-1234-1234567890AB}', '/qn', '/norestart'] },
      ownership: { kind: 'registry', adapterId: 'codex-material-msi', registryKey: 'HKLM\\Software\\fixture', fingerprint: 'a'.repeat(64) },
      installedAt: '2026-08-08T00:00:00.000Z', detectedAt: '2026-08-08T00:00:00.000Z',
    };
    const launchable = render(managed, settings, { ...app, launchAvailable: true });
    expect(launchable).toContain(`data-launch-action="${app.id}"`);
    expect(launchable).toContain('aria-label="Launch Codex Material"');
    expect(launchable).toContain('aria-label="Reinstall Codex Material"');
    expect(launchable).toContain('aria-label="Uninstall Codex Material"');
    expect(launchable).toContain('data-update-install-action="codex-material"');
    expect(launchable).toContain('>Launch<');
    expect(launchable).not.toContain('C:\\Program Files');

    const unavailable = render(managed, settings, { ...app, launchAvailable: false });
    expect(unavailable).not.toContain('data-launch-action');
    expect(unavailable).toContain('aria-label="Launch Codex Material unavailable"');
    expect(unavailable).toContain('Launch unavailable');

    const blocked = render(managed, settings, { ...app, launchAvailable: true, proofStatus: 'blocked-until-proof', proofTargetId: 'clean-windows' });
    expect(blocked).not.toContain('data-launch-action');
  });

  it('renders app-specific managed-update progress with percentage, bytes, and accessible labels', () => {
    const managed: InstalledAppRecord = {
      appId: app.id, displayName: app.name, version: '1.0.0', packageType: 'msi', source: 'store', installRoot: 'C:\\Program Files\\Codex Material',
      uninstall: { kind: 'msi', executable: 'msiexec.exe', arguments: ['/x', '{12345678-1234-1234-1234-1234567890AB}', '/qn', '/norestart'] },
      ownership: { kind: 'registry', adapterId: 'codex-material-msi', registryKey: 'HKLM\\Software\\fixture', fingerprint: 'a'.repeat(64) },
      installedAt: '2026-08-08T00:00:00.000Z', detectedAt: '2026-08-08T00:00:00.000Z',
    };
    const markup = renderToStaticMarkup(createElement(AppCard, {
      app: { ...app, launchAvailable: true }, installedRecord: managed, settings,
      onAction: vi.fn(), onManagedUpdate: vi.fn(), onCancelInstall: vi.fn(),
      managedUpdate: { appId: app.id, status: 'downloading', installedVersion: '1.0.0', version: '2.0.0', releaseNotesUrl: app.latestReleaseUrl!, progress: 42, bytesDownloaded: 420, bytesTotal: 1000, unsigned: true },
      operationProgress: undefined, searchLabel: app.name, runningAction: null, selected: false, onSelect: vi.fn(),
    }));
    expect(markup).toContain('data-update-progress="codex-material"');
    expect(markup).toContain('value="42"');
    expect(markup).toContain('42%');
    expect(markup).toContain('420 / 1,000 bytes');
    expect(markup).toContain('aria-label="Codex Material update download progress"');
    expect(markup).toContain('aria-label="Cancel Codex Material update download"');
    expect(markup).toContain('data-update-download-action="codex-material"');
  });

  it('localizes catalog status and management facts through the persisted language mode', () => {
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
    }, { ...settings, language: 'yue' });
    expect(markup).toContain('有更新');
    expect(markup).toContain('偵測到外部安裝');
    expect(markup).not.toContain('Update available');
  });
});
