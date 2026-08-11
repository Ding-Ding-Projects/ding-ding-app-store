import { describe, expect, it } from 'vitest';
import { AuthenticatorService } from '../src/main/authenticator-service.js';
import { decodeBase32Secret, generateTotp } from '../src/main/totp.js';
import { DEFAULT_TAB_WORKSPACE, TAB_IDS } from '../src/shared/contracts.js';
import { migrateWorkspaceDocument } from '../src/main/workspace-service.js';

function base32(value: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bytes = Buffer.from(value, 'utf8');
  let buffer = 0;
  let bits = 0;
  let output = '';
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) { bits -= 5; output += alphabet[(buffer >>> bits) & 31]; }
  }
  if (bits) output += alphabet[(buffer << (5 - bits)) & 31];
  return output;
}

const times = [59, 1_111_111_109, 1_111_111_111, 1_234_567_890, 2_000_000_000, 20_000_000_000];
const vectors = [
  { algorithm: 'sha1' as const, secret: '12345678901234567890', expected: ['94287082', '07081804', '14050471', '89005924', '69279037', '65353130'] },
  { algorithm: 'sha256' as const, secret: '12345678901234567890123456789012', expected: ['46119246', '68084774', '67062674', '91819424', '90698825', '77737706'] },
  { algorithm: 'sha512' as const, secret: '1234567890123456789012345678901234567890123456789012345678901234', expected: ['90693936', '25091201', '99943326', '93441116', '38618901', '47863826'] },
];

describe('RFC 6238 authenticator core', () => {
  it('matches every published SHA-1, SHA-256, and SHA-512 vector', () => {
    for (const vector of vectors) {
      for (const [index, seconds] of times.entries()) {
        expect(generateTotp({ secret: base32(vector.secret), algorithm: vector.algorithm, digits: 8, periodSeconds: 30, timestampMs: seconds * 1_000 }).code)
          .toBe(vector.expected[index]);
      }
    }
  });

  it('supports 6, 7, and 8 digits with a truthful countdown', () => {
    const secret = base32('12345678901234567890');
    for (const digits of [6, 7, 8] as const) {
      const result = generateTotp({ secret, algorithm: 'sha1', digits, periodSeconds: 30, timestampMs: 59_000 });
      expect(result.code).toMatch(new RegExp(`^\\d{${digits}}$`));
      expect(result.remainingSeconds).toBe(1);
      expect(result.expiresAtMs).toBe(60_000);
    }
  });

  it('rejects malformed, empty, overlong, and non-canonical Base32 input', () => {
    expect(() => decodeBase32Secret('')).toThrow();
    expect(() => decodeBase32Secret('A=======')).toThrow();
    expect(() => decodeBase32Secret('AB=C')).toThrow();
    expect(() => decodeBase32Secret('MZXW6YTB====')).toThrow();
    expect(() => decodeBase32Secret('MZXW6YTB!')).toThrow();
    expect(() => decodeBase32Secret('A'.repeat(257))).toThrow();
    expect(() => decodeBase32Secret('MZXW6YTB7')).toThrow();
  });
});

describe('bounded authenticator service', () => {
  it('reports the missing OS vault and keeps one-shot results secret-free', async () => {
    const service = new AuthenticatorService();
    const status = await service.status();
    expect(status).toMatchObject({ available: false, vault: 'unavailable', entryCount: 0 });
    const secret = base32('12345678901234567890');
    const result = await service.preview({ secret, algorithm: 'sha1', digits: 6, periodSeconds: 30, atMs: 59_000 }, { deterministicClock: true });
    expect(result).toMatchObject({ ok: true, code: '287082', storage: 'memory-only' });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain('TOTP');
  });

  it('does not leak parser detail or the submitted secret on invalid input', async () => {
    const secret = base32('secret value');
    const result = await new AuthenticatorService().preview({ secret, algorithm: 'sha1', digits: 6, periodSeconds: 0 });
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain(secret);
    expect(JSON.stringify(result)).not.toContain(secret);
  });
});

describe('workspace migration for the new destination tab', () => {
  it('adds Authenticator to a legacy six-tab document before schema validation', () => {
    const legacy = structuredClone(DEFAULT_TAB_WORKSPACE) as { tabs: unknown[] };
    legacy.tabs = legacy.tabs.filter((tab) => (tab as { id: string }).id !== 'authenticator');
    const migrated = migrateWorkspaceDocument(legacy) as { tabs: Array<{ id: string; order: number }> };
    expect(migrated.tabs.map((tab) => tab.id)).toEqual(TAB_IDS);
    expect(migrated.tabs.map((tab) => tab.order)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
