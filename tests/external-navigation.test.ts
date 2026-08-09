import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExternalNavigationService } from '../src/main/external-navigation-service';
import { isCommitNavigationAvailable, openCommit } from '../src/renderer/external-navigation';

const SHA = '57cdc933b8268bb7b0670546a5f4c7aa1295c119';
const COMMIT_URL = `https://github.com/Ding-Ding-Projects/ding-ding-app-store/commit/${SHA}`;
const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

afterEach(() => vi.unstubAllGlobals());

describe('external commit navigation', () => {
  it('constructs the one fixed repository URL from a full SHA', async () => {
    const openExternal = vi.fn(async (_url: string) => undefined);
    const result = await new ExternalNavigationService({ openExternal }).openCommit(SHA);
    expect(result).toMatchObject({ ok: true, appId: 'ding-ding-app-store' });
    expect(openExternal).toHaveBeenCalledOnce();
    expect(openExternal).toHaveBeenCalledWith(COMMIT_URL);
  });

  it('rejects invalid or URL-shaped input before the opener sees it', async () => {
    const openExternal = vi.fn(async (_url: string) => undefined);
    const service = new ExternalNavigationService({ openExternal });
    for (const value of ['', SHA.slice(0, 39), `${SHA}0`, COMMIT_URL, '../commit', null]) {
      const result = await service.openCommit(value);
      expect(result).toMatchObject({ ok: false, appId: 'ding-ding-app-store' });
      expect(result.messageYue).toContain('40');
    }
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('returns typed localized failures when the Electron opener is absent or throws', async () => {
    const unavailable = await new ExternalNavigationService(null).openCommit(SHA);
    expect(unavailable).toMatchObject({ ok: false, appId: 'ding-ding-app-store' });
    expect(unavailable.message).toContain('unavailable');
    expect(unavailable.messageYue).toContain('未能開啟');

    const rejected = await new ExternalNavigationService({
      openExternal: async () => { throw new Error('C:\\Users\\private\\token-bearing-path'); },
    }).openCommit(SHA);
    expect(rejected).toMatchObject({ ok: false, appId: 'ding-ding-app-store' });
    expect(`${rejected.message} ${rejected.messageYue}`).not.toContain('private');
    expect(`${rejected.message} ${rejected.messageYue}`).not.toContain('token-bearing-path');
  });

  it('wires a sender-validated main handler and a SHA-only preload method', async () => {
    const [main, preload, service] = await Promise.all([
      read('src/main/main.ts'),
      read('src/preload/index.ts'),
      read('src/main/external-navigation-service.ts'),
    ]);
    expect(main).toContain("ipcMain.handle('external-navigation:open-commit'");
    expect(main).toContain('event.sender === mainWindow?.webContents');
    expect(main).toContain('new ExternalNavigationService(shell)');
    expect(preload).toContain("openCommit: (commit: string) => ipcRenderer.invoke('external-navigation:open-commit', commit)");
    expect(preload).not.toContain("external-navigation:open-commit', url");
    expect(service).toContain("const COMMIT_URL_PREFIX = 'https://github.com/Ding-Ding-Projects/ding-ding-app-store/commit/'");
    expect(service).not.toMatch(/new URL\(|request\.url|openExternal\(commit\)/);
  });

  it('enables the renderer path only when the typed bridge is present', async () => {
    const openCommitBridge = vi.fn(async () => ({
      ok: true,
      appId: 'ding-ding-app-store',
      message: 'Commit link opened.',
      messageYue: '已開啟 commit 連結。',
    }));
    vi.stubGlobal('window', { dingDingStore: { externalNavigation: { openCommit: openCommitBridge } } });
    expect(isCommitNavigationAvailable()).toBe(true);
    await expect(openCommit(SHA)).resolves.toMatchObject({ ok: true });
    expect(openCommitBridge).toHaveBeenCalledWith(SHA);

    vi.stubGlobal('window', { dingDingStore: {} });
    expect(isCommitNavigationAvailable()).toBe(false);
    await expect(openCommit(SHA)).resolves.toMatchObject({ ok: false });
  });
});
