import type { UserSettings } from '../shared/contracts';

export interface LabelPair { en: string; yue: string }

/** The one bilingual label helper. English, Cantonese, or both, exactly as the language mode asks. */
export function label(settings: UserSettings, en: string, yue: string): string {
  if (settings.language === 'en') return en;
  if (settings.language === 'yue') return yue;
  return `${en} · ${yue}`;
}

export const labelOf = (settings: UserSettings, value: LabelPair): string => label(settings, value.en, value.yue);

export function formatMinutes(settings: UserSettings, minutes: number): string {
  if (minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return label(settings, `${days} day${days === 1 ? '' : 's'}`, `${days} 日`);
  }
  if (minutes >= 60 && minutes % 60 === 0) {
    const hours = minutes / 60;
    return label(settings, `${hours} hour${hours === 1 ? '' : 's'}`, `${hours} 小時`);
  }
  return label(settings, `${minutes} minutes`, `${minutes} 分鐘`);
}

export function formatClock(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60) % 24;
  const minute = ((minuteOfDay % 60) + 60) % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export const clockToMinutes = (value: string): number => {
  const [hour, minute] = value.split(':');
  const total = Number(hour) * 60 + Number(minute);
  return Number.isFinite(total) ? Math.min(1439, Math.max(0, Math.round(total))) : 0;
};

export function formatAbsolute(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

export function formatRelative(settings: UserSettings, iso: string, now = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const seconds = Math.round((time - now) / 1000);
  const past = seconds < 0;
  const magnitude = Math.abs(seconds);
  const [amount, unitEn, unitYue] =
    magnitude < 60 ? [magnitude, 'second', '秒'] :
    magnitude < 3600 ? [Math.round(magnitude / 60), 'minute', '分鐘'] :
    magnitude < 86_400 ? [Math.round(magnitude / 3600), 'hour', '小時'] :
    [Math.round(magnitude / 86_400), 'day', '日'];
  const english = past ? `${amount} ${unitEn}${amount === 1 ? '' : 's'} ago` : `in ${amount} ${unitEn}${amount === 1 ? '' : 's'}`;
  const cantonese = past ? `${amount} ${unitYue}前` : `${amount} ${unitYue}後`;
  return label(settings, english, cantonese);
}
