import path from 'node:path';

function internalTarget(row, href) {
  if (/^(?:[a-z]+:|#|\/)/i.test(href)) return null;
  const [pathname] = href.split('#', 1);
  if (!pathname.toLowerCase().endsWith('.md')) return null;
  const relative = path.posix.normalize(path.posix.join(`docs/features/${row.category}`, pathname.replaceAll('\\', '/')));
  if (!relative.startsWith('docs/features/') || relative.includes('/../')) return { href, target: null };
  return { href, target: relative };
}

export function validateArticleLinks(rows) {
  const known = new Set(rows.map((row) => `docs/features/${row.category}/${row.id}.md`));
  const failures = [];
  for (const row of rows) {
    const links = [...row.body.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
    for (const href of links) {
      const resolved = internalTarget(row, href);
      if (resolved && (!resolved.target || !known.has(resolved.target))) failures.push(`${row.id}: unknown internal article link ${href}`);
    }
  }
  return failures;
}
