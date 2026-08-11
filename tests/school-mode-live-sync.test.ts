import { EventEmitter } from 'node:events';
import type { FSWatcher } from 'node:fs';
import { link, mkdtemp, open, readFile, readdir, readdir as readDirectory, rename, rm, unlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SchoolModeService } from '../src/main/school-mode-service';
import { writeJsonAtomic } from '../src/main/json-store';
import type { SchoolModeSnapshot } from '../src/shared/contracts';

const LIVE_OPTIONS = { watchDebounceMs: 5, pollIntervalMs: 25, lockRetryMs: 5, lockTimeoutMs: 500 } as const;

class FakeWatcher extends EventEmitter {
  closed = false;
  constructor(readonly listener: (eventType: string, filename: string | Buffer | null) => void) { super(); }
  close() { this.closed = true; }
}

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ding-ding-school-live-'));
  return { root, file: path.join(root, 'school-mode.v1.json') };
}

function expected(snapshot: SchoolModeSnapshot) {
  if (!snapshot.state) throw new Error('Expected a verified shared state.');
  return { expectedRecordId: snapshot.state.recordId, expectedRevision: snapshot.state.revision };
}

function nextSnapshot(service: SchoolModeService, predicate: (snapshot: SchoolModeSnapshot) => boolean, timeoutMs = 3_000): Promise<SchoolModeSnapshot> {
  return new Promise((resolve, reject) => {
    let unsubscribe = () => undefined;
    const timer = setTimeout(() => { unsubscribe(); reject(new Error('Timed out waiting for a shared-state observation.')); }, timeoutMs);
    unsubscribe = service.subscribe((snapshot) => {
      if (!predicate(snapshot)) return;
      clearTimeout(timer);
      unsubscribe();
      resolve(snapshot);
    });
  });
}

