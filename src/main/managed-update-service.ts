import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { app, BrowserWindow } from 'electron';
import semver from 'semver';
import type {
  ManagedUpdateCancelRequest,
  ManagedUpdateRequest,
  ManagedUpdateState,
  OperationResult,
} from '../shared/contracts.js';
import { CatalogService, type CatalogRecord, type ReleaseAsset, type ReleaseRecord } from './catalog-service.js';
import { HistoryService } from './history-service.js';
import { adapterFor, selectInstallerAsset, type ExecutableInstallAdapter, type InstallAdapter, type PortableZipInstallAdapter } from './install-adapters.js';
import { InstalledService } from './installed-service.js';
import { extractZipSafe } from './safe-zip.js';
import { replacePortableDirectory, run } from './operation-service.js';
import { readJson, writeJsonAtomic } from './json-store.js';

const MAX_DOWNLOAD_BYTES = 1_500_000_000;
const MAX_CHECKSUM_BYTES = 128_000;
const MAX_REDIRECTS = 3;
const DOWNLOAD_TIMEOUT_MS = 120_000;
const RELEASE_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);
// The shared run() adapter enforces shell: false and windowsHide: true for every managed installer.

interface VerifiedCandidate {
  record: CatalogRecord;
  release: ReleaseRecord;
  adapter: InstallAdapter;
  asset: ReleaseAsset;
  digest: string;
  installedVersion: string;
  version: string;
  releaseNotesUrl: string;
}

interface PersistedStage {
  schemaVersion: 1;
  appId: string;
  version: string;
  releaseNotesUrl: string;
  assetName: string;
  digest: string;
  bytesTotal: number;
  operationId: string;
}

type ActiveDownload = { controller: AbortController; candidate: VerifiedCandidate; operationId: string };

function isAppId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,127}$/.test(value);
}

function isManagedUpdateRequest(value: unknown): value is ManagedUpdateRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 2 && isAppId(record.appId) && (record.decision === 'download-update' || record.decision === 'restart-to-install');
}

function isManagedUpdateCancelRequest(value: unknown): value is ManagedUpdateCancelRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 2 && isAppId(record.appId) && record.decision === 'cancel-update';
}

function githubDigest(asset: Pick<ReleaseAsset, 'digest'>): string | null {
  const match = asset.digest?.match(/^sha256:([a-f0-9]{64})$/i);
  return match?.[1].toLowerCase() ?? null;
}

function assertReleaseUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || !RELEASE_HOSTS.has(parsed.hostname)) {
    throw new Error(`Blocked release asset origin: ${parsed.origin}`);
  }
  return parsed;
}

function assertReleaseNotesUrl(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || !/^\/Ding-Ding-Projects\/[A-Za-z0-9_.-]+\/releases\/tag\/[0-9A-Za-z.+-]+$/.test(parsed.pathname)) {
    throw new Error('Release notes URL is outside the reviewed public release route.');
  }
  return parsed.toString();
}

function validPersistedStage(stage: PersistedStage): boolean {
  return stage.schemaVersion === 1
    && isAppId(stage.appId)
    && /^[0-9a-f-]{36}$/.test(stage.operationId)
    && stage.assetName === path.basename(stage.assetName)
    && !stage.assetName.includes('\\')
    && !stage.assetName.includes('\0')
    && /^[a-f0-9]{64}$/.test(stage.digest)
    && Number.isInteger(stage.bytesTotal)
    && stage.bytesTotal > 0
    && stage.bytesTotal <= MAX_DOWNLOAD_BYTES
    && Boolean(semver.valid(semver.coerce(stage.version)));
}

async function writeComplete(handle: Awaited<ReturnType<typeof open>>, buffer: Uint8Array): Promise<void> {
  let offset = 0;
  while (offset < buffer.byteLength) {
    const result = await handle.write(buffer, offset, buffer.byteLength - offset);
    if (!result.bytesWritten) throw new Error('Release download could not write the complete response chunk.');
    offset += result.bytesWritten;
  }
}

