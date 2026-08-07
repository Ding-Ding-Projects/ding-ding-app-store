import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { HistoryExport, HistoryExportFormat, OperationHistoryEntry } from '../shared/contracts.js';

const MAX_HISTORY_BYTES = 10_000_000;
const MAX_HISTORY_ENTRIES = 10_000;

async function git(cwd: string, args: string[]): Promise<number> {
  return await new Promise<number>((resolve) => {
    const child = spawn('git', args, {
      cwd, shell: false, windowsHide: true, stdio: 'ignore',
      env: { ...process.env, GIT_AUTHOR_NAME: 'Ding Ding App Store', GIT_AUTHOR_EMAIL: 'local-history@ding-ding.invalid', GIT_COMMITTER_NAME: 'Ding Ding App Store', GIT_COMMITTER_EMAIL: 'local-history@ding-ding.invalid' },
    });
    child.once('error', () => resolve(-1));
    child.once('exit', (code) => resolve(code ?? -1));
  });
}

function csv(value: unknown): string { return `"${String(value ?? '').replaceAll('"', '""')}"`; }

export class HistoryService {
  private readonly root = path.join(app.getPath('userData'), 'history');
  private readonly logPath = path.join(this.root, 'operations.v1.jsonl');
  private readonly repositoryPath = path.join(this.root, 'repository');
  private readonly installedPath = path.join(app.getPath('userData'), 'installed-apps.v1.json');
  private readonly settingsPath = path.join(app.getPath('userData'), 'settings.v1.json');

  async start(appId: string, action: OperationHistoryEntry['action'], message: string, version: string | null = null): Promise<OperationHistoryEntry> {
    const entry: OperationHistoryEntry = { id: randomUUID(), appId, action, status: 'started', startedAt: new Date().toISOString(), finishedAt: null, message, version };
    await this.append(entry);
    return entry;
  }

  async finish(started: OperationHistoryEntry, status: Exclude<OperationHistoryEntry['status'], 'started'>, message: string, version: string | null = started.version): Promise<OperationHistoryEntry> {
    const entry: OperationHistoryEntry = { ...started, status, message, version, finishedAt: new Date().toISOString() };
    await this.append(entry);
    if (status === 'succeeded') await this.snapshot(`${started.action}: ${started.appId}`);
    return entry;
  }

  async list(): Promise<OperationHistoryEntry[]> {
    try {
      const text = await readFile(this.logPath, 'utf8');
      if (text.length > MAX_HISTORY_BYTES) throw new Error('Operation history exceeded 10 MB.');
      const latest = new Map<string, OperationHistoryEntry>();
      for (const line of text.split(/\r?\n/).filter(Boolean).slice(-MAX_HISTORY_ENTRIES * 2)) {
        const value = JSON.parse(line) as OperationHistoryEntry;
        if (value?.id && value?.appId) latest.set(value.id, value);
      }
      return [...latest.values()].sort((left, right) => right.startedAt.localeCompare(left.startedAt)).slice(0, MAX_HISTORY_ENTRIES);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  }

  async export(format: HistoryExportFormat, entryIds?: string[]): Promise<HistoryExport> {
    const allowed = entryIds ? new Set(entryIds.slice(0, MAX_HISTORY_ENTRIES)) : null;
    const entries = (await this.list()).filter((entry) => !allowed || allowed.has(entry.id));
    const base = `ding-ding-app-store-history-${new Date().toISOString().slice(0, 10)}`;
    if (format === 'json') return { format, fileName: `${base}.json`, mediaType: 'application/json', content: `${JSON.stringify({ schemaVersion: 1, entries }, null, 2)}\n` };
    if (format === 'jsonl') return { format, fileName: `${base}.jsonl`, mediaType: 'application/x-ndjson', content: `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n` };
    if (format === 'csv') {
      const rows = [['id','appId','action','status','startedAt','finishedAt','version','message'].map(csv).join(','), ...entries.map((entry) => [entry.id,entry.appId,entry.action,entry.status,entry.startedAt,entry.finishedAt,entry.version,entry.message].map(csv).join(','))];
      return { format, fileName: `${base}.csv`, mediaType: 'text/csv', content: `${rows.join('\r\n')}\r\n` };
    }
    const rows = entries.map((entry) => `| ${entry.startedAt} | ${entry.appId} | ${entry.action} | ${entry.status} | ${entry.message.replaceAll('|', '\\|')} |`);
    return { format, fileName: `${base}.md`, mediaType: 'text/markdown', content: `# Ding Ding App Store operation history\n\n| Started | App | Action | Status | Message |\n| --- | --- | --- | --- | --- |\n${rows.join('\n')}\n` };
  }

  private async append(entry: OperationHistoryEntry): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await appendFile(this.logPath, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', mode: 0o600 });
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
