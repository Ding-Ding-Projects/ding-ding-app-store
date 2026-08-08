# Accessibility

> Accessibility defects are **completion blockers**, not polish. A feature that cannot be reached
> by keyboard, or whose state a screen reader cannot report, is unfinished.

This page does two things: it states the rules the app is held to, and it reports what an actual
measurement of the running app found. Nothing here claims the app is accessible — it reports what
a harness measured, with the numbers, on a named commit.

---

## The audit harness

`tools/audit-ui.mjs` launches `tools/audit-ui-main.cjs` under Electron and drives the **real** app:
the same `app/index.html` frontend, the same `electron/preload.js` bridge, the same
`electron/commands.js` backend the installer ships. Nothing is mocked. The window is created far
off-screen at `x: -32000` and brought up with `showInactive()` — a window created with `show: false`
is never painted, and every geometry read comes back from a stale frame, so each cell would be
measured against the layout of the cell before it.

```bash
node tools/audit-ui.mjs                        # the full sweep, ~7 minutes
node tools/audit-ui.mjs --only chat            # one nav section
node tools/audit-ui.mjs --zooms 1 --langs en   # the fastest useful run
node tools/audit-ui.mjs --help                 # every flag
```

Findings land in **`assets/audit/ui-audit.json`** and a summary table is printed to stdout.

**Exit codes.** `0` nothing severe, `2` at least one severity-`high` finding, `1` the harness itself
failed. The two are kept apart so a broken run can never be mistaken for a clean one. CI does not
run this yet — wiring it up is a deliberate decision for whoever owns the workflow, not something
this harness did to them.

### The matrix

Every combination is visited, 240 cells in all:

