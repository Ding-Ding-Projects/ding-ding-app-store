import {
  boundedPattern,
  boundedSample,
  MAX_REGEX_MATCHES,
  regexFlagsIssue,
  regexSafetyIssue,
  REGEX_WORKER_BUDGET_MS,
} from './regex-safety';

export interface RegexWorkerRequest {
  id: number;
  pattern: string;
  flags: string;
  sample: string;
}

export interface RegexMatch {
  text: string;
  groups: string[];
}

export interface RegexEvaluationResult {
  id: number;
  error: string;
  matches: RegexMatch[];
}

export interface NormalizedRegexRequest extends RegexWorkerRequest {
  pattern: string;
  flags: string;
  sample: string;
}

const MAX_MATCH_TEXT_LENGTH = 4_096;

function finiteId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER;
}

/** Validate and bound an untrusted postMessage payload before touching RegExp. */
export function normalizeRegexWorkerRequest(value: unknown): NormalizedRegexRequest | { id: number; error: string } {
  if (!value || typeof value !== 'object') return { id: 0, error: 'Regex worker received an invalid request.' };
  const input = value as Partial<RegexWorkerRequest>;
  const id = finiteId(input.id) ? input.id : 0;
  if (typeof input.pattern !== 'string' || typeof input.flags !== 'string' || typeof input.sample !== 'string') {
    return { id, error: 'Regex worker received an invalid request.' };
  }
  const pattern = boundedPattern(input.pattern);
  const flags = input.flags;
  const sample = boundedSample(input.sample);
  const patternError = regexSafetyIssue(input.pattern);
  if (patternError) return { id, error: patternError };
  const flagsError = regexFlagsIssue(flags);
  if (flagsError) return { id, error: flagsError };
  return { id, pattern, flags, sample };
}

function clipped(value: string): string {
  return value.length > MAX_MATCH_TEXT_LENGTH ? `${value.slice(0, MAX_MATCH_TEXT_LENGTH)}…` : value;
}

/**
 * Evaluate one bounded sample. This function deliberately has no DOM, Electron,
 * IPC, filesystem, or network access so the worker cannot escalate privileges.
 */
export function evaluateRegexSample(request: NormalizedRegexRequest, now: () => number = () => performance.now()): RegexEvaluationResult {
  const startedAt = now();
  const deadline = startedAt + REGEX_WORKER_BUDGET_MS;
  try {
    const expression = new RegExp(request.pattern, `${request.flags}g`);
    const matches: RegexMatch[] = [];
    let steps = 0;
    while (matches.length < MAX_REGEX_MATCHES) {
      if (now() > deadline) return { id: request.id, error: 'Evaluation exceeded the worker safety budget.', matches: [] };
      const match = expression.exec(request.sample);
      steps += 1;
      if (!match) break;
      matches.push({ text: clipped(match[0]), groups: match.slice(1).map((group) => clipped(group ?? '')) });
      if (!match[0]) {
        // RegExp.exec leaves lastIndex unchanged for zero-width global matches.
        // Advance one UTF-16 code unit so ^, $, and look-free empty matches cannot loop.
        expression.lastIndex = Math.max(expression.lastIndex, (match.index ?? 0) + 1);
      }
      if (steps > MAX_REGEX_MATCHES * 2) break;
    }
    return { id: request.id, error: '', matches };
  } catch (error) {
    return { id: request.id, error: error instanceof Error ? error.message.slice(0, 400) : 'Regex evaluation failed.', matches: [] };
  }
}
