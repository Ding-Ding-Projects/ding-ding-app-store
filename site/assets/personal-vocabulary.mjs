// Local-only site personal vocabulary. This module deliberately has no network,
// filesystem, or provider-content responsibilities.
export const PERSONAL_VOCABULARY_SCHEMA_VERSION = 1;
export const PERSONAL_VOCABULARY_MAX_BYTES = 64_000;
export const PERSONAL_VOCABULARY_MAX_ENTRIES = 256;
export const PERSONAL_VOCABULARY_MAX_KEY_LENGTH = 128;
export const PERSONAL_VOCABULARY_MAX_VALUE_LENGTH = 256;
export const PERSONAL_VOCABULARY_MAX_DEPTH = 3;
export const PERSONAL_VOCABULARY_STORAGE_KEY = 'ding-ding-docs:personal-vocabulary';

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const EMPTY = Object.freeze({ schemaVersion: PERSONAL_VOCABULARY_SCHEMA_VERSION, entries: [] });

function duplicateKey(source) {
  const stack = [];
  let index = 0;
  const whitespace = (at) => { while (at < source.length && /\s/.test(source[at])) at += 1; return at; };
  while (index < source.length) {
    index = whitespace(index);
    const character = source[index];
    if (!character) break;
    if (character === '"') {
      const start = index++;
      let escaped = false;
      while (index < source.length) {
        const current = source[index++];
        if (escaped) { escaped = false; continue; }
        if (current === '\\') { escaped = true; continue; }
        if (current === '"') break;
      }
      const frame = stack[stack.length - 1];
      if (frame?.object && frame.expectingKey) {
        let key;
        try { key = JSON.parse(source.slice(start, index)); } catch { return null; }
        if (frame.keys.has(key)) return key;
        frame.keys.add(key); frame.expectingKey = false;
      }
      continue;
    }
    if (character === '{') { stack.push({ object: true, keys: new Set(), expectingKey: true }); index += 1; continue; }
    if (character === '[') { stack.push({ object: false, keys: new Set(), expectingKey: false }); index += 1; continue; }
    if (character === ',') { if (stack.at(-1)?.object) stack.at(-1).expectingKey = true; index += 1; continue; }
    if (character === '}' || character === ']') { stack.pop(); index += 1; continue; }
    index += 1;
  }
  return null;
}

function unsafeOrDeep(value) {
  const pending = [{ value, depth: 0 }];
  while (pending.length) {
    const current = pending.pop();
    if (current.depth > PERSONAL_VOCABULARY_MAX_DEPTH) return 'too-deep';
    if (!current.value || typeof current.value !== 'object') continue;
    for (const [key, child] of Object.entries(current.value)) {
      if (UNSAFE_KEYS.has(key)) return 'unsafe-key';
      pending.push({ value: child, depth: current.depth + 1 });
    }
  }
  return null;
}

function validString(value, max) { return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/u.test(value); }

export function parsePersonalVocabularyJson(input) {
  const bytes = input instanceof Uint8Array ? input : new TextEncoder().encode(String(input));
  if (bytes.byteLength > PERSONAL_VOCABULARY_MAX_BYTES) return { ok: false, reason: 'oversize' };
  let source;
  try { source = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return { ok: false, reason: 'invalid-utf8' }; }
  let value;
  try { value = JSON.parse(source); } catch { return { ok: false, reason: 'malformed-json' }; }
  if (duplicateKey(source)) return { ok: false, reason: 'duplicate-key' };
  const unsafe = unsafeOrDeep(value);
  if (unsafe) return { ok: false, reason: unsafe };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, reason: 'invalid-shape' };
  const rootKeys = Object.keys(value);
  if (rootKeys.some((key) => !['schemaVersion', 'entries'].includes(key))) return { ok: false, reason: 'unknown-field' };
  if (value.schemaVersion !== PERSONAL_VOCABULARY_SCHEMA_VERSION) return { ok: false, reason: 'unsupported-schema' };
  if (!Array.isArray(value.entries) || value.entries.length < 1 || value.entries.length > PERSONAL_VOCABULARY_MAX_ENTRIES) return { ok: false, reason: 'invalid-shape' };
  const entries = [];
  for (const entry of value.entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return { ok: false, reason: 'invalid-shape' };
    if (Object.keys(entry).some((key) => !['source', 'replacement'].includes(key))) return { ok: false, reason: 'unknown-field' };
    if (!validString(entry.source, PERSONAL_VOCABULARY_MAX_KEY_LENGTH) || !validString(entry.replacement, PERSONAL_VOCABULARY_MAX_VALUE_LENGTH)) return { ok: false, reason: 'invalid-shape' };
    entries.push({ source: entry.source, replacement: entry.replacement });
  }
  return { ok: true, document: { schemaVersion: PERSONAL_VOCABULARY_SCHEMA_VERSION, entries } };
}

