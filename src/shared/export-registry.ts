import type { HistoryEntry, HistoryExportFormat } from './contracts.js';

/** One truthful export contract for flat, non-secret application records. */
export type ExportScalar = string | number | boolean | null;
export type FlatExportRecord = Readonly<Record<string, ExportScalar>>;

export interface ExportFormatDefinition {
  readonly id: HistoryExportFormat;
  readonly label: string;
  readonly extension: string;
  readonly mime: string;
  readonly encoding: 'UTF-8';
  readonly lineEndings: 'LF';
  readonly schema: string;
}

export const HISTORY_EXPORT_FORMATS: readonly ExportFormatDefinition[] = Object.freeze([
  { id: 'json', label: 'JSON', extension: 'json', mime: 'application/json', encoding: 'UTF-8', lineEndings: 'LF', schema: 'ding-ding-app-store.history.v1' },
  { id: 'jsonl', label: 'JSON Lines', extension: 'jsonl', mime: 'application/x-ndjson', encoding: 'UTF-8', lineEndings: 'LF', schema: 'one HistoryEntry JSON object per line' },
  { id: 'yaml', label: 'YAML', extension: 'yaml', mime: 'application/yaml', encoding: 'UTF-8', lineEndings: 'LF', schema: 'ding-ding-app-store.history.v1' },
  { id: 'toml', label: 'TOML', extension: 'toml', mime: 'application/toml', encoding: 'UTF-8', lineEndings: 'LF', schema: 'ding-ding-app-store.history.v1' },
  { id: 'xml', label: 'XML', extension: 'xml', mime: 'application/xml', encoding: 'UTF-8', lineEndings: 'LF', schema: 'ding-ding-app-store.history.v1' },
  { id: 'csv', label: 'CSV', extension: 'csv', mime: 'text/csv', encoding: 'UTF-8', lineEndings: 'LF', schema: 'HistoryEntry fields in header order' },
  { id: 'tsv', label: 'TSV', extension: 'tsv', mime: 'text/tab-separated-values', encoding: 'UTF-8', lineEndings: 'LF', schema: 'HistoryEntry fields in header order' },
  { id: 'markdown', label: 'Markdown', extension: 'md', mime: 'text/markdown', encoding: 'UTF-8', lineEndings: 'LF', schema: 'full HistoryEntry field list' },
  { id: 'html', label: 'HTML', extension: 'html', mime: 'text/html', encoding: 'UTF-8', lineEndings: 'LF', schema: 'HistoryEntry HTML table' },
  { id: 'sql', label: 'SQL', extension: 'sql', mime: 'application/sql', encoding: 'UTF-8', lineEndings: 'LF', schema: 'SQLite-compatible history_entries INSERT statements' },
  { id: 'typescript', label: 'TypeScript', extension: 'ts', mime: 'text/x-typescript', encoding: 'UTF-8', lineEndings: 'LF', schema: 'readonly HistoryEntry data module' },
  { id: 'javascript', label: 'JavaScript', extension: 'js', mime: 'text/javascript', encoding: 'UTF-8', lineEndings: 'LF', schema: 'ES module HistoryEntry data' },
  { id: 'python', label: 'Python', extension: 'py', mime: 'text/x-python', encoding: 'UTF-8', lineEndings: 'LF', schema: 'Python data module using stdlib json' },
  { id: 'go', label: 'Go', extension: 'go', mime: 'text/x-go', encoding: 'UTF-8', lineEndings: 'LF', schema: 'Go source with embedded HistoryEntry JSON' },
  { id: 'rust', label: 'Rust', extension: 'rs', mime: 'text/x-rustsrc', encoding: 'UTF-8', lineEndings: 'LF', schema: 'Rust source with embedded HistoryEntry JSON' },
  { id: 'json-schema', label: 'JSON Schema', extension: 'schema.json', mime: 'application/schema+json', encoding: 'UTF-8', lineEndings: 'LF', schema: 'draft 2020-12 HistoryEntry schema' },
  { id: 'protobuf', label: 'Protocol Buffers', extension: 'proto', mime: 'text/x-protobuf', encoding: 'UTF-8', lineEndings: 'LF', schema: 'proto3 HistoryEntry message' },
]);

