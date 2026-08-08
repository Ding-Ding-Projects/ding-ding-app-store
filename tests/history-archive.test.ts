import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractZipSafe } from '../src/main/safe-zip.js';
import { createHistoryArchive } from '../src/main/history-archive.js';
import type { HistoryEntry } from '../src/shared/contracts.js';

const entry = (overrides: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: 'f6a5dd12-70f1-4f4a-9f1b-1d9c8a7d6e5c',
  appId: 'sample-app',
  displayName: 'Sample App',
  kind: 'install',
  ok: true,
  message: 'Installed successfully, with commas, tabs\t, and Unicode 蝦餃.',
  occurredAt: '2026-08-08T16:00:00.000Z',
  ...overrides,
});

describe('re-importable activity ZIP archive', () => {
  it('contains fixed relative members, a manifest, UTF-8/LF metadata, and complete JSONL records', async () => {
    const archive = await createHistoryArchive([entry()]);
    expect(archive.filename).toBe('ding-ding-app-store-history.zip');
    expect(archive.mime).toBe('application/zip');
    expect(archive.encoding).toBe('UTF-8');
    expect(archive.lineEndings).toBe('LF');
    expect(archive.schema).toBe('ding-ding-app-store.history-archive.v1');
    expect(archive.recordCount).toBe(1);

    const root = await mkdtemp(path.join(os.tmpdir(), 'ding-ding-history-archive-'));
    const zipPath = path.join(root, 'history.zip');
    const destination = path.join(root, 'expanded');
    try {
      await writeFile(zipPath, Buffer.from(archive.base64, 'base64'));
      await extractZipSafe(zipPath, destination);
      const members = ['README.txt', 'history.json', 'history.jsonl', 'manifest.json'];
      const manifest = JSON.parse(await readFile(path.join(destination, 'manifest.json'), 'utf8')) as {
        schema: string; encoding: string; lineEndings: string; recordCount: number;
        reimport: { format: string; path: string; oneObjectPerLine: boolean };
        files: Array<{ path: string; bytes: number; sha256: string }>;
      };
      expect(manifest.schema).toBe('ding-ding-app-store.history-archive.v1');
      expect(manifest.encoding).toBe('UTF-8');
      expect(manifest.lineEndings).toBe('LF');
      expect(manifest.recordCount).toBe(1);
      expect(manifest.reimport).toEqual({ format: 'jsonl', path: 'history.jsonl', oneObjectPerLine: true });
      expect(manifest.files.map((file) => file.path)).toEqual(['history.jsonl', 'history.json', 'README.txt']);
      for (const member of members) {
        const text = await readFile(path.join(destination, member), 'utf8');
        expect(text).not.toContain('\r');
      }
      const jsonl = await readFile(path.join(destination, 'history.jsonl'), 'utf8');
      expect(JSON.parse(jsonl)).toEqual(entry());
      const json = JSON.parse(await readFile(path.join(destination, 'history.json'), 'utf8')) as HistoryEntry[];
      expect(json).toEqual([entry()]);
      for (const file of manifest.files) {
        const bytes = await readFile(path.join(destination, file.path));
        expect(bytes.byteLength).toBe(file.bytes);
        expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects malformed, duplicate, and empty record sets before writing', async () => {
    await expect(createHistoryArchive([])).rejects.toThrow(/1-10,000/);
    await expect(createHistoryArchive([entry({ id: 'not-a-uuid' })])).rejects.toThrow(/invalid|oversized/i);
    await expect(createHistoryArchive([entry(), entry()])).rejects.toThrow(/duplicate/i);
  });

  it('preserves meaningful leading and trailing whitespace in complete fields', async () => {
    const archive = await createHistoryArchive([entry({ appId: ' app-with-space ', displayName: ' Display name ' })]);
    const root = await mkdtemp(path.join(os.tmpdir(), 'ding-ding-history-archive-space-'));
    try {
      const zipPath = path.join(root, 'history.zip');
      const destination = path.join(root, 'expanded');
      await writeFile(zipPath, Buffer.from(archive.base64, 'base64'));
      await extractZipSafe(zipPath, destination);
      expect(JSON.parse(await readFile(path.join(destination, 'history.jsonl'), 'utf8'))).toEqual(entry({ appId: ' app-with-space ', displayName: ' Display name ' }));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
