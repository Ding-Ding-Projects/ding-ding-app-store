import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain, session } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { z } from 'zod';
import type { ElementKey, ElementOverride, ExternalEditorOpenRequest, ExternalEditorPreference, HistoryExportFormat, InstallCancelRequest, OperationRequest, SourceJobCancelRequest, SourceJobRequest, TabWorkspace, UserSettings } from '../shared/contracts.js';
import { AppearanceService } from './appearance-service.js';
import { CatalogService } from './catalog-service.js';
import { HistoryService } from './history-service.js';
import { InstalledService } from './installed-service.js';
import { OperationService } from './operation-service.js';
import { Scheduler } from './scheduler.js';
import { ScheduleService } from './schedule-service.js';
import { DimSumService } from './dim-sum-service.js';
import { SourceJobService } from './source-job-service.js';
import { SettingsService } from './settings-service.js';
import { UpdateService } from './update-service.js';
import { WorkspaceService } from './workspace-service.js';
import { ExternalEditorService } from './external-editor-service.js';

const scheduleTaskSchema = z.enum(['self-update', 'catalog-refresh']);

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
  const history = new HistoryService();
  const installed = new InstalledService(catalog);
  catalog.setInstalledProvider(async () => await installed.list(true));
  const operations = new OperationService(catalog, history, installed);
  const settings = new SettingsService();
  const sourceJobs = new SourceJobService(
    catalog,
    history,
    settings,
    path.join(app.getPath('userData'), 'source-jobs'),
    path.join(app.getAppPath(), 'data', 'source-recipes.v1.json'),
    undefined,
    (event) => mainWindow?.webContents.send('source-jobs:event', event),
  );
  const updates = new UpdateService(() => mainWindow);
  const workspace = new WorkspaceService();
  const appearance = new AppearanceService();
  const schedule = new ScheduleService();
  const dimSum = new DimSumService();
  const externalEditor = new ExternalEditorService();
  const scheduler = new Scheduler({
    getWindow: () => mainWindow,
    service: schedule,
    tasks: {
      'self-update': () => updates.runScheduled('schedule'),
      'catalog-refresh': () => catalog.runScheduled(),
    },
  });

  ipcMain.handle('catalog:list', () => catalog.list(false));
  ipcMain.handle('catalog:refresh', () => catalog.list(true));
  ipcMain.handle('operations:install', (_event, request: OperationRequest) => operations.install(request));
  ipcMain.handle('operations:cancel-install', (_event, request: InstallCancelRequest) => operations.cancelInstall(request));
  ipcMain.handle('operations:build', (_event, request: OperationRequest) => operations.build(request));
  ipcMain.handle('operations:uninstall', (_event, request: OperationRequest) => operations.uninstall(request));
  ipcMain.handle('operations:installed', () => operations.listInstalled());
  ipcMain.handle('source-jobs:start', (event, request: SourceJobRequest) => {
    if (event.sender !== mainWindow?.webContents) return { ok: false, appId: 'invalid', state: 'failed', message: 'Blocked source job request from an unknown renderer.' };
    return sourceJobs.start(request);
  });
  ipcMain.handle('source-jobs:cancel', (event, request: SourceJobCancelRequest) => {
    if (event.sender !== mainWindow?.webContents) return { ok: false, appId: 'invalid', state: 'failed', message: 'Blocked cancellation request from an unknown renderer.' };
    return sourceJobs.cancel(request);
  });
  ipcMain.handle('source-jobs:retry', (event, request) => {
    if (event.sender !== mainWindow?.webContents) return { ok: false, appId: 'invalid', state: 'failed', message: 'Blocked retry request from an unknown renderer.' };
    return sourceJobs.retry(request);
  });
  ipcMain.handle('updates:catalog', () => catalog.list(true));
  ipcMain.handle('updates:store-check', () => updates.check());
  ipcMain.handle('updates:store-download', () => updates.download());
  ipcMain.handle('updates:store-restart', () => updates.restart());
  ipcMain.handle('updates:store-cancel-download', () => updates.cancelDownload());
  ipcMain.handle('updates:open-release-notes', (_event, url: unknown) => updates.openReleaseNotes(typeof url === 'string' ? url : ''));
  ipcMain.handle('settings:load', () => settings.load());
  ipcMain.handle('settings:provenance', () => settings.provenance());
  ipcMain.handle('settings:save', (_event, value: UserSettings) => settings.save(value));
  ipcMain.handle('history:list', () => history.list());
  ipcMain.handle('history:export', (_event, format: HistoryExportFormat) => history.export(format));
  ipcMain.handle('workspace:load', () => workspace.load());
  ipcMain.handle('workspace:save', (_event, value: TabWorkspace) => workspace.save(value));
  ipcMain.handle('workspace:reset', () => workspace.reset());
  ipcMain.handle('workspace:export', () => workspace.export());
  ipcMain.handle('workspace:import', (_event, document: string) => workspace.import(document));
  ipcMain.handle('appearance:load', () => appearance.load());
  ipcMain.handle('appearance:set-element', (_event, key: ElementKey, override: ElementOverride) => appearance.setElement(key, override));
  ipcMain.handle('appearance:reset-element', (_event, key: ElementKey) => appearance.resetElement(key));
  ipcMain.handle('appearance:reset-all', () => appearance.resetAll());
  ipcMain.handle('appearance:export', () => appearance.export());
  ipcMain.handle('appearance:import', (_event, payload: string) => appearance.import(payload));
  ipcMain.handle('schedule:load', () => scheduler.status());
  ipcMain.handle('schedule:save', (_event, config: unknown) => scheduler.save(config));
  ipcMain.handle('schedule:run-now', (_event, task: unknown) => scheduler.runNow(scheduleTaskSchema.parse(task)));
  ipcMain.handle('dim-sum:startup', () => dimSum.startup());
  ipcMain.handle('external-editor:detect', (event) => event.sender === mainWindow?.webContents ? externalEditor.detect() : []);
  ipcMain.handle('external-editor:preference', (event) => event.sender === mainWindow?.webContents ? externalEditor.preference() : { editor: 'vscode', edition: 'unknown' as const });
  ipcMain.handle('external-editor:set-preference', (event, value: ExternalEditorPreference) => event.sender === mainWindow?.webContents ? externalEditor.setPreference(value) : { editor: 'vscode', edition: 'unknown' as const });
  ipcMain.handle('external-editor:add-validated', (event) => event.sender === mainWindow?.webContents ? externalEditor.addValidated() : null);
  ipcMain.handle('external-editor:open-export', (event, request: ExternalEditorOpenRequest) => event.sender === mainWindow?.webContents ? externalEditor.openExport(request) : { ok: false as const, reason: 'bridge-unavailable' as const, message: 'Blocked external editor request from an unknown renderer.' });
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:toggle-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  mainWindow = createWindow();
  void installed.discover().catch(() => undefined);
  mainWindow.on('closed', () => { mainWindow = null; });
  await scheduler.start();
  setTimeout(() => void scheduler.runStartupCheck(), 5_000).unref();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      mainWindow.on('closed', () => { mainWindow = null; });
      scheduler.publish();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
