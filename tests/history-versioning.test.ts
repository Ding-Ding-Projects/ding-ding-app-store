import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parseHistoryEntry } from '../src/main/history-service';

const read = (file: string) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

describe('local history/version browser contract', () => {
  it('quarantines malformed Activity log lines instead of crashing the list', () => {
    const valid = { id: 'entry-1', appId: 'catalog', displayName: 'Catalog', kind: 'install', ok: true, message: 'Installed', occurredAt: '2026-08-11T13:00:00.000Z' };
    expect(parseHistoryEntry(valid)).toEqual(valid);
    expect(parseHistoryEntry({ ...valid, occurredAt: { nope: true } })).toBeNull();
    expect(parseHistoryEntry({ ...valid, kind: 'unknown' })).toBeNull();
    expect(parseHistoryEntry({ ...valid, message: 'x'.repeat(20_001) })).toBeNull();
  });

  it('keeps revisions local, bounded, and restricted to every non-secret App Store state file', async () => {
    const service = await read('src/main/history-service.ts');
    expect(service).toContain('MAX_REVISIONS = 200');
    expect(service).toContain('MAX_REVISION_BYTES = 2_000_000');
    expect(service).toContain("const REVISION_ID = /^[0-9a-f]{40}$/i");
    for (const file of ['installed-apps.json', 'settings.json', 'workspace.json', 'appearance.json', 'schedule.json', 'schedule-runs.json', 'external-editor.json']) {
      expect(service).toContain(`stateName: '${file}'`);
    }
    expect(service).not.toContain('school-mode');
    expect(service).not.toContain('credential-vault');
    expect(service).toContain("GIT_CONFIG_NOSYSTEM: '1'");
    expect(service).toContain("GIT_CONFIG_NOGLOBAL: '1'");
    expect(service).toContain("['merge-base', '--is-ancestor', id, 'HEAD']");
    expect(service).toContain("['show', source]");
    expect(service).toContain('JSON.parse(content)');
    expect(service).toContain('parseHistoryEntry(JSON.parse(line))');
  });

  it('preserves all user-facing state while excluding credentials and staged update paths', async () => {
    const service = await read('src/main/history-service.ts');
    expect(service).toContain('schedule-runs.v1.json');
    expect(service).toContain('external-editor.v1.json');
    expect(service).not.toContain('managed-updates.v1.json');
    expect(service).not.toContain('update-pending.v1.json');
    expect(service).not.toContain('home-assistant.token.dpapi');
  });

  it('records labels and restores as append-only commits with a before snapshot', async () => {
    const service = await read('src/main/history-service.ts');
    expect(service).toContain("state/labels.v1.json");
    expect(service).toContain('HISTORY_METADATA_FILES');
    expect(service).toContain('const allowed = new Set([...SNAPSHOT_FILES, ...HISTORY_METADATA_FILES])');
    expect(service).toContain("git(this.repositoryPath, ['commit', '-m', `label: ${label}`])");
    expect(service).toContain("await this.snapshotUnlocked(`before restore: ${id}`)");
    expect(service).toContain("await this.snapshotUnlocked(`restore: ${id}`, true)");
    expect(service).toContain('content === null');
    expect(service).toContain('rm(target, { force: true })');
    expect(service).toContain('automatic rollback was incomplete');
    expect(service).toContain('private stateQueue: Promise<void>');
    expect(service).toContain("GIT_CONFIG_NOGLOBAL: '1'");
    expect(service).toContain("GIT_CONFIG_KEY_0: 'core.hooksPath'");
    expect(service).toContain("gitText(this.repositoryPath, ['ls-files', '--', 'state']");
    expect(service).toContain("git(this.repositoryPath, ['add', '--', ...SNAPSHOT_FILES])");
    expect(service).toContain("'--allow-empty'");
  });

  it('exposes typed diff, label, and restore bridge controls and the Activity UI', async () => {
    const contracts = await read('src/shared/contracts.ts');
    const preload = await read('src/preload/index.ts');
    const main = await read('src/main/main.ts');
    const activity = await read('src/renderer/pages/ActivityPage.tsx');
    const settings = await read('src/renderer/state/use-settings.ts');
    const app = await read('src/renderer/App.tsx');
    expect(contracts).toContain('HistoryRevision');
    for (const method of ['history:revisions', 'history:diff', 'history:label', 'history:restore']) expect(preload).toContain(method);
    for (const method of ['history:revisions', 'history:diff', 'history:label', 'history:restore']) expect(main).toContain(method);
    for (const control of ['Local versions', 'View diff', 'Save label', 'Restore local version', 'DestructiveConfirmDialog']) expect(activity.toLowerCase()).toContain(control.toLowerCase());
    expect(settings).toContain('reload(): Promise<void>');
    expect(settings).toContain('Settings could not be reloaded after the local history change');
    expect(app).toContain('reloadHistoryAndSettings');
    expect(await read('src/renderer/state/use-workspace.ts')).toContain('reload(): Promise<void>');
    expect(await read('src/renderer/state/use-appearance.ts')).toContain('reload(): Promise<void>');
    expect(await read('src/renderer/state/use-schedule.ts')).toContain('reload(): Promise<void>');
    expect(app).toContain('workspace.reload()');
    expect(app).toContain('appearance.reload()');
    expect(app).toContain('schedule.reload()');
    expect(app).toContain('loadInstalled()');
    expect(app).toContain('key={settingsReloadKey}');
    expect(main).toContain('StateMutationQueue');
    expect(main).toContain("stateMutationQueue.run(async () => {");
    expect(main).toContain('scheduler.reloadFromDisk()');
    expect(main).toContain("ipcMain.handle('schedule:load', () => stateMutationQueue.run(() => scheduler.reloadFromDisk()))");
    expect(main).toContain("externalEditor.addValidated()) : null");
    expect(main).toContain("ipcMain.handle('appearance:load', () => stateMutationQueue.run(() => appearance.load()))");
    expect(main).toContain("ipcMain.handle('appearance:export', () => stateMutationQueue.run(() => appearance.export()))");
    expect(main).toContain("ipcMain.handle('operations:installed', (_event, discover: unknown = true) => stateMutationQueue.run(() => operations.listInstalled(discover !== false)))");
    expect(main).toContain("ipcMain.handle('operations:cancel-install', (_event, request: InstallCancelRequest) => operations.cancelInstall(request))");
    expect(main).toContain("ipcMain.handle('updates:store-cancel-download', () => updates.cancelDownload())");
    expect(main).toContain("ipcMain.handle('updates:app-cancel', (event, request: unknown) => event.sender === mainWindow?.webContents ? managedUpdates.cancel(request)");
    expect(preload).toContain('installed: (discover = true)');
    expect(app).toContain('loadInstalled(false)');
    expect(main).toContain("void stateMutationQueue.run(() => installed.discover())");
    expect(main).toContain("void stateMutationQueue.run(() => managedUpdates.checkAll())");
    expect(main).toContain('await stateMutationQueue.run(() => scheduler.start())');
    expect(await read('src/main/state-mutation-queue.ts')).toContain('class StateMutationQueue');
    const scheduler = await read('src/main/scheduler.ts');
    expect(scheduler).toContain('async reloadFromDisk(): Promise<ScheduleStatus>');
    expect(scheduler).toContain('runExclusive');
    expect(scheduler).toContain('mutate?: <T>(operation: () => Promise<T>) => Promise<T>');
    expect(scheduler).toContain('task.runToken += 1');
    expect(scheduler).toContain('expectedGeneration !== undefined && expectedGeneration !== this.reloadGeneration');
    expect(activity).toContain('role="gridcell"');
    expect(activity).toContain('aria-selected={selectedDay}');
    expect(activity).toContain('aria-label={label(settings, `${revisionDiffs[revision.id] === undefined ?');
    expect(activity).toContain('aria-label={label(settings, `Diff for ${revision.label}`');
    expect(activity).toContain('Restore revision ${revision.label}');
  });
});
