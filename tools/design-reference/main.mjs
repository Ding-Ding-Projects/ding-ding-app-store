import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const referenceFile = path.join(root, 'design', 'reference.html');
const evidenceRoot = path.join(root, 'design', 'evidence');
const allowedModes = new Set(['reference', 'compare']);
const allowedRows = new Map([
  ['shell', 'shell.png'],
  ['catalog', 'catalog.png'],
  ['settings', 'settings.png'],
  ['overlays', 'overlays.png'],
]);

function cliValue(name, fallback) {
  const prefix = `--${name}=`;
  const index = process.argv.findIndex((value) => value === prefix.slice(0, -1) || value.startsWith(prefix));
  if (index < 0) return fallback;
  const value = process.argv[index].startsWith(prefix) ? process.argv[index].slice(prefix.length) : process.argv[index + 1];
  return typeof value === 'string' && value.length <= 64 ? value : fallback;
}

const mode = allowedModes.has(cliValue('mode', 'reference')) ? cliValue('mode', 'reference') : 'reference';
const row = allowedRows.has(cliValue('row', 'shell')) ? cliValue('row', 'shell') : 'shell';

function denyNavigation(contents) {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    const allowedUrl = pathToFileURL(referenceFile).href;
    if (url !== allowedUrl && !url.startsWith(`${allowedUrl}?`)) event.preventDefault();
  });
  contents.on('will-redirect', (event) => event.preventDefault());
  contents.on('did-attach-webview', (event) => event.preventDefault());
}

function createWindow() {
  const viewer = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 360,
    minHeight: 520,
    title: mode === 'compare' ? `Ding Ding App Store · Compare ${row}` : 'Ding Ding App Store · Design reference',
    backgroundColor: '#fffbfe',
    frame: false,
    webPreferences: {
      partition: 'design-reference',
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      navigateOnDragDrop: false,
      spellcheck: false,
    },
  });
  denyNavigation(viewer.webContents);
  const query = new URLSearchParams({ mode, row });
  // The renderer receives only allowlisted display identifiers. It never receives the fixed evidence path.
  viewer.loadFile(referenceFile, { query: Object.fromEntries(query.entries()) });
  return viewer;
}

app.whenReady().then(() => {
  const lockedSession = session.fromPartition('design-reference', { cache: false });
  lockedSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  lockedSession.setPermissionCheckHandler(() => false);
  lockedSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
  // Keep this lookup task-owned and fixed. It is intentionally not exposed through IPC or a renderer URL.
  const evidenceFile = path.join(evidenceRoot, allowedRows.get(row));
  if (mode === 'compare' && !evidenceFile.startsWith(evidenceRoot)) throw new Error('Invalid evidence row');
  const viewer = createWindow();
  viewer.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  viewer.webContents.session.setPermissionCheckHandler(() => false);
  viewer.on('closed', () => { if (process.platform !== 'darwin') app.quit(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
