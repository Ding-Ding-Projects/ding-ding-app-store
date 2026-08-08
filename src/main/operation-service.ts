import { createHash, randomUUID } from 'node:crypto';
import { constants, createReadStream } from 'node:fs';
import { access, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { app } from 'electron';
import type { InstallCancelRequest, InstalledAppRecord, OperationKind, OperationRequest, OperationResult } from '../shared/contracts.js';
import { CatalogService, type CatalogRecord, type ReleaseAsset, type ReleaseRecord } from './catalog-service.js';
import { HistoryService } from './history-service.js';
import { adapterFor, selectInstallerAsset, type ExecutableInstallAdapter, type InstallAdapter, type PortableZipInstallAdapter } from './install-adapters.js';
import { InstalledService } from './installed-service.js';
import { extractZipSafe } from './safe-zip.js';
import type { RegistryUninstallEntry } from './installed-detection.js';

const MAX_DOWNLOAD_BYTES = 1_500_000_000;
const MAX_CHECKSUM_BYTES = 128_000;
const REDIRECT_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);
const OPERATION_KINDS = new Set<OperationKind>(['install', 'build', 'uninstall']);

function isOperationRequest(value: unknown): value is OperationRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  const keys = Object.keys(request);
  return keys.length === 2
    && keys.includes('appId')
    && keys.includes('decision')
    && typeof request.appId === 'string'
    && /^[a-z0-9][a-z0-9-]{0,127}$/.test(request.appId)
    && typeof request.decision === 'string'
    && OPERATION_KINDS.has(request.decision as OperationKind);
}

function isCancelRequest(value: unknown): value is InstallCancelRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  return Object.keys(request).length === 2
    && typeof request.appId === 'string'
    && /^[a-z0-9][a-z0-9-]{0,127}$/.test(request.appId)
    && request.decision === 'cancel-install';
}

function invalidRequest(kind: OperationKind): OperationResult {
  return {
    ok: false,
    appId: 'invalid',
    message: `Invalid ${kind} request. Only a catalog application ID and matching user decision are accepted.`,
  };
}

function childEnvironment(): NodeJS.ProcessEnv {
  const names = [
    'ALLUSERSPROFILE', 'APPDATA', 'CommonProgramFiles', 'CommonProgramFiles(x86)', 'LOCALAPPDATA',
    'ProgramData', 'ProgramFiles', 'ProgramFiles(x86)', 'SystemDrive', 'SystemRoot', 'TEMP', 'TMP',
    'USERPROFILE', 'WINDIR',
  ];
  const env: NodeJS.ProcessEnv = {};
  for (const name of names) if (process.env[name]) env[name] = process.env[name];
  env.PATH = process.env.SystemRoot ? `${process.env.SystemRoot}\\System32` : undefined;
  return env;
}

export class TerminationUnprovenError extends Error {}

export function operationMustRetainLock(error: unknown): boolean {
  return error instanceof TerminationUnprovenError;
}

async function waitForChildClose(child: ReturnType<typeof spawn>, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => { child.removeListener('close', closed); resolve(false); }, timeoutMs);
    const closed = () => { clearTimeout(timer); resolve(true); };
    child.once('close', closed);
  });
}

async function terminateProcessTree(child: ReturnType<typeof spawn>): Promise<boolean> {
  if (!child.pid) return child.exitCode !== null || child.signalCode !== null;
  if (process.platform !== 'win32') {
    child.kill();
    return await waitForChildClose(child, 10_000);
  }
  const taskkill = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'taskkill.exe');
  const taskkillResult = await new Promise<{ code: number | null; timedOut: boolean }>((resolve) => {
    const killer = spawn(taskkill, ['/PID', String(child.pid), '/T', '/F'], {
      shell: false, windowsHide: true, stdio: 'ignore', env: childEnvironment(),
    });
    let settled = false;
    const finish = (code: number | null, timedOut: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, timedOut });
    };
    const timer = setTimeout(() => { killer.kill(); finish(null, true); }, 10_000);
    killer.once('error', () => finish(null, false));
    killer.once('exit', (code) => finish(code, false));
  });
  const launcherClosed = await waitForChildClose(child, 10_000);
  return taskkillResult.code === 0 && !taskkillResult.timedOut && launcherClosed;
}

