import { AUTHENTICATOR_MAX_URI_LENGTH } from '../shared/contracts';

/**
 * Accept exactly one locally supplied otpauth URI from a clipboard/text field.
 * The main process remains the authority for URI parsing and secret handling;
 * this helper only bounds and normalizes the renderer-owned input.
 */
export function normalizeAuthenticatorImportText(value: string): string {
  if (typeof value !== 'string') throw new Error('The authenticator import text is invalid.');
  const normalized = value.replace(/^\uFEFF/, '').trim();
  if (!normalized || normalized.length > AUTHENTICATOR_MAX_URI_LENGTH) throw new Error('The authenticator import text is empty or too long.');
  if (/\s/.test(normalized) || /[\u0000-\u001f\u007f]/.test(normalized)) throw new Error('The authenticator import must contain one otpauth URI without whitespace.');
  if (!/^otpauth:\/\/totp\//i.test(normalized)) throw new Error('Only an otpauth://totp/ URI can be imported.');
  return normalized;
}
