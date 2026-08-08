import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  COLOR_ROLE_VAR,
  DEFAULT_SCHEDULE,
  DEFAULT_TAB_WORKSPACE,
  ELEMENTS,
  ELEMENT_KEYS,
  ELEVATIONS,
  ELEVATION_SHADOW,
  MAX_IMPORT_BYTES,
  MAX_TOKENS_PER_ELEMENT,
  RADII,
  RADIUS_PX,
  SCHEDULE_BOUNDS,
  appearanceDocumentSchema,
  appearanceExportSchema,
  scheduleSchema,
  SURFACE_IDS,
  tabWorkspaceSchema,
  toCssVariables,
} from '../src/shared/contracts.js';
import { iconMap } from '../src/renderer/icons';
import { buildRegistry, SCHEDULE_FIELDS } from '../src/renderer/registry';
import type { AppearanceElements, ElementKey, ElementOverride, TabWorkspace } from '../src/shared/contracts.js';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const group = { id: 'grp_abcd1234', name: 'Work', color: 'blue', collapsed: false } as const;

function workspaceWith(mutate: (draft: TabWorkspace) => void): unknown {
  const draft = clone(DEFAULT_TAB_WORKSPACE);
  mutate(draft);
  return draft;
}

describe('tab workspace contract', () => {
  it('round-trips the shipped default workspace', () => {
    const parsed = tabWorkspaceSchema.parse(clone(DEFAULT_TAB_WORKSPACE));
    expect(parsed).toEqual(DEFAULT_TAB_WORKSPACE);
    expect(parsed.tabs.map((tab) => tab.order)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('rejects unknown and duplicated tab ids', () => {
    expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => { draft.tabs[0].id = 'wishlist' as never; })).success).toBe(false);
    expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => { draft.tabs[1].id = draft.tabs[0].id; })).success).toBe(false);
    expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => { draft.tabs.pop(); })).success).toBe(false);
  });

  it('rejects a pinned tab that also claims a group', () => {
    expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => {
      draft.groups = [{ ...group }];
      draft.tabs[0].pinned = true;
      draft.tabs[0].groupId = group.id;
    })).success).toBe(false);
  });

  it('rejects group references that point at no group', () => {
    expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => { draft.tabs[0].groupId = 'grp_zzzzzzzz'; })).success).toBe(false);
    expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => { draft.tabs[0].previousGroupId = 'grp_zzzzzzzz'; })).success).toBe(false);
    expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => {
      draft.groups = [{ ...group }];
      draft.tabs[0].groupId = group.id;
    })).success).toBe(true);
  });

  it('bounds group count, group id shape, and group name length', () => {
    expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => {
      draft.groups = Array.from({ length: 9 }, (_value, index) => ({ ...group, id: `grp_0000000${index}` }));
    })).success).toBe(false);
    expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => { draft.groups = [{ ...group, name: 'x'.repeat(33) }]; })).success).toBe(false);
    expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => { draft.groups = [{ ...group, id: 'group_1' }]; })).success).toBe(false);
  });

  it('bounds the rail width and refuses unknown workspace keys', () => {
    for (const width of [63, 421, 260.5]) {
      expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => { draft.rail.width = width; })).success).toBe(false);
    }
    expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => { draft.rail.width = 64; })).success).toBe(true);
    expect(tabWorkspaceSchema.safeParse({ ...clone(DEFAULT_TAB_WORKSPACE), searches: {} }).success).toBe(false);
    expect(tabWorkspaceSchema.safeParse(workspaceWith((draft) => { (draft.rail as Record<string, unknown>).cornerRadius = 8; })).success).toBe(false);
  });
});