async function run(executable: string, args: readonly string[], signal?: AbortSignal, timeoutMs = 15 * 60_000, operationLabel = 'installer'): Promise<number> {
  if (signal?.aborted) throw new Error('Installation cancelled before the installer started.');
  return await new Promise<number>((resolve, reject) => {
    const child = spawn(executable, [...args], {
      shell: false,
      windowsHide: true,
      stdio: 'ignore',
      env: childEnvironment(),
    });
    let settled = false;
    let stopping = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      callback();
    };
    const stop = (message: string) => {
      if (settled || stopping) return;
      stopping = true;
      void terminateProcessTree(child).then((terminated) => finish(() => reject(terminated
        ? new Error(message)
        : new TerminationUnprovenError(`${message} The ${operationLabel} process tree may still be running because termination could not be proven.`))))
        .catch(() => finish(() => reject(new TerminationUnprovenError(`${message} The ${operationLabel} process tree may still be running because termination could not be proven.`))));
    };
    const abort = () => stop('Installation cancelled.');
    const timer = setTimeout(() => stop('The installer exceeded the 15-minute safety limit.'), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    child.once('error', (error) => finish(() => reject(error)));
    child.once('exit', (code) => { if (!stopping) finish(() => resolve(code ?? -1)); });
  });
}

function githubDigest(asset: ReleaseAsset): string | null {
  return asset.digest?.match(/^sha256:([a-fA-F0-9]{64})$/)?.[1]?.toLowerCase() ?? null;
}

export async function writeComplete(
  handle: { write(buffer: Uint8Array, offset: number, length: number, position: null): Promise<{ bytesWritten: number }> },
  value: Uint8Array,
): Promise<void> {
  let offset = 0;
  while (offset < value.byteLength) {
    const { bytesWritten } = await handle.write(value, offset, value.byteLength - offset, null);
    if (bytesWritten <= 0 || bytesWritten > value.byteLength - offset) {
      throw new Error('Release download could not write the complete response chunk.');
    }
    offset += bytesWritten;
  }
}

interface PortableReplacementOperations {
  stat(target: string): Promise<unknown | null>;
  rename(from: string, to: string): Promise<void>;
  rm(target: string): Promise<void>;
}

const portableReplacementOperations: PortableReplacementOperations = {
  stat: async (target) => await stat(target).catch(() => null),
  rename: async (from, to) => { await rename(from, to); },
  rm: async (target) => { await rm(target, { recursive: true, force: true }); },
};

export async function replacePortableDirectory(
  extracted: string,
  target: string,
  backup: string,
  commit: () => Promise<void>,
  operations: PortableReplacementOperations = portableReplacementOperations,
): Promise<string | null> {
  let movedExisting = false;
  try {
    if (await operations.stat(target)) {
      await operations.rename(target, backup);
      movedExisting = true;
    }
    await operations.rename(extracted, target);
    await commit();
  } catch (error) {
    const rollbackErrors: string[] = [];
    if (await operations.stat(target)) {
      await operations.rm(target).catch((rollbackError: Error) => rollbackErrors.push(`new-directory cleanup failed: ${rollbackError.message}`));
    }
    if (movedExisting) {
      await operations.rename(backup, target).catch((rollbackError: Error) => rollbackErrors.push(`previous-version restore failed: ${rollbackError.message}`));
    }
    throw new Error(`${(error as Error).message}${rollbackErrors.length ? ` Rollback incomplete: ${rollbackErrors.join('; ')}.` : ''}`);
  }
  if (movedExisting) {
    try {
      await operations.rm(backup);
    } catch (error) {
      return `The previous-version backup could not be removed: ${(error as Error).message}`;
    }
  }
  return null;
}

