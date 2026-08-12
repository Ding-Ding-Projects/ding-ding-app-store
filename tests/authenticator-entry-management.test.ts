import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticatorService } from '../src/main/authenticator-service.js';
import { SafeStorageAuthenticatorVault } from '../src/main/authenticator-vault.js';
import type { AuthenticatorEntryMetadata } from '../src/shared/contracts.js';
import type { AuthenticatorVault, AuthenticatorVaultMetadataWriteOptions, AuthenticatorVaultSaveOptions } from '../src/main/authenticator-vault-contract.js';
import { parseAuthenticatorBulkDelete, parseAuthenticatorDelete, parseAuthenticatorExport, parseAuthenticatorGroupMutation, parseAuthenticatorList } from '../src/preload/index.js';
import { generateTotp } from '../src/main/totp.js';
import { selectAuthenticatorRange, toggleAuthenticatorSelection } from '../src/renderer/authenticator-selection.js';

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
  safeStorage: { isEncryptionAvailable: () => false, encryptString: () => Buffer.alloc(0), decryptString: () => '' },
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
}));

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

function metadata(id: string, order: number, group: string | null = null): AuthenticatorEntryMetadata {
  return {
    id, issuer: 'Acme', account: `${id.slice(0, 4)}@example.com`, label: `Acme · ${id.slice(0, 4)}@example.com`,
    algorithm: 'sha1', digits: 6, periodSeconds: 30,
    createdAt: '2026-08-11T00:00:00.000Z', updatedAt: '2026-08-11T00:00:00.000Z', order, group,
  };
}

class ManagementVault implements AuthenticatorVault {
  readonly records = new Map<string, { metadata: AuthenticatorEntryMetadata; secret: string }>();
  uncertainRemove = false;
  async status(): Promise<'os-credential-vault'> { return 'os-credential-vault'; }
  async listMetadata(): Promise<AuthenticatorEntryMetadata[]> { return [...this.records.values()].map(({ metadata: value }) => value).sort((left, right) => left.order - right.order); }
  async writeMetadata(entries: readonly AuthenticatorEntryMetadata[], options: AuthenticatorVaultMetadataWriteOptions = {}): Promise<void> {
    if (options.shouldCommit && !options.shouldCommit()) { const error = new Error('cancelled') as NodeJS.ErrnoException; error.code = 'ECANCELED'; throw error; }
    const previous = new Map(this.records);
    this.records.clear();
    for (const entry of entries) this.records.set(entry.id, { metadata: entry, secret: previous.get(entry.id)?.secret ?? '' });
    if (options.shouldCommit && !options.shouldCommit()) { const error = new Error('cancelled') as NodeJS.ErrnoException; error.code = 'ECANCELED'; throw error; }
  }
  async save(entry: AuthenticatorEntryMetadata, secret: string, options: AuthenticatorVaultSaveOptions = {}): Promise<void> {
    if (options.shouldCommit && !options.shouldCommit()) { const error = new Error('cancelled') as NodeJS.ErrnoException; error.code = 'ECANCELED'; throw error; }
    this.records.set(entry.id, { metadata: entry, secret });
  }
  async remove(entryId: string, options: AuthenticatorVaultSaveOptions = {}): Promise<void> {
    if (options.shouldCommit && !options.shouldCommit()) { const error = new Error('cancelled') as NodeJS.ErrnoException; error.code = 'ECANCELED'; throw error; }
    this.records.delete(entryId);
    const remaining = [...this.records.values()].sort(({ metadata: left }, { metadata: right }) => left.order - right.order);
    remaining.forEach(({ metadata: entry }) => { entry.order = remaining.findIndex(({ metadata: value }) => value.id === entry.id); });
    if (this.uncertainRemove) { const error = new Error('rollback could not be verified') as NodeJS.ErrnoException & { committed?: boolean }; error.code = 'EINTEGRITY'; error.committed = true; throw error; }
  }
  async readSecret(entryId: string): Promise<string | null> { return this.records.get(entryId)?.secret ?? null; }
}

