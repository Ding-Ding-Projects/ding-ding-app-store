import type { ScheduleConfig, ScheduledExternalState, ScheduledSettingRule, UserSettings } from './contracts.js';

export type ExternalScheduleResolution = Partial<Record<string, {
  state: ScheduledExternalState;
  values?: Partial<Pick<UserSettings, 'language' | 'englishFunnyLevel' | 'cantoneseFunnyLevel' | 'theme' | 'density' | 'accent' | 'displayName'>>;
}>>;

const WEEKDAY_NUMBER: Record<string, number> = { monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7 };

function parts(now: Date, timeZone: string): { date: string; minute: number; weekday: number } {
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-US', { timeZone: timeZone === 'local' ? undefined : timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'long' });
  } catch {
    formatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'long' });
  }
  const values = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  return {
    date: `${values.year}-${values.month}-${values.day}`,
    minute: Number(values.hour) * 60 + Number(values.minute),
    weekday: WEEKDAY_NUMBER[String(values.weekday).toLowerCase()] ?? 1,
  };
}

function addDays(iso: string, days: number): string {
  const value = new Date(`${iso}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function isScheduledRuleActive(rule: ScheduledSettingRule, now = new Date()): boolean {
  if (!rule.enabled) return false;
  const current = parts(now, rule.timeZone);
  if (rule.startDate && current.date < rule.startDate) return false;
  const crossesMidnight = rule.startMinute > rule.endMinute;
  if (rule.endDate && current.date > rule.endDate) {
    const nextDate = crossesMidnight ? addDays(rule.endDate, 1) : null;
    if (current.date !== nextDate || current.minute >= rule.endMinute) return false;
  }
  if (!rule.weekdays.includes(current.weekday)) return false;
  const inWindow = rule.startMinute < rule.endMinute
    ? current.minute >= rule.startMinute && current.minute < rule.endMinute
    : current.minute >= rule.startMinute || current.minute < rule.endMinute;
  return inWindow;
}

/** Resolve temporary scheduled values without mutating the recoverable base settings. */
export function resolveScheduledSettings(base: UserSettings, config: ScheduleConfig, now = new Date(), external: ExternalScheduleResolution = {}): UserSettings {
  const result: UserSettings = { ...base };
  const active = config.rules
    .filter((rule) => isScheduledRuleActive(rule, now))
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
  for (const rule of active) {
    const source = rule.source?.kind ?? 'local';
    const externalState = external[rule.id];
    // Home Assistant is a boolean gate: an off, failed, or missing-token entity
    // leaves the recoverable base (or another matching rule) untouched.
    if (source === 'home-assistant' && externalState?.state !== 'active') continue;
    const values = source === 'api' && externalState?.state === 'active' && externalState.values
      ? { ...rule.values, ...externalState.values }
      : rule.values;
    Object.assign(result, values);
  }
  return result;
}
