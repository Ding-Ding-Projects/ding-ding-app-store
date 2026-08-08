# Offline documentation browser

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
