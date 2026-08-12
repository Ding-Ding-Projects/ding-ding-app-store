import jsQR from 'jsqr';
import { AUTHENTICATOR_CAMERA_MAX_DIMENSION, AUTHENTICATOR_CAMERA_MAX_PIXELS, AUTHENTICATOR_MAX_URI_LENGTH } from '../shared/contracts';

export type AuthenticatorCameraFailureReason = 'permission-denied' | 'no-camera' | 'timeout' | 'focus-required' | 'cancelled' | 'decode-failed';

/** Decode one bounded local RGBA frame. Nothing here has a network or IPC path. */
export function decodeAuthenticatorCameraFrame(data: Uint8ClampedArray, width: number, height: number): string | null {
  if (!(data instanceof Uint8ClampedArray) || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > AUTHENTICATOR_CAMERA_MAX_DIMENSION || height > AUTHENTICATOR_CAMERA_MAX_DIMENSION || width * height > AUTHENTICATOR_CAMERA_MAX_PIXELS || data.byteLength !== width * height * 4) return null;
  let decoded: { data: string } | null;
  try { decoded = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' }); } catch { return null; }
  const value = decoded?.data;
  if (!value || value.length > AUTHENTICATOR_MAX_URI_LENGTH || !/^otpauth:\/\/totp\//i.test(value)) return null;
  return value;
}

export function classifyAuthenticatorCameraError(error: unknown): 'permission-denied' | 'no-camera' {
  const name = error instanceof DOMException ? error.name : error && typeof error === 'object' && 'name' in error ? String((error as { name: unknown }).name) : '';
  return name === 'NotAllowedError' || name === 'SecurityError' ? 'permission-denied' : 'no-camera';
}
