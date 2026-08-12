export const SCHEDULE_STORAGE_KEY = 'ding-ding-docs:schedule:v1';
export const SCHEDULE_SCHEMA_VERSION = 1;
export const SCHEDULE_MAX_RULES = 32;
export const SCHEDULE_MAX_BYTES = 64000;
export const SCHEDULE_FIELDS = ['mode', 'funnyEn', 'funnyYue', 'theme', 'density', 'accent', 'displayName'];
export const SCHEDULE_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

const allowedRuleKeys = new Set(['id', 'label', 'enabled', 'priority', 'startDate', 'endDate', 'startTime', 'endTime', 'weekdays', 'values']);
const allowedValues = new Set(SCHEDULE_FIELDS);
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,47}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export const EMPTY_SCHEDULE = Object.freeze({ schemaVersion: SCHEDULE_SCHEMA_VERSION, rules: [] });

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validDate(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.valueOf()) && date.getFullYear() === Number(value.slice(0, 4)) && date.getMonth() + 1 === Number(value.slice(5, 7)) && date.getDate() === Number(value.slice(8, 10));
}

function validTime(value) {
  return value === '' || (typeof value === 'string' && timePattern.test(value));
}

function validFieldValue(field, value) {
  if (field === 'mode') return value === 'en' || value === 'yue' || value === 'both';
  if (field === 'funnyEn' || field === 'funnyYue') return Number.isInteger(value) && value >= 1 && value <= 5;
  if (field === 'theme') return value === 'system' || value === 'light' || value === 'dark';
  if (field === 'density') return value === 'comfortable' || value === 'compact' || value === 'spacious';
  if (field === 'accent') return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
  if (field === 'displayName') return typeof value === 'string' && value.length >= 1 && value.length <= 64 && !/[\u0000-\u001f\u007f]/.test(value);
  return false;
}

export function validateRule(input) {
  if (!isPlainObject(input)) return { ok: false, reason: 'rule-not-object' };
  for (const key of Object.keys(input)) if (!allowedRuleKeys.has(key)) return { ok: false, reason: 'unknown-rule-field' };
  const id = input.id;
  if (typeof id !== 'string' || !idPattern.test(id)) return { ok: false, reason: 'invalid-id' };
  if (typeof input.label !== 'string' || input.label.length < 1 || input.label.length > 96 || /[\u0000-\u001f\u007f]/.test(input.label)) return { ok: false, reason: 'invalid-label' };
  if (typeof input.enabled !== 'boolean') return { ok: false, reason: 'invalid-enabled' };
  if (!Number.isInteger(input.priority) || input.priority < -100000 || input.priority > 100000) return { ok: false, reason: 'invalid-priority' };
  for (const key of ['startDate', 'endDate']) if (typeof input[key] !== 'string' || !validDate(input[key])) return { ok: false, reason: `invalid-${key}` };
  for (const key of ['startTime', 'endTime']) if (typeof input[key] !== 'string' || !validTime(input[key])) return { ok: false, reason: `invalid-${key}` };
  if ((input.startDate === '') !== (input.endDate === '')) return { ok: false, reason: 'partial-date-bounds' };
  if ((input.startTime === '') !== (input.endTime === '')) return { ok: false, reason: 'partial-time-bounds' };
  if (input.startTime !== '' && input.startTime === input.endTime) return { ok: false, reason: 'equal-time-bounds' };
  if (input.startDate !== '' && input.endDate < input.startDate) return { ok: false, reason: 'reversed-date-bounds' };
  if (!Array.isArray(input.weekdays) || input.weekdays.length > 7 || input.weekdays.some((day) => !Number.isInteger(day) || !SCHEDULE_WEEKDAYS.includes(day)) || new Set(input.weekdays).size !== input.weekdays.length) return { ok: false, reason: 'invalid-weekdays' };
  if (!isPlainObject(input.values) || Object.keys(input.values).length < 1) return { ok: false, reason: 'empty-values' };
  for (const field of Object.keys(input.values)) if (!allowedValues.has(field) || !validFieldValue(field, input.values[field])) return { ok: false, reason: `invalid-value-${field}` };
  return { ok: true, rule: { id, label: input.label, enabled: input.enabled, priority: input.priority, startDate: input.startDate, endDate: input.endDate, startTime: input.startTime, endTime: input.endTime, weekdays: [...input.weekdays].sort((a, b) => a - b), values: { ...input.values } } };
}

export function validateSchedule(input) {
  if (!isPlainObject(input) || input.schemaVersion !== SCHEDULE_SCHEMA_VERSION || !Array.isArray(input.rules) || input.rules.length > SCHEDULE_MAX_RULES) return { ok: false, reason: 'invalid-schedule' };
  const seen = new Set(); const rules = [];
  for (const candidate of input.rules) {
    const result = validateRule(candidate);
    if (!result.ok) return result;
    if (seen.has(result.rule.id)) return { ok: false, reason: 'duplicate-id' };
    seen.add(result.rule.id); rules.push(result.rule);
  }
  return { ok: true, schedule: { schemaVersion: SCHEDULE_SCHEMA_VERSION, rules } };
}

