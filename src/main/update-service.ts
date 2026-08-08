import path from 'node:path';
import { app, autoUpdater, BrowserWindow, shell } from 'electron';
import semver from 'semver';
import { z } from 'zod';
import type { AppStoreUpdateState, OperationResult, ScheduleTaskResult, ScheduleTrigger, UpdatePackageMetadata } from '../shared/contracts.js';
import { readJson, writeJsonAtomic } from './json-store.js';

const FEED_URL = 'https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/latest/download/';
const RELEASES_URL = `${FEED_URL}RELEASES`;
const RELEASE_NOTES_URL = 'https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v';
const MAX_RELEASES_BYTES = 128_000;
const MAX_PACKAGE_BYTES = 2_000_000_000;
const MAX_REDIRECTS = 3;
const RELEASE_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);
const ANY_PACKAGE_RE = /^DingDingAppStore-([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)-(?:full|delta)\.nupkg$/;

export interface UpdateReleaseRow extends UpdatePackageMetadata {
  version: string;
  kind: 'full' | 'delta';
}

interface PendingUpdate {
  version: string;
  package: UpdatePackageMetadata;
  startedAt: string;
}

const pendingSchema = z.object({
  version: z.string().refine((value) => Boolean(semver.valid(value))),
  package: z.object({ fileName: z.string(), sha1: z.string().regex(/^[a-f0-9]{40}$/i), bytes: z.number().int().positive().max(MAX_PACKAGE_BYTES) }),
  startedAt: z.string().datetime(),
}).strict();

function parseReleaseRow(line: string, lineNumber: number): UpdateReleaseRow {
  const parts = line.trim().split(/\s+/);
  if (parts.length !== 3) throw new Error(`Update feed metadata line ${lineNumber} is malformed.`);
  const [sha1, fileName, sizeText] = parts;
  if (!/^[a-f0-9]{40}$/i.test(sha1)) throw new Error(`Update feed metadata line ${lineNumber} has an invalid package hash.`);
  const match = fileName.match(ANY_PACKAGE_RE);
  if (!match?.[1] || !semver.valid(match[1])) throw new Error(`Update feed metadata line ${lineNumber} names an unsupported package.`);
  const bytes = Number(sizeText);
  if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > MAX_PACKAGE_BYTES) throw new Error(`Update feed metadata line ${lineNumber} has an invalid package size.`);
  return { version: match[1], fileName, sha1: sha1.toLowerCase(), bytes, kind: fileName.endsWith('-full.nupkg') ? 'full' : 'delta' };
}

/** Parse and validate every RELEASES row before any update is advertised. */
export function parseReleases(input: string): UpdateReleaseRow[] {
  if (typeof input !== 'string' || input.length === 0 || input.length > MAX_RELEASES_BYTES) throw new Error('Update feed metadata is empty or exceeds 128 KB.');
  const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) throw new Error('Update feed metadata contains no package rows.');
  const rows = lines.map((line, index) => parseReleaseRow(line, index + 1));
  const seen = new Map<string, string>();
  for (const row of rows) {
    const prior = seen.get(row.fileName);
    if (prior && prior !== `${row.sha1}:${row.bytes}`) throw new Error(`Update feed metadata repeats ${row.fileName} with conflicting integrity values.`);
    seen.set(row.fileName, `${row.sha1}:${row.bytes}`);
  }
  if (!rows.some((row) => row.kind === 'full')) throw new Error('Update feed metadata contains no full package.');
  return rows;
}

export function latestReleaseFromReleases(input: string): UpdateReleaseRow | null {
  const full = parseReleases(input).filter((row) => row.kind === 'full');
  return full.sort((left, right) => semver.rcompare(left.version, right.version))[0] ?? null;
}

function releaseNotesUrl(version: string): string {
  return `${RELEASE_NOTES_URL}${encodeURIComponent(version)}`;
}

