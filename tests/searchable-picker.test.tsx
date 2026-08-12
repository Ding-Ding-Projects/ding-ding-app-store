import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SearchablePicker, filterSearchablePickerOptions, type SearchablePickerOption } from '../src/renderer/components/SearchablePicker';
import type { UserSettings } from '../src/shared/contracts';

const settings: UserSettings = {
  language: 'en', englishFunnyLevel: 1, cantoneseFunnyLevel: 1, theme: 'system', density: 'comfortable',
  accent: '#6750A4', displayName: 'Ding Ding App Store', automaticRepairConsent: false,
};
const options: SearchablePickerOption[] = [
  { value: 'english', en: 'English', yue: '英文' },
  { value: 'cantonese', en: 'Hong Kong Cantonese', yue: '香港粵語' },
  { value: 'bilingual', en: 'English and Cantonese', yue: '英文同粵語' },
];

describe('SearchablePicker', () => {
  it('filters each option list with the shared plain-text and regex matcher', () => {
    expect(filterSearchablePickerOptions(options, { query: 'canton', regex: null }, settings).map((item) => item.value)).toEqual(['cantonese', 'bilingual']);
    expect(filterSearchablePickerOptions(options, { query: '^(English)$', regex: { pattern: '^(English)$', flags: 'iu' } }, settings).map((item) => item.value)).toEqual(['english']);
    expect(filterSearchablePickerOptions(options, { query: '[', regex: { pattern: '[', flags: 'iu' } }, settings)).toEqual([]);
  });

  it('renders an owned listbox, local search field, regex affordance, and current selection', () => {
    const markup = renderToStaticMarkup(createElement(SearchablePicker, { id: 'language', labelText: 'Language', settings, value: 'english', options, onChange: () => undefined }));
    expect(markup).toContain('aria-haspopup="listbox"');
    expect(markup).toContain('aria-expanded="false"');
    expect(markup).toContain('Language');
    expect(markup).toContain('English');
    expect(markup).toContain('searchable-picker');
    expect(markup).not.toContain('<select');
  });

  it('keeps independent instance identity and localized labels in source markup', () => {
    const first = renderToStaticMarkup(createElement(SearchablePicker, { id: 'theme', labelText: 'Theme', settings: { ...settings, language: 'yue' }, value: 'english', options, onChange: () => undefined }));
    const second = renderToStaticMarkup(createElement(SearchablePicker, { id: 'density', labelText: 'Density', settings, value: 'cantonese', options, onChange: () => undefined }));
    expect(first).toContain('id="theme"');
    expect(first).toContain('英文');
    expect(second).toContain('id="density"');
    expect(second).toContain('Hong Kong Cantonese');
    expect(first).not.toContain('id="density"');
    expect(second).not.toContain('id="theme"');
  });

  it('keeps the migrated picker inventory explicit and free of native selects', async () => {
    const { readFile } = await import('node:fs/promises');
    const inventory = [
      'src/renderer/components/AppearancePanel.tsx',
      'src/renderer/components/CommandPalette.tsx',
      'src/renderer/components/ExternalEditorSettings.tsx',
      'src/renderer/pages/AppearanceEditor.tsx',
      'src/renderer/pages/LockSupportPage.tsx',
    ];
    for (const file of inventory) expect(await readFile(file, 'utf8')).not.toContain('<select');
  });
});
