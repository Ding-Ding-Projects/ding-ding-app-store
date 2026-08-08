import { evaluateRegexSample, normalizeRegexWorkerRequest } from './regex-evaluation';
import type { RegexWorkerRequest } from './regex-evaluation';

type CancelMessage = { type: 'cancel'; id: number };
type WorkerMessage = RegexWorkerRequest | CancelMessage;

let newestRequestId = -1;

self.addEventListener('message', (event: MessageEvent<WorkerMessage>) => {
  const value = event.data;
  if (value && typeof value === 'object' && 'type' in value && value.type === 'cancel') {
    if (Number.isInteger(value.id) && value.id > newestRequestId) newestRequestId = value.id;
    return;
  }
  const normalized = normalizeRegexWorkerRequest(value);
  if ('error' in normalized) {
    self.postMessage({ id: normalized.id, error: normalized.error, matches: [] });
    return;
  }
  if (normalized.id <= newestRequestId) return;
  newestRequestId = normalized.id;
  const result = evaluateRegexSample(normalized);
  // A newer request can arrive while this bounded evaluation is running. Never
  // publish stale preview data to a newer builder generation.
  if (normalized.id !== newestRequestId) return;
  self.postMessage(result);
});
