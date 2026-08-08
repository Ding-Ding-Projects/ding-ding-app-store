import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEDULE, DEFAULT_TAB_WORKSPACE, ELEMENTS } from '../src/shared/contracts';
import { buildRegistry, SETTING_FIELDS, SCHEDULE_FIELDS } from '../src/renderer/registry';
import type { UserSettings } from '../src/shared/contracts';
import { readFile } from 'node:fs/promises';

const settings: UserSettings = {
  language: 'bilingual',
  englishFunnyLevel: 2,
  cantoneseFunnyLevel: 4,
  theme: 'system',
  density: 'comfortable',
  accent: '#6750A4',
  displayName: 'Ding Ding App Store',
  automaticRepairConsent: false,
};

const registry = buildRegistry({
  settings,
  workspace: structuredClone(DEFAULT_TAB_WORKSPACE),
  appearance: {},
  schedule: structuredClone(DEFAULT_SCHEDULE),
  apps: [],
});

describe('rich command palette registry', () => {
  it('gives every setting an inline control and an exact settings target', () => {
    for (const field of SETTING_FIELDS) {
      const row = registry.find((entry) => entry.id === `set:${field.key}`);
      expect(row?.control?.kind).toBe(field.kind === 'range' ? 'range' : field.kind);
      expect(row?.action).toMatchObject({
        type: 'set-setting',
        target: {
          surface: field.section === 'general' ? 'settings.general' : 'settings.appearance',
          focusId: `setting-${String(field.key)}`,
        },
      });
    }
  });

  it('exposes controls for schedule fields that have native values', () => {
    for (const field of SCHEDULE_FIELDS.filter((item) => item.kind !== 'rules')) {
      const row = registry.find((entry) => entry.id === `sched:${field.key}`);
      expect(row?.control).toBeTruthy();
      expect(row?.action).toMatchObject({
        type: 'set-schedule',
        target: { surface: 'settings.schedule', focusId: `schedule-${field.key.replace('.', '-')}` },
      });
    }
    expect(registry.find((entry) => entry.id === 'sched:rules')?.control).toBeUndefined();
  });

  it('targets every appearance token at its owning element and gives colour tokens a picker', () => {
    for (const element of ELEMENTS) {
      for (const token of element.tokens) {
        const row = registry.find((entry) => entry.id === `appear:${element.key}:${token}`);
        expect(row?.action).toMatchObject({ type: 'set-appearance', target: element.key, destination: { surface: 'settings.appearance', element: element.key } });
        expect(row?.control).toBeTruthy();
        if (token === 'background' || token === 'foreground') expect(row?.control?.kind).toBe('color');
      }
    }
  });

  it('adds article and tab/group destinations without leaking executable text', () => {
    const article = registry.find((entry) => entry.id.startsWith('cmd:open-doc:'));
    expect(article?.action).toMatchObject({ type: 'command', target: { surface: 'docs', articleId: expect.any(String), focusId: expect.stringMatching(/^docs-tab-/) } });
    const tab = registry.find((entry) => entry.id === 'cmd:pin:catalog');
    expect(tab?.action).toMatchObject({ target: { tabId: 'catalog', focusId: 'tab-catalog' } });
    expect(registry.every((entry) => !Object.values(entry.action).some((value) => typeof value === 'string' && /^(?:https?:|[A-Za-z]:\\|\/)/.test(value)))).toBe(true);
  });
});

describe('rich command palette renderer contract', () => {
  it('renders typed inline controls and a temporary target highlight', async () => {
    const palette = await readFile(new URL('../src/renderer/components/CommandPalette.tsx', import.meta.url), 'utf8');
    const app = await readFile(new URL('../src/renderer/App.tsx', import.meta.url), 'utf8');
    expect(palette).toContain("type=\"range\"");
    expect(palette).toContain("type=\"color\"");
    expect(palette).toContain("type=\"checkbox\"");
    expect(palette).toContain('EntryControl');
    expect(app).toContain("event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'f'");
    expect(app).toContain('data-palette-highlight');
  });
});
