import {
  AUTHENTICATOR_ALGORITHMS,
  AUTHENTICATOR_DIGITS,
  AUTHENTICATOR_MAX_ACCOUNT_LENGTH,
  AUTHENTICATOR_MAX_ISSUER_LENGTH,
  AUTHENTICATOR_MAX_URI_LENGTH,
  type AuthenticatorAlgorithm,
  type AuthenticatorDigits,
} from '../shared/contracts.js';
import { normalizeBase32Secret } from './totp.js';

export interface ParsedAuthenticatorUri {
  issuer: string;
  account: string;
  secret: string;
  algorithm: AuthenticatorAlgorithm;
  digits: AuthenticatorDigits;
  periodSeconds: number;
}

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ALGORITHM_BY_QUERY: Readonly<Record<string, AuthenticatorAlgorithm>> = {
  SHA1: 'sha1',
  SHA256: 'sha256',
  SHA512: 'sha512',
};

function invalid(message: string): never {
  throw new Error(message);
}

function boundedText(value: string, max: number, field: string): string {
  if (!value || value.length > max || CONTROL_CHARACTERS.test(value)) invalid(`The authenticator ${field} is invalid.`);
  return value;
}

function decodeComponent(value: string, field: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    invalid(`The authenticator ${field} encoding is invalid.`);
  }
}

function readQuery(rawQuery: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!rawQuery) return result;
  for (const pair of rawQuery.split('&')) {
    if (!pair) invalid('The authenticator URI contains an empty query parameter.');
    const separator = pair.indexOf('=');
    if (separator <= 0) invalid('The authenticator URI contains a malformed query parameter.');
    const key = decodeComponent(pair.slice(0, separator), 'query parameter');
    const value = decodeComponent(pair.slice(separator + 1), `query parameter ${key}`);
    if (!/^(secret|issuer|algorithm|digits|period)$/.test(key)) invalid('The authenticator URI contains an unsupported query parameter.');
    if (result.has(key)) invalid(`The authenticator URI repeats the ${key} parameter.`);
    result.set(key, value);
  }
  return result;
}

function readDigits(value: string | undefined): AuthenticatorDigits {
  if (value === undefined) return 6;
  if (!/^\d+$/.test(value)) invalid('The authenticator digit count is invalid.');
  const digits = Number(value);
  if (!AUTHENTICATOR_DIGITS.includes(digits as AuthenticatorDigits)) invalid('The authenticator digit count is unsupported.');
  return digits as AuthenticatorDigits;
}

function readPeriod(value: string | undefined): number {
  if (value === undefined) return 30;
  if (!/^\d+$/.test(value)) invalid('The authenticator period is invalid.');
  const period = Number(value);
  if (!Number.isSafeInteger(period) || period < 1 || period > 3_600) invalid('The authenticator period must be from 1 to 3600 seconds.');
  return period;
}

/** Parse a bounded, canonical `otpauth://totp/` URI without returning it to the renderer. */
export function parseAuthenticatorUri(input: string): ParsedAuthenticatorUri {
  if (typeof input !== 'string' || input.length === 0 || input.length > AUTHENTICATOR_MAX_URI_LENGTH) invalid('The authenticator URI is invalid.');
  let uri: URL;
  try { uri = new URL(input); } catch { invalid('The authenticator URI is invalid.'); }
  if (uri.protocol !== 'otpauth:' || uri.hostname !== 'totp' || uri.username || uri.password || uri.port || uri.hash) invalid('Only an otpauth://totp/ URI without credentials or fragments is accepted.');
  if (!uri.pathname.startsWith('/') || uri.pathname.length <= 1 || uri.pathname.includes('//')) invalid('The authenticator URI label is invalid.');

  const label = decodeComponent(uri.pathname.slice(1), 'label');
  boundedText(label, AUTHENTICATOR_MAX_ISSUER_LENGTH + AUTHENTICATOR_MAX_ACCOUNT_LENGTH + 1, 'label');
  const split = label.indexOf(':');
  const issuerFromLabel = split >= 0 ? label.slice(0, split) : '';
  const account = boundedText(split >= 0 ? label.slice(split + 1) : label, AUTHENTICATOR_MAX_ACCOUNT_LENGTH, 'account');
  if (split >= 0) boundedText(issuerFromLabel, AUTHENTICATOR_MAX_ISSUER_LENGTH, 'issuer');

  const query = readQuery(uri.search.slice(1));
  const secret = query.get('secret');
  if (!secret) invalid('The authenticator URI does not contain a secret.');
  const normalizedSecret = normalizeBase32Secret(secret);
  const issuerFromQuery = query.get('issuer');
  if (issuerFromQuery !== undefined) boundedText(issuerFromQuery, AUTHENTICATOR_MAX_ISSUER_LENGTH, 'issuer');
  if (issuerFromLabel && issuerFromQuery !== undefined && issuerFromLabel !== issuerFromQuery) invalid('The authenticator URI issuer label and issuer parameter do not match.');
  const issuer = issuerFromQuery ?? issuerFromLabel;

  const algorithmQuery = query.get('algorithm');
  const algorithm = algorithmQuery === undefined ? 'sha1' : ALGORITHM_BY_QUERY[algorithmQuery.toUpperCase()];
  if (!algorithm || !AUTHENTICATOR_ALGORITHMS.includes(algorithm)) invalid('The authenticator algorithm is unsupported.');
  return {
    issuer,
    account,
    secret: normalizedSecret,
    algorithm,
    digits: readDigits(query.get('digits') ?? undefined),
    periodSeconds: readPeriod(query.get('period') ?? undefined),
  };
}

export function canonicalAuthenticatorUri(input: ParsedAuthenticatorUri): string {
  const label = encodeURIComponent(input.issuer ? `${input.issuer}:${input.account}` : input.account);
  const params = [
    `secret=${encodeURIComponent(input.secret)}`,
    ...(input.issuer ? [`issuer=${encodeURIComponent(input.issuer)}`] : []),
    `algorithm=${input.algorithm.toUpperCase()}`,
    `digits=${input.digits}`,
    `period=${input.periodSeconds}`,
  ];
  return `otpauth://totp/${label}?${params.join('&')}`;
}
