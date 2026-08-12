import type { HistoryAccessResult, HistoryAccessStatus } from '../shared/contracts.js';

const MAX_MESSAGE = 2_000;
const reasons = new Set(['unavailable', 'not-configured', 'locked', 'ready']);

export function parseHistoryAccessStatus(value: unknown): HistoryAccessStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The protected-history status was invalid.');
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.available !== 'boolean' || typeof candidate.configured !== 'boolean' || typeof candidate.unlocked !== 'boolean' || typeof candidate.reason !== 'string' || !reasons.has(candidate.reason)) throw new Error('The protected-history status was invalid.');
  if (candidate.unlocked && candidate.reason !== 'ready') throw new Error('The protected-history status was invalid.');
  if (!candidate.unlocked && candidate.reason === 'ready') throw new Error('The protected-history status was invalid.');
  return { available: candidate.available, configured: candidate.configured, unlocked: candidate.unlocked, reason: candidate.reason as HistoryAccessStatus['reason'] };
}

export function parseHistoryAccessResult(value: unknown): HistoryAccessResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The protected-history result was invalid.');
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.ok !== 'boolean' || typeof candidate.message !== 'string' || candidate.message.length > MAX_MESSAGE) throw new Error('The protected-history result was invalid.');
  return { ok: candidate.ok, status: parseHistoryAccessStatus(candidate.status), message: candidate.message };
}