async function downloadWithDigest(
  asset: ReleaseAsset,
  destination: string,
  expectedDigest: string,
  signal: AbortSignal,
  maximumBytes = MAX_DOWNLOAD_BYTES,
): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(expectedDigest)) throw new Error('The expected SHA-256 digest is invalid.');
  if (asset.size <= 0 || asset.size > maximumBytes) throw new Error('The release asset size is outside the allowed range.');

  let url = new URL(asset.browser_download_url);
  let response: Response | null = null;
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(120_000)]);
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (url.protocol !== 'https:' || url.username || url.password || !REDIRECT_HOSTS.has(url.hostname)) {
      throw new Error(`Blocked release asset origin: ${url.origin}`);
    }
    response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Ding-Ding-App-Store' }, signal: requestSignal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Release download redirected without a destination.');
      url = new URL(location, url);
      if (redirect === 3) throw new Error('Release download exceeded three redirects.');
      continue;
    }
    break;
  }
  if (!response?.ok || !response.body) throw new Error(`Release download failed: HTTP ${response?.status ?? 0}`);

  const handle = await open(destination, 'wx', 0o600);
  const hash = createHash('sha256');
  let received = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal.aborted) throw new Error('Installation cancelled during download.');
      received += value.byteLength;
      if (received > asset.size || received > maximumBytes) throw new Error('Release download exceeded its declared size.');
      hash.update(value);
      await writeComplete(handle, value);
    }
  } finally {
    await handle.close();
  }
  if (received !== asset.size) throw new Error(`Release download size mismatch: expected ${asset.size}, received ${received}.`);
  if (hash.digest('hex') !== expectedDigest) throw new Error('Release asset SHA-256 digest mismatch.');
  const fileStat = await stat(destination);
  if (fileStat.size !== asset.size) throw new Error(`Downloaded file size mismatch: expected ${asset.size}, wrote ${fileStat.size}.`);
  const fileHash = createHash('sha256');
  for await (const chunk of createReadStream(destination)) fileHash.update(chunk as Buffer);
  if (fileHash.digest('hex') !== expectedDigest) throw new Error('Downloaded file SHA-256 digest mismatch after close.');
}

export function checksumFromCompanion(contents: string, targetName: string): string | null {
  for (const line of contents.replace(/\r/g, '').split('\n')) {
    const match = line.trim().match(/^([a-fA-F0-9]{64})\s+[*]?(.+)$/);
    if (match && match[2].trim() === targetName) return match[1].toLowerCase();
  }
  return null;
}

async function resolveExpectedDigest(
  release: ReleaseRecord,
  asset: ReleaseAsset,
  adapter: InstallAdapter,
  operationDir: string,
  signal: AbortSignal,
): Promise<string> {
  const direct = githubDigest(asset);
  if (direct) return direct;
  if (!adapter.supported || !adapter.checksumAssetPattern) {
    throw new Error('This release asset has no GitHub SHA-256 digest or reviewed companion checksum.');
  }
  const matches = release.assets.filter((candidate) => adapter.checksumAssetPattern?.test(candidate.name));
  if (matches.length !== 1) throw new Error(`Expected exactly one reviewed checksum asset; found ${matches.length}.`);
  const checksumDigest = githubDigest(matches[0]);
  if (!checksumDigest) throw new Error('The companion checksum asset has no GitHub SHA-256 digest.');
  const checksumPath = path.join(operationDir, `checksum-${randomUUID()}.txt`);
  await downloadWithDigest(matches[0], checksumPath, checksumDigest, signal, MAX_CHECKSUM_BYTES);
  const contents = await readFile(checksumPath, 'utf8');
  const expected = checksumFromCompanion(contents, asset.name);
  if (!expected) throw new Error('The verified companion checksum does not name the selected installer asset exactly.');
  return expected;
}

export class OperationService {
  private readonly stagingRoot = path.join(app.getPath('userData'), 'staging');
  private readonly activeOperations = new Map<string, { kind: 'install' | 'uninstall'; controller: AbortController; phase: 'download' | 'extracting' | 'installer-running' }>();

  constructor(
    private readonly catalog: CatalogService,
    private readonly history: HistoryService,
    private readonly installed: InstalledService,
  ) {}

  private async finish(record: CatalogRecord, kind: OperationKind, result: OperationResult): Promise<OperationResult> {
    try {
      await this.history.record({ appId: result.appId, displayName: record.displayName, kind, ok: result.ok, message: result.message });
      return result;
    } catch {
      return { ...result, message: `${result.message} Activity history could not record this outcome.` };
    }
  }

  async cancelInstall(request: unknown): Promise<OperationResult> {
    if (!isCancelRequest(request)) return invalidRequest('install');
    const active = this.activeOperations.get(request.appId);
    if (!active || active.kind !== 'install') return { ok: false, appId: request.appId, message: 'No cancellable installation exists for this application.' };
    if (active.phase === 'installer-running') {
      return { ok: false, appId: request.appId, message: 'The reviewed installer has already started. Cancellation is unavailable because Windows Installer or a child service could continue after its launcher exits.' };
    }
    active.controller.abort();
    return { ok: true, appId: request.appId, message: `Cancellation was requested during ${active.phase}; the active install result will report when cleanup finishes.` };
  }

