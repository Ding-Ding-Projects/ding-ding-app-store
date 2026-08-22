import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, open, readFile, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { app, BrowserWindow } from 'electron';
import semver from 'semver';
import type {
  ManagedUpdateCancelRequest,
  ManagedUpdateRequest,
  ManagedUpdateState,
  OperationResult,
} from '../shared/contracts.js';
import { CatalogService, proofStatusAllowsPrivilegedAction, proofStatusBlockMessage, type CatalogRecord, type ReleaseAsset, type ReleaseRecord } from './catalog-service.js';
import { HistoryService } from './history-service.js';
import { adapterFor, selectInstallerAsset, type ExecutableInstallAdapter, type InstallAdapter, type PortableZipInstallAdapter } from './install-adapters.js';
import { InstalledService } from './installed-service.js';
import { archiveFilesystem, extractZipSafe } from './safe-zip.js';
import { replacePortableDirectory, run } from './operation-service.js';
import { readJson, writeJsonAtomic } from './json-store.js';
import { AppOperationCoordinator } from './app-operation-coordinator.js';

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
  schemaVersion: 2;
  appId: string;
  version: string;
  /** The exact published release page URL used to choose this stage. */
  releaseUrl: string;
  releaseNotesUrl: string;
  /** The exact immutable asset URL, not merely its basename. */
  assetUrl: string;
  assetName: string;
  digest: string;
  bytesTotal: number;
  repository: string;
  adapterId: string;
  operationId: string;
}

type ActiveDownload = { controller: AbortController; candidate: VerifiedCandidate; operationId: string };

function isAppId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,127}$/.test(value);
}

function isManagedUpdateRequest(value: unknown): value is ManagedUpdateRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 2 && isAppId(record.appId) && (record.decision === 'download-update' || record.decision === 'install-update');
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
  return stage.schemaVersion === 2
    && isAppId(stage.appId)
    && /^[0-9a-f-]{36}$/.test(stage.operationId)
    && stage.assetName === path.basename(stage.assetName)
    && !stage.assetName.includes('\\')
    && !stage.assetName.includes('\0')
    && /^[A-Za-z0-9_.-]{1,100}$/.test(stage.repository)
    && /^[a-z0-9][a-z0-9-]{1,127}-[a-z0-9-]{1,127}$/.test(stage.adapterId)
    && typeof stage.releaseUrl === 'string'
    && typeof stage.releaseNotesUrl === 'string'
    && typeof stage.assetUrl === 'string'
    && stage.releaseUrl === stage.releaseNotesUrl
    && /^[a-f0-9]{64}$/.test(stage.digest)
    && Number.isInteger(stage.bytesTotal)
    && stage.bytesTotal > 0
    && stage.bytesTotal <= MAX_DOWNLOAD_BYTES
    && Boolean(semver.valid(semver.coerce(stage.version)));
}

export interface ManagedUpdateErrorMessages { message: string; messageYue: string; }

type ManagedUpdateStepCode = 'EUPDATE_EXTRACT' | 'EUPDATE_REPLACE' | 'EUPDATE_RECORD' | 'EUPDATE_STAGE_CLEANUP' | 'EUPDATE_ROLLBACK_INCOMPLETE';

const EXTRACTION_CLEANUP_RETRY_DELAYS_MS = [25, 50, 100, 200, 400, 800] as const;

type RemoveDirectory = (target: string, options: { recursive: true; force: true }) => Promise<void>;
type InspectPath = (target: string) => Promise<unknown>;
type Wait = (milliseconds: number) => Promise<unknown>;

function errorCode(error: unknown): string | null {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : null;
}

function transientCleanupError(error: unknown): boolean {
  return ['EACCES', 'EBUSY', 'ENOTEMPTY', 'EPERM'].includes(errorCode(error) ?? '');
}

