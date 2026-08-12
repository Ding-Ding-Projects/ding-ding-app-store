import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticatorService } from '../src/main/authenticator-service.js';
import type { AuthenticatorVault, AuthenticatorVaultMetadataWriteOptions, AuthenticatorVaultSaveOptions } from '../src/main/authenticator-vault-contract.js';
import type { AuthenticatorEntryMetadata, HistoryEntry } from '../src/shared/contracts.js';
import type { HistoryRecordInput } from '../src/main/history-service.js';
import { generateTotp } from '../src/main/totp.js';

const SECRET = 'JBSWY3DPEHPK3PXP';
const URI = 'otpauth://totp/Acme%3Aalice%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Acme';
const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

function metadata(id: string, order: number): AuthenticatorEntryMetadata {
  return {
    id,
    issuer: 'Acme',
    account: `${id.slice(0, 4)}@example.com`,
    label: `Acme · ${id.slice(0, 4)}@example.com`,
    algorithm: 'sha1',
    digits: 6,
    periodSeconds: 30,
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
    order,
    group: null,
  };
}

class ActivityVault implements AuthenticatorVault {
  readonly entries = new Map<string, { metadata: AuthenticatorEntryMetadata; secret: string }>();
  uncertainRemove = false;

  async status(): Promise<'os-credential-vault'> { return 'os-credential-vault'; }
  async listMetadata(): Promise<AuthenticatorEntryMetadata[]> {
    return [...this.entries.values()].map(({ metadata: value }) => value).sort((left, right) => left.order - right.order);
  }
  async writeMetadata(entries: readonly AuthenticatorEntryMetadata[], options: AuthenticatorVaultMetadataWriteOptions = {}): Promise<void> {
    if (options.shouldCommit && !options.shouldCommit()) throw Object.assign(new Error('cancelled'), { code: 'ECANCELED' });
    const previous = new Map(this.entries);
    this.entries.clear();
    for (const entry of entries) this.entries.set(entry.id, { metadata: entry, secret: previous.get(entry.id)?.secret ?? '' });
  }
  async save(entry: AuthenticatorEntryMetadata, secret: string, options: AuthenticatorVaultSaveOptions = {}): Promise<void> {
    if (options.shouldCommit && !options.shouldCommit()) throw Object.assign(new Error('cancelled'), { code: 'ECANCELED' });
    this.entries.set(entry.id, { metadata: entry, secret });
  }
  async remove(entryId: string, options: AuthenticatorVaultSaveOptions = {}): Promise<void> {
    if (options.shouldCommit && !options.shouldCommit()) throw Object.assign(new Error('cancelled'), { code: 'ECANCELED' });
    this.entries.delete(entryId);
    if (this.uncertainRemove) throw Object.assign(new Error('rollback could not be verified'), { code: 'EINTEGRITY', committed: true });
    const remaining = [...this.entries.values()].sort(({ metadata: left }, { metadata: right }) => left.order - right.order);
    remaining.forEach(({ metadata: entry }, order) => { entry.order = order; });
  }
  async readSecret(entryId: string): Promise<string | null> { return this.entries.get(entryId)?.secret ?? null; }
}

class Recorder {
  readonly events: HistoryRecordInput[] = [];
  readonly observedVaultSizes: number[] = [];
  fail = false;
  inspectVault: (() => void) | undefined;

  async record(input: HistoryRecordInput): Promise<HistoryEntry> {
    this.inspectVault?.();
    this.events.push(input);
    if (this.fail) throw new Error('history disk failure');
    return { id: randomUUID(), occurredAt: new Date().toISOString(), ...input };
  }
}