async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function downloadWithDigest(
  asset: ReleaseAsset,
  destination: string,
  expectedDigest: string,
  signal: AbortSignal,
  maximumBytes = MAX_DOWNLOAD_BYTES,
  onProgress?: (downloaded: number, total: number) => void,
): Promise<void> {
  if (!/^[a-f0-9]{64}$/.test(expectedDigest)) throw new Error('The expected SHA-256 digest is invalid.');
  if (asset.size <= 0 || asset.size > maximumBytes) throw new Error('The release asset size is outside the allowed range.');

  let url = assertReleaseUrl(asset.browser_download_url);
  let response: Response | null = null;
  const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)]);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Ding-Ding-App-Store' }, signal: requestSignal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Release download redirected without a destination.');
      if (redirect === MAX_REDIRECTS) throw new Error('Release download exceeded three redirects.');
      url = assertReleaseUrl(new URL(location, url).toString());
      continue;
    }
    break;
  }
  if (!response?.ok || !response.body) throw new Error(`Release download failed: HTTP ${response?.status ?? 0}`);
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > maximumBytes) throw new Error('Release download exceeded its allowed size.');

  const handle = await open(destination, 'wx', 0o600);
  const hash = createHash('sha256');
  let received = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (signal.aborted) throw new Error('Managed update download cancelled.');
      received += value.byteLength;
      if (received > asset.size || received > maximumBytes) throw new Error('Release download exceeded its declared size.');
      hash.update(value);
      await writeComplete(handle, value);
      onProgress?.(received, asset.size);
    }
  } finally {
    await handle.close();
  }
  if (received !== asset.size) throw new Error(`Release download size mismatch: expected ${asset.size}, received ${received}.`);
  if (hash.digest('hex') !== expectedDigest) throw new Error('Release asset SHA-256 digest mismatch.');
  if ((await stat(destination)).size !== asset.size || await hashFile(destination) !== expectedDigest) throw new Error('Managed update bytes failed the post-close digest check.');
}

function checksumFromCompanion(contents: string, targetName: string): string | null {
  for (const line of contents.replace(/\r/g, '').split('\n')) {
    const match = line.trim().match(/^([a-fA-F0-9]{64})\s+[*]?(.+)$/);
    if (match && match[2].trim() === targetName) return match[1].toLowerCase();
  }
  return null;
}

async function resolveExpectedDigest(release: ReleaseRecord, asset: ReleaseAsset, adapter: InstallAdapter, scratch: string, signal: AbortSignal): Promise<string> {
  const direct = githubDigest(asset);
  if (direct) return direct;
  if (!adapter.supported || !adapter.checksumAssetPattern) throw new Error('This release asset has no GitHub SHA-256 digest or reviewed companion checksum.');
  const candidates = release.assets.filter((candidate) => adapter.checksumAssetPattern?.test(candidate.name));
  if (candidates.length !== 1) throw new Error(`Expected exactly one reviewed checksum asset; found ${candidates.length}.`);
  const checksumDigest = githubDigest(candidates[0]);
  if (!checksumDigest) throw new Error('The companion checksum asset has no GitHub SHA-256 digest.');
  const checksumPath = path.join(scratch, `checksum-${randomUUID()}.txt`);
  await downloadWithDigest(candidates[0], checksumPath, checksumDigest, signal, MAX_CHECKSUM_BYTES);
  try {
    const expected = checksumFromCompanion(await readFile(checksumPath, 'utf8'), asset.name);
    if (!expected) throw new Error('The verified companion checksum does not name the selected installer asset exactly.');
    return expected;
  } finally {
    await rm(checksumPath, { force: true }).catch(() => undefined);
  }
}

function idleState(appId: string, installedVersion: string | null): ManagedUpdateState {
  return { appId, status: 'idle', installedVersion };
}

export class ManagedUpdateService {
  private readonly stagingRoot = path.join(app.getPath('userData'), 'managed-updates');
  private readonly persistedPath = path.join(app.getPath('userData'), 'managed-updates.v1.json');
  private readonly states = new Map<string, ManagedUpdateState>();
  private readonly candidates = new Map<string, VerifiedCandidate>();
  private readonly activeDownloads = new Map<string, ActiveDownload>();
  private readonly stages = new Map<string, PersistedStage>();

  constructor(
    private readonly catalog: CatalogService,
    private readonly installed: InstalledService,
    private readonly history: HistoryService,
    private readonly getWindow: () => BrowserWindow | null,
  ) {}