async function fetchReleases(signal: AbortSignal): Promise<string> {
  let url = new URL(RELEASES_URL);
  let response: Response | null = null;
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (signal.aborted) throw new DOMException('Update check was cancelled.', 'AbortError');
    if (url.protocol !== 'https:' || url.username || url.password || !RELEASE_HOSTS.has(url.hostname)) throw new Error(`Blocked update feed origin: ${url.origin}`);
    response = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': 'Ding-Ding-App-Store' }, signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Update feed redirected without a destination.');
      url = new URL(location, url);
      continue;
    }
    break;
  }
  if (!response?.ok) throw new Error(`Update feed request failed: HTTP ${response?.status ?? 0}`);
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_RELEASES_BYTES) throw new Error('Update feed metadata exceeded 128 KB.');
  const text = await response.text();
  if (text.length > MAX_RELEASES_BYTES) throw new Error('Update feed metadata exceeded 128 KB.');
  return text;
}

export class UpdateService {
  private state: AppStoreUpdateState = { status: 'idle' };
  private restartAuthorized = false;
  private checkAbort: AbortController | null = null;
  private downloadCancelled = false;
  private pending: PendingUpdate | null = null;
  private readonly pendingPath = path.join(app.getPath('userData'), 'update-pending.v1.json');

  constructor(private readonly getWindow: () => BrowserWindow | null) {
    autoUpdater.on('update-downloaded', (_event, _notes, name) => {
      const metadata = this.packageMetadata();
      const version = this.state.status === 'downloading' ? this.state.version : (typeof name === 'string' && semver.valid(name) ? name : null);
      if (!metadata || !version) {
        this.publish(this.failedState('Update download completed without matching validated feed metadata.', true, false));
        return;
      }
      if (this.downloadCancelled) {
        this.publish(this.failedState('Update download was cancelled before installation; no restart was performed.', true, false));
        return;
      }
      this.publish({ status: 'ready', version, releaseNotesUrl: releaseNotesUrl(version), package: metadata, unsigned: true });
    });
    autoUpdater.on('update-not-available', () => {
      if (!this.downloadCancelled) this.publish({ status: 'up-to-date', checkedAt: new Date().toISOString() });
    });
    autoUpdater.on('error', (error) => this.publish(this.failedState(`Update download failed: ${(error as Error).message}`, true, Boolean(this.pending))));
    void this.restorePending();
  }

  current(): AppStoreUpdateState { return this.state; }

  async check(): Promise<AppStoreUpdateState> {
    if (!app.isPackaged) return this.publish({ status: 'up-to-date', checkedAt: new Date().toISOString() });
    if (this.state.status === 'downloading' || this.state.status === 'ready') return this.state;
    this.checkAbort?.abort();
    const controller = new AbortController();
    this.checkAbort = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    timeout.unref?.();
    this.publish({ status: 'checking' });
    try {
      const latest = latestReleaseFromReleases(await fetchReleases(controller.signal));
      if (this.checkAbort !== controller) return this.state;
      if (!latest || !semver.gt(latest.version, app.getVersion())) return this.publish({ status: 'up-to-date', checkedAt: new Date().toISOString() });
      return this.publish({ status: 'available', version: latest.version, releaseNotesUrl: releaseNotesUrl(latest.version), package: { fileName: latest.fileName, sha1: latest.sha1, bytes: latest.bytes } });
    } catch (error) {
      if (this.checkAbort !== controller) return this.state;
      if ((error as Error).name === 'AbortError') return this.publish({ status: 'idle', checkedAt: new Date().toISOString() });
      return this.publish(this.failedState((error as Error).message, true, Boolean(this.pending)));
    } finally {
      clearTimeout(timeout);
      if (this.checkAbort === controller) this.checkAbort = null;
    }
  }

  cancelDownload(): AppStoreUpdateState {
    this.checkAbort?.abort();
    if (this.state.status === 'checking') return this.publish({ status: 'idle', checkedAt: new Date().toISOString() });
    if (this.state.status !== 'downloading') return this.state;
    this.downloadCancelled = true;
    const available = this.state;
    return this.publish({ status: 'available', version: available.version, releaseNotesUrl: available.releaseNotesUrl, package: available.package });
  }

