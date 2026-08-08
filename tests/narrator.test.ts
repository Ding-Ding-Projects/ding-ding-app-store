import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_SETTINGS } from '../src/shared/contracts';
import { NarratorQueue, narratorLines } from '../src/renderer/narrator';

describe('optional narrator', () => {
  it('is disabled by default and serializes English before Cantonese when enabled', () => {
    expect(narratorLines(DEFAULT_USER_SETTINGS, 'success', 'Settings saved.')).toEqual([]);
    const settings = { ...DEFAULT_USER_SETTINGS, narratorEnabled: true, narratorLanguage: 'both' as const };
    expect(narratorLines(settings, 'success', 'Settings saved.').map((line) => line.lang)).toEqual(['en-US', 'zh-HK']);
  });

  it('keeps factual notification text while funny levels only wrap its voice', () => {
    const serious = narratorLines({ ...DEFAULT_USER_SETTINGS, narratorEnabled: true, narratorLanguage: 'en', englishFunnyLevel: 1 }, 'error', 'Update failed: retry.')[0];
    const playful = narratorLines({ ...DEFAULT_USER_SETTINGS, narratorEnabled: true, narratorLanguage: 'en', englishFunnyLevel: 5 }, 'error', 'Update failed: retry.')[0];
    expect(serious.text).toContain('Update failed: retry.');
    expect(playful.text).toContain('Update failed: retry.');
    expect(playful.text).toContain('Tiny gong');
  });

  it('replaces queued stale notices, never overlaps speech, and cools routine categories', () => {
    const spoken: string[] = [];
    let finish: (() => void) | undefined;
    let clock = 1_000;
    const queue = new NarratorQueue({ available: () => true, speak: (line, onEnd) => { spoken.push(line.text); finish = onEnd; }, cancel: () => undefined }, () => clock);
    const options = { quiet: false, reducedSound: false, screenReaderActive: false };
    expect(queue.enqueue([{ lang: 'en-US', text: 'first' }], 'progress', options)).toBe(true);
    expect(queue.enqueue([{ lang: 'en-US', text: 'stale' }], 'error', options)).toBe(true);
    expect(queue.enqueue([{ lang: 'en-US', text: 'newest' }], 'warning', options)).toBe(true);
    expect(spoken).toEqual(['first']);
    finish?.();
    expect(spoken).toEqual(['first', 'newest']);
    clock += 100;
    expect(queue.enqueue([{ lang: 'en-US', text: 'too soon' }], 'warning', options)).toBe(false);
    expect(queue.enqueue([{ lang: 'en-US', text: 'must speak' }], 'error', options)).toBe(true);
  });

  it('yields under quiet hours, reduced sound, and an active accessibility integration', () => {
    const queue = new NarratorQueue({ available: () => true, speak: () => undefined, cancel: () => undefined });
    const lines = [{ lang: 'en-US' as const, text: 'fact' }];
    expect(queue.enqueue(lines, 'success', { quiet: true, reducedSound: false, screenReaderActive: false })).toBe(false);
    expect(queue.enqueue(lines, 'success', { quiet: false, reducedSound: true, screenReaderActive: false })).toBe(false);
    expect(queue.enqueue(lines, 'success', { quiet: false, reducedSound: false, screenReaderActive: true })).toBe(false);
  });

  it('cancels an in-flight utterance when narration is disabled or suppressed', () => {
    let cancelled = 0;
    const queue = new NarratorQueue({ available: () => true, speak: () => undefined, cancel: () => { cancelled += 1; } });
    queue.stop();
    expect(cancelled).toBe(1);
  });
});
