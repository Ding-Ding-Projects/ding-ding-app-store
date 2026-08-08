# GitHub Pages feature parity

The documentation website is a user-facing application. Desktop and mobile views therefore share
the same navigation, localization, appearance, search, notification, accessibility, export, and
safety contracts wherever a static browser origin can provide them truthfully.

## Responsive side navigation

- A first visit at 720 CSS pixels or narrower starts with left/right navigation collapsed.
- The brand and a minimum-size expand button always remain reachable.
- Collapse and expand retain keyboard focus and expose synchronized `aria-controls`,
  `aria-expanded`, and localized labels.
- A deliberate visitor choice persists across reloads and viewport changes; reset returns to the
  responsive default.
- Top and bottom placements remain complete horizontal strips.

香港粵語：窄畫面側欄唔再霸住半版，收埋之後仍然有清楚、夠大、鍵盤撳得到嘅展開掣。
用戶揀過嘅狀態會記住；reset 先會返去跟畫面闊度決定。

## Shared-feature inventory

The committed `PAGES_FEATURE_COVERAGE` list contains 41 explicit categories. Each applicable item
names its implementation and verification files. Features that cannot honestly run in a static
browser—such as hidden local Git repositories, native editor discovery, repository publishing,
native filesystem paths, archive packaging, an application HTTP API, and installed-binary
updates—stay visible with a concrete reason. The optional spoken narrator is recorded as optional
and not enabled rather than quietly treated as mandatory or already shipped.

The two newest guarded categories are not paper entries:

- **Scheduled settings and external sources** provides versioned, bounded language/appearance
  rules across date, time, weekday, timezone, cross-midnight and equal-endpoint windows. A rule can
  use local state, a bounded HTTPS/loopback JSON API, or a Home Assistant `input_boolean` or
  `binary_sensor`. Tokens live only in page-session memory; `off` falls through to the next matching
  rule, while unavailable/authentication responses fail closed. Validation, timeouts, response
  bounds, precedence, history and base-value recovery are explicit.
- **Resizable and draggable panel geometry** covers docked panels and every transient owner:
  anchored popovers, dialog overlays, menu overlays and command menus. All resize, clamp to the
  viewport, persist per surface, reset and have keyboard controls; every transient surface drags.

