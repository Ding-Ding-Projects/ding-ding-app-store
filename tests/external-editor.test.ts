import { readFile } from 'node:fs/promises';
import { rm } from 'node:fs/promises';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { createHistoryArchive } from '../src/main/history-archive';
import { launchWorkspace } from '../src/main/external-editor-service';
import { extractZipSafe } from '../src/main/safe-zip';
import { externalEditorOpenArchiveRequestSchema, externalEditorOpenRequestSchema, externalEditorPreferenceSchema } from '../src/shared/contracts';

const electronDataRoot = vi.hoisted(() => `${process.env.TEMP ?? process.env.TMP ?? 'C:\\Windows\\Temp'}\\ding-ding-editor-test`);
vi.mock('electron', () => ({
  app: { getPath: () => electronDataRoot },
  dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }) },
}));

const read = (file: string) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

describe('external editor and export boundary', () => {
  it('reports an observed spawn without waiting for the timeout', async () => {
    vi.useFakeTimers();
    try {
      const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
      const spawnProcess = vi.fn(() => child) as unknown as typeof import('node:child_process').spawn;
      const pending = launchWorkspace('Code.exe', 'C:\\exports', spawnProcess);
      child.emit('spawn');
      await expect(pending).resolves.toBe('spawned');
      expect(spawnProcess).toHaveBeenCalledWith('Code.exe', ['--reuse-window', 'C:\\exports'], expect.objectContaining({ shell: false, windowsHide: true }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a child-process error as a failed launch', async () => {
    vi.useFakeTimers();
    try {
      const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
      const spawnProcess = vi.fn(() => child) as unknown as typeof import('node:child_process').spawn;
      const pending = launchWorkspace('Code.exe', 'C:\\exports', spawnProcess);
      child.emit('error', new Error('not found'));
      await expect(pending).resolves.toBe('failed');
    } finally {
      vi.useRealTimers();
    }
  });

  it('fails closed with timeout when Windows emits no launch event', async () => {
    vi.useFakeTimers();
    try {
      const child = Object.assign(new EventEmitter(), { unref: vi.fn() });
      const spawnProcess = vi.fn(() => child) as unknown as typeof import('node:child_process').spawn;
      const pending = launchWorkspace('Code.exe', 'C:\\exports', spawnProcess);
      await vi.advanceTimersByTimeAsync(2_000);
      await expect(pending).resolves.toBe('timeout');
      expect(spawnProcess).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('accepts only typed, bounded export metadata', () => {
    expect(externalEditorOpenRequestSchema.safeParse({ editor: 'vscode', recordKind: 'settings', suggestedName: 'settings.json', mime: 'application/json', content: '{"schemaVersion":1}' }).success).toBe(true);
    expect(externalEditorOpenRequestSchema.safeParse({ editor: 'vscode', recordKind: 'history-revisions', suggestedName: 'ding-ding-app-store-history-revisions.json', mime: 'application/json', content: '{"schemaVersion":1,"kind":"history-revisions","records":[]}' }).success).toBe(true);
    expect(externalEditorOpenRequestSchema.safeParse({ editor: 'vscode', recordKind: 'history-revision', suggestedName: 'history.json', mime: 'application/json', content: '{}' }).success).toBe(false);
    expect(externalEditorOpenRequestSchema.safeParse({ editor: 'vscode', recordKind: 'settings', suggestedName: '../settings.json', mime: 'application/json', content: '{}' }).success).toBe(false);
    expect(externalEditorOpenRequestSchema.safeParse({ editor: 'vscode', recordKind: 'settings', suggestedName: 'settings.json', mime: 'application/json', content: 'x'.repeat(256_001) }).success).toBe(false);
    expect(externalEditorOpenRequestSchema.safeParse({ editor: 'vscode', recordKind: 'settings', suggestedName: 'settings.json', mime: 'application/json', content: '{}', executable: 'cmd.exe' }).success).toBe(false);
  });

  it('keeps editor preference bounded to known editions', () => {
    expect(externalEditorPreferenceSchema.parse({ editor: 'vscode', edition: 'portable' })).toEqual({ editor: 'vscode', edition: 'portable' });
    expect(externalEditorPreferenceSchema.safeParse({ editor: 'vscode', edition: 'custom', path: 'C:/anything.exe' }).success).toBe(false);
  });

  it('accepts only bounded activity ZIP archives and rejects renderer-controlled paths', () => {
    const valid = { editor: 'vscode', recordKind: 'activity', suggestedName: 'history.zip', mime: 'application/zip', base64: 'UEsDBAo=' };
    expect(externalEditorOpenArchiveRequestSchema.safeParse(valid).success).toBe(true);
    expect(externalEditorOpenArchiveRequestSchema.safeParse({ ...valid, suggestedName: '../history.zip' }).success).toBe(false);
    expect(externalEditorOpenArchiveRequestSchema.safeParse({ ...valid, recordKind: 'tabs' }).success).toBe(false);
    expect(externalEditorOpenArchiveRequestSchema.safeParse({ ...valid, base64: 'not base64!' }).success).toBe(false);
    expect(externalEditorOpenArchiveRequestSchema.safeParse({ ...valid, base64: 'abc' }).success).toBe(false);
  });

  it('keeps the privileged adapter shell-free and path-free in renderer IPC', async () => {
    const [service, main, preload, renderer] = await Promise.all([
      read('src/main/external-editor-service.ts'), read('src/main/main.ts'), read('src/preload/index.ts'), read('src/renderer/external-editor.ts'),
    ]);
    expect(service).toContain("shell: false");
    expect(service).toContain("windowsHide: true");
    expect(service).toContain("path.join(this.exportRoot");
    expect(service).toContain("dialog.showOpenDialog");
    expect(service).toContain("Code - Insiders.exe");
    expect(main).toContain("ipcMain.handle('external-editor:open-export'");
    expect(main).toContain("ipcMain.handle('external-editor:open-archive'");
    expect(preload).toContain("ipcRenderer.invoke('external-editor:open-export', request)");
    expect(preload).toContain("ipcRenderer.invoke('external-editor:open-archive', request)");
    expect(service).toContain('extractZipSafe');
    expect(service).toContain("['--reuse-window', workspace]");
    expect(service).toContain("reason: 'launch-timeout'");
    expect(service).toContain("finish('timeout')");
    expect(renderer).not.toContain('executable');
    expect(renderer).not.toContain('filePath');
  });

  it('invokes the real archive service seam and fails closed on malformed ZIP data', async () => {
    const { ExternalEditorService } = await import('../src/main/external-editor-service');
    const service = new ExternalEditorService();
    (service as unknown as { detectPaths: () => Promise<Set<string>> }).detectPaths = async () => new Set([process.execPath]);
    const archive = await createHistoryArchive([{
      id: 'f6a5dd12-70f1-4f4a-9f1b-1d9c8a7d6e5c', appId: 'sample-app', displayName: 'Sample App', kind: 'install', ok: true,
      message: 'Installed successfully.', occurredAt: '2026-08-08T16:00:00.000Z',
    }]);
    try {
      const openedRevision = await service.openExport({ editor: 'vscode', recordKind: 'history-revisions', suggestedName: 'ding-ding-app-store-history-revisions.json', mime: 'application/json', content: '{"schemaVersion":1,"kind":"history-revisions","records":[]}' });
      expect(openedRevision).toEqual({ ok: true, editor: 'vscode' });
      const archiveRoot = `${electronDataRoot}\\direct`;
      const { mkdir, writeFile } = await import('node:fs/promises');
      await mkdir(archiveRoot, { recursive: true });
      const archivePath = `${archiveRoot}\\history.zip`;
      await writeFile(archivePath, Buffer.from(archive.base64, 'base64'));
      await extractZipSafe(archivePath, `${archiveRoot}\\workspace`, undefined, {
        maxEntries: 4,
        maxBytes: 32 * 1024 * 1024,
        allowedNames: new Set(['README.txt', 'history.json', 'history.jsonl', 'manifest.json']),
        requiredNames: new Set(['README.txt', 'history.json', 'history.jsonl', 'manifest.json']),
      });
      const opened = await service.openArchive({ editor: 'vscode', recordKind: 'activity', suggestedName: archive.filename, mime: archive.mime, base64: archive.base64 });
      expect(opened).toEqual({ ok: true, editor: 'vscode' });
      const rejected = await service.openArchive({ editor: 'vscode', recordKind: 'activity', suggestedName: archive.filename, mime: archive.mime, base64: Buffer.from('not a zip').toString('base64') });
      expect(rejected).toMatchObject({ ok: false, reason: 'write-failed' });
    } finally {
      await rm(electronDataRoot, { recursive: true, force: true });
    }
  });
});

