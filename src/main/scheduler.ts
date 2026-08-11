import { app, powerMonitor, type BrowserWindow } from 'electron';
import type {
  ScheduleConfig,
  ScheduleNotice,
  ScheduleRunRecord,
  ScheduleSaveResult,
  ScheduleStatus,
  ScheduleTaskId,
  ScheduleTaskResult,
  ScheduleTaskStatus,
  ScheduleTrigger,
} from '../shared/contracts.js';
import { DEFAULT_SCHEDULE } from '../shared/contracts.js';
import type { ScheduleService } from './schedule-service.js';
import type { ExternalScheduledSettingsService } from './external-scheduled-settings-service.js';

const MAX_DELAY_MS = 2_147_483_000;
const BACKOFF_BASE_MS = 15 * 60_000;
const MAX_FAILURES = 6;
const CLOCK_TOLERANCE_MS = 60_000;
const TASK_IDS: readonly ScheduleTaskId[] = ['self-update', 'catalog-refresh'];
const TASK_LABELS: Record<ScheduleTaskId, { en: string; yue: string }> = {
  'self-update': { en: 'App Store update check', yue: 'App Store 更新檢查' },
  'catalog-refresh': { en: 'Catalog refresh', yue: '目錄重新整理' },
};

interface TaskState {
  id: ScheduleTaskId;
  timer: NodeJS.Timeout | null;
  generation: number;
  running: boolean;
  anchor: number | null;
  nextRunAt: number | null;
  expectedFireAt: number | null;
  nextRunIsBackoff: boolean;
  consecutiveFailures: number;
  lastRun: ScheduleRunRecord | null;
  runToken: number;
}

export interface SchedulerOptions {
  getWindow: () => BrowserWindow | null;
  service: ScheduleService;
  tasks: Record<ScheduleTaskId, () => Promise<ScheduleTaskResult>>;
  externalSources?: ExternalScheduledSettingsService;
  mutate?: <T>(operation: () => Promise<T>) => Promise<T>;
}

function newTask(id: ScheduleTaskId): TaskState {
  return {
    id,
    timer: null,
    generation: 0,
    running: false,
    anchor: null,
    nextRunAt: null,
    expectedFireAt: null,
    nextRunIsBackoff: false,
    consecutiveFailures: 0,
    lastRun: null,
    runToken: 0,
  };
}

export class Scheduler {
  private config: ScheduleConfig = DEFAULT_SCHEDULE;
  private configSource: 'persisted' | 'fallback' = 'fallback';
  private readonly tasks: Record<ScheduleTaskId, TaskState> = {
    'self-update': newTask('self-update'),
    'catalog-refresh': newTask('catalog-refresh'),
  };
  private startupCheck: ScheduleRunRecord | null = null;
  private notice: ScheduleNotice | null = null;
  private quietTimer: NodeJS.Timeout | null = null;
  private quietWas = false;
  private heldSinceQuietStart = 0;
  private started = false;
  private externalRefreshTimer: NodeJS.Timeout | null = null;
  private reloadGeneration = 0;

