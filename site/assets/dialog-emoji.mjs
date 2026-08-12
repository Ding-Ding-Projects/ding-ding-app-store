export const SITE_DIALOG_EMOJI_STORAGE_KEY = 'ding-ding-docs:showEmojisInDialogs';

function browserStorage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export function readDialogEmojiPreference(storage) {
  try { return (storage ?? browserStorage())?.getItem?.(SITE_DIALOG_EMOJI_STORAGE_KEY) !== 'false'; } catch { return true; }
}

export function writeDialogEmojiPreference(enabled, storage) {
  try {
    const target = storage ?? browserStorage();
    if (!target?.setItem) return false;
    target.setItem(SITE_DIALOG_EMOJI_STORAGE_KEY, String(Boolean(enabled)));
    return true;
  } catch { return false; }
}

export function shouldShowDialogEmoji(enabled, restricted) {
  return Boolean(enabled) && !Boolean(restricted);
}
