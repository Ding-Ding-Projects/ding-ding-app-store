import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { decodeAuthenticatorQrBitmap, inspectAuthenticatorImageDimensions } from '../src/main/authenticator-qr-image.js';
import { AUTHENTICATOR_MAX_IMAGE_DIMENSION, AUTHENTICATOR_MAX_IMAGE_PIXELS } from '../src/shared/contracts.js';

const URI = 'otpauth://totp/Acme%3Aalice?secret=JBSWY3DPEHPK3PXP&issuer=Acme&algorithm=SHA1&digits=6&period=30';

function bitmapForQr(payload: string): { width: number; height: number; data: Uint8Array } {
  const matrix = QRCode.create(payload, { errorCorrectionLevel: 'M' }).modules;
  const quiet = 4;
  const scale = 8;
  const width = (matrix.size + quiet * 2) * scale;
  const data = new Uint8Array(width * width * 4);
  data.fill(255);
  for (let y = 0; y < matrix.size; y += 1) for (let x = 0; x < matrix.size; x += 1) if (matrix.data[y * matrix.size + x]) {
    for (let dy = 0; dy < scale; dy += 1) for (let dx = 0; dx < scale; dx += 1) {
      const offset = ((quiet * scale + y * scale + dy) * width + quiet * scale + x * scale + dx) * 4;
      // NativeImage.toBitmap() is BGRA, not RGBA.
      data[offset] = 0; data[offset + 1] = 0; data[offset + 2] = 0; data[offset + 3] = 255;
    }
  }
  return { width, height: width, data };
}

describe('local authenticator QR image import', () => {
  it('decodes a valid local QR bitmap and canonicalizes the URI', () => {
    const result = decodeAuthenticatorQrBitmap(bitmapForQr(URI));
    expect(result).toMatchObject({ ok: true, uri: URI });
    expect(Object.keys(result).sort()).toEqual(['message', 'messageYue', 'ok', 'uri']);
  });

  it('rejects blank images and malformed QR payloads without exposing decoded fields', () => {
    const blank = decodeAuthenticatorQrBitmap({ width: 32, height: 32, data: new Uint8Array(32 * 32 * 4).fill(255) });
    expect(blank).toMatchObject({ ok: false, reason: 'no-qr' });
    expect(blank).not.toHaveProperty('uri');
    const malformed = decodeAuthenticatorQrBitmap(bitmapForQr('not an otpauth URI'));
    expect(malformed).toMatchObject({ ok: false, reason: 'invalid-otpauth' });
    expect(JSON.stringify(malformed)).not.toContain('JBSWY3DPEHPK3PXP');
  });

  it('rejects oversized pixel buffers before attempting QR decoding', () => {
    const dimensions = inspectAuthenticatorImageDimensions(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0xff, 0xff, 0xff, 0xff, 0, 0, 0, 1]));
    expect(dimensions?.width).toBe(4_294_967_295);
    const result = decodeAuthenticatorQrBitmap({ width: AUTHENTICATOR_MAX_IMAGE_DIMENSION + 1, height: 1, data: new Uint8Array((AUTHENTICATOR_MAX_IMAGE_DIMENSION + 1) * 4) });
    expect(result).toMatchObject({ ok: false, reason: 'unsupported-image' });
    const pixels = decodeAuthenticatorQrBitmap({ width: 4_096, height: 4_096, data: new Uint8Array(AUTHENTICATOR_MAX_IMAGE_PIXELS * 4) });
    expect(pixels.ok).toBe(false);
  });

  it('keeps the decoder local and the sender/preload boundaries explicit', async () => {
    const main = await readFile(new URL('../src/main/main.ts', import.meta.url), 'utf8');
    const preload = await readFile(new URL('../src/preload/index.ts', import.meta.url), 'utf8');
    const page = await readFile(new URL('../src/renderer/pages/AuthenticatorPage.tsx', import.meta.url), 'utf8');
    expect(main).toContain("event.sender !== mainWindow?.webContents");
    expect(main).toContain("authenticator:qr-image-import");
    expect(main).toContain('qrImageImportInFlight');
    expect(main).toContain("authenticatorAllowed()");
    expect(main).toContain("const picked = await dialog.showOpenDialog");
    expect(main).toContain("const size = image.getSize()");
    expect(main).toContain("if (!(await authenticatorAllowed())) return { ok: false, reason: 'cancelled'");
    expect(main).toContain('nativeImage.createFromBuffer');
    expect(main).not.toContain('fetch(');
    expect(preload).toContain('parseAuthenticatorQrImageImport');
    expect(preload).toContain('importQrImage: async');
    expect(preload).toContain("!result.ok && (typeof result.reason !== 'string'");
    expect(page).toContain('Import otpauth URI from QR image file');
    expect(main).toContain('Authenticator QR image import is unavailable in School mode.');
  });
});
