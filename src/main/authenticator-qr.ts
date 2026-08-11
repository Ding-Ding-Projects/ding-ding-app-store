import QRCode from 'qrcode';
import type { AuthenticatorQrMatrix } from '../shared/contracts.js';

const MAX_QR_SIZE = 177;

/**
 * Build the QR module matrix in-process. The qrcode package only performs
 * local encoding; no URL, image host, or network transport is involved.
 */
export function createAuthenticatorQr(uri: string): AuthenticatorQrMatrix {
  if (typeof uri !== 'string' || uri.length === 0 || uri.length > 2_048) throw new Error('The authenticator QR payload is invalid.');
  const qr = QRCode.create(uri, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  if (!Number.isInteger(size) || size < 21 || size > MAX_QR_SIZE || qr.modules.data.length !== size * size) throw new Error('The authenticator QR matrix exceeded its bounds.');
  const modules: string[] = [];
  for (let row = 0; row < size; row += 1) {
    let line = '';
    for (let column = 0; column < size; column += 1) line += qr.modules.data[row * size + column] ? '1' : '0';
    modules.push(line);
  }
  return { schemaVersion: 1, size, modules, errorCorrectionLevel: 'M' };
}