describe('appearance contract', () => {
  const documentWith = (elements: Record<string, unknown>) => ({ schemaVersion: 1, elements });

  it('registers unique, lowercase, bounded element keys', () => {
    expect(new Set(ELEMENT_KEYS).size).toBe(ELEMENT_KEYS.length);
    for (const element of ELEMENTS) {
      expect(element.key).toMatch(/^[a-z][a-z0-9-]{0,31}$/);
      expect(element.en.length).toBeGreaterThan(0);
      expect(element.yue.length).toBeGreaterThan(0);
      expect(element.tokens.length).toBeGreaterThan(0);
      expect(element.tokens.length).toBeLessThanOrEqual(MAX_TOKENS_PER_ELEMENT);
      expect(new Set(element.tokens).size).toBe(element.tokens.length);
    }
  });

  it('rejects unknown element keys and prototype-pollution keys', () => {
    expect(appearanceDocumentSchema.safeParse(documentWith({ 'not-an-element': { radius: 'md' } })).success).toBe(false);
    expect(appearanceDocumentSchema.safeParse(JSON.parse('{"schemaVersion":1,"elements":{"__proto__":{"radius":"md"}}}')).success).toBe(false);
    expect(appearanceDocumentSchema.safeParse(documentWith({ constructor: { radius: 'md' } })).success).toBe(false);
  });

  it('rejects unknown tokens and tokens the element does not expose', () => {
    expect(appearanceDocumentSchema.safeParse(documentWith({ 'app-card': { visibility: 'hidden' } })).success).toBe(false);
    expect(appearanceDocumentSchema.safeParse(documentWith({ 'page-title': { background: { kind: 'role', role: 'error' } } })).success).toBe(false);
    expect(appearanceDocumentSchema.safeParse(documentWith({ 'page-title': { fontWeight: 700 } })).success).toBe(true);
  });

  it('accepts only six-digit hex colours', () => {
    for (const hex of ['#fff', 'red', 'var(--x)', '#fff;color:red', '#12345g']) {
      expect(appearanceDocumentSchema.safeParse(documentWith({ 'app-card': { background: { kind: 'hex', hex } } })).success).toBe(false);
    }
    const parsed = appearanceDocumentSchema.parse(documentWith({ 'app-card': { background: { kind: 'hex', hex: '#ABCDEF' } } }));
    expect(parsed.elements['app-card']?.background).toEqual({ kind: 'hex', hex: '#abcdef' });
  });

  it('bounds numeric scale tokens', () => {
    for (const paddingScale of [49, 201, 125.5]) {
      expect(appearanceDocumentSchema.safeParse(documentWith({ 'app-card': { paddingScale } })).success).toBe(false);
    }
    for (const fontScale of [74, 151]) {
      expect(appearanceDocumentSchema.safeParse(documentWith({ 'app-card': { fontScale } })).success).toBe(false);
    }
    expect(appearanceDocumentSchema.safeParse(documentWith({ 'app-card': { paddingScale: 50, fontScale: 150, borderWidth: 3 } })).success).toBe(true);
    expect(appearanceDocumentSchema.safeParse(documentWith({ 'app-card': { borderWidth: 4 } })).success).toBe(false);
  });

  it('checks the import byte budget before parsing JSON', async () => {
    const oversized = `{"padding":"${'a'.repeat(64_100)}"}`;
    expect(Buffer.byteLength(oversized, 'utf8')).toBeGreaterThan(MAX_IMPORT_BYTES);
    const service = await readFile(new URL('../src/main/appearance-service.ts', import.meta.url), 'utf8');
    const guard = service.indexOf('MAX_IMPORT_BYTES');
    const parse = service.indexOf('JSON.parse(payload)');
    expect(guard).toBeGreaterThan(-1);
    expect(parse).toBeGreaterThan(guard);
  });

  it('round-trips an exported appearance document without loss', () => {
    const elements = {
      'app-card': { background: { kind: 'role', role: 'surface-high' }, radius: 'lg', paddingScale: 125, elevation: '2' },
      'page-title': { fontScale: 140, fontWeight: 700 },
    };
    const exported = appearanceExportSchema.parse({
      kind: 'ding-ding-app-store.appearance',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      appVersion: '0.1.0',
      elements,
    });
    const reimported = appearanceExportSchema.parse(JSON.parse(JSON.stringify(exported)));
    expect(reimported.elements).toEqual(exported.elements);
    expect(appearanceDocumentSchema.parse({ schemaVersion: 1, elements: reimported.elements }).elements).toEqual(elements);
  });

  it('emits only closed, registry-derived CSS custom properties', () => {
    const safeValues = new Set<string>([
      ...Object.values(COLOR_ROLE_VAR),
      ...Object.values(ELEVATION_SHADOW),
      ...Object.values(RADIUS_PX).map((px) => `${px}px`),
    ]);
    const names = new Set(ELEMENTS.flatMap((element) => element.tokens.map((token) => `--elx-${element.key}-${token}`)));
    const hexes = ['#000000', '#ffffff', '#6750a4'];

    for (const element of ELEMENTS) {
      for (const [index, token] of element.tokens.entries()) {
        const override: Record<string, unknown> = {};
        if (token === 'background' || token === 'foreground') {
          override[token] = index % 2 === 0
            ? { kind: 'role', role: Object.keys(COLOR_ROLE_VAR)[index % Object.keys(COLOR_ROLE_VAR).length] }
            : { kind: 'hex', hex: hexes[index % hexes.length] };
        }
        if (token === 'radius') override.radius = RADII[index % RADII.length];
        if (token === 'elevation') override.elevation = ELEVATIONS[index % ELEVATIONS.length];
        if (token === 'paddingScale') override.paddingScale = 50 + index * 5;
        if (token === 'fontScale') override.fontScale = 75 + index * 5;
        if (token === 'fontWeight') override.fontWeight = [400, 500, 600, 700, 800][index % 5];
        if (token === 'borderWidth') override.borderWidth = index % 4;
        const document = appearanceDocumentSchema.parse({ schemaVersion: 1, elements: { [element.key]: override } });
        const pairs = toCssVariables(document.elements as AppearanceElements);
        expect(pairs.length).toBe(1);
        for (const [name, value] of pairs) {
          expect(name.startsWith('--elx-')).toBe(true);
          expect(name.startsWith(`--elx-${element.key}-`)).toBe(true);
          expect(names.size).toBeGreaterThan(0);
          expect(value).not.toMatch(/[;{}<>\n\r]|url\(|@import|expression\(|\/\*/i);
          const closed = safeValues.has(value)
            || /^[0-2]\.\d{2}$/.test(value)
            || /^[4-8]00$/.test(value)
            || /^[0-3]px$/.test(value)
            || /^#[0-9a-f]{6}$/.test(value);
          expect(closed, `${name} = ${value}`).toBe(true);
        }
      }
    }
  });

  it('drops overrides for elements that are not registered', () => {
    const smuggled = { 'app-card': { radius: 'md' }, 'super-confirm': { radius: 'md' } } as unknown as Partial<Record<ElementKey, ElementOverride>>;
    expect(toCssVariables(smuggled).map(([name]) => name)).toEqual(['--elx-app-card-radius']);
  });
});

describe('update schedule contract', () => {
  const scheduleWith = (mutate: (draft: typeof DEFAULT_SCHEDULE) => void): unknown => {
    const draft = clone(DEFAULT_SCHEDULE);
    mutate(draft);
    return draft;
  };

  it('round-trips the shipped default schedule', () => {
    expect(scheduleSchema.parse(clone(DEFAULT_SCHEDULE))).toEqual(DEFAULT_SCHEDULE);
    expect(SCHEDULE_BOUNDS.catalogMinutes.min).toBe(30);
    expect(SCHEDULE_BOUNDS.selfUpdateMinutes.min).toBe(60);
  });

  it('bounds the self-update interval to whole minutes between one hour and one week', () => {
    for (const intervalMinutes of [59, 10_081, 1.5, Number.NaN]) {
      expect(scheduleSchema.safeParse(scheduleWith((draft) => { draft.selfUpdate.intervalMinutes = intervalMinutes; })).success).toBe(false);
    }
    for (const intervalMinutes of [60, 10_080]) {
      expect(scheduleSchema.safeParse(scheduleWith((draft) => { draft.selfUpdate.intervalMinutes = intervalMinutes; })).success).toBe(true);
    }
  });

  it('floors the catalog interval at the catalog cache lifetime', () => {
    expect(scheduleSchema.safeParse(scheduleWith((draft) => { draft.catalogRefresh.intervalMinutes = 29; })).success).toBe(false);
    expect(scheduleSchema.safeParse(scheduleWith((draft) => { draft.catalogRefresh.intervalMinutes = 30; })).success).toBe(true);
  });

  it('refuses unknown schedule keys', () => {
    expect(scheduleSchema.safeParse({ ...clone(DEFAULT_SCHEDULE), notifications: true }).success).toBe(false);
    expect(scheduleSchema.safeParse(scheduleWith((draft) => { (draft.selfUpdate as Record<string, unknown>).enabled = true; })).success).toBe(false);
  });

  it('requires a real quiet-hours window and allows one that wraps midnight', () => {
    expect(scheduleSchema.safeParse(scheduleWith((draft) => {
      draft.quietHours = { enabled: true, startMinute: 1320, endMinute: 1320 };
    })).success).toBe(false);
    expect(scheduleSchema.safeParse(scheduleWith((draft) => {
      draft.quietHours = { enabled: true, startMinute: 1320, endMinute: 1330 };
    })).success).toBe(false);
    expect(scheduleSchema.safeParse(scheduleWith((draft) => {
      draft.quietHours = { enabled: true, startMinute: 1320, endMinute: 420 };
    })).success).toBe(true);
    expect(scheduleSchema.safeParse(scheduleWith((draft) => {
      draft.quietHours = { enabled: false, startMinute: 600, endMinute: 600 };
    })).success).toBe(true);
  });
});

describe('command registry reachability', () => {
  const settings = {
    language: 'bilingual', englishFunnyLevel: 2, cantoneseFunnyLevel: 4,
    theme: 'system', density: 'comfortable', accent: '#6750A4', displayName: 'Ding Ding App Store',
    automaticRepairConsent: false,
  } as const;

  const registry = buildRegistry({
    settings,
    workspace: clone(DEFAULT_TAB_WORKSPACE),
    appearance: {},
    schedule: clone(DEFAULT_SCHEDULE),
    apps: [],
  });

  it('reaches every page surface exactly once', () => {
    for (const surface of SURFACE_IDS) {
      expect(registry.filter((entry) => entry.kind === 'page' && entry.action.type === 'open-surface' && entry.action.surface === surface)).toHaveLength(1);
    }
    expect(registry.filter((entry) => entry.kind === 'page')).toHaveLength(SURFACE_IDS.length);
  });

  it('reaches every user setting exactly once', () => {
    const keys = Object.keys(settings);
    for (const key of keys) {
      expect(registry.filter((entry) => entry.kind === 'setting' && entry.action.type === 'set-setting' && entry.action.key === key)).toHaveLength(1);
    }
    expect(registry.filter((entry) => entry.kind === 'setting')).toHaveLength(keys.length);
  });

  it('reaches every editable element and token pair exactly once', () => {
    let pairs = 0;
    for (const element of ELEMENTS) {
      for (const token of element.tokens) {
        pairs += 1;
        expect(registry.filter((entry) => entry.kind === 'appearance' && entry.action.type === 'set-appearance' && entry.action.target === element.key && entry.action.token === token)).toHaveLength(1);
      }
      expect(registry.some((entry) => entry.action.type === 'command' && entry.action.command === `edit-element:${element.key}`)).toBe(true);
      expect(registry.some((entry) => entry.action.type === 'command' && entry.action.command === `reset-element:${element.key}`)).toBe(true);
    }
    expect(registry.filter((entry) => entry.kind === 'appearance')).toHaveLength(pairs);
  });

  it('reaches every schedule field exactly once', () => {
    for (const field of SCHEDULE_FIELDS) {
      expect(registry.filter((entry) => entry.kind === 'schedule' && entry.action.type === 'set-schedule' && entry.action.key === field.key)).toHaveLength(1);
    }
    expect(registry.filter((entry) => entry.kind === 'schedule')).toHaveLength(SCHEDULE_FIELDS.length);
  });

  it('keeps every entry unique, bilingual, icon-backed, and free of paths or URLs', () => {
    const ids = registry.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    const dangerous = /^(https?:|[A-Za-z]:\\|\/|\.\.)/;
    for (const entry of registry) {
      expect(entry.en.length).toBeGreaterThan(0);
      expect(entry.yue.length).toBeGreaterThan(0);
      expect(iconMap[entry.icon]).toBeTruthy();
      expect(['open-surface', 'set-setting', 'set-appearance', 'set-schedule', 'command']).toContain(entry.action.type);
      for (const value of Object.values(entry.action)) {
        if (typeof value === 'string') expect(dangerous.test(value)).toBe(false);
      }
    }
  });

  it('ships the tab, appearance, and schedule commands the product contract names', () => {
    const commands = new Set(registry.filter((entry) => entry.action.type === 'command').map((entry) => (entry.action as { command: string }).command));
    for (const command of [
      'refresh-catalog', 'clear-all-searches', 'focus-tab-search', 'new-group', 'collapse-all-groups',
      'show-overflow', 'reset-tabs', 'export-tabs', 'import-tabs', 'rail-side:left', 'rail-side:top',
      'label-mode:icon', 'tab-height:tall', 'overflow-mode:scroll', 'toggle-badges', 'toggle-color-bar',
      'toggle-pinned-icon-only', 'toggle-appearance-edit', 'reset-appearance-all', 'export-appearance',
      'import-appearance', 'open-schedule', 'check-store-update', 'refresh-catalog-now',
      'toggle-self-update-repeat', 'toggle-catalog-refresh', 'toggle-quiet-hours', 'apply-quiet-night',
      'show-next-runs', 'self-interval:1440', 'catalog-interval:30', 'pin:catalog', 'move-up:settings',
      'move-down:docs', 'clear-search:activity', 'open-regex:tabs',
    ]) {
      expect(commands.has(command)).toBe(true);
    }
  });
});
