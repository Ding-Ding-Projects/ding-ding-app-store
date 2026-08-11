import type { HistoryExportFormat, HistoryRevision } from '../shared/contracts';

/** The revision browser deliberately exports metadata only; snapshot bytes never cross this boundary. */
export const HISTORY_REVISION_EXPORT_FORMATS = ['json', 'markdown'] as const satisfies readonly HistoryExportFormat[];
export type HistoryRevisionExportFormat = (typeof HISTORY_REVISION_EXPORT_FORMATS)[number];

export interface HistoryRevisionExportDocument {
  schemaVersion: 1;
  kind: 'history-revisions';
  encoding: 'UTF-8';
  lineEndings: 'LF';
  omittedFields: readonly ['snapshotBytes', 'credentials', 'secrets'];
  records: Array<{
    id: string;
    occurredAt: string;
    subject: string;
    label: string;
    changedFiles: string[];
    restorable: boolean;
  }>;
}

export function historyRevisionExportDocument(revisions: readonly HistoryRevision[]): HistoryRevisionExportDocument {
  return {
    schemaVersion: 1,
    kind: 'history-revisions',
    encoding: 'UTF-8',
    lineEndings: 'LF',
    omittedFields: ['snapshotBytes', 'credentials', 'secrets'],
    records: revisions.map(({ id, occurredAt, subject, label, changedFiles, restorable }) => ({
      id,
      occurredAt,
      subject,
      label,
      changedFiles: [...changedFiles],
      restorable,
    })),
  };
}

function markdownCell(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('|', '\\|').replace(/[\r\n]+/g, ' ');
}

export function exportHistoryRevisions(revisions: readonly HistoryRevision[], format: HistoryRevisionExportFormat): string {
  const document = historyRevisionExportDocument(revisions);
  if (format === 'json') return `${JSON.stringify(document, null, 2)}\n`;
  const lines = [
    '# Ding Ding App Store local versions',
    '',
    'Schema: `ding-ding-app-store.history-revisions.v1` · UTF-8 · LF',
    '',
    'Omitted fields: `snapshotBytes`, `credentials`, `secrets`.',
    '',
    '| Revision | Occurred at | Subject | Label | Changed files | Restorable |',
    '| --- | --- | --- | --- | --- | --- |',
    ...document.records.map((record) => `| ${markdownCell(record.id)} | ${markdownCell(record.occurredAt)} | ${markdownCell(record.subject)} | ${markdownCell(record.label)} | ${markdownCell(record.changedFiles.join(', ') || 'none')} | ${record.restorable ? 'yes' : 'no'} |`),
    '',
  ];
  return lines.join('\n');
}
