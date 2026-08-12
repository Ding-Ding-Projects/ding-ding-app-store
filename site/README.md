# Complete static documentation site

Serve the repository root with any static server and open `site/index.html`. GitHub Pages publishes the `site/` directory together with its generated article bundle. The site has no CDN, analytics, remote fonts, remote scripts, or remote images.

## Included surfaces

- The complete hand-written inventory of 8 categories and 19 canonical feature articles, including explicit **limited** and **pending** status.
- Browser-style feature tabs with roving keyboard focus, category labels, persisted open-route order, active hash routing, pin/close controls, keyboard reordering, and narrow-width overflow. This is a bounded site parity slice; desktop-only four-edge rail groups and destructive bulk-close actions remain explicitly app-only.
- Full article text covering behaviour, configuration, failure modes, security considerations, verification, and suggested internal links.
- Plain-text-first documentation search with its own adjacent guided regex builder, flags, sample, validation, live matches, bounded inputs, and device-local query/pattern persistence. No search state leaves the browser.
- Browser-style General, Appearance, Schedule, and About settings tabs; every tab has the settings surface's own search and adjacent full regex builder. Schedule is a bounded browser-local editor for up to 32 validated rules with native date/time controls, explicit weekdays, lower-priority-wins precedence, cross-midnight/date handling, base-setting preservation, and reset/failure states. It deliberately has no operating-system vault, Home Assistant, or external API source.
- General settings always include a local-only personal-vocabulary JSON picker with strict bounded validation, validated browser-local replace/clear/cache states, technical-token-safe canonical article presentation, settings-search and command-palette reachability, and an explicitly site-only restricted presentation switch because this static site cannot observe the desktop app's shared School-mode record.
- English, Hong Kong Cantonese, and bilingual labels, independent English/Cantonese funny-level sliders, theme, density, and accent preferences stored per visitor.
- `Ctrl+Shift+F` command palette covering every article and settings destination, with its own adjacent regex builder.
- A local Changelog destination in About with a strict generated release-manifest boundary, full-SHA release links, plain search plus its adjacent regex builder, typed start/end date filters, bounded copy, and Markdown export. Release automation writes `site/assets/generated-changelog.mjs` from the same validated manifest as the desktop build; before a release-generated file exists, the site uses a clearly bounded checked-in fallback and never makes a runtime network request.
- Material-style local tokens, visible focus, skip link, semantic tab/tab-panel roles, arrow/Home/End navigation, reduced-motion handling, honest empty states, local hash routes, and no network tracking.

## Source and completeness

Canonical articles live under `docs/features/<category>/`. Run `npm run docs:generate` to regenerate category indexes, `site/assets/articles.js`, site article mirrors, the offline TypeScript bundle, and wiki pages. `npm run docs:check` byte-compares those outputs and fails when a hand-written category/article entry, required section, related link, site search builder, settings tab list, offline article tabs, or generated mirror is missing.

The site is documentation, not runtime evidence. Installer, updater, destructive-action, and build claims stay limited to the evidence named in each article.
