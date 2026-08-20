import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  AMULET_RELEASE_EVIDENCE,
  MATERIAL_OLLAMA_RELEASE_EVIDENCE,
  MATERIAL_SANDBOX_RELEASE_EVIDENCE,
  MATERIAL_TOOLS_RELEASE_EVIDENCE,
} from '../src/shared/catalog-release-evidence.js';
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

  it('pins the three reviewed material release identities without promoting ungated workflows to test verdicts', async () => {
    const catalog = JSON.parse(await read('data/catalog.v1.json')) as { apps: Array<{ id: string; repository: string; sourceManifest: string }> };
    const records = [
      MATERIAL_OLLAMA_RELEASE_EVIDENCE,
      MATERIAL_SANDBOX_RELEASE_EVIDENCE,
      MATERIAL_TOOLS_RELEASE_EVIDENCE,
    ] as const;

    expect(catalog.apps.find((record) => record.id === 'material-ollama')).toMatchObject({ repository: 'material-ollama', sourceManifest: 'CMakeLists.txt' });
    expect(catalog.apps.find((record) => record.id === 'material-sandbox')).toMatchObject({ repository: 'material-sandbox', sourceManifest: 'Installer/Sandboxie-Plus.iss' });
    expect(catalog.apps.find((record) => record.id === 'material-tools')).toMatchObject({ repository: 'material-tools', sourceManifest: 'package.json' });

    for (const evidence of records) {
      expect(INSTALL_ADAPTERS[evidence.appId].releaseEvidence).toBe(evidence);
      expect(evidence.tests.status).toBe('unknown');
      expect(evidence.tests.disclosure).toContain('Release publication is not a test verdict');
      expect(Object.isFrozen(evidence)).toBe(true);
      expect(Object.isFrozen(evidence.sourceEvidence)).toBe(true);
      expect(Object.isFrozen(evidence.workflow)).toBe(true);
      expect(Object.isFrozen(evidence.assets)).toBe(true);
      expect(evidence.assets.every((asset) => Object.isFrozen(asset))).toBe(true);
      expect(Object.isFrozen(evidence.tests)).toBe(true);
    }

    expect(MATERIAL_OLLAMA_RELEASE_EVIDENCE).toMatchObject({
      tag: 'v0.0.0-build.18',
      targetCommit: '3b33fc66c42c82b3d9fe0bfb012f85e68fc6ea6f',
      workflow: { duration: '00:23:51' },
      assets: [{ name: 'OllamaSetup.exe', bytes: 41883579, sha256: 'fe807823c152c0ca5f67145ada389a583bd1538e4dbe01bb8e70b668f11a09fc', role: 'installer' }],
    });
    expect(MATERIAL_SANDBOX_RELEASE_EVIDENCE).toMatchObject({
      tag: 'v0.0.0-build.35',
      targetCommit: '00e262034853c4fd06a3157deca163880fa8b584',
      workflow: { duration: '00:50:56' },
      assets: [{ name: 'Sandboxie-Plus-x64-v1.18.2.exe', bytes: 25022623, sha256: 'dcace3572fe3476d60b9425071401e8dfb49c7afd7355d3778b9da04ed601496', role: 'installer' }],
    });
    expect(MATERIAL_TOOLS_RELEASE_EVIDENCE).toMatchObject({
      tag: 'build-0.1.0.19',
      targetCommit: '9c407a81e9e4e30dc922cf955e83232dd5aeb754',
      workflow: { duration: '00:02:42' },
      assets: [
        { name: 'MaterialTools-Setup-0.1.0-x64.exe', bytes: 143731712, sha256: '6395210d754ee67025f77031a2f116da4a493522a48f79ab6efd17435515478b', role: 'installer' },
        { name: 'RELEASES', bytes: 85, sha256: 'ba908df5fbd56508ec8c667b2e0ee90874887bfebe6470d7bf0f10819cfe50af', role: 'update-index' },
        { name: 'material-tools-0.1.0-full.nupkg', bytes: 143036421, sha256: '30b03085bb2544f23c299663542efe2a98e37ec5195e1757ce0c3acd05a51f03', role: 'package' },
      ],
    });

    const docs = await read('docs/features/installation/one-click-installation.md');
    for (const evidence of records) {
      for (const value of [evidence.tag, evidence.targetCommit, ...evidence.assets.map((asset) => asset.sha256)]) expect(docs).toContain(value);
    }
  });
});
