import path from 'node:path';
import { app } from 'electron';
import type { ScheduleConfig, ScheduleRunRecord } from '../shared/contracts.js';
import { DEFAULT_SCHEDULE, scheduleSchema } from '../shared/contracts.js';
import { readJson, writeJsonAtomic } from './json-store.js';

export interface ScheduleRunStore {
  selfUpdate: ScheduleRunRecord | null;
  catalogRefresh: ScheduleRunRecord | null;
}

export type ScheduleConfigSaveResult =
  | { ok: true; config: ScheduleConfig }
  | { ok: false; message: string; issues: Array<{ field: string; message: string }> };

const EMPTY_RUNS: ScheduleRunStore = { selfUpdate: null, catalogRefresh: null };

function stamp(record: ScheduleRunRecord | null | undefined): ScheduleRunRecord | null {
  if (!record || typeof record.at !== 'string') return null;
  return { ...record, fromPreviousSession: true };
}

export class ScheduleService {
  private readonly filePath = path.join(app.getPath('userData'), 'schedule.v1.json');
  private readonly runsPath = path.join(app.getPath('userData'), 'schedule-runs.v1.json');

  async load(): Promise<ScheduleConfig> {
    try {
      const stored = await readJson<unknown>(this.filePath, DEFAULT_SCHEDULE);
      const parsed = scheduleSchema.safeParse(stored);
      return parsed.success ? parsed.data : DEFAULT_SCHEDULE;
    } catch {
      return DEFAULT_SCHEDULE;
    }
  }

  async save(input: unknown): Promise<ScheduleConfigSaveResult> {
    const parsed = scheduleSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        message: 'The schedule was not saved because some values are out of range.',
        issues: parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
      };
    }
    await writeJsonAtomic(this.filePath, parsed.data);
    return { ok: true, config: parsed.data };
  }

  async reset(): Promise<ScheduleConfig> {
    await writeJsonAtomic(this.filePath, DEFAULT_SCHEDULE);
    return DEFAULT_SCHEDULE;
  }

  async loadRuns(): Promise<ScheduleRunStore> {
    try {
      const stored = await readJson<Partial<ScheduleRunStore>>(this.runsPath, EMPTY_RUNS);
      return { selfUpdate: stamp(stored?.selfUpdate), catalogRefresh: stamp(stored?.catalogRefresh) };
    } catch {
      return { ...EMPTY_RUNS };
    }
  }

  async saveRuns(runs: ScheduleRunStore): Promise<void> {
    await writeJsonAtomic(this.runsPath, runs).catch(() => undefined);
  }
}
