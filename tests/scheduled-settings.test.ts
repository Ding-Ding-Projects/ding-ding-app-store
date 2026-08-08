import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEDULE } from '../src/shared/contracts';
import { isScheduledRuleActive, resolveScheduledSettings } from '../src/shared/scheduled-settings';

const rule = (overrides: Record<string, unknown> = {}) => ({
  id: 'rule_aaaa1111', label: 'Night mode', enabled: true, startDate: null, endDate: null,
  startMinute: 22 * 60, endMinute: 7 * 60, weekdays: [1, 2, 3, 4, 5, 6, 7], timeZone: 'UTC', priority: 50,
  values: { theme: 'dark' as const }, ...overrides,
});

describe('scheduled setting resolution', () => {
  it('handles cross-midnight windows and explicit weekdays in the rule timezone', () => {
    expect(isScheduledRuleActive(rule(), new Date('2026-08-10T23:30:00.000Z'))).toBe(true);
    expect(isScheduledRuleActive(rule(), new Date('2026-08-11T05:30:00.000Z'))).toBe(true);
    expect(isScheduledRuleActive(rule(), new Date('2026-08-11T12:00:00.000Z'))).toBe(false);
    expect(isScheduledRuleActive(rule({ weekdays: [1] }), new Date('2026-08-11T23:30:00.000Z'))).toBe(false);
    expect(isScheduledRuleActive(rule({ startDate: '2026-08-10', endDate: '2026-08-10' }), new Date('2026-08-11T05:30:00.000Z'))).toBe(true);
  });

  it('honours date boundaries and priority while keeping the base recoverable', () => {
    const config = { ...DEFAULT_SCHEDULE, rules: [
      rule({ id: 'rule_aaaa1111', startDate: '2026-08-10', endDate: '2026-08-10', values: { theme: 'dark' as const }, priority: 50 }),
      rule({ id: 'rule_bbbb2222', startDate: '2026-08-10', endDate: '2026-08-10', values: { theme: 'light' as const }, priority: 10 }),
    ] };
    const base = { language: 'bilingual' as const, englishFunnyLevel: 2, cantoneseFunnyLevel: 4, theme: 'system' as const, density: 'comfortable' as const, accent: '#6750A4', displayName: 'Ding Ding App Store', automaticRepairConsent: false };
    expect(resolveScheduledSettings(base, config, new Date('2026-08-10T23:30:00.000Z')).theme).toBe('dark');
    expect(resolveScheduledSettings(base, config, new Date('2026-08-11T23:30:00.000Z')).theme).toBe('system');
    expect(base.theme).toBe('system');
  });
});
