# Offline documentation browser

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

The Documentation tab consumes the generated bundle produced from every canonical file beneath `docs/features/<category>/`. It presents category-aware browser-style article tabs, one active tab panel, an article status badge, full behavior/configuration/failure/security/verification text, and suggested-article links that switch the active in-app article. Generation validates the complete internal Markdown link graph against the bundled article IDs, so a missing target fails the build instead of opening the wrong article. The same canonical source generates the static site's article bundle and the repository wiki mirror.

The browser's own search covers titles, summaries, categories, status, and full article bodies. Plain text is the default and the adjacent shared regex builder applies its pattern and flags to this field. Command-palette article entries open the Documentation page and focus the requested article.

## Configuration

Documentation is generated at repository/build time by `npm run docs:generate`; the packaged app does not fetch articles from the network. `npm run docs:check` uses a hand-written category/article inventory to compare canonical files, category indexes, generated TypeScript, site JavaScript, site article mirrors, wiki pages, and UI wiring. Language/funny-level settings apply to browser chrome; canonical technical article text remains factual English in this revision.

## Failure modes

An empty search produces an explicit no-match state and keeps the query visible. A missing canonical file, required section, category index, related link, wiki page, site copy, generated bundle, docs search builder, article tab role, or unknown internal article link fails `docs:check`. The renderer leaves an unknown link unavailable rather than routing to an unrelated article. The generated file begins with a do-not-edit notice so changes are made in the canonical source instead of being overwritten later.

## Security considerations

Articles are trusted repository content but still render as constructed React nodes rather than injected HTML. The shared renderer emits text, headings, lists, code, emphasis, and validated internal article links; unknown article targets fail closed. External HTML, scripts, inline styles, event attributes, and remote assets are not executed. The desktop browser has no Node integration and cannot navigate away.

## Verification

`npm run docs:check` reports exact category and article counts, validates the internal link graph, and byte-compares every generated output. Renderer type check and production build prove the offline TypeScript bundle compiles into the app. A packaged runtime interaction should still open representative related links, exercise search/regex, and confirm that the complete count matches the guard.

## Suggested articles

- [Search and regex builder](Search-and-Regex-Builder)
- [Command palette](Command-Palette)
- [Verification and evidence](Verification)

## Catalog-wide bundle

The offline bundle is generated from every curated entry in `data/catalog.v1.json`. For each public repository it imports only root README Markdown, `docs/**/*.md`, and bounded wiki Markdown when wiki Git data exists. Repository and wiki sources are pinned independently to exact commits.

## Bundle contract

- Every app and each repository/wiki source has an explicit `imported`, `empty`, or `unavailable` outcome.
- `data/offline-docs/manifest.json` records the catalog digest, public source URLs, pinned SHAs, counts, stable reason codes, article paths, byte counts, SHA-256 hashes, and internal targets.
- `data/offline-docs/search-index.json` contains deterministic local title/body search documents for every article.
- Relative, same-repository, reference-style, and wiki links become stable `app-doc://article/<article-id>` links.
- A temporary bundle replaces the current bundle only after it passes the completeness verifier.

## Safety

Private repositories are never imported. Source URLs must use public GitHub HTTPS and match the exact curated organization/repository. The importer rejects hostile and percent-encoded traversal paths, symbolic links, scripts, binaries, dependency/vendor/build trees, non-UTF-8 or NUL content, and bounded-source overflows.

High-confidence tokens and private keys are redacted. Markdown images, loadable HTML media, external stylesheet/CSS imports, and URL-loading style attributes are removed; no external asset is fetched or copied. Imported text still renders only through the application's shared isolated Markdown renderer.

## Completeness gate

```powershell
node scripts/import-offline-docs.mjs
npm test --prefix packages/offline-docs
npm run build --prefix packages/offline-docs
```

The build fails on a missing app/source outcome, absent or modified article, unindexed or unexpected file, missing link target, catalog digest drift, inconsistent count, or incomplete search index. The current app/article totals and source SHAs live in the generated manifest rather than being copied into this page and allowed to go stale.

The focused tests cover hostile paths, scripts, private sources, wrong owners, oversized content, missing wikis, link rewriting, asset/secret sanitization, Unicode, empty repositories, determinism, and completeness failures.

## Failure handling

Missing documentation or wikis produce explicit empty records. Private, inaccessible, truncated, oversized, malformed, or unsafe sources produce unavailable records or stop the transaction before publication. A failed temporary verification leaves the existing bundle untouched.

Detailed source: [`docs/features/offline-documentation-browser.md`](../docs/features/offline-documentation-browser.md).

## Suggested articles

Continue with [Catalog Discovery](Catalog-Discovery.md), [Privacy and Security](Privacy-and-Security.md), or [Verification](Verification.md).
