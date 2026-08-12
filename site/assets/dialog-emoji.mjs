export const SITE_DIALOG_EMOJI_STORAGE_KEY = 'ding-ding-docs:showEmojisInDialogs';

export function readDialogEmojiPreference(storage = globalThis.localStorage) {
  try { return storage?.getItem?.(SITE_DIALOG_EMOJI_STORAGE_KEY) !== 'false'; } catch { return true; }
}

export function writeDialogEmojiPreference(enabled, storage = globalThis.localStorage) {
  try { storage?.setItem?.(SITE_DIALOG_EMOJI_STORAGE_KEY, String(Boolean(enabled))); return true; } catch { return false; }
}

export function shouldShowDialogEmoji(enabled, restricted) {
  return Boolean(enabled) && !Boolean(restricted);
}
