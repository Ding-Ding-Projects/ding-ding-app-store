import type { HistoryEntry, HistoryExportFormat } from '../shared/contracts';

function csv(value: unknown): string {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function exportHistoryEntries(entries: readonly HistoryEntry[], format: HistoryExportFormat): string {
  if (format === 'json') return JSON.stringify(entries, null, 2);
  if (format === 'jsonl') return entries.map((entry) => JSON.stringify(entry)).join('\n');
  if (format === 'csv') return ['id,appId,displayName,kind,ok,message,occurredAt', ...entries.map((entry) => [entry.id, entry.appId, entry.displayName, entry.kind, entry.ok, entry.message, entry.occurredAt].map(csv).join(','))].join('\n');
  return ['# Ding Ding App Store activity', '', ...entries.flatMap((entry) => [`## ${entry.displayName} — ${entry.kind}`, '', `- Result: ${entry.ok ? 'Succeeded' : 'Failed'}`, `- Time: ${entry.occurredAt}`, `- Message: ${entry.message}`, ''])].join('\n');
}
