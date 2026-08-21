import { EventEmitter } from 'node:events';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstalledAppRecord } from '../src/shared/contracts';
import { AppLaunchService, appLaunchInternals } from '../src/main/app-launch-service';

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'ding-launch-'));
  temporaryRoots.push(root);
  return root;
}

async function executable(filePath: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, Buffer.from('reviewed executable fixture'));
  await chmod(filePath, 0o755);
}

function portableRecord(installRoot: string): InstalledAppRecord {
  return {
    appId: 'dim-sum-atlas',
    displayName: 'Dim Sum Atlas',
    version: '1.2.3',
    packageType: 'archive',
    source: 'portable-managed',
    installRoot,
    uninstall: { kind: 'portable', executable: null, arguments: [] },
    ownership: { kind: 'portable', adapterId: 'dim-sum-atlas-portable-zip', installRoot },
    installedAt: '2026-08-21T00:00:00.000Z',
    detectedAt: '2026-08-21T00:00:00.000Z',
  };
}

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('installed application launch boundary', () => {
  it('accepts only an application ID and the exact launch decision', () => {
    expect(appLaunchInternals.isAppLaunchRequest({ appId: 'dim-sum-atlas', decision: 'launch' })).toBe(true);
    expect(appLaunchInternals.isAppLaunchRequest({ appId: 'dim-sum-atlas', decision: 'launch', path: 'C:\\bad.exe' })).toBe(false);
    expect(appLaunchInternals.isAppLaunchRequest({ appId: 'dim-sum-atlas', decision: 'install' })).toBe(false);
    expect(appLaunchInternals.isAppLaunchRequest({ appId: '../outside', decision: 'launch' })).toBe(false);
  });

  it('resolves the exact managed portable executable beneath the owned root', async () => {
    const managedRoot = await temporaryRoot();
    const installRoot = path.join(managedRoot, 'dim-sum-atlas');
    const target = path.join(installRoot, 'DimSumAtlas.exe');
    await executable(target);
    const installed = { managedPortableRoot: managedRoot };
    const result = await appLaunchInternals.resolveLaunchTarget(installed as never, portableRecord(installRoot));
    expect(result.executable).toBe(await appLaunchInternals.validateLaunchTarget(installRoot, target, ['DimSumAtlas.exe']).then((value) => value.executable));
    expect(result.workingDirectory).toBe(path.dirname(result.executable));
  });

  it('resolves one exact reviewed Squirrel executable in the observed app-version directory', async () => {
    const installRoot = await temporaryRoot();
    const target = path.join(installRoot, 'app-1.4.3', 'sprout-hollow.exe');
    await executable(target);
    const record: InstalledAppRecord = {
      appId: 'farming-game', displayName: 'Sprout Hollow', version: 'v1.4.3-build.9', packageType: 'squirrel', source: 'store', installRoot,
      uninstall: { kind: 'squirrel', executable: path.join(installRoot, 'Update.exe'), arguments: ['--uninstall', '-s'] },
      ownership: { kind: 'registry', adapterId: 'farming-game-squirrel', registryKey: 'HKCU\\Software\\fixture', fingerprint: 'a'.repeat(64) },
      installedAt: '2026-08-21T00:00:00.000Z', detectedAt: '2026-08-21T00:00:00.000Z',
    };
    const result = await appLaunchInternals.resolveLaunchTarget({ managedPortableRoot: path.join(installRoot, 'portable') } as never, record);
    expect(path.basename(result.executable)).toBe('sprout-hollow.exe');
    expect(result.workingDirectory).toBe(path.dirname(result.executable));
  });

  it('resolves a reviewed nested executable path beneath a direct MSI install root', async () => {
    const installRoot = await temporaryRoot();
    const target = path.join(installRoot, 'program', 'soffice.exe');
    await executable(target);
    const record: InstalledAppRecord = {
      appId: 'libreoffice-material', displayName: 'LibreOffice Material', version: '1.0.0', packageType: 'msi', source: 'store', installRoot,
      uninstall: { kind: 'msi', executable: 'msiexec.exe', arguments: ['/x', '{12345678-1234-1234-1234-1234567890AB}', '/qn', '/norestart'] },
      ownership: { kind: 'registry', adapterId: 'libreoffice-material-msi', registryKey: 'HKLM\\Software\\fixture', fingerprint: 'b'.repeat(64) },
      installedAt: '2026-08-21T00:00:00.000Z', detectedAt: '2026-08-21T00:00:00.000Z',
    };
    const result = await appLaunchInternals.resolveLaunchTarget({ managedPortableRoot: path.join(installRoot, 'portable') } as never, record);
    expect(result.executable).toBe(await appLaunchInternals.validateLaunchTarget(installRoot, target, ['soffice.exe']).then((value) => value.executable));
  });

  it('rejects discovery-only ownership, roots outside the managed location, and paths outside the reviewed root', async () => {
    const managedRoot = await temporaryRoot();
    const installRoot = path.join(managedRoot, 'dim-sum-atlas');
    const target = path.join(installRoot, 'DimSumAtlas.exe');
    await executable(target);
    const discovery = { ...portableRecord(installRoot), source: 'reviewed-registry' as const, ownership: null, uninstall: null, installRoot: null };
    await expect(appLaunchInternals.resolveLaunchTarget({ managedPortableRoot: managedRoot } as never, discovery)).rejects.toThrow('Only an App Store-managed installation');
    await expect(appLaunchInternals.resolveLaunchTarget({ managedPortableRoot: path.join(managedRoot, 'different') } as never, portableRecord(installRoot))).rejects.toThrow('managed portable installation root');
    await expect(appLaunchInternals.validateLaunchTarget(installRoot, path.join(managedRoot, 'DimSumAtlas.exe'), ['DimSumAtlas.exe'])).rejects.toThrow('reviewed launch identity');
  });

  it('starts the exact target detached, shell-free, hidden, and resolves on process spawn without waiting for exit', async () => {
    const child = new EventEmitter() as EventEmitter & { pid: number; unref: ReturnType<typeof vi.fn> };
    child.pid = 42;
    child.unref = vi.fn();
    const spawnProcess = vi.fn(() => child);
    const launched = appLaunchInternals.startDetached('C:\\Apps\\Reviewed.exe', 'C:\\Apps', spawnProcess as never, 100);
    queueMicrotask(() => child.emit('spawn'));
    await launched;
    expect(spawnProcess).toHaveBeenCalledWith('C:\\Apps\\Reviewed.exe', [], {
      cwd: 'C:\\Apps', shell: false, windowsHide: true, detached: true, stdio: 'ignore',
    });
    expect(child.unref).toHaveBeenCalledOnce();
  });

  it('reports a bounded unconfirmed launch and sanitizes process errors without exposing a path', async () => {
    const child = new EventEmitter() as EventEmitter & { unref: ReturnType<typeof vi.fn> };
    child.unref = vi.fn();
    await expect(appLaunchInternals.startDetached('C:\\Secret\\Reviewed.exe', 'C:\\Secret', (() => child) as never, 5)).rejects.toThrow('may still have started');
    const failure = Object.assign(new Error('spawn C:\\Secret\\Reviewed.exe ENOENT'), { code: 'ENOENT' });
    expect(appLaunchInternals.safeLaunchFailure(failure)).toBe('Windows did not accept the reviewed application start request (ENOENT).');
  });

  it('rechecks proof, ownership, busy state, and records the accepted launch without exposing its path', async () => {
    const managedRoot = await temporaryRoot();
    const installRoot = path.join(managedRoot, 'dim-sum-atlas');
    await executable(path.join(installRoot, 'DimSumAtlas.exe'));
    const history = { record: vi.fn(async () => undefined) };
    const installed = { managedPortableRoot: managedRoot, get: vi.fn(async () => portableRecord(installRoot)) };
    const catalog = { recordFor: vi.fn(async () => ({ id: 'dim-sum-atlas', displayName: 'Dim Sum Atlas', proofStatus: 'verified', proofTargetId: null })) };
    const launchProcess = vi.fn(async () => undefined);
    const service = new AppLaunchService(catalog as never, installed as never, history as never, () => false, launchProcess);
    const result = await service.launch({ appId: 'dim-sum-atlas', decision: 'launch' });
    expect(result).toMatchObject({ ok: true, appId: 'dim-sum-atlas' });
    expect(result.messageYue).toContain('啟動要求已接受');
    expect(result.message).not.toMatch(/[A-Z]:\\|\\\\/);
    expect(launchProcess).toHaveBeenCalledOnce();
    expect(history.record).toHaveBeenCalledWith(expect.objectContaining({ kind: 'launch', ok: true, messageYue: expect.stringContaining('啟動要求已接受') }));

    const busy = new AppLaunchService(catalog as never, installed as never, history as never, () => true, launchProcess);
    await expect(busy.launch({ appId: 'dim-sum-atlas', decision: 'launch' })).resolves.toMatchObject({ ok: false, message: expect.stringContaining('operation in progress'), messageYue: expect.stringContaining('進行緊') });
    const blockedCatalog = { recordFor: vi.fn(async () => ({ id: 'dim-sum-atlas', displayName: 'Dim Sum Atlas', proofStatus: 'blocked-until-proof', proofTargetId: 'clean-windows' })) };
    const blocked = new AppLaunchService(blockedCatalog as never, installed as never, history as never, () => false, launchProcess);
    await expect(blocked.launch({ appId: 'dim-sum-atlas', decision: 'launch' })).resolves.toMatchObject({ ok: false, message: expect.stringContaining('until its clean-Windows lifecycle proof') });
  });
});
