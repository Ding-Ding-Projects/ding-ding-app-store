import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthenticatorService } from '../src/main/authenticator-service.js';
import { createAuthenticatorQr } from '../src/main/authenticator-qr.js';
import { canonicalAuthenticatorUri, parseAuthenticatorUri } from '../src/main/authenticator-uri.js';
import { SafeStorageAuthenticatorVault } from '../src/main/authenticator-vault.js';
import type { AuthenticatorEntryMetadata } from '../src/shared/contracts.js';
import type { AuthenticatorVault } from '../src/main/authenticator-vault-contract.js';
import { generateTotp, MAX_TOTP_TIMESTAMP_MS } from '../src/main/totp.js';
import { writeJsonAtomic } from '../src/main/json-store.js';
import { moveAuthenticatorPickerFocus } from '../src/renderer/authenticator-picker-keyboard.js';
import { authenticatorRegistrationFailureNotice, classifyAuthenticatorRegistrationFailure } from '../src/renderer/authenticator-registration-notifications.js';
import { confirmAuthenticatorWithRefresh } from '../src/renderer/state/use-authenticator.js';
import { AuthenticatorHistoryParticipant } from '../src/main/authenticator-history-participant.js';

vi.mock('electron', () => ({
  app: { getPath: () => os.tmpdir() },
  safeStorage: { isEncryptionAvailable: () => false, encryptString: () => Buffer.alloc(0), decryptString: () => '' },
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcRenderer: { invoke: vi.fn(), on: vi.fn(), removeListener: vi.fn(), send: vi.fn() },
}));

const SECRET = 'JBSWY3DPEHPK3PXP';

function metadata(id = '11111111-1111-4111-8111-111111111111'): AuthenticatorEntryMetadata {
  return {
    id,
    issuer: 'Acme',
    account: 'alice@example.com',
    label: 'Acme · alice@example.com',
    algorithm: 'sha1',
    digits: 6,
    periodSeconds: 30,
    createdAt: '2026-08-11T00:00:00.000Z',
    updatedAt: '2026-08-11T00:00:00.000Z',
    order: 0,
    group: null,
    groupId: null,
  };
}

class MemoryVault implements AuthenticatorVault {
  readonly entries = new Map<string, { metadata: AuthenticatorEntryMetadata; secret: string }>();
  async status(): Promise<'os-credential-vault'> { return 'os-credential-vault'; }
  async listMetadata(): Promise<AuthenticatorEntryMetadata[]> { return [...this.entries.values()].map(({ metadata }) => metadata).sort((a, b) => a.order - b.order); }
  async writeMetadata(entries: readonly AuthenticatorEntryMetadata[]): Promise<void> { const previous = new Map(this.entries); this.entries.clear(); for (const entry of entries) { this.entries.set(entry.id, { metadata: entry, secret: previous.get(entry.id)?.secret ?? '' }); } }
  async save(entry: AuthenticatorEntryMetadata, secret: string): Promise<void> { this.entries.set(entry.id, { metadata: entry, secret }); }
  async remove(entryId: string): Promise<void> { this.entries.delete(entryId); }
  async readSecret(entryId: string): Promise<string | null> { return this.entries.get(entryId)?.secret ?? null; }
}

interface DeferredGate {
  started: Promise<void>;
  release(): void;
  wait(): Promise<void>;
}

function deferredGate(): DeferredGate {
  let startedResolve!: () => void;
  let releaseResolve!: () => void;
  const started = new Promise<void>((resolve) => { startedResolve = resolve; });
  const released = new Promise<void>((resolve) => { releaseResolve = resolve; });
  return { started, release: releaseResolve, wait: async () => { startedResolve(); await released; } };
}

class DeferredVault implements AuthenticatorVault {
  readonly entries = new Map<string, { metadata: AuthenticatorEntryMetadata; secret: string }>();
  failSave = false;
  uncertainSave = false;
  failRemove = false;
  removeCalls = 0;
  statusGate: DeferredGate | undefined;
  metadataGate: DeferredGate | undefined;
  readGate: DeferredGate | undefined;
  saveGate: DeferredGate | undefined;
  async status(): Promise<'os-credential-vault'> { if (this.statusGate) await this.statusGate.wait(); return 'os-credential-vault'; }
  async listMetadata(): Promise<AuthenticatorEntryMetadata[]> {
    if (this.metadataGate) await this.metadataGate.wait();
    return [...this.entries.values()].map(({ metadata }) => metadata).sort((a, b) => a.order - b.order);
  }
  async writeMetadata(entries: readonly AuthenticatorEntryMetadata[]): Promise<void> { for (const entry of entries) { const current = this.entries.get(entry.id); this.entries.set(entry.id, { metadata: entry, secret: current?.secret ?? '' }); } for (const id of this.entries.keys()) if (!entries.some((entry) => entry.id === id)) this.entries.delete(id); }
  async save(entry: AuthenticatorEntryMetadata, secret: string): Promise<void> {
    if (this.saveGate) await this.saveGate.wait();
    if (this.failSave) throw new Error('deferred save failure');
    // Deliberately ignore the optional fence: the service must still detect a
    // transition after an adapter has published and remove the saved entry.
    this.entries.set(entry.id, { metadata: entry, secret });
    if (this.uncertainSave) { const error = new Error('rollback could not be verified') as NodeJS.ErrnoException & { committed?: boolean }; error.code = 'EINTEGRITY'; error.committed = true; throw error; }
  }
  async remove(entryId: string): Promise<void> { this.removeCalls += 1; if (this.failRemove) throw new Error('rollback failure'); this.entries.delete(entryId); }
  async readSecret(entryId: string): Promise<string | null> {
    if (this.readGate) await this.readGate.wait();
    return this.entries.get(entryId)?.secret ?? null;
  }
}

