import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, lstat, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type { AppLaunchRequest, InstalledAppRecord, OperationResult } from '../shared/contracts.js';
import { installationManagementState } from '../shared/contracts.js';
import { CatalogService, proofStatusAllowsPrivilegedAction, proofStatusBlockMessage } from './catalog-service.js';
import { HistoryService } from './history-service.js';
import { adapterFor, type ExecutableInstallAdapter, type PortableZipInstallAdapter } from './install-adapters.js';
import { InstalledService } from './installed-service.js';

const LAUNCH_CONFIRM_TIMEOUT_MS = 2_000;

interface LaunchTarget {
  executable: string;
  workingDirectory: string;
}

interface LaunchFileSystem {
  access(target: string, mode: number): Promise<void>;
  lstat(target: string): Promise<{ isFile(): boolean; isSymbolicLink(): boolean; size: number }>;
  realpath(target: string): Promise<string>;
  stat(target: string): Promise<{ isFile(): boolean; size: number }>;
}

const launchFileSystem: LaunchFileSystem = { access, lstat, realpath, stat };

function isAppLaunchRequest(value: unknown): value is AppLaunchRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  return Object.keys(request).length === 2
    && typeof request.appId === 'string'
    && /^[a-z0-9][a-z0-9-]{0,127}$/.test(request.appId)
    && request.decision === 'launch';
}

function pathIsInside(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function assertNoLinkedPath(root: string, target: string, fileSystem: LaunchFileSystem): Promise<void> {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('The reviewed launch target escaped its owned installation root.');
  }
  let cursor = path.resolve(root);
  for (const segment of ['', ...relative.split(path.sep)]) {
    if (segment) cursor = path.join(cursor, segment);
    const entry = await fileSystem.lstat(cursor).catch(() => null);
    if (!entry) throw new Error('The reviewed launch target is missing.');
    if (entry.isSymbolicLink()) throw new Error('The reviewed launch target contains a symbolic link or junction.');
  }
}

async function validateLaunchTarget(root: string, candidate: string, allowedBasenames: readonly string[], fileSystem: LaunchFileSystem = launchFileSystem): Promise<LaunchTarget> {
  const expected = new Set(allowedBasenames.map((name) => name.toLocaleLowerCase()));
  if (!expected.has(path.basename(candidate).toLocaleLowerCase()) || !pathIsInside(candidate, root)) {
    throw new Error('The installed executable did not match the reviewed launch identity.');
  }
  await assertNoLinkedPath(root, candidate, fileSystem);
  const [resolvedRoot, resolvedTarget] = await Promise.all([fileSystem.realpath(root), fileSystem.realpath(candidate)]);
  if (!pathIsInside(resolvedTarget, resolvedRoot)) throw new Error('The reviewed launch target escaped its resolved installation root.');
  const targetStat = await fileSystem.stat(resolvedTarget);
  if (!targetStat.isFile() || targetStat.size <= 0) throw new Error('The reviewed launch target is not a non-empty regular file.');
  await fileSystem.access(resolvedTarget, constants.X_OK);
  return { executable: resolvedTarget, workingDirectory: path.dirname(resolvedTarget) };
}

async function resolvePortableTarget(installedService: InstalledService, installed: InstalledAppRecord, adapter: PortableZipInstallAdapter, fileSystem: LaunchFileSystem): Promise<LaunchTarget> {
  const expectedRoot = path.join(installedService.managedPortableRoot, installed.appId);
  if (!installed.installRoot || path.resolve(installed.installRoot).toLocaleLowerCase() !== path.resolve(expectedRoot).toLocaleLowerCase()) {
    throw new Error('The managed portable installation root no longer matches its owned adapter path.');
  }
  const candidate = path.join(expectedRoot, adapter.executableRelativePath);
  return await validateLaunchTarget(expectedRoot, candidate, [path.basename(adapter.executableRelativePath)], fileSystem);
}

