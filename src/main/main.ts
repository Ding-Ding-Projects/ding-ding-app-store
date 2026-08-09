import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { app, BrowserWindow, ipcMain, session } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { z } from 'zod';
import type { ElementKey, ElementOverride, ExternalEditorOpenRequest, ExternalEditorPreference, HistoryExportFormat, InstallCancelRequest, OperationRequest, SchoolModeConfigureRequest, SchoolModeRenameRequest, SchoolModeToggleRequest, SchoolModeVerifyRequest, SourceJobCancelRequest, SourceJobRequest, TabWorkspace, UserSettings } from '../shared/contracts.js';
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
import { ManagedUpdateService } from './managed-update-service.js';
import { WorkspaceService } from './workspace-service.js';
import { ExternalEditorService } from './external-editor-service.js';
import { ExternalScheduledSettingsService } from './external-scheduled-settings-service.js';
import { HomeAssistantVault } from './home-assistant-vault.js';
import { SchoolModeService } from './school-mode-service.js';

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
  window.webContents.setWindowOpenHandler(({ url }) => {
    // Release-note links are the only external destination the renderer may request.
    // Everything else remains denied, including arbitrary catalog URLs.
    // Equivalent baseline contract: setWindowOpenHandler(() => ({ action: 'deny' })).
    if (/^https:\/\/github\.com\/Ding-Ding-Projects\/[A-Za-z0-9_.-]+\/releases\/tag\/[0-9A-Za-z.+-]+$/.test(url)) return { action: 'allow' };
    return { action: 'deny' };
  });
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
  const operations = new OperationService(catalog, history, installed, (event) => {
    const contents = mainWindow?.webContents;
    if (!contents || contents.isDestroyed()) return;
    try { contents.send('operations:progress', event); } catch { /* Renderer teardown must never interrupt a privileged install. */ }
  });
  const settings = new SettingsService();
  const schoolMode = new SchoolModeService();
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
  const managedUpdates = new ManagedUpdateService(catalog, installed, history, () => mainWindow);
  const workspace = new WorkspaceService();
  const appearance = new AppearanceService();
  const schedule = new ScheduleService();
  const externalScheduledSettings = new ExternalScheduledSettingsService({ tokenStore: new HomeAssistantVault() });
  const dimSum = new DimSumService();
  const externalEditor = new ExternalEditorService();
  const scheduler = new Scheduler({
    getWindow: () => mainWindow,
    service: schedule,
    externalSources: externalScheduledSettings,
    tasks: {
      'self-update': () => updates.runScheduled('schedule'),
      'catalog-refresh': async () => {
        const result = await catalog.runScheduled();
        if (result.outcome !== 'failed') await managedUpdates.checkAll();
        return result;
      },
    },
  });

  ipcMain.handle('catalog:list', () => catalog.list(false));
  ipcMain.handle('catalog:refresh', () => catalog.list(true));
  ipcMain.handle('operations:install', (_event, request: OperationRequest) => operations.install(request));
  ipcMain.handle('operations:cancel-install', (_event, request: InstallCancelRequest) => operations.cancelInstall(request));
  ipcMain.handle('operations:status', (event) => event.sender === mainWindow?.webContents ? operations.listActive() : []);
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
  ipcMain.handle('source-jobs:status', (event) => event.sender === mainWindow?.webContents
    ? sourceJobs.isolationStatus()
    : { available: false, provider: 'windows-sandbox', reason: 'guest-transport-not-connected', checkedAt: new Date().toISOString(), evidence: ['Blocked source status request from an unknown renderer.'], remediation: 'Keep source execution disabled until a reviewed disposable guest transport is connected.' });
  ipcMain.handle('updates:catalog', () => catalog.list(true));
  ipcMain.handle('updates:store-check', () => updates.check());
  ipcMain.handle('updates:store-download', () => updates.download());
  ipcMain.handle('updates:store-restart', () => updates.restart());
  ipcMain.handle('updates:store-cancel-download', () => updates.cancelDownload());
  ipcMain.handle('updates:open-release-notes', (_event, url: unknown) => updates.openReleaseNotes(typeof url === 'string' ? url : ''));
  ipcMain.handle('updates:app-check', (event, appId: unknown) => event.sender === mainWindow?.webContents ? managedUpdates.checkApp(typeof appId === 'string' ? appId : 'invalid') : managedUpdates.checkApp('invalid'));
  ipcMain.handle('updates:app-download', (event, request: unknown) => event.sender === mainWindow?.webContents ? managedUpdates.download(request) : managedUpdates.download({ appId: 'invalid', decision: 'download-update' }));
  ipcMain.handle('updates:app-cancel', (event, request: unknown) => event.sender === mainWindow?.webContents ? managedUpdates.cancel(request) : managedUpdates.cancel({ appId: 'invalid', decision: 'cancel-update' }));
  ipcMain.handle('updates:app-restart', (event, request: unknown) => event.sender === mainWindow?.webContents ? managedUpdates.restart(request) : managedUpdates.restart({ appId: 'invalid', decision: 'restart-to-install' }));
  ipcMain.handle('settings:load', () => settings.load());
  ipcMain.handle('settings:provenance', () => settings.provenance());
  ipcMain.handle('settings:save', (_event, value: UserSettings) => settings.save(value));
  ipcMain.handle('school-mode:load', (event) => event.sender === mainWindow?.webContents ? schoolMode.load() : Promise.reject(new Error('Blocked School mode request from an unknown renderer.')));
  ipcMain.handle('school-mode:configure', (event, request: SchoolModeConfigureRequest) => event.sender === mainWindow?.webContents ? schoolMode.configure(request) : Promise.reject(new Error('Blocked School mode request from an unknown renderer.')));
  ipcMain.handle('school-mode:rename', (event, request: SchoolModeRenameRequest) => event.sender === mainWindow?.webContents ? schoolMode.rename(request) : Promise.reject(new Error('Blocked School mode request from an unknown renderer.')));
  ipcMain.handle('school-mode:set-enabled', (event, request: SchoolModeToggleRequest) => event.sender === mainWindow?.webContents ? schoolMode.setEnabled(request) : Promise.reject(new Error('Blocked School mode request from an unknown renderer.')));
  ipcMain.handle('school-mode:verify', (event, request: SchoolModeVerifyRequest) => event.sender === mainWindow?.webContents ? schoolMode.verify(request) : false);
  ipcMain.handle('history:list', () => history.list());
  ipcMain.handle('history:export', (_event, format: HistoryExportFormat) => history.export(format));
  ipcMain.handle('history:archive', (event, request: unknown) => event.sender === mainWindow?.webContents
    ? history.archive(request as Parameters<HistoryService['archive']>[0])
    : Promise.reject(new Error('Blocked history archive request from an unknown renderer.')));
  ipcMain.handle('history:revisions', (event) => event.sender === mainWindow?.webContents ? history.revisions() : []);
  ipcMain.handle('history:diff', (event, revisionId: unknown) => event.sender === mainWindow?.webContents && typeof revisionId === 'string' ? history.diff(revisionId) : '');
  ipcMain.handle('history:label', (event, revisionId: unknown, requestedLabel: unknown) => event.sender === mainWindow?.webContents && typeof revisionId === 'string' && typeof requestedLabel === 'string'
    ? history.label(revisionId, requestedLabel)
    : { ok: false, message: 'Blocked local history label request from an unknown renderer.' });
  ipcMain.handle('history:restore', (event, revisionId: unknown) => event.sender === mainWindow?.webContents && typeof revisionId === 'string'
    ? history.restore(revisionId)
    : { ok: false, message: 'Blocked local history restore request from an unknown renderer.' });
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
  ipcMain.handle('external-editor:open-archive', (event, request: unknown) => event.sender === mainWindow?.webContents ? externalEditor.openArchive(request) : { ok: false as const, reason: 'bridge-unavailable' as const, message: 'Blocked external editor request from an unknown renderer.' });
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:toggle-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  mainWindow = createWindow();
  void installed.discover().catch(() => undefined);
  mainWindow.on('closed', () => { mainWindow = null; });
  await scheduler.start();
  await managedUpdates.restore();
  void managedUpdates.checkAll();
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
