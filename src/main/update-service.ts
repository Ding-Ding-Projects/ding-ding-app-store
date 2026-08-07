import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { AppStoreUpdateState, OperationResult } from '../shared/contracts.js';

export class UpdateService {
  private state: AppStoreUpdateState = { status: 'idle' };
  private restartAuthorized = false;

  constructor(private readonly getWindow: () => BrowserWindow | null) {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    autoUpdater.allowPrerelease = false;
    autoUpdater.on('checking-for-update', () => this.publish({ status: 'checking' }));
    autoUpdater.on('update-not-available', () => this.publish({ status: 'up-to-date', checkedAt: new Date().toISOString() }));
    autoUpdater.on('update-available', (info) => this.publish({
      status: 'available',
      version: info.version,
      releaseNotesUrl: `https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v${info.version}`,
    }));
    autoUpdater.on('download-progress', () => {
      if (this.state.status === 'available' || this.state.status === 'downloading') {
        this.publish({ ...this.state, status: 'downloading' });
      }
    });
    autoUpdater.on('update-downloaded', (info) => this.publish({
      status: 'ready',
      version: info.version,
      releaseNotesUrl: `https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v${info.version}`,
      unsigned: true,
    }));
    autoUpdater.on('error', (error) => this.publish({ status: 'failed', message: error.message, checkedAt: new Date().toISOString() }));
  }

  current(): AppStoreUpdateState {
    return this.state;
  }

  async check(): Promise<AppStoreUpdateState> {
    if (!app.isPackaged) {
      return this.publish({ status: 'up-to-date', checkedAt: new Date().toISOString() });
    }
    try {
      await autoUpdater.checkForUpdates();
      return this.state;
    } catch (error) {
      return this.publish({ status: 'failed', message: (error as Error).message, checkedAt: new Date().toISOString() });
    }
  }

  async download(): Promise<AppStoreUpdateState> {
    if (this.state.status !== 'available') return this.state;
    await autoUpdater.downloadUpdate();
    return this.state;
  }

  restart(): OperationResult {
    if (this.state.status !== 'ready') {
      return { ok: false, appId: 'ding-ding-app-store', message: 'No verified update is ready to install.' };
    }
    this.restartAuthorized = true;
    setImmediate(() => {
      if (this.restartAuthorized) autoUpdater.quitAndInstall(false, true);
    });
    return { ok: true, appId: 'ding-ding-app-store', message: `Restarting to install ${this.state.version}.` };
  }

  private publish(state: AppStoreUpdateState): AppStoreUpdateState {
    this.state = state;
    const window = this.getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('updates:state', state);
    return state;
  }
}