  async restore(): Promise<void> {
    const persisted = await readJson<PersistedStage[]>(this.persistedPath, []);
    for (const stage of persisted.slice(0, 32)) {
      if (!validPersistedStage(stage)) continue;
      try { assertReleaseNotesUrl(stage.releaseNotesUrl); } catch { continue; }
      const filePath = this.filePath(stage);
      const file = await stat(filePath).catch(() => null);
      if (!file?.isFile() || file.size !== stage.bytesTotal || await hashFile(filePath).catch(() => '') !== stage.digest) {
        await this.removeStage(stage);
        continue;
      }
      const current = await this.installed.get(stage.appId).catch(() => null);
      if (!current || semver.gte(semver.coerce(current.version) ?? '0.0.0', semver.coerce(stage.version) ?? '0.0.0')) {
        await this.removeStage(stage);
        continue;
      }
      this.stages.set(stage.appId, stage);
      this.publish({ appId: stage.appId, status: 'ready', installedVersion: current.version, version: stage.version, releaseNotesUrl: stage.releaseNotesUrl, progress: 100, bytesDownloaded: stage.bytesTotal, bytesTotal: stage.bytesTotal, unsigned: true });
    }
    await this.persistStages();
  }

  current(appId: string): ManagedUpdateState { return this.states.get(appId) ?? idleState(appId, null); }

  /**
   * Refreshes metadata for currently managed installations only.  It never
   * downloads an installer and never invokes an adapter; the scheduler can
   * therefore call this during startup and bounded catalog refreshes.
   */
  async checkAll(): Promise<{ checked: number; available: number; failed: number }> {
    const records = await this.installed.list(true).catch(() => []);
    let available = 0;
    let failed = 0;
    for (const record of records.slice(0, 64)) {
      const state = await this.checkApp(record.appId);
      if (state.status === 'available') available += 1;
      if (state.status === 'failed' || state.status === 'offline') failed += 1;
    }
    return { checked: records.length, available, failed };
  }

