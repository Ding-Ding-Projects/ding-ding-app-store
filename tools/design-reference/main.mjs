import { app, BrowserWindow, session } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const referenceFile = path.join(root, 'design', 'reference.html');
const evidenceRoot = path.join(root, '.codex', 'verification', 'design-parity');
const registry = JSON.parse(fs.readFileSync(path.join(here, 'scenes.json'), 'utf8'));
const scenes = new Map(registry.scenes.map((scene) => [scene.id, scene]));
const allowedModes = new Set(['reference', 'compare']);

function cliValue(name, fallback) {
  const prefix = `--${name}=`;
  const index = process.argv.findIndex((value) => value === prefix.slice(0, -1) || value.startsWith(prefix));
  if (index < 0) return fallback;
  const value = process.argv[index].startsWith(prefix) ? process.argv[index].slice(prefix.length) : process.argv[index + 1];
  return typeof value === 'string' && value.length <= 64 ? value : fallback;
}

const mode = cliValue('mode', 'reference');
const sceneId = cliValue('scene', 'catalog');
if (!allowedModes.has(mode)) throw new Error(`Unsupported design-reference mode: ${mode}`);
if (!scenes.has(sceneId)) throw new Error(`Unknown design-reference scene: ${sceneId}`);
const scene = scenes.get(sceneId);
const comparisonFile = path.join(evidenceRoot, sceneId, 'comparison.png');

function referenceQuery() {
  const query = { page: scene.page, lang: scene.locale, theme: scene.theme, mode: 'reference', row: scene.id };
  if (scene.settings) query.settings = scene.settings;
  if (scene.overlay) query.overlay = scene.overlay;
  return query;
}

function denyNavigation(contents, allowedFile) {
  contents.setWindowOpenHandler(() => ({ action: 'deny' }));
  contents.on('will-navigate', (event, url) => {
    const allowedUrl = pathToFileURL(allowedFile).href;
    if (url !== allowedUrl && !url.startsWith(`${allowedUrl}?`)) event.preventDefault();
  });
  contents.on('will-redirect', (event) => event.preventDefault());
  contents.on('did-attach-webview', (event) => event.preventDefault());
}

function createWindow() {
  const [width, height] = scene.viewport;
  const targetFile = mode === 'compare' ? comparisonFile : referenceFile;
  const viewer = new BrowserWindow({
    width,
    height,
    useContentSize: true,
    resizable: false,
    title: mode === 'compare' ? `Ding Ding App Store · Comparison · ${scene.id}` : `Ding Ding App Store · Reference · ${scene.id}`,
    backgroundColor: scene.theme === 'dark' ? '#1c1b1f' : '#fffbfe',
    frame: false,
    show: false,
    webPreferences: {
      partition: `design-reference-${mode}`,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      navigateOnDragDrop: false,
      spellcheck: false,
      zoomFactor: scene.scale,
    },
  });
  denyNavigation(viewer.webContents, targetFile);
  if (mode === 'compare') viewer.loadFile(comparisonFile);
  else viewer.loadFile(referenceFile, { query: referenceQuery() });
  viewer.once('ready-to-show', () => viewer.showInactive());
  return viewer;
}

app.whenReady().then(() => {
  if (mode === 'compare') {
    const resolved = path.resolve(comparisonFile);
    const expectedParent = `${path.resolve(evidenceRoot)}${path.sep}`;
    if (!resolved.startsWith(expectedParent) || !fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      throw new Error(`Comparison evidence is unavailable for scene ${scene.id}; run the final parity capture first.`);
    }
  }
  const lockedSession = session.fromPartition(`design-reference-${mode}`, { cache: false });
  lockedSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  lockedSession.setPermissionCheckHandler(() => false);
  lockedSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true }));
  const viewer = createWindow();
  viewer.on('closed', () => { if (process.platform !== 'darwin') app.quit(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