The detailed canonical article is
[`docs/pages-feature-parity.md`](https://github.com/Ding-Ding-Projects/worldlens/blob/main/docs/pages-feature-parity.md).

## Compact proof

Final integrated branch commit
[`95a3e689c5a1605a0140452138c8ff18fd9f73db`](https://github.com/Ding-Ding-Projects/worldlens/commit/95a3e689c5a1605a0140452138c8ff18fd9f73db)
contains the eighteen machine-readable production-site records and fourteen genuine headless
captures. It includes exact corrected default-branch commit
[`ff2a8db67329311357f3ffe858d1d78b25ac7ab1`](https://github.com/Ding-Ding-Projects/worldlens/commit/ff2a8db67329311357f3ffe858d1d78b25ac7ab1)
through merge commit
[`f713d1a5dcbc2209711f24b3ca5b7a2b3c584916`](https://github.com/Ding-Ding-Projects/worldlens/commit/f713d1a5dcbc2209711f24b3ca5b7a2b3c584916).
The proof drives ten routes rather than only Home:

| Surface | Viewport | Scale | Result |
|---|---:|---:|---|
| Home navigation | 360×640, 390×844, 414×896 | 100% | Collapsed/expanded state, toggle, ARIA and focus exact |
| Home navigation, bilingual | 390×844 | 200% | Longest labels fit in collapsed and expanded states |
| Settings and Schedules | 390×844, 1024×768 | 100% | Guided editor and provenance surface fit |
| Search/regex and command teleport | 360×640, 390×844 | 100% and 200% | Anchored builder/palette remain bounded |
| Appearance and changelog/date | 414×844, 414×896 | 100% | Editor has zero horizontal overflow/out-of-bounds descendants; no accidental clip |
| Notifications, tab/group menus, exports/bulk | 390×844, 414×896 | 100% | Exact interactive routes complete |

All records use schema version 2. The driver records the complete overflow candidate list instead
of truncating it at forty. Every
candidate is classified as accidental clipping or a deliberate bounded internal scroller; accidental
clipping, an undersized target, missing toggle inversion or localized label change, broken
`aria-controls`, hidden-navigation mismatch, wrong scenario, incomplete classification, or incorrect
final state fails the run. A committed guard rejects legacy or incomplete proof records.

*Image omitted from the offline bundle: Appearance editor at 414x844 bilingual with no horizontal clipping.*

*Image omitted from the offline bundle: Guided scheduled-settings editor in compact bilingual mode.*

*Image omitted from the offline bundle: Command palette and teleport results at compact 200% scale.*

## Hosted branch proof

Run
[`31182339756`](https://github.com/Ding-Ding-Projects/worldlens/actions/runs/31182339756)
is the exact terminal-green cloud run for `95a3e689c5a1605a0140452138c8ff18fd9f73db`.
Workflow lint, the seven BlueMap implementations, the real Java CLI round trip, workspace lint,
build, all 13 package typechecks, the Windows Squirrel installer, generated-world render, and the
real-app screenshot capture all passed. The full suite reported **660 test files passed**, **5
skipped**, **9,686 tests passed**, and **18 skipped**. The screenshot gate reported **24 passed**
and uploaded 166 files in the evidence artifact. Release publication was correctly skipped on the
phase branch.

## Default-branch and live-site proof

Exact default-branch commit
[`64858ee71f2ee47e07dd7f6aa0de969e5ac3be02`](https://github.com/Ding-Ding-Projects/worldlens/commit/64858ee71f2ee47e07dd7f6aa0de969e5ac3be02)
contains the integrated phase. Pages run
[`31185003139`](https://github.com/Ding-Ding-Projects/worldlens/actions/runs/31185003139)
is terminal green for that SHA: both **Build site** and **Deploy to Pages** passed.
Default-branch CI run
[`31185003294`](https://github.com/Ding-Ding-Projects/worldlens/actions/runs/31185003294)
is also terminal green for the same SHA. It passed workflow lint, workspace lint/build/all 13
package typechecks, **660 test files and 9,686 tests**, all seven BlueMap builds, the real Java CLI
round trip, a generated-world render, the Windows Squirrel installer, release publication and the
24-test real-app capture gate with 166 uploaded evidence files. The run published non-draft release
[`v0.1.0-build.734`](https://github.com/Ding-Ding-Projects/worldlens/releases/tag/v0.1.0-build.734)
at that exact commit with `Worldlens-0.1.734-Setup.exe`, the full Squirrel package, `RELEASES`, the
direct jar checksum index, server plugins, extras and the catalog photo.

The published site was then driven through an isolated off-screen Chrome desktop rather
than inferred from the workflow badge. At 390×844 CSS pixels a clean profile started with the side
navigation collapsed and left a 44×44 expand control visible. Expanding and collapsing each kept
focus on the control, changed `aria-expanded`, kept `aria-controls="site-primary-navigation"`
bound to a real element, and persisted the explicit choice across a full reload. Both document and
body horizontal overflow measured zero. At 1024×768 the navigation started expanded, remained
reachable, and the complete proof again reported zero accidental clipping.

The live page loaded its hashed `index-CjkOaJGA.js` bundle, identified the product as
**worldlens**, and rendered **Version 0.1.0 · Windows · Squirrel.Windows installer · 148 MiB ·
published 2026-08-07**. Its Home feature card states that the Pages site carries settings,
language and tone, tab searches, regex builders, command-palette teleport, appearance editors,
notifications, exports and accessibility, with the phone rail collapsed by default. Opening the
live **GitHub Pages feature parity** article exposed the guarded feature inventory, session-only
Home Assistant credential rule, persisted panel geometry and collapsible-navigation evidence.

*Image omitted from the offline bundle: Live worldlens Pages site at 390 by 844 CSS pixels, with the navigation collapsed and its expand control reachable.*

## Verification boundary

The source branch, exact default-branch ancestry, terminal CI, Pages build/deploy and published
origin were all read back. The live site proof covers the compact default, toggle size,
ARIA, focus, persistence, desktop expansion, overflow, hashed bundle, release metadata and guarded
feature text rather than relying on workflow status alone. Issue
[#92](https://github.com/Ding-Ding-Projects/worldlens/issues/92) is closed. The later atomic cutover
renamed both the physical repository and Pages route to Worldlens; canonical links now point there
without changing the historical evidence.

## Suggested pages

- [Home](app-doc://article/material-bluemap.wiki.355883cf07556dda)
- [Live documentation site](https://ding-ding-projects.github.io/worldlens/)
- [Issue #92](https://github.com/Ding-Ding-Projects/worldlens/issues/92)