describe('otpauth URI and local QR registration boundary', () => {
  afterEach(() => vi.useRealTimers());

  it('parses and canonicalizes a totp URI while rejecting unsafe variants', () => {
    const input = 'otpauth://totp/Acme%3Aalice%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Acme&algorithm=SHA256&digits=8&period=45';
    const parsed = parseAuthenticatorUri(input);
    expect(parsed).toMatchObject({ issuer: 'Acme', account: 'alice@example.com', secret: SECRET, algorithm: 'sha256', digits: 8, periodSeconds: 45 });
    expect(parseAuthenticatorUri(canonicalAuthenticatorUri(parsed))).toEqual(parsed);
    for (const invalid of [
      input.replace('otpauth://totp/', 'otpauth://hotp/'),
      input.replace('&issuer=Acme', '&issuer=Other'),
      `${input}&digits=8`,
      `${input}&unknown=value`,
      input.replace('otpauth://totp/', 'otpauth://user:pass@totp/'),
      `${input}#fragment`,
      'otpauth://totp/Acme%ZZ:alice?secret=JBSWY3DPEHPK3PXP',
    ]) expect(() => parseAuthenticatorUri(invalid)).toThrow();
  });

  it('builds a bounded local QR matrix without returning the URI or secret', () => {
    const uri = canonicalAuthenticatorUri(parseAuthenticatorUri('otpauth://totp/Acme:alice?secret=JBSWY3DPEHPK3PXP'));
    const qr = createAuthenticatorQr(uri);
    expect(qr.schemaVersion).toBe(1);
    expect(qr.size).toBeGreaterThanOrEqual(21);
    expect(qr.size).toBeLessThanOrEqual(177);
    expect(qr.modules).toHaveLength(qr.size);
    expect(qr.modules.every((row) => row.length === qr.size && /^[01]+$/.test(row))).toBe(true);
    expect(JSON.stringify(qr)).not.toContain(SECRET);
  });

  it('requires a current pairing code before persisting and lists metadata plus codes only', async () => {
    const vault = new MemoryVault();
    const service = new AuthenticatorService(vault);
    const prepared = await service.prepare({ source: 'otpauth-uri', uri: 'otpauth://totp/Acme:alice?secret=JBSWY3DPEHPK3PXP' });
    expect(prepared.ok).toBe(true);
    expect(JSON.stringify(prepared)).not.toContain(SECRET);
    expect(JSON.stringify(prepared)).not.toContain('otpauth://');
    const registrationId = prepared.registrationId!;
    const wrong = await service.confirm({ registrationId, code: '000000' });
    expect(wrong.ok).toBe(false);
    const right = generateTotp({ secret: SECRET, algorithm: 'sha1', digits: 6, periodSeconds: 30 }).code;
    const confirmed = await service.confirm({ registrationId, code: right });
    expect(confirmed).toMatchObject({ ok: true });
    expect(JSON.stringify(confirmed)).not.toContain(SECRET);
    const list = await service.list();
    expect(list.entries).toHaveLength(1);
    expect(list.entries[0]).toMatchObject({ issuer: 'Acme', account: 'alice', code: expect.stringMatching(/^\d{6}$/) });
    expect(JSON.stringify(list)).not.toContain(SECRET);
  });

  it('returns the next period code as a rollover peek without exposing the secret', async () => {
    vi.useFakeTimers();
    const atMs = 1_700_000_012_345;
    vi.setSystemTime(atMs);
    const vault = new MemoryVault();
    const service = new AuthenticatorService(vault);
    const prepared = await service.prepare({ source: 'manual', secret: SECRET, issuer: 'Acme', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    const current = generateTotp({ secret: SECRET, algorithm: 'sha1', digits: 6, periodSeconds: 30, timestampMs: atMs });
    expect((await service.confirm({ registrationId: prepared.registrationId!, code: current.code })).ok).toBe(true);
    const next = generateTotp({ secret: SECRET, algorithm: 'sha1', digits: 6, periodSeconds: 30, timestampMs: current.expiresAtMs });
    const listed = await service.list();
    expect(listed.entries[0]).toMatchObject({ code: current.code, nextCode: next.code });
    expect(JSON.stringify(listed)).not.toContain(SECRET);
  });

  it('fails closed without a next-code peek at the supported maximum clock', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(MAX_TOTP_TIMESTAMP_MS);
    const vault = new MemoryVault();
    const service = new AuthenticatorService(vault);
    vault.entries.set(metadata().id, { metadata: { ...metadata(), algorithm: 'sha512', digits: 8, periodSeconds: 3_600 }, secret: SECRET });
    const current = generateTotp({ secret: SECRET, algorithm: 'sha512', digits: 8, periodSeconds: 3_600, timestampMs: MAX_TOTP_TIMESTAMP_MS });
    const listed = await service.list();
    expect(listed.entries[0]).toMatchObject({ code: current.code, nextCode: null });
  });

  it('accepts manual metadata without an issuer when the optional field is blank', async () => {
    const vault = new MemoryVault();
    const service = new AuthenticatorService(vault);
    const prepared = await service.prepare({ source: 'manual', secret: SECRET, issuer: '  ', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    expect(prepared).toMatchObject({ ok: true, metadata: { issuer: '', account: 'alice', label: 'alice' } });
  });

  it('cancels an unfinished pairing and clears its pending secret', async () => {
    const vault = new MemoryVault();
    const service = new AuthenticatorService(vault);
    const prepared = await service.prepare({ source: 'manual', secret: SECRET, issuer: 'Acme', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    service.cancel(prepared.registrationId!);
    expect((service as unknown as { pending: Map<string, unknown> }).pending.size).toBe(0);
    const confirm = await service.confirm({ registrationId: prepared.registrationId!, code: '000000' });
    expect(confirm.ok).toBe(false);
    expect(JSON.stringify(vault.entries)).not.toContain(SECRET);
  });

  it('cancels a pending pairing by renderer attempt id when prepare response is lost', async () => {
    const vault = new MemoryVault();
    const service = new AuthenticatorService(vault);
    const attemptId = '11111111-1111-4111-8111-111111111111';
    const prepared = await service.prepare({ source: 'manual', attemptId, secret: SECRET, issuer: 'Acme', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    expect(prepared.ok).toBe(true);
    service.cancelAttempt(attemptId);
    expect((service as unknown as { pending: Map<string, unknown> }).pending.size).toBe(0);
    expect(JSON.stringify(vault.entries)).not.toContain(SECRET);
  });

  it('refreshes after a post-save confirmation response loss before rethrowing', async () => {
    let saved = false;
    let refreshes = 0;
    const droppedResponse = new Error('ERR_IPC_CHANNEL_CLOSED after main-process publication');
    await expect(confirmAuthenticatorWithRefresh(async () => {
      saved = true;
      throw droppedResponse;
    }, async () => {
      if (saved) refreshes += 1;
    })).rejects.toBe(droppedResponse);
    expect(saved).toBe(true);
    expect(refreshes).toBe(1);
  });

  it('refreshes after a typed false confirmation result with uncertain publication', async () => {
    let refreshes = 0;
    const result = await confirmAuthenticatorWithRefresh(async () => ({
      ok: false,
      uncertain: true,
      message: 'The saved entry could not be reconciled.',
      messageYue: '未能核對已儲存項目。',
    }), async () => { refreshes += 1; });
    expect(result.ok).toBe(false);
    expect(refreshes).toBe(1);
  });

  it('fails closed when the vault is unavailable and expires unfinished pairings', async () => {
    const unavailable = new AuthenticatorService();
    const rejected = await unavailable.prepare({ source: 'manual', secret: SECRET, issuer: 'Acme', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    expect(rejected).toMatchObject({ ok: false, storage: 'memory-only' });

    const vault = new MemoryVault();
    const service = new AuthenticatorService(vault);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-11T00:00:00.000Z'));
    const prepared = await service.prepare({ source: 'manual', secret: SECRET, issuer: 'Acme', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    vi.advanceTimersByTime(10 * 60 * 1_000 + 1);
    const expired = await service.confirm({ registrationId: prepared.registrationId!, code: '000000' });
    expect(expired.ok).toBe(false);
    expect((await service.list()).entries).toHaveLength(0);
  });
});

describe('safeStorage ciphertext rollback', () => {
  let directory: string | undefined;
  afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = undefined; });

  async function createVault(overrides: Partial<ConstructorParameters<typeof SafeStorageAuthenticatorVault>[0]> = {}, atomicNoFollow: () => boolean = () => true) {
    directory = await mkdtemp(path.join(os.tmpdir(), 'ding-auth-'));
    return SafeStorageAuthenticatorVault.forTests({
      metadataPath: path.join(directory, 'authenticator.v1.json'),
      secretsDirectory: path.join(directory, 'secrets'),
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
      decryptString: (value) => value.toString('utf8').replace(/^encrypted:/, ''),
      ...overrides,
    }, atomicNoFollow);
  }

  it('removes the ciphertext when metadata publication fails', async () => {
    const vault = await createVault({ writeMetadata: async () => { throw new Error('metadata write failure'); } });
    await expect(vault.save(metadata(), SECRET)).rejects.toThrow('metadata write failure');
    expect(await vault.listMetadata()).toEqual([]);
    await expect(readdir(path.join(directory!, 'secrets'))).resolves.toHaveLength(0);
  });

  it('binds ciphertext to the stable entry identifier and round-trips a protected history snapshot', async () => {
    const vault = await createVault();
    await vault.save(metadata(), SECRET);
    const snapshot = await vault.createHistorySnapshot();
    expect(snapshot?.ciphertext).toHaveLength(1);
    expect(JSON.stringify(snapshot)).not.toContain(SECRET);
    await vault.remove(metadata().id);
    await vault.restoreHistorySnapshot(snapshot!);
    await expect(vault.readSecret(metadata().id)).resolves.toBe(SECRET);
    const swapped = { ...snapshot!, ciphertext: [{ ...snapshot!.ciphertext[0], entryId: '22222222-2222-4222-8222-222222222222' }] };
    await expect(vault.restoreHistorySnapshot(swapped)).rejects.toThrow();
  });

  it('rejects unexpected ciphertext files and unavailable vault restores', async () => {
    const vault = await createVault();
    await vault.save(metadata(), SECRET);
    await writeFile(path.join(directory!, 'secrets', 'notes.txt'), 'not a credential');
    await expect(vault.createHistorySnapshot()).rejects.toThrow('unexpected');
    const unavailable = await createVault({ isEncryptionAvailable: () => false });
    await expect(unavailable.restoreHistorySnapshot({ schemaVersion: 1, metadata: [], groups: [], ciphertext: [] })).rejects.toThrow('unavailable');
  });

  it('refuses protected restore when atomic no-follow operations are unavailable', async () => {
    const vault = await createVault({}, () => false);
    await vault.save(metadata(), SECRET);
    await expect(vault.restoreHistorySnapshot({ schemaVersion: 1, metadata: [metadata()], groups: [], ciphertext: [] })).rejects.toMatchObject({ code: 'EUNSUPPORTED' });
    await expect(vault.readSecret(metadata().id)).resolves.toBe(SECRET);
  });

  it('keeps the production constructor fail-closed with no capability override', async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'ding-auth-production-'));
    const vault = new SafeStorageAuthenticatorVault({
      metadataPath: path.join(directory!, 'authenticator.v1.json'),
      secretsDirectory: path.join(directory!, 'secrets'),
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
      decryptString: (value) => value.toString('utf8').replace(/^encrypted:/, ''),
    });
    expect(vault.supportsAtomicNoFollow()).toBe(false);
    await expect(vault.createHistorySnapshot()).resolves.toBeNull();
    await expect(vault.restoreHistorySnapshot({ schemaVersion: 1, metadata: [], groups: [], ciphertext: [] })).rejects.toMatchObject({ code: 'EUNSUPPORTED' });
    await expect(readFile(path.join(directory!, 'authenticator.v1.json'))).rejects.toThrow();
    await expect(readdir(path.join(directory!, 'secrets'))).rejects.toThrow();
  });

  it('restores metadata when an injected writer publishes before rejecting', async () => {
    let calls = 0;
    const vault = await createVault({
      writeMetadata: async (filePath, value, options) => {
        calls += 1;
        await writeJsonAtomic(filePath, value, { shouldPublish: options?.shouldPublish });
        if (calls === 1) throw new Error('post-publication metadata failure');
      },
    });
    await expect(vault.writeMetadata([metadata()])).rejects.toThrow('post-publication metadata failure');
    expect(await vault.listMetadata()).toEqual([]);
    expect(calls).toBe(2);
  });

  it('rolls back a save when its metadata writer publishes before rejecting', async () => {
    let calls = 0;
    const vault = await createVault({
      writeMetadata: async (filePath, value, options) => {
        calls += 1;
        await writeJsonAtomic(filePath, value, { shouldPublish: options?.shouldPublish });
        if (calls === 1) throw new Error('post-publication save failure');
      },
    });
    await expect(vault.save(metadata(), SECRET)).rejects.toThrow('post-publication save failure');
    expect(await vault.listMetadata()).toEqual([]);
    await expect(readdir(path.join(directory!, 'secrets'))).resolves.toHaveLength(0);
    expect(calls).toBe(2);
  });

  it('restores a delete when its metadata writer publishes before rejecting', async () => {
    let calls = 0;
    const vault = await createVault({
      writeMetadata: async (filePath, value, options) => {
        calls += 1;
        await writeJsonAtomic(filePath, value, { shouldPublish: options?.shouldPublish });
        if (calls === 2) throw new Error('post-publication delete failure');
      },
    });
    await vault.save(metadata(), SECRET);
    await expect(vault.remove(metadata().id)).rejects.toThrow('post-publication delete failure');
    expect(await vault.listMetadata()).toEqual([metadata()]);
    await expect(vault.readSecret(metadata().id)).resolves.toBe(SECRET);
  });

  it('removes a temporary ciphertext when secret rename fails', async () => {
    const vault = await createVault({ renameSecret: async () => { throw new Error('secret rename failure'); } });
    await expect(vault.save(metadata(), SECRET)).rejects.toThrow('secret rename failure');
    expect(await vault.listMetadata()).toEqual([]);
    await expect(readdir(path.join(directory!, 'secrets'))).resolves.toHaveLength(0);
    await expect(readFile(path.join(directory!, 'authenticator.v1.json'))).rejects.toThrow();
  });

  it('serializes concurrent metadata transactions without dropping an entry', async () => {
    const vault = await createVault();
    const second = metadata('22222222-2222-4222-8222-222222222222');
    await Promise.all([vault.save(metadata(), SECRET), vault.save(second, SECRET)]);
    expect((await vault.listMetadata()).map((entry) => entry.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });

  it('serializes two vault objects that share the same application-data paths', async () => {
    const first = await createVault();
    const second = new SafeStorageAuthenticatorVault({
      metadataPath: path.join(directory!, 'authenticator.v1.json'),
      secretsDirectory: path.join(directory!, 'secrets'),
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
      decryptString: (value) => value.toString('utf8').replace(/^encrypted:/, ''),
    });
    await Promise.all([
      first.save(metadata(), SECRET),
      second.save(metadata('22222222-2222-4222-8222-222222222222'), SECRET),
    ]);
    expect((await second.listMetadata()).map((entry) => entry.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
    ]);
  });
});

describe('authenticator history participant lifecycle', () => {
  let directory: string | undefined;
  afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = undefined; });

  function snapshot() {
    return { schemaVersion: 1 as const, metadata: [metadata()], groups: [], ciphertext: [{ entryId: metadata().id, base64: 'ZW5j' }] };
  }

  it('treats a missing journal as a clean first launch and removes a committed journal', async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'ding-auth-history-'));
    const journal = path.join(directory, 'restore.json');
    let restores = 0;
    const vault: AuthenticatorVault = {
      status: async () => 'os-credential-vault', listMetadata: async () => [metadata()], writeMetadata: async () => undefined,
      save: async () => undefined, remove: async () => undefined, readSecret: async () => SECRET,
      createHistorySnapshot: async () => snapshot(), restoreHistorySnapshot: async () => { restores += 1; },
      supportsAtomicNoFollow: () => true,
    };
    const participant = new AuthenticatorHistoryParticipant(vault, journal);
    await participant.recover();
    await writeJsonAtomic(journal, { schemaVersion: 1, phase: 'committed', previous: snapshot(), target: snapshot() });
    await participant.recover();
    await expect(readFile(journal, 'utf8')).rejects.toThrow();
    expect(restores).toBe(0);
  });

  it('retains malformed journals and blocks a retry after rollback integrity failure', async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'ding-auth-history-'));
    const journal = path.join(directory, 'restore.json');
    await writeFile(journal, '{"schemaVersion":1,"phase":"applying"');
    const vault: AuthenticatorVault = {
      status: async () => 'os-credential-vault', listMetadata: async () => [metadata()], writeMetadata: async () => undefined,
      save: async () => undefined, remove: async () => undefined, readSecret: async () => SECRET,
      createHistorySnapshot: async () => snapshot(), restoreHistorySnapshot: async () => { throw new Error('restore failure'); },
    };
    const participant = new AuthenticatorHistoryParticipant(vault, journal);
    await expect(participant.recover()).resolves.toMatchObject({ status: 'unavailable', code: 'EUNSUPPORTED' });
    await expect(readFile(journal, 'utf8')).resolves.toContain('phase');
    await expect(participant.restore(JSON.stringify(snapshot()))).rejects.toMatchObject({ code: 'EUNSUPPORTED' });
    await expect(readFile(journal, 'utf8')).resolves.toContain('phase');
  });

  it('retains a recovery journal and reports typed unavailability without mutating', async () => {
    directory = await mkdtemp(path.join(os.tmpdir(), 'ding-auth-history-'));
    const journal = path.join(directory, 'restore.json');
    await writeJsonAtomic(journal, { schemaVersion: 1, phase: 'applying', previous: snapshot(), target: snapshot() });
    const vault: AuthenticatorVault = {
      status: async () => 'os-credential-vault', listMetadata: async () => [metadata()], writeMetadata: async () => undefined,
      save: async () => undefined, remove: async () => undefined, readSecret: async () => SECRET,
      createHistorySnapshot: async () => null, restoreHistorySnapshot: async () => { throw new Error('must not mutate'); },
      supportsAtomicNoFollow: () => false,
    };
    const result = await new AuthenticatorHistoryParticipant(vault, journal).recover();
    expect(result).toMatchObject({ status: 'unavailable', code: 'EUNSUPPORTED' });
    await expect(readFile(journal, 'utf8')).resolves.toContain('applying');
  });

  it('refuses participant restore without a current rollback snapshot', async () => {
    const vault: AuthenticatorVault = {
      status: async () => 'os-credential-vault', listMetadata: async () => [], writeMetadata: async () => undefined,
      save: async () => undefined, remove: async () => undefined, readSecret: async () => null,
      createHistorySnapshot: async () => null, restoreHistorySnapshot: async () => undefined,
    };
    const participant = new AuthenticatorHistoryParticipant(vault);
    await expect(participant.restore(JSON.stringify(snapshot()))).rejects.toMatchObject({ code: 'EUNSUPPORTED' });
  });
});

