import type { SupportState, SupportTicketBulkAdvanceRequest, SupportTicketBulkAdvanceResult, SupportTicketMutationResult } from '../shared/contracts.js';

function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Support response was invalid.'); return value as Record<string, unknown>; }
function ticket(value: unknown): SupportState['tickets'][number] {
  const input = object(value);
  const keys = new Set(['id', 'number', 'category', 'description', 'severity', 'status', 'firstResponse', 'createdAt', 'updatedAt']);
  if (Object.keys(input).some((key) => !keys.has(key)) || typeof input.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.id) || typeof input.number !== 'string' || !/^DDAS-[0-9]{4}-[A-Z0-9]{8}$/.test(input.number) || !['unlock', 'lock', 'other'].includes(String(input.category)) || typeof input.description !== 'string' || input.description.length > 2000 || !['low', 'normal', 'high'].includes(String(input.severity)) || !['created', 'reviewed', 'resolved'].includes(String(input.status)) || typeof input.firstResponse !== 'string' || input.firstResponse.length > 500 || typeof input.createdAt !== 'string' || !Number.isFinite(Date.parse(input.createdAt)) || typeof input.updatedAt !== 'string' || !Number.isFinite(Date.parse(input.updatedAt))) throw new Error('Support ticket response was invalid.');
  return Object.freeze({ id: input.id, number: input.number, category: input.category as 'unlock' | 'lock' | 'other', description: input.description, severity: input.severity as 'low' | 'normal' | 'high', status: input.status as 'created' | 'reviewed' | 'resolved', firstResponse: input.firstResponse, createdAt: input.createdAt, updatedAt: input.updatedAt });
}
export function parseSupportState(value: unknown): SupportState {
  const input = object(value);
  if (input.schemaVersion !== 1 || !Array.isArray(input.tickets) || input.tickets.length > 1000 || typeof input.recoveryPath !== 'string' || typeof input.disclosure !== 'string' || input.disclosure.length > 1000) throw new Error('Support state response was invalid.');
  return Object.freeze({ schemaVersion: 1, tickets: input.tickets.map(ticket), recoveryPath: input.recoveryPath, disclosure: input.disclosure });
}
export function parseSupportTicketBulkAdvanceRequest(value: unknown): SupportTicketBulkAdvanceRequest {
  const input = object(value);
  if (Object.keys(input).some((key) => key !== 'ticketIds') || !Array.isArray(input.ticketIds) || input.ticketIds.length < 1 || input.ticketIds.length > 1000 || input.ticketIds.some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) || new Set(input.ticketIds).size !== input.ticketIds.length) throw new Error('Support ticket batch request was invalid.');
  return { ticketIds: input.ticketIds as string[] };
}
function baseMutation(value: unknown): Record<string, unknown> { const input = object(value); if (typeof input.ok !== 'boolean' || typeof input.message !== 'string' || input.message.length > 2000 || !input.state) throw new Error('Support mutation response was invalid.'); parseSupportState(input.state); return input; }
export function parseSupportTicketMutationResult(value: unknown): SupportTicketMutationResult { const input = baseMutation(value); const allowed = new Set(['ok', 'state', 'message', 'reason']); if (Object.keys(input).some((key) => !allowed.has(key)) || input.reason !== undefined && !['invalid', 'storage-failed', 'not-found'].includes(String(input.reason))) throw new Error('Support mutation response was invalid.'); return Object.freeze({ ok: input.ok as boolean, state: parseSupportState(input.state), message: input.message as string, reason: input.reason as SupportTicketMutationResult['reason'] }); }
export function parseSupportTicketBulkAdvanceResult(value: unknown): SupportTicketBulkAdvanceResult {
  const input = baseMutation(value);
  const allowed = new Set(['ok', 'state', 'message', 'committed', 'skipped', 'uncertain', 'reason']);
  if (Object.keys(input).some((key) => !allowed.has(key))) throw new Error('Support ticket batch response was invalid.');
  const arrays = ['committed', 'skipped', 'uncertain'] as const;
  if (arrays.some((key) => !Array.isArray(input[key]) || input[key].length > 1000 || input[key].some((id) => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) || input.reason !== undefined && !['invalid', 'storage-failed', 'busy'].includes(String(input.reason))) throw new Error('Support ticket batch response was invalid.');
  const committed = new Set(input.committed as string[]);
  const skipped = new Set(input.skipped as string[]);
  const uncertain = new Set(input.uncertain as string[]);
  if (committed.size !== (input.committed as string[]).length || skipped.size !== (input.skipped as string[]).length || uncertain.size !== (input.uncertain as string[]).length || [...committed].some((id) => skipped.has(id) || uncertain.has(id)) || [...skipped].some((id) => uncertain.has(id))) throw new Error('Support ticket batch response was invalid.');
  if (input.ok === true && uncertain.size > 0 || input.ok === false && committed.size > 0) throw new Error('Support ticket batch response was invalid.');
  return Object.freeze({ ok: input.ok as boolean, state: parseSupportState(input.state), message: input.message as string, committed: input.committed as string[], skipped: input.skipped as string[], uncertain: input.uncertain as string[], reason: input.reason as SupportTicketBulkAdvanceResult['reason'] });
}
