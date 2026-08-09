import type { UserSettings } from './contracts.js';

/** Apply only the temporary presentation lock; the caller keeps its base settings unchanged. */
export function applySchoolModePresentation(settings: UserSettings, enabled: boolean): UserSettings {
  return enabled ? { ...settings, language: 'en', englishFunnyLevel: 1, cantoneseFunnyLevel: 1 } : { ...settings };
}

export function schoolModeHiddenSetting(key: keyof UserSettings): boolean {
  return key === 'language' || key === 'englishFunnyLevel' || key === 'cantoneseFunnyLevel'
    || key === 'narratorLanguage' || key === 'narratorEnabled' || key === 'narratorReducedSound';
}
