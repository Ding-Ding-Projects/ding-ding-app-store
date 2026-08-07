import { readdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (relative: string) => readFile(new URL(relative, root), 'utf8');

async function rendererFiles(relative = 'src/renderer/'): Promise<string[]> {
  const entries = await readdir(new URL(relative, root), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) files.push(...(await rendererFiles(`${relative}${entry.name}/`)));
    else if (/\.tsx?$/.test(entry.name)) files.push(`${relative}${entry.name}`);
  }
  return files;
}

/** The renderer is split across many files; product contracts are asserted against every source at once. */
async function readRendererSources(): Promise<string> {
  const paths = (await rendererFiles()).sort();
  const sources = await Promise.all(paths.map((relative) => read(relative)));
  return sources.join('\n');
}

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
    const app = await readRendererSources();
    for (const tab of ["'catalog'", "'installed'", "'updates'", "'docs'", "'activity'", "'settings'"]) expect(app).toContain(tab);
    expect(app).toContain("event.ctrlKey && event.shiftKey");
    expect(app).toContain("event.key.toLowerCase() === 'f'");
  });

  it('ships full regex-builder primitives and bounded sample evaluation', async () => {
    const app = await readRendererSources();
    for (const primitive of ['Literal', 'Class', 'Anchor', 'Group', 'Alternation', 'Quantifier']) expect(app).toContain(primitive);
    expect(app).toContain('slice(0, 160)');
    expect(app).toContain('slice(0, 10_000)');
  });

  it('ships all language modes and two independent funny-level controls', async () => {
    const app = await readRendererSources();
    expect(app).toContain('English funny level');
    expect(app).toContain('粵語 funny level');
    expect(app).toContain('English + 香港粵語');
  });

  it('requires two keys and a completed slider for uninstall', async () => {
    const app = await readRendererSources();
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
    const app = await readRendererSources();
    expect(app).toMatch(/function (HistoryPanel|ActivityPage)\(/);
    expect(app).toContain("Search activity by app, action, or message");
    expect(app).toContain("'all', 'install', 'build', 'uninstall'");
    expect(app).toContain("'all', 'ok', 'failed'");
    expect(app).toContain("'all', 'today', '7d', '30d'");
    expect(app).toContain('Copy JSON');
    expect(app).toMatch(/loadHistory\(\)/);
  });
});

describe('tab, appearance, and schedule bridge contracts', () => {
  it('keeps the renderer away from electron, node, and the network', async () => {
    const renderer = await readRendererSources();
    for (const forbidden of ["from 'electron'", 'require(', 'child_process', 'window.open(', 'fetch(', "new URL('http"]) {
      expect(renderer).not.toContain(forbidden);
    }
  });

  it('adds fifteen typed workspace, appearance, and schedule methods to the bridge', async () => {
    const preload = await read('src/preload/index.ts');
    for (const channel of [
      "ipcRenderer.invoke('workspace:load')",
      "ipcRenderer.invoke('workspace:save', value)",
      "ipcRenderer.invoke('workspace:reset')",
      "ipcRenderer.invoke('workspace:export')",
      "ipcRenderer.invoke('workspace:import', document)",
      "ipcRenderer.invoke('appearance:load')",
      "ipcRenderer.invoke('appearance:set-element', key, override)",
      "ipcRenderer.invoke('appearance:reset-element', key)",
      "ipcRenderer.invoke('appearance:reset-all')",
      "ipcRenderer.invoke('appearance:export')",
      "ipcRenderer.invoke('appearance:import', payload)",
      "ipcRenderer.invoke('schedule:load')",
      "ipcRenderer.invoke('schedule:save', config)",
      "ipcRenderer.invoke('schedule:run-now', task)",
      "ipcRenderer.on('schedule:status', handler)",
    ]) {
      expect(preload).toContain(channel);
    }
    expect(preload).not.toMatch(/exec|shell|spawn|command:run|filesystem/i);
    expect(preload).not.toMatch(/from 'zod'/);
    expect(preload).toContain("import type {");
    expect(preload).not.toMatch(/^import \{[^}]*\} from '\.\.\/shared\/contracts\.js'/m);
  });

  it('wires every new document and schedule handler in the main process', async () => {
    const main = await read('src/main/main.ts');
    for (const channel of [
      'workspace:load', 'workspace:save', 'workspace:reset', 'workspace:export', 'workspace:import',
      'appearance:load', 'appearance:set-element', 'appearance:reset-element', 'appearance:reset-all', 'appearance:export', 'appearance:import',
      'schedule:load', 'schedule:save', 'schedule:run-now',
    ]) {
      expect(main).toContain(`ipcMain.handle('${channel}'`);
    }
    expect(main.match(/ipcMain\.handle\('(workspace|appearance|schedule):/g)?.length).toBe(14);
    expect(main).not.toContain('setInterval');
    expect(main).toContain('scheduler.runStartupCheck()');
  });

  it('keeps every timer in one drift-safe scheduler that never polls', async () => {
    const scheduler = await read('src/main/scheduler.ts');
    expect(scheduler).toContain('powerMonitor');
    expect(scheduler).toContain('clearTimeout');
    expect(scheduler).toContain('generation');
    expect(scheduler).toContain('timer.unref()');
    expect(scheduler).toContain("'catch-up'");
    expect(scheduler).toContain('Previous run was still in progress.');
    expect(scheduler).not.toContain('setInterval');
    expect(scheduler).not.toContain('autoUpdater');
  });

  it('persists tabs, appearance, and schedule beside settings without touching it', async () => {
    const settings = await read('src/main/settings-service.ts');
    expect(settings).toContain("'settings.v1.json'");
    expect(settings).not.toContain('workspace');
    expect(settings).not.toContain('appearance');
    expect(await read('src/main/workspace-service.ts')).toContain("'workspace.v1.json'");
    expect(await read('src/main/appearance-service.ts')).toContain("'appearance.v1.json'");
    const schedule = await read('src/main/schedule-service.ts');
    expect(schedule).toContain("'schedule.v1.json'");
    expect(schedule).toContain("'schedule-runs.v1.json'");
    expect(schedule).toContain('fromPreviousSession: true');
  });

  it('never reports a cached catalog or a development build as a real refresh', async () => {
    const catalog = await read('src/main/catalog-service.ts');
    expect(catalog).toContain('async runScheduled()');
    expect(catalog).toContain("if (snapshot.warning !== null) return { outcome: 'failed', message: snapshot.warning }");
    const updater = await read('src/main/update-service.ts');
    expect(updater).toContain('Development build: no update feed request was made.');
    expect(updater).toMatch(/runScheduled[\s\S]*?this\.check\(\)/);
    expect(updater).not.toMatch(/runScheduled[\s\S]*?this\.download\(\)/);
  });
});
