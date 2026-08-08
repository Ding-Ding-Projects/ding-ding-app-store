import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateArticleLinks } from '../scripts/docs-link-graph.mjs';
import { articleIdFromHref } from '../src/renderer/components/MarkdownArticle';

const article = (id: string, category: string, body: string) => ({ id, category, body });

describe('offline documentation link graph', () => {
  it('keeps privacy documentation aligned with typed notification recovery boundaries', async () => {
    const privacyArticle = await readFile(new URL('../docs/features/security/privacy-and-security.md', import.meta.url), 'utf8');
    expect(privacyArticle).toContain('Typed recovery exists only for verified repeatable operations; unsupported failures remain explicit no-action states.');
    expect(privacyArticle).toContain('Notification history records the recovery kind without callbacks');
    expect(privacyArticle).not.toContain('Some errors do not yet have a dedicated recovery action or notification history');
  });

  it('resolves relative article links across categories', () => {
    expect(validateArticleLinks([
      article('one', 'experience', 'See [two](../installed/two.md).'),
      article('two', 'installed', 'Back to [one](../experience/one.md).'),
    ])).toEqual([]);
  });

  it('fails closed on unknown or escaping internal article links', () => {
    const failures = validateArticleLinks([
      article('one', 'experience', 'See [missing](../installed/missing.md).'),
      article('two', 'installed', 'See [escape](../../secret.md).'),
    ]);
    expect(failures).toEqual([
      'one: unknown internal article link ../installed/missing.md',
      'two: unknown internal article link ../../secret.md',
    ]);
  });

  it('ignores external, fragment, and non-markdown links', () => {
    expect(validateArticleLinks([article('one', 'experience', '[site](https://example.com/x.md) [heading](#behaviour) [file](./file.txt)')])).toEqual([]);
  });

  it('does not turn external or absolute markdown URLs into local article targets', () => {
    expect(articleIdFromHref('https://attacker.example/offline-documentation-browser.md')).toBeNull();
    expect(articleIdFromHref('/docs/offline-documentation-browser.md')).toBeNull();
    expect(articleIdFromHref('#offline-documentation-browser.md')).toBeNull();
    expect(articleIdFromHref('../documentation/offline-documentation-browser.md')).toBe('offline-documentation-browser');
  });
});