describe('School mode two-service Windows synchronization', () => {
  it('live-propagates enablement, rename, and credential-only revisions without restarting either service', async () => {
    const { root, file } = await fixture();
    const first = new SchoolModeService(file, LIVE_OPTIONS);
    const second = new SchoolModeService(file, LIVE_OPTIONS);
    try {
      const [firstInitial] = await Promise.all([first.start(), second.start()]);

      const configuredOnSecond = nextSnapshot(second, (snapshot) => snapshot.state?.revision === 1 && snapshot.state.displayName === 'Classroom');
      const configured = await first.configure({ ...expected(firstInitial), displayName: 'Classroom', unlockKind: 'password', credential: 'old password' });
      const secondRevision1 = await configuredOnSecond;
      expect(secondRevision1).toMatchObject({ state: { enabled: true, displayName: 'Classroom', revision: 1 }, sync: { status: 'ready', watching: true } });

      const renamedOnSecond = nextSnapshot(second, (snapshot) => snapshot.state?.revision === 2 && snapshot.state.displayName === 'Quiet class');
      const renamed = await first.rename({ ...expected(configured.snapshot), displayName: 'Quiet class', credential: 'old password' });
      const secondRevision2 = await renamedOnSecond;
      expect(secondRevision2.state).toMatchObject({ enabled: true, displayName: 'Quiet class', revision: 2 });

      const disabledOnFirst = nextSnapshot(first, (snapshot) => snapshot.state?.revision === 3 && snapshot.state.enabled === false);
      const disabled = await second.setEnabled({ ...expected(secondRevision2), enabled: false, credential: 'old password' });
      const firstRevision3 = await disabledOnFirst;
      expect(disabled.ok).toBe(true);
      expect(firstRevision3.state).toMatchObject({ enabled: false, displayName: 'Quiet class', revision: 3 });

      const credentialChangedOnSecond = nextSnapshot(second, (snapshot) => snapshot.state?.revision === 4);
      const rotated = await first.changeCredential({ ...expected(firstRevision3), currentCredential: 'old password', nextCredential: 'new password', unlockKind: 'password' });
      const secondRevision4 = await credentialChangedOnSecond;
      expect(rotated.ok).toBe(true);
      expect(secondRevision4.state).toMatchObject({ enabled: false, displayName: 'Quiet class', unlockKind: 'password', revision: 4 });
      expect(await second.verify({ credential: 'old password' })).toBe(false);
      expect(await second.verify({ credential: 'new password' })).toBe(true);
      expect(JSON.stringify(secondRevision4)).not.toMatch(/old password|new password|salt|verifier|digest/i);
      expect(renamed.ok).toBe(true);
    } finally {
      first.dispose(); second.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('serializes simultaneous stale mutations and preserves both changes after a conflict retry', async () => {
    const { root, file } = await fixture();
    const first = new SchoolModeService(file, LIVE_OPTIONS);
    const second = new SchoolModeService(file, LIVE_OPTIONS);
    try {
      const [initial] = await Promise.all([first.start(), second.start()]);
      const observed = nextSnapshot(second, (snapshot) => snapshot.state?.revision === 1);
      const configured = await first.configure({ ...expected(initial), displayName: 'Classroom', unlockKind: 'password', credential: 'shared password' });
      const secondBase = await observed;

      const [renameResult, disableResult] = await Promise.all([
        first.rename({ ...expected(configured.snapshot), displayName: 'Focus room', credential: 'shared password' }),
        second.setEnabled({ ...expected(secondBase), enabled: false, credential: 'shared password' }),
      ]);
      expect([renameResult.ok, disableResult.ok].filter(Boolean)).toHaveLength(1);
      expect([renameResult.snapshot.sync.status, disableResult.snapshot.sync.status]).toContain('unavailable');

      if (!renameResult.ok) {
        const latest = await first.load();
        expect((await first.rename({ ...expected(latest), displayName: 'Focus room', credential: 'shared password' })).ok).toBe(true);
      }
      if (!disableResult.ok) {
        const latest = await second.load();
        expect((await second.setEnabled({ ...expected(latest), enabled: false, credential: 'shared password' })).ok).toBe(true);
      }

      const final = await first.load();
      expect(final).toMatchObject({ state: { displayName: 'Focus room', enabled: false, revision: 3 }, sync: { status: 'ready' } });
    } finally {
      first.dispose(); second.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('uses recordId plus revision to reject delete-and-recreate ABA writes', async () => {
    const { root, file } = await fixture();
    const stale = new SchoolModeService(file, LIVE_OPTIONS);
    const replacement = new SchoolModeService(file, LIVE_OPTIONS);
    try {
      const initial = await stale.start();
      const original = await stale.configure({ ...expected(initial), displayName: 'Original', unlockKind: 'pin', credential: '1234' });
      const oldIdentity = expected(original.snapshot);
      await unlink(file);

      const reset = await replacement.start();
      expect(reset.state).toMatchObject({ recordId: null, revision: 0, enabled: false });
      const recreated = await replacement.configure({ ...expected(reset), displayName: 'Replacement', unlockKind: 'pin', credential: '5678' });
      expect(recreated.snapshot.state?.recordId).not.toBe(oldIdentity.expectedRecordId);
      expect(recreated.snapshot.state?.revision).toBe(1);

      const staleWrite = await stale.rename({ ...oldIdentity, displayName: 'Stale overwrite', credential: '1234' });
      expect(staleWrite).toMatchObject({ ok: false, snapshot: { state: { displayName: 'Replacement', revision: 1 }, sync: { status: 'unavailable', reason: 'conflict' } } });
      expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ displayName: 'Replacement', revision: 1 });
    } finally {
      stale.dispose(); replacement.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('retains the last verified state across malformed watch events and failed persistence', async () => {
    const { root, file } = await fixture();
    const writer = new SchoolModeService(file, LIVE_OPTIONS);
    const observer = new SchoolModeService(file, LIVE_OPTIONS);
    try {
      const [initial] = await Promise.all([writer.start(), observer.start()]);
      const observed = nextSnapshot(observer, (snapshot) => snapshot.state?.revision === 1);
      const configured = await writer.configure({ ...expected(initial), displayName: 'Known class', unlockKind: 'pin', credential: '1234' });
      await observed;

      const unavailable = nextSnapshot(observer, (snapshot) => snapshot.sync.status === 'unavailable' && snapshot.sync.reason === 'parse-failed');
      await writeFile(file, '{"schemaVersion":2,"enabled":');
      const malformed = await unavailable;
      expect(malformed).toMatchObject({ state: { enabled: true, displayName: 'Known class', revision: 1 }, sync: { status: 'unavailable', reason: 'parse-failed' } });

      writer.dispose();
      // Restore the verified bytes before testing a write failure through a
      // fresh service; the failed candidate must not alter its public state.
      await writeFile(file, JSON.stringify({
        schemaVersion: 2,
        recordId: configured.snapshot.state?.recordId,
        revision: 1,
        enabled: false,
        displayName: 'Known class',
        unlockKind: 'pin',
        salt: Buffer.alloc(16, 1).toString('base64'),
        verifier: Buffer.alloc(32, 2).toString('base64'),
      }));
      const failing = new SchoolModeService(file, { ...LIVE_OPTIONS, writeRecord: async () => { throw new Error('private path must not escape'); } });
      const before = await failing.load();
      const events: SchoolModeSnapshot[] = [];
      failing.subscribe((snapshot) => events.push(snapshot));
      const failed = await failing.setEnabled({ ...expected(before), enabled: true });
      expect(failed).toMatchObject({ ok: false, snapshot: { state: { enabled: false, revision: 1 }, sync: { status: 'unavailable', reason: 'write-failed' } } });
      expect(events.every((snapshot) => snapshot.state?.enabled === false && snapshot.state.revision === 1)).toBe(true);
      expect(JSON.stringify(failed.snapshot)).not.toMatch(/private path|school-mode\.v1\.json|salt|verifier/i);
      failing.dispose();
    } finally {
      writer.dispose(); observer.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reports read and watch failures with closed codes and no filesystem details', async () => {
    const { root, file } = await fixture();
    const readFailure = new SchoolModeService(root, LIVE_OPTIONS);
    const watchFailure = new SchoolModeService(file, { ...LIVE_OPTIONS, watchFactory: () => { throw new Error('sensitive watcher path'); } });
    try {
      const unreadable = await readFailure.start();
      expect(unreadable).toMatchObject({ state: null, sync: { status: 'unavailable', reason: 'read-failed', watching: true } });
      const unwatchable = await watchFailure.start();
      expect(unwatchable).toMatchObject({ state: { enabled: false, revision: 0 }, sync: { status: 'unavailable', reason: 'watch-failed', watching: false } });
      expect(JSON.stringify([unreadable, unwatchable])).not.toMatch(/sensitive watcher path|ding-ding-school-live|school-mode\.v1\.json/i);
    } finally {
      readFailure.dispose(); watchFailure.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('closes watchers, polling timers, and listeners so disposed services receive no later events', async () => {
    const { root, file } = await fixture();
    const writer = new SchoolModeService(file, LIVE_OPTIONS);
    const observer = new SchoolModeService(file, LIVE_OPTIONS);
    try {
      const [initial] = await Promise.all([writer.start(), observer.start()]);
      let postDisposeEvents = 0;
      observer.subscribe(() => { postDisposeEvents += 1; });
      observer.dispose();
      await writer.configure({ ...expected(initial), displayName: 'After close', unlockKind: 'pin', credential: '1234' });
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(postDisposeEvents).toBe(0);
    } finally {
      writer.dispose(); observer.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('handles null filenames, emitted watcher failure, and polling reattachment before publishing ready', async () => {
    const { root, file } = await fixture();
    const watchers: FakeWatcher[] = [];
    const writer = new SchoolModeService(file, LIVE_OPTIONS);
    const observer = new SchoolModeService(file, {
      ...LIVE_OPTIONS,
      pollIntervalMs: 40,
      watchFactory: (_directory, listener) => {
        const watcher = new FakeWatcher(listener);
        watchers.push(watcher);
        return watcher as unknown as FSWatcher;
      },
    });
    try {
      const [initial] = await Promise.all([writer.start(), observer.start()]);
      const revision1 = nextSnapshot(observer, (snapshot) => snapshot.state?.revision === 1);
      const configured = await writer.configure({ ...expected(initial), displayName: 'Observed', unlockKind: 'pin', credential: '1234' });
      watchers[0].listener('rename', null);
      await revision1;

      const failed = nextSnapshot(observer, (snapshot) => snapshot.sync.status === 'unavailable' && snapshot.sync.reason === 'watch-failed');
      watchers[0].emit('error', new Error('private watcher detail'));
      expect(await failed).toMatchObject({ state: { revision: 1, displayName: 'Observed' }, sync: { status: 'unavailable', watching: false, reason: 'watch-failed' } });

      const recovered = nextSnapshot(observer, (snapshot) => snapshot.state?.revision === 2 && snapshot.sync.status === 'ready' && snapshot.sync.watching);
      await writer.rename({ ...expected(configured.snapshot), displayName: 'Recovered observation', credential: '1234' });
      expect(await recovered).toMatchObject({ state: { revision: 2, displayName: 'Recovered observation' }, sync: { status: 'ready', watching: true } });
      expect(watchers.length).toBeGreaterThanOrEqual(2);

      const latestWriter = await writer.load();
      const revision3 = nextSnapshot(observer, (snapshot) => snapshot.state?.revision === 3);
      await writer.rename({ ...expected(latestWriter), displayName: 'Null filename refresh', credential: '1234' });
      (watchers.at(-1)!.listener as (eventType: string, filename?: string | Buffer | null) => void)('rename', undefined);
      expect(await revision3).toMatchObject({ state: { displayName: 'Null filename refresh' } });
    } finally {
      writer.dispose(); observer.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('preserves the last valid record when a watched replacement exceeds the bounded record size', async () => {
    const { root, file } = await fixture();
    const watchers: FakeWatcher[] = [];
    const service = new SchoolModeService(file, {
      ...LIVE_OPTIONS,
      pollIntervalMs: 5_000,
      watchFactory: (_directory, listener) => {
        const watcher = new FakeWatcher(listener);
        watchers.push(watcher);
        return watcher as unknown as FSWatcher;
      },
    });
    try {
      const initial = await service.start();
      const configured = await service.configure({ ...expected(initial), displayName: 'Last verified', unlockKind: 'pin', credential: '1234' });
      const unavailable = nextSnapshot(service, (snapshot) => snapshot.sync.status === 'unavailable' && snapshot.sync.reason === 'parse-failed');
      await writeFile(file, Buffer.alloc(33 * 1024, 0x61));
      watchers[0].listener('rename', null);
      expect(await unavailable).toMatchObject({ state: { recordId: configured.snapshot.state?.recordId, revision: 1, enabled: true, displayName: 'Last verified' }, sync: { reason: 'parse-failed' } });
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('fails post-dispose operations closed without further disk reads, writes, or events', async () => {
    const { root, file } = await fixture();
    let opens = 0;
    const service = new SchoolModeService(file, {
      ...LIVE_OPTIONS,
      lockFileSystem: {
        open: async (target, flags, mode) => { opens += 1; return open(target, flags, mode); },
        link,
        unlink,
      },
    });
    try {
      const initial = await service.load();
      let events = 0;
      service.subscribe(() => { events += 1; });
      service.dispose();
      const opensAtDispose = opens;
      const result = await service.configure({ ...expected(initial), displayName: 'Must not write', unlockKind: 'pin', credential: '1234' });
      expect(result).toMatchObject({ ok: false, code: 'service-closed', snapshot: { sync: { reason: 'service-closed' } } });
      expect(await service.verify({ credential: '1234' })).toBe(false);
      await service.load();
      expect(opens).toBe(opensAtDispose);
      expect(events).toBe(0);
      await expect(readFile(file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('cancels an in-flight writer at the publication fence before asynchronous disposal resolves', async () => {
    const { root, file } = await fixture();
    let writerStarted!: () => void;
    const started = new Promise<void>((resolve) => { writerStarted = resolve; });
    let releaseWriter!: () => void;
    const writerGate = new Promise<void>((resolve) => { releaseWriter = resolve; });
    let writes = 0;
    const service = new SchoolModeService(file, {
      ...LIVE_OPTIONS,
      writeRecord: async (target, value, shouldPublish) => {
        writerStarted();
        await writerGate;
        if (!shouldPublish()) {
          const cancelled = new Error('publication cancelled') as NodeJS.ErrnoException;
          cancelled.code = 'ECANCELED';
          throw cancelled;
        }
        writes += 1;
        await writeFile(target, JSON.stringify(value));
      },
    });
    try {
      const initial = await service.load();
      const mutation = service.configure({ ...expected(initial), displayName: 'Drain before close', unlockKind: 'pin', credential: '1234' });
      await started;
      const disposing = service.dispose();
      releaseWriter();
      await disposing;
      const result = await mutation;
      expect(result).toMatchObject({ ok: false, code: 'service-closed' });
      expect(writes).toBe(0);
      await expect(readFile(file, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      releaseWriter();
      await service.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('loops bounded same-handle reads across short reads instead of accepting truncated JSON', async () => {
    const { root, file } = await fixture();
    const seed = new SchoolModeService(file, LIVE_OPTIONS);
    const initial = await seed.load();
    await seed.configure({ ...expected(initial), displayName: 'Short reads', unlockKind: 'pin', credential: '1234' });
    seed.dispose();
    let reads = 0;
    const service = new SchoolModeService(file, {
      ...LIVE_OPTIONS,
      lockFileSystem: {
        open: async (target, flags, mode) => {
          const handle = await open(target, flags, mode);
          if (flags !== 'r') return handle;
          return new Proxy(handle, {
            get(object, property) {
              if (property === 'read') return async (buffer: Buffer, offset: number, length: number, position: number) => {
                reads += 1;
                return object.read(buffer, offset, Math.min(length, 7), position);
              };
              const value = Reflect.get(object, property, object) as unknown;
              return typeof value === 'function' ? value.bind(object) : value;
            },
          });
        },
        link,
        unlink,
      },
    });
    try {
      expect(await service.load()).toMatchObject({ state: { displayName: 'Short reads', revision: 1 }, sync: { status: 'ready' } });
      expect(reads).toBeGreaterThan(2);
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('rejects revision exhaustion and enabled records without an unlock kind without replacing bytes', async () => {
    const { root, file } = await fixture();
    const base = {
      schemaVersion: 2,
      recordId: 'abcdefghijklmnopqrstuvwx',
      revision: Number.MAX_SAFE_INTEGER,
      enabled: false,
      displayName: 'At the limit',
      unlockKind: 'pin',
      salt: Buffer.alloc(16, 1).toString('base64'),
      verifier: Buffer.alloc(32, 2).toString('base64'),
    };
    await writeFile(file, JSON.stringify(base));
    const service = new SchoolModeService(file, LIVE_OPTIONS);
    try {
      const loaded = await service.load();
      const before = await readFile(file, 'utf8');
      expect(await service.rename({ ...expected(loaded), displayName: 'Overflow blocked' })).toMatchObject({ ok: false, code: 'revision-exhausted', snapshot: { state: { displayName: 'At the limit', revision: Number.MAX_SAFE_INTEGER } } });
      expect(await readFile(file, 'utf8')).toBe(before);
      service.dispose();

      await writeFile(file, JSON.stringify({ ...base, revision: 1, enabled: true, unlockKind: null }));
      const malformed = new SchoolModeService(file, LIVE_OPTIONS);
      try {
        expect(await malformed.load()).toMatchObject({ state: null, sync: { status: 'unavailable', reason: 'parse-failed' } });
      } finally { malformed.dispose(); }
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
  });
});

describe('School mode cross-process lock ownership', () => {
  it('does not steal a lock from a live or PID-reused owner even when the lock is old', async () => {
    const { root, file } = await fixture();
    const token = 'abcdefghijklmnopqrstuvwx';
    await writeFile(`${file}.lock`, JSON.stringify({ token, pid: 4242, createdAt: 1 }));
    const service = new SchoolModeService(file, { lockTimeoutMs: 35, lockRetryMs: 5, isProcessAlive: () => true });
    try {
      const initial = await service.load();
      const result = await service.configure({ ...expected(initial), displayName: 'Blocked', unlockKind: 'pin', credential: '1234' });
      expect(result).toMatchObject({ ok: false, snapshot: { sync: { status: 'unavailable', reason: 'conflict' } } });
      expect(JSON.parse(await readFile(`${file}.lock`, 'utf8'))).toMatchObject({ token, pid: 4242 });
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('fails closed when the bounded recovery claimant chain is exhausted', async () => {
    const { root, file } = await fixture();
    const ownerToken = 'z'.repeat(22);
    const claimTokens = Array.from({ length: 8 }, (_, index) => String.fromCharCode(97 + index).repeat(22));
    await writeFile(`${file}.lock`, JSON.stringify({ token: ownerToken, pid: 6100, createdAt: 1 }));
    for (let index = 0; index < claimTokens.length; index += 1) {
      const predecessorToken = index === 0 ? null : claimTokens[index - 1];
      const nodePath = index === 0
        ? `${file}.lock.recover.${ownerToken}.root`
        : `${file}.lock.recover.${ownerToken}.after.${predecessorToken}`;
      await writeFile(nodePath, JSON.stringify({
        expectedOwnerToken: ownerToken,
        claimantPid: 6200 + index,
        claimantToken: claimTokens[index],
        predecessorToken,
        createdAt: 2 + index,
      }));
    }
    const service = new SchoolModeService(file, { lockTimeoutMs: 35, lockRetryMs: 5, isProcessAlive: () => false });
    try {
      const initial = await service.load();
      const result = await service.configure({ ...expected(initial), displayName: 'Depth blocked', unlockKind: 'pin', credential: '1234' });
      expect(result).toMatchObject({ ok: false, code: 'conflict', snapshot: { sync: { status: 'unavailable', reason: 'conflict' } } });
      expect(JSON.parse(await readFile(`${file}.lock`, 'utf8'))).toMatchObject({ token: ownerToken, pid: 6100 });
    } finally { await service.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('does not let a delayed token-checked release remove a newly published owner', async () => {
    const { root, file } = await fixture();
    const oldToken = 'aaaaaaaaaaaaaaaaaaaaaaab';
    const newToken = 'bbbbbbbbbbbbbbbbbbbbbbbc';
    const lockPath = `${file}.lock`;
    await writeFile(lockPath, JSON.stringify({ token: oldToken, pid: 5101, createdAt: 1 }));
    let firstRead!: () => void;
    const readStarted = new Promise<void>((resolve) => { firstRead = resolve; });
    let releaseRead!: () => void;
    const readGate = new Promise<void>((resolve) => { releaseRead = resolve; });
    let lockReads = 0;
    const service = new SchoolModeService(file, {
      ...LIVE_OPTIONS,
      lockFileSystem: {
        open: async (target, flags, mode) => {
          const handle = await open(target, flags, mode);
          if (target !== lockPath || flags !== 'r') return handle;
          return new Proxy(handle, {
            get(object, property) {
              if (property === 'read') return async (buffer: Buffer, offset: number, length: number, position: number) => {
                const result = await object.read(buffer, offset, length, position);
                lockReads += 1;
                if (lockReads === 1) {
                  firstRead();
                  await readGate;
                }
                return result;
              };
              const value = Reflect.get(object, property, object) as unknown;
              return typeof value === 'function' ? value.bind(object) : value;
            },
          });
        },
        link,
        unlink,
      },
    });
    try {
      const release = (service as unknown as { releaseOwnedLock(token: string): Promise<boolean> }).releaseOwnedLock(oldToken);
      await readStarted;
      await unlink(lockPath);
      await writeFile(lockPath, JSON.stringify({ token: newToken, pid: 5102, createdAt: 2 }));
      releaseRead();
      expect(await release).toBe(true);
      expect(JSON.parse(await readFile(lockPath, 'utf8'))).toMatchObject({ token: newToken, pid: 5102 });
    } finally {
      releaseRead();
      service.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('keeps a successor release marker when a predecessor cleanup resumes late', async () => {
    const { root, file } = await fixture();
    const oldToken = 'cccccccccccccccccccccccd';
    const newToken = 'ddddddddddddddddddddddde';
    const oldMarker = `${file}.lock.releasing.${oldToken}`;
    const newMarker = `${file}.lock.releasing.${newToken}`;
    await writeFile(oldMarker, JSON.stringify({ token: oldToken, pid: 5201, createdAt: 1 }));
    let unlinkStarted!: () => void;
    const started = new Promise<void>((resolve) => { unlinkStarted = resolve; });
    let resumeUnlink!: () => void;
    const unlinkGate = new Promise<void>((resolve) => { resumeUnlink = resolve; });
    const service = new SchoolModeService(file, {
      lockFileSystem: {
        open,
        link,
        readdir: readDirectory,
        unlink: async (target) => {
          if (target === oldMarker) {
            unlinkStarted();
            await unlinkGate;
          }
          await unlink(target);
        },
      },
    });
    try {
      const clear = (service as unknown as { clearReleaseMarker(token: string): Promise<boolean> }).clearReleaseMarker(oldToken);
      await started;
      await writeFile(newMarker, JSON.stringify({ token: newToken, pid: 5202, createdAt: 2 }));
      resumeUnlink();
      expect(await clear).toBe(true);
      expect(JSON.parse(await readFile(newMarker, 'utf8'))).toMatchObject({ token: newToken, pid: 5202 });
    } finally {
      resumeUnlink();
      service.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('fails closed when a release marker filename and token disagree', async () => {
    const { root, file } = await fixture();
    const fileToken = 'eeeeeeeeeeeeeeeeeeeeeeef';
    const contentToken = 'fffffffffffffffffffffff0';
    const markerPath = `${file}.lock.releasing.${fileToken}`;
    await writeFile(markerPath, JSON.stringify({ token: contentToken, pid: 5203, createdAt: 1 }));
    const service = new SchoolModeService(file, { isProcessAlive: () => false });
    try {
      const inProgress = await (service as unknown as { releaseInProgress(): Promise<boolean> }).releaseInProgress();
      expect(inProgress).toBe(true);
      expect(await readFile(markerPath, 'utf8')).toContain(contentToken);
    } finally {
      await service.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });

  it('recovers a fully published lock only after liveness proves its owner is dead', async () => {
    const { root, file } = await fixture();
    const token = 'abcdefghijklmnopqrstuvwx';
    await writeFile(`${file}.lock`, JSON.stringify({ token, pid: 4242, createdAt: 1 }));
    const probes: number[] = [];
    const service = new SchoolModeService(file, { lockTimeoutMs: 250, lockRetryMs: 5, isProcessAlive: (pid) => { probes.push(pid); return false; } });
    try {
      const initial = await service.load();
      const result = await service.configure({ ...expected(initial), displayName: 'Recovered', unlockKind: 'pin', credential: '1234' });
      expect(result).toMatchObject({ ok: true, snapshot: { state: { displayName: 'Recovered', revision: 1 } } });
      expect(probes).toEqual([4242, 4242]);
      await expect(readFile(`${file}.lock`, 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
  });

  it('fences an orphaned claimant while two successors race and never removes the winner lock', async () => {
    const { root, file } = await fixture();
    const ownerToken = 'abcdefghijklmnopqrstuvwx';
    const deadClaimToken = 'zyxwvutsrqponmlkjihgfedc';
    await writeFile(`${file}.lock`, JSON.stringify({ token: ownerToken, pid: 4200, createdAt: 1 }));
    await writeFile(`${file}.lock.recover.${ownerToken}.root`, JSON.stringify({
      expectedOwnerToken: ownerToken,
      claimantPid: 4300,
      claimantToken: deadClaimToken,
      predecessorToken: null,
      createdAt: 2,
    }));
    const successorPath = `${file}.lock.recover.${ownerToken}.after.${deadClaimToken}`;
    let arrivals = 0;
    let releaseRace!: () => void;
    const race = new Promise<void>((resolve) => { releaseRace = resolve; });
    let writerEntered!: () => void;
    const writerStarted = new Promise<void>((resolve) => { writerEntered = resolve; });
    let releaseWriter!: () => void;
    const writerGate = new Promise<void>((resolve) => { releaseWriter = resolve; });
    const guardedLink = async (existingPath: string, newPath: string) => {
      if (newPath === successorPath) {
        arrivals += 1;
        if (arrivals === 2) releaseRace();
        await race;
      }
      return link(existingPath, newPath);
    };
    const alive = (pid: number) => pid === 5101 || pid === 5102;
    const optionsFor = (processId: number) => ({
      ...LIVE_OPTIONS,
      processId,
      isProcessAlive: alive,
      lockFileSystem: { open, link: guardedLink, unlink },
      writeRecord: async (target: string, value: unknown) => {
        writerEntered();
        await writerGate;
        await writeJsonAtomic(target, value);
      },
    });
    const first = new SchoolModeService(file, optionsFor(5101));
    const second = new SchoolModeService(file, optionsFor(5102));
    try {
      const initial = await first.load();
      const firstMutation = first.configure({ ...expected(initial), displayName: 'First successor', unlockKind: 'pin', credential: '1234' });
      const secondMutation = second.configure({ ...expected(initial), displayName: 'Second successor', unlockKind: 'pin', credential: '5678' });
      await writerStarted;
      const publishedOwner = JSON.parse(await readFile(`${file}.lock`, 'utf8')) as { token: string; pid: number };
      expect([5101, 5102]).toContain(publishedOwner.pid);
      expect(publishedOwner.token).not.toBe(ownerToken);
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(JSON.parse(await readFile(`${file}.lock`, 'utf8'))).toEqual(publishedOwner);
      releaseWriter();
      const results = await Promise.all([firstMutation, secondMutation]);
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.filter((result) => !result.ok)[0].code).toBe('conflict');
      expect(arrivals).toBe(2);
      expect(JSON.parse(await readFile(successorPath, 'utf8'))).toMatchObject({ expectedOwnerToken: ownerToken, predecessorToken: deadClaimToken });
    } finally {
      releaseRace(); releaseWriter();
      first.dispose(); second.dispose();
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe('atomic shared-record publication', () => {
  it('retries bounded transient Windows rename failures without unlinking the previous target', async () => {
    const { root, file } = await fixture();
    await writeFile(file, 'previous');
    let attempts = 0;
    const waits: number[] = [];
    await writeJsonAtomic(file, { next: true }, {
      renameFile: async (source, target) => {
        attempts += 1;
        if (attempts < 3) {
          expect(await readFile(target, 'utf8')).toBe('previous');
          const error = new Error('transient') as NodeJS.ErrnoException;
          error.code = attempts === 1 ? 'EPERM' : 'EACCES';
          throw error;
        }
        await rename(source, target);
      },
      wait: async (milliseconds) => { waits.push(milliseconds); },
      retryDelaysMs: [1, 2, 3],
    });
    expect(attempts).toBe(3);
    expect(waits).toEqual([1, 2]);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ next: true });
    await rm(root, { recursive: true, force: true });
  });

  it('preserves the previous target and cleans its candidate on permanent failure or cancelled publication', async () => {
    const { root, file } = await fixture();
    await writeFile(file, 'previous');
    const denied = new Error('denied') as NodeJS.ErrnoException;
    denied.code = 'EPERM';
    await expect(writeJsonAtomic(file, { next: true }, { renameFile: async () => { throw denied; }, wait: async () => undefined, retryDelaysMs: [] })).rejects.toMatchObject({ code: 'EPERM' });
    expect(await readFile(file, 'utf8')).toBe('previous');
    expect((await readdir(root)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    await expect(writeJsonAtomic(file, { cancelled: true }, { shouldPublish: () => false })).rejects.toMatchObject({ code: 'ECANCELED' });
    expect(await readFile(file, 'utf8')).toBe('previous');
    expect((await readdir(root)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
    await rm(root, { recursive: true, force: true });
  });
});
