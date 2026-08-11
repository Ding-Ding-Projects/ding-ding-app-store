import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import type { HistoryRevision, UserSettings } from '../src/shared/contracts';
import { exportHistoryRevisions, historyRevisionExportDocument } from '../src/renderer/history-revision-export';
import { filterHistoryRevisions, historyMutationMessage, invertRevisionSelection, selectRevisionRange } from '../src/renderer/history-revisions';
import { makeMatcher } from '../src/renderer/search';
import { resolveHistoryDateRange } from '../src/renderer/history-date-filter';

const read = (file: string) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

const revisions: HistoryRevision[] = [
  {
    id: 'a'.repeat(40),
    occurredAt: '2026-08-11T13:00:00.000Z',
    subject: 'settings: catalog',
    label: 'Morning | restore',
    changedFiles: ['state/settings.json', 'state/workspace.json'],
    restorable: true,
  },
  {
    id: 'b'.repeat(40),
    occurredAt: '2026-08-10T13:00:00.000Z',
    subject: 'update: material',
    label: 'Older\\snapshot',
    changedFiles: [],
    restorable: false,
  },
];

describe('Local versions revision parity', () => {
  it('exports bounded metadata with an explicit omission contract', () => {
    const document = historyRevisionExportDocument(revisions);
    expect(document).toMatchObject({ schemaVersion: 1, kind: 'history-revisions', encoding: 'UTF-8', lineEndings: 'LF', omittedFields: ['snapshotBytes', 'credentials', 'secrets'] });
    expect(document.records[0]).toEqual({ ...revisions[0] });
    const json = exportHistoryRevisions(revisions, 'json');
    expect(JSON.parse(json)).toEqual(document);
    expect(json).not.toContain('state/credential');
    expect(json).not.toContain('qrPayload');
    const polluted = { ...revisions[0], snapshotBytes: 'secret bytes', credentials: ['credential'], secrets: ['usable secret'] } as HistoryRevision & Record<string, unknown>;
    expect(historyRevisionExportDocument([polluted]).records[0]).not.toHaveProperty('snapshotBytes');
    expect(historyRevisionExportDocument([polluted]).records[0]).not.toHaveProperty('credentials');
    expect(historyRevisionExportDocument([polluted]).records[0]).not.toHaveProperty('secrets');
  });

  it('keeps Markdown cells faithful for pipes, backslashes, and empty file lists', () => {
    const markdown = exportHistoryRevisions(revisions, 'markdown');
    expect(markdown).toContain('Morning \\| restore');
    expect(markdown).toContain('Older\\\\snapshot');
    expect(markdown).toContain('state/settings.json, state/workspace.json');
    expect(markdown).toContain('| none | no |');
    expect(markdown).toContain('Omitted fields: `snapshotBytes`, `credentials`, `secrets`.');
  });

  it('filters by revision metadata and inclusive date range, then preserves range selection by ID', () => {
    const range = resolveHistoryDateRange('2026-08-10', '2026-08-11');
    const visible = filterHistoryRevisions(revisions, makeMatcher({ query: 'restore', regex: null }), range, 'en');
    expect(visible.map((revision) => revision.id)).toEqual(['a'.repeat(40)]);
    const rangeVisible = filterHistoryRevisions(revisions, makeMatcher({ query: '', regex: null }), range, 'en');
    const first = selectRevisionRange(rangeVisible, new Set(), 0, true, null);
    expect(first).toEqual(new Set(['a'.repeat(40)]));
    const second = selectRevisionRange(rangeVisible, first, 1, true, 'a'.repeat(40));
    expect(second).toEqual(new Set(['a'.repeat(40), 'b'.repeat(40)]));
    expect(invertRevisionSelection(rangeVisible, second)).toEqual(new Set());
  });

  it('localizes label and restore outcomes without dropping their factual detail', () => {
    const revision = revisions[0];
    const ok = { ok: true, message: 'Saved label.' };
    const failed = { ok: false, message: 'The local history repository is unavailable.' };
    const settings = (language: UserSettings['language']) => ({ language } as UserSettings);
    expect(historyMutationMessage(settings('en'), 'label', revision, 'Fresh label', ok)).toContain('Saved local version label');
    expect(historyMutationMessage(settings('yue'), 'restore', revision, revision.label, ok)).toContain('還原');
    expect(historyMutationMessage(settings('en'), 'restore', revision, revision.label, failed)).toContain('repository is unavailable');
    expect(historyMutationMessage(settings('yue'), 'label', revision, 'Fresh label', failed)).toContain('本機版本標籤儲存唔成功');
    expect(historyMutationMessage(settings('bilingual'), 'restore', revision, revision.label, failed)).toContain('The local version could not be restored. · 本機版本還原唔成功。');
  });

  it('wires the revision projection, range selection, and metadata-only controls', async () => {
    const activity = await read('src/renderer/pages/ActivityPage.tsx');
    const contracts = await read('src/shared/contracts.ts');
    const externalEditor = await read('src/renderer/history-revision-export.ts');
    expect(activity).toContain('const filteredRevisions = useMemo');
    expect(activity).toContain('selectRevisionAt');
    expect(activity).toContain('revision-bulk-toolbar');
    expect(activity).toContain('Select all shown');
    expect(activity).toContain('Invert shown');
    expect(activity).toContain('Export versions');
    expect(activity).toContain('Open versions in VS Code');
    expect(activity).toContain('const [revisionEditorBusy, setRevisionEditorBusy]');
    expect(activity).toContain('if (!revisionsToExport.length || revisionEditorBusy) return');
    expect(activity).toContain('disabled={revisionEditorBusy || !revisionsToExport.length');
    expect(activity).toContain('changedFiles.join');
    expect(activity).toContain('toLocaleString(settings.language === \'yue\' ? \'zh-HK\' : \'en-CA\')');
    expect(externalEditor).toContain("kind: 'history-revisions'");
    expect(contracts).toContain("'history-revisions'");
  });
});
