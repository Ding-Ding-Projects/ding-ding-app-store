/**
 * Shared bounds for every renderer regex surface. Keep these values small enough
 * that an invalid or adversarial pattern cannot turn a search field into an
 * unbounded renderer workload. The worker repeats validation because messages
 * crossing that boundary are untrusted even though the caller is our UI.
 */
export const MAX_REGEX_PATTERN_LENGTH = 160;
export const MAX_REGEX_SAMPLE_LENGTH = 10_000;
export const MAX_REGEX_HAYSTACK_LENGTH = 4_096;
export const MAX_REGEX_MATCHES = 100;
export const REGEX_WORKER_TIMEOUT_MS = 150;
export const REGEX_WORKER_BUDGET_MS = 100;
export const SUPPORTED_REGEX_FLAGS = 'imsu';

const quantifier = '(?:[*+?]|\\{\\d+(?:,\\d*)?\\})';

/**
 * Reject known catastrophic-backtracking shapes before a pattern is compiled.
 * JavaScript's RegExp engine does not expose an interrupt API, so the only safe
 * renderer-side policy is fail-closed admission plus a bounded worker.
 */
export function regexSafetyIssue(pattern: string): string | null {
  if (typeof pattern !== 'string') return 'Pattern must be text.';
  if (pattern.length > MAX_REGEX_PATTERN_LENGTH) return `Patterns are limited to ${MAX_REGEX_PATTERN_LENGTH} characters.`;
  if (/\\(?:[1-9]|k<[^>]+>)/.test(pattern)) return 'Backreferences are disabled because they can make evaluation time unpredictable.';
  if (/(?:^|[^\\])\(\?(?:[=!]|<[=!])/.test(pattern)) return 'Lookaround is disabled because it can make evaluation time unpredictable.';
  const unescapedPattern = pattern.replace(/\\\\\./g, '');
  if (/(?:\.\*){2,}|(?:\.\+){2,}/.test(unescapedPattern)) return 'Repeated unbounded wildcards are disabled.';
  if (new RegExp(`${quantifier}[^()]{0,80}\\)[*+?]`).test(pattern)) return 'Nested quantifiers are disabled to prevent excessive backtracking.';
  if (new RegExp(`\\((?:\\\\.|[^()])*(?:\\||${quantifier})(?:\\\\.|[^()])*\\)(?:[*+?]|\\{\\d+(?:,\\d*)?\\})`).test(pattern)) return 'Quantified alternation or nested quantifiers are disabled to prevent excessive backtracking.';
  if (/(?:\{|,)(\d{4,})(?:\}|,)/.test(pattern) || /\{\d+,\}/.test(pattern)) return 'Unbounded or oversized repetition is disabled by the safety limit.';
  return null;
}

export function regexFlagsIssue(flags: string): string | null {
  if (typeof flags !== 'string') return 'Flags must be text.';
  if (flags.length > SUPPORTED_REGEX_FLAGS.length || /[^imsu]/.test(flags)) return 'Only the i, m, s, and u flags are supported.';
  if (new Set(flags).size !== flags.length) return 'Each regex flag may appear only once.';
  return null;
}

export function boundedPattern(pattern: string): string {
  return pattern.slice(0, MAX_REGEX_PATTERN_LENGTH);
}

export function boundedSample(sample: string): string {
  return sample.slice(0, MAX_REGEX_SAMPLE_LENGTH);
}

export function boundedHaystack(haystack: string): string {
  return haystack.slice(0, MAX_REGEX_HAYSTACK_LENGTH);
}
