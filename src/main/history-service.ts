import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { app } from 'electron';
import type { HistoryEntry, HistoryExportFormat, OperationKind } from '../shared/contracts.js';
import { readJson, writeJsonAtomic } from './json-store.js';

const MAX_ENTRIES = 500;

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export interface HistoryRecordInput {
  appId: string;
  displayName: string;
  kind: OperationKind;
  ok: boolean;
  message: string;
}

export class HistoryService {
  private readonly filePath = path.join(app.getPath('userData'), 'history.v1.json');

  async list(): Promise<HistoryEntry[]> {
    const entries = await readJson<HistoryEntry[]>(this.filePath, []);
    return [...entries].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }

  async record(input: HistoryRecordInput): Promise<HistoryEntry> {
    const entries = await readJson<HistoryEntry[]>(this.filePath, []);
    const entry: HistoryEntry = { id: randomUUID(), occurredAt: new Date().toISOString(), ...input };
    await writeJsonAtomic(this.filePath, [...entries, entry].slice(-MAX_ENTRIES));
    return entry;
  }

  async export(format: HistoryExportFormat): Promise<string> {
    const entries = await this.list();
    if (format === 'json') return `${JSON.stringify(entries, null, 2)}\n`;
    if (format === 'csv') {
      const header = 'occurredAt,kind,appId,displayName,ok,message';
      const rows = entries.map((entry) =>
        [entry.occurredAt, entry.kind, entry.appId, entry.displayName, String(entry.ok), entry.message]
          .map(csvField)
          .join(','),
      );
      return `${[header, ...rows].join('\n')}\n`;
    }
    const rows = entries.map(
      (entry) =>
        `| ${entry.occurredAt} | ${entry.kind} | ${entry.displayName} | ${entry.ok ? 'OK' : 'Failed'} | ${entry.message.replaceAll('|', '\\|')} |`,
    );
    return `${['| When | Action | App | Result | Message |', '| --- | --- | --- | --- | --- |', ...rows].join('\n')}\n`;
  }
}
