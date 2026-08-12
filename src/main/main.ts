import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { open } from 'node:fs/promises';
import { app, BrowserWindow, clipboard, dialog, ipcMain, nativeImage, session, shell } from 'electron';
import squirrelStartup from 'electron-squirrel-startup';
import { z } from 'zod';
import { AUTHENTICATOR_MAX_IMAGE_BYTES, AUTHENTICATOR_MAX_URI_LENGTH, type AuthenticatorBulkDeleteRequest, type AuthenticatorBulkDeleteResult, type AuthenticatorDeleteRequest, type AuthenticatorDeleteResult, type AuthenticatorExportRequest, type AuthenticatorExportResult, type AuthenticatorGroupRequest, type AuthenticatorListResult, type AuthenticatorMutationResult, type AuthenticatorPreviewRequest, type AuthenticatorPreviewResult, type AuthenticatorQrImageImportResult, type AuthenticatorRegistrationConfirmRequest, type AuthenticatorRegistrationPreviewResult, type AuthenticatorRegistrationRequest, type AuthenticatorRenameRequest, type AuthenticatorReorderRequest, type AuthenticatorStatus, type ElementKey, type ElementOverride, type ExternalEditorOpenRequest, type ExternalEditorPreference, type HistoryExportFormat, type InstallCancelRequest, type LockCredentialRequest, type LockSetRequest, type LockTarget, type OperationRequest, type SchoolModeConfigureRequest, type SchoolModeCredentialChangeRequest, type SchoolModeRenameRequest, type SchoolModeToggleRequest, type SchoolModeVerifyRequest, type SourceJobCancelRequest, type SourceJobRequest, type SupportTicketCreateRequest, type TabWorkspace, type UserSettings } from '../shared/contracts.js';
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
import { ExternalNavigationService } from './external-navigation-service.js';
import { ExternalScheduledSettingsService } from './external-scheduled-settings-service.js';
import { HomeAssistantVault } from './home-assistant-vault.js';
import { SchoolModeService } from './school-mode-service.js';
import { AuthenticatorService } from './authenticator-service.js';
import { decodeAuthenticatorQrBitmap, inspectAuthenticatorImageDimensions } from './authenticator-qr-image.js';
import { SafeStorageAuthenticatorVault } from './authenticator-vault.js';
import { LockSupportService } from './lock-support-service.js';
import { StateMutationQueue } from './state-mutation-queue.js';
import { PersonalVocabularyService } from './personal-vocabulary-service.js';
import { HistoryAccessService, type HistoryAccessUnlockRequest } from './history-access-service.js';

const scheduleTaskSchema = z.enum(['self-update', 'catalog-refresh']);
const PRODUCT_NAME = 'Ding Ding App Store';
const PRODUCT_APP_ID = 'org.dingdingprojects.appstore';

const dirname = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;

app.setName(PRODUCT_NAME);
app.setAppUserModelId(PRODUCT_APP_ID);

if (squirrelStartup) app.quit();

// Keep one main process as the sole writer for application-data records. A
// second launch activates the existing window instead of racing metadata and
// ciphertext publication from another process.
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 360,
    minHeight: 640,
    show: false,
    title: PRODUCT_NAME,
    icon: path.join(dirname, '..', '..', 'assets', 'ding-ding-app-store.ico'),
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
  window.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    window.setTitle(PRODUCT_NAME);
  });
  window.once('ready-to-show', () => window.showInactive());
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    if (!isMainFrame) return;
    console.error(`Ding Ding App Store renderer failed to load (${errorCode}): ${errorDescription} — ${validatedURL}`);
    window.setTitle(PRODUCT_NAME);
  });
  void window.loadFile(path.join(dirname, '..', 'renderer', 'index.html')).catch((error: unknown) => {
    console.error(`Ding Ding App Store renderer load failed: ${(error as Error).message}`);
    window.setTitle(PRODUCT_NAME);
  });
  return window;
}

