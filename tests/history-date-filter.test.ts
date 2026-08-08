import { describe, expect, it } from 'vitest';
import { dateKey, matchesHistoryDate, parseHistoryDate, presetRange, resolveHistoryDateRange } from '../src/renderer/history-date-filter';

describe('history date filter', () => {
  it('accepts ISO and locale-shaped dates while rejecting invalid or partial values', () => {
    expect(Number.isFinite(parseHistoryDate('2026-08-08'))).toBe(true);
    expect(Number.isFinite(parseHistoryDate('08/08/2026'))).toBe(true);
    expect(Number.isFinite(parseHistoryDate('08/08/2026', 'yue'))).toBe(true);
    expect(Number.isNaN(parseHistoryDate('2026-02'))).toBe(true);
    expect(Number.isNaN(parseHistoryDate('2026-02-31'))).toBe(true);
  });

  it('keeps invalid and reversed ranges explicit instead of silently broadening them', () => {
    expect(resolveHistoryDateRange('2026-02', '').error).toMatch(/incomplete/);
    expect(resolveHistoryDateRange('2026-08-09', '2026-08-08').error).toMatch(/before/);
    expect(resolveHistoryDateRange('2026-08-08', '2026-08-08').error).toBe('');
  });

  it('matches inclusive local-day ranges and named presets', () => {
    const range = resolveHistoryDateRange('2026-08-08', '2026-08-08');
    expect(matchesHistoryDate('2026-08-08T23:59:00', range)).toBe(true);
    expect(matchesHistoryDate('2026-08-09T00:00:00', range)).toBe(false);
    expect(presetRange('today', new Date(2026, 7, 8))).toEqual({ start: '2026-08-08', end: '2026-08-08' });
    expect(dateKey(new Date(2026, 7, 8))).toBe('2026-08-08');
  });
});
