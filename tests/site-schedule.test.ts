import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { EMPTY_SCHEDULE, parseScheduleJson, resolveSchedule, saveSchedule, validateRule, validateSchedule } from '../site/assets/schedule.mjs';
import { SCHEDULE_RULE_CONTROL_FIELDS, scheduleRuleMarkup } from '../site/assets/schedule-ui.mjs';

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

  it('gives the shared and weekday help text resolvable ids for every generated control', async () => {
    const [html, app] = await Promise.all([
      readFile(new URL('../site/index.html', import.meta.url), 'utf8'),
      readFile(new URL('../site/assets/app.js', import.meta.url), 'utf8'),
    ]);
    expect(html).toContain('id="schedule-help"');
    const rules = [rule(), rule({ id: 'evening', label: 'Evening', weekdays: [] })];
    const markup = rules.map((item, index) => scheduleRuleMarkup(item, index, (en) => en, (value) => String(value))).join('');
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    const described = [...markup.matchAll(/aria-describedby="([^"]+)"/g)].flatMap((match) => match[1].split(' '));
    expect(described.length).toBe(24);
    for (const target of described) expect(target === 'schedule-help' || ids.includes(target)).toBe(true);
    for (const index of [0, 1]) {
      for (const field of SCHEDULE_RULE_CONTROL_FIELDS) expect(ids).toContain(`schedule-rule-${index}-${field}`);
      expect(ids).toContain(`schedule-rule-${index}-weekdays-help`);
    }
    expect(app).toContain('scheduleRuleMarkup(rule, index, l, escapeHtml');
  });

  it('localizes the full schedule shell while preserving timezone, DST, and local-only boundaries', async () => {
    const [html, app] = await Promise.all([
      readFile(new URL('../site/index.html', import.meta.url), 'utf8'),
      readFile(new URL('../site/assets/app.js', import.meta.url), 'utf8'),
    ]);
    for (const key of ['schedule-tab', 'schedule-help', 'schedule-reset', 'schedule-add', 'schedule-save', 'schedule-boundary', 'schedule-empty']) {
      expect(html).toContain(`data-site-copy="${key}"`);
      expect(app).toContain(`'${key}': [`);
    }
    expect(app).toContain("scheduleStatus(message, messageYue)");
    expect(app).toContain("['Schedule', '排程']");
    expect(app).toContain("localized('Schedule settings', '排程設定')");
    expect(app).toContain('renderedSchedulePresentation !== schedulePresentation');
    expect(app).toContain('local timezone');
    expect(app).toContain('daylight-saving changes follow the browser clock');
    expect(app).toContain('本地時區');
    expect(app).toContain('夏令時間轉換跟瀏覽器時鐘');
    expect(app).toContain('It does not read an operating-system vault, Home Assistant, or an external API');
    expect(app).toContain('唔會讀取作業系統憑證庫、Home Assistant 或外部 API');
  });

  it('indexes and teleports to every generated rule control from settings search and the palette', async () => {
    const [app, ui] = await Promise.all([
      readFile(new URL('../site/assets/app.js', import.meta.url), 'utf8'),
      readFile(new URL('../site/assets/schedule-ui.mjs', import.meta.url), 'utf8'),
    ]);
    for (const field of SCHEDULE_RULE_CONTROL_FIELDS) expect(ui).toContain(`id('${field}')`);
    expect(app).toContain("document.querySelectorAll('#settings-panel-schedule [data-settings-focus]')");
    expect(app).toContain('`Rule ${ruleNumber}: ${ruleLabel} — ${controlLabel}`');
    expect(app).toContain("if (state.settingsTab === 'schedule') filterSettings()");
    expect(app).toContain("renderSchedule(`schedule-rule-${index}-valueField`)");
    expect(app).toContain("targetIndex >= 0 ? `schedule-rule-${targetIndex}-label` : 'schedule-add'");
    expect(app).toContain("renderSchedule(`schedule-rule-${index}-label`)");
    expect(ui).toContain('data-settings-focus="${id(field)}"');
    expect(ui).toContain('data-settings-focus="${id(\'delete\')}"');
    expect(app).toContain('...schedulePaletteControls()');
    expect(app).toContain("id.startsWith('setting-schedule-control-')");
    expect(app).toContain("focusSettingsControl('schedule', id.slice('setting-schedule-control-'.length))");
    expect(app).toContain("search.settings.query = ''");
    expect(app).toContain("control.focus()");
    expect(app).toContain("return document.activeElement === control");
  });
});
