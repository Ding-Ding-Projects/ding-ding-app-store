import { describe, expect, it } from 'vitest';
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
});
