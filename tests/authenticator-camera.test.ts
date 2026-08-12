import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import QRCode from 'qrcode';
import { classifyAuthenticatorCameraError, decodeAuthenticatorCameraFrame } from '../src/renderer/authenticator-camera';

const URI = 'otpauth://totp/Acme%3Aalice?secret=JBSWY3DPEHPK3PXP&issuer=Acme&algorithm=SHA1&digits=6&period=30';

function rgbaQr(payload: string): { width: number; data: Uint8ClampedArray } {
  const matrix = QRCode.create(payload, { errorCorrectionLevel: 'M' }).modules;
  const quiet = 4; const scale = 8; const width = (matrix.size + quiet * 2) * scale;
  const data = new Uint8ClampedArray(width * width * 4); data.fill(255);
  for (let y = 0; y < matrix.size; y += 1) for (let x = 0; x < matrix.size; x += 1) if (matrix.data[y * matrix.size + x]) for (let dy = 0; dy < scale; dy += 1) for (let dx = 0; dx < scale; dx += 1) {
    const offset = ((quiet * scale + y * scale + dy) * width + quiet * scale + x * scale + dx) * 4;
    data[offset] = 0; data[offset + 1] = 0; data[offset + 2] = 0; data[offset + 3] = 255;
  }
  return { width, data };
}

describe('bounded local authenticator camera scanning', () => {
  it('decodes a valid RGBA QR frame locally and rejects invalid or oversized frames', () => {
    const qr = rgbaQr(URI);
    expect(decodeAuthenticatorCameraFrame(qr.data, qr.width, qr.width)).toBe(URI);
    const nonAuthenticator = rgbaQr('https://example.com');
    expect(decodeAuthenticatorCameraFrame(nonAuthenticator.data, nonAuthenticator.width, nonAuthenticator.width)).toBeNull();
    expect(decodeAuthenticatorCameraFrame(new Uint8ClampedArray(4), 2048, 1)).toBeNull();
  });

  it('classifies permission denial separately from missing camera failures', () => {
    expect(classifyAuthenticatorCameraError({ name: 'NotAllowedError' })).toBe('permission-denied');
    expect(classifyAuthenticatorCameraError({ name: 'NotFoundError' })).toBe('no-camera');
  });

  it('keeps frames and decoded secrets out of the main/preload bridge', async () => {
    const main = await readFile(new URL('../src/main/main.ts', import.meta.url), 'utf8');
    const preload = await readFile(new URL('../src/preload/index.ts', import.meta.url), 'utf8');
    const page = await readFile(new URL('../src/renderer/pages/AuthenticatorPage.tsx', import.meta.url), 'utf8');
    expect(main).toContain("ipcMain.handle('authenticator:camera-start'");
    expect(main).toContain("ipcMain.handle('authenticator:camera-stop'");
    expect(main).toContain("type === 'video'");
    expect(main).toContain('details.isMainFrame');
    expect(main).toContain("expectedUrl?.startsWith('file://')");
    expect(main).toContain('requestUrl !== expectedUrl');
    expect(main).toContain('AUTHENTICATOR_CAMERA_SESSION_MS');
    expect(main).toContain('authenticatorCameraLease = null');
    expect(preload).toContain('parseAuthenticatorCameraSessionStart');
    expect(preload).not.toMatch(/camera-(?:start|stop)[\s\S]{0,400}(?:frame|pixels|secret|uri)/i);
    expect(page).toContain('navigator.mediaDevices.getUserMedia');
    expect(page).toContain('decodeAuthenticatorCameraFrame');
    expect(page).toContain("audio: false");
    expect(page).toContain("getTracks().forEach((track) => track.stop())");
    expect(page).toContain("document.visibilityState !== 'visible'");
    expect(page).toContain('generation !== cameraGenerationRef.current');
    expect(page).toContain('stream.getTracks().forEach((track) => track.stop())');
    expect(page).toContain('cameraTriggerRef.current?.focus()');
  });
});
