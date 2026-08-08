import {
  boundedPattern,
  boundedSample,
  REGEX_WORKER_TIMEOUT_MS,
} from './regex-safety';
import type { RegexEvaluationResult, RegexWorkerRequest } from './regex-evaluation';

export type { RegexEvaluationResult, RegexMatch, RegexWorkerRequest } from './regex-evaluation';

let generation = 0;

/**
 * Evaluate a builder sample in an isolated worker. The caller owns cancellation
 * through AbortSignal; every request also receives a monotonically increasing
 * generation so late messages from a previous keystroke are ignored.
 */
export function evaluateRegexInWorker(request: Omit<RegexWorkerRequest, 'id'>, signal?: AbortSignal): Promise<RegexEvaluationResult> {
  const id = ++generation;
  const boundedRequest: RegexWorkerRequest = {
    id,
    pattern: boundedPattern(request.pattern),
    flags: request.flags.slice(0, 4),
    sample: boundedSample(request.sample),
  };
  return new Promise((resolve) => {
    let settled = false;
    let timeout = 0;
    let worker: Worker | null = null;
    const finish = (result: RegexEvaluationResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      worker?.terminate();
      signal?.removeEventListener('abort', cancel);
      resolve(id === generation ? result : { id, error: 'Evaluation superseded by a newer pattern.', matches: [] });
    };
    const cancel = () => {
      if (settled) return;
      worker?.postMessage({ type: 'cancel', id });
      finish({ id, error: 'Evaluation cancelled.', matches: [] });
    };
    if (signal?.aborted) {
      cancel();
      return;
    }
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      worker = new Worker(new URL('./regex-worker.ts', import.meta.url), { type: 'module' });
      worker.addEventListener('message', (event: MessageEvent<RegexEvaluationResult>) => {
        const result = event.data;
        if (!result || result.id !== id || id !== generation) return;
        finish({ id, error: typeof result.error === 'string' ? result.error.slice(0, 400) : 'Regex worker returned an invalid error.', matches: Array.isArray(result.matches) ? result.matches.slice(0, 100) : [] });
      });
      worker.addEventListener('error', () => finish({ id, error: 'Regex worker failed closed.', matches: [] }), { once: true });
      timeout = window.setTimeout(() => finish({ id, error: `Evaluation timed out after ${REGEX_WORKER_TIMEOUT_MS} ms. Adjust the pattern to avoid excessive backtracking.`, matches: [] }), REGEX_WORKER_TIMEOUT_MS);
      worker.postMessage(boundedRequest);
    } catch {
      finish({ id, error: 'Regex worker is unavailable; no pattern was evaluated.', matches: [] });
    }
  });
}
