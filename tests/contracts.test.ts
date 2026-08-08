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
    const catalog = JSON.parse(await read('data/catalog.v1.json')) as { apps: Array<{ availability: string; packageType: string; adapterId: string }> };
    for (const app of catalog.apps.filter((record) => record.availability === 'installable')) {
      expect(['squirrel', 'msi', 'nsis', 'jpackage', 'archive']).toContain(app.packageType);
      expect(app.adapterId).toBeTruthy();
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
    expect(preload).toContain("ipcRenderer.invoke('operations:installed'");
    expect(preload).toContain("ipcRenderer.invoke('history:list'");
    expect(preload).toContain("ipcRenderer.invoke('history:export'");
  });

  it('discovers only allowlisted install records and keeps append-only local history', async () => {
    const installed = await read('src/main/installed-service.ts');
    const history = await read('src/main/history-service.ts');
    expect(installed).toContain('adapterFor(record.id)');
    expect(installed).toContain('exactDisplayNameMatch');
    expect(installed).toContain("source: 'portable-managed'");
    expect(history).toContain("appendFile(this.logPath");
    expect(history).toContain("git(this.repositoryPath, ['commit', '-m', label])");
    expect(history.toLowerCase()).toContain('history snapshots must never fail the operation');
  });

  it('requires asset digest, bounded bytes, fixed shell-free launch, and exact typed decisions', async () => {
    const operations = await read('src/main/operation-service.ts');
    expect(operations).toContain("/^sha256:");
    expect(operations).toContain('MAX_DOWNLOAD_BYTES');
    expect(operations).toContain('shell: false');
    expect(operations).toContain('windowsHide: true');
    expect(operations).toContain("request.decision !== 'install'");
    expect(operations).toContain("request.decision !== 'build'");
    expect(operations).toContain("request.decision !== 'uninstall'");
    expect(operations).toContain("keys.length === 2");
    expect(operations).toContain("keys.includes('appId')");
    expect(operations).toContain("keys.includes('decision')");
    expect(operations).not.toContain('request.confirmation');
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
    expect(app).toContain('surface="activity"');
    expect(app).toContain("runExport('jsonl')");
  });

  it('ships all language modes and two independent funny-level controls', async () => {
    const app = await readRendererSources();
    expect(app).toContain('English funny level');
    expect(app).toContain('粵語 funny level');
    expect(app).toContain('English + 香港粵語');
  });

  it('ships four independent tab searches, safe bulk close, and all four dock edges', async () => {
    const tabRail = await read('src/renderer/components/TabRail.tsx');
    const contracts = await read('src/shared/contracts.ts');
    for (const surface of ['tabs', 'tabs.groups', 'tabs.master', 'tabs.bulk-close', 'tabs.menu']) {
      expect(tabRail).toContain(`surface="${surface}"`);
    }
    expect(tabRail).toContain('surface={`tabs.group.${row.group.id}`}');
    expect(tabRail).toContain('Close tabs containing text');
    expect(tabRail).toContain('Close tabs not containing text');
    expect(tabRail).toContain('Include pinned tabs');
    expect(tabRail).toContain('close-many');
    expect(tabRail).toContain('aria-live="polite"');
    expect(contracts).toContain("z.enum(['left', 'right', 'top', 'bottom'])");
    expect(contracts).toContain('open: z.boolean().default(true)');
  });

  it('re-arms bulk close after preview inputs change and repairs an all-closed import', async () => {
    const tabRail = await read('src/renderer/components/TabRail.tsx');
    const workspaceService = await read('src/main/workspace-service.ts');
    expect(tabRail).toContain("useEffect(() => { setArmed(false); }, [search.state, includePinned, ids.join(',')])");
    expect(workspaceService).toContain('const safeTabs = tabs.some((tab) => tab.open)');
    expect(workspaceService).toContain('index === 0 ? { ...tab, open: true }');
  });

  it('requires two keys and a completed slider for uninstall', async () => {
    const app = await readRendererSources();
    expect(app).toContain('firstKey && secondKey && slider === 100');
    expect(app).toContain('Emergency exit · 緊急離開');
  });

  it('starts install and source-install operations in one click without an install confirmation dialog', async () => {
    const shell = await read('src/renderer/App.tsx');
    const apps = await read('src/renderer/pages/AppsPage.tsx');
    const dialog = await read('src/renderer/components/ActionDialog.tsx');
    expect(shell).toContain("if (kind === 'uninstall')");
    expect(shell).toContain("window.dingDingStore.operations.install({ appId: selectedApp.id, decision: 'install' })");
    expect(shell).toContain("window.dingDingStore.sourceJobs.start({ appId: selectedApp.id, decision: 'build' })");
    expect(apps).toContain("onAction('install', app, event.currentTarget)");
    expect(apps).toContain("onAction('build', app, event.currentTarget)");
    expect(apps).toContain('Install from source');
    expect(dialog).toContain("operations.uninstall({ appId: app.id, decision: 'uninstall' })");
    expect(dialog).toContain('for (const [index, app] of action.apps.entries())');
    expect(dialog).not.toContain('const [confirmation');
    expect(dialog).not.toContain('value={confirmation}');
    expect(dialog).not.toContain('Type <strong>');
    expect(shell).toContain('operationRunningRef.current');
    expect((await read('src/main/operation-service.ts'))).toContain('this.activeOperations.has(operationKey)');
  });
});