| Dimension | Values |
| --- | --- |
| Viewport width | 960 (the app's `minWidth`), 1280, 1920 |
| Zoom factor | 1.0, 1.25, 1.5, 2.0 via `webContents.setZoomFactor` |
| Language mode | `en`, `bi` (bilingual concatenates both languages, so its labels are the longest) |
| Nav section | chat, console, ext, settings, cost, runtime, health, history, changelog, studio |

The window's content box stays at *width* × 900 device-independent px; zoom shrinks the CSS
viewport to `width / zoom`. So 1920 at 2.0 gives the app a 960 × 450 CSS viewport — the same squeeze
a 200 % display scale applies. Both funny sliders are pinned at **level 5**, which is the longest
copy the app can produce, because that is the case clipping actually fails at.

Sections are driven through `window.__cxRoot.setState`, which `app/index.html` publishes for exactly
this; language through `CX.i18n.setMode` plus a `lang` state patch, then two `requestAnimationFrame`
round trips so the measurement happens on a produced frame.

### Reproducibility, and why the audit does not read your machine

The audit builds a throwaway `CODEX_HOME` in the temp directory on every run — six synthetic
sessions with deliberately mixed label lengths, two MCP servers, one hook, one extra profile — and
points the real backend at it. Two reasons, both non-negotiable:

- `assets/audit/ui-audit.json` records each finding's **element text** and is committed to a public
  repository. Run against a real `CODEX_HOME`, that file would publish the operator's session names
  and working directories.
- A report whose shape changes with whoever ran it cannot be compared against the previous one.

A second guard runs regardless: the home directory and account name are stripped from the JSON
before it is written. `--codex-home <dir>` opts back into real data for a local look — do not commit
that run. The harness also uses its own Electron `userData` directory, so driving `CX.i18n.setMode`
and `setFunny` never rewrites the operator's own language and funny-level preferences.

Each report pins the tree it measured — `tree.head`, whether `app/` or `electron/` had uncommitted
changes, and a SHA-256 prefix per frontend file — because the frontend is edited by other work in
parallel and a finding without a commit behind it cannot be told apart from a stale one.

### What it checks

| Check | Rule | Severity |
| --- | --- | --- |
| `overflow` | `document.documentElement.scrollWidth > innerWidth + 1`, reported per element past the viewport's right edge with no clipping ancestor | **high** |
| `offscreen` | element past the right edge but cut off by an ancestor's overflow; sub-classified as ellipsis-truncated, scrollable, or silently cut | medium |
| `clipped-text` | `scrollWidth > clientWidth + 1` with hidden overflow and no `text-overflow: ellipsis`, or `scrollHeight > clientHeight + 1` on a single-line control | medium |
| `target-size` | `button`, `[role=button]`, `[role=tab]`, `[role=switch]`, `a`, `input`, `select` rendered under 24 × 24 CSS px | medium |
| `accessible-name` | interactive element with no text, `aria-label`, `aria-labelledby`, `title`, wrapping `<label>` or descendant `alt` | **high**, or medium when only a placeholder or value names it |
| `tab-semantics` | every `[role=tab]` has `aria-selected` and an `aria-controls` that resolves; every `[role=tablist]` has an accessible name and exactly one tab at `tabIndex 0` | **high** |
| `contrast` | computed colour composited over the nearest opaque background ancestor, WCAG 2.1 relative-luminance ratio, flagged under 4.5:1 — 3:1 at ≥ 18.66 px or ≥ 14 px bold | medium |
| `focus-visible` | each interactive element focused in turn; flagged when `outline-style` is `none` or zero-width, `box-shadow` is `none`, and no border, background or colour changed | medium |

The contrast ratio is implemented in the harness — no dependency, no network. Ancestor `opacity` is
folded into the text's effective alpha before compositing, which is what makes `opacity: .65` labels
measurable rather than assumed fine.

Two engineering notes that matter if you read the code:

- The window is **focusable** and `focusOnWebView()` is called before the focus sweep. Chromium only
  matches `:focus` — and therefore `:focus-visible`, and therefore the UA focus ring — while the
  document itself holds focus. Without that, every element reports "no focus indicator", which is a
  harness artefact and would have filed hundreds of false findings. The harness checks
  `document.hasFocus()` and refuses to file focus findings when it is false, saying so in the cell's
  notes instead.
- `contrast` and `focus-visible` are viewport-invariant and the focus sweep forces a style
  recalculation per element, so both run in one reference cell per section and language — 1280 at
  zoom 1.0, 20 of the 240 cells — rather than in all of them.

Findings repeat across the matrix: one under-sized button is the same defect at every width. The
report collapses them on identity and records `count`, `sections`, `widths`, `zooms`, `langs`,
`firstSeen` and a per-check `worst` measurement, so 1652 raw occurrences read as 260 distinct
defects.

---

## What the audit measured

**Run of 2026-07-30T15:27:35Z** — commit `9cba089`, `app/index.html` SHA-256 `5f410645aed670f4`,
no uncommitted changes under `app/` or `electron/`. Electron 40.10.6, Chromium 144.0.7559.236.
240 cells. Two consecutive full sweeps on the same tree produced identical counts, which is what the
fixture `CODEX_HOME` is for.

### Coverage

Reported so "no findings" can be read against how much was looked at.

| Measured | Count |
| --- | --- |
| Visible elements inspected | 77,790 |
| Pointer targets sized | 12,948 |
| Interactive elements name-checked | 12,970 |
| `[role=tab]` elements checked | 740 |
| Text runs contrast-checked | 2,764 |
| Elements focused one by one | 998 |
| Cells where the page overflowed horizontally | **0 of 240** |

### Result

**260 distinct findings, 1652 occurrences, none severity `high`.**

| Check | Distinct findings | Occurrences |
| --- | --- | --- |
| `offscreen` | 102 | 294 |
| `target-size` | 62 | 756 |
| `focus-visible` | 49 | 90 |
| `clipped-text` | 28 | 56 |
| `accessible-name` | 19 | 456 |
| `overflow` | **0** | 0 |
| `tab-semantics` | **0** | 0 |
| `contrast` | **0** | 0 |

By nav section:

| Section | offscreen | target-size | focus-visible | clipped-text | accessible-name | Total |
| --- | --- | --- | --- | --- | --- | --- |
| cost | 12 | 21 | 22 | 22 | 5 | **82** |
| console | 15 | 7 | 7 | 0 | 7 | **36** |
| runtime | 21 | 2 | 5 | 5 | 0 | **33** |
| settings | 14 | 5 | 6 | 1 | 6 | **32** |
| studio | 16 | 8 | 2 | 0 | 0 | **26** |
| changelog | 6 | 11 | 6 | 0 | 0 | **23** |
| health | 17 | 2 | 0 | 0 | 0 | **19** |
| chat | 8 | 2 | 0 | 0 | 0 | **10** |
| ext | 1 | 5 | 1 | 0 | 1 | **8** |
| history | 3 | 2 | 0 | 0 | 0 | **5** |

By viewport width — 960: 211, 1280: 105, 1920: 49. By zoom — 2.0: 211, 1.5: 56, 1.25: 53, 1.0: 98.
By language — `bi`: 250, `en`: 248. Narrow and zoomed is where the app hurts; bilingual mode adds
almost nothing on top, which is worth knowing before anyone spends a day on bilingual layouts.

### The findings, read honestly

**`overflow` — zero, across all 240 cells.** The page never scrolls sideways. That is less of an
achievement than it looks: `html`, `body` and the root layout all set `overflow: hidden`, so the app
*cannot* page-overflow. It clips instead, which is why the `offscreen` check exists.

**`offscreen` — 102 findings, and only 4 are defects.** The harness sub-classifies them:

| Kind | Findings | Reading |
| --- | --- | --- |
| Truncated by an ancestor's `text-overflow: ellipsis` | 50 | Working as designed. Evidence the label no longer fits, not a defect. |
| Inside a scrolling ancestor | 48 | Still reachable, sideways. Not a defect on its own. |
| **Silently cut, no ellipsis, nothing to scroll** | **4** | Real. Content is simply gone. |

The four are all at 960 px with zoom 2.0 — a 480 px CSS viewport — in the chat and cost headers:
`gpt-5.1-codex-max` (18.1 px lost), the `↑` send button (17.7 px), and `workspace-write` (7.1 px).
The other 98 are left in the JSON with their classification rather than filtered out, so nobody has
to trust this summary over the data.

**`clipped-text` — 28 findings, every one an `<input>`.** 22 in Cost (`Input $ / 1M`,
`Cached input $ / 1M`, `Output $ / 1M` and the numeric fields), 5 in Runtime
(`Working directory inside the distro`, losing 122 px), 1 in Config. These are fields whose value or
placeholder is wider than the box, with the overflow hidden and no ellipsis: the text is cut
mid-word with no indication that anything is missing.

**`target-size` — 62 findings under 24 × 24 CSS px.** 40 `<input>`, 20 `<button>`, 2
`[role=switch]`. Three shapes:

- Search and filter inputs measure ~18 px tall inside a 40 px pill — the pill is the visual
  affordance, but the input is the hit target, and its padding does nothing. At the narrowest cells
  the same inputs shrink to **4 × 17.7 px**.
- Borderless text actions — `Reset`, `Undo`, `New`, `Docs`, `Add`, `Export`, `Re-run`, `Spawn all` —
  are 14.3 px tall, the height of their own text.
- Toggle buttons in Console, Extend, Config and Studio are 17.7 px wide, and the changelog's
  calendar button `📅` is 14 × 26.

**`accessible-name` — 19 findings, none of them severity `high`.** Not one interactive element in
the app is completely nameless. All 19 are `<input>`s named only by a `placeholder` — 7 in Console,
6 in Config, 5 in Cost, 1 in Extend. Chromium does fall back to the placeholder, which is why these
are medium rather than high, but that name disappears the moment the user types.

**`focus-visible` — 49 findings, every one an `<input>`.** 908 of the 998 elements focused showed a
visible indicator; the 90 occurrences that did not are all inputs carrying inline `outline: none`
(23 occurrences of that declaration in `app/index.html`) with nothing put in its place. Each of the
49 reports `focusVisible: true` — Chromium agrees the element *should* be showing a ring; the
stylesheet removes it. Buttons, tabs and switches all indicate focus correctly.

**`contrast` — zero failures across 2,764 text runs.** The closest pair measured **4.85:1** against
a 4.5:1 requirement. The Material 3 token pairs hold up in the dark theme with the app's `opacity`
usage folded in. See the gaps below before reading this as a clean bill of health.

### One renderer message worth passing on

The whole run produced five renderer messages, recorded in `consoleErrors` — all five at load, none
during the sweep. Four are `The specified value "{{ c.value }}" cannot be parsed, or is out of
range.` and the same for `{{ c.priceIn }}`, `{{ c.priceCached }}` and `{{ c.priceOut }}`: the Cost
panel's four `type="number"` inputs are stamped with their template placeholder before the binding
resolves, and Chromium rejects the literal string. Harmless as rendered, and worth tidying. The
fifth is Chromium's standard `unsafe-eval` CSP warning, which is expected — `app/support.js`
compiles the page's own template with `new Function`. An earlier run of this harness also carried
`[dc-runtime] index: {{ clogPresetLabel }} never resolved — rendered as empty`; it is gone from
this one.

---

## Gaps in the harness itself

Stated plainly, because an audit that hides its blind spots is worse than none.

- **Dark theme only.** Light theme is never measured, and contrast is exactly the check most likely
  to differ between them.
- **Overlays are never opened.** The regex builder, appearance editor, command palette, notification
  centre, context menus, bulk-close dialog, slash wizard and dim sum card are all reset closed
  before each cell. None of them has been audited.
- **Sub-tabs are not visited.** Only the ten nav sections. Extend's seven categories, Config's
  sections, Health's usage and cloud views and Console's subcommands are measured only in their
  default state.
- **`yue` mode is not swept.** `en` and `bi` only, on the assumption that `bi` is the longest. That
  assumption is untested for Cantonese-only strings that are wider than their English counterpart.
- **Vertical overflow is not checked** at page level, only within single-line controls. At 900 px
  content height and zoom 2.0 the CSS viewport is 450 px tall, well under the app's 640 px
  `minHeight`, and nothing measures what that costs.
- **Focus is set programmatically**, not by real Tab traversal. The harness proves an
  element *can* take focus and whether it shows a ring; it does not prove the tab order is sensible,
  that focus returns to the opener when an overlay closes, or that nothing is a keyboard trap.
- **No screen reader is involved.** Roles and names are read from the DOM. What NVDA or Narrator
  actually announces is not measured by anything here.
- **Contrast is approximate at the edges.** Ancestor `opacity` is folded into the text alpha but
  background layers are composited on alpha alone; images, gradients and `backdrop-filter` behind
  text are not accounted for. Colours the harness cannot parse are counted and skipped rather than
  guessed at.
- **The `large text` threshold follows the spec this harness was written to** — 3:1 at ≥ 18.66 px, or
  ≥ 14 px bold. WCAG's own rule is ≥ 24 px, or ≥ 18.66 px bold, which is stricter for bold text
  between 14 px and 18.66 px. Findings in that band may be under-reported.

---

## The rules

### Keyboard reachability

- Every action reachable by mouse is reachable by keyboard. Right-click menus have a keyboard
  equivalent; the **Edit appearance…** entry in particular must not be mouse-only.
- Tab order follows visual order. Nothing is reachable only by pointer, and nothing
  focusable is invisible.
- Esc closes every overlay — context menu, dropdown, regex builder, appearance editor,
  command palette, notification centre, bulk-close dialog. `app/index.html` binds this globally in
  `componentDidMount`.
- Ctrl+Shift+F opens the command palette, which is the keyboard
  route to actions that otherwise live in menus.
- An overlay returns focus to the element that opened it when it closes.
- Non-native interactive elements (a `div` acting as a button) need `role`, `tabindex="0"` and
  Enter/Space handling. Prefer a real `<button>`.

### Visible focus

- Every focusable element shows a focus indicator that meets contrast against its background.
- `outline: none` is only acceptable when a replacement indicator is supplied — a ring, a border
  change, a background change. Removing the outline and supplying nothing is the single most common
  way to make an app keyboard-unusable while it still "works", and it is what all 49 open
  `focus-visible` findings are.

### Roles, names and states

- Tab strips: `role="tablist"` / `role="tab"` / `role="tabpanel"`, with roving focus,
  `aria-selected`, and `aria-controls` pointing at the live panel. The audit checked 740
  `[role=tab]` element instances across the matrix and found no defect in any of them.
- Dialogs: `role="dialog"` with `aria-modal` where genuinely modal, and a label.
- Toggles: `role="switch"` with `aria-checked`, or a real checkbox.
- Sliders: a real `<input type="range">` with an `aria-label` and, where the numeric value is not
  self-explanatory, `aria-valuetext` (the funny sliders say *"level 4 — clearly playful"*, not
  just *"4"*).
- Live regions: `aria-live="polite"` for status, assertive for errors and warnings. See
  [../features/notifications.md](app-doc://article/codex-material.repository.7cc84c1f327737cf).
- Every icon-only control has an `aria-label` or a `title`. A pinned tab compressed to an icon keeps
  its full accessible name.
- Group headers report expanded state with `aria-expanded`.

### Contrast

- Text meets WCAG AA: 4.5:1 for body text, 3:1 for large text and meaningful non-text elements.
- The Material 3 token pairs in `app/index.html` are designed to satisfy this in both themes; the
  risk is user customisation, which is why the appearance editor shows a **live contrast readout
  with a pass/fail verdict** against the current surface. See
  [../features/appearance.md](app-doc://article/codex-material.repository.76c14a1ab0254ae4).
- Colour is never the only signal. Every notification kind has an icon and a title as well as an
  accent; error fields change border *and* show text.

### Reduced motion

- `app/index.html` carries a `@media (prefers-reduced-motion: reduce)` rule that collapses every
  animation and transition to 0.01 ms. The audit does not verify it; it is a static rule in the
  stylesheet, confirmed present by reading the file.
- `CX.settings.reducedMotion` exists as an explicit user override for people whose OS setting does
  not match their preference in this app.

### Screen readers

- Structure is navigable: headings for panel titles, lists for lists, labelled regions.
- Dynamic content announces once, not on every render. A live region that re-announces the whole
  list each keystroke is worse than one that says nothing.
- The spoken narrator must yield to an active screen reader — two voices at once is unusable. It is
  off by default. See [language-modes.md](app-doc://article/codex-material.repository.2637d041ae1cdd3c).

### Targets and layout

- Adequate hit targets, especially for dismiss buttons and tab close affordances. A 12-pixel glyph
  is not a target — and neither is a 14.3 px-tall text button, which is what 20 of them currently
  are.
- No clipped, truncated, overlapping or off-screen text at any supported size: 960 × 640 minimum
  window, 100 / 125 / 150 / 200 % display scale, all three language modes, funny level 5 (the
  longest strings), bilingual mode (longer still).
- Controls sized to their spec and consistent with siblings.

---

## Failure modes

| Symptom | Cause |
| --- | --- |
| Tab moves focus into a text field and nothing appears to change | Inline `outline: none` with no replacement — the 49 open `focus-visible` findings |
| A field's value is cut mid-word with no ellipsis | The 28 `clipped-text` findings; the input is narrower than its content and hides the overflow |
| A screen reader reads a filled-in field as having no name | It was named by its `placeholder`, which the browser stops exposing once a value is present |
| A header chip vanishes at high zoom | `offscreen`, silently cut — 4 known cases at a 480 px CSS viewport |
| A label ends in `…` at a narrow width | `offscreen`, ellipsis-truncated. Working as designed |
| A toast is missed entirely | It was raised politely while the screen reader was mid-sentence, and auto-dismissed. Errors and warnings persist for exactly this reason |
| A localised label overflows its control | Bilingual mode at funny level 5 — the longest strings the app can produce, which is what the audit runs at |
| Focus lands somewhere unexpected after closing an overlay | Focus return is not implemented for that overlay, and nothing measures it |

## Security considerations

Accessibility and security intersect in one specific way, and it matters:

- **A user who cannot perceive a warning cannot consent to what it warns about.** A destructive
  confirmation that is unreachable by keyboard, unreadable at the user's contrast needs, or
  unannounced to a screen reader is a consent failure, not a usability nit. Destructive dialogs are
  the highest-priority surface on this page — and the audit does not open a single one of them.
- **The appearance system can create accessibility failures**, because a user can set a colour that
  makes error text invisible. The live contrast readout exists to make that visible at the moment of
  choice; do not remove it or hide it behind a disclosure. The audit measures the shipped theme
  only, so a customised theme is unmeasured by definition.
- **The narrator speaks error text aloud**, which can disclose file paths and project names in a
  shared space. Off by default, and the setting says what it does.
- **The audit's own output is a disclosure surface.** `assets/audit/ui-audit.json` records the text
  of every element it flags. That is why the harness builds its own `CODEX_HOME` and strips the home
  directory and account name before writing. A run made with `--codex-home` pointing at real data
  must not be committed.

## Verification the harness cannot do

Run these by hand; nothing above substitutes for them.

1. **Keyboard-only pass.** Unplug the mouse. Reach and operate: the nav rail, the tab strip, every
   search field and its regex builder, the composer, a context menu, the appearance editor, the
   notification centre, the bulk-close dialog. Anything unreachable is a defect.
2. **Focus return.** Open and close each overlay with Esc; focus returns to the opener.
3. **Screen reader pass.** With Narrator or NVDA: every control announces a name, a role and a
   state; a raised error is announced assertively; a success is announced politely and does not
   interrupt.
4. **Light theme.** Re-check contrast and focus visibility under the light palette, which this
   audit never loads.
5. **Overlays.** Open each one and check it the way the harness checks a nav section.
6. **Reduced motion.** Enable it at OS level and confirm animations stop.
7. **A customised theme.** Set a deliberately poor colour in the appearance editor and confirm the
   readout reports *fails AA*.
8. **Greyscale.** Switch the display to greyscale and confirm no state is distinguishable by colour
   alone.