/** Remove only the owned extraction tree, retrying brief scanner/indexer locks before extraction. */
async function removeExtractionOutput(
  target: string,
  removeDirectory: RemoveDirectory = archiveFilesystem.promises.rm,
  inspectPath: InspectPath = archiveFilesystem.promises.lstat,
  wait: Wait = delay,
): Promise<void> {
  for (const pause of [0, ...EXTRACTION_CLEANUP_RETRY_DELAYS_MS]) {
    if (pause) await wait(pause);
    try {
      await removeDirectory(target, { recursive: true, force: true });
      try {
        await inspectPath(target);
        throw Object.assign(new Error('Managed update extraction output remains after cleanup.'), { code: 'ENOTEMPTY' });
      } catch (error) {
        if (errorCode(error) === 'ENOENT') return;
        throw error;
      }
    } catch (error) {
      if (!transientCleanupError(error) || pause === EXTRACTION_CLEANUP_RETRY_DELAYS_MS.at(-1)) throw error;
    }
  }
}

function managedUpdateStepError(code: ManagedUpdateStepCode, error: unknown): Error {
  const nativeCode = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string' && /^[A-Z0-9_]{1,32}$/.test(error.code)
    ? `:${error.code}`
    : '';
  return Object.assign(new Error(`${code}${nativeCode}`), { code });
}

