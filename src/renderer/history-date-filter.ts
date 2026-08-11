export type HistoryDatePreset = 'all' | 'today' | '7d' | '30d';
export type HistoryDateLanguage = 'en' | 'yue' | 'bilingual';

export type HistoryDateRange = {
  start: string;
  end: string;
  error: string;
};

function validDate(year: number, month: number, day: number): Date | null {
  const candidate = new Date(year, month - 1, day);
  if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return null;
  return candidate;
}

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseHistoryDate(value: string, language: HistoryDateLanguage = 'en'): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))?.getTime() ?? Number.NaN;
  const slash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const first = Number(slash[1]);
    const second = Number(slash[2]);
    const year = Number(slash[3]);
    const english = validDate(year, first, second);
    const cantonese = validDate(year, second, first);
    if (language === 'yue') return cantonese?.getTime() ?? Number.NaN;
    if (language === 'bilingual') {
      // Bilingual mode accepts either common order. When both are valid, keep
      // the English-first interpretation deterministic; ISO remains available
      // whenever the user wants to remove that ambiguity.
      return (second > 12 ? english : first > 12 ? cantonese : english ?? cantonese)?.getTime() ?? Number.NaN;
    }
    return english?.getTime() ?? Number.NaN;
  }
  if (/^\d{1,4}([-/]\d{0,2})?$/.test(trimmed)) return Number.NaN;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function resolveHistoryDateRange(start: string, end: string, language: HistoryDateLanguage = 'en'): HistoryDateRange {
  const startTime = parseHistoryDate(start, language);
  const endTime = parseHistoryDate(end, language);
  if (Number.isNaN(startTime)) return { start, end, error: 'Start date is incomplete or invalid. Your typed value was kept.' };
  if (Number.isNaN(endTime)) return { start, end, error: 'End date is incomplete or invalid. Your typed value was kept.' };
  if (startTime !== null && endTime !== null && startTime > endTime) return { start, end, error: 'Start date must be before the end date. Your typed values were kept.' };
  return { start, end, error: '' };
}

export function matchesHistoryDate(occurredAt: string, range: HistoryDateRange, language: HistoryDateLanguage = 'en'): boolean {
  if (range.error) return false;
  const occurred = new Date(occurredAt).getTime();
  if (!Number.isFinite(occurred)) return false;
  const start = parseHistoryDate(range.start, language);
  const end = parseHistoryDate(range.end, language);
  if (start !== null && occurred < start) return false;
  if (end !== null) {
    const endDate = new Date(end);
    endDate.setHours(23, 59, 59, 999);
    if (occurred > endDate.getTime()) return false;
  }
  return true;
}

export function presetRange(preset: HistoryDatePreset, now = new Date()): Pick<HistoryDateRange, 'start' | 'end'> {
  if (preset === 'all') return { start: '', end: '' };
  const end = new Date(now);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (preset === 'today' ? 0 : preset === '7d' ? 6 : 29));
  return { start: dateKey(start), end: dateKey(end) };
}
