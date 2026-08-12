import { describe, expect, it } from 'vitest';
import { parsePersonalVocabularyJson, PERSONAL_VOCABULARY_MAX_BYTES } from '../src/shared/personal-vocabulary';
import { personalizeText, setPersonalVocabulary } from '../src/renderer/i18n';
import { buildRegistry } from '../src/renderer/registry';
import { DEFAULT_SCHEDULE, DEFAULT_TAB_WORKSPACE, DEFAULT_USER_SETTINGS } from '../src/shared/contracts';
import { PersonalVocabularyService } from '../src/main/personal-vocabulary-service';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const encode = (value: string) => new TextEncoder().encode(value);
const valid = JSON.stringify({ schemaVersion: 1, entries: [{ source: 'Install', replacement: 'Install' }] });

describe('personal vocabulary parser', () => {
  it('accepts the bounded neutral schema without exposing private defaults', () => {
    const result = parsePersonalVocabularyJson(encode(valid));
    expect(result).toEqual({ ok: true, document: { schemaVersion: 1, entries: [{ source: 'Install', replacement: 'Install' }] } });
  });
  it('rejects malformed, unsupported, duplicate, unsafe, oversize, and invalid UTF-8 payloads', () => {
    expect(parsePersonalVocabularyJson(encode('{'))).toEqual({ ok: false, reason: 'malformed-json' });
    expect(parsePersonalVocabularyJson(encode('{"schemaVersion":2,"entries":[]}'))).toEqual({ ok: false, reason: 'unsupported-schema' });
    expect(parsePersonalVocabularyJson(encode('{"schemaVersion":1,"entries":[],"schemaVersion":1}'))).toEqual({ ok: false, reason: 'duplicate-key' });
    expect(parsePersonalVocabularyJson(encode('{"schemaVersion":1,"entries":[{"source":"x","replacement":"y"}],"__proto__":true}'))).toEqual({ ok: false, reason: 'unsafe-key' });
    expect(parsePersonalVocabularyJson(new Uint8Array(PERSONAL_VOCABULARY_MAX_BYTES + 1))).toEqual({ ok: false, reason: 'oversize' });
    expect(parsePersonalVocabularyJson(new Uint8Array([0xc3, 0x28]))).toEqual({ ok: false, reason: 'invalid-utf8' });
  });
  it('rejects unknown fields, empty entries, and excessive nesting', () => {
    expect(parsePersonalVocabularyJson(encode('{"schemaVersion":1,"entries":[],"unexpected":true}'))).toEqual({ ok: false, reason: 'invalid-shape' });
    expect(parsePersonalVocabularyJson(encode('{"schemaVersion":1,"entries":[{"source":"x","replacement":"y","extra":true}]}'))).toEqual({ ok: false, reason: 'invalid-shape' });
    expect(parsePersonalVocabularyJson(encode('{"schemaVersion":1,"entries":[{"source":"x","replacement":{"a":{"b":{"c":"d"}}}}]}'))).toEqual({ ok: false, reason: 'too-deep' });
  });
  it('keeps validated cache local, survives a reload, and clears it without retaining the source path', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ding-vocabulary-'));
    const source = path.join(directory, 'private-input.json');
    const cache = path.join(directory, 'cache.json');
    const service = new PersonalVocabularyService(cache);
    await writeFile(cache, valid, 'utf8');
    expect((await new PersonalVocabularyService(cache).status()).loaded).toBe(true);
    expect(await readFile(cache, 'utf8')).not.toContain(source);
    expect((await new PersonalVocabularyService(cache).clear()).loaded).toBe(false);
  });
  it('personalizes app-owned labels while preserving technical tokens and restricted mode', () => {
    setPersonalVocabulary([{ source: 'Install', replacement: '啟動' }, { source: 'foo', replacement: 'BAR' }]);
    expect(personalizeText('Install this app')).toBe('啟動 this app');
    expect(personalizeText('Open https://example.test/Install')).toBe('Open https://example.test/Install');
    expect(personalizeText('Open C:\\data\\Install.exe')).toBe('Open C:\\data\\Install.exe');
    expect(personalizeText('Open C:\\data\\foo.exe')).toBe('Open C:\\data\\foo.exe');
    expect(personalizeText('Open C:\\Program Files\\foo')).toBe('Open C:\\Program Files\\foo');
    expect(personalizeText('Open C:\\Program Files\\foo then Install')).toBe('Open C:\\Program Files\\foo then 啟動');
    expect(personalizeText('Open \\\\server\\share\\foo.exe')).toBe('Open \\\\server\\share\\foo.exe');
    expect(personalizeText('Open \\\\server\\share name\\foo')).toBe('Open \\\\server\\share name\\foo');
    expect(personalizeText('Run foo.exe then Install')).toBe('Run foo.exe then 啟動');
    setPersonalVocabulary([{ source: 'Install', replacement: '啟動' }], true);
    expect(personalizeText('Install this app')).toBe('Install this app');
    setPersonalVocabulary([]);
  });
  it('emits vocabulary palette commands in normal mode and suppresses them in School mode', () => {
    const context = { settings: DEFAULT_USER_SETTINGS, workspace: DEFAULT_TAB_WORKSPACE, appearance: {}, schedule: DEFAULT_SCHEDULE, apps: [] } as never;
    const normal = buildRegistry(context).filter((entry) => entry.id.includes('personal-vocabulary'));
    expect(normal.map((entry) => entry.id)).toEqual(['cmd:personal-vocabulary-import', 'cmd:personal-vocabulary-clear']);
    expect(buildRegistry({ ...context, schoolModeEnabled: true }).some((entry) => entry.id.includes('personal-vocabulary'))).toBe(false);
  });
});
