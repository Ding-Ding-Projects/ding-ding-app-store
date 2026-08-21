import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { adapterSupportsLaunch, INSTALL_ADAPTERS } from '../src/main/install-adapters';

async function source(relative: string): Promise<string> {
  return await readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
}

function assertExactMarker(relative: string, contents: string, marker: string): void {
  if (!contents.split(/\r?\n/).some((line) => line.includes(marker) && !line.trimStart().startsWith('//'))) {
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

  it('keeps update completion bound to independently observed installed version and the shared operation barrier', async () => {
    const installed = await source('src/main/installed-service.ts');
    const updates = await source('src/main/managed-update-service.ts');
    for (const marker of ['requiresInstalledVersionProof = true', 'semver.eq(requested, observed)', 'selectOwnedRegistryEntry(']) {
      assertExactMarker('src/main/installed-service.ts', installed, marker);
      expect(() => assertExactMarker('src/main/installed-service.ts', installed.replace(marker, ''), marker)).toThrow(/missing exact live launch marker/);
    }
    assertExactMarker('src/main/managed-update-service.ts', updates, 'if (this.conflictingOperation(request.appId))');
    expect(() => assertExactMarker('src/main/managed-update-service.ts', updates.replace('if (this.conflictingOperation(request.appId))', ''), 'if (this.conflictingOperation(request.appId))')).toThrow(/missing exact live launch marker/);
  });
});
