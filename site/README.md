# Complete static documentation site

Serve the repository root with any static server and open `site/index.html`. GitHub Pages publishes the `site/` directory together with its generated article bundle. The site has no CDN, analytics, remote fonts, remote scripts, or remote images.

## Included surfaces

- The complete hand-written inventory of 8 categories and 19 canonical feature articles, including explicit **limited** and **pending** status.
- Browser-style feature tabs with roving keyboard focus, category labels, remembered active article, and narrow-width overflow.
- Full article text covering behaviour, configuration, failure modes, security considerations, verification, and suggested internal links.
- Plain-text-first documentation search with its own adjacent guided regex builder, flags, sample, validation, live matches, and bounded inputs.
- Browser-style General, Appearance, and About settings tabs; every tab has the settings surface's own search and adjacent full regex builder.
- English, Hong Kong Cantonese, and bilingual labels, independent English/Cantonese funny-level sliders, theme, density, and accent preferences stored per visitor.
- `Ctrl+Shift+F` command palette covering every article and settings destination, with its own adjacent regex builder.
- Material-style local tokens, visible focus, skip link, semantic tab/tab-panel roles, arrow/Home/End navigation, reduced-motion handling, honest empty states, and no network tracking.

## Source and completeness

Canonical articles live under `docs/features/<category>/`. Run `npm run docs:generate` to regenerate category indexes, `site/assets/articles.js`, site article mirrors, the offline TypeScript bundle, and wiki pages. `npm run docs:check` byte-compares those outputs and fails when a hand-written category/article entry, required section, related link, site search builder, settings tab list, offline article tabs, or generated mirror is missing.

The site is documentation, not runtime evidence. Installer, updater, destructive-action, and build claims stay limited to the evidence named in each article.
