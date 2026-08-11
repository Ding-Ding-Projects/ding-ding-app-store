import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  parseSchoolModeMutationResult,
  parseSchoolModeSnapshot,
  parseSchoolModeState,
  parseSchoolModeVerifyResult,
} from '../src/preload/school-mode-parser.js';

async function source(relativePath: string) {
  return readFile(path.resolve(relativePath), 'utf8');
}

describe('School mode IPC and renderer completeness guards', () => {
  it('starts parent-directory observation before the window and disposes it during app shutdown', async () => {
    const main = await source('src/main/main.ts');
    const startIndex = main.indexOf('await schoolMode.start()');
    const windowIndex = main.indexOf('mainWindow = createWindow()');
    expect(startIndex).toBeGreaterThan(0);
    expect(windowIndex).toBeGreaterThan(startIndex);
    expect(main).toContain("contents.send('school-mode:changed', snapshot)");
    expect(main).toContain("ipcMain.handle('school-mode:change-credential'");
    expect(main).toContain("app.once('will-quit'");
    expect(main).toContain('unsubscribeSchoolMode();');
    expect(main).toContain('schoolMode.dispose();');
  });

  it('strictly validates and freezes preload snapshots while returning an exact unsubscribe cleanup', async () => {
    const preload = await source('src/preload/index.ts');
    const parser = await source('src/preload/school-mode-parser.ts');
    expect(parser).toContain('SCHOOL_SNAPSHOT_KEYS');
    expect(parser).toContain('hasExactKeys(snapshot, SCHOOL_SNAPSHOT_KEYS)');
    expect(parser).toContain('parseSchoolModeState(snapshot.state)');
    expect(preload).toContain('Object.freeze({');
    expect(preload).toContain("ipcRenderer.on('school-mode:changed', handler)");
    expect(preload).toContain("ipcRenderer.removeListener('school-mode:changed', handler)");
    expect(preload).not.toContain("listener(value as SchoolModeSnapshot)");
  });

  it('executes the strict parser contract for valid, malformed, and overprivileged bridge data', () => {
    const recordId = 'A'.repeat(22);
    const state = {
      schemaVersion: 2,
      recordId,
      revision: 4,
      enabled: false,
      displayName: 'Shared mode',
      unlockKind: 'pin',
    } as const;
    const snapshot = {
      schemaVersion: 1,
      observationSequence: 8,
      state,
      configured: true,
      sync: { status: 'ready', watching: true },
    } as const;
    const parsed = parseSchoolModeSnapshot(snapshot);
    expect(Object.isFrozen(parsed)).toBe(true);
    expect(Object.isFrozen(parsed.state)).toBe(true);
    expect(() => parseSchoolModeState({ ...state, enabled: true, unlockKind: null })).toThrow('invalid');
    expect(() => parseSchoolModeSnapshot({ ...snapshot, extra: 'nope' })).toThrow('invalid');
    expect(() => parseSchoolModeMutationResult({ ok: true, snapshot, code: 'future-code' })).toThrow('invalid');
    const mutation = parseSchoolModeMutationResult({ ok: true, snapshot, code: 'enabled' });
    expect(mutation.code).toBe('enabled');
    expect(Object.isFrozen(mutation)).toBe(true);
    expect(parseSchoolModeVerifyResult(true)).toBe(true);
    expect(() => parseSchoolModeVerifyResult({ ok: true })).toThrow('invalid');
  });

  it('subscribes before load, rejects late observations, sanitizes failures, and cleans up on unmount', async () => {
    const hook = await source('src/renderer/state/use-school-mode.ts');
    const subscribeIndex = hook.indexOf('schoolMode.subscribe');
    const loadIndex = hook.indexOf('schoolMode.load()', subscribeIndex);
    expect(subscribeIndex).toBeGreaterThan(0);
    expect(loadIndex).toBeGreaterThan(subscribeIndex);
    expect(hook).toContain('projectSchoolModeObservation');
    expect(hook).toContain('return () => { active = false; unsubscribe(); };');
    expect(hook).not.toContain('(error as Error).message');
    expect(hook).toContain('expectedRecordId: current.state.recordId');
    expect(hook).toContain('expectedRevision: current.state.revision');
  });

  it('keeps passkey out of selectable UI, exposes real rotation, and uses restricted state for hidden surfaces', async () => {
    const settings = await source('src/renderer/pages/SettingsPage.tsx');
    const app = await source('src/renderer/App.tsx');
    expect(settings).not.toContain('<option value="passkey">');
    expect(settings).toContain('changeSchoolCredential');
    expect(settings).toContain('schoolMode.changeCredential');
    expect(settings).toContain('const schoolRestricted = schoolMode.restricted');
    expect(settings).toContain('const isSchoolHidden = (field: (typeof SETTING_FIELDS)[number]) => schoolRestricted');
    expect(settings).toContain('role={schoolAvailable ? \'status\' : \'alert\'}');
    expect(app).toContain('schoolModeEnabled: schoolMode.restricted');
    expect(app).toContain('schoolModeEnabled={schoolMode.restricted}');
    expect(app).toContain('!schoolMode.restricted');
  });

  it('uses a unique same-directory exclusive temporary file, fsync, and atomic rename', async () => {
    const store = await source('src/main/json-store.ts');
    expect(store).toContain('randomUUID()');
    expect(store).toContain("open(temporary, 'wx', 0o600)");
    expect(store).toContain('await handle.sync()');
    expect(store).toContain('await renameFile(temporary, filePath)');
  });
});
