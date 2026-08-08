import { describe, expect, it } from 'vitest';
import { DEFAULT_USER_SETTINGS, TOKEN_IDS } from '../src/shared/contracts';
import {
  APPEARANCE_EXPLANATION_KEYS,
  SCHEDULE_EXPLANATION_KEYS,
  SCHEDULE_FIELDS,
  SETTING_FIELDS,
  SETTINGS_EXPLANATION_KEYS,
  TOKEN_META,
} from '../src/renderer/registry';

describe('settings explanation and provenance completeness', () => {
  it('keeps the hand-written settings list aligned with every setting field', () => {
    expect(new Set(SETTINGS_EXPLANATION_KEYS)).toEqual(new Set(SETTING_FIELDS.map((field) => field.key)));
    for (const field of SETTING_FIELDS) {
      expect(field.explanation.en.length, field.key).toBeGreaterThan(20);
      expect(field.explanation.yue.length, field.key).toBeGreaterThan(6);
      expect(field.defaultValue, field.key).toBeTruthy();
    }
    expect(DEFAULT_USER_SETTINGS.accent).toBe('#6750A4');
  });

  it('keeps the hand-written schedule list and metadata complete', () => {
    expect(new Set(SCHEDULE_EXPLANATION_KEYS)).toEqual(new Set(SCHEDULE_FIELDS.map((field) => field.key)));
    for (const field of SCHEDULE_FIELDS) {
      expect(field.explanation.en.length, field.key).toBeGreaterThan(20);
      expect(field.explanation.yue.length, field.key).toBeGreaterThan(6);
      expect(field.defaultValue, field.key).toBeTruthy();
    }
  });

  it('covers every appearance token with a real explanation and fallback', () => {
    expect(new Set(APPEARANCE_EXPLANATION_KEYS)).toEqual(new Set(TOKEN_IDS));
    for (const token of APPEARANCE_EXPLANATION_KEYS) {
      expect(TOKEN_META[token].explanation.en.length, token).toBeGreaterThan(20);
      expect(TOKEN_META[token].explanation.yue.length, token).toBeGreaterThan(6);
      expect(TOKEN_META[token].defaultValue, token).toBeTruthy();
    }
  });
});