describe('preload authenticator response boundary', () => {
  it('rejects response shapes that could carry a secret or omit a required entry', async () => {
    const preload = await import('../src/preload/index.js');
    expect(() => preload.parseAuthenticatorPreviewResult({
      ok: false,
      storage: 'memory-only',
      message: 'no',
      messageYue: '冇',
      secret: SECRET,
    })).toThrow();
    expect(() => preload.parseAuthenticatorMutation({ ok: true, message: 'saved', messageYue: '已儲存' })).toThrow();
    expect(preload.parseAuthenticatorMutation({ ok: false, uncertain: true, message: 'uncertain', messageYue: '未能確定' })).toMatchObject({ ok: false, uncertain: true });
    expect(() => preload.parseAuthenticatorMutation({ ok: true, uncertain: true, entry: metadata(), message: 'bad', messageYue: '唔啱' })).toThrow();
    expect(() => preload.parseAuthenticatorList({
      entries: [{ ...metadata(), groupId: null, code: null, nextCode: null, remainingSeconds: null, expiresAt: null, secret: SECRET }],
      storage: 'os-vault',
      message: 'ok',
      messageYue: '好',
    })).toThrow();
    const listed = preload.parseAuthenticatorList({
      entries: [{ ...metadata(), groupId: null, code: '123456', nextCode: '654321', remainingSeconds: 12, expiresAt: '2026-08-11T00:00:30.000Z' }],
      storage: 'os-vault',
      message: 'ok',
      messageYue: '好',
    });
    expect(listed.entries[0].nextCode).toBe('654321');
    expect(() => preload.parseAuthenticatorList({
      entries: [{ ...metadata(), groupId: null, code: null, nextCode: '654321', remainingSeconds: 12, expiresAt: '2026-08-11T00:00:30.000Z' }],
      storage: 'os-vault',
      message: 'ok',
      messageYue: '好',
    })).toThrow();
    expect(() => preload.parseAuthenticatorList({
      entries: [{ ...metadata(), groupId: null, code: '123456', nextCode: null, remainingSeconds: 12, expiresAt: '2026-08-11T00:00:30.000Z' }],
      storage: 'os-vault',
      message: 'ok',
      messageYue: '好',
    })).toThrow();
    expect(() => preload.parseAuthenticatorList({
      entries: [{ ...metadata(), code: '123456', nextCode: '12', remainingSeconds: 12, expiresAt: '2026-08-11T00:00:30.000Z' }],
      storage: 'os-vault',
      message: 'ok',
      messageYue: '好',
    })).toThrow();
    expect(() => preload.parseAuthenticatorPreviewResult({ ok: true, storage: 'memory-only', message: 'incomplete', messageYue: '唔完整' })).toThrow();
    expect(preload.parseAuthenticatorPreviewResult({ ok: true, code: '123456', remainingSeconds: 12, expiresAt: '2026-08-11T00:00:30.000Z', algorithm: 'sha1', digits: 6, periodSeconds: 30, storage: 'memory-only', message: 'ok', messageYue: '好' }).code).toBe('123456');
    const registrationFailure = { ok: false, storage: 'memory-only', message: 'failed', messageYue: '失敗' };
    expect(() => preload.parseAuthenticatorRegistrationPreview({ ...registrationFailure, registrationId: '11111111-1111-4111-8111-111111111111' })).toThrow();
    expect(() => preload.parseAuthenticatorRegistrationPreview({ ...registrationFailure, registrationId: undefined })).toThrow();
    expect(() => preload.parseAuthenticatorRegistrationPreview({ ...registrationFailure, metadata: metadata() })).toThrow();
    expect(() => preload.parseAuthenticatorRegistrationPreview({ ...registrationFailure, qr: { schemaVersion: 1, size: 21, modules: Array.from({ length: 21 }, () => '0'.repeat(21)), errorCorrectionLevel: 'M' } })).toThrow();
  });
});

