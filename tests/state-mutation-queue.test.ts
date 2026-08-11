import { describe, expect, it } from 'vitest';
import { StateMutationQueue } from '../src/main/state-mutation-queue';

describe('state mutation queue', () => {
  it('keeps a restore barrier ahead of a later renderer save', async () => {
    const queue = new StateMutationQueue();
    const order: string[] = [];
    let releaseRestore!: () => void;
    const restoreGate = new Promise<void>((resolve) => { releaseRestore = resolve; });

    const restore = queue.run(async () => {
      order.push('restore:start');
      await restoreGate;
      order.push('restore:end');
      return 'restored';
    });
    const laterSave = queue.run(async () => {
      order.push('save');
      return 'saved';
    });

    await Promise.resolve();
    expect(order).toEqual(['restore:start']);
    releaseRestore();
    await expect(restore).resolves.toBe('restored');
    await expect(laterSave).resolves.toBe('saved');
    expect(order).toEqual(['restore:start', 'restore:end', 'save']);
  });

  it('does not poison the queue when one write rejects', async () => {
    const queue = new StateMutationQueue();
    await expect(queue.run(async () => { throw new Error('writer failed'); })).rejects.toThrow('writer failed');
    await expect(queue.run(async () => 'next write')).resolves.toBe('next write');
  });
});