describe('saved authenticator-entry management boundary', () => {
  it('renames, groups, reorders, deletes, and exports metadata without reading secrets', async () => {
    const vault = new ManagementVault();
    vault.records.set(ID_A, { metadata: metadata(ID_A, 0), secret: 'JBSWY3DPEHPK3PXP' });
    vault.records.set(ID_B, { metadata: metadata(ID_B, 1), secret: 'KRUGS4ZANFZSAYJA' });
    const service = new AuthenticatorService(vault);

    expect((await service.rename({ entryId: ID_A, label: 'Renamed|Path\\One' })).ok).toBe(true);
    expect((await service.setGroup({ entryId: ID_A, group: 'Work|Ops\\East' })).ok).toBe(true);
    expect((await service.reorder({ entryId: ID_B, order: 0 })).ok).toBe(true);
    expect((await vault.listMetadata()).map((entry) => [entry.id, entry.order, entry.group])).toEqual([[ID_B, 0, null], [ID_A, 1, 'Work|Ops\\East']]);

    const exported = await service.export({ entryIds: [ID_A, ID_B], format: 'markdown' });
    expect(exported.ok).toBe(true);
    expect(exported.content).toContain('UTF-8');
    expect(exported.content).toContain('schema: authenticator metadata v2');
    expect(exported.content).toContain('Renamed\\|Path\\\\One');
    expect(exported.content).toContain('Work\\|Ops\\\\East');
    expect(exported.content).not.toContain('JBSWY3DPEHPK3PXP');
    expect(exported.omittedFields).toEqual(['secret', 'uri', 'code', 'nextCode', 'remainingSeconds', 'expiresAt']);
    const csv = await service.export({ entryIds: [ID_A, ID_B], format: 'csv' });
    expect(csv.ok).toBe(true);
    expect(csv.content?.split('\n')[0]).toContain('schemaVersion,omittedFields,id');
    expect(csv.content?.startsWith('#')).toBe(false);

    const deleted = await service.remove({ entryId: ID_B, confirmed: true });
    expect(deleted).toMatchObject({ ok: true, deletedId: ID_B });
    expect((await vault.listMetadata()).map((entry) => entry.order)).toEqual([0]);
    const bulk = await service.bulkRemove({ entryIds: [ID_A], confirmed: true });
    expect(bulk).toMatchObject({ ok: true, deletedIds: [ID_A], skippedIds: [] });
    expect(vault.records.size).toBe(0);
  });

  it('rejects duplicate ids, contradictory bulk outcomes, and malformed metadata responses', async () => {
    const vault = new ManagementVault();
    vault.records.set(ID_A, { metadata: metadata(ID_A, 0), secret: 'JBSWY3DPEHPK3PXP' });
    const service = new AuthenticatorService(vault);
    expect((await service.bulkRemove({ entryIds: [ID_A, ID_A], confirmed: true })).ok).toBe(false);
    expect(() => parseAuthenticatorBulkDelete({ ok: true, deletedIds: [ID_A], skippedIds: [ID_B], uncertainIds: [], message: 'x', messageYue: 'x' })).toThrow();
    expect(parseAuthenticatorBulkDelete({ ok: false, deletedIds: [], skippedIds: [], uncertainIds: [], message: 'x', messageYue: 'x' })).toMatchObject({ ok: false, deletedIds: [], skippedIds: [], uncertainIds: [] });
    expect(parseAuthenticatorBulkDelete({ ok: false, deletedIds: [ID_A], skippedIds: [], uncertainIds: [ID_A], message: 'x', messageYue: 'x' })).toMatchObject({ uncertainIds: [ID_A] });
    expect(() => parseAuthenticatorBulkDelete({ ok: false, deletedIds: [], skippedIds: [ID_B], uncertainIds: [ID_B], message: 'x', messageYue: 'x' })).toThrow();
    expect(parseAuthenticatorDelete({ ok: false, deletedId: ID_A, uncertain: true, message: 'x', messageYue: 'x' })).toMatchObject({ uncertain: true, deletedId: ID_A });
    expect(() => parseAuthenticatorDelete({ ok: true, deletedId: ID_A, uncertain: true, message: 'x', messageYue: 'x' })).toThrow();
    expect(() => parseAuthenticatorExport({ ok: true, format: 'json', filename: 'authenticator-metadata.json', content: '{}', omittedFields: ['secret', 'uri'], message: 'x', messageYue: 'x' })).toThrow();
  });

  it('surfaces a committed-but-uncertain single delete instead of inviting a retry', async () => {
    const vault = new ManagementVault();
    vault.records.set(ID_A, { metadata: metadata(ID_A, 0), secret: 'JBSWY3DPEHPK3PXP' });
    vault.uncertainRemove = true;
    const result = await new AuthenticatorService(vault).remove({ entryId: ID_A, confirmed: true });
    expect(result).toMatchObject({ ok: false, deletedId: ID_A, uncertain: true });
  });

  it('migrates a legacy v1 label at the historical 387-character bound and writes v2 groups', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'authenticator-v1-'));
    try {
      const metadataPath = path.join(root, 'authenticator.v1.json');
      const issuer = 'I'.repeat(128);
      const account = 'a'.repeat(256);
      const legacyWithGroup = metadata(ID_A, 0);
      legacyWithGroup.issuer = issuer;
      legacyWithGroup.account = account;
      legacyWithGroup.label = `${issuer} · ${account}`;
      const { group: _legacyGroup, ...legacy } = legacyWithGroup;
      await writeFile(metadataPath, JSON.stringify({ schemaVersion: 1, entries: [legacy] }), 'utf8');
      const vault = new SafeStorageAuthenticatorVault({ metadataPath, secretsDirectory: path.join(root, 'secrets'), isEncryptionAvailable: () => true, encryptString: () => Buffer.from('cipher'), decryptString: () => 'secret' });
      expect((await vault.listMetadata())[0].label).toHaveLength(387);
      await vault.writeMetadata([{ ...legacy, group: 'Migrated' }]);
      expect(JSON.parse(await (await import('node:fs/promises')).readFile(metadataPath, 'utf8')).schemaVersion).toBe(2);
      expect((await vault.listMetadata())[0].group).toBe('Migrated');
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('fails clearly at the bounded 256-entry capacity before publishing a pending pairing', async () => {
    const vault = new ManagementVault();
    for (let index = 0; index < 256; index += 1) {
      const id = randomUUID();
      vault.records.set(id, { metadata: { ...metadata(id, index), account: `${index}@example.com`, label: `Acme · ${index}@example.com` }, secret: 'JBSWY3DPEHPK3PXP' });
    }
    const result = await new AuthenticatorService(vault).prepare({ source: 'manual', secret: 'JBSWY3DPEHPK3PXP', issuer: 'Acme', account: 'new@example.com', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    expect(result.ok).toBe(false);
    expect(result.message).toContain('entry limit');
  });

  it('rechecks capacity inside the serialized confirmation transaction', async () => {
    const vault = new ManagementVault();
    for (let index = 0; index < 255; index += 1) {
      const id = randomUUID();
      vault.records.set(id, { metadata: { ...metadata(id, index), account: `${index}@example.com`, label: `Acme · ${index}@example.com` }, secret: 'JBSWY3DPEHPK3PXP' });
    }
    const service = new AuthenticatorService(vault);
    const prepared = await service.prepare({ source: 'manual', secret: 'JBSWY3DPEHPK3PXP', issuer: 'Acme', account: 'late@example.com', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    expect(prepared.ok).toBe(true);
    const extraId = randomUUID();
    vault.records.set(extraId, { metadata: { ...metadata(extraId, 255), account: 'extra@example.com', label: 'Acme · extra@example.com' }, secret: 'JBSWY3DPEHPK3PXP' });
    const confirmed = await service.confirm({ registrationId: prepared.registrationId!, code: generateTotp({ secret: 'JBSWY3DPEHPK3PXP', algorithm: 'sha1', digits: 6, periodSeconds: 30 }).code });
    expect(confirmed.ok).toBe(false);
    expect(confirmed.message).toContain('entry limit');
  });

  it('keeps management controls searchable and reachable through the palette target', async () => {
    const page = await readFile(new URL('../src/renderer/pages/AuthenticatorPage.tsx', import.meta.url), 'utf8');
    const registry = await readFile(new URL('../src/renderer/registry.ts', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/renderer/App.tsx', import.meta.url), 'utf8');
    expect(page).toContain('rename delete reorder group group label save group move up move down select bulk export');
    expect(page).toContain('authenticator-entry-management');
    expect(page).toContain('Open export in VS Code');
    expect(registry).toContain("command('authenticator-export'");
    expect(registry).toContain("command('authenticator-bulk-delete'");
    expect(app).toContain("case 'authenticator-rename'");
  });

  it('selects forward and reverse visible ranges without touching hidden ids', () => {
    const visibleIds = ['a', 'b', 'c', 'd'];
    const hiddenSelection = new Set(['hidden']);
    const forward = selectAuthenticatorRange(visibleIds, 'b', 'd', hiddenSelection);
    expect([...forward]).toEqual(['hidden', 'b', 'c', 'd']);
    const reverse = selectAuthenticatorRange(visibleIds, 'd', 'b', hiddenSelection);
    expect([...reverse]).toEqual(['hidden', 'b', 'c', 'd']);
    const firstKeyboardRange = selectAuthenticatorRange(visibleIds, null, 'c', hiddenSelection);
    expect([...firstKeyboardRange]).toEqual(['hidden', 'c']);
    expect([...toggleAuthenticatorSelection(firstKeyboardRange, 'c', false)]).toEqual(['hidden']);
  });

  it('wires Shift-click and Shift+Space to visible-range selection and resets stale anchors', async () => {
    const page = await readFile(new URL('../src/renderer/pages/AuthenticatorPage.tsx', import.meta.url), 'utf8');
    expect(page).toContain("const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);");
    expect(page).toContain('selectAuthenticatorRange');
    expect(page).toContain('event.shiftKey');
    expect(page).toContain("event.key === ' '");
    expect(page).toContain('Shift+Space');
    expect(page).toContain('aria-keyshortcuts="Shift+Space"');
    expect(page).toContain('setSelectionAnchorId(null)');
  });

  it('creates, renames, reorders, moves, and deletes stable groups without leaking secrets', async () => {
    const vault = new ManagementVault();
    vault.records.set(ID_A, { metadata: metadata(ID_A, 0), secret: 'JBSWY3DPEHPK3PXP' });
    const service = new AuthenticatorService(vault);
    const created = await service.createGroup({ name: 'Work', color: '#6750A4' });
    expect(created.ok).toBe(true);
    const groupId = created.group!.id;
    expect((await service.moveToGroup({ entryIds: [ID_A], groupId })).movedIds).toEqual([ID_A]);
    expect((await vault.listMetadata())[0]).toMatchObject({ groupId, group: 'Work' });
    expect((await service.renameGroup({ groupId, name: 'Workday' })).ok).toBe(true);
    expect((await vault.listMetadata())[0].group).toBe('Workday');
    expect((await service.reorderGroup({ groupId, order: 0 })).ok).toBe(true);
    expect((await service.deleteGroup({ groupId, confirmed: true })).ok).toBe(true);
    expect((await vault.listMetadata())[0]).toMatchObject({ groupId: null, group: null });
    expect(JSON.stringify(vault.records)).not.toContain('JBSWY3DPEHPK3PXP');
  });

  it('persists collapse state and rejects malformed group bridge payloads', async () => {
    const vault = new ManagementVault();
    vault.records.set(ID_A, { metadata: metadata(ID_A, 0), secret: 'JBSWY3DPEHPK3PXP' });
    const service = new AuthenticatorService(vault);
    const first = await service.createGroup({ name: 'Work' });
    const second = await service.createGroup({ name: 'Personal' });
    const groupId = first.group!.id;
    expect((await service.collapseGroup({ groupId, collapsed: true })).group?.collapsed).toBe(true);
    expect((await service.reorderGroup({ groupId, order: 1 })).group?.order).toBe(1);
    expect((await service.reorderGroup({ groupId, order: 0 })).group?.order).toBe(0);
    const valid = { entries: [{ ...metadata(ID_A, 0), group: 'Work', groupId, code: null, nextCode: null, remainingSeconds: null, expiresAt: null }], groups: [{ ...first.group!, collapsed: true, order: 0 }, { ...second.group!, order: 1 }], storage: 'os-vault', message: 'ok', messageYue: '好' };
    expect(parseAuthenticatorList(valid).entries[0].groupId).toBe(groupId);
    expect(() => parseAuthenticatorList({ ...valid, groups: [{ ...valid.groups[0], id: 'not-a-uuid' }] })).toThrow();
    expect(() => parseAuthenticatorList({ ...valid, groups: [...valid.groups, { ...valid.groups[1], id: randomUUID(), order: 1 }] })).toThrow();
    expect(() => parseAuthenticatorList({ ...valid, entries: [{ ...valid.entries[0], groupId: randomUUID() }] })).toThrow();
    expect(() => parseAuthenticatorGroupMutation({ ok: true, group: { ...first.group, id: 'bad' }, message: 'x', messageYue: 'x' })).toThrow();
  });

  it('uses the native destructive group gate and a keyboard regex move picker', async () => {
    const page = await readFile(new URL('../src/renderer/pages/AuthenticatorPage.tsx', import.meta.url), 'utf8');
    expect(page).not.toContain('window.confirm');
    expect(page).not.toContain('visibleGroups[0]');
    expect(page).toContain('groupDeleteTarget');
    expect(page).toContain('DELETE GROUP');
    expect(page).toContain('movePickerQuery');
    expect(page).toContain('movePickerRegex');
    expect(page).toContain('Open regex builder for move targets');
    expect(page).toContain('moveAuthenticatorPickerFocus');
    expect(page).toContain('Move down');
    expect(page).toContain('collapseGroup');
    expect(page).toContain('collapsedGroupIds');
  });

  it('does not report moves when metadata publication fails', async () => {
    const vault = new ManagementVault();
    vault.records.set(ID_A, { metadata: metadata(ID_A, 0), secret: 'JBSWY3DPEHPK3PXP' });
    const service = new AuthenticatorService(vault);
    const group = await service.createGroup({ name: 'Work' });
    const original = vault.writeMetadata.bind(vault);
    vault.writeMetadata = async () => { throw new Error('write failed'); };
    const moved = await service.moveToGroup({ entryIds: [ID_A], groupId: group.group!.id });
    expect(moved).toMatchObject({ ok: false, movedIds: [] });
    vault.writeMetadata = original;
  });
});
