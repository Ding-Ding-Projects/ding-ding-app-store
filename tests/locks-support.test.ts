import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseLockState } from '../src/preload/lock-parser.js';

const root = new URL('../', import.meta.url);
const read = (relative: string) => readFile(new URL(relative, root), 'utf8');

describe('tab/group UX locks and local Support Tickets', () => {
  it('rejects contradictory unlock projections at the preload boundary', () => {
    const base = { schemaVersion: 1, vaultAvailable: true, unavailableReason: null, recoveryPath: 'C:\\app-data', records: [{ targetKind: 'tab', targetId: 'catalog', credentialKind: 'password', unlockDuration: '15m', locked: false, unlockedUntil: null, createdAt: '2026-08-12T00:00:00.000Z', updatedAt: '2026-08-12T00:00:00.000Z' }] };
    expect(() => parseLockState(base)).toThrow();
    expect(() => parseLockState({ ...base, records: [{ ...base.records[0], locked: true, unlockedUntil: '2026-08-12T00:15:00.000Z' }] })).toThrow();
    expect(parseLockState({ ...base, records: [{ ...base.records[0], locked: false, unlockedUntil: '2026-08-12T00:15:00.000Z' }] }).records[0].unlockDuration).toBe('15m');
  });
  it('publishes typed password, TOTP, and appearance-property lock contracts', async () => {
    const contracts = await read('src/shared/contracts.ts');
    expect(contracts).toContain("export type LockTargetKind = 'tab' | 'group' | 'appearance-property';");
    expect(contracts).toContain("export type LockUnlockDuration = 'session' | '15m' | '60m';");
    expect(contracts).toContain('unlockDuration: LockUnlockDuration;');
    expect(contracts).toContain('unlockedUntil: string | null;');
    expect(contracts).toContain("credentialKind: 'password' | 'totp';");
    expect(contracts).toContain('LOCK_TOTP_ALGORITHMS');
    expect(contracts).toContain('totpAlgorithm?: LockTotpAlgorithm;');
    expect(contracts).toContain('totpPeriodSeconds?: number;');
    expect(contracts).toContain('confirmationCode?: string;');
    expect(contracts).toContain('vaultAvailable: boolean;');
    expect(contracts).toContain('recoveryPath: string;');
    expect(contracts).toContain('SupportTicketMutationResult');
    expect(contracts).toContain("reason?: 'credential-store-unavailable'");
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
    expect(service).toContain('normalizeBase32Secret');
    expect(service).toContain('generateTotp');
    expect(service).toContain("targetKind: 'appearance-property'");
    expect(service).toContain('rate-limited');
    expect(service).toContain('Appearance property ${target.targetId}');
    expect(service).toContain('locksReadFailed');
    expect(service).not.toContain('safeStorage.decryptString(entry.secret)');
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
    expect(main).toContain("ipcMain.handle('appearance:set-element', (event");
    expect(main).toContain('Blocked appearance request from an unknown renderer.');
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

  it('documents the password/TOTP/property boundary and generated mirrors', async () => {
    const article = await read('docs/features/experience/tab-and-group-locks-and-support-tickets.md');
    const generator = await read('scripts/docs-generate.mjs');
    expect(article).toContain('status: limited');
    expect(article).toContain('TOTP');
    expect(article).toContain('appearance-property');
    expect(article).toContain('## Suggested articles');
    expect(generator).toContain('tab-and-group-locks-and-support-tickets');
    expect(await read('site/articles/experience/tab-and-group-locks-and-support-tickets.md')).toContain('Support Tickets');
    expect(await read('wiki/Tab-And-Group-Locks-And-Support-Tickets.md')).toContain('Support Tickets');
  });

  it('keeps TOTP verification main-only and refuses a locked appearance token', async () => {
    const service = await read('src/main/lock-support-service.ts');
    const appearance = await read('src/main/appearance-service.ts');
    expect(service).toContain('[-1, 0, 1].some');
    expect(service).toContain('totpAlgorithm');
    expect(service).toContain('periodSeconds: number');
    expect(service).toContain("entry.algorithm ?? 'sha1'");
    expect(service).toContain("entry.periodSeconds ?? 30");
    expect(service).toContain('private readonly attempts');
    expect(service).toContain("const unlockDurationSchema = z.enum(['session', '15m', '60m']);");
    expect(service).toContain("duration === 'session' ? null : Date.now()");
    expect(service).toContain('automatically');
    expect(service).toContain('const expired');
    expect(service).toContain('unlockGenerations');
    expect(service).toContain('unlock was discarded');
    expect(service).toContain('async assertAppearanceMutation');
    expect(appearance).toContain('mutationGuard?.(elementKey');
    expect(appearance).toContain('await this.mutationGuard?.(key, {}, current.elements[key] ?? {})');
    const page = await read('src/renderer/pages/LockSupportPage.tsx');
    const rail = await read('src/renderer/components/TabRail.tsx');
    expect(page).toContain('Current TOTP code (pairing confirmation)');
    expect(page).toContain('lock-totp-algorithm');
    expect(page).toContain('lock-totp-digits');
    expect(page).toContain('lock-totp-period');
    expect(page).toContain('setTotpAlgorithm(selectedRecord.totpAlgorithm ?? \'sha1\')');
    expect(page).toContain('confirmationCode: credentialKind === \'totp\' ? confirmationCode');
    expect(rail).toContain("lock.credentialKind === 'totp' ? 'Current TOTP code'");
    expect(rail).toContain("autoComplete={lock.credentialKind === 'totp' ? 'one-time-code'");
    const main = await read('src/main/main.ts');
    expect(main).toContain('hasLockedAppearanceProperties');
    expect(main).toContain('History restore is paused while an appearance property lock is active');
  });
});
