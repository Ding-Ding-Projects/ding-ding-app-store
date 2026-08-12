import type { History7zExportResult } from '../shared/contracts.js';

export function parseHistory7zExportResult(value: unknown): History7zExportResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The 7z export response was invalid.');
  const result = value as Record<string, unknown>;
  const keys = new Set(['ok', 'format', 'filename', 'mime', 'reason', 'message', 'messageYue']);
  if (Object.keys(result).some((key) => !keys.has(key)) || result.ok !== false || result.format !== '7z' || result.filename !== 'ding-ding-app-store-history.7z' || result.mime !== 'application/x-7z-compressed' || (result.reason !== 'dependency-unavailable' && result.reason !== 'secret-entry-required') || typeof result.message !== 'string' || result.message.length > 1_000 || typeof result.messageYue !== 'string' || result.messageYue.length > 1_000) throw new Error('The 7z export response was invalid.');
  return Object.freeze({ ok: false, format: '7z', filename: 'ding-ding-app-store-history.7z', mime: 'application/x-7z-compressed', reason: result.reason, message: result.message, messageYue: result.messageYue });
}
