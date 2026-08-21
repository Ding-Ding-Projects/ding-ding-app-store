import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { adapterSupportsLaunch, INSTALL_ADAPTERS } from '../src/main/install-adapters';

async function source(relative: string): Promise<string> {
  return await readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
}

function assertExactMarker(relative: string, contents: string, marker: string): void {
  let blockComment = false;
  let lineComment = false;
  let quote: string | null = null;
  let escapedQuote = false;
  const live = Array<boolean>(contents.length).fill(true);
  for (let index = 0; index < contents.length; index += 1) {
    const character = contents[index];
    const next = contents[index + 1];
    if (lineComment) {
      live[index] = false;
      if (character === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      live[index] = false;
      if (character === '*' && next === '/') blockComment = false;
      continue;
    }
    if (quote) {
      live[index] = false;
      if (escapedQuote) escapedQuote = false;
      else if (character === '\\') escapedQuote = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '/' && next === '*') { live[index] = false; blockComment = true; continue; }
    if (character === '/' && next === '/') {
      live[index] = false;
      lineComment = true;
      continue;
    }
    if (character === '\'' || character === '"' || character === '`') { live[index] = false; quote = character; continue; }
  }
  const firstNeedsBoundary = /[A-Za-z0-9_$]/.test(marker[0] ?? '');
  const lastNeedsBoundary = /[A-Za-z0-9_$]/.test(marker.at(-1) ?? '');
  let found = false;
  let candidate = contents.indexOf(marker);
  while (candidate >= 0) {
    const before = contents[candidate - 1] ?? '';
    const after = contents[candidate + marker.length] ?? '';
    if (live[candidate] && (!firstNeedsBoundary || !/[A-Za-z0-9_$]/.test(before)) && (!lastNeedsBoundary || !/[A-Za-z0-9_$]/.test(after))) { found = true; break; }
    candidate = contents.indexOf(marker, candidate + 1);
  }
  if (!found) {
    throw new Error(`${relative} is missing exact live launch marker: ${marker}`);
  }
}

describe('installed application launch completeness contract', () => {
  it('keeps every typed launch seam present and proves each marker turns red when removed', async () => {
    const required = [
      ['src/shared/contracts.ts', 'launch(request: AppLaunchRequest): Promise<OperationResult>;'],
      ['src/preload/index.ts', "launch: (request: AppLaunchRequest) => ipcRenderer.invoke('operations:launch', request),"],
      ['src/main/main.ts', "ipcMain.handle('operations:launch', async (event, request: AppLaunchRequest) => {"],
      ['src/main/app-launch-service.ts', 'async launch(request: unknown): Promise<OperationResult> {'],
      ['src/renderer/pages/AppsPage.tsx', 'data-launch-action={app.id}'],
      ['src/renderer/App.tsx', "window.dingDingStore.operations.launch({ appId: selectedApp.id, decision: 'launch' })"],
      ['src/renderer/registry.ts', 'entries.push(command(`launch-app:${app.id}`'],
      ['src/renderer/App.tsx', "case 'launch-app': {"],
    ] as const;
    expect(required).toHaveLength(8);
    for (const [relative, marker] of required) {
      const contents = await source(relative);
      assertExactMarker(relative, contents, marker);
      const broken = contents.replace(marker, '');
      expect(() => assertExactMarker(relative, broken, marker)).toThrow(/missing exact live launch marker/);
    }
  });

  it('derives launchability only from consumed reviewed adapter identities', async () => {
    expect(adapterSupportsLaunch('dim-sum-atlas')).toBe(true);
    expect(adapterSupportsLaunch('material-designer')).toBe(true);
    expect(adapterSupportsLaunch('lowlevel-computer-use-mcp')).toBe(false);
    expect(adapterSupportsLaunch('win-ssh-copy-id')).toBe(false);
    const service = await source('src/main/app-launch-service.ts');
    expect(service).toContain('adapter.launchExecutableNames ?? []');
    expect(service).toContain('adapter.launchExecutableRelativePaths ?? []');
    for (const adapter of Object.values(INSTALL_ADAPTERS)) {
      if (!adapter.supported || adapter.family === 'portable-zip') continue;
      for (const name of adapter.launchExecutableNames ?? []) {
        expect(name).toMatch(/^[^\\/:*?"<>|\r\n]{1,128}\.exe$/i);
      }
    }
  });

  it('rebuilds the dynamic launch command list when managed installation state changes', async () => {
    const renderer = await source('src/renderer/App.tsx');
    const marker = "}), [settings, workspace.workspace, appearance.document, schedule.draft, apps, managedAppIds, schoolMode.restricted, schoolMode.state.displayName]);";
    assertExactMarker('src/renderer/App.tsx', renderer, marker);
    expect(() => assertExactMarker('src/renderer/App.tsx', renderer.replace(marker, marker.replace(', managedAppIds', '')), marker)).toThrow(/missing exact live launch marker/);
    expect(renderer).toContain("const message = label(settingsRef.current, 'Launch is unavailable because this application is not a currently managed installation with a reviewed executable identity.'");
    expect(renderer).toContain('announce(message);');
  });

  it('rejects commented and inert-string launch action markers', async () => {
    const renderer = await source('src/renderer/pages/AppsPage.tsx');
    const marker = 'data-launch-action={app.id}';
    assertExactMarker('src/renderer/pages/AppsPage.tsx', renderer, marker);
    expect(() => assertExactMarker('src/renderer/pages/AppsPage.tsx', renderer.replace(marker, `/* ${marker} */`), marker)).toThrow(/missing exact live launch marker/);
    expect(() => assertExactMarker('src/renderer/pages/AppsPage.tsx', renderer.replace(marker, `'${marker}'`), marker)).toThrow(/missing exact live launch marker/);
  });

  it('keeps update completion bound to independently observed installed version and the shared operation barrier', async () => {
    const installed = await source('src/main/installed-service.ts');
    const updates = await source('src/main/managed-update-service.ts');
    for (const marker of ['requiresInstalledVersionProof = true', 'semver.eq(requested, observed)', "adapter.family === 'squirrel'", 'appDirectory', 'selectOwnedRegistryEntry(']) {
      assertExactMarker('src/main/installed-service.ts', installed, marker);
      expect(() => assertExactMarker('src/main/installed-service.ts', installed.replaceAll(marker, ''), marker)).toThrow(/missing exact live launch marker/);
    }
    for (const marker of ["this.coordinator.acquire(request.appId, 'update')", 'stageMatchesCandidate(stage, candidate)', 'checkGenerations']) {
      assertExactMarker('src/main/managed-update-service.ts', updates, marker);
      expect(() => assertExactMarker('src/main/managed-update-service.ts', updates.replaceAll(marker, ''), marker)).toThrow(/missing exact live launch marker/);
    }
    const main = await source('src/main/main.ts');
    const restoreMarker = 'await stateMutationQueue.run(() => managedUpdates.restore());';
    assertExactMarker('src/main/main.ts', main, restoreMarker);
    expect(() => assertExactMarker('src/main/main.ts', main.replace(restoreMarker, ''), restoreMarker)).toThrow(/missing exact live launch marker/);
  });
});
