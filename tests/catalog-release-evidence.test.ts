import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { AMULET_RELEASE_EVIDENCE, KEEPASSXC_RELEASE_EVIDENCE } from '../src/shared/catalog-release-evidence.js';
import { INSTALL_ADAPTERS } from '../src/main/install-adapters.js';

const read = (relative: string) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

describe('reviewed catalog release evidence', () => {
  it('pins the Amulet Squirrel release, assets, source manifest, and non-green test result', async () => {
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
      tag: '0.10.0-dev.567',
      targetCommit: '0173704db6bb37f8cdeae75b98bf2e6a25537e46',
      sourceManifest: 'pyproject.toml',
      workflow: { started: '2026-08-11T05:59:50Z', completed: '2026-08-11T06:08:38Z', duration: '00:08:48' },
      tests: { status: 'failed' },
    });
    expect(AMULET_RELEASE_EVIDENCE.tests.summary).toContain('24 errors');
    expect(AMULET_RELEASE_EVIDENCE.tests.disclosure).toContain('does not claim green tests');
    expect(Object.isFrozen(AMULET_RELEASE_EVIDENCE)).toBe(true);
    expect(Object.isFrozen(AMULET_RELEASE_EVIDENCE.sourceEvidence)).toBe(true);
    expect(Object.isFrozen(AMULET_RELEASE_EVIDENCE.workflow)).toBe(true);
    expect(Object.isFrozen(AMULET_RELEASE_EVIDENCE.assets)).toBe(true);
    expect(Object.isFrozen(AMULET_RELEASE_EVIDENCE.assets[0])).toBe(true);
    expect(Object.isFrozen(AMULET_RELEASE_EVIDENCE.tests)).toBe(true);
    expect(AMULET_RELEASE_EVIDENCE.assets).toEqual([
      { name: 'Setup.exe', bytes: 70412800, sha256: 'bfd30c6ad64cd4c8f6efbd03ffac44e032b334d163074bd089cf52bc0fe6fce1', role: 'installer' },
      { name: 'RELEASES', bytes: 79, sha256: '039bcef7f8f87f5ea0a4ae010022231bdf389bb94d58dc9070320c9aaf0166c7', role: 'update-index' },
      { name: 'Amulet-0.10.100567-full.nupkg', bytes: 70259367, sha256: '5b427ae6fe6285333ace91385199cb29a2bae51f0cb7579b7194dbced9c6c606', role: 'package' },
    ]);

    const docs = await read('docs/features/installation/one-click-installation.md');
    for (const value of [AMULET_RELEASE_EVIDENCE.tag, AMULET_RELEASE_EVIDENCE.targetCommit, ...AMULET_RELEASE_EVIDENCE.assets.map((asset) => asset.sha256), '24 errors']) {
      expect(docs).toContain(value);
    }
  });

  it('pins the current KeePassXC MSI to its release commit, workflow, and independently recomputed digest', () => {
    const adapter = INSTALL_ADAPTERS.keepassxc;
    expect(adapter.releaseEvidence).toBe(KEEPASSXC_RELEASE_EVIDENCE);
    expect(KEEPASSXC_RELEASE_EVIDENCE).toMatchObject({
      appId: 'keepassxc',
      repository: 'keepassxc',
      tag: 'v0.0.45.1',
      targetCommit: '9f71044fdc38dd4efc360794fb2248707e94d530',
      workflow: { started: '2026-08-17T03:22:02Z', completed: '2026-08-17T04:03:36Z', duration: '00:41:34' },
      tests: { status: 'passed' },
    });
    expect(KEEPASSXC_RELEASE_EVIDENCE.assets).toEqual([{
      name: 'KeePassXC-2.8.0-snapshot-x64.msi',
      bytes: 73071506,
      sha256: 'bfa4d0a2eb7f2406a4dd894dd770974811e5e1d6f8e016768324c33e564e8ef5',
      role: 'installer',
    }]);
    expect(Object.isFrozen(KEEPASSXC_RELEASE_EVIDENCE)).toBe(true);
    expect(Object.isFrozen(KEEPASSXC_RELEASE_EVIDENCE.assets[0])).toBe(true);
  });
});
