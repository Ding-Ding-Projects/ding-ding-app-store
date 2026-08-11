import { describe, expect, it, vi } from 'vitest';
import type { ScheduleConfig, ScheduleRunRecord } from '../src/shared/contracts';
import { DEFAULT_SCHEDULE } from '../src/shared/contracts';

vi.mock('electron', () => ({
  app: { isPackaged: false },
  powerMonitor: { on: vi.fn() },
}));

import { Scheduler } from '../src/main/scheduler';
import { StateMutationQueue } from '../src/main/state-mutation-queue';

const disabled = (selfUpdateIntervalMinutes: number): ScheduleConfig => ({
  ...DEFAULT_SCHEDULE,
  selfUpdate: { repeatEnabled: false, intervalMinutes: selfUpdateIntervalMinutes },
  catalogRefresh: { enabled: false, intervalMinutes: selfUpdateIntervalMinutes },
});

const run = (at: string, message: string): ScheduleRunRecord => ({
  at,
  outcome: 'ok',
  message,
  trigger: 'schedule',
  durationMs: 1,
  fromPreviousSession: true,
});

describe('scheduler restore reload', () => {
  it('replaces cached config and run history from disk', async () => {
    let config = disabled(60);
    let runs = { selfUpdate: run('2026-08-11T10:00:00.000Z', 'before'), catalogRefresh: null };
    const service = {
      loadWithProvenance: vi.fn(async () => ({ config, source: 'persisted' as const })),
      loadRuns: vi.fn(async () => runs),
      saveRuns: vi.fn(async () => undefined),
      save: vi.fn(),
    };
    const scheduler = new Scheduler({
      getWindow: () => null,
      service: service as never,
      tasks: {
        'self-update': async () => ({ outcome: 'ok' as const, message: 'ran' }),
        'catalog-refresh': async () => ({ outcome: 'ok' as const, message: 'ran' }),
      },
    });

    await scheduler.start();
    config = disabled(120);
    runs = { selfUpdate: run('2026-08-11T11:00:00.000Z', 'after restore'), catalogRefresh: null };
    const status = await scheduler.reloadFromDisk();

    expect(status.config.selfUpdate.intervalMinutes).toBe(120);
    expect(status.tasks['self-update'].lastRun?.message).toBe('after restore');
    expect(service.loadWithProvenance).toHaveBeenCalledTimes(2);
    expect(service.loadRuns).toHaveBeenCalledTimes(2);
  });

  it('does not let an in-flight pre-restore run publish stale run history', async () => {
    let releaseTask!: () => void;
    const taskGate = new Promise<void>((resolve) => { releaseTask = resolve; });
    let config = disabled(60);
    let runs = { selfUpdate: null, catalogRefresh: null };
    const restoredRun = run('2026-08-11T12:00:00.000Z', 'restored run');
    const service = {
      loadWithProvenance: vi.fn(async () => ({ config, source: 'persisted' as const })),
      loadRuns: vi.fn(async () => runs),
      saveRuns: vi.fn(async () => undefined),
      save: vi.fn(),
    };
    const scheduler = new Scheduler({
      getWindow: () => null,
      service: service as never,
      tasks: {
        'self-update': async () => { await taskGate; return { outcome: 'ok' as const, message: 'stale run' }; },
        'catalog-refresh': async () => ({ outcome: 'ok' as const, message: 'ran' }),
      },
    });

    await scheduler.start();
    const staleRun = scheduler.runNow('self-update');
    await Promise.resolve();
    config = disabled(120);
    runs = { selfUpdate: restoredRun, catalogRefresh: null };
    await scheduler.reloadFromDisk();
    releaseTask();
    await staleRun;

    expect(service.saveRuns).not.toHaveBeenCalled();
    expect(scheduler.status().tasks['self-update'].lastRun?.message).toBe('restored run');
  });

  it('routes manual runs through the privileged mutation hook without deadlocking', async () => {
    const service = {
      loadWithProvenance: vi.fn(async () => ({ config: disabled(60), source: 'persisted' as const })),
      loadRuns: vi.fn(async () => ({ selfUpdate: null, catalogRefresh: null })),
      saveRuns: vi.fn(async () => undefined),
      save: vi.fn(),
    };
    const mutations: string[] = [];
    const scheduler = new Scheduler({
      getWindow: () => null,
      service: service as never,
      mutate: async (operation) => {
        mutations.push('entered');
        const result = await operation();
        mutations.push('left');
        return result;
      },
      tasks: {
        'self-update': async () => ({ outcome: 'ok' as const, message: 'manual run' }),
        'catalog-refresh': async () => ({ outcome: 'ok' as const, message: 'ran' }),
      },
    });

    await scheduler.start();
    await scheduler.runNow('self-update');
    expect(mutations).toEqual(['entered', 'left']);
    expect(service.saveRuns).toHaveBeenCalledTimes(1);
  });

  it('drops a timer callback queued before restore when reload changes its generation', async () => {
    const enabled = (): ScheduleConfig => ({
      ...DEFAULT_SCHEDULE,
      selfUpdate: { repeatEnabled: true, intervalMinutes: 60 },
      catalogRefresh: { enabled: false, intervalMinutes: 60 },
    });
    let config = enabled();
    let runs = { selfUpdate: null, catalogRefresh: null };
    let taskInvocations = 0;
    const restoredRun = run('2026-08-11T13:00:00.000Z', 'restored after timer');
    const service = {
      loadWithProvenance: vi.fn(async () => ({ config, source: 'persisted' as const })),
      loadRuns: vi.fn(async () => runs),
      saveRuns: vi.fn(async () => undefined),
      save: vi.fn(),
    };
    const queue = new StateMutationQueue();
    const scheduler = new Scheduler({
      getWindow: () => null,
      service: service as never,
      mutate: (operation) => queue.run(operation),
      tasks: {
        'self-update': async () => {
          taskInvocations += 1;
          return { outcome: 'ok' as const, message: 'stale timer ran' };
        },
        'catalog-refresh': async () => ({ outcome: 'ok' as const, message: 'ran' }),
      },
    });

    await scheduler.start();
    const task = (scheduler as unknown as { tasks: Record<string, { expectedFireAt: number | null; nextRunAt: number | null }> }).tasks['self-update'];
    task.expectedFireAt = Date.now() - 1;
    task.nextRunAt = Date.now() - 1;

    let releaseRestore!: () => void;
    let restoreStarted!: () => void;
    const restoreGate = new Promise<void>((resolve) => { releaseRestore = resolve; });
    const restoreEntered = new Promise<void>((resolve) => { restoreStarted = resolve; });
    const restore = queue.run(async () => {
      restoreStarted();
      await restoreGate;
      config = { ...DEFAULT_SCHEDULE, selfUpdate: { repeatEnabled: false, intervalMinutes: 120 }, catalogRefresh: { enabled: false, intervalMinutes: 120 } };
      runs = { selfUpdate: restoredRun, catalogRefresh: null };
      await scheduler.reloadFromDisk();
    });
    await restoreEntered;

    // The timer has already crossed the serial restore barrier, but its
    // callback must retain the old generation instead of running afterwards.
    (scheduler as unknown as { onFire: (value: unknown) => void }).onFire((scheduler as unknown as { tasks: Record<string, unknown> }).tasks['self-update']);
    releaseRestore();
    await restore;
    await queue.run(async () => undefined);

    expect(taskInvocations).toBe(0);
    expect(service.saveRuns).not.toHaveBeenCalled();
    expect(scheduler.status().tasks['self-update'].lastRun?.message).toBe(restoredRun.message);
  });
});
