import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { AMULET_RELEASE_EVIDENCE, TAX_REPORTING_RELEASE_EVIDENCE } from '../src/shared/catalog-release-evidence.js';
import { INSTALL_ADAPTERS } from '../src/main/install-adapters.js';

const read = (relative: string) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

describe('reviewed catalog release evidence', () => {
  it('pins the current Amulet Squirrel release, assets, source manifest, and unrun test state', async () => {
    const catalog = JSON.parse(await read('data/catalog.v1.json')) as { apps: Array<{ id: string; repository: string; sourceManifest: string }> };
    const amulet = catalog.apps.find((record) => record.id === 'material-minecraft-map-editor');
    const bluemap = catalog.apps.find((record) => record.id === 'material-bluemap');
    expect(amulet).toMatchObject({ repository: 'material-minecraft-map-editor', sourceManifest: 'pyproject.toml' });
    expect(bluemap).toMatchObject({ repository: 'worldlens' });
    expect(catalog.apps.filter((record) => record.id === 'material-bluemap')).toHaveLength(1);
    expect(catalog.apps.filter((record) => record.id === 'material-minecraft-map-editor')).toHaveLength(1);

    const adapter = INSTALL_ADAPTERS['material-minecraft-map-editor'];
    expect(adapter.releaseEvidence).toBe(AMULET_RELEASE_EVIDENCE);
    expect(AMULET_RELEASE_EVIDENCE).toMatchObject({
      appId: 'material-minecraft-map-editor',
      repository: 'material-minecraft-map-editor',
      tag: '0.11.0-dev.25',
      targetCommit: '60eb2e3e0d07bb3aa0ec8e493b40790faa3522c4',
      sourceManifest: 'pyproject.toml',
      workflow: { started: '2026-08-13T16:51:21Z', completed: '2026-08-13T16:53:38Z', duration: '00:02:17' },
      tests: { status: 'unknown' },
    });
    expect(AMULET_RELEASE_EVIDENCE.tests.summary).toContain('without running tests');
    expect(AMULET_RELEASE_EVIDENCE.tests.disclosure).toContain('does not claim green tests');
    expect(Object.isFrozen(AMULET_RELEASE_EVIDENCE)).toBe(true);
    expect(Object.isFrozen(AMULET_RELEASE_EVIDENCE.sourceEvidence)).toBe(true);
    expect(Object.isFrozen(AMULET_RELEASE_EVIDENCE.workflow)).toBe(true);
    expect(Object.isFrozen(AMULET_RELEASE_EVIDENCE.assets)).toBe(true);
    expect(Object.isFrozen(AMULET_RELEASE_EVIDENCE.assets[0])).toBe(true);
    expect(Object.isFrozen(AMULET_RELEASE_EVIDENCE.tests)).toBe(true);
    expect(AMULET_RELEASE_EVIDENCE.assets).toEqual([
      { name: 'Setup.exe', bytes: 128645120, sha256: '45a7e3ca3cca7b584b7aa4a0df77a6b68896090aced2a38773fc73ab7541c780', role: 'installer' },
      { name: 'RELEASES', bytes: 106, sha256: '084f33bd7bcb7b988e3a0d48395d2671d252214e16d93afa51df1d2d24451933', role: 'update-index' },
      { name: 'material-minecraft-map-editor-0.11.100025-full.nupkg', bytes: 127785869, sha256: 'a383ba08fb4f3786ed6231949176ecc02d93ef8dca6e44be61a75a151d976e4a', role: 'package' },
    ]);

    const docs = await read('docs/features/installation/one-click-installation.md');
    for (const value of [AMULET_RELEASE_EVIDENCE.tag, AMULET_RELEASE_EVIDENCE.targetCommit, ...AMULET_RELEASE_EVIDENCE.assets.map((asset) => asset.sha256), 'without running tests']) {
      expect(docs).toContain(value);
    }
  });

  it('pins the reviewed Material Tax Reporting Squirrel release and root build route', async () => {
    const adapter = INSTALL_ADAPTERS['material-tax-reporting'];
    expect(adapter.releaseEvidence).toBe(TAX_REPORTING_RELEASE_EVIDENCE);
    expect(TAX_REPORTING_RELEASE_EVIDENCE).toMatchObject({
      appId: 'material-tax-reporting', repository: 'material-tax-reporting', tag: 'v0.1.36001',
      targetCommit: '7f509f9713dec6e98abc43ac3ea3b1c13260e495', sourceManifest: 'package.json',
      workflow: { started: '2026-08-15T22:37:41Z', completed: '2026-08-15T22:43:26Z', duration: '00:05:45' },
      tests: { status: 'unknown' },
    });
    expect(TAX_REPORTING_RELEASE_EVIDENCE.sourceEvidence).toContain('build.bat');
    expect(TAX_REPORTING_RELEASE_EVIDENCE.sourceEvidence).toContain('build-installer.bat');
    expect(TAX_REPORTING_RELEASE_EVIDENCE.assets).toEqual([
      { name: 'MaterialTaxReporting-0.1.36001-Setup.exe', bytes: 205370880, sha256: '5d6a5a701a00696da8870d6127888bcc5231d8754a50f21fb1d03f2e51b56f5f', role: 'installer' },
      { name: 'RELEASES', bytes: 95, sha256: '9b5384ccba33e472373a185676fac89e7cde1146da22eb1db1f0d1382ce915e0', role: 'update-index' },
      { name: 'MaterialTaxReporting-0.1.36001-full.nupkg', bytes: 204607728, sha256: '6c7eacd7180877fc3436c6545e4d950890711f85710168d8114ab70b5f51f5e5', role: 'package' },
    ]);
    expect(Object.isFrozen(TAX_REPORTING_RELEASE_EVIDENCE)).toBe(true);
    expect(Object.isFrozen(TAX_REPORTING_RELEASE_EVIDENCE.assets)).toBe(true);
  });
});
