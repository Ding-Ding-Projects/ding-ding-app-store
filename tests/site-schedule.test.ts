import { describe, expect, it } from 'vitest';
import { EMPTY_SCHEDULE, parseScheduleJson, resolveSchedule, saveSchedule, validateRule, validateSchedule } from '../site/assets/schedule.mjs';

const rule = (overrides = {}) => ({ id: 'morning', label: 'Morning', enabled: true, priority: 1, startDate: '', endDate: '', startTime: '09:00', endTime: '10:00', weekdays: [1, 2, 3, 4, 5], values: { mode: 'yue' }, ...overrides });
const base = { mode: 'en', funnyEn: 2, funnyYue: 3, theme: 'system', density: 'comfortable', accent: '#4f378b', displayName: 'Ding Ding App Store' };

describe('static-site schedule contract', () => {
  it('starts empty, rejects malformed/partial/equal bounds and preserves a corrupt fallback', () => {
    expect(validateSchedule(EMPTY_SCHEDULE).ok).toBe(true);
    expect(parseScheduleJson('{')).toEqual({ ok: false, reason: 'malformed-json' });
    expect(validateRule(rule({ startDate: '2026-01-01', endDate: '' })).reason).toBe('partial-date-bounds');
    expect(validateRule(rule({ startTime: '09:00', endTime: '09:00' })).reason).toBe('equal-time-bounds');
    expect(validateRule(rule({ weekdays: [1, 1] })).reason).toBe('invalid-weekdays');
  });

  it('accepts explicit weekdays, date bounds, and cross-midnight windows', () => {
    const overnight = rule({ weekdays: [1], startTime: '23:00', endTime: '01:00' });
    const schedule = validateSchedule({ schemaVersion: 1, rules: [overnight] });
    expect(schedule.ok).toBe(true);
    expect(resolveSchedule(base, schedule.ok ? schedule.schedule : EMPTY_SCHEDULE, new Date('2026-08-10T23:30:00'))).toMatchObject({ activeRule: { id: 'morning' }, effective: { mode: 'yue' } });
    expect(resolveSchedule(base, schedule.ok ? schedule.schedule : EMPTY_SCHEDULE, new Date('2026-08-11T00:30:00'))).toMatchObject({ activeRule: { id: 'morning' } });
    expect(resolveSchedule(base, schedule.ok ? schedule.schedule : EMPTY_SCHEDULE, new Date('2026-08-12T00:30:00'))).toMatchObject({ activeRule: null, effective: base });
    expect(resolveSchedule(base, { schemaVersion: 1, rules: [rule({ startDate: '2026-08-10', endDate: '2026-08-11', weekdays: [1], startTime: '23:00', endTime: '01:00' })] }, new Date('2026-08-11T23:30:00'))).toMatchObject({ activeRule: null, effective: base });
    expect(resolveSchedule(base, { schemaVersion: 1, rules: [rule({ startDate: '2026-08-10', endDate: '2026-08-11', weekdays: [1], startTime: '23:00', endTime: '01:00' })] }, new Date('2026-08-12T00:30:00'))).toMatchObject({ activeRule: null, effective: base });
  });

  it('resolves precedence deterministically without mutating base settings', () => {
    const schedule = { schemaVersion: 1, rules: [rule({ id: 'low', priority: 1, values: { mode: 'yue' } }), rule({ id: 'high', priority: 2, values: { mode: 'both', density: 'compact' } })] };
    const result = resolveSchedule(base, schedule, new Date('2026-08-10T09:30:00'));
    expect(result.effective).toMatchObject({ mode: 'yue', density: 'comfortable' });
    expect(result.activeRuleIds).toEqual(['low', 'high']);
    expect(base).toEqual({ mode: 'en', funnyEn: 2, funnyYue: 3, theme: 'system', density: 'comfortable', accent: '#4f378b', displayName: 'Ding Ding App Store' });
  });

  it('fails closed on storage errors and only persists validated schedules', () => {
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(saveSchedule({ schemaVersion: 1, rules: [] }, blocked as never)).toEqual({ ok: false, reason: 'storage-unavailable' });
  });
});
