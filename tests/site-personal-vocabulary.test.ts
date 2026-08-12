import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { parsePersonalVocabularyJson, saveCachedVocabulary, loadCachedVocabulary, clearCachedVocabulary, personalizeOwnedText, PERSONAL_VOCABULARY_MAX_BYTES } from '../site/assets/personal-vocabulary.mjs';

const encode = (value: string) => new TextEncoder().encode(value);
const valid = { schemaVersion: 1, entries: [{ source: 'Install', replacement: '啟動' }] };
const storage = () => { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } }; };

describe('static site personal vocabulary', () => {
  it('accepts only the bounded neutral schema and rejects malformed payloads', () => {
    expect(parsePersonalVocabularyJson(encode(JSON.stringify(valid))).ok).toBe(true);
    expect(parsePersonalVocabularyJson(encode('{'))).toEqual({ ok: false, reason: 'malformed-json' });
    expect(parsePersonalVocabularyJson(encode('{"schemaVersion":2,"entries":[]}'))).toEqual({ ok: false, reason: 'unsupported-schema' });
    expect(parsePersonalVocabularyJson(encode('{"schemaVersion":1,"entries":[{"source":"x","replacement":"y"}],"entries":[]}'))).toEqual({ ok: false, reason: 'duplicate-key' });
    expect(parsePersonalVocabularyJson(encode('{"schemaVersion":1,"entries":[{"source":"x","replacement":"y","extra":true}]}'))).toEqual({ ok: false, reason: 'unknown-field' });
    expect(parsePersonalVocabularyJson(encode('{"schemaVersion":1,"entries":[{"source":"x","replacement":"\\u0000"}]}'))).toEqual({ ok: false, reason: 'invalid-shape' });
    expect(parsePersonalVocabularyJson(new Uint8Array(PERSONAL_VOCABULARY_MAX_BYTES + 1))).toEqual({ ok: false, reason: 'oversize' });
    expect(parsePersonalVocabularyJson(new Uint8Array([0xc3, 0x28]))).toEqual({ ok: false, reason: 'invalid-utf8' });
  });
  it('keeps validated state local, reloadable, replaceable, and clearable', () => {
    const local = storage();
    expect(loadCachedVocabulary(local).loaded).toBe(false);
    expect(saveCachedVocabulary(valid, local).loaded).toBe(true);
    expect(loadCachedVocabulary(local).entries).toEqual(valid.entries);
    expect(clearCachedVocabulary(local).loaded).toBe(false);
  });
  it('fails closed for corrupt cache and unavailable storage', () => {
    const local = storage();
    local.setItem('ding-ding-docs:personal-vocabulary', '{');
    expect(loadCachedVocabulary(local)).toMatchObject({ loaded: false, corrupt: true });
    const unavailable = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadCachedVocabulary(unavailable).loaded).toBe(false);
    expect(clearCachedVocabulary(unavailable).loaded).toBe(false);
  });
  it('replaces app-owned copy while preserving URLs, paths, identifiers, and code', () => {
    const entries = [{ source: 'Install', replacement: '啟動' }];
    expect(personalizeOwnedText('Install this feature', entries)).toBe('啟動 this feature');
    expect(personalizeOwnedText('Open https://example.test/Install', entries)).toBe('Open https://example.test/Install');
    expect(personalizeOwnedText('Open C:\\Program Files\\Install.exe', entries)).toBe('Open C:\\Program Files\\Install.exe');
    expect(personalizeOwnedText('Run `Install` then --Install', entries)).toBe('Run `Install` then --Install');
    expect(personalizeOwnedText('Install this feature', entries, true)).toBe('Install this feature');
  });
  it('wires the visible controls, module runtime, search, and palette into the site parity surface', async () => {
    const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../site/assets/app.js', import.meta.url), 'utf8');
    expect(html).toContain('id="personal-vocabulary-file"');
    expect(html).toContain('id="personal-vocabulary-replace"');
    expect(html).toContain('id="personal-vocabulary-clear"');
    expect(html).toContain('id="site-restricted"');
    expect(app).toContain("./personal-vocabulary.mjs");
    expect(app).toContain('personal-vocabulary-import');
    expect(app).toContain('setting-site-restricted');
    expect(app).toContain('data-settings-text');
  });
});
