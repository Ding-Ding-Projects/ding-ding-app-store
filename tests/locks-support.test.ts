import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (relative: string) => readFile(new URL(relative, root), 'utf8');

describe('tab/group UX locks and local Support Tickets', () => {
  it('publishes typed lock and ticket contracts without an OTP or property-lock claim', async () => {
    const contracts = await read('src/shared/contracts.ts');
    expect(contracts).toContain("export type LockTargetKind = 'tab' | 'group';");
    expect(contracts).toContain("credentialKind: 'password';");
    expect(contracts).toContain('vaultAvailable: boolean;');
    expect(contracts).toContain('recoveryPath: string;');
    expect(contracts).toContain('SupportTicketMutationResult');
    expect(contracts).not.toContain('otpSecret:');
    expect(contracts).not.toContain('appearancePropertyLock:');
  });

  it('keeps credentials encrypted, fail-closed, and locally recoverable', async () => {
    const service = await read('src/main/lock-support-service.ts');
    expect(service).toContain('safeStorage.isEncryptionAvailable()');
    expect(service).toContain('safeStorage.encryptString');
    expect(service).toContain('scryptSync');
    expect(service).toContain('timingSafeEqual');
    expect(service).toContain('credential-store-unavailable');
    expect(service).toContain('writeJsonAtomic');
    expect(service).toContain('const temporary = `${this.vaultPath}.${process.pid}.tmp`');
    expect(service).toContain('await rename(temporary, this.vaultPath)');
    expect(service).toContain('previous state remains');
    expect(service).not.toMatch(/\bfetch\s*\(/);
    expect(service).not.toMatch(/shell\.(?:trashItem|rm|delete)/i);
    expect(service).toContain('Delete this folder yourself');
  });

  it('validates every lock/support sender at the main/preload boundary', async () => {
    const main = await read('src/main/main.ts');
    const preload = await read('src/preload/index.ts');
    for (const channel of ['locks:load', 'locks:set', 'locks:unlock', 'locks:lock-again', 'locks:remove', 'support:load', 'support:create', 'support:advance', 'support:open-recovery-folder']) {
      expect(main).toContain(`ipcMain.handle('${channel}'`);
      expect(preload).toContain(`ipcRenderer.invoke('${channel}'`);
    }
    expect(main.match(/Blocked lock request from an unknown renderer/g)?.length).toBeGreaterThanOrEqual(5);
    expect(main.match(/Blocked Support Tickets request from an unknown renderer/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it('guards visible activation, Settings, Help, and accessible recovery copy', async () => {
    const rail = await read('src/renderer/components/TabRail.tsx');
    const settings = await read('src/renderer/pages/SettingsPage.tsx');
    const help = await read('src/renderer/pages/DocsPage.tsx');
    const page = await read('src/renderer/pages/LockSupportPage.tsx');
    expect(rail).toContain('This tab is locked. Unlock it before opening it.');
    expect(rail).toContain('This group is locked. Unlock it before changing its state.');
    expect(rail).toContain('Forgotten it? Delete ${locks?.state.recoveryPath ?? \'\'} yourself.');
    expect(settings).toContain("subTab === 'settings.support'");
    expect(settings).toContain('initialTarget={lockTargetRequest}');
    expect(help).toContain('Open Locks & Support');
    expect(page).toContain('support.state.disclosure');
    expect(page).toContain('aria-labelledby="tab-locks-title"');
    expect(page).toContain('aria-labelledby="support-tickets-title"');
    expect(page).toContain('Copy path');
    expect(page).toContain('Open folder');
    expect(page).toContain('application-data folder yourself');
  });

  it('documents the limited boundary and generated mirrors', async () => {
    const article = await read('docs/features/experience/tab-and-group-locks-and-support-tickets.md');
    const generator = await read('scripts/docs-generate.mjs');
    expect(article).toContain('status: limited');
    expect(article).toContain('does not claim per-property appearance locks, OTP/TOTP locks');
    expect(article).toContain('## Suggested articles');
    expect(generator).toContain('tab-and-group-locks-and-support-tickets');
    expect(await read('site/articles/experience/tab-and-group-locks-and-support-tickets.md')).toContain('Support Tickets');
    expect(await read('wiki/Tab-And-Group-Locks-And-Support-Tickets.md')).toContain('Support Tickets');
  });
});