describe('split renderer keeps every product contract in its own file', () => {
  it('keeps the shell, its palette shortcut, and no shared query state in App.tsx', async () => {
    const shell = await read('src/renderer/App.tsx');
    expect(shell).toContain('event.ctrlKey && event.shiftKey');
    expect(shell).toContain("event.key.toLowerCase() === 'f'");
    expect(shell).not.toContain('const [query, setQuery]');
    expect(shell).toContain('<SearchContext.Provider');
  });

  it('keeps every regex primitive and both evaluation bounds in the one regex builder', async () => {
    const builder = await read('src/renderer/components/RegexBuilder.tsx');
    for (const primitive of ['Literal', 'Class', 'Anchor', 'Group', 'Alternation', 'Quantifier']) expect(builder).toContain(primitive);
    expect(builder).toContain('slice(0, 160)');
    expect(builder).toContain('slice(0, 10_000)');
  });

  it('keeps the two-key plus full-slider super-confirmation and the emergency exit in the action dialog', async () => {
    const dialog = await read('src/renderer/components/ActionDialog.tsx');
    const superConfirm = await read('src/renderer/components/SuperConfirm.tsx');
    expect(dialog).toContain('firstKey && secondKey && slider === 100');
    expect(dialog).toContain('Emergency exit · 緊急離開');
    expect(superConfirm).toContain('export function SuperConfirm(');
    expect(superConfirm).toContain('autoFocus');
    expect(dialog).toContain('aria-describedby="action-description"');
    expect(dialog).toContain("if (event.key === 'Tab')");
    expect(await read('src/renderer/App.tsx')).toContain('returnFocus.focus()');
  });

  it('keeps the activity filters, search, and export controls on the activity page', async () => {
    const activity = await read('src/renderer/pages/ActivityPage.tsx');
    expect(activity).toContain('Search activity by app, action, or message');
    expect(activity).toContain("'all', 'install', 'build', 'uninstall'");
    expect(activity).toContain("'all', 'ok', 'failed'");
    expect(activity).toContain("'all', 'today', '7d', '30d'");
    expect(activity).toContain('Copy JSON');
  });

  it('gives every search surface its own state and the full regex builder', async () => {
    const search = await read('src/renderer/search.ts');
    expect(search).toContain('export const EMPTY_SEARCH');
    expect(search).toContain('useSurfaceSearch');
    const box = await read('src/renderer/components/SearchBox.tsx');
    expect(box).toContain('useSurfaceSearch(surface)');
    expect(box).toContain('<RegexBuilder');
    const palette = await read('src/renderer/components/CommandPalette.tsx');
    expect(palette).toContain('surface="palette"');
    expect(palette).not.toContain('regexMode={null}');
  });

  it('applies appearance overrides through CSSOM only, never injected style text', async () => {
    const renderer = await readRendererSources();
    expect(renderer).toContain('root.style.setProperty(name, value)');
    expect(renderer).not.toContain('innerHTML');
    expect(renderer).not.toContain("setAttribute('style'");
    expect(renderer).not.toContain('dangerouslySetInnerHTML');
    expect(renderer).not.toContain('setInterval');
  });
});

describe('activity history and export', () => {
  it('records every install, build, and uninstall outcome through one main-process path', async () => {
    const operations = await read('src/main/operation-service.ts');
    expect(operations).toContain("private readonly history: HistoryService");
    expect(operations).toContain('private async finish(');
    expect(operations.match(/this\.finish\(record, 'install'/g)?.length).toBeGreaterThanOrEqual(4);
    expect(operations.match(/this\.finish\(record, 'build'/g)?.length).toBeGreaterThanOrEqual(2);
    expect(operations.match(/this\.finish\(record, 'uninstall'/g)?.length).toBeGreaterThanOrEqual(3);
    expect(operations).toContain("return this.finish(record, 'install'");
    expect(operations).toContain("return this.finish(record, 'build'");
    expect(operations).toContain("return this.finish(record, 'uninstall'");
    expect(operations).toContain('No cancellable installation exists for this application.');
  });

  it('bounds append-only history and exports JSON, JSONL, CSV, and Markdown', async () => {
    const history = await read('src/main/history-service.ts');
    expect(history).toContain('MAX_HISTORY_ENTRIES = 10_000');
    expect(history).toContain(".slice(-MAX_HISTORY_ENTRIES)");
    expect(history).toContain("format === 'json'");
    expect(history).toContain("format === 'jsonl'");
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

describe('one-click adapter coverage record', () => {
  it('names every catalog application, the three blockers, and the separate repair boundary without claiming runtime proof', async () => {
    const catalog = JSON.parse(await read('data/catalog.v1.json')) as { apps: Array<{ displayName: string }> };
    const coverage = await read('docs/features/installation/one-click-installation.md');
    for (const app of catalog.apps) expect(coverage).toContain(`| ${app.displayName} |`);
    for (const requirement of [
      'Twenty-one records',
      'Win SSH Copy ID',
      'Home Assistant Bambu Lab',
      'Photo Viewer',
      'ordinary release installation never imports or invokes the disposable/OpenCode runtime',
      'per-application clean-machine execution remains runtime evidence to collect',
    ]) expect(coverage).toContain(requirement);
  });

  it('keeps primary installer outcomes honest when history, ownership recording, or cleanup fails', async () => {
    const operations = await read('src/main/operation-service.ts');
    expect(operations).toContain('Activity history could not record this outcome.');
    expect(operations).toContain('installer exited successfully, but its exact reviewed installed-app entry was not detected');
    expect(operations).toContain('Temporary staging cleanup failed; the owned staging folder may remain.');
    expect(operations).toMatch(/let result: OperationResult;[\s\S]*await rm\(operationDir[\s\S]*return this\.finish\(record, 'install', result\)/);
  });

  it('does not invoke the future OpenCode repair engine from ordinary one-click installation', async () => {
    const runtime = `${await read('src/renderer/App.tsx')}\n${await read('src/main/operation-service.ts')}\n${await read('src/preload/index.ts')}`;
    expect(runtime).not.toMatch(/opencode|repair engine|terminal simulator/i);
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