/** Convert arbitrary transport/installer exceptions into bounded, path-free UI copy. */
export function classifyManagedUpdateError(error: unknown): ManagedUpdateErrorMessages {
  const raw = error instanceof Error ? error.message : '';
  let message = 'The managed update could not complete. No update was installed.';
  let messageYue = '管理更新未能完成，今次冇安裝到更新。';
  if (/EUPDATE_ROLLBACK_INCOMPLETE/.test(raw)) {
    message = 'The managed update failed and recovery could not be proven (EUPDATE_ROLLBACK_INCOMPLETE). Refresh the installed state before launching or retrying.';
    messageYue = '管理更新失敗，而且未能證實已完整還原（EUPDATE_ROLLBACK_INCOMPLETE）；啟動或重試前請先重新整理已安裝狀態。';
  } else if (/EUPDATE_EXTRACT/.test(raw)) {
    message = 'The verified update archive could not be extracted (EUPDATE_EXTRACT). No update was installed.';
    messageYue = '已驗證更新壓縮檔未能解壓（EUPDATE_EXTRACT），今次冇安裝到更新。';
  } else if (/EUPDATE_REPLACE/.test(raw)) {
    message = 'The managed application directory could not be replaced (EUPDATE_REPLACE). The previous version remains in place.';
    messageYue = '未能替換受管應用程式目錄（EUPDATE_REPLACE），舊版本仍然保留。';
  } else if (/EUPDATE_RECORD/.test(raw)) {
    message = 'The updated installation could not be recorded (EUPDATE_RECORD). The previous version was restored.';
    messageYue = '未能記錄更新後嘅安裝（EUPDATE_RECORD），已還原舊版本。';
  } else if (/EUPDATE_STAGE_CLEANUP/.test(raw)) {
    message = 'The update installed, but its staged record could not be cleared (EUPDATE_STAGE_CLEANUP). Refresh before another action.';
    messageYue = '更新已安裝，但未能清除暫存記錄（EUPDATE_STAGE_CLEANUP）；做其他操作前請先重新整理。';
  } else if (/cancel/i.test(raw)) {
    message = 'The managed update was cancelled. No update was installed.';
    messageYue = '管理更新已取消，今次冇安裝到更新。';
  } else if (/digest|checksum|integrity/i.test(raw)) {
    message = 'The managed update failed its integrity check. The staged bytes were discarded.';
    messageYue = '管理更新完整性檢查唔通，已丟棄暫存檔案。';
  } else if (/size mismatch|exceeded its allowed|exceeded its declared|maximum/i.test(raw)) {
    message = 'The managed update exceeded its verified size limit. No update was installed.';
    messageYue = '管理更新超出已驗證大小限制，今次冇安裝到更新。';
  } else if (/HTTP\s+[0-9]{3}|fetch failed|offline|network|redirect/i.test(raw)) {
    message = 'The managed update could not be downloaded from its reviewed release. Check the connection and retry.';
    messageYue = '管理更新未能由已審核發佈下載，請檢查連線後再試。';
  } else if (/installer exited|uninstaller exited|installer.*started|process tree/i.test(raw)) {
    message = 'The managed installer did not complete with a verified result. Do not retry automatically.';
    messageYue = '管理安裝程式未能交付已驗證結果，唔好自動重試。';
  } else if (/staged update.*discarded|staged bytes/i.test(raw)) {
    message = 'The staged update no longer matches its reviewed release and was discarded.';
    messageYue = '暫存更新同已審核發佈唔再相符，已丟棄。';
  } else if (/not available|not detected|not found|allowlisted|reviewed adapter/i.test(raw)) {
    message = 'The reviewed managed update is no longer available for this installation.';
    messageYue = '呢個安裝嘅已審核管理更新已經唔再可用。';
  }
  return { message, messageYue };
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

async function extractManagedUpdateArchive(archivePath: string, extracted: string): Promise<void> {
  // A failed extraction is retryable only when the caller does not leave its
  // exclusive-create destination half populated. Both paths are app-owned.
  try {
    await removeExtractionOutput(extracted);
    await extractZipSafe(archivePath, extracted);
  } catch (error) {
    await removeExtractionOutput(extracted).catch(() => undefined);
    throw managedUpdateStepError('EUPDATE_EXTRACT', error);
  }
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
  private readonly checkGenerations = new Map<string, number>();

  constructor(
    private readonly catalog: CatalogService,
    private readonly installed: InstalledService,
    private readonly history: HistoryService,
    private readonly getWindow: () => BrowserWindow | null,
    private readonly conflictingOperation: (appId: string) => boolean = () => false,
    private readonly coordinator: AppOperationCoordinator = new AppOperationCoordinator(),
  ) {}

  private beginCheck(appId: string): number {
    const generation = (this.checkGenerations.get(appId) ?? 0) + 1;
    this.checkGenerations.set(appId, generation);
    return generation;
  }

  private isCurrentCheck(appId: string, generation: number): boolean {
    return this.checkGenerations.get(appId) === generation;
  }

  private publishCheck(appId: string, generation: number, state: ManagedUpdateState): ManagedUpdateState {
    return this.isCurrentCheck(appId, generation) ? this.publish(state) : this.current(appId);
  }

  private stageMatchesCandidate(stage: PersistedStage, candidate: VerifiedCandidate): boolean {
    return stage.appId === candidate.record.id
      && stage.version === candidate.version
      && stage.releaseUrl === candidate.releaseNotesUrl
      && stage.releaseNotesUrl === candidate.releaseNotesUrl
      && stage.assetUrl === candidate.asset.browser_download_url
      && stage.assetName === path.basename(candidate.asset.name)
      && stage.bytesTotal === candidate.asset.size
      && stage.digest === candidate.digest
      && stage.repository === candidate.record.repository
      && stage.adapterId === candidate.adapter.id;
  }

  private candidateFromStage(stage: PersistedStage, record: CatalogRecord, adapter: InstallAdapter): VerifiedCandidate {
    if (record.repository !== stage.repository || adapter.id !== stage.adapterId || !adapter.supported) throw new Error('The staged update no longer matches a reviewed local catalog adapter.');
    const releaseNotesUrl = assertReleaseNotesUrl(stage.releaseUrl);
    const assetUrl = assertReleaseUrl(stage.assetUrl).toString();
    const asset: ReleaseAsset = { name: stage.assetName, browser_download_url: assetUrl, size: stage.bytesTotal, digest: `sha256:${stage.digest}` };
    return {
      record,
      adapter,
      asset,
      digest: stage.digest,
      installedVersion: 'unknown',
      version: stage.version,
      releaseNotesUrl,
      release: { tag_name: stage.version, html_url: releaseNotesUrl, draft: false, prerelease: false, assets: [asset] },
    };
  }

  async restore(): Promise<void> {
    const persisted = await readJson<PersistedStage[]>(this.persistedPath, []);
    for (const stage of persisted.slice(0, 32)) {
      if (!validPersistedStage(stage)) continue;
      try { assertReleaseNotesUrl(stage.releaseUrl); assertReleaseUrl(stage.assetUrl); } catch { continue; }
      const filePath = this.filePath(stage);
      const file = await stat(filePath).catch(() => null);
      if (!file?.isFile() || file.size !== stage.bytesTotal || await hashFile(filePath).catch(() => '') !== stage.digest) {
        await this.removeStage(stage);
        continue;
      }
      const current = (await this.installed.list(false).catch(() => [])).find((item) => item.appId === stage.appId) ?? null;
      if (!current || semver.gte(semver.coerce(current.version) ?? '0.0.0', semver.coerce(stage.version) ?? '0.0.0')) {
        await this.removeStage(stage);
        continue;
      }
      const record = await this.catalog.recordFor(stage.appId).catch(() => null);
      if (!record) { await this.removeStage(stage); continue; }
      const adapter = (() => { try { return adapterFor(record.id); } catch { return null; } })();
      if (!adapter || !adapter.supported) { await this.removeStage(stage); continue; }
      let candidate: VerifiedCandidate;
      try { candidate = this.candidateFromStage(stage, record, adapter); }
      catch { await this.removeStage(stage); continue; }
      candidate.installedVersion = current.version;
      this.candidates.set(stage.appId, candidate);
      this.stages.set(stage.appId, stage);
      this.publish({ appId: stage.appId, status: 'ready', installedVersion: current.version, version: stage.version, releaseNotesUrl: stage.releaseUrl, progress: 100, bytesDownloaded: stage.bytesTotal, bytesTotal: stage.bytesTotal, unsigned: true });
    }
    await this.persistStages();
  }

  current(appId: string): ManagedUpdateState { return this.states.get(appId) ?? idleState(appId, null); }

  isBusy(appId: string): boolean {
    return this.activeDownloads.has(appId) || this.current(appId).status === 'installing';
  }

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
    const generation = this.beginCheck(appId);
    try {
      const record = await this.catalog.recordFor(appId);
      if (!this.isCurrentCheck(appId, generation)) return this.current(appId);
      if (!proofStatusAllowsPrivilegedAction(record.proofStatus)) return this.publishCheck(appId, generation, { appId, status: 'blocked', installedVersion: null, message: proofStatusBlockMessage(record), messageYue: `${record.displayName} 未有已驗證嘅生命週期證據，更新操作保持封鎖。`, checkedAt: new Date().toISOString() });
      const current = await this.installed.get(appId);
      if (!this.isCurrentCheck(appId, generation)) return this.current(appId);
      if (!current) return this.publishCheck(appId, generation, idleState(appId, null));
      const release = await this.catalog.latestRelease(record.repository);
      if (!this.isCurrentCheck(appId, generation)) return this.current(appId);
      if (!release || release.draft || release.prerelease) return this.publishCheck(appId, generation, { appId, status: 'idle', installedVersion: current.version, checkedAt: new Date().toISOString() });
      const adapter = adapterFor(record.id);
      if (!adapter.supported) return this.publishCheck(appId, generation, { appId, status: 'offline', installedVersion: current.version, message: adapter.blocker, messageYue: `${record.displayName} 暫時冇已審核嘅管理更新路線。`, checkedAt: new Date().toISOString() });
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
      if (!this.isCurrentCheck(appId, generation)) return this.current(appId);
      this.candidates.set(appId, candidate);
      if (!semver.gt(right, left)) return this.publishCheck(appId, generation, { appId, status: 'up-to-date', installedVersion: current.version, checkedAt: new Date().toISOString() });
      const staged = this.stages.get(appId);
      if (staged) {
        if (this.stageMatchesCandidate(staged, candidate)) return this.publishCheck(appId, generation, { appId, status: 'ready', installedVersion: current.version, version, releaseNotesUrl: releaseNotesUrl, progress: 100, bytesDownloaded: staged.bytesTotal, bytesTotal: staged.bytesTotal, unsigned: true });
        await this.removeStage(staged);
      }
      return this.publishCheck(appId, generation, { appId, status: 'available', installedVersion: current.version, version, releaseNotesUrl, unsigned: true });
    } catch (error) {
      if (!this.isCurrentCheck(appId, generation)) return this.current(appId);
      const classified = classifyManagedUpdateError(error);
      return this.publish({ appId, status: 'failed', installedVersion: null, message: classified.message, messageYue: classified.messageYue, checkedAt: new Date().toISOString() });
    }
  }

  async download(request: unknown): Promise<ManagedUpdateState> {
    if (!isManagedUpdateRequest(request) || request.decision !== 'download-update') return this.fail(isManagedUpdateRequest(request) ? request.appId : 'invalid', 'Invalid managed update download request.');
    const lease = this.coordinator.acquire(request.appId, 'update');
    if (!lease) return this.fail(request.appId, 'This application already has an install, update, uninstall, or launch operation in progress.');
    let record;
    try { record = await this.catalog.recordFor(request.appId); }
    catch (error) { lease.release(); throw error; }
    if (!proofStatusAllowsPrivilegedAction(record.proofStatus)) {
      lease.release();
      return this.publish({ appId: request.appId, status: 'blocked', installedVersion: null, message: proofStatusBlockMessage(record), messageYue: `${record.displayName} 未有已驗證嘅生命週期證據，更新操作保持封鎖。`, checkedAt: new Date().toISOString() });
    }
    const current = this.current(request.appId);
    if (current.status === 'ready') { lease.release(); return current; }
    if (this.activeDownloads.has(request.appId)) { lease.release(); return current; }
    let checked: ManagedUpdateState;
    try { checked = await this.checkApp(request.appId); }
    catch (error) { lease.release(); throw error; }
    if (checked.status !== 'available') { lease.release(); return checked; }
    const candidate = this.candidates.get(request.appId);
    if (!candidate) { lease.release(); return this.fail(request.appId, 'The stable release candidate was not retained; refresh and try again.'); }
    const operationId = randomUUID();
    const operationDir = path.join(this.stagingRoot, operationId);
    const stage: PersistedStage = { schemaVersion: 2, appId: request.appId, version: candidate.version, releaseUrl: candidate.releaseNotesUrl, releaseNotesUrl: candidate.releaseNotesUrl, assetUrl: candidate.asset.browser_download_url, assetName: path.basename(candidate.asset.name), digest: candidate.digest, bytesTotal: candidate.asset.size, repository: candidate.record.repository, adapterId: candidate.adapter.id, operationId };
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
      await this.recordHistory(candidate.record, true, `Downloaded ${candidate.version}; waiting for explicit install-update decision.`, `已下載 ${candidate.version}；等候明確嘅安裝更新決定。`);
      return this.current(request.appId);
    } catch (error) {
      await rm(operationDir, { recursive: true, force: true }).catch(() => undefined);
      const rawMessage = error instanceof Error ? error.message : '';
      const classified = classifyManagedUpdateError(error);
      const cancelled = controller.signal.aborted || /cancel/i.test(rawMessage);
      const state: ManagedUpdateState = { appId: request.appId, status: cancelled ? 'cancelled' : 'failed', installedVersion: candidate.installedVersion, version: candidate.version, releaseNotesUrl: candidate.releaseNotesUrl, message: classified.message, messageYue: classified.messageYue, checkedAt: new Date().toISOString(), unsigned: true };
      this.publish(state);
      await this.recordHistory(candidate.record, false, classified.message, classified.messageYue);
      return state;
    } finally {
      this.activeDownloads.delete(request.appId);
      lease.release();
    }
  }

  async cancel(request: unknown): Promise<ManagedUpdateState> {
    if (!isManagedUpdateCancelRequest(request)) return this.fail('invalid', 'Invalid managed update cancellation request.');
    const active = this.activeDownloads.get(request.appId);
    if (!active) return this.current(request.appId);
    active.controller.abort();
    return this.current(request.appId);
  }

  async install(request: unknown): Promise<OperationResult> {
    if (!isManagedUpdateRequest(request) || request.decision !== 'install-update') return { ok: false, appId: 'invalid', message: 'Invalid managed update install request.' };
    const lease = this.coordinator.acquire(request.appId, 'update');
    if (!lease) return { ok: false, appId: request.appId, message: 'This application already has an install, update, uninstall, or launch operation in progress.', messageYue: '呢個 app 已經有安裝、更新、卸載或者啟動操作進行緊。' };
    let record;
    try { record = await this.catalog.recordFor(request.appId); }
    catch (error) { lease.release(); throw error; }
    if (!proofStatusAllowsPrivilegedAction(record.proofStatus)) { lease.release(); return { ok: false, appId: request.appId, message: proofStatusBlockMessage(record) }; }
    if (this.conflictingOperation(request.appId)) { lease.release(); return { ok: false, appId: request.appId, message: `${record.displayName} already has an install, launch, or uninstall operation in progress.` }; }
    const state = this.current(request.appId);
    if (state.status !== 'ready') { lease.release(); return { ok: false, appId: request.appId, message: 'Download and verify the stable update before choosing Install update.', messageYue: '請先下載並驗證穩定更新，再選擇安裝更新。' }; }
    const candidate = this.candidates.get(request.appId);
    const stage = this.stages.get(request.appId);
    if (!candidate || !stage) { lease.release(); return { ok: false, appId: request.appId, message: 'The staged update is no longer available; download it again.', messageYue: '暫存更新已經唔再可用，請重新下載。' }; }
    if (!this.stageMatchesCandidate(stage, candidate)) {
      try { await this.removeStage(stage); }
      catch (error) { lease.release(); throw error; }
      lease.release();
      return { ok: false, appId: request.appId, message: 'The staged update no longer matches its reviewed release and was discarded.', messageYue: '暫存更新同已審核發佈唔再相符，已丟棄。' };
    }
    const filePath = this.filePath(stage);
    if (await hashFile(filePath).catch(() => '') !== stage.digest) {
      try { await this.removeStage(stage); }
      catch (error) { lease.release(); throw error; }
      lease.release();
      const failed = this.fail(request.appId, 'The staged update changed before installation and was discarded.', state.installedVersion, state.version, state.releaseNotesUrl);
      return { ok: false, appId: request.appId, message: failed.status === 'failed' ? failed.message : 'The staged update changed before installation and was discarded.', messageYue: '暫存更新安裝前有變更，已丟棄。' };
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
      try { await this.removeStage(stage); }
      catch (error) { throw managedUpdateStepError('EUPDATE_STAGE_CLEANUP', error); }
      this.publish({ appId: request.appId, status: 'up-to-date', installedVersion: candidate.version, checkedAt: new Date().toISOString() });
      result = { ok: true, appId: request.appId, message: `${candidate.record.displayName} ${candidate.version} installed. The target application may need its own restart to load the new version.`, messageYue: `${candidate.record.displayName} ${candidate.version} 已安裝；目標應用程式可能要自行重新啟動先載入新版本。` };
      await this.recordHistory(candidate.record, true, result.message, result.messageYue);
    } catch (error) {
      const classified = classifyManagedUpdateError(error);
      const retained = /termination|still be running|unknown/i.test(error instanceof Error ? error.message : '');
      result = { ok: false, appId: request.appId, message: `${classified.message}${retained ? ' This application remains locked until restart.' : ' The staged bytes remain available for a reviewed retry.'}`, messageYue: `${classified.messageYue}${retained ? ' 呢個 app 會保持鎖定直到重啟。' : ' 暫存檔案會保留，方便審核後再試。'}` };
      this.publish({ appId: request.appId, status: 'failed', installedVersion: candidate.installedVersion, version: candidate.version, releaseNotesUrl: candidate.releaseNotesUrl, message: classified.message, messageYue: classified.messageYue, checkedAt: new Date().toISOString(), unsigned: true });
      await this.recordHistory(candidate.record, false, classified.message, classified.messageYue);
      if (retained) lease.retain();
    }
    if (!this.coordinator.isRetained(request.appId)) lease.release();
    return result;
  }

  private async installPortable(record: CatalogRecord, adapter: PortableZipInstallAdapter, archivePath: string, version: string): Promise<void> {
    const extracted = path.join(path.dirname(archivePath), 'expanded');
    await extractManagedUpdateArchive(archivePath, extracted);
    const executable = path.join(extracted, adapter.executableRelativePath);
    const executableStat = await stat(executable).catch(() => null);
    if (!executableStat?.isFile() || executableStat.size <= 0) throw new Error(`Portable update archive is missing ${adapter.executableRelativePath}.`);
    await mkdir(this.installed.managedPortableRoot, { recursive: true });
    const target = path.join(this.installed.managedPortableRoot, record.id);
    const backup = path.join(this.installed.managedPortableRoot, `${record.id}.update-backup-${randomUUID()}`);
    try {
      await replacePortableDirectory(extracted, target, backup, async () => {
        try {
          await this.installed.record({ appId: record.id, displayName: record.displayName, version, packageType: 'archive', source: 'portable-managed', installRoot: target, uninstall: { kind: 'portable', executable: null, arguments: [] }, ownership: { kind: 'portable', adapterId: adapter.id, installRoot: target }, installedAt: new Date().toISOString(), detectedAt: new Date().toISOString() });
        } catch (error) {
          throw managedUpdateStepError('EUPDATE_RECORD', error);
        }
      });
    } catch (error) {
      if (error instanceof Error && /Rollback incomplete/.test(error.message)) {
        throw managedUpdateStepError('EUPDATE_ROLLBACK_INCOMPLETE', error);
      }
      if (error instanceof Error && /EUPDATE_RECORD/.test(error.message)) throw error;
      throw managedUpdateStepError('EUPDATE_REPLACE', error);
    }
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

  private async recordHistory(record: CatalogRecord, ok: boolean, message: string, messageYue?: string): Promise<void> {
    await this.history.record({ appId: record.id, displayName: record.displayName, kind: 'update', ok, message, ...(messageYue ? { messageYue } : {}) }).catch(() => undefined);
  }

  private fail(appId: string, message: string, installedVersion: string | null = null, version?: string, releaseNotesUrl?: string): ManagedUpdateState {
    const classified = classifyManagedUpdateError(new Error(message));
    const state: ManagedUpdateState = { appId, status: 'failed', installedVersion, ...(version ? { version } : {}), ...(releaseNotesUrl ? { releaseNotesUrl } : {}), message: classified.message, messageYue: classified.messageYue, checkedAt: new Date().toISOString() };
    return this.publish(state);
  }

  currentStates(): ManagedUpdateState[] { return [...this.states.values()]; }

  private publish(state: ManagedUpdateState): ManagedUpdateState {
    this.states.set(state.appId, state);
    const window = this.getWindow();
    try {
      if (window && !window.isDestroyed()) window.webContents.send('updates:app-state', state);
    } catch {
      // Renderer teardown must never strand the privileged per-app lease.
    }
    return state;
  }
}

export const managedUpdateInternals = { githubDigest, assertReleaseUrl, isManagedUpdateRequest, isManagedUpdateCancelRequest, checksumFromCompanion, extractManagedUpdateArchive, managedUpdateStepError, removeExtractionOutput };
