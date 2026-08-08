import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { CHANGELOG_ENTRIES, changelogMarkdown, validateChangelog } from '../src/renderer/changelog';
import { exportHistoryEntries } from '../src/renderer/history-export';
import { MAX_NOTIFICATION_RECORDS, MAX_NOTIFICATION_STORAGE_BYTES, parseNotificationRecords } from '../src/renderer/state/use-notifications';
import type { HistoryEntry } from '../src/shared/contracts';
import type { NotificationRecord } from '../src/renderer/notify';
import { parseChangelogDate } from '../src/renderer/pages/ChangelogViewer';
import { compile, makeMatcher, regexSafetyIssue } from '../src/renderer/search';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('global renderer UI completion', () => {
  it('keeps every real baseline release traceable to a full commit SHA', () => {
    const localTags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
    if (localTags.length) expect(new Set(CHANGELOG_ENTRIES.map((entry) => entry.version))).toEqual(new Set(localTags));
    expect(validateChangelog(CHANGELOG_ENTRIES)).toEqual([]);
    const markdown = changelogMarkdown(CHANGELOG_ENTRIES);
    for (const entry of CHANGELOG_ENTRIES) expect(markdown).toContain(entry.commit);
  });

  it('rejects changelog rows whose commit SHA is missing or shortened', () => {
    expect(validateChangelog([{ ...CHANGELOG_ENTRIES[0], commit: 'b4a94f3' }])).toContain(`${CHANGELOG_ENTRIES[0].version} is missing a full commit SHA.`);
  });

  it('accepts current one- and two-suffix release tags', () => {
    const base = CHANGELOG_ENTRIES[0];
    expect(validateChangelog([{ ...base, version: 'v0.1.0-15' }])).toEqual([]);
    expect(validateChangelog([{ ...base, version: 'v0.1.0-15-2' }])).toEqual([]);
  });

  it('rejects impossible ISO calendar dates without normalizing them', () => {
    expect(Number.isNaN(parseChangelogDate('2026-02-31'))).toBe(true);
    expect(Number.isNaN(parseChangelogDate('2026-13-01'))).toBe(true);
    expect(parseChangelogDate('2026-02-28')).not.toBeNull();
  });

  it('rejects adversarial regex shapes before synchronous list filtering', () => {
    for (const pattern of ['(a+)+$', '(.*)+$', '(a|aa)+$', '(a*){2,}', '(a)\\1+']) {
      expect(regexSafetyIssue(pattern)).toBeTruthy();
      expect(compile({ pattern, flags: 'u' })).toBeNull();
      expect(makeMatcher({ query: pattern, regex: { pattern, flags: 'u' } })('a'.repeat(10_000) + '!')).toBe(false);
    }
    expect(regexSafetyIssue('^(desktop|material)$')).toBeNull();
  });

  it('loads only bounded, structurally valid persisted notification records', () => {
    const record: NotificationRecord = { id: 'n1', title: 'Done', message: 'Exported.', ok: true, createdAt: '2026-08-07T12:00:00.000Z', dismissedAt: null };
    const values = Array.from({ length: MAX_NOTIFICATION_RECORDS + 20 }, (_, index) => ({ ...record, id: `n${index}` }));
    expect(parseNotificationRecords(JSON.stringify([...values, { id: 4 }]))).toHaveLength(MAX_NOTIFICATION_RECORDS);
    expect(parseNotificationRecords('{broken')).toEqual([]);
    expect(parseNotificationRecords(' '.repeat(MAX_NOTIFICATION_STORAGE_BYTES + 1))).toEqual([]);
  });

  it('exports exactly the selected activity records in every supported durable format', () => {
    const entry: HistoryEntry = { id: 'op1', appId: 'desktop-material', displayName: 'Desktop Material', kind: 'install', ok: false, message: 'Installer said "no".', occurredAt: '2026-08-07T12:00:00.000Z' };
    expect(JSON.parse(exportHistoryEntries([entry], 'json'))).toEqual([entry]);
    expect(exportHistoryEntries([entry], 'jsonl')).toContain('"appId":"desktop-material"');
    expect(exportHistoryEntries([entry], 'csv')).toContain('"Installer said ""no""."');
    expect(exportHistoryEntries([entry], 'markdown')).toContain('## Desktop Material — install');
  });

  it('ships searchable bulk surfaces, a super-confirmed notification delete, and safe editor fallback', async () => {
    const [app, apps, activity, notifications, changelog, editor, contracts, regex] = await Promise.all([
      read('src/renderer/App.tsx'), read('src/renderer/pages/AppsPage.tsx'), read('src/renderer/pages/ActivityPage.tsx'),
      read('src/renderer/components/NotificationCenter.tsx'), read('src/renderer/pages/ChangelogViewer.tsx'),
      read('src/renderer/external-editor.ts'), read('src/shared/contracts.ts'), read('src/renderer/components/RegexBuilder.tsx'),
    ]);
    expect(app).toContain('<SnackbarStack');
    expect(app).toContain('<NotificationCenter');
    for (const source of [apps, activity, notifications, changelog]) {
      expect(source).toContain('Select all shown');
      expect(source).toContain('Invert shown');
    }
    expect(notifications).toContain('<DestructiveConfirmDialog');
    expect(notifications).toContain('if (deleteButtonRef.current && !deleteButtonRef.current.disabled)');
    expect(notifications).toContain('SearchBox surface="notifications"');
    expect(changelog).toContain('SearchBox surface="changelog"');
    expect(editor).toContain("reason: 'bridge-unavailable'");
    expect(contracts).toContain('externalEditor?:');
    expect(regex).toContain("new Worker(new URL('../regex-worker.ts'");
    expect(regex).toContain('worker.terminate()');
    expect(regex).toContain('}, 150)');
  });
});
