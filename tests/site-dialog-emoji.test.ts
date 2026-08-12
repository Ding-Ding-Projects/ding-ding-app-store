import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { readDialogEmojiPreference, shouldShowDialogEmoji, writeDialogEmojiPreference, SITE_DIALOG_EMOJI_STORAGE_KEY } from '../site/assets/dialog-emoji.mjs';

const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) };
};

describe('static site dialog emoji preference', () => {
  it('defaults on, persists an explicit off value, and fails closed when storage is unavailable', () => {
    const local = storage();
    expect(readDialogEmojiPreference(local)).toBe(true);
    expect(writeDialogEmojiPreference(false, local)).toBe(true);
    expect(readDialogEmojiPreference(local)).toBe(false);
    expect(readDialogEmojiPreference({ getItem: () => { throw new Error('blocked'); } })).toBe(true);
    expect(writeDialogEmojiPreference(true, { setItem: () => { throw new Error('blocked'); } })).toBe(false);
    expect(SITE_DIALOG_EMOJI_STORAGE_KEY).toBe('ding-ding-docs:showEmojisInDialogs');
  });

  it('suppresses decoration under the site restricted boundary', () => {
    expect(shouldShowDialogEmoji(true, false)).toBe(true);
    expect(shouldShowDialogEmoji(false, false)).toBe(false);
    expect(shouldShowDialogEmoji(true, true)).toBe(false);
  });

  it('wires a local checkbox, palette decoration, suppression, search, and palette destination', async () => {
    const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../site/assets/app.js', import.meta.url), 'utf8');
    expect(html).toContain('id="show-emojis-in-dialogs"');
    expect(html).toContain('id="palette-title-emoji" aria-hidden="true"');
    expect(app).toContain("./dialog-emoji.mjs");
    expect(app).toContain('setting-show-emojis-in-dialogs');
    expect(app).toContain('shouldShowDialogEmoji(state.showEmojisInDialogs, restricted())');
    expect(html).toContain('data-settings-text="show emojis dialogs message boxes decoration accessibility"');
    expect(app).toContain("writeDialogEmojiPreference(state.showEmojisInDialogs)");
  });
});
