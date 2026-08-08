import type { UserSettings } from '../shared/contracts';

/** Categories keep routine speech infrequent without suppressing actual errors. */
export type NarratorCategory = 'general' | 'success' | 'progress' | 'warning' | 'error';

export interface NarratorLine {
  text: string;
  lang: 'en-US' | 'zh-HK';
}

export interface SpeechPort {
  available(): boolean;
  speak(line: NarratorLine, onEnd: () => void): void;
  cancel(): void;
}

export const NARRATOR_COOLDOWN_MS = 5_000;

function styled(language: 'en' | 'yue', level: number, category: NarratorCategory, fact: string): string {
  const severity = category === 'error' ? (language === 'en' ? 'Needs attention.' : '要留意。') : (language === 'en' ? 'Update.' : '更新。');
  if (level <= 1) return `${severity} ${fact}`;
  if (level >= 5) return language === 'en'
    ? `${severity} Tiny gong, real facts: ${fact}`
    : `${severity} 小鑼響一響，事實照舊：${fact}`;
  if (level >= 3) return language === 'en'
    ? `${severity} Here is the straight scoop: ${fact}`
    : `${severity} 講清講楚：${fact}`;
  return `${severity} ${fact}`;
}

/** Builds ordered utterances. Both always keeps English before Hong Kong Cantonese. */
export function narratorLines(settings: UserSettings, category: NarratorCategory, message: string): NarratorLine[] {
  const fact = message.trim().slice(0, 500);
  if (!fact || !settings.narratorEnabled) return [];
  const english: NarratorLine = { lang: 'en-US', text: styled('en', settings.englishFunnyLevel, category, fact) };
  const cantonese: NarratorLine = { lang: 'zh-HK', text: styled('yue', settings.cantoneseFunnyLevel, category, fact) };
  if (settings.narratorLanguage === 'en') return [english];
  if (settings.narratorLanguage === 'yue') return [cantonese];
  return [english, cantonese];
}

/**
 * A renderer-only, one-utterance-at-a-time queue. A newer notice replaces anything
 * still waiting, so an old status can never speak after the state it described changed.
 */
export class NarratorQueue {
  private pending: NarratorLine[] = [];
  private speaking = false;
  private readonly lastByCategory = new Map<NarratorCategory, number>();

  constructor(private readonly port: SpeechPort, private readonly now: () => number = () => Date.now()) {}

  enqueue(lines: readonly NarratorLine[], category: NarratorCategory, options: { quiet: boolean; reducedSound: boolean; screenReaderActive: boolean }): boolean {
    if (!this.port.available() || !lines.length || options.quiet || options.reducedSound || options.screenReaderActive) return false;
    const previous = this.lastByCategory.get(category) ?? Number.NEGATIVE_INFINITY;
    // Error narration remains available even during an error burst; other categories are deliberately quieted.
    if (category !== 'error' && this.now() - previous < NARRATOR_COOLDOWN_MS) return false;
    this.lastByCategory.set(category, this.now());
    this.pending = [...lines];
    this.drain();
    return true;
  }

  stop(): void {
    this.pending = [];
    this.speaking = false;
    this.port.cancel();
  }

  private drain(): void {
    if (this.speaking || !this.pending.length) return;
    const next = this.pending.shift();
    if (!next) return;
    this.speaking = true;
    this.port.speak(next, () => {
      this.speaking = false;
      this.drain();
    });
  }
}

export function browserSpeechPort(): SpeechPort {
  return {
    available: () => typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined',
    speak: (line, onEnd) => {
      const utterance = new SpeechSynthesisUtterance(line.text);
      utterance.lang = line.lang;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
      window.speechSynthesis.speak(utterance);
    },
    cancel: () => { if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel(); },
  };
}