  constructor(private readonly options: SchedulerOptions) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.loadPersistedState();
    this.quietWas = this.quietActive();
    try {
      powerMonitor.on('resume', () => this.reevaluate());
      powerMonitor.on('unlock-screen', () => this.reevaluate());
    } catch {
      /* powerMonitor is unavailable before the app is ready on some platforms. */
    }
    for (const id of TASK_IDS) this.arm(this.tasks[id]);
    this.armQuietBoundary();
    await this.refreshExternalSources();
    this.armExternalRefresh();
    this.publish();
  }

  /**
   * Re-reads the schedule files after a local-history restore. `status()` is
   * intentionally an in-memory projection, so returning it directly from the
   * IPC handler would leave the renderer and timers on the pre-restore config.
   */
  async reloadFromDisk(): Promise<ScheduleStatus> {
    this.reloadGeneration += 1;
    const previous = this.config;
    await this.loadPersistedState();
    this.startupCheck = null;
    this.notice = null;
    this.heldSinceQuietStart = 0;

    if (this.started) {
      for (const id of TASK_IDS) {
        const task = this.tasks[id];
        task.runToken += 1;
        task.running = false;
        task.consecutiveFailures = 0;
        task.nextRunIsBackoff = false;
        this.disarm(task);
        if (!this.enabledFor(id, this.config)) {
          task.nextRunAt = null;
          task.expectedFireAt = null;
          task.nextRunIsBackoff = false;
          continue;
        }
        const wasEnabled = this.enabledFor(id, previous);
        const intervalChanged = this.intervalFor(id, this.config) !== this.intervalFor(id, previous);
        if (!wasEnabled || intervalChanged || task.anchor === null) {
          const at = Date.parse(task.lastRun?.at ?? '');
          task.anchor = Number.isFinite(at) ? at : Date.now();
        }
        this.arm(task);
      }
      this.quietWas = this.quietActive();
      if (!this.quietWas) this.heldSinceQuietStart = 0;
      this.armQuietBoundary();
      await this.refreshExternalSources();
      this.armExternalRefresh();
    }

    this.publish();
    return this.status();
  }

  async runStartupCheck(): Promise<void> {
    await this.runExclusive(this.tasks['self-update'], 'startup');
  }

  async runNow(id: ScheduleTaskId): Promise<ScheduleStatus> {
    await this.runExclusive(this.tasks[id], 'manual');
    return this.status();
  }

  async save(input: unknown): Promise<ScheduleSaveResult> {
    const result = await this.options.service.save(input);
    if (!result.ok) return { ok: false, message: result.message, issues: result.issues };
    this.applyConfig(result.config);
    return { ok: true, status: this.status() };
  }

  status(): ScheduleStatus {
    const nextChange = this.nextQuietChange();
    return {
      config: this.config,
      configSource: this.configSource,
      tasks: {
        'self-update': this.taskStatus('self-update'),
        'catalog-refresh': this.taskStatus('catalog-refresh'),
      },
      startupCheck: this.startupCheck,
      quietHours: {
        active: this.quietActive(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        nextChangeAt: nextChange ? new Date(nextChange).toISOString() : null,
        heldSinceQuietStart: this.heldSinceQuietStart,
      },
      packagedBuild: app.isPackaged,
      now: new Date().toISOString(),
      notice: this.notice,
      externalSources: this.options.externalSources?.status() ?? [],
    };
  }

  publish(): void {
    const window = this.options.getWindow();
    if (window && !window.isDestroyed()) window.webContents.send('schedule:status', this.status());
  }

  private taskStatus(id: ScheduleTaskId): ScheduleTaskStatus {
    const task = this.tasks[id];
    return {
      id,
      armed: task.timer !== null,
      running: task.running,
      intervalMinutes: this.intervalFor(id, this.config),
      nextRunAt: task.nextRunAt === null ? null : new Date(task.nextRunAt).toISOString(),
      nextRunIsBackoff: task.nextRunIsBackoff,
      consecutiveFailures: task.consecutiveFailures,
      lastRun: task.lastRun,
    };
  }

  private enabledFor(id: ScheduleTaskId, config: ScheduleConfig): boolean {
    return id === 'self-update' ? config.selfUpdate.repeatEnabled : config.catalogRefresh.enabled;
  }

  private intervalFor(id: ScheduleTaskId, config: ScheduleConfig): number {
    return id === 'self-update' ? config.selfUpdate.intervalMinutes : config.catalogRefresh.intervalMinutes;
  }

  private applyConfig(next: ScheduleConfig): void {
    const previous = this.config;
    this.config = next;
    this.configSource = 'persisted';
    for (const id of TASK_IDS) {
      const task = this.tasks[id];
      if (!this.enabledFor(id, next)) {
        this.disarm(task);
        task.nextRunAt = null;
        task.expectedFireAt = null;
        task.nextRunIsBackoff = false;
        continue;
      }
      const wasEnabled = this.enabledFor(id, previous);
      const intervalChanged = this.intervalFor(id, next) !== this.intervalFor(id, previous);
      if (!wasEnabled || intervalChanged) {
        const at = Date.parse(task.lastRun?.at ?? '');
        task.anchor = Number.isFinite(at) ? at : Date.now();
      }
      this.arm(task);
    }
    this.quietWas = this.quietActive();
    if (!this.quietWas) this.heldSinceQuietStart = 0;
    this.armQuietBoundary();
    void this.refreshExternalSources();
    this.publish();
  }

  private async loadPersistedState(): Promise<void> {
    const loaded = await this.options.service.loadWithProvenance();
    this.config = loaded.config;
    this.configSource = loaded.source;
    const runs = await this.options.service.loadRuns();
    this.tasks['self-update'].lastRun = runs.selfUpdate;
    this.tasks['catalog-refresh'].lastRun = runs.catalogRefresh;
    for (const id of TASK_IDS) {
      const at = Date.parse(this.tasks[id].lastRun?.at ?? '');
      this.tasks[id].anchor = Number.isFinite(at) ? at : Date.now();
    }
  }

  private async refreshExternalSources(): Promise<void> {
    if (!this.options.externalSources) return;
    await this.options.externalSources.refresh(this.config).catch(() => undefined);
    this.publish();
  }

  private armExternalRefresh(): void {
    if (this.externalRefreshTimer) clearTimeout(this.externalRefreshTimer);
    if (!this.options.externalSources) return;
    const timer = setTimeout(() => {
      void this.refreshExternalSources().finally(() => this.armExternalRefresh());
    }, 5 * 60_000);
    timer.unref();
    this.externalRefreshTimer = timer;
  }

  private disarm(task: TaskState): void {
    if (task.timer) clearTimeout(task.timer);
    task.timer = null;
    task.generation += 1;
  }

  private arm(task: TaskState): void {
    this.disarm(task);
    if (!this.enabledFor(task.id, this.config)) {
      task.nextRunAt = null;
      task.expectedFireAt = null;
      task.nextRunIsBackoff = false;
      return;
    }
    const generation = task.generation;
    const intervalMs = this.intervalFor(task.id, this.config) * 60_000;
    const now = Date.now();
    if (task.anchor === null) task.anchor = now;
    const anchor = task.anchor;
    let steps = Math.floor((now - anchor) / intervalMs) + 1;
    if (steps < 1) steps = 1;
    while (anchor + steps * intervalMs <= now) steps += 1;
    let next = anchor + steps * intervalMs;
    let isBackoff = false;
    if (task.consecutiveFailures > 0) {
      const lastAt = Date.parse(task.lastRun?.at ?? '');
      const backoffMs = Math.min(intervalMs, BACKOFF_BASE_MS * 2 ** (task.consecutiveFailures - 1));
      const backoffAt = (Number.isFinite(lastAt) ? lastAt : now) + backoffMs;
      if (backoffAt < next) {
        next = backoffAt;
        isBackoff = true;
      }
    }
    task.nextRunAt = next;
    task.expectedFireAt = next;
    task.nextRunIsBackoff = isBackoff;
    const remaining = Math.max(0, next - now);
    const clamped = remaining > MAX_DELAY_MS;
    const timer = setTimeout(() => {
      if (generation !== task.generation) return;
      if (clamped) {
        this.arm(task);
        return;
      }
      this.onFire(task);
    }, clamped ? MAX_DELAY_MS : remaining);
    timer.unref();
    task.timer = timer;
  }

  private onFire(task: TaskState): void {
    const expectedGeneration = this.reloadGeneration;
    const now = Date.now();
    const expected = task.expectedFireAt ?? now;
    if (now < expected - CLOCK_TOLERANCE_MS) {
      task.anchor = now;
      this.arm(task);
      this.publish();
      return;
    }
    const intervalMs = this.intervalFor(task.id, this.config) * 60_000;
    const trigger: ScheduleTrigger = now - expected >= intervalMs ? 'catch-up' : 'schedule';
    void this.runExclusive(task, trigger, expectedGeneration);
  }

  private reevaluate(): void {
    for (const id of TASK_IDS) {
      const task = this.tasks[id];
      if (!this.enabledFor(id, this.config)) {
        this.arm(task);
        continue;
      }
      if (task.nextRunAt !== null && Date.now() >= task.nextRunAt) this.onFire(task);
      else this.arm(task);
    }
    this.armQuietBoundary();
    this.publish();
  }

  private async run(task: TaskState, trigger: ScheduleTrigger, expectedGeneration?: number): Promise<void> {
    if (expectedGeneration !== undefined && expectedGeneration !== this.reloadGeneration) return;
    const runGeneration = this.reloadGeneration;
    this.disarm(task);
    if (task.running) {
      this.record(task, { outcome: 'skipped', message: 'Previous run was still in progress.' }, trigger, 0);
      this.arm(task);
      this.publish();
      return;
    }
    const runToken = task.runToken + 1;
    task.runToken = runToken;
    task.running = true;
    this.publish();
    const started = Date.now();
    let result: ScheduleTaskResult;
    try {
      result = await this.options.tasks[task.id]();
    } catch (error) {
      result = { outcome: 'failed', message: (error as Error).message };
    }
    if (runGeneration !== this.reloadGeneration || task.runToken !== runToken) {
      // A history restore replaced the schedule while this operation was
      // awaiting I/O. Do not let the old result rewrite restored run history.
      return;
    }
    task.running = false;
    this.record(task, result, trigger, Date.now() - started);
    task.anchor = Date.now();
    this.arm(task);
    await this.options.service.saveRuns({
      selfUpdate: this.tasks['self-update'].lastRun,
      catalogRefresh: this.tasks['catalog-refresh'].lastRun,
    });
    this.publish();
  }

  private async runExclusive(task: TaskState, trigger: ScheduleTrigger, expectedGeneration?: number): Promise<void> {
    const operation = () => this.run(task, trigger, expectedGeneration);
    if (!this.options.mutate) return operation();
    await this.options.mutate(operation);
  }

  private record(task: TaskState, result: ScheduleTaskResult, trigger: ScheduleTrigger, durationMs: number): void {
    const record: ScheduleRunRecord = {
      at: new Date().toISOString(),
      outcome: result.outcome,
      message: result.message,
      trigger,
      durationMs,
      fromPreviousSession: false,
    };
    task.lastRun = record;
    if (trigger === 'startup') this.startupCheck = record;
    if (result.outcome === 'failed') task.consecutiveFailures = Math.min(MAX_FAILURES, task.consecutiveFailures + 1);
    else if (result.outcome === 'ok') task.consecutiveFailures = 0;
    if (result.outcome === 'skipped') return;
    const silent = this.quietActive();
    if (silent) this.heldSinceQuietStart += 1;
    const label = TASK_LABELS[task.id];
    this.notice = {
      id: `${task.id}-${record.at}`,
      level: result.outcome === 'failed' ? 'error' : 'info',
      en: `${label.en}: ${record.message}`.slice(0, 200),
      yue: `${label.yue}：${record.message}`.slice(0, 200),
      silent,
    };
  }

  private quietActive(): boolean {
    const quiet = this.config.quietHours;
    if (!quiet.enabled) return false;
    const now = new Date();
    const minute = now.getHours() * 60 + now.getMinutes();
    return quiet.endMinute < quiet.startMinute
      ? minute >= quiet.startMinute || minute < quiet.endMinute
      : minute >= quiet.startMinute && minute < quiet.endMinute;
  }

  private nextQuietChange(): number | null {
    const quiet = this.config.quietHours;
    if (!quiet.enabled) return null;
    const now = new Date();
    const minute = now.getHours() * 60 + now.getMinutes();
    const target = this.quietActive() ? quiet.endMinute : quiet.startMinute;
    let delta = (target - minute + 1440) % 1440;
    if (delta === 0) delta = 1440;
    const base = new Date(now);
    base.setSeconds(0, 0);
    return base.getTime() + delta * 60_000;
  }

  private armQuietBoundary(): void {
    if (this.quietTimer) clearTimeout(this.quietTimer);
    this.quietTimer = null;
    const next = this.nextQuietChange();
    if (next === null) return;
    const delay = Math.min(MAX_DELAY_MS, Math.max(1_000, next - Date.now()));
    const timer = setTimeout(() => this.onQuietBoundary(), delay);
    timer.unref();
    this.quietTimer = timer;
  }

  private onQuietBoundary(): void {
    const nowQuiet = this.quietActive();
    if (!nowQuiet && this.quietWas) {
      const held = this.heldSinceQuietStart;
      if (held > 0) {
        this.notice = {
          id: `quiet-digest-${Date.now()}`,
          level: 'info',
          en: `${held} scheduled ${held === 1 ? 'check' : 'checks'} finished quietly.`,
          yue: `靜音期間完成咗 ${held} 次檢查。`,
          silent: false,
        };
      }
      this.heldSinceQuietStart = 0;
    }
    if (nowQuiet && !this.quietWas) this.heldSinceQuietStart = 0;
    this.quietWas = nowQuiet;
    this.armQuietBoundary();
    this.publish();
  }
}