describe('authenticator redacted Activity recorder', () => {
  afterEach(() => vi.useRealTimers());

  it('records successful mutations in order with only action and opaque metadata', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T13:30:00.000Z'));
    const vault = new ActivityVault();
    const recorder = new Recorder();
    recorder.inspectVault = () => { recorder.observedVaultSizes.push(vault.entries.size); };
    const service = new AuthenticatorService(vault, recorder);

    const prepared = await service.prepare({ source: 'otpauth-uri', uri: URI });
    expect(prepared.ok).toBe(true);
    const confirmed = await service.confirm({ registrationId: prepared.registrationId!, code: generateTotp({ secret: SECRET, algorithm: 'sha1', digits: 6, periodSeconds: 30 }).code });
    expect(confirmed).toMatchObject({ ok: true, entry: { id: expect.any(String) } });
    expect((await service.rename({ entryId: ID_A, label: 'not-used' })).ok).toBe(false);
    const entryId = (confirmed as { entry: AuthenticatorEntryMetadata }).entry.id;
    expect((await service.rename({ entryId, label: 'Renamed' })).ok).toBe(true);
    expect((await service.setGroup({ entryId, group: 'Work' })).ok).toBe(true);
    expect((await service.reorder({ entryId, order: 0 })).ok).toBe(true);
    vault.entries.set(ID_B, { metadata: metadata(ID_B, 1), secret: 'SECOND-SECRET' });
    expect((await service.bulkRemove({ entryIds: [ID_B], confirmed: true })).ok).toBe(true);
    expect((await service.remove({ entryId, confirmed: true })).ok).toBe(true);

    expect(recorder.events.map((event) => event.message.split('\n')[0])).toEqual([
      expect.stringContaining('Created an authenticator entry'),
      expect.stringContaining('Renamed an authenticator entry'),
      expect.stringContaining('Changed an authenticator entry group label'),
      expect.stringContaining('Reordered an authenticator entry'),
      expect.stringContaining('Deleted authenticator entries'),
      expect.stringContaining('Deleted an authenticator entry'),
    ]);
    const serialized = JSON.stringify(recorder.events);
    for (const forbidden of [SECRET, URI, 'SECOND-SECRET', 'Acme', 'alice@example.com', 'Renamed safely', 'not-used', 'Work', 'cipher', 'qr', '123456']) expect(serialized).not.toContain(forbidden);
    expect(serialized).toContain(entryId);
    expect(recorder.events.find((event) => event.message.startsWith('Deleted authenticator entries'))?.message).toContain('1 entries');
    expect(recorder.events.find((event) => event.message.startsWith('Deleted authenticator entries'))?.messageYue).toContain('1 個項目');
    expect(recorder.observedVaultSizes).toEqual([1, 1, 1, 1, 1, 0]);
  });

  it('records a truthful failed Activity event for a partial bulk delete', async () => {
    const vault = new ActivityVault();
    vault.entries.set(ID_A, { metadata: metadata(ID_A, 0), secret: SECRET });
    const recorder = new Recorder();
    const service = new AuthenticatorService(vault, recorder);

    const result = await service.bulkRemove({ entryIds: [ID_A, ID_B], confirmed: true });
    expect(result).toMatchObject({ ok: false, deletedIds: [ID_A], skippedIds: [ID_B], uncertainIds: [] });
    expect(recorder.events).toHaveLength(1);
    expect(recorder.events[0]).toMatchObject({ ok: false, message: expect.stringContaining('1 deleted, 1 skipped, 0 uncertain'), messageYue: expect.stringContaining('刪除 1 個、跳過 1 個、未能確定 0 個') });
  });

  it('keeps a committed event when School mode changes during recording', async () => {
    const vault = new ActivityVault();
    vault.entries.set(ID_A, { metadata: metadata(ID_A, 0), secret: SECRET });
    const recorder = new Recorder();
    const service = new AuthenticatorService(vault, recorder);
    recorder.inspectVault = () => service.setRestricted(true);

    const result = await service.rename({ entryId: ID_A, label: 'Renamed safely' });
    expect(result.ok).toBe(true);
    expect(recorder.events).toHaveLength(1);
    expect(recorder.events[0].ok).toBe(true);
  });

  it('does not record prepare, wrong-code, restricted, or uncertain mutations', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T13:30:00.000Z'));
    const vault = new ActivityVault();
    vault.entries.set(ID_A, { metadata: metadata(ID_A, 0), secret: SECRET });
    const recorder = new Recorder();
    const service = new AuthenticatorService(vault, recorder);

    const prepared = await service.prepare({ source: 'manual', secret: SECRET, issuer: 'Acme', account: 'alice@example.com', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    expect(prepared.ok).toBe(true);
    expect((await service.confirm({ registrationId: prepared.registrationId!, code: '000000' })).ok).toBe(false);
    service.cancel(prepared.registrationId!);
    service.setRestricted(true);
    expect((await service.rename({ entryId: ID_A, label: 'Restricted' })).ok).toBe(false);
    service.setRestricted(false);
    vault.uncertainRemove = true;
    expect((await service.remove({ entryId: ID_A, confirmed: true })).uncertain).toBe(true);
    expect(recorder.events).toHaveLength(0);
  });

  it('keeps the truthful mutation result when the recorder fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T13:30:00.000Z'));
    const vault = new ActivityVault();
    vault.entries.set(ID_A, { metadata: metadata(ID_A, 0), secret: SECRET });
    const recorder = new Recorder();
    recorder.fail = true;
    const service = new AuthenticatorService(vault, recorder);
    const result = await service.rename({ entryId: ID_A, label: 'Renamed safely' });
    expect(result).toMatchObject({ ok: true, entry: { label: 'Renamed safely' } });
    expect((await vault.listMetadata())[0].label).toBe('Renamed safely');
    expect(recorder.events).toHaveLength(1);
  });
});