export function serializePersonalVocabulary(document) {
  if (!document || typeof document !== 'object' || !Array.isArray(document.entries)) throw new TypeError('A validated vocabulary document is required.');
  const parsed = parsePersonalVocabularyJson(JSON.stringify(document));
  if (!parsed.ok) throw new TypeError(`A validated vocabulary document is required: ${parsed.reason}.`);
  return JSON.stringify(parsed.document);
}

export function loadCachedVocabulary(storage) {
  try {
    storage ??= globalThis.localStorage;
    const raw = storage?.getItem(PERSONAL_VOCABULARY_STORAGE_KEY);
    if (!raw) return { loaded: false, entries: [], corrupt: false };
    const parsed = parsePersonalVocabularyJson(raw);
    return parsed.ok ? { loaded: true, entries: parsed.document.entries, corrupt: false } : { loaded: false, entries: [], corrupt: true, reason: parsed.reason };
  } catch { return { loaded: false, entries: [], corrupt: true, reason: 'cache-unavailable' }; }
}

export function saveCachedVocabulary(document, storage) {
  try {
    storage ??= globalThis.localStorage;
    const serialized = serializePersonalVocabulary(document);
    storage.setItem(PERSONAL_VOCABULARY_STORAGE_KEY, serialized);
    return loadCachedVocabulary(storage);
  } catch (error) { throw error instanceof TypeError ? error : new Error('cache-unavailable'); }
}

export function clearCachedVocabulary(storage) {
  try { (storage ??= globalThis.localStorage).removeItem(PERSONAL_VOCABULARY_STORAGE_KEY); return { loaded: false, entries: [], corrupt: false }; }
  catch { return { loaded: false, entries: [], corrupt: true, reason: 'cache-unavailable' }; }
}

const TECHNICAL_SEGMENT = /(?:https?:\/\/[^\s]+|(?:[A-Za-z]:\\|\\\\)[^\n<>()]+|(?:[A-Za-z_][\w-]*\/)+[\w.-]+|--[\w-]+|#[0-9a-f]{7,64}\b|\b[\w-]+\.[\w.-]+\b|\b(?:sha256|SHA-256|JSON|URI|IPC|TOTP|Electron|Windows)\b|`[^`]*`)/giu;
export function personalizeOwnedText(value, entries, restricted = false) {
  if (restricted || !value || !entries?.length) return value;
  const source = String(value);
  let output = '';
  let cursor = 0;
  for (const match of source.matchAll(TECHNICAL_SEGMENT)) {
    const start = match.index ?? 0;
    let segment = source.slice(cursor, start);
    segment = entries.reduce((current, entry) => current.split(entry.source).join(entry.replacement), segment);
    output += segment + match[0];
    cursor = start + match[0].length;
  }
  return output + entries.reduce((current, entry) => current.split(entry.source).join(entry.replacement), source.slice(cursor));
}

export const EMPTY_PERSONAL_VOCABULARY = EMPTY;
