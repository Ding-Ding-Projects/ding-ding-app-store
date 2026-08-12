import * as jsQrModule from 'jsqr';
import { canonicalAuthenticatorUri, parseAuthenticatorUri } from './authenticator-uri.js';
import {
  AUTHENTICATOR_MAX_IMAGE_DIMENSION,
  AUTHENTICATOR_MAX_IMAGE_PIXELS,
  AUTHENTICATOR_MAX_URI_LENGTH,
  type AuthenticatorQrImageImportReason,
  type AuthenticatorQrImageImportResult,
} from '../shared/contracts.js';

export interface AuthenticatorQrBitmap {
  width: number;
  height: number;
  /** Native Electron bitmaps are BGRA; this route accepts only bounded bytes. */
  data: Uint8Array;
}

export interface AuthenticatorImageDimensions {
  width: number;
  height: number;
}

function uint32Be(bytes: Uint8Array, offset: number): number {
  return (((bytes[offset] ?? 0) << 24) | ((bytes[offset + 1] ?? 0) << 16) | ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0)) >>> 0;
}

function uint16Be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

/** Inspect dimensions before nativeImage decodes compressed bytes. */
export function inspectAuthenticatorImageDimensions(bytes: Uint8Array): AuthenticatorImageDimensions | null {
  if (bytes.byteLength >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a && String.fromCharCode(bytes[12]!, bytes[13]!, bytes[14]!, bytes[15]!) === 'IHDR') {
    return { width: uint32Be(bytes, 16), height: uint32Be(bytes, 20) };
  }
  if (bytes.byteLength >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 3 < bytes.byteLength) {
      if (bytes[offset] !== 0xff) return null;
      while (offset < bytes.byteLength && bytes[offset] === 0xff) offset += 1;
      const marker = bytes[offset++];
      if (marker === undefined) return null;
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 1 >= bytes.byteLength) return null;
      const length = uint16Be(bytes, offset);
      if (length < 2 || offset + length > bytes.byteLength) return null;
      const isSof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isSof && length >= 7) return { width: uint16Be(bytes, offset + 5), height: uint16Be(bytes, offset + 3) };
      offset += length;
    }
  }
  if (bytes.byteLength >= 26 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
    const width = (bytes[18] ?? 0) | ((bytes[19] ?? 0) << 8) | ((bytes[20] ?? 0) << 16) | ((bytes[21] ?? 0) << 24);
    const rawHeight = (bytes[22] ?? 0) | ((bytes[23] ?? 0) << 8) | ((bytes[24] ?? 0) << 16) | ((bytes[25] ?? 0) << 24);
    return { width, height: Math.abs(rawHeight) };
  }
  return null;
}

const failure = (reason: AuthenticatorQrImageImportReason, message: string, messageYue: string): AuthenticatorQrImageImportResult => ({ ok: false, reason, message, messageYue });

/** Decode a bounded local bitmap and return only a canonical otpauth URI. */
export function decodeAuthenticatorQrBitmap(bitmap: AuthenticatorQrBitmap): AuthenticatorQrImageImportResult {
  const { width, height, data } = bitmap;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > AUTHENTICATOR_MAX_IMAGE_DIMENSION || height > AUTHENTICATOR_MAX_IMAGE_DIMENSION || width * height > AUTHENTICATOR_MAX_IMAGE_PIXELS) {
    return failure('unsupported-image', 'The selected image dimensions are outside the safe QR import limit.', '揀選嘅圖片尺寸超出安全 QR 匯入限制。');
  }
  if (!(data instanceof Uint8Array) || data.byteLength !== width * height * 4 || data.byteLength > AUTHENTICATOR_MAX_IMAGE_PIXELS * 4) {
    return failure('unsupported-image', 'The selected image pixels were not available in a supported bounded form.', '揀選嘅圖片像素唔係受支援嘅有限格式。');
  }
  const rgba = new Uint8ClampedArray(data.byteLength);
  for (let offset = 0; offset < data.byteLength; offset += 4) {
    // Electron nativeImage.toBitmap() is BGRA. jsQR consumes RGBA.
    rgba[offset] = data[offset + 2] ?? 0;
    rgba[offset + 1] = data[offset + 1] ?? 0;
    rgba[offset + 2] = data[offset] ?? 0;
    rgba[offset + 3] = data[offset + 3] ?? 255;
  }
  const jsQR = (jsQrModule as typeof jsQrModule & { default?: (data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }) => { data: string } | null }).default ?? (jsQrModule as unknown as (data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: 'dontInvert' | 'onlyInvert' | 'attemptBoth' | 'invertFirst' }) => { data: string } | null);
  let decoded: { data: string } | null;
  try {
    decoded = jsQR(rgba, width, height, { inversionAttempts: 'attemptBoth' });
  } catch {
    return failure('unsupported-image', 'The selected image could not be decoded locally.', '揀選嘅圖片未能喺本機解碼。');
  }
  if (!decoded?.data || decoded.data.length === 0 || decoded.data.length > AUTHENTICATOR_MAX_URI_LENGTH) return failure('no-qr', 'No QR code was found in the selected image.', '揀選嘅圖片搵唔到 QR code。');
  try {
    const parsed = parseAuthenticatorUri(decoded.data);
    return { ok: true, uri: canonicalAuthenticatorUri(parsed), message: 'The local QR image was decoded. Review the URI, then prepare pairing.', messageYue: '本機 QR 圖片已解碼。請檢查 URI，然後準備配對。' };
  } catch {
    return failure('invalid-otpauth', 'The QR code did not contain a valid otpauth://totp/ URI.', 'QR code 入面唔係有效嘅 otpauth://totp/ URI。');
  }
}