export function historyExportFormat(format: HistoryExportFormat): ExportFormatDefinition {
  const definition = HISTORY_EXPORT_FORMATS.find((candidate) => candidate.id === format);
  if (!definition) throw new Error(`Unsupported history export format: ${format}`);
  return definition;
}

function fields(records: readonly FlatExportRecord[]): string[] { return [...new Set(records.flatMap((record) => Object.keys(record)))].sort(); }
function scalar(value: ExportScalar): string { return JSON.stringify(value); }
function cell(value: ExportScalar, separator: ',' | '\t'): string {
  const text = value === null ? 'null' : String(value);
  return text.includes(separator) || /["\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
function escapeXml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }
function escapeSql(value: string): string { return `'${value.replaceAll("'", "''")}'`; }
function escapeMarkdown(value: string): string { return value.replaceAll('|', '\\|').replaceAll('\n', '<br>'); }

function delimited(records: readonly FlatExportRecord[], separator: ',' | '\t'): string {
  const names = fields(records);
  return [names.join(separator), ...records.map((record) => names.map((name) => cell(record[name] ?? null, separator)).join(separator)), ''].join('\n');
}
function yaml(records: readonly FlatExportRecord[]): string {
  const names = fields(records);
  return ['# ding-ding-app-store.history.v1', ...records.flatMap((record) => ['- ' + names.map((name, index) => `${index ? '  ' : ''}${name}: ${scalar(record[name] ?? null)}`).join('\n')]), ''].join('\n');
}
function toml(records: readonly FlatExportRecord[]): string {
  const names = fields(records);
  return ['schema_version = 1', ...records.flatMap((record) => ['[[history_entries]]', ...names.map((name) => `${name} = ${scalar(record[name] ?? null)}`), '']), ''].join('\n');
}
function xmlDocument(records: readonly FlatExportRecord[]): string {
  const names = fields(records);
  return ['<?xml version="1.0" encoding="UTF-8"?>', '<historyEntries schemaVersion="1">', ...records.flatMap((record) => ['  <entry>', ...names.map((name) => `    <field name="${escapeXml(name)}" type="json">${escapeXml(scalar(record[name] ?? null))}</field>`), '  </entry>']), '</historyEntries>', ''].join('\n');
}
function markdownDocument(records: readonly FlatExportRecord[]): string {
  const names = fields(records);
  return ['# Ding Ding App Store activity', '', 'Schema: `ding-ding-app-store.history.v1` · UTF-8 · LF', '', ...records.flatMap((record) => [`## ${String(record.displayName ?? 'Unknown app')} — ${String(record.kind ?? 'unknown')}`, '', ...names.map((name) => `- ${name}: ${escapeMarkdown(scalar(record[name] ?? null))}`), '']), ''].join('\n');
}
function htmlDocument(records: readonly FlatExportRecord[]): string {
  const names = fields(records);
  return ['<!doctype html>', '<html lang="en"><meta charset="utf-8"><title>Ding Ding App Store activity</title>', '<table><caption>ding-ding-app-store.history.v1 · UTF-8 · LF</caption><thead><tr>', ...names.map((name) => `<th>${escapeXml(name)}</th>`), '</tr></thead><tbody>', ...records.map((record) => `<tr>${names.map((name) => `<td>${escapeXml(scalar(record[name] ?? null))}</td>`).join('')}</tr>`), '</tbody></table></html>', ''].join('\n');
}
function sqlDocument(records: readonly FlatExportRecord[]): string {
  const names = fields(records);
  const quoteIdentifier = (name: string) => `"${name.replaceAll('"', '""')}"`;
  return ['-- ding-ding-app-store.history.v1; UTF-8; LF', 'BEGIN;', `CREATE TABLE IF NOT EXISTS history_entries (${names.map((name) => `${quoteIdentifier(name)} TEXT`).join(', ')});`, ...records.map((record) => `INSERT INTO history_entries (${names.map(quoteIdentifier).join(', ')}) VALUES (${names.map((name) => record[name] === null || record[name] === undefined ? 'NULL' : escapeSql(scalar(record[name] ?? null))).join(', ')});`), 'COMMIT;', ''].join('\n');
}
function codeDocument(records: readonly FlatExportRecord[], format: HistoryExportFormat): string {
  const payload = JSON.stringify(records, null, 2);
  if (format === 'typescript') return `/** ding-ding-app-store.history.v1; UTF-8; LF */\nexport const historyEntries = ${payload} as const;\n`;
  if (format === 'javascript') return `/** ding-ding-app-store.history.v1; UTF-8; LF */\nexport const historyEntries = ${payload};\n`;
  if (format === 'python') return `# ding-ding-app-store.history.v1; UTF-8; LF\nimport json\n\nhistory_entries = json.loads(r'''${payload}''')\n`;
  if (format === 'go') return `// ding-ding-app-store.history.v1; UTF-8; LF\npackage historyexport\n\nconst HistoryEntriesJSON = \`${payload.replaceAll('`', '` + "`" + `')}\`\n`;
  return `// ding-ding-app-store.history.v1; UTF-8; LF\npub const HISTORY_ENTRIES_JSON: &str = r###"${payload}"###;\n`;
}

const HISTORY_ENTRY_SCHEMA = Object.freeze({
  $schema: 'https://json-schema.org/draft/2020-12/schema', $id: 'https://ding-ding-projects.github.io/ding-ding-app-store/schemas/history-entry.v1.json', title: 'Ding Ding App Store HistoryEntry', type: 'object', additionalProperties: false,
  required: ['id', 'appId', 'displayName', 'kind', 'ok', 'message', 'occurredAt'],
  properties: { id: { type: 'string' }, appId: { type: 'string' }, displayName: { type: 'string' }, kind: { enum: ['install', 'build', 'uninstall', 'update'] }, ok: { type: 'boolean' }, message: { type: 'string' }, occurredAt: { type: 'string', format: 'date-time' } },
});
const HISTORY_ENTRY_PROTO = '// ding-ding-app-store.history.v1; UTF-8; LF\nsyntax = "proto3";\npackage dingding.appstore.history.v1;\n\nmessage HistoryEntry {\n  string id = 1;\n  string app_id = 2;\n  string display_name = 3;\n  string kind = 4;\n  bool ok = 5;\n  string message = 6;\n  string occurred_at = 7;\n}\n';

export function serializeFlatRecords(records: readonly FlatExportRecord[], format: HistoryExportFormat): string {
  switch (format) {
    case 'json': return `${JSON.stringify(records, null, 2)}\n`;
    case 'jsonl': return `${records.map((record) => JSON.stringify(record)).join('\n')}\n`;
    case 'yaml': return yaml(records);
    case 'toml': return toml(records);
    case 'xml': return xmlDocument(records);
    case 'csv': return delimited(records, ',');
    case 'tsv': return delimited(records, '\t');
    case 'markdown': return markdownDocument(records);
    case 'html': return htmlDocument(records);
    case 'sql': return sqlDocument(records);
    case 'typescript': case 'javascript': case 'python': case 'go': case 'rust': return codeDocument(records, format);
    case 'json-schema': return `${JSON.stringify(HISTORY_ENTRY_SCHEMA, null, 2)}\n`;
    case 'protobuf': return HISTORY_ENTRY_PROTO;
  }
}

export function serializeHistoryEntries(entries: readonly HistoryEntry[], format: HistoryExportFormat): string {
  return serializeFlatRecords(entries.map((entry) => ({ ...entry })), format);
}

/** JSON remains the only re-importable format for nested settings/layout documents. */
export function serializeStructuredExport(document: Readonly<Record<string, unknown>>): string {
  return `${JSON.stringify({ ...document, encoding: 'UTF-8', lineEndings: 'LF' }, null, 2)}\n`;
}