  async install(request: unknown): Promise<OperationResult> {
    if (!isOperationRequest(request)) return invalidRequest('install');
    const record = await this.catalog.recordFor(request.appId);
    if (request.decision !== 'install') {
      return this.finish(record, 'install', { ok: false, appId: request.appId, message: 'The install request did not carry the matching user decision.' });
    }
    const adapter = adapterFor(record.id);
    if (!adapter.supported) return this.finish(record, 'install', { ok: false, appId: record.id, message: adapter.blocker });

    const operationKey = record.id;
    if (this.activeOperations.has(operationKey)) {
      return this.finish(record, 'install', { ok: false, appId: request.appId, message: `${record.displayName} already has an install or uninstall operation in progress.` });
    }
    const controller = new AbortController();
    const active = { kind: 'install' as const, controller, phase: 'download' as const } as { kind: 'install'; controller: AbortController; phase: 'download' | 'extracting' | 'installer-running' };
    this.activeOperations.set(operationKey, active);
    const operationId = randomUUID();
    const operationDir = path.join(this.stagingRoot, operationId);
    let result: OperationResult;
    let retainOperationLock = false;
    try {
      await mkdir(operationDir, { recursive: true });
      const release = await this.catalog.latestRelease(record.repository);
      if (!release || release.draft || release.prerelease) throw new Error('No stable published release is available.');
      const asset = selectInstallerAsset(adapter, release.assets);
      const installerPath = path.join(operationDir, path.basename(asset.name));
      const digest = await resolveExpectedDigest(release, asset, adapter, operationDir, controller.signal);
      await downloadWithDigest(asset, installerPath, digest, controller.signal);
      let warning: string | null = null;
      if (adapter.family === 'portable-zip') {
        active.phase = 'extracting';
        warning = await this.installPortable(record, adapter, installerPath, release.tag_name, controller.signal);
      } else {
        const beforeRegistry = await this.installed.registrySnapshot();
        active.phase = 'installer-running';
        await this.runInstaller(adapter, installerPath, controller.signal);
        await this.recordDiscoveredInstall(record, release.tag_name, beforeRegistry);
      }
      result = { ok: true, appId: request.appId, operationId, message: `${record.displayName} ${release.tag_name} installed successfully.${warning ? ` ${warning}` : ''}` };
    } catch (error) {
      retainOperationLock = operationMustRetainLock(error);
      result = { ok: false, appId: request.appId, operationId, message: `${(error as Error).message}${retainOperationLock ? ' Staging is retained and this application remains locked until restart.' : ''}` };
    }
    if (!retainOperationLock) {
      try {
        await rm(operationDir, { recursive: true, force: true });
      } catch {
        result = { ...result, message: `${result.message} Temporary staging cleanup failed; the owned staging folder may remain.` };
      } finally {
        this.activeOperations.delete(operationKey);
      }
    }
    return this.finish(record, 'install', result);
  }

  private async runInstaller(adapter: ExecutableInstallAdapter, installerPath: string, signal: AbortSignal): Promise<void> {
    const windows = process.env.SystemRoot ?? 'C:\\Windows';
    const executable = adapter.family === 'msi' ? path.join(windows, 'System32', 'msiexec.exe') : installerPath;
    const arguments_ = adapter.family === 'msi'
      ? ['/i', installerPath, ...adapter.installArguments]
      : adapter.installArguments;
    const exitCode = await run(executable, arguments_, signal);
    if (exitCode !== 0) throw new Error(`Installer exited with code ${exitCode}.`);
  }

  private async recordDiscoveredInstall(record: CatalogRecord, version: string, beforeRegistry: readonly RegistryUninstallEntry[]): Promise<void> {
    try {
      await this.installed.recordInstalledFromRegistry(record, beforeRegistry, version);
    } catch (error) {
      throw new Error(`${record.displayName}'s installer exited successfully, but its exact reviewed installed-app entry was not detected. The application may be installed; do not retry automatically. ${(error as Error).message}`);
    }
  }

