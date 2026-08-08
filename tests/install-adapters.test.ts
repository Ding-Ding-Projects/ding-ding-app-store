import { createWriteStream } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { describe, expect, it } from 'vitest';
import { ZipFile } from 'yazl';
import {
  CATALOG_APP_IDS,
  INSTALL_ADAPTERS,
  INSTALL_ADAPTER_IDS,
  adapterFor,
  selectInstallerAsset,
  validateAdapterCoverage,
} from '../src/main/install-adapters.js';
import { applyVerifiedInstalledState } from '../src/main/catalog-service.js';
import { TerminationUnprovenError, checksumFromCompanion, operationMustRetainLock, replacePortableDirectory, writeComplete } from '../src/main/operation-service.js';
import { extractZipSafe, validateArchiveEntryName } from '../src/main/safe-zip.js';

async function createZip(entries: Array<{ name: string; contents?: Buffer; mode?: number }>): Promise<{ directory: string; zipPath: string }> {
  const directory = await mkdtemp(path.join(tmpdir(), 'ding-ding-adapter-test-'));
  const zipPath = path.join(directory, 'fixture.zip');
  const zip = new ZipFile();
  for (const entry of entries) zip.addBuffer(entry.contents ?? Buffer.alloc(0), entry.name, entry.mode ? { mode: entry.mode } : undefined);
  zip.end();
  await pipeline(zip.outputStream, createWriteStream(zipPath));
  return { directory, zipPath };
}

const EXPECTED_APP_IDS = [
  'lowlevel-computer-use-mcp', 'material-download-manager', 'material-designer', 'material-bluemap',
  'desktop-material', 'home-assistant-ac-defender', 'material-email', 'opencodex',
  'qbittorrent-material', 'material-winscp', 'dim-sum-atlas', 'win-ssh-copy-id',
  'material-office', 'minecraft-world-downloader', 'codex-material', 'libreoffice-material',
  'thunderbird-desktop', 'bambu-studio', 'keepassxc', 'jdownloader-material', 'ha-bambulab',
  'winforge', 'wimforge', 'photo-viewer',
] as const;

const LATEST_ASSET_FIXTURES: Readonly<Record<string, string>> = {
  'lowlevel-computer-use-mcp': 'lowlevel-computer-use-manual-0.1.0-win-x64.exe',
  'material-download-manager': 'Setup.exe',
  'material-designer': 'material-designer-0.16.1-win-x64-setup.exe',
  'material-bluemap': 'Worldlens-0.1.758-Setup.exe',
  'desktop-material': 'GitHubDesktopSetup-x64.exe',
  'home-assistant-ac-defender': 'AC.Defender.Controller.Setup.0.1.0.exe',
  'material-email': 'Material-Email-0.105.1-Windows-x64.exe',
  opencodex: 'opencodex.Setup.2.7.42.exe',
  'qbittorrent-material': 'qBittorrent-Material-5.3.97-windows-x64-Setup.exe',
  'material-winscp': 'WinSCP.Material.0.1.590.Setup.exe',
  'dim-sum-atlas': 'DimSumAtlas-v0.1.13-windows-x64.zip',
  'material-office': 'Material-Office-0.1.0-x64-Setup.exe',
  'minecraft-world-downloader': 'WorldDownloaderManager-Setup.exe',
  'codex-material': 'Codex.Studio-0.1.0-x64.msi',
  'libreoffice-material': 'LibreOfficeMaterial-Windows-x64.msi',
  'thunderbird-desktop': 'thunderbird-155.0a1.en-US.win64.installer.exe',
  'bambu-studio': 'BambuStudioMD3-Setup.exe',
  keepassxc: 'KeePassXC-2.8.0-snapshot-x64.msi',
  'jdownloader-material': 'JDownloader-Material-windows-x64.exe',
  winforge: 'WinForge-portable-x64-1.1.326.zip',
  wimforge: 'WimForge-portable-x64-0.1.42.zip',
};

