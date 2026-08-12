import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { DEFAULT_DISPLAY_NAME, DISPLAY_NAME_MAX_LENGTH, SITE_DISPLAY_NAME_STORAGE_KEY, displayNameForPresentation, loadDisplayName, resetDisplayName, sanitizeDisplayName, saveDisplayName } from '../site/assets/display-name.mjs';

const storage = () => { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }; };

describe('static site display name', () => {
  it('enforces bounded labels and trims whitespace', () => {
    expect(sanitizeDisplayName(`  My docs  `)).toBe('My docs');
    expect(sanitizeDisplayName('')).toBeNull();
    expect(sanitizeDisplayName('x'.repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toBeNull();
    expect(sanitizeDisplayName('bad\u0000name')).toBeNull();
  });
  it('persists, reloads, and resets only the presentation label', () => {
    const local = storage();
    expect(loadDisplayName(local)).toBe(DEFAULT_DISPLAY_NAME);
    expect(saveDisplayName('My docs', local)).toEqual({ ok: true, value: 'My docs' });
    expect(local.getItem(SITE_DISPLAY_NAME_STORAGE_KEY)).toBe('My docs');
    expect(loadDisplayName(local)).toBe('My docs');
    expect(resetDisplayName(local)).toEqual({ ok: true, value: DEFAULT_DISPLAY_NAME });
    expect(loadDisplayName(local)).toBe(DEFAULT_DISPLAY_NAME);
  });
  it('keeps the previous label on invalid or unavailable writes and keeps restricted presentation honest', () => {
    const local = storage();
    saveDisplayName('My docs', local);
    expect(saveDisplayName(' ', local)).toMatchObject({ ok: false, value: 'My docs' });
    expect(displayNameForPresentation('My docs', true)).toBe('My docs');
    expect(displayNameForPresentation(null, true)).toBe(DEFAULT_DISPLAY_NAME);
    expect(saveDisplayName('Another', { getItem: local.getItem, setItem: () => { throw new Error('blocked'); }, removeItem: local.removeItem })).toMatchObject({ ok: false, value: 'My docs' });
    const blockedReset = { getItem: local.getItem, setItem: local.setItem, removeItem: () => { throw new Error('blocked'); } };
    expect(resetDisplayName(blockedReset)).toMatchObject({ ok: false, value: 'My docs' });
  });
  it('wires the visible bounded control, title, brand, home, status, palette, and no URL mutation', async () => {
    const html = await readFile(new URL('../site/index.html', import.meta.url), 'utf8');
    const app = await readFile(new URL('../site/assets/app.js', import.meta.url), 'utf8');
    expect(html).toContain('id="site-display-name"');
    expect(html).toContain('maxlength="64"');
    expect(html).toContain('id="site-display-name-reset"');
    expect(html).toContain('data-site-copy="display-name-label"');
    expect(html).toContain('data-site-copy="display-name-save"');
    expect(app).toContain("import { DEFAULT_DISPLAY_NAME");
    expect(app).toContain("$('site-brand-name')");
    expect(app).toContain("$('document-title')");
    expect(app).toContain('Routes and URLs are unchanged.');
    expect(app).toContain("id: 'setting-display-name'");
    expect(app).not.toContain('window.location.pathname =');
  });
});
