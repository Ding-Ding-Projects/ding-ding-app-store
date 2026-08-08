import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  evaluateRegexSample,
  normalizeRegexWorkerRequest,
} from '../src/renderer/regex-evaluation';
import {
  MAX_REGEX_HAYSTACK_LENGTH,
  MAX_REGEX_MATCHES,
  MAX_REGEX_PATTERN_LENGTH,
  MAX_REGEX_SAMPLE_LENGTH,
  regexFlagsIssue,
  regexSafetyIssue,
} from '../src/renderer/regex-safety';
import { highlight, makeMatcher } from '../src/renderer/search';

describe('bounded regex worker contract', () => {
  it('rejects unsafe patterns and unsupported flags before compilation', () => {
    expect(regexSafetyIssue('(?=a)')).toMatch(/lookaround/i);
    expect(regexSafetyIssue('(a+)+$')).toMatch(/quantifier/i);
    expect(regexSafetyIssue('a'.repeat(MAX_REGEX_PATTERN_LENGTH + 1))).toMatch(/160/);
    expect(regexFlagsIssue('ii')).toMatch(/once/i);
    expect(regexFlagsIssue('g')).toMatch(/only the i/i);
  });

  it('bounds worker messages and returns fail-closed validation errors', () => {
    const invalid = normalizeRegexWorkerRequest({ id: 4, pattern: '(a+)+$', flags: 'u', sample: 'a' });
    expect(invalid).toEqual({ id: 4, error: expect.stringMatching(/quantifier/i) });
    const valid = normalizeRegexWorkerRequest({ id: 5, pattern: '^a+$', flags: 'u', sample: 'a'.repeat(MAX_REGEX_SAMPLE_LENGTH + 50) });
    expect('error' in valid).toBe(false);
    if ('error' in valid) return;
    expect(valid.pattern.length).toBeLessThanOrEqual(MAX_REGEX_PATTERN_LENGTH);
    expect(valid.sample.length).toBe(MAX_REGEX_SAMPLE_LENGTH);
  });

  it('handles zero-width matches without looping and clips result payloads', () => {
    const normalized = normalizeRegexWorkerRequest({ id: 8, pattern: '^', flags: 'mu', sample: 'a\nb' });
    expect('error' in normalized).toBe(false);
    if ('error' in normalized) return;
    const result = evaluateRegexSample(normalized, () => 0);
    expect(result.error).toBe('');
    expect(result.matches.length).toBeGreaterThan(0);
    expect(result.matches.length).toBeLessThanOrEqual(MAX_REGEX_MATCHES);

    const long = normalizeRegexWorkerRequest({ id: 9, pattern: '.*', flags: 'su', sample: 'x'.repeat(MAX_REGEX_SAMPLE_LENGTH) });
    expect('error' in long).toBe(false);
    if ('error' in long) return;
    const longResult = evaluateRegexSample(long, () => 0);
    expect(longResult.matches[0]?.text.length).toBeLessThanOrEqual(MAX_REGEX_HAYSTACK_LENGTH + 1);
  });

  it('fails closed when the worker budget expires', () => {
    const normalized = normalizeRegexWorkerRequest({ id: 10, pattern: 'a+', flags: 'u', sample: 'aaaa' });
    expect('error' in normalized).toBe(false);
    if ('error' in normalized) return;
    let tick = 0;
    const result = evaluateRegexSample(normalized, () => { tick += 200; return tick; });
    expect(result.matches).toEqual([]);
    expect(result.error).toMatch(/budget/i);
  });

  it('keeps synchronous collection and highlight paths bounded and fail-closed', () => {
    const state = { query: 'x', regex: { pattern: 'x+', flags: 'u' } };
    expect(makeMatcher(state)('x'.repeat(MAX_REGEX_HAYSTACK_LENGTH + 500))).toBe(true);
    expect(makeMatcher({ query: 'x', regex: { pattern: '(a+)+$', flags: 'u' } })('a'.repeat(20_000))).toBe(false);
    expect(highlight({ query: '^', regex: { pattern: '^', flags: 'm' } }, 'a\nb')).toBe('a\nb');
  });

  it('keeps worker source free of renderer/main privilege bridges', async () => {
    const source = await readFile(new URL('../src/renderer/regex-worker.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/window|document|electron|ipc|fetch|process|fs|require/);
    expect(source).toContain('normalizeRegexWorkerRequest');
    expect(source).toContain('newestRequestId');
  });
});

