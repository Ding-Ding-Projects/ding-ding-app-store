# GitHub Pages site

The published site at <https://ding-ding-projects.github.io/BambuStudio/> is a self-contained
static application built from `ui-md3/landing.html` and the modules
in `ui-md3/site/`. It is not a marketing page with a scroll bar: it is a
browser-style tabbed surface carrying the same obligations as the desktop app — three language
modes, two funny-level sliders, a full regex builder behind every search bar, non-blocking
notifications, a complete changelog viewer, and per-element appearance customization.

Everything is served from this repository. There are no third-party requests, no CDN, no analytics
and no cookie banner; preferences live in the visitor's own browser and nowhere else.

That claim is now enforced rather than merely stated. `assert-pages-layout.mjs` sweeps every
published page for an off-site script or stylesheet, and `offline-render.test.mjs` loads the
composed site in a headless browser with every off-site host unreachable and requires it to render
anyway. Both were added on 2026-07-28, after the design-system UI kit under `/app/` was found
loading React, ReactDOM and `@babel/standalone` from unpkg — which also meant it compiled its own
source in the visitor's browser on every visit, and rendered nothing at all when unpkg was blocked
or down. See [deployment and the layout gate](app-doc://article/bambu-studio.repository.2d0a853cbb0a55f4) for how both checks
work.

## Features

- [Tabbed navigation](app-doc://article/bambu-studio.repository.459dfc9a12e4ef92) — the strip, its overflow surface, reordering, pinning,
  grouping, the searchable tab list, and the measured layout algorithm behind them.
- [Language modes and funny levels](app-doc://article/bambu-studio.repository.c72709230e8fd5eb) — the copy catalog, the two
  independent tone ladders, and the rule that separates voice from facts.
- [Regex builder](app-doc://article/bambu-studio.repository.d6846bee504334bb) — the shared component, its engine and dialect, the guided
  construction controls, and the bounded evaluation that keeps a runaway pattern off the page.
- [Changelog viewer](app-doc://article/bambu-studio.repository.459870f9076e1a47) — every published release, the calendar and typed-date
  filter, the composing search, and the Markdown export.
- [Settings and appearance](app-doc://article/bambu-studio.repository.9ddf8048857afe80) — theme, density, accent seed, typography,
  per-element editors, the settings search, and the one blocking dialog on the site.
- [Notifications](app-doc://article/bambu-studio.repository.d881652f2825c4a2) — the toast stack, the notification centre, and which messages
  are allowed to block.
- [Dim sum surprise](app-doc://article/bambu-studio.repository.f327528de7c47c27) — the 1% startup delight, its bundled artwork, and the
  conditions under which it stays quiet.
- [Deployment and the layout gate](app-doc://article/bambu-studio.repository.2d0a853cbb0a55f4) — how the site is composed,
  published, and held to 444 measured layout cases before a deploy is allowed.

## The prototype at `/app`

The interactive prototype published under `/app/` is documented with the design system, but two of
its contracts are enforced by this category's tests and belong here:

- **Every decorative icon is `aria-hidden`.** An icon-font ligature is read as literal text, and on
  an icon-only button that text becomes the accessible name, shadowing the `title` meant to name it.
- **Every one of its ten search fields is wired**, with plain text as the default and the search
  field's mode travelling with the query. A field that opens a regex builder and filters nothing is
  worse than no field at all.

Both, plus the prototype's dialog semantics and title-bar collapse contract, are asserted in
`ui-md3/tests/layout-clipping.test.mjs` and captured in
[`docs/screenshots/pages/app/`](app-doc://article/bambu-studio.repository.311ad2a1afc7c521).

## Postman

Not applicable. This category ships no HTTP API: the site is static files, and the only network
requests it makes are for its own assets on the same origin. The repository's HTTP contracts and
their Postman collections live under [`../api/`](app-doc://article/bambu-studio.repository.a88917a07ea8b9da).

## Verification

| Check | Command |
|:---|:---|
| Data and logic contracts | `node --test ui-md3/tests/site.test.mjs` |
| Behavioural contracts (storage, appearance, notifications) | `node --test ui-md3/tests/site-behaviour.test.mjs` |
| Localisation runtime | `node --test ui-md3/tests/i18n.test.mjs` |
| Static clipping contracts | `node --test ui-md3/tests/layout-clipping.test.mjs` |
| Composed tree | `node ui-md3/scripts/compose-site.mjs _site && node ui-md3/tests/assert-pages-layout.mjs _site` |
| 444 runtime layout cases | `node ui-md3/tests/serve.mjs _site 4173 &` then `BAMBU_PAGES_TEST_URL=http://127.0.0.1:4173/index.html node --test ui-md3/tests/runtime-layout-clipping.mjs` |