  async checkApp(appId: string): Promise<ManagedUpdateState> {
    if (!isAppId(appId)) return this.fail(appId, 'Invalid application identifier.');
    try {
      const record = await this.catalog.recordFor(appId);
      const current = await this.installed.get(appId);
      if (!current) return this.publish(idleState(appId, null));
      const release = await this.catalog.latestRelease(record.repository);
      if (!release || release.draft || release.prerelease) return this.publish({ appId, status: 'idle', installedVersion: current.version, checkedAt: new Date().toISOString() });
      const adapter = adapterFor(record.id);
      if (!adapter.supported) return this.publish({ appId, status: 'offline', installedVersion: current.version, message: adapter.blocker, checkedAt: new Date().toISOString() });
      const asset = selectInstallerAsset(adapter, release.assets);
      const version = release.tag_name;
      const left = semver.coerce(current.version);
      const right = semver.coerce(version);
      if (!left || !right) return this.fail(appId, 'Installed or release version could not be compared safely.', current.version, version, release.html_url);
      const releaseNotesUrl = assertReleaseNotesUrl(release.html_url);
      const candidate: VerifiedCandidate = { record, release, adapter, asset, digest: '', installedVersion: current.version, version, releaseNotesUrl };
      const scratch = path.join(this.stagingRoot, `check-${randomUUID()}`);
      await mkdir(scratch, { recursive: true });
      try { candidate.digest = await resolveExpectedDigest(release, asset, adapter, scratch, AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS)); }
      finally { await rm(scratch, { recursive: true, force: true }).catch(() => undefined); }
      this.candidates.set(appId, candidate);
      if (!semver.gt(right, left)) return this.publish({ appId, status: 'up-to-date', installedVersion: current.version, checkedAt: new Date().toISOString() });
      const staged = this.stages.get(appId);
      if (staged?.version === version) return this.publish({ appId, status: 'ready', installedVersion: current.version, version, releaseNotesUrl: release.html_url, progress: 100, bytesDownloaded: staged.bytesTotal, bytesTotal: staged.bytesTotal, unsigned: true });
      return this.publish({ appId, status: 'available', installedVersion: current.version, version, releaseNotesUrl: release.html_url, unsigned: true });
    } catch (error) {
      return this.fail(appId, (error as Error).message);
    }
  }

  async download(request: unknown): Promise<ManagedUpdateState> {
    if (!isManagedUpdateRequest(request) || request.decision !== 'download-update') return this.fail(isManagedUpdateRequest(request) ? request.appId : 'invalid', 'Invalid managed update download request.');
    const current = this.current(request.appId);
    if (current.status === 'ready') return current;
    if (this.activeDownloads.has(request.appId)) return current;
    const checked = await this.checkApp(request.appId);
    if (checked.status !== 'available') return checked;
    const candidate = this.candidates.get(request.appId);
    if (!candidate) return this.fail(request.appId, 'The stable release candidate was not retained; refresh and try again.');
    const operationId = randomUUID();
    const operationDir = path.join(this.stagingRoot, operationId);
    const stage: PersistedStage = { schemaVersion: 1, appId: request.appId, version: candidate.version, releaseNotesUrl: candidate.releaseNotesUrl, assetName: path.basename(candidate.asset.name), digest: candidate.digest, bytesTotal: candidate.asset.size, operationId };
    const controller = new AbortController();
    this.activeDownloads.set(request.appId, { controller, candidate, operationId });
    this.publish({ appId: request.appId, status: 'downloading', installedVersion: candidate.installedVersion, version: candidate.version, releaseNotesUrl: candidate.releaseNotesUrl, progress: 0, bytesDownloaded: 0, bytesTotal: candidate.asset.size, unsigned: true });
    try {
      await mkdir(operationDir, { recursive: true });
      const temporary = path.join(operationDir, `${stage.assetName}.part`);
      const destination = path.join(operationDir, stage.assetName);
      await downloadWithDigest(candidate.asset, temporary, candidate.digest, controller.signal, MAX_DOWNLOAD_BYTES, (downloaded, total) => {
        const progress = Math.min(99, Math.floor((downloaded / total) * 100));
        this.publish({ appId: request.appId, status: 'downloading', installedVersion: candidate.installedVersion, version: candidate.version, releaseNotesUrl: candidate.releaseNotesUrl, progress, bytesDownloaded: downloaded, bytesTotal: total, unsigned: true });
      });
      await rename(temporary, destination);
      this.stages.set(request.appId, stage);
      await this.persistStages();
      this.publish({ appId: request.appId, status: 'ready', installedVersion: candidate.installedVersion, version: candidate.version, releaseNotesUrl: candidate.releaseNotesUrl, progress: 100, bytesDownloaded: candidate.asset.size, bytesTotal: candidate.asset.size, unsigned: true });
      await this.recordHistory(candidate.record, true, `Downloaded ${candidate.version}; waiting for explicit restart-to-install.`);
      return this.current(request.appId);
    } catch (error) {
      await rm(operationDir, { recursive: true, force: true }).catch(() => undefined);
      const message = (error as Error).message;
      const cancelled = controller.signal.aborted || /cancel/i.test(message);
      const state: ManagedUpdateState = { appId: request.appId, status: cancelled ? 'cancelled' : 'failed', installedVersion: candidate.installedVersion, version: candidate.version, releaseNotesUrl: candidate.releaseNotesUrl, message, checkedAt: new Date().toISOString(), unsigned: true };
      this.publish(state);
      await this.recordHistory(candidate.record, false, message);
      return state;
    } finally {
      this.activeDownloads.delete(request.appId);
    }
  }

  async cancel(request: unknown): Promise<ManagedUpdateState> {
    if (!isManagedUpdateCancelRequest(request)) return this.fail('invalid', 'Invalid managed update cancellation request.');
    const active = this.activeDownloads.get(request.appId);
    if (!active) return this.current(request.appId);
    active.controller.abort();
    return this.current(request.appId);
  }

  async restart(request: unknown): Promise<OperationResult> {
    if (!isManagedUpdateRequest(request) || request.decision !== 'restart-to-install') return { ok: false, appId: 'invalid', message: 'Invalid managed update restart request.' };
    const state = this.current(request.appId);
    if (state.status !== 'ready') return { ok: false, appId: request.appId, message: 'Download and verify the stable update before choosing Restart to install.' };
    const candidate = this.candidates.get(request.appId);
    const stage = this.stages.get(request.appId);
    if (!candidate || !stage) return { ok: false, appId: request.appId, message: 'The staged update is no longer available; download it again.' };
    const filePath = this.filePath(stage);
    if (await hashFile(filePath).catch(() => '') !== stage.digest) {
      await this.removeStage(stage);
      const failed = this.fail(request.appId, 'The staged update changed before installation and was discarded.', state.installedVersion, state.version, state.releaseNotesUrl);
      return { ok: false, appId: request.appId, message: failed.status === 'failed' ? failed.message : 'The staged update changed before installation and was discarded.' };
    }
    this.publish({ appId: request.appId, status: 'installing', installedVersion: candidate.installedVersion, version: candidate.version, releaseNotesUrl: candidate.releaseNotesUrl, unsigned: true });
    let result: OperationResult;
    try {
      if (!candidate.adapter.supported) throw new Error(candidate.adapter.blocker);
      if (candidate.adapter.family === 'portable-zip') {
        await this.installPortable(candidate.record, candidate.adapter, filePath, candidate.version);
      } else {
        const before = await this.installed.registrySnapshot();
        const executable = candidate.adapter.family === 'msi' ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'msiexec.exe') : filePath;
        const args = candidate.adapter.family === 'msi' ? ['/i', filePath, ...candidate.adapter.installArguments] : candidate.adapter.installArguments;
        const exitCode = await run(executable, args, undefined, 15 * 60_000, 'managed update installer');
        if (exitCode !== 0) throw new Error(`Managed update installer exited with code ${exitCode}.`);
        await this.installed.recordInstalledFromRegistry(candidate.record, before, candidate.version);
      }
      await this.removeStage(stage);
      this.publish({ appId: request.appId, status: 'up-to-date', installedVersion: candidate.version, checkedAt: new Date().toISOString() });
      result = { ok: true, appId: request.appId, message: `${candidate.record.displayName} ${candidate.version} installed. The target application may need its own restart to load the new version.` };
      await this.recordHistory(candidate.record, true, result.message);
    } catch (error) {
      result = { ok: false, appId: request.appId, message: `${(error as Error).message} The staged bytes remain available for a reviewed retry.` };
      this.publish({ appId: request.appId, status: 'failed', installedVersion: candidate.installedVersion, version: candidate.version, releaseNotesUrl: candidate.releaseNotesUrl, message: result.message, checkedAt: new Date().toISOString(), unsigned: true });
      await this.recordHistory(candidate.record, false, result.message);
    }
    return result;
  }

  private async installPortable(record: CatalogRecord, adapter: PortableZipInstallAdapter, archivePath: string, version: string): Promise<void> {
    const extracted = path.join(path.dirname(archivePath), 'expanded');
    await extractZipSafe(archivePath, extracted);
    const executable = path.join(extracted, adapter.executableRelativePath);
    const executableStat = await stat(executable).catch(() => null);
    if (!executableStat?.isFile() || executableStat.size <= 0) throw new Error(`Portable update archive is missing ${adapter.executableRelativePath}.`);
    await mkdir(this.installed.managedPortableRoot, { recursive: true });
    const target = path.join(this.installed.managedPortableRoot, record.id);
    const backup = path.join(this.installed.managedPortableRoot, `${record.id}.update-backup-${randomUUID()}`);
    await replacePortableDirectory(extracted, target, backup, async () => {
      await this.installed.record({ appId: record.id, displayName: record.displayName, version, packageType: 'archive', source: 'portable-managed', installRoot: target, uninstall: { kind: 'portable', executable: null, arguments: [] }, ownership: { kind: 'portable', adapterId: adapter.id, installRoot: target }, installedAt: new Date().toISOString(), detectedAt: new Date().toISOString() });
    });
  }

  private filePath(stage: PersistedStage): string { return path.join(this.stagingRoot, stage.operationId, stage.assetName); }

  private async removeStage(stage: PersistedStage): Promise<void> {
    this.stages.delete(stage.appId);
    await rm(path.join(this.stagingRoot, stage.operationId), { recursive: true, force: true }).catch(() => undefined);
    await this.persistStages();
  }

  private async persistStages(): Promise<void> {
    await writeJsonAtomic(this.persistedPath, [...this.stages.values()].slice(0, 32));
  }

  private async recordHistory(record: CatalogRecord, ok: boolean, message: string): Promise<void> {
    await this.history.record({ appId: record.id, displayName: record.displayName, kind: 'update', ok, message }).catch(() => undefined);
  }

  private fail(appId: string, message: string, installedVersion: string | null = null, version?: string, releaseNotesUrl?: string): ManagedUpdateState {
    const state: ManagedUpdateState = { appId, status: 'failed', installedVersion, ...(version ? { version } : {}), ...(releaseNotesUrl ? { releaseNotesUrl } : {}), message, checkedAt: new Date().toISOString() };
    return this.publish(state);
  }

  private publish(state: ManagedUpdateState): ManagedUpdateState {
    this.states.set(state.appId, state);
    const window = this.getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('updates:app-state', state);
    return state;
  }
}

export const managedUpdateInternals = { githubDigest, assertReleaseUrl, isManagedUpdateRequest, isManagedUpdateCancelRequest, checksumFromCompanion };
