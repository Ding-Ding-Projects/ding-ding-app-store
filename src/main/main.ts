import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain, session } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import type { OperationRequest, UserSettings } from '../shared/contracts.js';
import { CatalogService } from './catalog-service.js';
import { HistoryService } from './history-service.js';
import { InstalledService } from './installed-service.js';
import { OperationService } from './operation-service.js';
import { SettingsService } from './settings-service.js';
import { UpdateService } from './update-service.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;

if (squirrelStartup) app.quit();

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 360,
    minHeight: 640,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#F7F2FA',
    webPreferences: {
      preload: path.join(dirname, '..', 'preload', 'index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  window.once('ready-to-show', () => window.showInactive());
  void window.loadFile(path.join(dirname, '..', 'renderer', 'index.html'));
  return window;
}

void app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  const catalog = new CatalogService();
  const installed = new InstalledService(catalog);
  const history = new HistoryService();
  const operations = new OperationService(catalog, installed, history);
  const settings = new SettingsService();
  const updates = new UpdateService(() => mainWindow);

  ipcMain.handle('catalog:list', () => catalog.list(false));
  ipcMain.handle('catalog:refresh', () => catalog.list(true));
  ipcMain.handle('operations:install', (_event, request: OperationRequest) => operations.install(request));
  ipcMain.handle('operations:build', (_event, request: OperationRequest) => operations.build(request));
  ipcMain.handle('operations:uninstall', (_event, request: OperationRequest) => operations.uninstall(request));
  ipcMain.handle('operations:installed', () => operations.listInstalled());
  ipcMain.handle('operations:history', () => operations.listHistory());
  ipcMain.handle('operations:history-export', (_event, format, entryIds) => operations.exportHistory(format, entryIds));
  ipcMain.handle('updates:catalog', () => catalog.list(true));
  ipcMain.handle('updates:store-check', () => updates.check());
  ipcMain.handle('updates:store-download', () => updates.download());
  ipcMain.handle('updates:store-restart', () => updates.restart());
  ipcMain.handle('settings:load', () => settings.load());
  ipcMain.handle('settings:save', async (_event, value: UserSettings) => {
    const started = await history.start('settings', 'settings', 'settings change requested').catch(() => null);
    try {
      const saved = await settings.save(value);
      if (started) await history.finish(started, 'succeeded', 'Settings changed.').catch(() => undefined);
      return saved;
    } catch (error) {
      if (started) await history.finish(started, 'failed', (error as Error).message).catch(() => undefined);
      throw error;
    }
  });
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:toggle-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  mainWindow = createWindow();
  void installed.discover().catch(() => undefined);
  mainWindow.on('closed', () => { mainWindow = null; });
  setTimeout(() => void updates.check(), 5_000);
  setInterval(() => void updates.check(), 6 * 60 * 60 * 1000).unref();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) mainWindow = createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
