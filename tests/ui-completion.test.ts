import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { CHANGELOG_ENTRIES, changelogMarkdown, validateChangelog } from '../src/renderer/changelog';
import { exportHistoryEntries } from '../src/renderer/history-export';
import { HISTORY_EXPORT_FORMATS, historyExportFormat } from '../src/shared/export-registry';
import { MAX_NOTIFICATION_RECORDS, MAX_NOTIFICATION_STORAGE_BYTES, parseNotificationRecords } from '../src/renderer/state/use-notifications';
import type { HistoryEntry } from '../src/shared/contracts';
import type { NotificationRecord } from '../src/renderer/notify';
import { exportNotificationRecords } from '../src/renderer/components/NotificationCenter';
import { changelogCalendarDays, chooseChangelogDate, parseChangelogDate } from '../src/renderer/pages/ChangelogViewer';
import { aboutRowBody } from '../src/renderer/pages/SettingsPage';
import { compile, makeMatcher, regexSafetyIssue } from '../src/renderer/search';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('global renderer UI completion', () => {
  it('keeps every committed fallback release traceable to a real tag and full commit SHA', () => {
    const localTags = execFileSync('git', ['tag', '--list', 'v*'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
    if (localTags.length) {
      const tagSet = new Set(localTags);
      for (const entry of CHANGELOG_ENTRIES) expect(tagSet.has(entry.version)).toBe(true);
    }
    expect(validateChangelog(CHANGELOG_ENTRIES)).toEqual([]);
    const markdown = changelogMarkdown(CHANGELOG_ENTRIES);
    for (const entry of CHANGELOG_ENTRIES) expect(markdown).toContain(entry.commit);
  });

  it('carries the configured display name through app-owned update and changelog surfaces', async () => {
    const [app, viewer, settingsPage] = await Promise.all([
      read('src/renderer/App.tsx'), read('src/renderer/pages/ChangelogViewer.tsx'), read('src/renderer/pages/SettingsPage.tsx'),
    ]);
    expect(app).toContain('`${settings.displayName} ${updateState.version} is ready`');
    expect(app).toContain('`${settings.displayName} ${updateState.version} 準備好喇`');
    expect(viewer).toContain('changelogMarkdown(exportEntries, settings.displayName)');
    expect(settingsPage).toContain('aboutRowBody(row, settings.displayName)');
    expect(settingsPage).toContain('}), [matcher, settings.displayName]);');
    expect(changelogMarkdown(CHANGELOG_ENTRIES.slice(0, 1), 'My Store')).toContain('# My Store changelog');
  });

  it('searches the About Version card by its configured display name', () => {
    expect(aboutRowBody({ en: 'Version', body: 'Ding Ding App Store preview 0.1.0.' }, 'My Store')).toBe('My Store preview 0.1.0.');
    expect(aboutRowBody({ en: 'Licence', body: 'Apache-2.0.' }, 'My Store')).toBe('Apache-2.0.');
  });

  it('routes settings and palette colour controls through the continuous translator', async () => {
    const [settingsPage, palette, control, appearancePanel, scheduleEditor, settingsService, contracts] = await Promise.all([
      read('src/renderer/pages/SettingsPage.tsx'),
      read('src/renderer/components/CommandPalette.tsx'),
      read('src/renderer/components/ColorTranslatorControl.tsx'),
      read('src/renderer/components/AppearancePanel.tsx'),
      read('src/renderer/pages/ScheduleEditor.tsx'),
      read('src/main/settings-service.ts'),
      read('src/shared/contracts.ts'),
    ]);
    expect(settingsPage).toContain("import { ColorTranslatorControl } from '../components/ColorTranslatorControl';");
    expect(settingsPage).toContain('id={id}');
    expect(settingsPage).not.toContain('type="color"');
    expect(palette).toContain('<ColorTranslatorControl');
    expect(palette).not.toContain('command-inline-control command-inline-color');
    expect(appearancePanel).toContain('<ColorTranslatorControl');
    expect(appearancePanel).not.toContain('type="color"');
    expect(scheduleEditor).toContain('<ColorTranslatorControl');
    expect(scheduleEditor).not.toContain('type="color"');
    expect(control).toContain('COLOR_SPACES');
    expect(control).toContain('HEX / HEX8');
    expect(control).toContain('Alpha');
    expect(settingsService).toContain('(?:[0-9a-fA-F]{2})?');
    expect(contracts).toContain('(?:[0-9a-fA-F]{2})?$/).optional()');
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

  it('provides a bounded month-jump calendar with two-click range selection', () => {
    const days = changelogCalendarDays('2026-02');
    expect(days).toHaveLength(42);
    expect(days.some((day) => day.getFullYear() === 2026 && day.getMonth() === 1 && day.getDate() === 1)).toBe(true);
    expect(changelogCalendarDays('not-a-month')).toEqual([]);
    expect(chooseChangelogDate('', '', '2026-02-03')).toEqual({ start: '2026-02-03', end: '' });
    expect(chooseChangelogDate('2026-02-03', '', '2026-02-01')).toEqual({ start: '2026-02-01', end: '2026-02-03' });
    expect(chooseChangelogDate('2026-02-03', '', '2026-02-07')).toEqual({ start: '2026-02-03', end: '2026-02-07' });
    expect(chooseChangelogDate('2026-02-03', '2026-02-07', '2026-02-10')).toEqual({ start: '2026-02-10', end: '' });
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

  it('keeps typed recovery evidence but never runtime callbacks or private fields in notification history exports', () => {
    const raw = {
      id: 'n-recovery', title: 'Catalog unavailable', message: 'Timed out.', ok: false,
      createdAt: '2026-08-08T12:00:00.000Z', dismissedAt: null,
      recovery: { kind: 'retry-catalog-refresh', run: () => 'must not persist' },
      privateToken: 'must not export',
    };
    const [record] = parseNotificationRecords(JSON.stringify([raw]));
    expect(record.recovery).toEqual({ kind: 'retry-catalog-refresh' });
    const exported = exportNotificationRecords([{ ...record, runtimeOnly: 'must not export' } as NotificationRecord]);
    expect(JSON.parse(exported).notifications[0].recovery).toEqual({ kind: 'retry-catalog-refresh' });
    expect(exported).not.toContain('run');
    expect(exported).not.toContain('privateToken');
    expect(exported).not.toContain('runtimeOnly');
    expect(parseNotificationRecords(JSON.stringify([{ ...raw, recovery: { kind: 'retry-everything' } }]))[0]?.recovery).toBeUndefined();
  });

  it('exports exactly the selected activity records in every truthful durable format', () => {
    const entry: HistoryEntry = { id: 'op1', appId: 'desktop-material', displayName: 'Desktop Material', kind: 'install', ok: false, message: 'Installer said "no".', occurredAt: '2026-08-07T12:00:00.000Z' };
    expect(JSON.parse(exportHistoryEntries([entry], 'json'))).toEqual([entry]);
    expect(exportHistoryEntries([entry], 'jsonl')).toContain('"appId":"desktop-material"');
    expect(exportHistoryEntries([entry], 'csv')).toContain('"Installer said ""no""."');
    expect(exportHistoryEntries([entry], 'markdown')).toContain('## Desktop Material — install');
    expect(HISTORY_EXPORT_FORMATS).toHaveLength(18);
    for (const format of HISTORY_EXPORT_FORMATS) {
      if (format.id === 'zip') {
        expect(() => exportHistoryEntries([entry], format.id)).toThrow(/typed main-process archive bridge/);
      } else {
        const content = exportHistoryEntries([entry], format.id);
        if (format.id !== 'json-schema' && format.id !== 'protobuf') expect(content).toContain('desktop-material');
        expect(content).not.toContain('\r\n');
      }
      expect(historyExportFormat(format.id)).toMatchObject({ encoding: 'UTF-8', lineEndings: 'LF' });
    }
    expect(exportHistoryEntries([entry], 'json-schema')).toContain('HistoryEntry');
    expect(exportHistoryEntries([entry], 'protobuf')).toContain('message HistoryEntry');
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
    expect(notifications).toContain('No safe recovery action is available for this failure.');
    expect(notifications).toContain('exportNotificationRecords');
    expect(notifications).toContain('if (deleteButtonRef.current && !deleteButtonRef.current.disabled)');
    expect(notifications).toContain('SearchBox surface="notifications"');
    expect(changelog).toContain('SearchBox surface="changelog"');
    expect(changelog).toContain('changelogCalendarDays(calendarMonth)');
    expect(changelog).toContain('type="month"');
    expect(changelog).toContain('chooseChangelogDate(start, end, picked)');
    expect(editor).toContain("reason: 'bridge-unavailable'");
    expect(editor).toContain('openArchiveInVsCode');
    expect(activity).toContain('openArchiveInVsCode');
    expect(activity).not.toContain('VS Code unavailable for ZIP');
    expect(app).toContain("case 'export-tabs'");
    expect(app).toContain("case 'export-appearance'");
    expect(app).toContain("case 'open-tabs-in-code'");
    expect(app).toContain("case 'open-appearance-in-code'");
    expect(contracts).toContain('externalEditor?:');
    const evaluator = await read('src/renderer/regex-evaluator.ts');
    const worker = await read('src/renderer/regex-worker.ts');
    expect(regex).toContain('evaluateRegexInWorker');
    expect(evaluator).toContain("new Worker(new URL('./regex-worker.ts'");
    expect(evaluator).toContain('worker?.terminate()');
    expect(evaluator).toContain('REGEX_WORKER_TIMEOUT_MS');
    expect(worker).toContain('normalizeRegexWorkerRequest');
    expect(worker).toContain('newestRequestId');
  });

  it('keeps NotificationCenter bulk recovery truthful and callback-free', async () => {
    const notifications = await read('src/renderer/components/NotificationCenter.tsx');
    expect(notifications).toContain('Recovery details');
    expect(notifications).toContain('const selectedRecovery = selectedShown.filter((record) => record.recovery);');
    expect(notifications).toContain('no callback or operation ID');
    expect(notifications).toContain('Reopen the originating surface');
    expect(notifications).not.toContain('record.recovery.run');
    expect(notifications).not.toContain('retry selected');
  });

  it('routes every Activity control and state label through the persisted language mode', async () => {
    const activity = await read('src/renderer/pages/ActivityPage.tsx');
    expect(activity).toContain("placeholder={label(settings, 'Search activity by app, action, or message'");
    expect(activity).toContain("label(settings, 'Filter by result', '按結果篩選')");
    expect(activity).toContain("label(settings, 'Filter by date', '按日期篩選')");
    expect(activity).toContain("label(settings, 'Select all shown', '揀晒目前顯示')");
    expect(activity).toContain("label(settings, 'Open in VS Code', '喺 VS Code 開')");
    expect(activity).toContain("actionLabel(entry.kind)");
    expect(activity).not.toContain('placeholder="Search activity by app, action, or message"');
    expect(activity).not.toContain('aria-label="Filter by result"');
    expect(activity).not.toContain('aria-label="Filter by date"');
    expect(activity).not.toContain('>No matching activity<');
  });

  it('keeps generated documentation checks stable across Windows checkout line endings', async () => {
    const generator = await read('scripts/docs-generate.mjs');
    expect(generator).toContain("const normalizeNewlines = (value) => value?.replaceAll('\\r\\n', '\\n')");
    expect(generator).toContain('normalizeNewlines(actual) !== normalizeNewlines(content)');
  });
});
