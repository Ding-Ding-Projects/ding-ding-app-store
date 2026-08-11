import { createElement } from 'react';
import { readFile } from 'node:fs/promises';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TabContextMenu, TAB_SHORTCUTS, matchesTabShortcut, nextTabGroup } from '../src/renderer/components/TabRail';
import { RAIL_SIDE_OPTIONS } from '../src/renderer/pages/AppearanceEditor';
import { SearchContext } from '../src/renderer/search';
import { DEFAULT_TAB_WORKSPACE, DEFAULT_USER_SETTINGS } from '../src/shared/contracts';

const keyboardEvent = (patch: Partial<KeyboardEvent> = {}) => ({
  key: '', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...patch,
}) as KeyboardEvent;

describe('tab shortcut registry', () => {
  it('keeps the rail picker wired to every persisted dock edge', async () => {
    expect(RAIL_SIDE_OPTIONS.map((option) => option.value)).toEqual(['left', 'right', 'top', 'bottom']);
    const source = await readFile(new URL('../src/renderer/pages/AppearanceEditor.tsx', import.meta.url), 'utf8');
    expect(source).toContain('RAIL_SIDE_OPTIONS.map((option) =>');
    for (const side of RAIL_SIDE_OPTIONS) {
      expect(source).toContain(`value: '${side.value}'`);
    }
  });

  it('matches exact registered chords and rejects missing or extra modifiers', () => {
    expect(matchesTabShortcut(keyboardEvent({ key: 'P', ctrlKey: true, shiftKey: true }), TAB_SHORTCUTS.pin)).toBe(true);
    expect(matchesTabShortcut(keyboardEvent({ key: 'p', ctrlKey: true }), TAB_SHORTCUTS.pin)).toBe(false);
    expect(matchesTabShortcut(keyboardEvent({ key: 'p', ctrlKey: true, shiftKey: true, altKey: true }), TAB_SHORTCUTS.pin)).toBe(false);
    expect(matchesTabShortcut(keyboardEvent({ key: 'ArrowUp', altKey: true }), TAB_SHORTCUTS.moveUp)).toBe(true);
    expect(matchesTabShortcut(keyboardEvent({ key: 'ArrowUp', altKey: true, metaKey: true }), TAB_SHORTCUTS.moveUp)).toBe(false);
  });

  it('uses the same next-group shape for menu and keyboard routes', () => {
    const group = nextTabGroup(DEFAULT_TAB_WORKSPACE);
    expect(group).toMatchObject({ name: 'Group 1', collapsed: false, color: 'blue' });
    expect(group.id).toMatch(/^grp_[a-z0-9]{8}$/);
  });

  it('renders only real shortcuts with semantic aria-keyshortcuts and silent visual key caps', async () => {
    const markup = renderToStaticMarkup(createElement(SearchContext.Provider, {
      value: { states: {}, dispatch: vi.fn() },
      children: createElement(TabContextMenu, {
        target: { kind: 'tab', id: 'catalog' },
        workspace: DEFAULT_TAB_WORKSPACE,
        settings: DEFAULT_USER_SETTINGS,
        dispatch: vi.fn(),
        onClose: vi.fn(),
        onRename: vi.fn(),
        onMovePicker: vi.fn(),
        announce: vi.fn(),
      }),
    }));
    for (const shortcut of [TAB_SHORTCUTS.pin, TAB_SHORTCUTS.moveUp, TAB_SHORTCUTS.moveDown, TAB_SHORTCUTS.newGroup]) {
      expect(markup).toContain(`aria-keyshortcuts="${shortcut.aria}"`);
      expect(markup).toContain(`<kbd aria-hidden="true">${shortcut.display}</kbd>`);
    }
    expect(markup).not.toContain('aria-keyshortcuts="Control+W"');
    expect(markup).toContain('Edit tab appearance…');
    const source = await readFile(new URL('../src/renderer/components/TabRail.tsx', import.meta.url), 'utf8');
    expect(source).toContain('Edit group appearance…');
  });

  it('keeps context-menu appearance actions keyboard reachable and restores origin focus', async () => {
    const [rail, app] = await Promise.all([
      readFile(new URL('../src/renderer/components/TabRail.tsx', import.meta.url), 'utf8'),
      readFile(new URL('../src/renderer/App.tsx', import.meta.url), 'utf8'),
    ]);
    expect(rail).toContain('key="appearance"');
    expect(rail).toContain('onEditAppearance?.(target, returnFocus ?? null)');
    expect(rail).toContain("openMenuFor({ kind: 'tab', id: row.tab.id }, event.currentTarget)");
    expect(app).toContain('appearanceReturnFocusRef.current = returnFocus');
    expect(app).toContain('if (target?.isConnected) target.focus();');
  });

  it('wires every displayed shortcut back to the shared matcher in live rail and menu handlers', async () => {
    const source = await readFile(new URL('../src/renderer/components/TabRail.tsx', import.meta.url), 'utf8');
    for (const id of ['pin', 'moveUp', 'moveDown', 'newGroup'] as const) {
      expect(source).toContain(`matchesTabShortcut(event.nativeEvent, TAB_SHORTCUTS.${id})`);
    }
    expect(source).toContain('matchesTabShortcut(event, TAB_SHORTCUTS.railSearch)');
    expect(source).toContain("getElementById(searchInputId('tabs'))?.focus()");
  });
});
