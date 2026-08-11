import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  addTab,
  closeTab,
  moveTab,
  normalizeTabState,
  parseTabState,
  routeHash,
  tabIdFromHash,
  togglePinned,
} from '../site/assets/tab-state.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const known = ['catalog', 'docs', 'settings'];

describe('public site tab parity', () => {
  it('normalizes malformed or stale visitor tab records without losing the final tab', () => {
    expect(normalizeTabState({ openTabs: ['docs', 'docs', 'unknown'], activeTab: 'unknown', pinnedTabs: ['unknown', 'docs'] }, known)).toEqual({
      version: 1,
      openTabs: ['docs'],
      activeTab: 'docs',
      pinnedTabs: ['docs'],
    });
    expect(parseTabState('{not json', known, 'catalog')).toMatchObject({ openTabs: ['catalog'], activeTab: 'catalog' });
    expect(normalizeTabState({ openTabs: [], activeTab: 'unknown' }, known)).toMatchObject({ openTabs: ['home'], activeTab: 'home' });
  });

  it('adds, closes, reorders, and pins real article routes', () => {
    let state = normalizeTabState({ openTabs: ['home'], activeTab: 'home' }, known);
    state = addTab(state, 'docs', known);
    state = addTab(state, 'catalog', known);
    expect(state).toMatchObject({ openTabs: ['home', 'docs', 'catalog'], activeTab: 'catalog' });
    state = moveTab(state, 'catalog', -1, known);
    expect(state.openTabs).toEqual(['home', 'catalog', 'docs']);
    expect(moveTab(state, 'home', -1, known).openTabs).toEqual(['home', 'catalog', 'docs']);
    state = togglePinned(state, 'catalog', known);
    expect(state.pinnedTabs).toEqual(['catalog']);
    state = closeTab(state, 'catalog', known);
    expect(state).toMatchObject({ openTabs: ['home', 'docs'], activeTab: 'docs', pinnedTabs: [] });
    expect(closeTab(state, 'home', known).openTabs).toEqual(['docs']);
    expect(closeTab({ openTabs: ['docs'], activeTab: 'docs' }, 'docs', known).openTabs).toEqual(['docs']);
  });

  it('round-trips local hash routes and rejects unknown paths', () => {
    expect(routeHash('catalog')).toBe('#/catalog');
    expect(tabIdFromHash('#/catalog', known)).toBe('catalog');
    expect(tabIdFromHash('#/missing', known)).toBeNull();
    expect(tabIdFromHash('#/%E0%A4%A', known)).toBeNull();
    expect(tabIdFromHash('catalog', known)).toBeNull();
  });

  it('renders an accessible browser tab strip and local search builder in the static source', async () => {
    const index = await readFile(path.join(root, 'site/index.html'), 'utf8');
    const app = await readFile(path.join(root, 'site/assets/app.js'), 'utf8');
    const css = await readFile(path.join(root, 'site/assets/app.css'), 'utf8');
    expect(index).toContain('id="browser-tabs" role="tablist"');
    expect(index).toContain('id="new-doc-tab"');
    expect(index).toContain('<script type="module" src="assets/app.js"></script>');
    expect(app).toContain('aria-selected="${active}"');
    expect(app).toContain('data-close-tab');
    expect(app).toContain("localStorage.setItem(storage + 'tabs'");
    expect(app).toContain("window.addEventListener('hashchange'");
    expect(app).toContain('setupBuilder');
    expect(css).toContain('.browser-tab-bar');
    expect(css).toContain('overflow-x: auto');
  });
});