describe('hand-written universal install adapter coverage', () => {
  it('enumerates exactly the 24 reviewed catalog IDs', () => {
    expect(CATALOG_APP_IDS).toEqual(EXPECTED_APP_IDS);
    expect(new Set(INSTALL_ADAPTER_IDS).size).toBe(24);
    expect(() => validateAdapterCoverage()).not.toThrow();
  });

  it('requires every installable catalog row to name its matching supported adapter', async () => {
    const catalog = JSON.parse(await readFile(new URL('../data/catalog.v1.json', import.meta.url), 'utf8')) as {
      apps: Array<{ id: string; availability: string; packageType: string; adapterId: string }>;
    };
    expect(catalog.apps.map((record) => record.id)).toEqual(EXPECTED_APP_IDS);
    for (const record of catalog.apps) {
      const adapter = adapterFor(record.id);
      expect(record.adapterId).toBe(adapter.id);
      expect(record.packageType).toBe(adapter.packageType);
      expect(record.availability).toBe(adapter.supported ? 'installable' : 'unsupported');
      if (record.availability === 'installable') expect(adapter.supported).toBe(true);
      if (!adapter.supported) expect(record.availability).not.toBe('installable');
    }
  });

  it('selects exactly one audited current release asset for every supported application', () => {
    expect(Object.keys(LATEST_ASSET_FIXTURES)).toHaveLength(21);
    for (const [appId, assetName] of Object.entries(LATEST_ASSET_FIXTURES)) {
      const adapter = adapterFor(appId);
      expect(adapter.supported).toBe(true);
      expect(selectInstallerAsset(adapter, [{ name: assetName }]).name).toBe(assetName);
      expect(() => selectInstallerAsset(adapter, [{ name: assetName }, { name: assetName }])).toThrow(/exactly one/);
    }
  });

  it('keeps the observed Material Email registry identity version-exact', () => {
    const adapter = adapterFor('material-email');
    expect(adapter.supported).toBe(true);
    if (!adapter.supported || adapter.family === 'portable-zip') throw new Error('Material Email must use its reviewed NSIS adapter.');
    expect(adapter.registryDisplayNames).toEqual(['Material Email', 'Material Email 0.105.1']);
    expect(adapter.registryDisplayNames).not.toContain('Material Email 0.105.2');
    expect(adapter.uninstallExecutableNames).toEqual(['Uninstall Material Email.exe']);
  });

  it('keeps every unsupported row explicit and evidence-backed', () => {
    for (const appId of ['win-ssh-copy-id', 'ha-bambulab', 'photo-viewer']) {
      const adapter = INSTALL_ADAPTERS[appId as keyof typeof INSTALL_ADAPTERS];
      expect(adapter.supported).toBe(false);
      if (!adapter.supported) {
        expect(adapter.blocker.length).toBeGreaterThan(80);
        expect(adapter.evidence.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('installer integrity and archive inputs', () => {
  it('derives update state only from the freshly verified installed view', () => {
    const base = {
      name: 'App', repository: 'App', description: '', homepageUrl: null, repositoryUrl: 'https://github.com/Ding-Ding-Projects/App',
      defaultBranch: 'main', topics: [], stars: 0, updatedAt: new Date(0).toISOString(), latestVersion: 'v2.0.0',
      latestReleaseUrl: null, availability: 'installable' as const, packageType: 'msi' as const,
      installedVersion: 'stale-cache', updateState: 'available' as const, docsAvailable: true,
    };
    const apps = [
      { ...base, id: 'old' }, { ...base, id: 'current' }, { ...base, id: 'uninstalled' },
    ];
    const merged = applyVerifiedInstalledState(apps, [
      { appId: 'old', version: 'v1.0.0' }, { appId: 'current', version: 'v2.0.0' },
    ]);
    expect(merged.map(({ installedVersion, updateState }) => ({ installedVersion, updateState }))).toEqual([
      { installedVersion: 'v1.0.0', updateState: 'available' },
      { installedVersion: 'v2.0.0', updateState: 'up-to-date' },
      { installedVersion: null, updateState: 'unknown' },
    ]);
  });

  it('accepts only the exact selected filename from a verified companion checksum', () => {
    const digest = 'a'.repeat(64);
    expect(checksumFromCompanion(`${digest}  Setup.exe\n`, 'Setup.exe')).toBe(digest);
    expect(checksumFromCompanion(`${digest}  Other.exe\n`, 'Setup.exe')).toBeNull();
    expect(checksumFromCompanion(`${digest}  folder/Setup.exe\n`, 'Setup.exe')).toBeNull();
    expect(checksumFromCompanion(`not-a-digest  Setup.exe\n`, 'Setup.exe')).toBeNull();
  });

  it('rejects absolute, traversal, backslash, and NUL archive entries', () => {
    expect(validateArchiveEntryName('folder/App.exe')).toBe('folder/App.exe');
    for (const hostile of ['../escape.exe', 'folder/../escape.exe', '/absolute.exe', 'C:/drive.exe', 'folder\\escape.exe', 'bad\0name', 'CON', 'CONIN$', 'CONOUT$', 'COM¹.txt', 'LPT³', 'app.exe:payload', 'trailing.', 'trailing ']) {
      expect(() => validateArchiveEntryName(hostile)).toThrow();
    }
  });

  it('extracts real files including empty files and refuses Windows-case collisions', async () => {
    const valid = await createZip([{ name: 'App.exe', contents: Buffer.from('app') }, { name: 'empty.txt' }]);
    try {
      const output = path.join(valid.directory, 'valid-output');
      await expect(extractZipSafe(valid.zipPath, output)).resolves.toEqual({ entries: 2, bytes: 3 });
      await expect(readFile(path.join(output, 'App.exe'), 'utf8')).resolves.toBe('app');
      await expect(stat(path.join(output, 'empty.txt'))).resolves.toMatchObject({ size: 0 });
    } finally { await rm(valid.directory, { recursive: true, force: true }); }

    const duplicate = await createZip([{ name: 'App.exe', contents: Buffer.from('one') }, { name: 'app.exe', contents: Buffer.from('two') }]);
    try {
      await expect(extractZipSafe(duplicate.zipPath, path.join(duplicate.directory, 'duplicate-output'))).rejects.toThrow(/duplicate Windows path/);
    } finally { await rm(duplicate.directory, { recursive: true, force: true }); }
  });

  it('rejects a real ZIP symlink and an already-cancelled extraction', async () => {
    const fixture = await createZip([{ name: 'link', contents: Buffer.from('App.exe'), mode: 0o120777 }]);
    try {
      await expect(extractZipSafe(fixture.zipPath, path.join(fixture.directory, 'link-output'))).rejects.toThrow(/symbolic link/);
      const controller = new AbortController();
      controller.abort();
      await expect(extractZipSafe(fixture.zipPath, path.join(fixture.directory, 'cancel-output'), controller.signal)).rejects.toThrow(/cancelled/);
    } finally { await rm(fixture.directory, { recursive: true, force: true }); }
  });

  it('drains an active ZIP writer before mid-stream cancellation returns', async () => {
    const fixture = await createZip([{ name: 'large.bin', contents: randomBytes(32 * 1024 * 1024) }]);
    const output = path.join(fixture.directory, 'cancel-midstream');
    const target = path.join(output, 'large.bin');
    const controller = new AbortController();
    try {
      const extraction = extractZipSafe(fixture.zipPath, output, controller.signal);
      let observedBytes = 0;
      for (let attempt = 0; attempt < 1_000; attempt += 1) {
        observedBytes = (await stat(target).catch(() => null))?.size ?? 0;
        if (observedBytes > 0) break;
        await delay(2);
      }
      expect(observedBytes).toBeGreaterThan(0);
      controller.abort();
      await expect(extraction).rejects.toThrow(/cancelled/);
      const drainedSize = (await stat(target).catch(() => null))?.size ?? 0;
      await delay(50);
      expect((await stat(target).catch(() => null))?.size ?? 0).toBe(drainedSize);
    } finally { await rm(fixture.directory, { recursive: true, force: true }); }
  });

  it('loops through partial writes and fails a zero-progress write', async () => {
    const written: number[] = [];
    await writeComplete({
      async write(buffer, offset, length) {
        const bytesWritten = Math.min(2, length);
        written.push(...buffer.slice(offset, offset + bytesWritten));
        return { bytesWritten };
      },
    }, Uint8Array.from([1, 2, 3, 4, 5]));
    expect(written).toEqual([1, 2, 3, 4, 5]);
    await expect(writeComplete({ async write() { return { bytesWritten: 0 }; } }, Uint8Array.from([1]))).rejects.toThrow(/complete response chunk/);
  });

  it('retains the shared app-operation lock when process-tree termination is unproven', () => {
    expect(operationMustRetainLock(new TerminationUnprovenError('injected termination failure'))).toBe(true);
    expect(operationMustRetainLock(new Error('ordinary installer failure'))).toBe(false);
  });

  it('uses a portable commit point and never restores old bytes after committed backup-cleanup failure', async () => {
    const paths = new Set(['extracted', 'target']);
    let committed = false;
    const operations = {
      async stat(target: string) { return paths.has(target) ? {} : null; },
      async rename(from: string, to: string) { if (!paths.delete(from)) throw new Error(`missing ${from}`); paths.add(to); },
      async rm(target: string) { if (target === 'backup') throw new Error('backup locked'); paths.delete(target); },
    };
    await expect(replacePortableDirectory('extracted', 'target', 'backup', async () => { committed = true; }, operations))
      .resolves.toMatch(/backup could not be removed/);
    expect(committed).toBe(true);
    expect(paths.has('target')).toBe(true);
    expect(paths.has('backup')).toBe(true);
  });

  it('rolls portable bytes back before the metadata commit and surfaces rollback failure', async () => {
    const paths = new Set(['extracted', 'target']);
    const operations = {
      async stat(target: string) { return paths.has(target) ? {} : null; },
      async rename(from: string, to: string) { if (!paths.delete(from)) throw new Error(`missing ${from}`); paths.add(to); },
      async rm(target: string) { paths.delete(target); },
    };
    await expect(replacePortableDirectory('extracted', 'target', 'backup', async () => { throw new Error('metadata failed'); }, operations))
      .rejects.toThrow('metadata failed');
    expect(paths.has('target')).toBe(true);
    expect(paths.has('backup')).toBe(false);

    const broken = {
      ...operations,
      async rename(from: string, to: string) {
        if (from === 'backup') throw new Error('restore blocked');
        await operations.rename(from, to);
      },
    };
    const secondPaths = new Set(['extracted', 'target']);
    broken.stat = async (target: string) => secondPaths.has(target) ? {} : null;
    broken.rm = async (target: string) => { secondPaths.delete(target); };
    broken.rename = async (from: string, to: string) => {
      if (from === 'backup') throw new Error('restore blocked');
      if (!secondPaths.delete(from)) throw new Error(`missing ${from}`);
      secondPaths.add(to);
    };
    await expect(replacePortableDirectory('extracted', 'target', 'backup', async () => { throw new Error('metadata failed'); }, broken))
      .rejects.toThrow(/Rollback incomplete.*restore blocked/);
  });

  it('keeps privileged installation fixed, hidden, bounded, cancellable, and shell-free', async () => {
    const source = await readFile(new URL('../src/main/operation-service.ts', import.meta.url), 'utf8');
    for (const contract of [
      'shell: false', 'windowsHide: true', 'AbortController', 'AbortSignal.timeout(120_000)',
      'MAX_DOWNLOAD_BYTES', 'MAX_CHECKSUM_BYTES', 'REDIRECT_HOSTS', 'checksumFromCompanion',
      'extractZipSafe', 'terminateProcessTree', 'taskkill.exe', 'activeOperations', 'cancelInstall',
      "const operationKey = record.id", "kind: 'uninstall'", 'operationMustRetainLock',
      'recordInstalledFromRegistry', 'exact reviewed installed-app entry was not detected',
    ]) expect(source).toContain(contract);
    expect(source).not.toMatch(/exec\(|execFile\(|shell:\s*true/);
  });
});
