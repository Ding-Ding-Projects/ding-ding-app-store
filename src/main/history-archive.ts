import { createHash } from 'node:crypto';
import { ZipFile } from 'yazl';
import { z } from 'zod';
import type { HistoryArchiveExport, HistoryEntry } from '../shared/contracts.js';
import { serializeHistoryEntries } from '../shared/export-registry.js';

/** The archive is an export of records, never an arbitrary filesystem bundle. */
export const MAX_HISTORY_ARCHIVE_BYTES = 16 * 1024 * 1024;
const MAX_HISTORY_ARCHIVE_RECORDS = 10_000;
const MAX_HISTORY_ENTRY_MESSAGE = 20_000;
const ARCHIVE_SCHEMA = 'ding-ding-app-store.history-archive.v1' as const;

const archiveHistoryEntrySchema = z.strictObject({
  id: z.string().uuid(),
  appId: z.string().min(1).max(200).refine((value) => value.trim().length > 0, 'Application identifier cannot be blank.'),
  displayName: z.string().min(1).max(200).refine((value) => value.trim().length > 0, 'Display name cannot be blank.'),
  kind: z.enum(['install', 'build', 'uninstall', 'launch', 'update', 'settings']),
  ok: z.boolean(),
  message: z.string().max(MAX_HISTORY_ENTRY_MESSAGE),
  messageYue: z.string().max(MAX_HISTORY_ENTRY_MESSAGE).optional(),
  occurredAt: z.iso.datetime(),
});

const ARCHIVE_FIELDS = ['id', 'appId', 'displayName', 'kind', 'ok', 'message', 'messageYue', 'occurredAt'] as const;

interface ArchiveFile {
  path: 'manifest.json' | 'history.jsonl' | 'history.json' | 'README.txt';
  content: Buffer;
  mediaType: string;
}

function sha256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

function zipBuffers(files: readonly ArchiveFile[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const zip = new ZipFile();
    const chunks: Buffer[] = [];
    let total = 0;
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error('The history archive could not be written.'));
    };
    zip.outputStream.on('data', (chunk: Buffer) => {
      if (settled) return;
      total += chunk.length;
      if (total > MAX_HISTORY_ARCHIVE_BYTES) {
        fail(new Error(`The history archive exceeds the ${MAX_HISTORY_ARCHIVE_BYTES.toLocaleString()} byte limit.`));
        return;
      }
      chunks.push(chunk);
    });
    zip.outputStream.once('error', fail);
    zip.outputStream.once('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, total));
    });
    for (const file of files) zip.addBuffer(file.content, file.path);
    zip.end();
  });
}

/**
 * Creates a bounded, self-describing ZIP containing only Activity records.
 * Every member name is a fixed relative path; no renderer-provided path enters
 * the archive. JSON Lines is the durable re-import route, while JSON is a
 * convenient complete snapshot for tools that prefer one document.
 */
export async function createHistoryArchive(entries: readonly HistoryEntry[], exportedAt = new Date().toISOString()): Promise<HistoryArchiveExport> {
  if (entries.length < 1 || entries.length > MAX_HISTORY_ARCHIVE_RECORDS) throw new Error(`A history archive must contain 1-${MAX_HISTORY_ARCHIVE_RECORDS.toLocaleString()} records.`);
  if (!z.iso.datetime().safeParse(exportedAt).success) throw new Error('The history archive timestamp was invalid.');
  const parsed = z.array(archiveHistoryEntrySchema).length(entries.length).safeParse(entries);
  if (!parsed.success) throw new Error('The history archive contains an invalid or oversized Activity record.');
  const safeEntries = parsed.data as HistoryEntry[];
  if (new Set(safeEntries.map((entry) => entry.id)).size !== safeEntries.length) throw new Error('The history archive contains duplicate Activity record IDs.');
  const jsonl = Buffer.from(serializeHistoryEntries(safeEntries, 'jsonl'), 'utf8');
  const json = Buffer.from(serializeHistoryEntries(safeEntries, 'json'), 'utf8');
  const readme = Buffer.from([
    'Ding Ding App Store Activity archive',
    '',
    `Schema: ${ARCHIVE_SCHEMA}`,
    'Encoding: UTF-8',
    'Line endings: LF',
    `Records: ${safeEntries.length}`,
    '',
    'Re-import: parse history.jsonl as one complete HistoryEntry JSON object per line.',
    'This archive contains Activity records only; it never includes credentials, tokens, user files, or arbitrary paths.',
    '',
  ].join('\n'), 'utf8');
  const dataFiles: ArchiveFile[] = [
    { path: 'history.jsonl', content: jsonl, mediaType: 'application/x-ndjson' },
    { path: 'history.json', content: json, mediaType: 'application/json' },
    { path: 'README.txt', content: readme, mediaType: 'text/plain' },
  ];
  const manifest = Buffer.from(`${JSON.stringify({
    schema: ARCHIVE_SCHEMA,
    schemaVersion: 1,
    exportedAt,
    encoding: 'UTF-8',
    lineEndings: 'LF',
    recordType: 'HistoryEntry',
    recordCount: safeEntries.length,
    fields: ARCHIVE_FIELDS,
    reimport: { format: 'jsonl', path: 'history.jsonl', oneObjectPerLine: true },
    files: dataFiles.map((file) => ({ path: file.path, mediaType: file.mediaType, bytes: file.content.length, sha256: sha256(file.content) })),
  }, null, 2)}\n`, 'utf8');
  const files: ArchiveFile[] = [{ path: 'manifest.json', content: manifest, mediaType: 'application/json' }, ...dataFiles];
  const estimatedBytes = files.reduce((sum, file) => sum + file.content.length, 0);
  if (estimatedBytes > MAX_HISTORY_ARCHIVE_BYTES) throw new Error(`The history archive input exceeds the ${MAX_HISTORY_ARCHIVE_BYTES.toLocaleString()} byte limit.`);
  const archive = await zipBuffers(files);
  return {
    filename: 'ding-ding-app-store-history.zip',
    mime: 'application/zip',
    encoding: 'UTF-8',
    lineEndings: 'LF',
    schema: ARCHIVE_SCHEMA,
    recordCount: safeEntries.length,
    base64: archive.toString('base64'),
  };
}
