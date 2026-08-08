---
id: offline-documentation-browser
title: Offline documentation browser
titleYue: 離線文件瀏覽器
category: documentation
status: shipped
summary: Bundles every canonical feature article into the desktop build, renders one article at a time through safe React Markdown, and keeps links inside the browser.
---
# Offline documentation browser

## Behaviour

The Documentation tab consumes the generated bundle produced from every canonical file beneath `docs/features/<category>/`. It presents category-aware browser-style article tabs, one active tab panel, an article status badge, full behavior/configuration/failure/security/verification text, and suggested-article links that switch the active in-app article. The same canonical source generates the static site's article bundle and the repository wiki mirror.

The browser's own search covers titles, summaries, categories, status, and full article bodies. Plain text is the default and the adjacent shared regex builder applies its pattern and flags to this field. Command-palette article entries open the Documentation page and focus the requested article.

## Configuration

Documentation is generated at repository/build time by `npm run docs:generate`; the packaged app does not fetch articles from the network. `npm run docs:check` uses a hand-written category/article inventory to compare canonical files, category indexes, generated TypeScript, site JavaScript, site article mirrors, wiki pages, and UI wiring. Language/funny-level settings apply to browser chrome; canonical technical article text remains factual English in this revision.

## Failure modes

An empty search produces an explicit no-match state and keeps the query visible. A missing canonical file, required section, category index, related link, wiki page, site copy, generated bundle, docs search builder, or article tab role fails `docs:check`. The generated file begins with a do-not-edit notice so changes are made in the canonical source instead of being overwritten later.

## Security considerations

Articles are trusted repository content but still render as constructed React nodes rather than injected HTML. The shared renderer emits text, headings, lists, code, emphasis, and allowlisted internal article links. External HTML, scripts, inline styles, event attributes, and remote assets are not executed. The desktop browser has no Node integration and cannot navigate away.

## Verification

`npm run docs:check` reports exact category and article counts and byte-compares every generated output. Renderer type check and production build prove the offline TypeScript bundle compiles into the app. A packaged runtime interaction should still open representative related links, exercise search/regex, and confirm that the complete count matches the guard.

## Suggested articles

- [Search and regex builder](../experience/search-and-regex-builder.md)
- [Command palette](../experience/command-palette.md)
- [Verification and evidence](../verification/verification.md)