async function resolveRegistryTarget(installed: InstalledAppRecord, adapter: ExecutableInstallAdapter, fileSystem: LaunchFileSystem): Promise<LaunchTarget> {
  const names = adapter.launchExecutableNames ?? [];
  const relativePaths = adapter.launchExecutableRelativePaths ?? [];
  if (!names.length && !relativePaths.length) throw new Error('This adapter has no reviewed installed executable identity for launch.');
  if (!installed.installRoot) throw new Error('The owned installation has no reviewed launch root.');
  let targetRoot = path.resolve(installed.installRoot);
  if (adapter.family === 'squirrel') {
    if (!/^[0-9A-Za-z.+-]{1,96}$/.test(installed.version)) throw new Error('The installed Squirrel version cannot select a reviewed application directory.');
    targetRoot = path.join(targetRoot, `app-${installed.version}`);
  }
  const reviewedPaths = [...names, ...relativePaths.map((relative) => relative.replaceAll('/', path.sep))];
  const candidates: string[] = [];
  for (const relative of reviewedPaths) {
    const candidate = path.join(targetRoot, relative);
    const candidateStat = await fileSystem.stat(candidate).catch(() => null);
    if (candidateStat?.isFile() && candidateStat.size > 0) candidates.push(candidate);
  }
  if (candidates.length !== 1) throw new Error(`Expected exactly one reviewed installed executable for launch; found ${candidates.length}.`);
  return await validateLaunchTarget(targetRoot, candidates[0], reviewedPaths.map((relative) => path.basename(relative)), fileSystem);
}

async function resolveLaunchTarget(installedService: InstalledService, installed: InstalledAppRecord, fileSystem: LaunchFileSystem = launchFileSystem): Promise<LaunchTarget> {
  if (installationManagementState(installed) !== 'store-managed' || !installed.ownership) {
    throw new Error('Only an App Store-managed installation can be launched.');
  }
  const adapter = adapterFor(installed.appId);
  if (!adapter.supported || installed.ownership.adapterId !== adapter.id) {
    throw new Error('The installed ownership record no longer matches the reviewed adapter.');
  }
  return adapter.family === 'portable-zip'
    ? await resolvePortableTarget(installedService, installed, adapter, fileSystem)
    : await resolveRegistryTarget(installed, adapter, fileSystem);
}

type LaunchSpawn = typeof spawn;

async function startDetached(executable: string, workingDirectory: string, spawnProcess: LaunchSpawn = spawn, timeoutMs = LAUNCH_CONFIRM_TIMEOUT_MS): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawnProcess(executable, [], {
        cwd: workingDirectory,
        shell: false,
        windowsHide: true,
        detached: true,
        stdio: 'ignore',
      });
    } catch (error) {
      reject(error);
      return;
    }
    child.unref();
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => finish(() => reject(new Error('Windows did not confirm the process start within two seconds; the application may still have started.'))), timeoutMs);
    child.once('spawn', () => finish(resolve));
    child.once('error', (error) => finish(() => reject(error)));
  });
}

function safeLaunchFailure(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9_]{1,32}$/.test(error.code)
    ? ` (${error.code})`
    : '';
  if (error instanceof Error && error.message.startsWith('Windows did not confirm')) return error.message;
  if (error instanceof Error && /^(Only|This|The|Expected)/.test(error.message) && !/[A-Z]:\\|\\\\/.test(error.message)) return error.message;
  return `Windows did not accept the reviewed application start request${code}.`;
}

export class AppLaunchService {
  constructor(
    private readonly catalog: CatalogService,
    private readonly installed: InstalledService,
    private readonly history: HistoryService,
    private readonly operationBusy: (appId: string) => boolean = () => false,
    private readonly launchProcess: (executable: string, workingDirectory: string) => Promise<void> = startDetached,
  ) {}

  async launch(request: unknown): Promise<OperationResult> {
    if (!isAppLaunchRequest(request)) return { ok: false, appId: 'invalid', message: 'Invalid launch request. Only a catalog application ID and matching user decision are accepted.' };
    const record = await this.catalog.recordFor(request.appId);
    if (!proofStatusAllowsPrivilegedAction(record.proofStatus)) return { ok: false, appId: record.id, message: proofStatusBlockMessage(record) };
    if (this.operationBusy(record.id)) return { ok: false, appId: record.id, message: `${record.displayName} already has an install, update, uninstall, or launch operation in progress.` };
    let result: OperationResult;
    try {
      const installed = await this.installed.get(record.id);
      if (!installed) throw new Error('Only an App Store-managed installation can be launched.');
      const target = await resolveLaunchTarget(this.installed, installed);
      await this.launchProcess(target.executable, target.workingDirectory);
      result = { ok: true, appId: record.id, message: `${record.displayName} start request was accepted. Application-window readiness is not yet proven.` };
    } catch (error) {
      result = { ok: false, appId: record.id, message: safeLaunchFailure(error) };
    }
    await this.history.record({ appId: record.id, displayName: record.displayName, kind: 'launch', ok: result.ok, message: result.message }).catch(() => undefined);
    return result;
  }
}

export const appLaunchInternals = {
  isAppLaunchRequest,
  pathIsInside,
  validateLaunchTarget,
  resolveLaunchTarget,
  startDetached,
  safeLaunchFailure,
};
