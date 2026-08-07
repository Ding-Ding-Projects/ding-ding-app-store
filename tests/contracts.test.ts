import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (relative: string) => readFile(new URL(relative, root), 'utf8');

describe('catalog contract', () => {
  it('ships a versioned public Ding Ding Projects catalog', async () => {
    const catalog = JSON.parse(await read('data/catalog.v1.json')) as { schemaVersion: number; organization: string; apps: Array<Record<string, unknown>> };
    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.organization).toBe('Ding-Ding-Projects');
    expect(catalog.apps.length).toBeGreaterThanOrEqual(24);
    expect(new Set(catalog.apps.map((app) => app.id)).size).toBe(catalog.apps.length);
  });

  it('excludes private, infrastructure, probe, and self-install records', async () => {
    const catalog = JSON.parse(await read('data/catalog.v1.json')) as { apps: Array<{ repository: string }> };
    const repositories = new Set(catalog.apps.map((app) => app.repository));
    for (const excluded of ['agent-global-memory', 'encrypted-public-builder-skill', 'line5-counter', 'chret-machine', 'ding-ding-app-store', 'material-bluemap-ci-probe', 'pae-mun', 'vs2022', 'README', 'dim-sum-photos']) {
      expect(repositories.has(excluded)).toBe(false);
    }
  });

  it('allows executable installs only through reviewed package kinds', async () => {
    const catalog = JSON.parse(await read('data/catalog.v1.json')) as { apps: Array<{ availability: string; packageType: string; assetPattern: string | null }> };
    for (const app of catalog.apps.filter((record) => record.availability === 'installable')) {
      expect(['squirrel', 'msi', 'archive']).toContain(app.packageType);
      expect(app.assetPattern).toBeTruthy();
    }
  });
});

describe('desktop security and update contracts', () => {
  it('isolates the renderer and denies navigation, windows, and permissions', async () => {
    const main = await read('src/main/main.ts');
    expect(main).toContain('contextIsolation: true');
    expect(main).toContain('nodeIntegration: false');
    expect(main).toContain('sandbox: true');
    expect(main).toContain("setWindowOpenHandler(() => ({ action: 'deny' }))");
    expect(main).toContain('setPermissionRequestHandler');
    expect(main).toContain('setPermissionCheckHandler');
    expect(main).toContain("'index.cjs'");
  });

  it('exposes typed actions without a generic command bridge', async () => {
    const preload = await read('src/preload/index.ts');
    expect(preload).toContain("contextBridge.exposeInMainWorld('dingDingStore'");
    expect(preload).not.toMatch(/exec|shell|spawn|command:run|filesystem/i);
    expect(preload).toContain("ipcRenderer.invoke('operations:install'");
    expect(preload).toContain("ipcRenderer.invoke('operations:uninstall'");
  });

  it('requires asset digest, bounded bytes, fixed shell-free launch, and exact confirmations', async () => {
    const operations = await read('src/main/operation-service.ts');
    expect(operations).toContain("/^sha256:");
    expect(operations).toContain('MAX_DOWNLOAD_BYTES');
    expect(operations).toContain('shell: false');
    expect(operations).toContain('windowsHide: true');
    expect(operations).toContain('`INSTALL ${record.displayName}`');
    expect(operations).toContain('`UNINSTALL ${record.displayName}`');
  });

  it('keeps self-updates unsigned, staged, and user-restarted', async () => {
    const updater = await read('src/main/update-service.ts');
    expect(updater).toContain("const RELEASES_URL = `${FEED_URL}RELEASES`");
    expect(updater).toContain("if (this.state.status !== 'available')");
    expect(updater).toContain('autoUpdater.setFeedURL({ url: FEED_URL })');
    expect(updater).toContain("status: 'ready'");
    expect(updater).toContain('unsigned: true');
    expect(updater).toContain('autoUpdater.quitAndInstall()');
  });

  it('packages only unsigned Squirrel.Windows output', async () => {
    const manifest = JSON.parse(await read('package.json')) as { build: Record<string, any> };
    expect(manifest.build.win.target[0].target).toBe('squirrel');
    expect(manifest.build.win.forceCodeSigning).toBe(false);
    expect(manifest.build.win.signExecutable).toBe(false);
    expect(manifest.build.win.signAndEditExecutable).toBe(false);
    expect(manifest.build.squirrelWindows.msi).toBe(false);
  });
});

