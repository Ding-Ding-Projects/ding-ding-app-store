import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installationManagementState } from '../src/shared/contracts';

const electronState = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => name === 'userData' ? electronState.userData : electronState.userData,
  },
}));

import { InstalledService } from '../src/main/installed-service';

const catalogRecord = {
  id: 'codex-material',
  repository: 'codex-material',
  displayName: 'Codex Material',
  availability: 'installable',
  packageType: 'msi',
  adapterId: 'codex-material-msi',
  wiki: true,
  sourceManifest: 'package.json',
} as const;

function registryEntry(key = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CodexMaterial') {
  return {
    key,
    displayName: 'Codex Material',
    displayVersion: '1.2.3',
    installLocation: 'C:\\Program Files\\Codex Material',
    uninstallString: 'MsiExec.exe /x {12345678-1234-1234-1234-1234567890AB}',
  };
}

describe('InstalledService discovery-only records', () => {
  beforeEach(async () => {
    electronState.userData = await mkdtemp(path.join(os.tmpdir(), 'ding-ding-installed-'));
  });

  afterEach(async () => {
    await rm(electronState.userData, { recursive: true, force: true });
  });

  function serviceWith(entries: ReturnType<typeof registryEntry>[], failedKeys: string[] = []) {
    const catalog = {
      manifest: async () => ({ schemaVersion: 1 as const, organization: 'Ding-Ding-Projects' as const, apps: [catalogRecord] }),
      recordFor: async () => catalogRecord,
    };
    const service = new InstalledService(catalog as never);
    (service as unknown as { registrySnapshotBestEffort(): Promise<{ entries: ReturnType<typeof registryEntry>[]; failedKeys: string[] }> }).registrySnapshotBestEffort = async () => ({ entries, failedKeys });
    return service;
  }

  it('returns a reviewed upstream MSI as discovery-only without persisting ownership or uninstall authority', async () => {
    const service = serviceWith([registryEntry()]);
    const records = await service.discover();
    expect(records).toEqual([expect.objectContaining({
      appId: 'codex-material',
      version: '1.2.3',
      source: 'msi-registry',
      installRoot: null,
      uninstall: null,
      ownership: null,
      installedAt: null,
    })]);
    expect(installationManagementState(records[0])).toBe('discovery-only');
    expect(JSON.parse(await readFile(service.installedPath, 'utf8'))).toEqual([]);
    await expect(service.get('codex-material')).resolves.toBeNull();
  });

  it('fails discovery-only matching closed when a registry hive is unavailable or identity is ambiguous', async () => {
    await expect(serviceWith([registryEntry()], ['HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall']).discover()).resolves.toEqual([]);
    await expect(serviceWith([registryEntry(), registryEntry('HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CodexMaterial')]).discover()).resolves.toEqual([]);
  });

  it('re-discovers managed portable installs without requiring a registry snapshot', async () => {
    const portableRecord = {
      ...catalogRecord,
      id: 'dim-sum-atlas',
      repository: 'dim-sum-atlas',
      displayName: 'Dim Sum Atlas',
      packageType: 'archive',
      adapterId: 'dim-sum-atlas-portable-zip',
    } as const;
    const catalog = { manifest: async () => ({ schemaVersion: 1 as const, organization: 'Ding-Ding-Projects' as const, apps: [portableRecord] }), recordFor: async () => portableRecord };
    const service = new InstalledService(catalog as never);
    const root = path.join(electronState.userData, 'portable', portableRecord.id);
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, 'DimSumAtlas.exe'), 'portable executable');
    await service.record({
      appId: portableRecord.id, displayName: portableRecord.displayName, version: 'v0.1.13', packageType: 'archive', source: 'portable-managed',
      installRoot: root, uninstall: { kind: 'portable', executable: null, arguments: [] },
      ownership: { kind: 'portable', adapterId: portableRecord.adapterId, installRoot: root }, installedAt: null, detectedAt: new Date().toISOString(),
    });
    (service as unknown as { registrySnapshot(): Promise<never> }).registrySnapshot = async () => { throw new Error('registry should not be queried for portable ownership'); };
    await expect(service.get(portableRecord.id)).resolves.toEqual(expect.objectContaining({ appId: portableRecord.id, source: 'portable-managed', uninstall: { kind: 'portable', executable: null, arguments: [] } }));
  });
});
