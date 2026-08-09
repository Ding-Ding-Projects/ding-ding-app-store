import type { UserSettings } from '../shared/contracts';

/**
 * Dialog decoration is intentionally limited to title/body copy. Callers must
 * not pass this helper to button labels, field labels, or accessible names.
 */
export function dialogCopy(settings: UserSettings, text: string, emoji: string): string {
  return settings.showEmojisInDialogs ? `${emoji} ${text}` : text;
}
