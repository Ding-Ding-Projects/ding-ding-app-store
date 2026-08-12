import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const size = 256;
const xorBytes = size * size * 4;
const andBytes = size * size / 8;
const pixelBytes = Buffer.alloc(xorBytes);
const setPixel = (x, y, r, g, b, a = 255) => {
  const offset = ((size - 1 - y) * size + x) * 4;
  pixelBytes[offset] = b;
  pixelBytes[offset + 1] = g;
  pixelBytes[offset + 2] = r;
  pixelBytes[offset + 3] = a;
};
const rounded = (x, y, left, top, right, bottom, radius) => {
  const cx = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cy = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;
  return (x < left + radius || x > right - radius) && (y < top + radius || y > bottom - radius)
    ? Math.hypot(x - cx, y - cy) <= radius
    : true;
};
for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    if (!rounded(x, y, 8, 8, 247, 247, 56)) continue;
    const t = (x + y) / (size * 2);
    setPixel(x, y, Math.round(21 * (1 - t) + 11 * t), Math.round(94 * (1 - t) + 61 * t), Math.round(239 * (1 - t) + 145 * t));
  }
}
const fill = (left, top, right, bottom, color) => { for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) setPixel(x, y, ...color); };
fill(61, 111, 194, 188, [255, 255, 255]);
for (let y = 77; y <= 110; y += 1) {
  const left = Math.round(70 + (y - 77) * 18 / 34);
  const right = Math.round(186 - (y - 77) * 18 / 34);
  fill(left, y, right, y, [185, 212, 255]);
}
for (let y = 62; y <= 112; y += 1) {
  const dy = y - 62;
  const half = Math.sqrt(Math.max(0, 30 * 30 - (dy - 39) * (dy - 39)));
  for (let x = Math.round(128 - half); x <= Math.round(128 + half); x += 1) setPixel(x, y, 255, 255, 255);
}
for (let x = 91; x <= 165; x += 1) for (let dy = -6; dy <= 6; dy += 1) setPixel(x, 113 + dy, 255, 255, 255);
fill(119, 126, 125, 164, [21, 94, 239]);
fill(131, 126, 137, 164, [21, 94, 239]);
for (let y = 46; y <= 60; y += 1) for (let x = 121; x <= 135; x += 1) setPixel(x, y, 255, 209, 102);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(0, 6); header.writeUInt8(0, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(40 + xorBytes + andBytes, 14); header.writeUInt32LE(22, 18);
const dib = Buffer.alloc(40);
dib.writeUInt32LE(40, 0); dib.writeInt32LE(size, 4); dib.writeInt32LE(size * 2, 8); dib.writeUInt16LE(1, 12); dib.writeUInt16LE(32, 14); dib.writeUInt32LE(0, 16); dib.writeUInt32LE(xorBytes, 20);
await mkdir(path.join(root, 'assets'), { recursive: true });
await writeFile(path.join(root, 'assets', 'ding-ding-app-store.ico'), Buffer.concat([header, dib, pixelBytes, Buffer.alloc(andBytes)]));
