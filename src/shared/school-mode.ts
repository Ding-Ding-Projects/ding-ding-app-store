import type { SchoolModeMutationCode, UserSettings } from './contracts.js';

/** Apply only the temporary presentation lock; the caller keeps its base settings unchanged. */
export function applySchoolModePresentation(settings: UserSettings, enabled: boolean): UserSettings {
  return enabled ? {
    ...settings,
    language: 'en',
    englishFunnyLevel: 1,
    cantoneseFunnyLevel: 1,
    narratorEnabled: false,
    narratorLanguage: 'en',
  } : { ...settings };
}

export const SCHOOL_MODE_HIDDEN_APP_IDS = ['dim-sum-atlas'] as const;
export const SCHOOL_MODE_HIDDEN_ARTICLE_IDS = [
  'school-mode',
  'catalog-language',
  'dim-sum-surprise',
  'optional-spoken-narrator',
  'catalog-app-dim-sum-atlas',
] as const;

/**
 * Persisted notification text is not trusted as a School-mode projection.
 * Once the mode is restricted, only semantic School notifications are safe to
 * render: their code is localized against the current verified name. Older
 * free-form records may contain a previous custom name or serialized setting
 * values that cannot be identified reliably at this boundary, so they remain
 * withheld until the mode is verified disabled.
 */
export function schoolModeAllowsNotification(
  value: { schoolModeCode?: SchoolModeMutationCode },
  restricted: boolean,
): boolean {
  return !restricted || value.schoolModeCode !== undefined;
}

/** Activity rows have no semantic School code; withhold them while restricted
 * so raw historical names/settings cannot be rediscovered through the list. */
export function schoolModeAllowsHistoryEntry(restricted: boolean): boolean {
  return !restricted;
}

export function schoolModeHiddenApp(appId: string): boolean {
  return (SCHOOL_MODE_HIDDEN_APP_IDS as readonly string[]).includes(appId);
}

export function schoolModeHiddenArticle(articleId: string): boolean {
  return (SCHOOL_MODE_HIDDEN_ARTICLE_IDS as readonly string[]).includes(articleId);
}

/** Last-resort projection for user-authored notification and history text. */
export function schoolModeHiddenContent(value: string): boolean {
  return /dim[ -]?sum|personal[ -]?vocab(?:ulary)?|cantonese|bilingual|funny(?:[ -]?level)?|english[ -]?only|\bvoice\b|\bnarrator\b|(?:["'`]?(?:language|englishFunnyLevel|cantoneseFunnyLevel|narratorLanguage|narratorEnabled|narratorReducedSound)["'`]?[ \t]*:)|(?:\blanguage\b[ \t]+(?:mode|setting|choice))|幽默|粵語|點心/i.test(value);
}

/** Replace the shipped label at the final user-facing text boundary. */
export function schoolModeDisplayText(value: string, displayName: string): string {
  // Use a callback replacement: a user-chosen name may contain `$&`, `$1`, or
  // another replacement token, and must be rendered literally at this boundary.
  return displayName === 'School mode' ? value : value.replace(/School mode|school mode/g, () => displayName);
}

/** Project untyped provider/operation text before it reaches a restricted UI. */
export function schoolModeRestrictedText(value: string, displayName: string, fallback: string): string {
  if (schoolModeHiddenContent(value)) return fallback;
  return schoolModeDisplayText(value, displayName);
}

/** Keep managed-update state aligned with the catalog projection. */
export function schoolModeProjectManagedUpdates<T>(
  managedUpdates: Record<string, T>,
  visibleAppIds: ReadonlySet<string>,
  restricted: boolean,
): Record<string, T> {
  return restricted
    ? Object.fromEntries(Object.entries(managedUpdates).filter(([appId]) => visibleAppIds.has(appId))) as Record<string, T>
    : { ...managedUpdates };
}

/** Preserve explicitly allowed documentation while removing forbidden lines. */
export function schoolModeDocumentText(value: string, displayName: string): string {
  return schoolModeDisplayText(value, displayName)
    .split(/\r?\n/)
    .filter((line) => !schoolModeHiddenContent(line)
      && !(SCHOOL_MODE_HIDDEN_ARTICLE_IDS as readonly string[]).some((articleId) => line.includes(articleId)))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

export function schoolModeHiddenSetting(key: keyof UserSettings): boolean {
  return key === 'language' || key === 'englishFunnyLevel' || key === 'cantoneseFunnyLevel'
    || key === 'narratorLanguage' || key === 'narratorEnabled' || key === 'narratorReducedSound';
}
