import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SCHEDULE } from '../../shared/contracts';
import type { ScheduleConfig, ScheduleStatus, ScheduleTaskId, ScheduledSettingRule } from '../../shared/contracts';
import type { Notify } from '../notify';
import { writeScheduleField } from '../registry';
import type { ScheduleFieldKey } from '../registry';

export interface ScheduleApi {
  status: ScheduleStatus | null;
  draft: ScheduleConfig;
  dirty: boolean;
  saving: boolean;
  issues: Array<{ field: string; message: string }>;
  set(key: ScheduleFieldKey, value: number | boolean): void;
  setRules(rules: ScheduledSettingRule[]): void;
  /** Applies one or more fields and saves immediately, for palette commands that must take effect. */
  applyNow(entries: Array<[ScheduleFieldKey, number | boolean]>): Promise<boolean>;
  save(): Promise<boolean>;
  discard(): void;
  resetDefaults(): void;
  runNow(task: ScheduleTaskId): Promise<void>;
  running: ScheduleTaskId | null;
}

export function useSchedule(notify: Notify): ScheduleApi {
  const [status, setStatus] = useState<ScheduleStatus | null>(null);
  const [draft, setDraft] = useState<ScheduleConfig>(DEFAULT_SCHEDULE);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<ScheduleTaskId | null>(null);
  const [issues, setIssues] = useState<Array<{ field: string; message: string }>>([]);
  const dirtyRef = useRef(false);
  const lastNoticeId = useRef<string | null>(null);

  const receive = useCallback((next: ScheduleStatus) => {
    setStatus(next);
    if (!dirtyRef.current) setDraft(next.config);
    if (next.notice && !next.notice.silent && next.notice.id !== lastNoticeId.current) {
      lastNoticeId.current = next.notice.id;
      notify({ ok: next.notice.level !== 'error', message: `${next.notice.en} · ${next.notice.yue}` });
    }
  }, [notify]);

  useEffect(() => {
    void window.dingDingStore.schedule.load().then(receive);
    return window.dingDingStore.schedule.subscribe(receive);
  }, [receive]);

  const set = useCallback((key: ScheduleFieldKey, value: number | boolean) => {
    dirtyRef.current = true;
    setDirty(true);
    setDraft((current) => writeScheduleField(current, key, value));
  }, []);

  const setRules = useCallback((rules: ScheduledSettingRule[]) => {
    dirtyRef.current = true;
    setDirty(true);
    setDraft((current) => ({ ...current, rules }));
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const result = await window.dingDingStore.schedule.save(draft);
      if (result.ok) {
        dirtyRef.current = false;
        setDirty(false);
        setIssues([]);
        setStatus(result.status);
        setDraft(result.status.config);
        notify({ ok: true, message: 'Schedule saved. Timers were re-armed from this moment.' });
        return true;
      }
      setIssues(result.issues);
      notify({ ok: false, message: result.message.slice(0, 200) });
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, notify]);

  const applyNow = useCallback(async (entries: Array<[ScheduleFieldKey, number | boolean]>) => {
    const next = entries.reduce((config, [key, value]) => writeScheduleField(config, key, value), draft);
    setDraft(next);
    setSaving(true);
    try {
      const result = await window.dingDingStore.schedule.save(next);
      if (result.ok) {
        dirtyRef.current = false;
        setDirty(false);
        setIssues([]);
        setStatus(result.status);
        setDraft(result.status.config);
        notify({ ok: true, message: 'Schedule saved. Timers were re-armed from this moment.' });
        return true;
      }
      setIssues(result.issues);
      dirtyRef.current = true;
      setDirty(true);
      notify({ ok: false, message: result.message.slice(0, 200) });
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, notify]);

  const discard = useCallback(() => {
    dirtyRef.current = false;
    setDirty(false);
    setIssues([]);
    if (status) setDraft(status.config);
  }, [status]);

  const resetDefaults = useCallback(() => {
    dirtyRef.current = true;
    setDirty(true);
    setDraft(DEFAULT_SCHEDULE);
  }, []);

  const runNow = useCallback(async (task: ScheduleTaskId) => {
    setRunning(task);
    try {
      receive(await window.dingDingStore.schedule.runNow(task));
    } catch (error) {
      notify({ ok: false, message: (error as Error).message.slice(0, 200) });
    } finally {
      setRunning(null);
    }
  }, [receive, notify]);

  return { status, draft, dirty, saving, issues, set, setRules, applyNow, save, discard, resetDefaults, runNow, running };
}