describe('visible product contracts', () => {
  it('ships catalog, installed, updates, docs, activity, and settings tabs', async () => {
    const app = await read('src/renderer/App.tsx');
    for (const tab of ["'catalog'", "'installed'", "'updates'", "'docs'", "'activity'", "'settings'"]) expect(app).toContain(tab);
    expect(app).toContain("event.ctrlKey && event.shiftKey");
    expect(app).toContain("event.key.toLowerCase() === 'f'");
  });

  it('ships full regex-builder primitives and bounded sample evaluation', async () => {
    const app = await read('src/renderer/App.tsx');
    for (const primitive of ['Literal', 'Class', 'Anchor', 'Group', 'Alternation', 'Quantifier']) expect(app).toContain(primitive);
    expect(app).toContain('slice(0, 160)');
    expect(app).toContain('slice(0, 10_000)');
  });

  it('ships all language modes and two independent funny-level controls', async () => {
    const app = await read('src/renderer/App.tsx');
    expect(app).toContain('English funny level');
    expect(app).toContain('粵語 funny level');
    expect(app).toContain('English + 香港粵語');
  });

  it('requires two keys and a completed slider for uninstall', async () => {
    const app = await read('src/renderer/App.tsx');
    expect(app).toContain('firstKey && secondKey && slider === 100');
    expect(app).toContain('Emergency exit · 緊急離開');
  });
});

describe('activity history and export', () => {
  it('records every install, build, and uninstall outcome through one main-process path', async () => {
    const operations = await read('src/main/operation-service.ts');
    expect(operations).toContain("private readonly history: HistoryService");
    expect(operations).toContain('private async finish(');
    expect(operations.match(/this\.finish\(record, 'install'/g)?.length).toBeGreaterThanOrEqual(5);
    expect(operations.match(/this\.finish\(record, 'build'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(operations.match(/this\.finish\(record, 'uninstall'/g)?.length).toBeGreaterThanOrEqual(4);
    expect(operations).not.toMatch(/return \{ ok:/);
  });

  it('bounds stored history and exports JSON, CSV, and Markdown', async () => {
    const history = await read('src/main/history-service.ts');
    expect(history).toContain('MAX_ENTRIES = 500');
    expect(history).toContain(".slice(-MAX_ENTRIES)");
    expect(history).toContain("format === 'json'");
    expect(history).toContain("format === 'csv'");
    expect(history).toContain('| When | Action | App | Result | Message |');
  });

  it('exposes history over the typed bridge only, never a generic channel', async () => {
    const preload = await read('src/preload/index.ts');
    expect(preload).toContain("ipcRenderer.invoke('history:list')");
    expect(preload).toContain("ipcRenderer.invoke('history:export', format)");
    const main = await read('src/main/main.ts');
    expect(main).toContain("ipcMain.handle('history:list'");
    expect(main).toContain("ipcMain.handle('history:export'");
  });

  it('renders real activity with search, action/result/date filters, and export controls', async () => {
    const app = await read('src/renderer/App.tsx');
    expect(app).toContain('function HistoryPanel(');
    expect(app).toContain("Search activity by app, action, or message");
    expect(app).toContain("'all', 'install', 'build', 'uninstall'");
    expect(app).toContain("'all', 'ok', 'failed'");
    expect(app).toContain("'all', 'today', '7d', '30d'");
    expect(app).toContain('Copy JSON');
    expect(app).toContain("void loadHistory()");
  });
});
