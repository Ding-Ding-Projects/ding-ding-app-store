import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { externalEditorOpenRequestSchema, externalEditorPreferenceSchema } from '../src/shared/contracts';

const read = (file: string) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

describe('external editor and export boundary', () => {
  it('accepts only typed, bounded export metadata', () => {
    expect(externalEditorOpenRequestSchema.safeParse({ editor: 'vscode', recordKind: 'settings', suggestedName: 'settings.json', mime: 'application/json', content: '{"schemaVersion":1}' }).success).toBe(true);
    expect(externalEditorOpenRequestSchema.safeParse({ editor: 'vscode', recordKind: 'settings', suggestedName: '../settings.json', mime: 'application/json', content: '{}' }).success).toBe(false);
    expect(externalEditorOpenRequestSchema.safeParse({ editor: 'vscode', recordKind: 'settings', suggestedName: 'settings.json', mime: 'application/json', content: 'x'.repeat(256_001) }).success).toBe(false);
    expect(externalEditorOpenRequestSchema.safeParse({ editor: 'vscode', recordKind: 'settings', suggestedName: 'settings.json', mime: 'application/json', content: '{}', executable: 'cmd.exe' }).success).toBe(false);
  });

  it('keeps editor preference bounded to known editions', () => {
    expect(externalEditorPreferenceSchema.parse({ editor: 'vscode', edition: 'portable' })).toEqual({ editor: 'vscode', edition: 'portable' });
    expect(externalEditorPreferenceSchema.safeParse({ editor: 'vscode', edition: 'custom', path: 'C:/anything.exe' }).success).toBe(false);
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
    expect(preload).toContain("ipcRenderer.invoke('external-editor:open-export', request)");
    expect(renderer).not.toContain('executable');
    expect(renderer).not.toContain('filePath');
  });
});

