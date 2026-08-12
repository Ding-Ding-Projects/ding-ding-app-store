// Local-only presentation label for the documentation site. This value is a
// display choice, never an identifier: routes, asset names, and URLs stay fixed.
export const DEFAULT_DISPLAY_NAME = 'Ding Ding App Store';
export const DISPLAY_NAME_MAX_LENGTH = 64;
export const SITE_DISPLAY_NAME_STORAGE_KEY = 'ding-ding-docs:display-name';

function browserStorage() { try { return globalThis.localStorage; } catch { return null; } }
export function sanitizeDisplayName(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > DISPLAY_NAME_MAX_LENGTH || /[\u0000-\u001f\u007f]/u.test(trimmed)) return null;
  return trimmed;
}
export function loadDisplayName(storage) {
  try { return sanitizeDisplayName((storage ?? browserStorage())?.getItem?.(SITE_DISPLAY_NAME_STORAGE_KEY)) ?? DEFAULT_DISPLAY_NAME; }
  catch { return DEFAULT_DISPLAY_NAME; }
}
export function saveDisplayName(value, storage) {
  const sanitized = sanitizeDisplayName(value);
  if (!sanitized) return { ok: false, value: loadDisplayName(storage), reason: 'invalid-display-name' };
  try {
    const target = storage ?? browserStorage();
    if (!target?.setItem) return { ok: false, value: loadDisplayName(storage), reason: 'storage-unavailable' };
    target.setItem(SITE_DISPLAY_NAME_STORAGE_KEY, sanitized);
    return { ok: true, value: sanitized };
  } catch { return { ok: false, value: loadDisplayName(storage), reason: 'storage-unavailable' }; }
}
export function resetDisplayName(storage) {
  try { (storage ?? browserStorage())?.removeItem?.(SITE_DISPLAY_NAME_STORAGE_KEY); } catch { /* fail closed */ }
  return DEFAULT_DISPLAY_NAME;
}
export function displayNameForPresentation(value, restricted = false) { return sanitizeDisplayName(value) ?? DEFAULT_DISPLAY_NAME; }
