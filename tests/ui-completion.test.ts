import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CHANGELOG_ENTRIES, changelogMarkdown, validateChangelog } from '../src/renderer/changelog';
import { exportHistoryEntries } from '../src/renderer/history-export';
import { MAX_NOTIFICATION_RECORDS, parseNotificationRecords } from '../src/renderer/state/use-notifications';
import type { HistoryEntry } from '../src/shared/contracts';
import type { NotificationRecord } from '../src/renderer/notify';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('global renderer UI completion', () => {
  it('keeps every real baseline release traceable to a full commit SHA', () => {
    expect(CHANGELOG_ENTRIES).toHaveLength(9);
    expect(CHANGELOG_ENTRIES.map((entry) => entry.version)).toEqual([
      'v0.1.0-13', 'v0.1.0-9', 'v0.1.0-8', 'v0.1.0-7', 'v0.1.0-6', 'v0.1.0-4', 'v0.1.0-3', 'v0.1.0-2', 'v0.1.0-1',
    ]);
    expect(validateChangelog(CHANGELOG_ENTRIES)).toEqual([]);
    const markdown = changelogMarkdown(CHANGELOG_ENTRIES);
    for (const entry of CHANGELOG_ENTRIES) expect(markdown).toContain(entry.commit);
  });

  it('rejects changelog rows whose commit SHA is missing or shortened', () => {
    expect(validateChangelog([{ ...CHANGELOG_ENTRIES[0], commit: 'b4a94f3' }])).toContain('v0.1.0-13 is missing a full commit SHA.');
  });

  it('loads only bounded, structurally valid persisted notification records', () => {
    const record: NotificationRecord = { id: 'n1', title: 'Done', message: 'Exported.', ok: true, createdAt: '2026-08-07T12:00:00.000Z', dismissedAt: null };
    const values = Array.from({ length: MAX_NOTIFICATION_RECORDS + 20 }, (_, index) => ({ ...record, id: `n${index}` }));
    expect(parseNotificationRecords(JSON.stringify([...values, { id: 4 }]))).toHaveLength(MAX_NOTIFICATION_RECORDS);
    expect(parseNotificationRecords('{broken')).toEqual([]);
  });

  it('exports exactly the selected activity records in every supported durable format', () => {
    const entry: HistoryEntry = { id: 'op1', appId: 'desktop-material', displayName: 'Desktop Material', kind: 'install', ok: false, message: 'Installer said "no".', occurredAt: '2026-08-07T12:00:00.000Z' };
    expect(JSON.parse(exportHistoryEntries([entry], 'json'))).toEqual([entry]);
    expect(exportHistoryEntries([entry], 'jsonl')).toContain('"appId":"desktop-material"');
    expect(exportHistoryEntries([entry], 'csv')).toContain('"Installer said ""no""."');
    expect(exportHistoryEntries([entry], 'markdown')).toContain('## Desktop Material — install');
  });

  it('ships searchable bulk surfaces, a super-confirmed notification delete, and safe editor fallback', async () => {
    const [app, apps, activity, notifications, changelog, editor, contracts] = await Promise.all([
      read('src/renderer/App.tsx'), read('src/renderer/pages/AppsPage.tsx'), read('src/renderer/pages/ActivityPage.tsx'),
      read('src/renderer/components/NotificationCenter.tsx'), read('src/renderer/pages/ChangelogViewer.tsx'),
      read('src/renderer/external-editor.ts'), read('src/shared/contracts.ts'),
    ]);
    expect(app).toContain('<SnackbarStack');
    expect(app).toContain('<NotificationCenter');
    for (const source of [apps, activity, notifications, changelog]) {
      expect(source).toContain('Select all shown');
      expect(source).toContain('Invert shown');
    }
    expect(notifications).toContain('<DestructiveConfirmDialog');
    expect(notifications).toContain('SearchBox surface="notifications"');
    expect(changelog).toContain('SearchBox surface="changelog"');
    expect(editor).toContain("reason: 'bridge-unavailable'");
    expect(contracts).toContain('externalEditor?:');
  });
});
