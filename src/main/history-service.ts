import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { HistoryEntry, HistoryExportFormat, OperationKind } from '../shared/contracts.js';

const MAX_HISTORY_BYTES = 10_000_000;
const MAX_HISTORY_ENTRIES = 10_000;

async function git(cwd: string, args: string[]): Promise<number> {
  return await new Promise<number>((resolve) => {
    const child = spawn('git', args, {
      cwd,
      shell: false,
      windowsHide: true,
      stdio: 'ignore',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Ding Ding App Store',
        GIT_AUTHOR_EMAIL: 'local-history@ding-ding.invalid',
        GIT_COMMITTER_NAME: 'Ding Ding App Store',
        GIT_COMMITTER_EMAIL: 'local-history@ding-ding.invalid',
      },
    });
    child.once('error', () => resolve(-1));
    child.once('exit', (code) => resolve(code ?? -1));
  });
}

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
  private readonly root = path.join(app.getPath('userData'), 'history');
  private readonly logPath = path.join(this.root, 'operations.v1.jsonl');
  private readonly repositoryPath = path.join(this.root, 'repository');
  private readonly installedPath = path.join(app.getPath('userData'), 'installed-apps.v1.json');
  private readonly settingsPath = path.join(app.getPath('userData'), 'settings.v1.json');

  async list(): Promise<HistoryEntry[]> {
    try {
      const text = await readFile(this.logPath, 'utf8');
      if (text.length > MAX_HISTORY_BYTES) throw new Error('Operation history exceeded 10 MB.');
      return text
        .split(/\r?\n/)
        .filter(Boolean)
        .slice(-MAX_HISTORY_ENTRIES)
        .map((line) => JSON.parse(line) as HistoryEntry)
        .filter((entry) => Boolean(entry?.id && entry?.appId && entry?.occurredAt))
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async record(input: HistoryRecordInput): Promise<HistoryEntry> {
    const entry: HistoryEntry = { id: randomUUID(), occurredAt: new Date().toISOString(), ...input };
    await mkdir(this.root, { recursive: true });
    await appendFile(this.logPath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
    if (entry.ok) await this.snapshot(`${entry.kind}: ${entry.appId}`);
    return entry;
  }

  async export(format: HistoryExportFormat): Promise<string> {
    const entries = await this.list();
    if (format === 'json') return `${JSON.stringify(entries, null, 2)}\n`;
    if (format === 'jsonl') return `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`;
    if (format === 'csv') {
      const header = 'occurredAt,kind,appId,displayName,ok,message';
      const rows = entries.map((entry) =>
        [entry.occurredAt, entry.kind, entry.appId, entry.displayName, String(entry.ok), entry.message]
          .map(csvField)
          .join(','),
      );
      return `${[header, ...rows].join('\r\n')}\r\n`;
    }
    const rows = entries.map(
      (entry) =>
        `| ${entry.occurredAt} | ${entry.kind} | ${entry.displayName} | ${entry.ok ? 'OK' : 'Failed'} | ${entry.message.replaceAll('|', '\\|')} |`,
    );
    return `${['| When | Action | App | Result | Message |', '| --- | --- | --- | --- | --- |', ...rows].join('\n')}\n`;
  }

  private async snapshot(label: string): Promise<void> {
    try {
      const state = path.join(this.repositoryPath, 'state');
      await mkdir(state, { recursive: true });
      if (await git(this.repositoryPath, ['rev-parse', '--git-dir']) !== 0) await git(this.repositoryPath, ['init']);
      for (const [source, target] of [[this.installedPath, 'installed-apps.json'], [this.settingsPath, 'settings.json']] as const) {
        let content = '{}\n';
        try { content = await readFile(source, 'utf8'); } catch { /* explicit empty snapshot */ }
        await writeFile(path.join(state, target), content, { encoding: 'utf8', mode: 0o600 });
      }
      await git(this.repositoryPath, ['add', '--', 'state']);
      if (await git(this.repositoryPath, ['diff', '--cached', '--quiet']) !== 0) await git(this.repositoryPath, ['commit', '-m', label]);
    } catch {
      // History snapshots must never fail the operation the user requested.
    }
  }
}