void app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);

  // Paint the branded shell before any recover/migration work. A malformed
  // local record must never make a launch look like a silent Electron exit.
  mainWindow = createWindow();
  mainWindow.on('closed', () => { mainWindow = null; });

  const catalog = new CatalogService();
  const history = new HistoryService();
  const historyAccess = new HistoryAccessService();
  // Recover a restore interrupted between per-file replacements before any
  // state service can read the application-data files.
  await history.recoverPendingRestore();
  const installed = new InstalledService(catalog);
  catalog.setInstalledProvider(async () => await installed.list(true));
  const operations = new OperationService(catalog, history, installed, (event) => {
    const contents = mainWindow?.webContents;
    if (!contents || contents.isDestroyed()) return;
    try { contents.send('operations:progress', event); } catch { /* Renderer teardown must never interrupt a privileged install. */ }
  });
  const settings = new SettingsService(history);
  const personalVocabulary = new PersonalVocabularyService();
  const schoolMode = new SchoolModeService();
  const authenticator = new AuthenticatorService(new SafeStorageAuthenticatorVault(), history);
  const lockSupport = new LockSupportService(history);
  const unsubscribeSchoolMode = schoolMode.subscribe((snapshot) => {
    if (snapshot.sync.status !== 'ready' || snapshot.state?.enabled === true) historyAccess.invalidate();
    authenticator.setRestricted(snapshot.sync.status !== 'ready' || snapshot.state?.enabled === true);
    const contents = mainWindow?.webContents;
    if (!contents || contents.isDestroyed()) return;
    try { contents.send('school-mode:changed', snapshot); } catch { /* Renderer teardown must not stop shared-state observation. */ }
  });
  await schoolMode.start();
  const authenticatorRestrictedStatus = (): AuthenticatorStatus => ({
    available: false,
    vault: 'unavailable',
    entryCount: 0,
    checkedAt: new Date().toISOString(),
    message: 'Authenticator is unavailable while the shared restricted mode is enabled or unavailable.',
    messageYue: '共享限制模式開啟或不可用時，驗證器暫時唔可用。',
  });
  const authenticatorRestrictedPreview = (): AuthenticatorPreviewResult => ({
    ok: false,
    storage: 'memory-only',
    message: 'Authenticator preview is unavailable while the shared restricted mode is enabled or unavailable.',
    messageYue: '共享限制模式開啟或不可用時，驗證器預覽暫時唔可用。',
  });
  const authenticatorRestrictedRegistration = (): AuthenticatorRegistrationPreviewResult => ({
    ok: false,
    storage: 'memory-only',
    message: 'Authenticator registration is unavailable while the shared restricted mode is enabled or unavailable.',
    messageYue: '共享限制模式開啟或不可用時，驗證器登記暫時唔可用。',
  });
  const authenticatorRestrictedMutation = (): AuthenticatorMutationResult => ({
    ok: false,
    message: 'Authenticator entry management is unavailable while the shared restricted mode is enabled or unavailable.',
    messageYue: '共享限制模式開啟或不可用時，驗證器項目管理暫時唔可用。',
  });
  const authenticatorRestrictedList = (): AuthenticatorListResult => ({
    entries: [],
    storage: 'memory-only',
    message: 'Authenticator entries are unavailable while the shared restricted mode is enabled or unavailable.',
    messageYue: '共享限制模式開啟或不可用時，驗證器項目暫時唔可用。',
  });
  const authenticatorRestrictedDelete = (): AuthenticatorDeleteResult => ({
    ok: false,
    message: 'Authenticator entry management is unavailable while the shared restricted mode is enabled or unavailable.',
    messageYue: '共享限制模式開啟或不可用時，驗證器項目管理暫時唔可用。',
  });
  const authenticatorRestrictedBulkDelete = (): AuthenticatorBulkDeleteResult => ({
    ok: false,
    deletedIds: [],
    skippedIds: [],
    uncertainIds: [],
    message: 'Authenticator bulk management is unavailable while the shared restricted mode is enabled or unavailable.',
    messageYue: '共享限制模式開啟或不可用時，驗證器批量管理暫時唔可用。',
  });
  const authenticatorRestrictedExport = (): AuthenticatorExportResult => ({
    ok: false,
    omittedFields: ['secret', 'uri', 'code', 'nextCode', 'remainingSeconds', 'expiresAt'],
    message: 'Authenticator metadata export is unavailable while the shared restricted mode is enabled or unavailable.',
    messageYue: '共享限制模式開啟或不可用時，驗證器 metadata 匯出暫時唔可用。',
  });
  const authenticatorAllowed = async (): Promise<boolean> => {
    try {
      const restricted = await schoolMode.isRestricted();
      authenticator.setRestricted(restricted);
      return !restricted;
    }
    catch { authenticator.setRestricted(true); return false; }
  };
  const historyToken = async (): Promise<number | null> => {
    try {
      if (await schoolMode.isRestricted()) { historyAccess.invalidate(); return null; }
      return historyAccess.sessionToken();
    } catch { historyAccess.invalidate(); return null; }
  };
  app.once('will-quit', () => {
    unsubscribeSchoolMode();
    schoolMode.dispose();
  });
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
  const appearance = new AppearanceService((key, next, current) => lockSupport.assertAppearanceMutation(key, next, current));
  const schedule = new ScheduleService();
  const externalScheduledSettings = new ExternalScheduledSettingsService({ tokenStore: new HomeAssistantVault() });
  const dimSum = new DimSumService();
  const externalEditor = new ExternalEditorService();
  const externalNavigation = new ExternalNavigationService(shell);
  const stateMutationQueue = new StateMutationQueue();
  const scheduler = new Scheduler({
    getWindow: () => mainWindow,
    service: schedule,
    externalSources: externalScheduledSettings,
    mutate: (operation) => stateMutationQueue.run(operation),
    tasks: {
      'self-update': () => updates.runScheduled('schedule'),
      'catalog-refresh': async () => {
        const result = await catalog.runScheduled();
        if (result.outcome !== 'failed') await managedUpdates.checkAll();
        return result;
      },
    },
  });
  ipcMain.handle('catalog:list', () => stateMutationQueue.run(() => catalog.list(false)));
  ipcMain.handle('catalog:refresh', () => stateMutationQueue.run(() => catalog.list(true)));
  ipcMain.handle('operations:install', (_event, request: OperationRequest) => stateMutationQueue.run(() => operations.install(request)));
  // Cancellation must remain an abort-priority path; queueing it behind the
  // long-running install would let the operation finish before it can see the
  // user's cancel request.
  ipcMain.handle('operations:cancel-install', (_event, request: InstallCancelRequest) => operations.cancelInstall(request));
  ipcMain.handle('operations:status', (event) => event.sender === mainWindow?.webContents ? operations.listActive() : []);
  ipcMain.handle('operations:build', (_event, request: OperationRequest) => stateMutationQueue.run(() => operations.build(request)));
  ipcMain.handle('operations:uninstall', (_event, request: OperationRequest) => stateMutationQueue.run(() => operations.uninstall(request)));
  ipcMain.handle('operations:installed', (_event, discover: unknown = true) => stateMutationQueue.run(() => operations.listInstalled(discover !== false)));
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
  ipcMain.handle('updates:catalog', () => stateMutationQueue.run(() => catalog.list(true)));
  ipcMain.handle('updates:store-check', () => updates.check());
  ipcMain.handle('updates:store-download', () => stateMutationQueue.run(() => updates.download()));
  ipcMain.handle('updates:store-restart', () => stateMutationQueue.run(() => updates.restart()));
  ipcMain.handle('updates:store-cancel-download', () => updates.cancelDownload());
  ipcMain.handle('updates:open-release-notes', (_event, url: unknown) => updates.openReleaseNotes(typeof url === 'string' ? url : ''));
  ipcMain.handle('updates:app-check', (event, appId: unknown) => event.sender === mainWindow?.webContents ? managedUpdates.checkApp(typeof appId === 'string' ? appId : 'invalid') : managedUpdates.checkApp('invalid'));
  ipcMain.handle('updates:app-download', (event, request: unknown) => stateMutationQueue.run(() => event.sender === mainWindow?.webContents ? managedUpdates.download(request) : managedUpdates.download({ appId: 'invalid', decision: 'download-update' })));
  ipcMain.handle('updates:app-cancel', (event, request: unknown) => event.sender === mainWindow?.webContents ? managedUpdates.cancel(request) : managedUpdates.cancel({ appId: 'invalid', decision: 'cancel-update' }));
  ipcMain.handle('updates:app-restart', (event, request: unknown) => stateMutationQueue.run(() => event.sender === mainWindow?.webContents ? managedUpdates.restart(request) : managedUpdates.restart({ appId: 'invalid', decision: 'restart-to-install' })));
  ipcMain.handle('settings:load', () => settings.load());
  ipcMain.handle('settings:provenance', () => settings.provenance());
  ipcMain.handle('settings:save', (_event, value: UserSettings) => stateMutationQueue.run(() => settings.save(value)));
  ipcMain.handle('personal-vocabulary:status', (event) => event.sender === mainWindow?.webContents ? personalVocabulary.status() : Promise.reject(new Error('Blocked personal vocabulary request from an unknown renderer.')));
  ipcMain.handle('personal-vocabulary:import', (event) => event.sender === mainWindow?.webContents ? personalVocabulary.importFromPicker(event.sender) : Promise.reject(new Error('Blocked personal vocabulary request from an unknown renderer.')));
  ipcMain.handle('personal-vocabulary:clear', (event) => event.sender === mainWindow?.webContents ? personalVocabulary.clear() : Promise.reject(new Error('Blocked personal vocabulary request from an unknown renderer.')));
  ipcMain.handle('school-mode:load', (event) => event.sender === mainWindow?.webContents ? schoolMode.load() : Promise.reject(new Error('Blocked School mode request from an unknown renderer.')));
  ipcMain.handle('school-mode:configure', (event, request: SchoolModeConfigureRequest) => event.sender === mainWindow?.webContents ? schoolMode.configure(request) : Promise.reject(new Error('Blocked School mode request from an unknown renderer.')));
  ipcMain.handle('school-mode:rename', (event, request: SchoolModeRenameRequest) => event.sender === mainWindow?.webContents ? schoolMode.rename(request) : Promise.reject(new Error('Blocked School mode request from an unknown renderer.')));
  ipcMain.handle('school-mode:set-enabled', (event, request: SchoolModeToggleRequest) => event.sender === mainWindow?.webContents ? schoolMode.setEnabled(request) : Promise.reject(new Error('Blocked School mode request from an unknown renderer.')));
  ipcMain.handle('school-mode:change-credential', (event, request: SchoolModeCredentialChangeRequest) => event.sender === mainWindow?.webContents ? schoolMode.changeCredential(request) : Promise.reject(new Error('Blocked School mode request from an unknown renderer.')));
  ipcMain.handle('school-mode:verify', (event, request: SchoolModeVerifyRequest) => event.sender === mainWindow?.webContents ? schoolMode.verify(request) : false);
  ipcMain.handle('authenticator:status', async (event) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator status request from an unknown renderer.'));
    if (!(await authenticatorAllowed())) return authenticatorRestrictedStatus();
    return authenticator.status();
  });
  ipcMain.handle('authenticator:clipboard-prepare', async (event, attemptId: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator clipboard request from an unknown renderer.'));
    if (!(await authenticatorAllowed())) return authenticatorRestrictedRegistration();
    const normalizedAttemptId = typeof attemptId === 'string' ? attemptId : undefined;
    const value = clipboard.readText();
    if (!value.trim()) return {
      ok: false,
      storage: 'memory-only' as const,
      message: 'The local clipboard does not contain an authenticator URI.',
      messageYue: '本機剪貼簿冇 authenticator URI。',
    };
    if (Buffer.byteLength(value, 'utf8') > AUTHENTICATOR_MAX_URI_LENGTH) return {
      ok: false,
      storage: 'memory-only' as const,
      message: 'The clipboard URI is too large; nothing was imported.',
      messageYue: '剪貼簿 URI 太大；冇匯入任何內容。',
    };
    return authenticator.prepare({ source: 'otpauth-uri', uri: value, attemptId: normalizedAttemptId });
  });
  let qrImageImportInFlight = false;
  ipcMain.handle('authenticator:qr-image-import', async (event): Promise<AuthenticatorQrImageImportResult> => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator QR image request from an unknown renderer.'));
    if (qrImageImportInFlight) return { ok: false, reason: 'read-failed', message: 'Another QR image import is already in progress.', messageYue: '另一個 QR 圖片匯入正在進行中。' };
    qrImageImportInFlight = true;
    try {
    if (!(await authenticatorAllowed())) return { ok: false, reason: 'cancelled', message: 'Authenticator QR image import is unavailable in School mode.', messageYue: 'School mode 開啟時，驗證器 QR 圖片匯入暫時用唔到。' };
    const picked = await dialog.showOpenDialog(mainWindow!, { properties: ['openFile'], filters: [{ name: 'QR image', extensions: ['png', 'jpg', 'jpeg', 'bmp'] }] });
    if (picked.canceled || picked.filePaths.length !== 1) return { ok: false, reason: 'cancelled', message: 'QR image import was cancelled; no file was read.', messageYue: 'QR 圖片匯入已取消；冇讀取檔案。' };
    if (!(await authenticatorAllowed())) return { ok: false, reason: 'cancelled', message: 'Authenticator QR image import is unavailable in School mode.', messageYue: 'School mode 開啟時，驗證器 QR 圖片匯入暫時用唔到。' };
    const filePath = picked.filePaths[0];
    try {
      const handle = await open(filePath, 'r');
      let bytes: Buffer;
      try {
        const openedInfo = await handle.stat();
        if (!openedInfo.isFile() || openedInfo.size < 1 || openedInfo.size > AUTHENTICATOR_MAX_IMAGE_BYTES) return { ok: false, reason: 'too-large', message: 'The selected image is empty or larger than the 8 MiB QR import limit.', messageYue: '揀選嘅圖片係空白，或者大過 8 MiB QR 匯入限制。' };
        const bounded = Buffer.allocUnsafe(AUTHENTICATOR_MAX_IMAGE_BYTES + 1);
        let received = 0;
        while (received < bounded.byteLength) {
          const result = await handle.read(bounded, received, bounded.byteLength - received, received);
          if (result.bytesRead === 0) break;
          received += result.bytesRead;
        }
        if (received > AUTHENTICATOR_MAX_IMAGE_BYTES) return { ok: false, reason: 'too-large', message: 'The selected image exceeded the 8 MiB QR import limit while reading.', messageYue: '讀取時發現揀選嘅圖片超出 8 MiB QR 匯入限制。' };
        bytes = bounded.subarray(0, received);
      } finally {
        await handle.close();
      }
      const declaredSize = inspectAuthenticatorImageDimensions(bytes);
      if (!declaredSize || !Number.isInteger(declaredSize.width) || !Number.isInteger(declaredSize.height) || declaredSize.width < 1 || declaredSize.height < 1 || declaredSize.width > 4_096 || declaredSize.height > 4_096 || declaredSize.width * declaredSize.height > 16_777_216) return { ok: false, reason: 'unsupported-image', message: 'The selected image format or dimensions are outside the safe QR import limit.', messageYue: '揀選嘅圖片格式或者尺寸超出安全 QR 匯入限制。' };
      const image = nativeImage.createFromBuffer(bytes, { scaleFactor: 1 });
      if (image.isEmpty()) return { ok: false, reason: 'unsupported-image', message: 'The selected file is not a decodable local image.', messageYue: '揀選嘅檔案唔係可以喺本機解碼嘅圖片。' };
      const size = image.getSize();
      if (!(await authenticatorAllowed())) return { ok: false, reason: 'cancelled', message: 'Authenticator QR image import is unavailable in School mode.', messageYue: 'School mode 開啟時，驗證器 QR 圖片匯入暫時用唔到。' };
      if (!Number.isInteger(size.width) || !Number.isInteger(size.height) || size.width < 1 || size.height < 1 || size.width > 4_096 || size.height > 4_096 || size.width * size.height > 16_777_216) return { ok: false, reason: 'unsupported-image', message: 'The decoded image is outside the safe QR import limit.', messageYue: '解碼後圖片超出安全 QR 匯入限制。' };
      const result = decodeAuthenticatorQrBitmap({ width: size.width, height: size.height, data: image.toBitmap() });
      return result;
    } catch {
      return { ok: false, reason: 'read-failed', message: 'The selected image could not be read locally.', messageYue: '揀選嘅圖片未能喺本機讀取。' };
    }
    } finally {
      qrImageImportInFlight = false;
    }
  });
  ipcMain.handle('authenticator:preview', (event, request: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator preview request from an unknown renderer.'));
    // The renderer may submit only the typed preview fields. A deterministic
    // test clock is intentionally stripped at this privileged boundary.
    const candidate = request && typeof request === 'object' ? { ...(request as Record<string, unknown>), atMs: undefined } : request;
    return authenticatorAllowed().then((allowed) => allowed
      ? authenticator.preview(candidate as AuthenticatorPreviewRequest)
      : authenticatorRestrictedPreview());
  });
  ipcMain.handle('authenticator:prepare', (event, request: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator registration request from an unknown renderer.'));
    return authenticatorAllowed().then((allowed) => allowed
      ? authenticator.prepare(request as AuthenticatorRegistrationRequest)
      : authenticatorRestrictedRegistration());
  });
  ipcMain.handle('authenticator:cancel-attempt', (event, attemptId: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator cancellation request from an unknown renderer.'));
    // This is an internal lost-response cleanup route. It remains callable
    // during School mode so a pending plaintext pairing can be cleared rather
    // than waiting for its expiry; it never lists, returns, or saves data.
    authenticator.cancelAttempt(typeof attemptId === 'string' ? attemptId : '');
    return undefined;
  });
  ipcMain.handle('authenticator:confirm', (event, request: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator pairing request from an unknown renderer.'));
    return authenticatorAllowed().then((allowed) => allowed
      ? authenticator.confirm(request as AuthenticatorRegistrationConfirmRequest)
      : authenticatorRestrictedMutation());
  });
  ipcMain.handle('authenticator:cancel', (event, registrationId: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator cancellation request from an unknown renderer.'));
    return authenticatorAllowed().then((allowed) => { if (allowed) authenticator.cancel(typeof registrationId === 'string' ? registrationId : ''); });
  });
  ipcMain.handle('authenticator:list', (event) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator list request from an unknown renderer.'));
    return authenticatorAllowed().then((allowed) => allowed ? authenticator.list() : authenticatorRestrictedList());
  });
  ipcMain.handle('authenticator:rename', (event, request: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator rename request from an unknown renderer.'));
    return authenticatorAllowed().then((allowed) => allowed ? authenticator.rename(request as AuthenticatorRenameRequest) : authenticatorRestrictedMutation());
  });
  ipcMain.handle('authenticator:set-group', (event, request: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator group request from an unknown renderer.'));
    return authenticatorAllowed().then((allowed) => allowed ? authenticator.setGroup(request as AuthenticatorGroupRequest) : authenticatorRestrictedMutation());
  });
  ipcMain.handle('authenticator:reorder', (event, request: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator reorder request from an unknown renderer.'));
    return authenticatorAllowed().then((allowed) => allowed ? authenticator.reorder(request as AuthenticatorReorderRequest) : authenticatorRestrictedMutation());
  });
  ipcMain.handle('authenticator:delete', (event, request: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator delete request from an unknown renderer.'));
    return authenticatorAllowed().then((allowed) => allowed ? authenticator.remove(request as AuthenticatorDeleteRequest) : authenticatorRestrictedDelete());
  });
  ipcMain.handle('authenticator:bulk-delete', (event, request: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator bulk-delete request from an unknown renderer.'));
    return authenticatorAllowed().then((allowed) => allowed ? authenticator.bulkRemove(request as AuthenticatorBulkDeleteRequest) : authenticatorRestrictedBulkDelete());
  });
  ipcMain.handle('authenticator:export', (event, request: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked authenticator export request from an unknown renderer.'));
    return authenticatorAllowed().then((allowed) => allowed ? authenticator.export(request as AuthenticatorExportRequest) : authenticatorRestrictedExport());
  });
  ipcMain.handle('locks:load', (event) => event.sender === mainWindow?.webContents ? lockSupport.loadLocks() : Promise.reject(new Error('Blocked lock request from an unknown renderer.')));
  ipcMain.handle('locks:set', (event, request: LockSetRequest) => event.sender === mainWindow?.webContents ? lockSupport.setLock(request) : Promise.reject(new Error('Blocked lock request from an unknown renderer.')));
  ipcMain.handle('locks:unlock', (event, request: LockCredentialRequest) => event.sender === mainWindow?.webContents ? lockSupport.unlock(request) : Promise.reject(new Error('Blocked lock request from an unknown renderer.')));
  ipcMain.handle('locks:lock-again', (event, target: LockTarget) => event.sender === mainWindow?.webContents ? lockSupport.lockAgain(target) : Promise.reject(new Error('Blocked lock request from an unknown renderer.')));
  ipcMain.handle('locks:remove', (event, request: LockCredentialRequest) => event.sender === mainWindow?.webContents ? lockSupport.remove(request) : Promise.reject(new Error('Blocked lock request from an unknown renderer.')));
  ipcMain.handle('support:load', (event) => event.sender === mainWindow?.webContents ? lockSupport.loadSupport() : Promise.reject(new Error('Blocked Support Tickets request from an unknown renderer.')));
  ipcMain.handle('support:create', (event, request: SupportTicketCreateRequest) => event.sender === mainWindow?.webContents ? lockSupport.createTicket(request) : Promise.reject(new Error('Blocked Support Tickets request from an unknown renderer.')));
  ipcMain.handle('support:advance', (event, ticketId: unknown) => event.sender === mainWindow?.webContents && typeof ticketId === 'string' ? lockSupport.advanceTicket(ticketId) : Promise.reject(new Error('Blocked Support Tickets request from an unknown renderer.')));
  ipcMain.handle('support:open-recovery-folder', (event) => event.sender === mainWindow?.webContents ? lockSupport.openRecoveryFolder() : Promise.reject(new Error('Blocked Support Tickets request from an unknown renderer.')));
  ipcMain.handle('history:protected-status', async (event) => event.sender === mainWindow?.webContents ? historyAccess.status() : { available: false, configured: false, unlocked: false, reason: 'unavailable' as const });
  const inaccessibleHistoryStatus = { available: false, configured: false, unlocked: false, reason: 'unavailable' as const };
  ipcMain.handle('history:protected-unlock', async (event, request: unknown) => {
    if (event.sender !== mainWindow?.webContents) return { ok: false, status: inaccessibleHistoryStatus, message: 'Blocked protected history request from an unknown renderer.' };
    if (await schoolMode.isRestricted()) return { ok: false, status: inaccessibleHistoryStatus, message: 'Protected local history is unavailable while the shared restricted mode is enabled or unavailable.' };
    return historyAccess.unlock(request as HistoryAccessUnlockRequest);
  });
  ipcMain.handle('history:protected-lock-again', (event) => event.sender === mainWindow?.webContents ? historyAccess.lock() : { ok: false, status: { available: false, configured: false, unlocked: false, reason: 'unavailable' as const }, message: 'Blocked protected history request from an unknown renderer.' });
  ipcMain.handle('history:list', async (event) => {
    if (event.sender !== mainWindow?.webContents) return [];
    const token = await historyToken();
    if (token === null) return [];
    const result = await history.list();
    return historyAccess.isSessionCurrent(token) ? result : [];
  });
  ipcMain.handle('history:export', async (event, format: HistoryExportFormat) => {
    if (event.sender !== mainWindow?.webContents) return '';
    const token = await historyToken();
    if (token === null) return '';
    const result = await history.export(format);
    return historyAccess.isSessionCurrent(token) ? result : '';
  });
  ipcMain.handle('history:archive', async (event, request: unknown) => {
    if (event.sender !== mainWindow?.webContents) return Promise.reject(new Error('Blocked history archive request from an unknown renderer.'));
    const token = await historyToken();
    if (token === null) return Promise.reject(new Error('Protected local history is locked or unavailable.'));
    const result = await history.archive(request as Parameters<HistoryService['archive']>[0]);
    if (!historyAccess.isSessionCurrent(token)) throw new Error('Protected local history became unavailable before the archive was returned.');
    return result;
  });
  ipcMain.handle('history:revisions', async (event) => {
    if (event.sender !== mainWindow?.webContents) return [];
    const token = await historyToken();
    if (token === null) return [];
    const result = await history.revisions();
    return historyAccess.isSessionCurrent(token) ? result : [];
  });
  ipcMain.handle('history:diff', async (event, revisionId: unknown) => {
    if (event.sender !== mainWindow?.webContents || typeof revisionId !== 'string') return '';
    const token = await historyToken();
    if (token === null) return '';
    const result = await history.diff(revisionId);
    return historyAccess.isSessionCurrent(token) ? result : '';
  });
  ipcMain.handle('history:label', (event, revisionId: unknown, requestedLabel: unknown) => event.sender === mainWindow?.webContents && typeof revisionId === 'string' && typeof requestedLabel === 'string'
    ? stateMutationQueue.run(async () => { const token = await historyToken(); if (token === null) return { ok: false, message: 'Protected local history is locked or unavailable.' }; const result = await history.label(revisionId, requestedLabel); return historyAccess.isSessionCurrent(token) ? result : { ok: false, message: 'Protected local history became unavailable before the label was returned.' }; })
    : { ok: false, message: 'Blocked local history label request from an unknown renderer.' });
  ipcMain.handle('history:restore', async (event, revisionId: unknown) => {
    if (event.sender !== mainWindow?.webContents || typeof revisionId !== 'string') {
      return { ok: false, message: 'Blocked local history restore request from an unknown renderer.' };
    }
    const historySession = await historyToken();
    if (historySession === null) return { ok: false, message: 'Protected local history is locked or unavailable.' };
    if (await lockSupport.hasLockedAppearanceProperties()) {
      return { ok: false, message: 'History restore is paused while an appearance property lock is active. Unlock the affected property before restoring a revision.' };
    }
    const barrier = stateMutationQueue.beginBarrier();
    return stateMutationQueue.runBarrier(async () => {
      try {
        const result = historyAccess.isSessionCurrent(historySession) ? await history.restore(revisionId) : { ok: false, message: 'Protected local history became unavailable before restore started.' };
        if (result.ok && !historyAccess.isSessionCurrent(historySession)) return { ok: false, message: 'Protected local history became unavailable while restore was running; refresh the view before retrying.' };
        if (result.ok) await scheduler.reloadFromDisk();
        return result;
      } finally {
        stateMutationQueue.endBarrier(barrier);
      }
    });
  });
  ipcMain.handle('workspace:load', () => workspace.load());
  ipcMain.handle('workspace:save', (_event, value: TabWorkspace) => stateMutationQueue.run(() => workspace.save(value)));
  ipcMain.handle('workspace:reset', () => stateMutationQueue.run(() => workspace.reset()));
  ipcMain.handle('workspace:export', () => workspace.export());
  ipcMain.handle('workspace:import', (_event, document: string) => stateMutationQueue.run(() => workspace.import(document)));
  ipcMain.handle('appearance:load', (event) => event.sender === mainWindow?.webContents ? stateMutationQueue.run(() => appearance.load()) : Promise.reject(new Error('Blocked appearance request from an unknown renderer.')));
  ipcMain.handle('appearance:set-element', (event, key: ElementKey, override: ElementOverride) => event.sender === mainWindow?.webContents ? stateMutationQueue.run(() => appearance.setElement(key, override)) : Promise.reject(new Error('Blocked appearance request from an unknown renderer.')));
  ipcMain.handle('appearance:reset-element', (event, key: ElementKey) => event.sender === mainWindow?.webContents ? stateMutationQueue.run(() => appearance.resetElement(key)) : Promise.reject(new Error('Blocked appearance request from an unknown renderer.')));
  ipcMain.handle('appearance:reset-all', (event) => event.sender === mainWindow?.webContents ? stateMutationQueue.run(() => appearance.resetAll()) : Promise.reject(new Error('Blocked appearance request from an unknown renderer.')));
  ipcMain.handle('appearance:export', (event) => event.sender === mainWindow?.webContents ? stateMutationQueue.run(() => appearance.export()) : Promise.reject(new Error('Blocked appearance request from an unknown renderer.')));
  ipcMain.handle('appearance:import', (event, payload: string) => event.sender === mainWindow?.webContents ? stateMutationQueue.run(() => appearance.import(payload)) : Promise.reject(new Error('Blocked appearance request from an unknown renderer.')));
  ipcMain.handle('schedule:load', () => stateMutationQueue.run(() => scheduler.reloadFromDisk()));
  ipcMain.handle('schedule:save', (_event, config: unknown) => stateMutationQueue.run(() => scheduler.save(config)));
  ipcMain.handle('schedule:run-now', (_event, task: unknown) => scheduler.runNow(scheduleTaskSchema.parse(task)));
  ipcMain.handle('dim-sum:startup', () => dimSum.startup());
  ipcMain.handle('external-editor:detect', (event) => event.sender === mainWindow?.webContents ? externalEditor.detect() : []);
  ipcMain.handle('external-editor:preference', (event) => event.sender === mainWindow?.webContents ? externalEditor.preference() : { editor: 'vscode', edition: 'unknown' as const });
  ipcMain.handle('external-editor:set-preference', (event, value: ExternalEditorPreference) => event.sender === mainWindow?.webContents ? stateMutationQueue.run(() => externalEditor.setPreference(value)) : { editor: 'vscode', edition: 'unknown' as const });
  ipcMain.handle('external-editor:add-validated', (event) => event.sender === mainWindow?.webContents ? stateMutationQueue.run(() => externalEditor.addValidated()) : null);
  ipcMain.handle('external-editor:open-export', (event, request: ExternalEditorOpenRequest) => event.sender === mainWindow?.webContents ? externalEditor.openExport(request) : { ok: false as const, reason: 'bridge-unavailable' as const, message: 'Blocked external editor request from an unknown renderer.' });
  ipcMain.handle('external-editor:open-archive', (event, request: unknown) => event.sender === mainWindow?.webContents ? externalEditor.openArchive(request) : { ok: false as const, reason: 'bridge-unavailable' as const, message: 'Blocked external editor request from an unknown renderer.' });
  ipcMain.handle('external-navigation:open-commit', (event, commit: unknown) => event.sender === mainWindow?.webContents
    ? externalNavigation.openCommit(commit)
    : {
        ok: false,
        appId: 'ding-ding-app-store',
        message: 'Blocked commit navigation from an unknown renderer.',
        messageYue: '已阻擋來自未知介面嘅 commit 導覽。',
      });
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:toggle-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize(); else mainWindow?.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());

  void stateMutationQueue.run(() => installed.discover()).catch(() => undefined);
  // ScheduleService may migrate and persist its file during startup. Keep
  // that write behind the same barrier as history restore and renderer saves.
  await stateMutationQueue.run(() => scheduler.start());
  await managedUpdates.restore();
  void stateMutationQueue.run(() => managedUpdates.checkAll());
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

process.on('uncaughtException', (error) => {
  console.error(`Ding Ding App Store startup/runtime exception: ${error.message}`);
});
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error(`Ding Ding App Store startup/runtime rejection: ${message}`);
});