export function parseScheduleJson(value) {
  try {
    if (typeof value !== 'string') return { ok: false, reason: 'malformed-json' };
    if (new TextEncoder().encode(value).byteLength > SCHEDULE_MAX_BYTES) return { ok: false, reason: 'oversize' };
    if (hasDuplicateJsonKeys(value)) return { ok: false, reason: 'duplicate-key' };
    return validateSchedule(JSON.parse(value));
  } catch { return { ok: false, reason: 'malformed-json' }; }
}

function hasDuplicateJsonKeys(source) {
  let index = 0;
  const skip = () => { while (/\s/.test(source[index] ?? '')) index += 1; };
  const string = () => {
    if (source[index] !== '"') throw new Error('string');
    index += 1; let value = '';
    while (index < source.length) {
      const char = source[index++];
      if (char === '\\') { value += char + (source[index++] ?? ''); continue; }
      if (char === '"') return value;
      value += char;
    }
    throw new Error('string');
  };
  const value = () => {
    skip();
    if (source[index] === '{') { if (object()) throw new Error('duplicate'); return; }
    if (source[index] === '[') { index += 1; skip(); if (source[index] === ']') { index += 1; return; } while (true) { value(); skip(); if (source[index] === ']') { index += 1; return; } if (source[index++] !== ',') throw new Error('array'); } }
    if (source[index] === '"') { string(); return; }
    const match = source.slice(index).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
    if (!match) throw new Error('value');
    index += match[0].length;
  };
  const object = () => {
    index += 1; skip(); const keys = new Set();
    if (source[index] === '}') { index += 1; return; }
    while (true) {
      skip(); const key = string(); if (keys.has(key)) return true; keys.add(key); skip(); if (source[index++] !== ':') throw new Error('object'); value(); skip(); if (source[index] === '}') { index += 1; return false; } if (source[index++] !== ',') throw new Error('object');
    }
  };
  const walk = () => { skip(); if (source[index] === '{') return object(); value(); return false; };
  const duplicate = walk(); skip(); if (index !== source.length) throw new Error('trailing'); return duplicate;
}

export function loadSchedule(storage) {
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    if (!storage || typeof storage.getItem !== 'function') return { ...EMPTY_SCHEDULE, rules: [], unavailable: true };
    const raw = storage?.getItem(SCHEDULE_STORAGE_KEY);
    if (!raw) return { ...EMPTY_SCHEDULE, rules: [] };
    const parsed = parseScheduleJson(raw);
    return parsed.ok ? parsed.schedule : { ...EMPTY_SCHEDULE, rules: [], corrupt: true };
  } catch { return { ...EMPTY_SCHEDULE, rules: [], unavailable: true }; }
}

export function saveSchedule(schedule, storage) {
  const checked = validateSchedule(schedule);
  if (!checked.ok) return { ok: false, reason: checked.reason };
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    if (!storage || typeof storage.setItem !== 'function' || typeof storage.getItem !== 'function') return { ok: false, reason: 'storage-unavailable' };
    const serialized = JSON.stringify(checked.schedule); storage.setItem(SCHEDULE_STORAGE_KEY, serialized);
    if (storage.getItem(SCHEDULE_STORAGE_KEY) !== serialized) return { ok: false, reason: 'storage-readback-mismatch' };
    return { ok: true, schedule: checked.schedule };
  } catch { return { ok: false, reason: 'storage-unavailable' }; }
}

function localDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function dayKey(date) {
  return `${date.getFullYear().toString().padStart(4, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
}

function dateAt(date, time) {
  const result = new Date(date);
  if (!time) result.setHours(0, 0, 0, 0); else { const [hour, minute] = time.split(':').map(Number); result.setHours(hour, minute, 0, 0); }
  return result;
}

function activeOnAnchor(rule, anchor, now) {
  if (!rule.enabled) return false;
  if (rule.weekdays.length && !rule.weekdays.includes(anchor.getDay())) return false;
  if (rule.startDate && dayKey(anchor) < rule.startDate) return false;
  if (rule.endDate && dayKey(anchor) > rule.endDate) return false;
  const start = dateAt(anchor, rule.startTime);
  if (!rule.startTime) return dayKey(anchor) === dayKey(now);
  let end = dateAt(anchor, rule.endTime);
  if (rule.endDate && dayKey(anchor) === rule.endDate && end <= start) return false;
  if (end <= start) end.setDate(end.getDate() + 1);
  return now >= start && now < end;
}

export function isRuleActive(rule, now = new Date()) {
  const anchor = new Date(now); anchor.setHours(0, 0, 0, 0);
  if (activeOnAnchor(rule, anchor, now)) return true;
  if (rule.startTime && rule.endTime) { const previous = new Date(anchor); previous.setDate(previous.getDate() - 1); if (rule.endDate && dayKey(previous) > rule.endDate) return false; return activeOnAnchor(rule, previous, now); }
  return false;
}

export function resolveSchedule(base, schedule, now = new Date()) {
  const checked = validateSchedule(schedule);
  if (!checked.ok) return { effective: { ...base }, activeRule: null, activeRuleIds: [] };
  const active = checked.schedule.rules.filter((rule) => isRuleActive(rule, now)).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  const winner = active[0] ?? null;
  return { effective: winner ? { ...base, ...winner.values } : { ...base }, activeRule: winner, activeRuleIds: active.map((rule) => rule.id) };
}
