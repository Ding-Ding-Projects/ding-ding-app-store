# The GitHub Pages site

**Live:** <https://ding-ding-projects.github.io/BambuStudio/> · **Prototype:**
<https://ding-ding-projects.github.io/BambuStudio/app/>

The published site is a **browser-style tabbed application**, not a scrolling landing page. It is
static, self-contained, and served entirely from this repository: no CDN, no analytics, no
third-party request, no cookie banner. Preferences live in the visitor's own browser.

The in-repository documentation is canonical:
[`docs/features/pages/`](https://github.com/Ding-Ding-Projects/BambuStudio/tree/master/docs/features/pages).
This page is a distilled overview.

## Tabs

| Tab | What it holds |
|:---|:---|
| Overview | Hero, four counted facts, what the site actually is |
| Screens | Ten restyled screens as image-led cards |
| Material You | Live theme, density and accent-seed controls |
| Download | The latest release, its real assets, and verification commands |
| Changelog | Every published release |
| Regex lab | The full regex builder at full width |
| Settings | Every preference, with its own search |
| How it is built | Four steps, including the layout gate |

The strip supports an overflow menu, drag and keyboard reordering, pinning, user-assignable groups,
and a searchable tab list. Order, pinning, grouping and the active tab persist across restarts.
`?tab=<id>` deep-links a tab.

## Language and tone

Three language modes — English, Hong Kong Cantonese, and bilingual — plus **two independent funny
sliders**, one per language, from 1 (fully professional) to 5 (maximum playfulness). The tone
applies to every message including errors, warnings and destructive confirmations.

**Voice varies; facts do not.** The unsigned-build warning still names *unsigned*, *per user* and
*SHA-256* at level 5 exactly as at level 1, the reset confirmation still lists everything it
deletes, and a test asserts this per variant, in both languages.

## Regex builder

One implementation serves the Regex lab tab, the disclosure panel under **every** search bar, and
the matcher those bars filter with. The engine is the browser's own ECMAScript `RegExp`, and the
site says so. Guided construction covers literals (escaped on insert), character classes, anchors,
groups, alternation and quantifiers, alongside a raw editor, flags, sample text, live matches with
correct capture-group identity, and copy/export.

Opt-in regex filtering runs inside a **terminable Web Worker** with a hard timeout, because no
in-page deadline can interrupt a single `exec()`. Where a worker cannot be created the toggle is
disabled and plain-text search keeps working — an honest "not available" rather than an
uninterruptible engine on the thread that draws the page.

## Changelog viewer

Every published release, newest first. Versions, dates, commits and attached files come from the
GitHub Releases API; the change lines are the real commit subjects between release tags; the
category badge is derived mechanically from each subject's leading verb, and the page says so. A
release with no commits in its range says exactly that. Filters: a UTC calendar range picker with
month/year jump and presets, typed ISO and locale dates with inline validation, and a composing
search. Copy and Markdown export honour the active view and state the exported range.

## The deploy gate

A push touching the site runs, before anything is uploaded:

| Suite | Cases |
|:---|:-:|
| Static contracts (copy ladders, placeholder parity, facts-per-level, key coverage, regex bounds, date parsing, changelog integrity, dim sum, workflow shape, kit terminology) | 66 |
| Runtime — landing page: 13 widths × 4 display scales × 3 language modes | 156 |
| Runtime — every tab: 4 widths × 3 scales × 3 languages × 8 tabs | 288 |

A clipped element, an undersized control, an empty panel or a tab strip that wrapped instead of
overflowing fails the deploy. Because the harness fails on `scrollWidth > width`, the site may not
use `text-overflow: ellipsis` or a horizontally scrolling container anywhere — both hide a clip
rather than fix it. Long strings wrap, which is why bilingual mode at 200% scale is a first-class
layout case.

### What can and cannot deploy

The `github-pages` environment on this fork accepts deployments **only from `master`**. A job gated
on that environment at any other ref is refused *before its first step runs* — three seconds, zero
steps, no log, conclusion `failure`. There is nothing to read, which makes it a genuinely confusing
failure the first time you meet it.

That is what made the `release` trigger fail **12 times out of 12**: a release event runs at the
**tag** ref (`md3-v57`), not at `master`. Every published release left a red X, and the changelog
refresh it was added for never once happened.

Anything that must deploy off a non-`master` ref has to dispatch a `master` run instead. The
`redeploy-on-release` job does exactly that and holds no environment of its own; the run it starts
arrives as `workflow_dispatch` and deploys normally. It cannot use `GITHUB_TOKEN` — GitHub blocks a
token-triggered run from triggering another, so the dispatch would return `204` and do nothing — so
it uses `TOKEN_GITHUB`, the owner PAT this repository actually has, and warns in the log rather than
failing when no PAT is configured. It also keeps its own concurrency group, so a release cannot
cancel a deploy midway and then put nothing in its place.

## Terminology

The material vocabulary is **ink**, and the unit that feeds it is the **Ink Dispenser**. That is
display text only: `filamentRows`, `?view=filament`, `.bbsflmt` and the native `.po` msgids keep
their upstream spelling, because bindings and file formats match on them.

One file is the exception worth knowing: `ui-md3/app/i18n.resources.js` is keyed on the **rendered
English string**, not on a msgid. Rename display text without renaming its keys and every lookup
misses and falls back to English — silently, with nothing anywhere reporting a problem. That
happened, and the terminology script could not see it because it checks values, not lookups.

The MD3 UI kit under `design-system/` is published too, at `/app/design-system/`, and it sat outside
every terminology check for three passes while still reading "Filament Manager". `site.test.mjs` now
sweeps it, and also asserts the assembled `index.html` still contains the phrases its `.jsx` sources
produce — the kit's header claims an assembler inlines them, no such assembler exists in the tree,
and the two are kept in step by hand.

## Reproducing the gate locally

```bash
node ui-md3/scripts/compose-site.mjs _site
node ui-md3/tests/assert-pages-layout.mjs _site
node --test ui-md3/tests/i18n.test.mjs ui-md3/tests/site.test.mjs ui-md3/tests/layout-clipping.test.mjs
node ui-md3/tests/serve.mjs _site 4173 &
BAMBU_PAGES_TEST_URL=http://127.0.0.1:4173/index.html node --test ui-md3/tests/runtime-layout-clipping.mjs
```

Chrome or Edge is required for the runtime suite; all 450 cases take about three minutes.

## Dim sum

One visit in a hundred shows a dim sum dish in the corner, named in English and Cantonese, drawn
from hand-authored inline SVG held in the repository. It never blocks the page, never fires on a
first visit, dismisses itself, carries an accessible name, respects reduced motion, and can be
switched off for good in Settings.
