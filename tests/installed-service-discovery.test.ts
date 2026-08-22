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
import { registryEntryFingerprint } from '../src/main/installed-detection';

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

  it('accepts an unchanged owned Squirrel registry entry only when the installed app directory proves the requested update version', async () => {
    const previousLocalAppData = process.env.LOCALAPPDATA;
    process.env.LOCALAPPDATA = electronState.userData;
    try {
      const squirrelRecord = {
        ...catalogRecord,
        id: 'desktop-material',
        repository: 'desktop-material',
        displayName: 'Desktop Material',
        packageType: 'squirrel',
        adapterId: 'desktop-material-squirrel',
      } as const;
      const catalog = { manifest: async () => ({ schemaVersion: 1 as const, organization: 'Ding-Ding-Projects' as const, apps: [squirrelRecord] }), recordFor: async () => squirrelRecord };
      const service = new InstalledService(catalog as never);
      const root = path.join(electronState.userData, 'GitHubDesktop');
      const updateExecutable = path.join(root, 'Update.exe');
      await mkdir(path.join(root, 'app-1.0.0'), { recursive: true });
      await mkdir(path.join(root, 'app-2.0.0'), { recursive: true });
      await writeFile(updateExecutable, 'reviewed updater');
      const entry = {
        key: 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\GitHubDesktop',
        displayName: 'GitHub Desktop',
        displayVersion: '1.0.0',
        installLocation: root,
        uninstallString: `"${updateExecutable}" --uninstall`,
      };
      const ownership = { kind: 'registry' as const, adapterId: squirrelRecord.adapterId, registryKey: entry.key, fingerprint: registryEntryFingerprint(entry) };
      await service.record({
        appId: squirrelRecord.id, displayName: squirrelRecord.displayName, version: 'v1.0.0', packageType: 'squirrel', source: 'store', installRoot: root,
        uninstall: { kind: 'squirrel', executable: updateExecutable, arguments: ['--uninstall', '-s'] }, ownership, installedAt: null, detectedAt: new Date().toISOString(),
      });
      (service as unknown as { registrySnapshot(): Promise<typeof entry[]> }).registrySnapshot = async () => [entry];

      await expect(service.recordInstalledFromRegistry(squirrelRecord as never, [entry], 'v2.0.0')).resolves.toEqual(expect.objectContaining({
        appId: squirrelRecord.id,
        version: '2.0.0',
        source: 'store',
        ownership,
      }));
      await expect(service.recordInstalledFromRegistry(squirrelRecord as never, [entry], 'v3.0.0')).rejects.toThrow('unchanged owned registry entry did not expose the requested installed version');
    } finally {
      if (previousLocalAppData === undefined) delete process.env.LOCALAPPDATA;
      else process.env.LOCALAPPDATA = previousLocalAppData;
    }
  });
});