describe('renderer registration rejection notifications', () => {
  it('classifies parser, transport, and unknown failures without echoing raw errors', () => {
    expect(classifyAuthenticatorRegistrationFailure(new Error('The authenticator registration response was invalid.'))).toBe('response-invalid');
    expect(classifyAuthenticatorRegistrationFailure({ code: 'ERR_IPC_CHANNEL_CLOSED', message: SECRET })).toBe('transport');
    expect(classifyAuthenticatorRegistrationFailure(new Error(SECRET))).toBe('unexpected');
    const prepare = authenticatorRegistrationFailureNotice('prepare', new Error('The authenticator registration response was invalid.'));
    expect(prepare.reason).toBe('response-invalid');
    expect(prepare.message).toContain('form and any existing preview are unchanged');
    expect(prepare.message).toContain('attempted to clear this pending attempt');
    expect(prepare.title).toContain('registration failed');
    expect(prepare.messageYue).toContain('表格同現有預覽保持不變');
    expect(`${prepare.message} ${prepare.messageYue}`).not.toContain(SECRET);
    const confirm = authenticatorRegistrationFailureNotice('confirm', { code: 'ERR_IPC_CHANNEL_CLOSED', message: SECRET });
    expect(confirm.reason).toBe('transport');
    expect(confirm.message).toContain('pairing preview remains active');
    expect(confirm.message).toContain('may already contain this entry');
    expect(confirm.title).toContain('needs review');
    expect(confirm.messageYue).toContain('配對預覽仍然有效');
    expect(`${confirm.message} ${confirm.messageYue}`).not.toContain(SECRET);
  });

  it('keeps registration rejection handling non-blocking and state-preserving', async () => {
    const source = (await readFile(path.join(process.cwd(), 'src/renderer/pages/AuthenticatorPage.tsx'), 'utf8')).replace(/\r\n/g, '\n');
    const notices = (await readFile(path.join(process.cwd(), 'src/renderer/authenticator-registration-notifications.ts'), 'utf8')).replace(/\r\n/g, '\n');
    expect(source).toContain("authenticatorRegistrationFailureNotice('prepare', error)");
    expect(source).toContain("authenticatorRegistrationFailureNotice('confirm', error)");
    expect(source).toContain("category: 'error'");
    expect(source).toContain('title: label(viewSettings, failure.title, failure.titleYue)');
    expect(source).toContain('preparingRegistration');
    expect(source).toContain('prepareGeneration');
    expect(source).toContain('globalThis.crypto.randomUUID()');
    expect(source).toContain('setConfirmingRegistrationId(null)');
    expect(notices).toContain('the form and any existing preview are unchanged');
    expect(notices).toContain('the saved-entry list may already contain this entry');
    expect(notices).toContain('attempted to clear this pending attempt');
    const hook = (await readFile(path.join(process.cwd(), 'src/renderer/state/use-authenticator.ts'), 'utf8')).replace(/\r\n/g, '\n');
    expect(hook).toContain('cancelAttempt(request.attemptId)');
    expect(hook).toContain('catch (error)');
    expect(hook).toContain('try { await refresh(); } catch');
    expect(source).not.toContain('catch (error) { setPreview(null)');
  });
});

