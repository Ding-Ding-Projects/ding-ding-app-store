import { createWriteStream, type WriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import yauzl, { type Entry, type ZipFile } from 'yauzl';

export const MAX_ARCHIVE_ENTRIES = 50_000;
export const MAX_EXTRACTED_BYTES = 3_000_000_000;

export function validateArchiveEntryName(name: string): string {
  if (!name || name.length > 2_048 || name.includes('\0') || name.includes('\\')) {
    throw new Error('Portable archive contains an invalid entry name.');
  }
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) throw new Error(`Portable archive entry is absolute: ${name}`);
  const rawSegments = name.replace(/\/$/, '').split('/');
  for (const segment of rawSegments) {
    if (!segment || segment === '.' || segment === '..') throw new Error(`Portable archive entry contains an unsafe segment: ${name}`);
    if (/[<>:"|?*\u0000-\u001f]/.test(segment) || /[ .]$/.test(segment)) {
      throw new Error(`Portable archive entry is not a safe Windows filename: ${name}`);
    }
    const stem = segment.split('.')[0].toLocaleUpperCase();
    if (/^(?:CON|PRN|AUX|NUL|CONIN\$|CONOUT\$|COM(?:[1-9]|[¹²³])|LPT(?:[1-9]|[¹²³]))$/.test(stem)) {
      throw new Error(`Portable archive entry uses a reserved Windows name: ${name}`);
    }
  }
  const normalized = path.posix.normalize(name);
  if (normalized === '..' || normalized.startsWith('../') || normalized.split('/').includes('..')) {
    throw new Error(`Portable archive entry escapes its destination: ${name}`);
  }
  return normalized.replace(/\/$/, '');
}

function entryKind(entry: Entry): 'file' | 'directory' {
  const unixMode = (entry.externalFileAttributes >>> 16) & 0xffff;
  const unixType = unixMode & 0o170000;
  if (unixType === 0o120000) throw new Error(`Portable archive contains a symbolic link: ${entry.fileName}`);
  if (entry.fileName.endsWith('/') || unixType === 0o040000) return 'directory';
  if (unixType !== 0 && unixType !== 0o100000) throw new Error(`Portable archive contains a special file: ${entry.fileName}`);
  return 'file';
}

function openArchive(archivePath: string): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(archivePath, { lazyEntries: true, autoClose: true, validateEntrySizes: true }, (error, zip) => {
      if (error || !zip) reject(error ?? new Error('Portable archive could not be opened.'));
      else resolve(zip);
    });
  });
}

function openEntry(zip: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error || !stream) reject(error ?? new Error(`Portable archive entry could not be opened: ${entry.fileName}`));
      else resolve(stream);
    });
  });
}

export async function extractZipSafe(archivePath: string, destinationRoot: string, signal?: AbortSignal): Promise<{ entries: number; bytes: number }> {
  if (signal?.aborted) throw new Error('Installation cancelled before archive extraction.');
  const root = path.resolve(destinationRoot);
  await mkdir(root, { recursive: true });
  const zip = await openArchive(archivePath);
  let entries = 0;
  let extractedBytes = 0;
  const seenNames = new Set<string>();

  return await new Promise((resolve, reject) => {
    let settled = false;
    let settling = false;
    let activeTask: Promise<void> | null = null;
    let activeSource: Readable | null = null;
    let activeOutput: WriteStream | null = null;
    const fail = (error: unknown) => {
      if (settled || settling) return;
      settling = true;
      signal?.removeEventListener('abort', abort);
      zip.close();
      const failure = error instanceof Error ? error : new Error(String(error));
      activeSource?.destroy(failure);
      activeOutput?.destroy(failure);
      const pending = activeTask;
      void (pending ?? Promise.resolve()).catch(() => undefined).finally(() => {
        if (settled) return;
        settled = true;
        reject(failure);
      });
    };
    const abort = () => fail(new Error('Installation cancelled during archive extraction.'));

    zip.once('error', fail);
    signal?.addEventListener('abort', abort, { once: true });
    zip.once('end', () => {
      if (!settled) {
        settled = true;
        signal?.removeEventListener('abort', abort);
        resolve({ entries, bytes: extractedBytes });
      }
    });
    zip.on('entry', (entry) => {
      const task = (async () => {
        if (signal?.aborted) throw new Error('Installation cancelled during archive extraction.');
        entries += 1;
        if (entries > MAX_ARCHIVE_ENTRIES) throw new Error(`Portable archive exceeds ${MAX_ARCHIVE_ENTRIES} entries.`);
        const relative = validateArchiveEntryName(entry.fileName);
        if (!relative) {
          zip.readEntry();
          return;
        }
        const collisionKey = relative.normalize('NFKC').toLocaleLowerCase();
        if (seenNames.has(collisionKey)) throw new Error(`Portable archive contains a duplicate Windows path: ${entry.fileName}`);
        seenNames.add(collisionKey);
        const target = path.resolve(root, ...relative.split('/'));
        if (target !== root && !target.startsWith(`${root}${path.sep}`)) throw new Error(`Portable archive entry escaped its destination: ${entry.fileName}`);
        const kind = entryKind(entry);
        if (kind === 'directory') {
          await mkdir(target, { recursive: true });
          zip.readEntry();
          return;
        }
        if (entry.uncompressedSize < 0 || entry.uncompressedSize > MAX_EXTRACTED_BYTES - extractedBytes) {
          throw new Error('Portable archive exceeds the extracted-size safety limit.');
        }
        await mkdir(path.dirname(target), { recursive: true });
        const source = await openEntry(zip, entry) as Readable;
        activeSource = source;
        let entryBytes = 0;
        const limiter = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            if (signal?.aborted) {
              callback(new Error('Installation cancelled during archive extraction.'));
              return;
            }
            entryBytes += chunk.byteLength;
            extractedBytes += chunk.byteLength;
            if (entryBytes > entry.uncompressedSize || extractedBytes > MAX_EXTRACTED_BYTES) {
              callback(new Error('Portable archive expanded beyond its declared size.'));
            } else callback(null, chunk);
          },
        });
        const output = createWriteStream(target, { flags: 'wx', mode: 0o600 });
        activeOutput = output;
        await pipeline(source, limiter, output);
        activeSource = null;
        activeOutput = null;
        if (entryBytes !== entry.uncompressedSize) throw new Error(`Portable archive size mismatch for ${entry.fileName}.`);
        zip.readEntry();
      })();
      activeTask = task;
      void task.then(() => { activeTask = null; }).catch(fail);
    });
    zip.readEntry();
  });
}