  async runScheduled(_trigger: ScheduleTrigger): Promise<ScheduleTaskResult> {
    if (!app.isPackaged) return { outcome: 'ok', message: 'Development build: no update feed request was made.' };
    const state = await this.check();
    if (state.status === 'failed') return { outcome: 'failed', message: state.message };
    if (state.status === 'available' || state.status === 'ready') return { outcome: 'ok', message: `Update ${state.version} is available.` };
    return { outcome: 'ok', message: 'The App Store is up to date.' };
  }

  async download(): Promise<AppStoreUpdateState> {
    if (this.state.status !== 'available') return this.state;
    this.downloadCancelled = false;
    const available = this.state;
    const downloading: AppStoreUpdateState = { status: 'downloading', version: available.version, releaseNotesUrl: available.releaseNotesUrl, package: available.package };
    this.publish(downloading);
    try {
      autoUpdater.setFeedURL({ url: FEED_URL });
      autoUpdater.checkForUpdates();
    } catch (error) {
      return this.publish(this.failedState(`Update download could not start: ${(error as Error).message}`, true, false));
    }
    return downloading;
  }

  restart(): OperationResult {
    if (this.state.status !== 'ready') return { ok: false, appId: 'ding-ding-app-store', message: 'No verified update is ready to install.' };
    if (this.restartAuthorized) return { ok: false, appId: 'ding-ding-app-store', message: 'Update restart is already in progress.' };
    this.restartAuthorized = true;
    const state = this.state;
    const pending: PendingUpdate = { version: state.version, package: state.package, startedAt: new Date().toISOString() };
    void writeJsonAtomic(this.pendingPath, pending).then(() => {
      if (this.restartAuthorized) autoUpdater.quitAndInstall();
    }).catch((error) => {
      this.restartAuthorized = false;
      this.publish(this.failedState(`Update restart was not armed: ${(error as Error).message}`, true, false));
    });
    return { ok: true, appId: 'ding-ding-app-store', message: `Restarting to install ${state.version}. Unsigned package; your current work must be saved first.` };
  }

  async openReleaseNotes(url: string): Promise<OperationResult> {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || parsed.username || parsed.password || !/^\/Ding-Ding-Projects\/ding-ding-app-store\/releases\/tag\/v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(parsed.pathname)) {
        return { ok: false, appId: 'ding-ding-app-store', message: 'Release-note navigation was blocked because the URL was not an allowlisted project release.' };
      }
      await shell.openExternal(parsed.toString());
      return { ok: true, appId: 'ding-ding-app-store', message: 'Release notes opened in the system browser.' };
    } catch (error) {
      return { ok: false, appId: 'ding-ding-app-store', message: `Release notes could not be opened: ${(error as Error).message}` };
    }
  }

  private packageMetadata(): UpdatePackageMetadata | null {
    if (this.state.status === 'available' || this.state.status === 'downloading' || this.state.status === 'ready') return this.state.package;
    return null;
  }

  private failedState(message: string, recoverable: boolean, rollbackAvailable: boolean): AppStoreUpdateState {
    return { status: 'failed', message, checkedAt: new Date().toISOString(), recoverable, rollbackAvailable };
  }

  private async restorePending(): Promise<void> {
    try {
      const raw = await readJson<unknown>(this.pendingPath, null);
      const parsed = pendingSchema.safeParse(raw);
      if (!parsed.success) return;
      this.pending = parsed.data;
      if (parsed.data.version === app.getVersion()) {
        this.pending = null;
        await writeJsonAtomic(this.pendingPath, null);
        return;
      }
      const started = Date.parse(parsed.data.startedAt);
      if (!Number.isFinite(started) || Date.now() - started > 24 * 60 * 60_000) return;
      if (this.state.status === 'idle') this.publish(this.failedState(`The staged update ${parsed.data.version} did not become the running version. Squirrel.Windows may have rolled back; retry only after checking the release notes.`, true, true));
    } catch {
      /* A pending marker is advisory; never block startup because it is unreadable. */
    }
  }

  private publish(state: AppStoreUpdateState): AppStoreUpdateState {
    this.state = state;
    const window = this.getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('updates:state', state);
    return state;
  }
}

export const updateInternals = { parseReleases, latestReleaseFromReleases, latestVersionFromReleases: (input: string): string | null => latestReleaseFromReleases(input)?.version ?? null, releaseNotesUrl };
