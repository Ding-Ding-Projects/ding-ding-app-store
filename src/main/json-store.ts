import { randomUUID } from 'node:crypto';
import { renameSync } from 'node:fs';
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';

export interface AtomicJsonWriteOptions {
  renameFile?: typeof rename;
  unlinkFile?: typeof unlink;
  wait?: (milliseconds: number) => Promise<void>;
  retryDelaysMs?: readonly number[];
  shouldPublish?: () => boolean;
}

const DEFAULT_RENAME_RETRY_DELAYS_MS = [10, 25, 50, 100] as const;
const TRANSIENT_WINDOWS_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(filePath, 'utf8')) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return fallback;
    throw error;
  }
}

export async function writeJsonAtomic(filePath: string, value: unknown, options: AtomicJsonWriteOptions = {}): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  const renameFile = options.renameFile;
  const unlinkFile = options.unlinkFile ?? unlink;
  const wait = options.wait ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RENAME_RETRY_DELAYS_MS;
  let handle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    handle = await open(temporary, 'wx', 0o600);
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    for (let attempt = 0;; attempt += 1) {
      try {
        if (options.shouldPublish && !options.shouldPublish()) {
          const cancelled = new Error('Atomic publication cancelled.') as NodeJS.ErrnoException;
          cancelled.code = 'ECANCELED';
          throw cancelled;
        }
        // The production path uses a synchronous rename so the publication
        // check and replacement cannot be interleaved with dispose() on the
        // event loop. Tests may inject an async rename to exercise retries.
        if (renameFile) await renameFile(temporary, filePath);
        else renameSync(temporary, filePath);
        break;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (!code || !TRANSIENT_WINDOWS_RENAME_CODES.has(code) || attempt >= retryDelaysMs.length) throw error;
        await wait(retryDelaysMs[attempt]);
      }
    }
  } catch (error) {
    if (handle) await handle.close().catch(() => undefined);
    // The existing target is never unlinked. Failed publication removes only
    // this writer's unique temporary candidate, preserving the last record.
    await unlinkFile(temporary).catch(() => undefined);
    throw error;
  }
}

