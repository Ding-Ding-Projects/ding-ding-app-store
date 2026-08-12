import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { normalizeAuthenticatorImportText } from '../src/renderer/authenticator-import';

describe('local authenticator clipboard import', () => {
  const valid = 'otpauth://totp/Acme:alice?secret=JBSWY3DPEHPK3PXP';

  it('trims one BOM and surrounding whitespace without changing the URI payload', () => {
    expect(normalizeAuthenticatorImportText(`\uFEFF  ${valid}  `)).toBe(valid);
  });

  it('rejects blank, multiline, oversized, non-totp, and control-character clipboard data', () => {
    for (const value of ['', '   ', `${valid}\nsecond`, `otpauth://hotp/Acme:alice?secret=JBSWY3DPEHPK3PXP`, `${valid}\u0000`]) {
      expect(() => normalizeAuthenticatorImportText(value)).toThrow();
    }
    expect(() => normalizeAuthenticatorImportText(`otpauth://totp/${'a'.repeat(2_049)}`)).toThrow();
  });

  it('does not interpret arbitrary text as a URI or perform any network operation', () => {
    expect(() => normalizeAuthenticatorImportText('https://example.com/otpauth')).toThrow(/otpauth/);
  });

  it('keeps the privileged clipboard route narrow and fail-closed', async () => {
    const main = readFileSync(path.join(process.cwd(), 'src/main/main.ts'), 'utf8');
    const preload = readFileSync(path.join(process.cwd(), 'src/preload/index.ts'), 'utf8');
    const source = `${main} ${preload}`;
    expect(source).toContain('authenticator:clipboard-prepare');
    expect(source).toContain('event.sender !== mainWindow?.webContents');
    expect(source).toContain('AUTHENTICATOR_MAX_URI_LENGTH');
    expect(source).not.toContain('authenticator:clipboard-read');
    expect(source).not.toContain('readClipboardText');
  });
});
