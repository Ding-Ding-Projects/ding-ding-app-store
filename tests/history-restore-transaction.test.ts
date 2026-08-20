import { mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { writeJsonAtomic } from '../src/main/json-store';
import { applyRestoreTransaction, cleanupRestoreTransaction, markRestoreTransactionRecorded, markRestoreTransactionRecording, prepareRestoreTransaction, recoverRestoreTransaction } from '../src/main/history-restore-transaction';

const roots: string[] = [];
const TARGETS = [
  'installed-apps.v1.json',
  'settings.v1.json',
  'workspace.v1.json',
  'appearance.v1.json',
  'schedule.v1.json',
  'schedule-runs.v1.json',
  'external-editor.v1.json',
] as const;
const AUTHENTICATOR_TARGET = 'authenticator-history.v1.json' as const;

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ding-history-restore-'));
  roots.push(root);
  const transactionRoot = path.join(root, 'transaction');
  const targetRoot = path.join(root, 'state');
  await mkdir(targetRoot, { recursive: true });
  for (const target of TARGETS) await writeFile(path.join(targetRoot, target), `{"old":"${target}"}\n`, 'utf8');
  return { transactionRoot, targetRoot };
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('history restore transaction recovery', () => {
  it('accepts the optional authenticator participant after the legacy seven files', async () => {
    const { transactionRoot, targetRoot } = await fixture();
    const targets = [...TARGETS, AUTHENTICATOR_TARGET] as const;
    await writeFile(path.join(targetRoot, AUTHENTICATOR_TARGET), '{"old":"authenticator"}\n', 'utf8');
    const manifest = await prepareRestoreTransaction(transactionRoot, targets.map((target) => ({
      targetName: target,
      content: `{"new":"${target}"}\n`,
      previous: target === AUTHENTICATOR_TARGET ? '{"old":"authenticator"}\n' : `{"old":"${target}"}\n`,
    })));
    expect(manifest.files).toHaveLength(8);
    const participant = { restoreAvailable: () => true, restore: async (content: string) => { await writeFile(path.join(targetRoot, AUTHENTICATOR_TARGET), content, 'utf8'); } };
    const applied = await applyRestoreTransaction(transactionRoot, targetRoot, manifest, participant);
    expect(applied.files.at(-1)?.targetName).toBe(AUTHENTICATOR_TARGET);
    await expect(readFile(path.join(targetRoot, AUTHENTICATOR_TARGET), 'utf8')).resolves.toBe('{"new":"authenticator-history.v1.json"}\n');
    await recoverRestoreTransaction(transactionRoot, targetRoot, undefined, participant);
  });

  it('keeps rejecting arbitrary participant files and wrong target order', async () => {
    const { transactionRoot } = await fixture();
    await expect(prepareRestoreTransaction(transactionRoot, TARGETS.map((target) => ({ targetName: target, content: '{}\n', previous: '{}\n' })).concat({ targetName: 'other.json', content: '{}\n', previous: '{}\n' }) as never)).rejects.toThrow(/targets were invalid|legacy seven files|current seven files/);
    await expect(prepareRestoreTransaction(transactionRoot, [{ targetName: 'settings.v1.json', content: '{}\n', previous: '{}\n' }, ...TARGETS.slice(1).map((target) => ({ targetName: target, content: '{}\n', previous: '{}\n' }))])).rejects.toThrow('targets were invalid');
  });

  it('recovers a partial apply back to the complete previous state', async () => {
    const { transactionRoot, targetRoot } = await fixture();
    const manifest = await prepareRestoreTransaction(transactionRoot, TARGETS.map((target) => ({
      targetName: target,
      content: `{"new":"${target}"}\n`,
      previous: `{"old":"${target}"}\n`,
    })));
    await writeJsonAtomic(path.join(transactionRoot, 'manifest.json'), { ...manifest, phase: 'applying' });
    await rename(path.join(transactionRoot, manifest.files[1].stagedName), path.join(targetRoot, 'settings.v1.json'));

    await recoverRestoreTransaction(transactionRoot, targetRoot);
    await expect(readFile(path.join(targetRoot, 'settings.v1.json'), 'utf8')).resolves.toBe('{"old":"settings.v1.json"}\n');
    await expect(readFile(path.join(targetRoot, 'workspace.v1.json'), 'utf8')).resolves.toBe('{"old":"workspace.v1.json"}\n');
    await expect(readFile(path.join(transactionRoot, 'manifest.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps a fully recorded restore and only removes its transaction record', async () => {
    const { transactionRoot, targetRoot } = await fixture();
    const prepared = await prepareRestoreTransaction(transactionRoot, TARGETS.map((target) => ({
      targetName: target,
      content: `{"new":"${target}"}\n`,
      previous: `{"old":"${target}"}\n`,
    })));
    const applied = await applyRestoreTransaction(transactionRoot, targetRoot, prepared);
    const recorded = await markRestoreTransactionRecorded(transactionRoot, applied);
    await recoverRestoreTransaction(transactionRoot, targetRoot);

    expect(recorded.phase).toBe('recorded');
    await expect(readFile(path.join(targetRoot, 'settings.v1.json'), 'utf8')).resolves.toBe('{"new":"settings.v1.json"}\n');
    await expect(readFile(path.join(targetRoot, 'workspace.v1.json'), 'utf8')).resolves.toBe('{"new":"workspace.v1.json"}\n');
    await expect(readFile(path.join(transactionRoot, 'manifest.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await cleanupRestoreTransaction(transactionRoot);
  });

  it('keeps applied bytes when startup proves the restore commit was recorded', async () => {
    const { transactionRoot, targetRoot } = await fixture();
    const prepared = await prepareRestoreTransaction(transactionRoot, TARGETS.map((target) => ({
      targetName: target,
      content: `{"new":"${target}"}\n`,
      previous: `{"old":"${target}"}\n`,
    })));
    const applied = await applyRestoreTransaction(transactionRoot, targetRoot, prepared);
    const recordLabel = `restore: ${'a'.repeat(40)} (${"b".repeat(8)}-${"c".repeat(4)}-${"d".repeat(4)}-${"e".repeat(4)}-${"f".repeat(12)})`;
    await markRestoreTransactionRecording(transactionRoot, applied, recordLabel);

    await recoverRestoreTransaction(transactionRoot, targetRoot, async (manifest) => manifest.recordLabel === recordLabel);
    await expect(readFile(path.join(targetRoot, 'settings.v1.json'), 'utf8')).resolves.toBe('{"new":"settings.v1.json"}\n');
    await expect(readFile(path.join(transactionRoot, 'manifest.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('fails closed when a staged byte stream no longer matches its manifest digest', async () => {
    const { transactionRoot, targetRoot } = await fixture();
    const prepared = await prepareRestoreTransaction(transactionRoot, TARGETS.map((target) => ({
      targetName: target,
      content: `{"new":"${target}"}\n`,
      previous: `{"old":"${target}"}\n`,
    })));
    await writeFile(path.join(transactionRoot, prepared.files[0].stagedName), '{"tampered":true}\n', 'utf8');

    await expect(applyRestoreTransaction(transactionRoot, targetRoot, prepared)).rejects.toThrow('integrity check');
    await expect(readFile(path.join(targetRoot, 'installed-apps.v1.json'), 'utf8')).resolves.toBe('{"old":"installed-apps.v1.json"}\n');
  });

  it('rolls back a recording journal when the expected commit is not present', async () => {
    const { transactionRoot, targetRoot } = await fixture();
    const prepared = await prepareRestoreTransaction(transactionRoot, TARGETS.map((target) => ({
      targetName: target,
      content: `{"new":"${target}"}\n`,
      previous: `{"old":"${target}"}\n`,
    })));
    const applied = await applyRestoreTransaction(transactionRoot, targetRoot, prepared);
    await markRestoreTransactionRecording(transactionRoot, applied, `restore: ${'a'.repeat(40)} (${"b".repeat(8)}-${"c".repeat(4)}-${"d".repeat(4)}-${"e".repeat(4)}-${"f".repeat(12)})`);

    await recoverRestoreTransaction(transactionRoot, targetRoot, async () => false);
    await expect(readFile(path.join(targetRoot, 'settings.v1.json'), 'utf8')).resolves.toBe('{"old":"settings.v1.json"}\n');
  });

  it('rejects path traversal in a durable manifest', async () => {
    const { transactionRoot, targetRoot } = await fixture();
    const manifest = await prepareRestoreTransaction(transactionRoot, TARGETS.map((target) => ({
      targetName: target,
      content: `{"new":"${target}"}\n`,
      previous: `{"old":"${target}"}\n`,
    })));
    await writeJsonAtomic(path.join(transactionRoot, 'manifest.json'), {
      ...manifest,
      phase: 'applying',
      files: manifest.files.map((file, index) => index === 0 ? { ...file, targetName: '..\\outside.json' } : file),
    });

    await expect(recoverRestoreTransaction(transactionRoot, targetRoot)).rejects.toThrow('manifest was invalid');
  });

  it('retains outer and inner journals when protected authenticator rollback is unavailable', async () => {
    const { transactionRoot, targetRoot } = await fixture();
    const innerJournal = path.join(path.dirname(transactionRoot), 'authenticator-history-journal.json');
    await writeFile(innerJournal, '{"schemaVersion":1,"phase":"applying"}\n', 'utf8');
    const prepared = await prepareRestoreTransaction(transactionRoot, [
      ...TARGETS.map((target) => ({ targetName: target, content: `{"new":"${target}"}\n`, previous: `{"old":"${target}"}\n` })),
      { targetName: 'authenticator-history.v1.json', content: '{"target":true}\n', previous: '{"previous":true}\n' },
    ]);
    const unavailableParticipant = {
      restoreAvailable: () => false,
      async restore() {
        const unsupported = new Error('native no-follow unavailable') as NodeJS.ErrnoException;
        unsupported.code = 'EUNSUPPORTED';
        throw unsupported;
      },
    };
    await writeJsonAtomic(path.join(transactionRoot, 'manifest.json'), { ...prepared, phase: 'applying' });
    await expect(recoverRestoreTransaction(transactionRoot, targetRoot, undefined, unavailableParticipant)).rejects.toMatchObject({ code: 'EUNSUPPORTED' });
    await expect(readFile(path.join(transactionRoot, 'manifest.json'), 'utf8')).resolves.toContain('applying');
    await expect(readFile(innerJournal, 'utf8')).resolves.toContain('applying');
    await expect(readFile(path.join(targetRoot, 'settings.v1.json'), 'utf8')).resolves.toBe('{"old":"settings.v1.json"}\n');
  });
});
