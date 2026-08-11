import { createHmac } from 'node:crypto';
import type { AuthenticatorAlgorithm, AuthenticatorDigits } from '../shared/contracts.js';
import { AUTHENTICATOR_ALGORITHMS, AUTHENTICATOR_DIGITS, AUTHENTICATOR_MAX_SECRET_LENGTH } from '../shared/contracts.js';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const MAX_DATE_MS = 8_640_000_000_000_000;
/** Leave one maximum period of room before Date#toISOString reaches its bound. */
export const MAX_TOTP_TIMESTAMP_MS = MAX_DATE_MS - 3_600_000;

export interface TotpInput {
  secret: string;
  algorithm: AuthenticatorAlgorithm;
  digits: AuthenticatorDigits;
  periodSeconds: number;
  timestampMs?: number;
}

export interface TotpResult {
  code: string;
  expiresAtMs: number;
  remainingSeconds: number;
}

function fail(message: string): never { throw new Error(message); }

/** Decode a bounded, user-entered Base32 secret without logging or retaining it. */
export function decodeBase32Secret(secret: string): Buffer {
  if (typeof secret !== 'string' || secret.length === 0 || secret.length > AUTHENTICATOR_MAX_SECRET_LENGTH) {
    return fail('The authenticator secret must be between 1 and 256 characters.');
  }
  const compact = secret.replace(/[\s-]/g, '').toUpperCase();
  if (compact.length === 0 || compact.length > AUTHENTICATOR_MAX_SECRET_LENGTH || !/^[A-Z2-7]+=*$/.test(compact)) {
    return fail('The authenticator secret must use Base32 characters A–Z and 2–7.');
  }
  const unpadded = compact.replace(/=+$/, '');
  const requiredPadding = ({ 0: 0, 2: 6, 4: 4, 5: 3, 7: 1 } as Record<number, number>)[unpadded.length % 8];
  const paddingLength = compact.length - unpadded.length;
  if (requiredPadding === undefined || (paddingLength !== 0 && paddingLength !== requiredPadding)) return fail('The Base32 secret has invalid padding.');
  let buffer = 0;
  let bits = 0;
  const output: number[] = [];
  for (const character of unpadded) {
    const value = BASE32_ALPHABET.indexOf(character);
    if (value < 0) return fail('The authenticator secret contains an invalid Base32 character.');
    buffer = (buffer << 5) | value;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      output.push((buffer >>> bits) & 0xff);
    }
  }
  // Non-zero discarded bits indicate a typo rather than a canonical secret.
  if (bits > 0 && (buffer & ((1 << bits) - 1)) !== 0) return fail('The Base32 secret has non-zero trailing bits.');
  if (!output.length) return fail('The authenticator secret cannot be empty.');
  return Buffer.from(output);
}

function validateInput(input: TotpInput): Required<TotpInput> {
  if (!AUTHENTICATOR_ALGORITHMS.includes(input.algorithm)) return fail('The authenticator algorithm is unsupported.');
  if (!AUTHENTICATOR_DIGITS.includes(input.digits)) return fail('The authenticator digit count is unsupported.');
  if (!Number.isInteger(input.periodSeconds) || input.periodSeconds < 1 || input.periodSeconds > 3_600) return fail('The authenticator period must be a whole number from 1 to 3600 seconds.');
  const timestampMs = input.timestampMs ?? Date.now();
  if (!Number.isFinite(timestampMs) || timestampMs < 0 || timestampMs > MAX_TOTP_TIMESTAMP_MS) return fail('The authenticator timestamp is outside the supported range.');
  return { ...input, timestampMs };
}

/** RFC 6238 HOTP/TOTP calculation with an injectable clock for deterministic tests. */
export function generateTotp(input: TotpInput): TotpResult {
  const validated = validateInput(input);
  const key = decodeBase32Secret(validated.secret);
  const periodMs = validated.periodSeconds * 1_000;
  const counter = BigInt(Math.floor(validated.timestampMs / periodMs));
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac(validated.algorithm, key).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  const modulus = 10 ** validated.digits;
  const code = String(binary % modulus).padStart(validated.digits, '0');
  const expiresAtMs = (Number(counter) + 1) * periodMs;
  const remainingSeconds = Math.max(0, Math.ceil((expiresAtMs - validated.timestampMs) / 1_000));
  return { code, expiresAtMs, remainingSeconds };
}
