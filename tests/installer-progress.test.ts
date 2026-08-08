import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

async function read(path: string): Promise<string> {
  return await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

describe('installer progress and cancellation boundary', () => {
  it('keeps progress events strictly typed and validated at the bridge', async () => {
    const contracts = await read('src/shared/contracts.ts');
    const preload = await read('src/preload/index.ts');
    const main = await read('src/main/main.ts');
    expect(contracts).toContain('export interface OperationProgressEvent');
    expect(contracts).toContain("'installer-running'");
    expect(contracts).toContain("'cancelling'");
    expect(contracts).toContain("'succeeded', 'failed', 'cancelled', 'unknown'");
    expect(contracts).toContain('operationProgressEventSchema');
    expect(preload).toContain('isOperationProgressEvent');
    expect(preload).toContain("ipcRenderer.invoke('operations:status')");
    expect(preload).toContain("ipcRenderer.on('operations:progress', handler)");
    expect(preload).toContain('event.locked');
    expect(main).toContain("contents.send('operations:progress', event)");
    expect(main).toContain("event.sender === mainWindow?.webContents ? operations.listActive() : []");
  });

  it('reports bytes and keeps cancellation available only before external launch', async () => {
    const operations = await read('src/main/operation-service.ts');
    expect(operations).toContain('onProgress?: (received: number, total: number) => void');
    expect(operations).toContain("this.emitProgress(active, 'downloading'");
    expect(operations).toContain("this.emitProgress(active, 'extracting'");
    expect(operations).toContain("this.emitProgress(active, 'installer-running'");
    expect(operations).toContain("this.emitProgress(active, 'launching'");
    expect(operations).toContain("this.emitProgress(active, 'committing'");
    expect(operations).toContain("active.phase === 'installer-running' || active.phase === 'committing'");
    expect(operations).toContain('operationId: active.operationId');
    expect(operations).toContain('listActive(): OperationProgressEvent[]');
    expect(operations).toContain('throwIfInstallationCancelled(controller.signal)');
    expect(operations).toContain('messageYue');
    expect(operations).toContain("active.phase = 'cancelling'");
    expect(operations).toContain("? 'unknown'");
    expect(operations).toContain("controller.signal.aborted ? 'cancelled'");
  });

  it('renders a nonblocking status, cancel action, and honest locked state in the initiating surface', async () => {
    const app = await read('src/renderer/App.tsx');
    const page = await read('src/renderer/pages/AppsPage.tsx');
    expect(app).toContain('operations.subscribe');
    expect(app).toContain('cancelInstall');
    expect(page).toContain('onCancelInstall');
    expect(page).toContain('role="status"');
    expect(page).toContain("'Installer running; cancellation is unavailable.'");
    expect(page).toContain("'Installer outcome unknown; locked until restart.'");
    expect(page).toContain('operationProgress?.locked === true');
    expect(page).toContain('Cancel install');
    expect(page).toContain('operationPhaseLabel');
    expect(app).toContain('latestOperationIds');
    expect(app).toContain('cancellationFocusTargets');
  });
});