describe('main-process restricted capability seam', () => {
  it('moves the live picker focus from the filter input without wrapping bugs', () => {
    expect(moveAuthenticatorPickerFocus('ArrowDown', 0, 3)).toBe(1);
    expect(moveAuthenticatorPickerFocus('ArrowUp', 0, 3)).toBe(2);
    expect(moveAuthenticatorPickerFocus('Home', 2, 3)).toBe(0);
    expect(moveAuthenticatorPickerFocus('End', 0, 3)).toBe(2);
    expect(moveAuthenticatorPickerFocus('Enter', 1, 3)).toBeNull();
  });
  it('checks the live School-mode restriction for every authenticator IPC route', async () => {
    const source = await readFile(path.join(process.cwd(), 'src/main/main.ts'), 'utf8');
    for (const channel of ['authenticator:status', 'authenticator:preview', 'authenticator:prepare', 'authenticator:cancel-attempt', 'authenticator:confirm', 'authenticator:cancel', 'authenticator:list']) {
      expect(source).toContain(`ipcMain.handle('${channel}'`);
    }
    expect(source).toContain('schoolMode.isRestricted()');
    expect(source).toContain('authenticator.setRestricted(restricted)');
    expect(source).toContain('app.requestSingleInstanceLock()');
    expect(source).toContain("app.on('second-instance'");
  });

  it('clears a pending pairing as soon as the main capability is restricted', async () => {
    const vault = new MemoryVault();
    const service = new AuthenticatorService(vault);
    const prepared = await service.prepare({ source: 'manual', secret: SECRET, issuer: 'Acme', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    expect(prepared.ok).toBe(true);
    service.setRestricted(true);
    const denied = await service.confirm({ registrationId: prepared.registrationId!, code: '000000' });
    expect(denied.ok).toBe(false);
    expect(JSON.stringify(vault.entries)).not.toContain(SECRET);
  });

  it('does not publish a pending QR after School mode changes while vault status is deferred', async () => {
    const vault = new DeferredVault();
    vault.statusGate = deferredGate();
    const service = new AuthenticatorService(vault);
    const preparedPromise = service.prepare({ source: 'manual', secret: SECRET, issuer: 'Acme', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    await vault.statusGate.started;
    service.setRestricted(true);
    vault.statusGate.release();
    const prepared = await preparedPromise;
    expect(prepared.ok).toBe(false);
    expect((service as unknown as { pending: Map<string, unknown> }).pending.size).toBe(0);
  });

  it('returns a restricted status when School mode changes while status is deferred', async () => {
    const vault = new DeferredVault();
    vault.statusGate = deferredGate();
    const service = new AuthenticatorService(vault);
    const statusPromise = service.status();
    await vault.statusGate.started;
    service.setRestricted(true);
    vault.statusGate.release();
    expect(await statusPromise).toMatchObject({ available: false, vault: 'unavailable', entryCount: 0 });
  });

  it('returns no entries when School mode changes while a vault read is deferred', async () => {
    const vault = new DeferredVault();
    vault.entries.set('11111111-1111-4111-8111-111111111111', { metadata: metadata(), secret: SECRET });
    vault.readGate = deferredGate();
    const service = new AuthenticatorService(vault);
    const listPromise = service.list();
    await vault.readGate.started;
    service.setRestricted(true);
    vault.readGate.release();
    const listed = await listPromise;
    expect(listed).toMatchObject({ entries: [], storage: 'memory-only' });
    expect(JSON.stringify(listed)).not.toContain(SECRET);
  });

  it('rolls back an entry published by a deferred vault after School mode changes', async () => {
    const vault = new DeferredVault();
    vault.saveGate = deferredGate();
    const service = new AuthenticatorService(vault);
    const prepared = await service.prepare({ source: 'manual', secret: SECRET, issuer: 'Acme', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    const right = generateTotp({ secret: SECRET, algorithm: 'sha1', digits: 6, periodSeconds: 30 }).code;
    const confirmationPromise = service.confirm({ registrationId: prepared.registrationId!, code: right });
    await vault.saveGate.started;
    service.setRestricted(true);
    vault.saveGate.release();
    const confirmation = await confirmationPromise;
    expect(confirmation.ok).toBe(false);
    expect(vault.entries.size).toBe(0);
    expect(JSON.stringify(vault.entries)).not.toContain(SECRET);
  });

  it('rolls back an in-flight confirmation when the user discards its pairing preview', async () => {
    const vault = new DeferredVault();
    vault.saveGate = deferredGate();
    const service = new AuthenticatorService(vault);
    const prepared = await service.prepare({ source: 'manual', secret: SECRET, issuer: 'Acme', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    const right = generateTotp({ secret: SECRET, algorithm: 'sha1', digits: 6, periodSeconds: 30 }).code;
    const confirmationPromise = service.confirm({ registrationId: prepared.registrationId!, code: right });
    await vault.saveGate.started;
    service.cancel(prepared.registrationId!);
    vault.saveGate.release();
    const confirmation = await confirmationPromise;
    expect(confirmation).toMatchObject({ ok: false });
    expect(vault.entries.size).toBe(0);
    expect(JSON.stringify(vault.entries)).not.toContain(SECRET);
  });

  it('rejects duplicate in-flight confirmations without rolling back the first save', async () => {
    const vault = new DeferredVault();
    vault.saveGate = deferredGate();
    const service = new AuthenticatorService(vault);
    const prepared = await service.prepare({ source: 'manual', secret: SECRET, issuer: 'Acme', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    const right = generateTotp({ secret: SECRET, algorithm: 'sha1', digits: 6, periodSeconds: 30 }).code;
    const first = service.confirm({ registrationId: prepared.registrationId!, code: right });
    await vault.saveGate.started;
    const duplicate = await service.confirm({ registrationId: prepared.registrationId!, code: right });
    expect(duplicate).toMatchObject({ ok: false, message: 'A pairing confirmation is already in progress; wait for it to finish.' });
    expect(vault.entries.size).toBe(0);
    vault.saveGate.release();
    expect(await first).toMatchObject({ ok: true });
    expect(vault.entries).toHaveProperty('size', 1);
  });

  it('does not roll back an entry when a cancelled confirmation never published', async () => {
    const vault = new DeferredVault();
    vault.saveGate = deferredGate();
    vault.failSave = true;
    const service = new AuthenticatorService(vault);
    const prepared = await service.prepare({ source: 'manual', secret: SECRET, issuer: 'Acme', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    const right = generateTotp({ secret: SECRET, algorithm: 'sha1', digits: 6, periodSeconds: 30 }).code;
    const confirmation = service.confirm({ registrationId: prepared.registrationId!, code: right });
    await vault.saveGate.started;
    service.cancel(prepared.registrationId!);
    vault.saveGate.release();
    expect(await confirmation).toMatchObject({ ok: false });
    expect(vault.removeCalls).toBe(0);
    expect(vault.entries.size).toBe(0);
  });

  it('marks a published confirmation as uncertain when rollback fails', async () => {
    const vault = new DeferredVault();
    vault.uncertainSave = true;
    vault.failRemove = true;
    const service = new AuthenticatorService(vault);
    const prepared = await service.prepare({ source: 'manual', secret: SECRET, issuer: 'Acme', account: 'alice', algorithm: 'sha1', digits: 6, periodSeconds: 30 });
    const right = generateTotp({ secret: SECRET, algorithm: 'sha1', digits: 6, periodSeconds: 30 }).code;
    const confirmation = await service.confirm({ registrationId: prepared.registrationId!, code: right });
    expect(confirmation).toMatchObject({ ok: false, uncertain: true });
    expect(vault.entries).toHaveProperty('size', 1);
  });

  it('clears the renderer manual secret when switching registration source', async () => {
    const source = (await readFile(path.join(process.cwd(), 'src/renderer/pages/AuthenticatorPage.tsx'), 'utf8')).replace(/\r\n/g, '\n');
    expect(source).toContain("setSource(value as typeof source); setPreview(null); setSecret(''); setUri(''); setShowSecret(false);");
    expect(source).toContain('const displayCode = showingRolloverCode ? entry.nextCode : seconds === 0 ? null : entry.code;');
    expect(source).toContain('now < expiresAtMs + entry.periodSeconds * 1_000');
    expect(source).toContain("className=\"authenticator-next-code\"");
    expect(source).toContain('disabled={Boolean(preview?.ok) || preparingRegistration}');
    expect(source).toContain('aria-live="polite" aria-atomic="true"');
    expect(source).toContain('groupedSecret(secret)');
    expect(source).toContain('Copy grouped Base32');
    expect(source).toContain('type={showSecret ? \'text\' : \'password\'}');
    expect(source).toContain('otpauth://totp/ URI (hidden until reveal)');
    expect(source).toContain('copyRegistrationUri');
    expect(source).toContain('Copy otpauth URI');
    expect(source).toContain('discardPairing');
    expect(source).toContain('confirmingRegistrationId');
    expect(source).toContain('uncertainRegistrationId');
    expect(source).toContain('disabled={!confirmationCode || confirmingRegistrationId === preview.registrationId || uncertainRegistrationId === preview.registrationId}');
    expect(source).toContain('do not retry it');
    expect(source).toContain('setPreview(next);');
    expect(source).toContain("setConfirmationCode('');");
    expect(source).toContain('setShowSecret(false);');
  });

  it('uses independent searchable keyboard pickers for source, algorithm, and digits', async () => {
    const source = (await readFile(path.join(process.cwd(), 'src/renderer/pages/AuthenticatorPage.tsx'), 'utf8')).replace(/\r\n/g, '\n');
    const builder = (await readFile(path.join(process.cwd(), 'src/renderer/components/RegexBuilder.tsx'), 'utf8')).replace(/\r\n/g, '\n');
    const styles = (await readFile(path.join(process.cwd(), 'src/renderer/styles/pages.css'), 'utf8')).replace(/\r\n/g, '\n');
    expect(source).not.toMatch(/<select[^>]+id="authenticator-(source|algorithm|digits)"/u);
    expect(source).toContain('function AuthenticatorPicker');
    expect(source).toContain('role="listbox"');
    expect(source).toContain('role="option"');
    expect(source).toContain('aria-selected={option.value === value}');
    expect(source).toContain("if (event.key === 'Escape')");
    expect(source).toContain("target?.closest('.regex-builder')");
    expect(source).toContain("if (targetRole !== 'option' && targetRole !== 'listbox' && !isSearchInput) return;");
    expect(source).toContain("target?.matches('input[type=\"search\"]')");
    expect(source).toContain('moveAuthenticatorPickerFocus(event.key, activeIndex, visibleOptions.length)');
    expect(source).toContain('{open && !disabled && <section');
    expect(source).toContain("setQuery(''); setRegex(null); close();");
    expect(source).toContain('initialPattern={regex?.pattern} initialFlags={regex?.flags}');
    expect(source).toContain('aria-haspopup="dialog"');
    expect(source).toContain('aria-label={label(settings, `${labelText}: ${selected?.label ?? \'\'}`');
    expect(source).toContain('authenticator-picker-result-count');
    expect(source).toContain('role="status"');
    expect(builder).toContain('type="button" className="filled-button" disabled={result.pending');
    expect(builder).toContain("label(settings, 'Close regex builder', '關閉 Regex 建造器')");
    expect(builder).toContain("label(settings, 'Guided regex parts', '引導式 Regex 元件')");
    expect(builder).toContain("label(settings, 'Apply to search', '套用到搜尋')");
    expect(styles).toContain('.authenticator-picker-popover { top: calc(100% + 6px); right: auto; left: 0; width: min(520px, calc(100vw - 48px)); padding: 12px; overflow: auto; }');
    expect(styles).toContain('.authenticator-picker-search { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto;');
    expect(styles).toContain('.authenticator-picker-search > .regex-builder { position: relative; top: auto; right: auto; grid-column: 1 / -1; width: 100%; max-height: min(560px, calc(100vh - 220px));');
    expect(source).toContain('moveAuthenticatorPickerFocus(event.key, activeIndex, visibleOptions.length)');
    expect(source).toContain('RegexBuilder query={query}');
    expect(source).toContain('setRegex({ pattern, flags })');
    expect(source).toContain('setQuery(event.target.value); if (regex) setRegex({ ...regex, pattern: event.target.value });');
    expect(source).toContain('Clear ${labelText.toLocaleLowerCase()} filter');
    expect(source).toContain('setTimeout(() => triggerRef.current?.focus(), 0)');
    expect(source).toContain('const toggleOpen = () => {\n    if (open) setBuilderOpen(false);');
    expect(source).toContain('onClick={toggleOpen}');
    expect(source).toContain('disabled={disabled}');
    expect(source).toContain('if (!disabled || !open) return;');
    expect(source).toContain('if (disabled) return;');
    expect(source).toContain('const choose = (option: PickerOption) => {\n    if (disabled) return;');
    expect(source).toContain('id="authenticator-source"');
    expect(source).toContain('id="authenticator-algorithm"');
    expect(source).toContain('id="authenticator-digits"');
    expect(source).toContain("options={[{ value: 'manual'");
    expect(source).toContain('options={ALGORITHMS.map');
    expect(source).toContain('options={DIGITS.map');
    expect(source).toContain("setSource(value as typeof source); setPreview(null); setSecret(''); setUri(''); setShowSecret(false);");
  });
});
