import { app, autoUpdater, BrowserWindow } from 'electron';
import semver from 'semver';
import type { AppStoreUpdateState, OperationResult, ScheduleTaskResult, ScheduleTrigger } from '../shared/contracts.js';

const FEED_URL = 'https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/latest/download/';
const RELEASES_URL = `${FEED_URL}RELEASES`;
const MAX_RELEASES_BYTES = 128_000;
const RELEASE_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);

async function fetchReleases(): Promise<string> {
  let url = new URL(RELEASES_URL);
  let response: Response | null = null;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (url.protocol !== 'https:' || url.username || url.password || !RELEASE_HOSTS.has(url.hostname)) {
      throw new Error(`Blocked update feed origin: ${url.origin}`);
    }
    response = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Ding-Ding-App-Store' },
      signal: AbortSignal.timeout(15_000),
    });
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

function latestVersionFromReleases(input: string): string | null {
  const versions = input.split(/\r?\n/).map((line) => {
    const match = line.trim().match(/^[A-Fa-f0-9]{40}\s+DingDingAppStore-([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?)-full\.nupkg\s+[0-9]+$/);
    return match?.[1] && semver.valid(match[1]) ? match[1] : null;
  }).filter((value): value is string => Boolean(value));
  return versions.sort(semver.rcompare)[0] ?? null;
}

export class UpdateService {
  private state: AppStoreUpdateState = { status: 'idle' };
  private restartAuthorized = false;

  constructor(private readonly getWindow: () => BrowserWindow | null) {
    autoUpdater.on('update-downloaded', (_event, _notes, _name, _date, url) => {
      const version = this.state.status === 'downloading' ? this.state.version : app.getVersion();
      this.publish({ status: 'ready', version, releaseNotesUrl: url || `https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v${version}`, unsigned: true });
    });
    autoUpdater.on('update-not-available', () => this.publish({ status: 'up-to-date', checkedAt: new Date().toISOString() }));
    autoUpdater.on('error', (error) => this.publish({ status: 'failed', message: error.message, checkedAt: new Date().toISOString() }));
  }

  current(): AppStoreUpdateState { return this.state; }

  async check(): Promise<AppStoreUpdateState> {
    if (!app.isPackaged) return this.publish({ status: 'up-to-date', checkedAt: new Date().toISOString() });
    this.publish({ status: 'checking' });
    try {
      const latest = latestVersionFromReleases(await fetchReleases());
      if (!latest || !semver.gt(latest, app.getVersion())) return this.publish({ status: 'up-to-date', checkedAt: new Date().toISOString() });
      return this.publish({ status: 'available', version: latest, releaseNotesUrl: `https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v${latest}` });
    } catch (error) {
      return this.publish({ status: 'failed', message: (error as Error).message, checkedAt: new Date().toISOString() });
    }
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
    const downloading: AppStoreUpdateState = { ...this.state, status: 'downloading' };
    this.publish(downloading);
    autoUpdater.setFeedURL({ url: FEED_URL });
    autoUpdater.checkForUpdates();
    return downloading;
  }

  restart(): OperationResult {
    if (this.state.status !== 'ready') return { ok: false, appId: 'ding-ding-app-store', message: 'No verified update is ready to install.' };
    this.restartAuthorized = true;
    setImmediate(() => { if (this.restartAuthorized) autoUpdater.quitAndInstall(); });
    return { ok: true, appId: 'ding-ding-app-store', message: `Restarting to install ${this.state.version}.` };
  }

  private publish(state: AppStoreUpdateState): AppStoreUpdateState {
    this.state = state;
    const window = this.getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('updates:state', state);
    return state;
  }
}

export const updateInternals = { latestVersionFromReleases };
