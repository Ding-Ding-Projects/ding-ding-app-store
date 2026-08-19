import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(process.cwd());
const read = (file: string) => readFile(path.join(root, file), 'utf8');

describe('expressive storefront presentation contract', () => {
  it('keeps the semantic Material surface tokens and expressive shell hierarchy', async () => {
    const [tokens, nav, pages] = await Promise.all([
      read('src/renderer/styles/tokens.css'),
      read('src/renderer/styles/nav.css'),
      read('src/renderer/styles/pages.css'),
    ]);

    for (const token of ['--surface-low', '--outline-variant', '--on-surface', '--elevation-1', '--elevation-2', '--elevation-3']) {
      expect(tokens, `missing semantic token ${token}`).toContain(token);
    }
    expect(nav).toContain('var(--titlebar-height)');
    expect(nav).toContain('radial-gradient');
    expect(nav).toContain('.nav-tab.selected');
    expect(pages).toContain('grid-template-columns: 68px minmax(0, 1fr)');
    expect(pages).toContain('.app-card:has(.app-selection input:checked)');
    expect(pages).toContain('.empty-state');
  });

  it('documents deterministic local marks and future icon metadata fallback', async () => {
    const article = await read('docs/features/experience/expressive-storefront.md');
    const appsPage = await read('src/renderer/pages/AppsPage.tsx');
    const app = await read('src/renderer/App.tsx');
    expect(article).toContain('deterministic local mark');
    expect(article).toContain('future icon field');
    expect(article).toContain('cannot blank the card');
    expect(article).toContain('cheap headless route');
    expect(appsPage).toContain('function appMark');
    expect(appsPage).toContain("data-app-tone={mark.tone}");
    expect(app).toContain('className="notice warning catalog-state"');
  });
});