  private async installPortable(
    record: CatalogRecord,
    adapter: PortableZipInstallAdapter,
    archivePath: string,
    version: string,
    signal: AbortSignal,
  ): Promise<string | null> {
    if (signal.aborted) throw new Error('Installation cancelled before archive extraction.');
    const extracted = path.join(path.dirname(archivePath), 'expanded');
    await extractZipSafe(archivePath, extracted, signal);
    if (signal.aborted) throw new Error('Installation cancelled after archive extraction.');
    const executable = path.join(extracted, adapter.executableRelativePath);
    const executableStat = await stat(executable).catch(() => null);
    if (!executableStat?.isFile() || executableStat.size <= 0) throw new Error(`Portable archive is missing ${adapter.executableRelativePath}.`);

    await mkdir(this.installed.managedPortableRoot, { recursive: true });
    const target = path.join(this.installed.managedPortableRoot, record.id);
    const backup = path.join(this.installed.managedPortableRoot, `${record.id}.backup-${randomUUID()}`);
    return await replacePortableDirectory(extracted, target, backup, async () => {
      await this.installed.record({
        appId: record.id, displayName: record.displayName, version, packageType: 'archive', source: 'portable-managed',
        installRoot: target, uninstall: { kind: 'portable', executable: null, arguments: [] },
        ownership: { kind: 'portable', adapterId: adapter.id, installRoot: target },
        installedAt: new Date().toISOString(), detectedAt: new Date().toISOString(),
      });
    });
  }

  async build(request: unknown): Promise<OperationResult> {
    if (!isOperationRequest(request)) return invalidRequest('build');
    const record = await this.catalog.recordFor(request.appId);
    if (request.decision !== 'build') {
      return this.finish(record, 'build', { ok: false, appId: request.appId, message: 'The source-install request did not carry the matching user decision.' });
    }
    if (!record.sourceManifest) {
      return this.finish(record, 'build', { ok: false, appId: request.appId, message: 'This application has no reviewed source-build manifest.' });
    }
    return this.finish(record, 'build', {
      ok: false,
      appId: request.appId,
      message: 'The source recipe is catalogued, but execution is withheld until the disposable Windows Sandbox runner is available. Host-side scripts are never executed directly.',
    });
  }

  async uninstall(request: unknown): Promise<OperationResult> {
    if (!isOperationRequest(request)) return invalidRequest('uninstall');
    const record = await this.catalog.recordFor(request.appId);
    if (request.decision !== 'uninstall') {
      return this.finish(record, 'uninstall', { ok: false, appId: request.appId, message: 'The uninstall request did not carry the matching destructive decision.' });
    }
    const operationKey = record.id;
    if (this.activeOperations.has(operationKey)) {
      return this.finish(record, 'uninstall', { ok: false, appId: request.appId, message: `${record.displayName} already has an install or uninstall operation in progress.` });
    }
    this.activeOperations.set(operationKey, { kind: 'uninstall', controller: new AbortController(), phase: 'installer-running' });
    let retainOperationLock = false;
    let result: OperationResult;
    try {
      const current = await this.installed.get(request.appId);
      if (!current?.uninstall) throw new Error('No currently verified uninstall entry was discovered for this application.');
      if (current.uninstall.kind === 'portable') {
        const target = path.join(this.installed.managedPortableRoot, record.id);
        if (!current.installRoot || path.resolve(current.installRoot).toLocaleLowerCase() !== path.resolve(target).toLocaleLowerCase()) {
          throw new Error('Managed portable uninstall path failed validation.');
        }
        await rm(target, { recursive: true, force: true });
      } else {
        const adapter = adapterFor(record.id);
        if (!adapter.supported || (current.uninstall.kind === 'reviewed-executable' && current.uninstall.adapterId !== adapter.id)) {
          throw new Error('The discovered uninstall entry no longer matches the reviewed adapter.');
        }
        const executable = current.uninstall.kind === 'msi'
          ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', current.uninstall.executable)
          : current.uninstall.executable;
        await access(executable, constants.X_OK);
        const exitCode = await run(executable, current.uninstall.arguments, undefined, 15 * 60_000, 'uninstaller');
        if (exitCode !== 0) throw new Error(`Uninstaller exited with code ${exitCode}.`);
      }
      await this.installed.remove(request.appId);
      result = { ok: true, appId: request.appId, message: `${record.displayName} was uninstalled.` };
    } catch (error) {
      retainOperationLock = operationMustRetainLock(error);
      result = { ok: false, appId: request.appId, message: `${(error as Error).message}${retainOperationLock ? ' This application remains locked until restart.' : ''}` };
    }
    if (!retainOperationLock) this.activeOperations.delete(operationKey);
    return this.finish(record, 'uninstall', result);
  }

  async listInstalled(): Promise<InstalledAppRecord[]> {
    return await this.installed.list(true);
  }
}
