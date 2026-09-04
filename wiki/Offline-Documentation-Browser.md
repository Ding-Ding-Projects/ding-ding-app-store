# Offline documentation browser

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

The Documentation tab consumes the generated bundle produced from every canonical file beneath `docs/features/<category>/` plus one generated metadata record for every reviewed catalog application. The generated records live beneath `docs/catalog-apps/`, are visibly labelled as generated catalog metadata, use stable `catalog-app-<catalog-id>` IDs, and report only local reviewed fields: display name, public repository link, availability, package type, adapter/blocker state, source-manifest marker, and explicit install/update/source-build evidence boundaries. They do not import provider README or release-body text, copy external assets, or reveal commands, paths, download URLs, or credentials.

The browser presents category-aware browser-style article tabs, one active tab panel, an article status badge, full behavior/configuration/failure/security/verification text, and suggested-article links that switch the active in-app article. Generation validates the complete internal Markdown link graph against the bundled article IDs, so a missing target fails the build instead of opening the wrong article. The same sources generate the static site's article bundle and the repository wiki mirror.

The browser's own search covers titles, summaries, categories, status, and full article bodies. Plain text is the default and the adjacent shared regex builder applies its pattern and flags to this field. Command-palette article entries open the Documentation page and focus the requested article.

## Configuration

Documentation is generated at repository/build time by `npm run docs:generate`; the packaged app does not fetch articles from the network. `npm run docs:check` uses a hand-written category/article inventory and a separate hand-written 49-ID catalog inventory to compare canonical files, generated catalog records, category indexes, generated TypeScript, site JavaScript, site article mirrors, wiki pages, and UI wiring. Language/funny-level settings apply to browser chrome; canonical technical article text remains factual English in this revision, while generated records use the app display name as a bilingual-title fallback.

## Failure modes

An empty search produces an explicit no-match state and keeps the query visible. A missing canonical file, generated catalog record, required section, category index, related link, wiki page, site copy, generated bundle, docs search builder, article tab role, unknown internal article link, unknown catalog ID, or catalog/adapter mismatch fails `docs:check` or the dedicated completeness test. The renderer leaves an unknown link unavailable rather than routing to an unrelated article. Generated files begin with a do-not-edit notice or generated-metadata marker so changes are made in the canonical source or reviewed inventory instead of being overwritten later.

## Security considerations

Articles are trusted repository content but still render as constructed React nodes rather than injected HTML. The shared renderer emits text, headings, lists, code, emphasis, and validated internal article links; unknown article targets fail closed. External HTML, scripts, inline styles, event attributes, and remote assets are not executed. The desktop browser has no Node integration and cannot navigate away.

## Verification

`npm run docs:check` reports exact category, canonical-article, and generated-catalog-record counts, validates the internal link graph, and byte-compares every generated output. Dedicated tests assert all 49 hand-written catalog IDs have generated offline articles, command-palette destinations, and fail-closed unknown-ID behaviour. Renderer type check and production build prove the offline TypeScript bundle compiles into the app. A packaged runtime interaction should still open representative related links, exercise search/regex, and confirm that the complete count matches the guard.

## Suggested articles

- [Search and regex builder](Search-and-Regex-Builder)
- [Command palette](Command-Palette)
- [Verification and evidence](Verification)
