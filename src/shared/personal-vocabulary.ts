import { z } from 'zod';

export const PERSONAL_VOCABULARY_SCHEMA_VERSION = 1 as const;
export const PERSONAL_VOCABULARY_MAX_BYTES = 64_000;
export const PERSONAL_VOCABULARY_MAX_ENTRIES = 256;
export const PERSONAL_VOCABULARY_MAX_KEY_LENGTH = 128;
export const PERSONAL_VOCABULARY_MAX_VALUE_LENGTH = 256;
export const PERSONAL_VOCABULARY_MAX_DEPTH = 3;

const UNSAFE_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const textSchema = z.string().min(1).max(PERSONAL_VOCABULARY_MAX_KEY_LENGTH);
const entrySchema = z.strictObject({
  source: textSchema,
  replacement: z.string().min(1).max(PERSONAL_VOCABULARY_MAX_VALUE_LENGTH),
});
const documentSchema = z.strictObject({
  schemaVersion: z.literal(PERSONAL_VOCABULARY_SCHEMA_VERSION),
  entries: z.array(entrySchema).min(1).max(PERSONAL_VOCABULARY_MAX_ENTRIES),
});

export type PersonalVocabularyEntry = z.infer<typeof entrySchema>;
export type PersonalVocabularyDocument = z.infer<typeof documentSchema>;
export type PersonalVocabularyParseFailure =
  | 'oversize'
  | 'invalid-utf8'
  | 'malformed-json'
  | 'duplicate-key'
  | 'unsupported-schema'
  | 'unsafe-key'
  | 'invalid-shape'
  | 'too-deep';

export type PersonalVocabularyParseResult = {
  ok: true;
  document: PersonalVocabularyDocument;
} | {
  ok: false;
  reason: PersonalVocabularyParseFailure;
};

function duplicateJsonKey(source: string): string | null {
  type Frame = { type: 'object' | 'array'; keys: Set<string>; expectsKey: boolean };
  const stack: Frame[] = [];
  const skipWhitespace = (from: number) => {
    let at = from;
    while (at < source.length && /\s/.test(source[at] ?? '')) at += 1;
    return at;
  };
  let index = 0;
  while (index < source.length) {
    index = skipWhitespace(index);
    const character = source[index];
    if (!character) break;
    if (character === '"') {
      const start = index;
      index += 1;
      let escaped = false;
      while (index < source.length) {
        const current = source[index++];
        if (escaped) { escaped = false; continue; }
        if (current === '\\') { escaped = true; continue; }
        if (current === '"') break;
      }
      const frame = stack[stack.length - 1];
      if (frame?.type === 'object' && frame.expectsKey) {
        const key = JSON.parse(source.slice(start, index)) as string;
        if (frame.keys.has(key)) return key;
        frame.keys.add(key);
        frame.expectsKey = false;
      }
      continue;
    }
    if (character === '{') { stack.push({ type: 'object', keys: new Set(), expectsKey: true }); index += 1; continue; }
    if (character === '[') { stack.push({ type: 'array', keys: new Set(), expectsKey: false }); index += 1; continue; }
    if (character === ':' ) { index += 1; continue; }
    if (character === ',') {
      const frame = stack[stack.length - 1];
      if (frame?.type === 'object') frame.expectsKey = true;
      index += 1;
      continue;
    }
    if (character === '}' || character === ']') { stack.pop(); index += 1; continue; }
    index += 1;
  }
  return null;
}

function hasUnsafeKey(value: unknown, depth = 0): 'unsafe-key' | 'too-deep' | null {
  if (depth > PERSONAL_VOCABULARY_MAX_DEPTH) return 'too-deep';
  if (!value || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    if (UNSAFE_KEYS.has(key)) return 'unsafe-key';
    const nested = hasUnsafeKey(child, depth + 1);
    if (nested) return nested;
  }
  return null;
}

export function parsePersonalVocabularyJson(bytes: Uint8Array): PersonalVocabularyParseResult {
  if (bytes.byteLength > PERSONAL_VOCABULARY_MAX_BYTES) return { ok: false, reason: 'oversize' };
  let source: string;
  try {
    source = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, reason: 'invalid-utf8' };
  }
  let value: unknown;
  try { value = JSON.parse(source) as unknown; } catch { return { ok: false, reason: 'malformed-json' }; }
  const duplicate = duplicateJsonKey(source);
  if (duplicate) return { ok: false, reason: 'duplicate-key' };
  const unsafe = hasUnsafeKey(value);
  if (unsafe) return { ok: false, reason: unsafe };
  const parsed = documentSchema.safeParse(value);
  if (!parsed.success) {
    if (value && typeof value === 'object' && 'schemaVersion' in value && (value as { schemaVersion?: unknown }).schemaVersion !== PERSONAL_VOCABULARY_SCHEMA_VERSION) return { ok: false, reason: 'unsupported-schema' };
    return { ok: false, reason: 'invalid-shape' };
  }
  return { ok: true, document: parsed.data };
}

export function serializePersonalVocabulary(document: PersonalVocabularyDocument): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(document, null, 2)}\n`);
}

const TECHNICAL_TEXT = /(?:https?:\/\/|^[A-Za-z]:\\|^\\\\|[\\/]src[\\/]|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|`[^`]+`|\b(?:sha256|SHA-256|JSON|URI|IPC|TOTP|Electron|Windows)\b)/;
