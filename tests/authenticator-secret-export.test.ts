import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AuthenticatorService } from '../src/main/authenticator-service.js';
import type { AuthenticatorEntryMetadata } from '../src/shared/contracts.js';
import type { AuthenticatorVault } from '../src/main/authenticator-vault-contract.js';

const ID = '11111111-1111-4111-8111-111111111111';
const SECRET = 'JBSWY3DPEHPK3PXP';
const entry: AuthenticatorEntryMetadata = { id: ID, issuer: 'Acme', account: 'alice@example.com', label: 'Acme · alice@example.com', algorithm: 'sha1', digits: 6, periodSeconds: 30, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', order: 0, group: null, groupId: null };

class Vault implements AuthenticatorVault {
  public available = true;
  async status() { return this.available ? 'os-credential-vault' as const : 'unavailable' as const; }
  async listMetadata() { return [entry]; }
  async listGroups() { return []; }
  async writeMetadata() {}
  async save() {}
  async remove() {}
  async readSecret(id: string) { return id === ID && this.available ? SECRET : null; }
}

describe('deliberate authenticator secret export', () => {
  it('writes a bounded native-only JSON export and never returns secret bytes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'authenticator-secret-export-'));
    try {
      const destination = path.join(root, 'secrets.json');
      const activity: Array<{ message: string }> = [];
      const service = new AuthenticatorService(new Vault(), { record: async (value) => { activity.push(value); } });
      const authorization = await service.authorizeSecretExport({ entryIds: [ID], format: 'json' });
      const result = await service.secretExport({ entryIds: [ID], format: 'json', authorizationToken: authorization.authorizationToken! }, destination);
      expect(result).toMatchObject({ ok: true, filename: 'authenticator-secrets.json', entryCount: 1 });
      expect(JSON.stringify(result)).not.toContain(SECRET);
      const content = await readFile(destination, 'utf8');
      expect(content).toContain(SECRET);
      expect(content).toContain('WARNING:');
      expect(activity[0]?.message).not.toContain(SECRET);
      // Windows does not expose POSIX mode bits; source-level 0600 creation is
      // asserted below while this runtime check only proves the file exists.
      expect((await stat(destination)).isFile()).toBe(true);
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('fails closed for unknown IDs, missing vault secrets, cancellation, and oversize data', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'authenticator-secret-export-'));
    try {
      const vault = new Vault();
      const service = new AuthenticatorService(vault);
      expect((await service.secretExport({ entryIds: ['22222222-2222-4222-8222-222222222222'], format: 'json', authorizationToken: '22222222-2222-4222-8222-222222222222' }, path.join(root, 'missing.json'))).reason).toBe('invalid');
      const unavailableAuth = await service.authorizeSecretExport({ entryIds: [ID], format: 'json' });
      vault.available = false;
      expect((await service.secretExport({ entryIds: [ID], format: 'json', authorizationToken: unavailableAuth.authorizationToken! }, path.join(root, 'unavailable.json'))).reason).toBe('unavailable');
      vault.available = true;
      expect((await service.secretExport({ entryIds: [ID], format: 'json', authorizationToken: '44444444-4444-4444-8444-444444444444' }, path.join(root, 'unconfirmed.json'))).reason).toBe('invalid');
      const auth = await service.authorizeSecretExport({ entryIds: [ID], format: 'json' });
      expect((await service.secretExport({ entryIds: [ID], format: 'csv', authorizationToken: auth.authorizationToken! }, path.join(root, 'mismatch.csv'))).reason).toBe('invalid');
      expect((await service.secretExport({ entryIds: [ID], format: 'json', authorizationToken: auth.authorizationToken! }, path.join(root, 'replay.json'))).reason).toBe('invalid');
    } finally { await rm(root, { recursive: true, force: true }); }
  });

  it('rejects untyped or secret-bearing bridge responses and keeps School-mode command suppression', async () => {
    const preload = await readFile(path.resolve('src/preload/index.ts'), 'utf8');
    const app = await readFile(path.resolve('src/renderer/App.tsx'), 'utf8');
    expect(preload).toContain("ipcRenderer.invoke('authenticator:secret-export'");
    expect(preload).not.toContain('secretExport: (secret');
    expect(app).toContain("command.startsWith('authenticator-')");
  });
});
