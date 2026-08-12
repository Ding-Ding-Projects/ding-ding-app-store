import { describe, expect, it } from 'vitest';
import { createHistory7zUnavailable } from '../src/main/history-7z.js';
import { history7zOptionsSchema } from '../src/shared/contracts.js';
import { parseHistory7zExportResult } from '../src/preload/history-archive-parser.js';

const base = { method: 'LZMA2' as const, level: 'normal' as const, dictionaryBytes: 8 * 1024 * 1024, wordBytes: 64, solid: true, threads: 2, splitBytes: null, encryptContent: false, encryptHeaders: false };
const request = { entryIds: ['00000000-0000-4000-8000-000000000001'], options: base };

describe('bounded 7z archive boundary', () => {
  it('accepts the bounded option matrix and AES header dependency', () => {
    expect(history7zOptionsSchema.parse(base)).toEqual(base);
    expect(history7zOptionsSchema.parse({ ...base, encryptContent: true, encryptHeaders: true })).toMatchObject({ encryptHeaders: true });
  });
  it('rejects oversized work or headers without content encryption', () => {
    expect(() => history7zOptionsSchema.parse({ ...base, dictionaryBytes: 8 * 1024 * 1024 + 1 })).toThrow();
    expect(() => history7zOptionsSchema.parse({ ...base, splitBytes: 16 * 1024 * 1024 + 1 })).toThrow();
    expect(() => history7zOptionsSchema.parse({ ...base, encryptHeaders: true })).toThrow(/content encryption/i);
  });
  it('fails closed without an external executable and emits no secret', () => {
    const result = createHistory7zUnavailable(request);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('dependency-unavailable');
    expect(result.message).toMatch(/no approved in-process 7z dependency/i);
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('strictly parses the unavailable preload result', () => {
    expect(parseHistory7zExportResult(createHistory7zUnavailable(request))).toMatchObject({ ok: false, format: '7z' });
    expect(() => parseHistory7zExportResult({ ...createHistory7zUnavailable(request), extra: true })).toThrow();
  });
});
