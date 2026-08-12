import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { HistoryAccessService } from '../src/main/history-access-service.js';
import { parseHistoryAccessResult, parseHistoryAccessStatus } from '../src/preload/history-access-parser.js';

function fakeCrypto() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value: string) => Buffer.from(value, 'utf8'),
    decryptString: (value: Buffer) => value.toString('utf8'),
  };
}

describe('protected local-history access gate', () => {
  it('creates an OS-vault-backed verifier without writing the credential or exposing it in status', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ding-history-access-'));
    const service = new HistoryAccessService({ filePath: path.join(root, 'credential.dpapi'), ...fakeCrypto() });
    await expect(service.status()).resolves.toMatchObject({ available: true, configured: false, unlocked: false, reason: 'not-configured' });
    const created = await service.unlock({ credential: 'correct horse battery staple', create: true });
    expect(created).toMatchObject({ ok: true, status: { configured: true, unlocked: true, reason: 'ready' } });
    const bytes = await readFile(path.join(root, 'credential.dpapi'), 'utf8');
    expect(bytes).not.toContain('correct horse battery staple');
    expect(JSON.stringify(created)).not.toContain('correct horse battery staple');
  });

  it('rejects a wrong credential and exposes no verifier details', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ding-history-access-'));
    const options = { filePath: path.join(root, 'credential.dpapi'), ...fakeCrypto() };
    await new HistoryAccessService(options).unlock({ credential: 'right credential', create: true });
    const service = new HistoryAccessService(options);
    const result = await service.unlock({ credential: 'wrong credential' });
    expect(result.ok).toBe(false);
    expect(result.status).toMatchObject({ configured: true, unlocked: false, reason: 'locked' });
    expect(result.message).not.toMatch(/salt|verifier|credential material|right credential/i);
  });

  it('locks and invalidates an in-memory session', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ding-history-access-'));
    const service = new HistoryAccessService({ filePath: path.join(root, 'credential.dpapi'), ...fakeCrypto() });
    await service.unlock({ credential: 'session credential', create: true });
    expect(service.isUnlocked()).toBe(true);
    service.invalidate();
    expect(service.isUnlocked()).toBe(false);
    expect((await service.status()).reason).toBe('locked');
    expect(service.lock().message).toContain('locked again');
  });

  it('fails closed when the vault is unavailable', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ding-history-access-'));
    const service = new HistoryAccessService({ filePath: path.join(root, 'credential.dpapi'), ...fakeCrypto(), isEncryptionAvailable: () => false });
    expect(await service.status()).toMatchObject({ available: false, unlocked: false, reason: 'unavailable' });
    expect(await service.unlock({ credential: 'valid credential', create: true })).toMatchObject({ ok: false, status: { available: false, unlocked: false } });
  });

  it('invalidates malformed encrypted records instead of accepting them', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ding-history-access-'));
    const filePath = path.join(root, 'credential.dpapi');
    await writeFile(filePath, JSON.stringify({ schemaVersion: 1, salt: 'bad', verifier: 'bad' }), 'utf8');
    const service = new HistoryAccessService({ filePath, ...fakeCrypto() });
    expect(await service.status()).toMatchObject({ available: false, configured: false, unlocked: false, reason: 'unavailable' });
  });

  it('rejects non-canonical base64 even when Buffer could decode it', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ding-history-access-'));
    const filePath = path.join(root, 'credential.dpapi');
    const salt = Buffer.alloc(16).toString('base64');
    const verifier = Buffer.alloc(32).toString('base64');
    await writeFile(filePath, JSON.stringify({ schemaVersion: 1, salt: `${salt.slice(0, -2)}  `, verifier }), 'utf8');
    const service = new HistoryAccessService({ filePath, ...fakeCrypto() });
    expect(await service.status()).toMatchObject({ available: false, configured: false, unlocked: false, reason: 'unavailable' });
  });

  it('rejects malformed preload status/result payloads', () => {
    expect(() => parseHistoryAccessStatus({ available: true, configured: true, unlocked: true, reason: 'locked' })).toThrow();
    expect(() => parseHistoryAccessResult({ ok: true, status: { available: true, configured: true, unlocked: true, reason: 'ready' }, message: 'x'.repeat(2_001) })).toThrow();
    expect(parseHistoryAccessResult({ ok: true, status: { available: true, configured: true, unlocked: true, reason: 'ready' }, message: 'ok' })).toMatchObject({ ok: true });
  });

  it('serializes concurrent initial status and unlock loads', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ding-history-access-'));
    const options = { filePath: path.join(root, 'credential.dpapi'), ...fakeCrypto() };
    await new HistoryAccessService(options).unlock({ credential: 'concurrent credential', create: true });
    const service = new HistoryAccessService(options);
    const [status, unlock] = await Promise.all([service.status(), service.unlock({ credential: 'concurrent credential' })]);
    expect(status.configured).toBe(true);
    expect(unlock.ok).toBe(true);
  });
});
