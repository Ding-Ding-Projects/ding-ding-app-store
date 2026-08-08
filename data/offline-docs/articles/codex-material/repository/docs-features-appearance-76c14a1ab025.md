# Appearance

> Every rendered element is its own customisation target, edited from a non-modal popover anchored
> beside the element itself — with typography controls, a colour picker, a translator that speaks
> twelve colour spaces, and a WCAG contrast readout.

**Implementation:** the editor panel and its bindings in `app/index.html` (`appearItem`,
`onContextMenu`, `applyAppearance`, `patchAppear`, and the `appear*` / `colorRows` /
`contrastLabel` keys of `renderVals`); the colour mathematics in `CX.color` in
`app/codex-core.js`.

`app/cx-appearance.js` holds the property table, the one CSS mapping (`styleFor`), the legacy
reader (`normalise`), the capability notes, and the validation, export and import paths.

> [!WARNING]
> **That file was not in the page until recently.** No `<script src>` tag loaded it, so
> `window.CX_APPEARANCE` did not exist in the running app: export, import and every named preset hit
> their `if (!A)` guard and toasted *"cx-appearance.js is missing from this build"* — accurate, and
> indistinguishable from a packaging accident. Its own tests passed the whole time, because the test
> runner reads module files directly through `node:vm` rather than through the page. A test that
> loads a file the app does not load is testing a file, not a feature.
>
> Two tests guard it now, both in `tools/test-frontend.mjs`: *every frontend module is actually
> loaded* checks that no `app/*.js` is missing a script tag, and that every `CX_*` global the page
> reads is assigned by something the page loads.

The section [What is not implemented yet](#what-is-not-implemented-yet) is an honest list rather
than a roadmap footnote, and it is shorter than it was.

## How an element becomes editable

Two lines, and it is done:

1. Put `data-appear="<human name>"` on the element.
2. End its context menu with `this.appearItem(e)`.

`appearItem` walks up from the event target with `closest("[data-appear]")`, reads the name, and
returns a menu item labelled **"Edit appearance — &lt;name&gt;"**. Elements that carry
`data-appear` but have no menu of their own are covered by the root `onContextMenu` handler, which
does the same lookup and builds a two-item menu: *Edit appearance* and *Reset this element's
appearance*.

**Shift+right-click opens the editor directly**, skipping the menu:

```js
if (e.shiftKey) { this.setState({ appearOpen: true, appearTarget: name, appearAt: at }); return; }
```

Ordinary right-click therefore keeps the element's real menu — tab management on a tab, filter
actions on a search field — and never has it replaced by a styling menu.

### The 41 named targets

| | | | |
| --- | --- | --- | --- |
| Appearance editor | Bulk close dialog | Calendar | Changelog toolbar |
| Command catalog | Command palette | Command preview | Commit row |
| Composer | Conversation header | Cost headline | Cost inputs |
| Dropdown | Empty transcript | Extension card | Filter bar |
| Flag panel | Health card | History filters | History intro |
| Lifetime cost | List item | Message bubble | Model comparison |
| Navigation rail | Notification | Notification centre | Profile tabs |
| Regex builder | Release entry | Runtime card | Runtime intro |
| Settings panel | Sidebar search | Studio search | TOML preview |
| Tab group header | Tab strip | Title bar | Yolo card |

Plus every **tab**, which is keyed `Tab:<id>` rather than by a static name so two tabs with the
same title stay separately styleable — that is the 41st target and the reason the count is not
just the length of the table.

The pickers and dialogs are in that list on purpose: **the appearance system styles its own
chrome.** The regex builder, the dropdown, the command palette, the notification centre and the
bulk-close dialog are all editable targets, so a theming feature that cannot theme its own popover
is not what ships here.

## Anchoring

The popover opens **beside the element**, never on top of it. `appearAnchor(host)` measures the
element's own rectangle, prefers the right-hand side, flips to the left when the right would
leave the viewport, and clamps vertically against the height the panel can actually occupy:

```js
const W = 330, GAP = 12;
const H = Math.round(window.innerHeight * 0.7);
const r = host.getBoundingClientRect();
let x = r.right + GAP;
if (x + W > window.innerWidth - 8) x = r.left - W - GAP;
```

> It used to anchor to the **pointer** — `clientX`/`clientY` clamped to the window — so
> right-clicking anywhere near the middle of a control opened the editor directly on top of the
> control being edited. The screenshot audit photographed exactly that.
>
> `H` was then `Math.min(470, 70vh)`, which is 470 on any window taller than 672 px. The panel's
> own CSS allows 70vh, so on a full-screen window the anchor reserved 470 px while the panel
> rendered to about 1050 and the bottom two thirds fell off the screen. 470 was a fair guess when
> the editor had eight controls and is simply a wrong number now that it has twenty-three: it
> clamps against what the CSS allows, not against a remembered size.

**Keyboard route:** Ctrl+Shift+E opens the editor for whatever
element currently has focus, walking up to the nearest `[data-appear]` ancestor. The context menu
was previously the only door, which made the entire feature unreachable without a mouse — an
accessibility defect, and those are completion blockers here rather than polish. Closing returns
focus to whatever opened it.

**The editor is itself a target.** It carries `data-appear="Appearance editor"`, so it can be
restyled by the system it exists to provide; a theming feature that cannot theme its own dialog
is incomplete. It also announces itself as a named `role="dialog"`.

It is **non-modal** — no `aria-modal`, no backdrop, no focus trap. The page behind it stays live,
so a user can watch a change land on the element they are editing. Esc closes it
(`appearOpen: false` in the global key handler), as does the ✕ in its header. Its own width is
330 px with `max-width: calc(100vw - 24px)` and `max-height: 70vh` with internal scrolling, so it
does not overflow a narrow window.

## What the editor controls

Twenty-three properties. Every one of them is turned into CSS by **one** function —
`CX_APPEARANCE.styleFor()` in `app/cx-appearance.js` — which `applyAppearance()` and the exporter
both call. That is deliberate: the two used to keep separate lists, which is how `wide` came to
apply in the running app and appear in no exported document.

| Control | Stored as | Applied as |
| --- | --- | --- |
| Font family — the bundled faces, then every family `codex_fonts` finds installed | `font` | `fontFamily` |
| Size, 70–180 % on the slider, 10–400 % in the exact-entry field | `size` | `fontSize = size + "%"` |
| Weight, 100–900 in steps of 100 | `weight` | `fontWeight` |
| Slant — upright, italic, oblique | `slant` | `fontStyle` |
| Capitalization — as written, UPPER, lower, Title, small caps | `caps` | `textTransform`, or `fontVariantCaps` for small caps |
| Underline — none, single, double, dotted, dashed, wavy | `underline` | `textDecorationLine` + `textDecorationStyle` |
| Underline colour | `underlineColor` | `textDecorationColor` |
| Strikethrough — none, single, double | `strike` | `textDecorationLine` + `textDecorationStyle` |
| Overline | `overline` | `textDecorationLine` |
| Superscript / subscript | `vertAlign` | `verticalAlign` |
| Baseline offset, −20 to 20 px | `baseline` | `verticalAlign` (overrides super/sub) |
| Character spacing, −20 to 100 hundredths of an em | `letterSpacing` | `letterSpacing = n/100 + "em"` |
| Word spacing, −50 to 400 hundredths of an em | `wordSpacing` | `wordSpacing = n/100 + "em"` |
| Line height, 80–300 % | `lineHeight` | `lineHeight = n/100` |
| Text direction — inherit, ltr, rtl | `direction` | `direction` |
| Alignment — inherit, left, centre, right, justify | `align` | `textAlign` |
| Text colour | `color` | `color` |
| Highlight | `highlight` | `backgroundColor` |
| Outline | `outline` | `webkitTextStroke = "0.6px " + c` |
| Shadow | `shadow` | `textShadow: 0 1px 2px c` |
| Glow | `glow` | `textShadow: 0 0 6px c` |

Spacings are stored in **hundredths of an em**, so the document holds an integer and the unit never
travels with the number — a file saying `letterSpacing: 6` means the same thing whatever font size
the element turns out to have.

One picker serves all six colours. Which property it writes is chosen by a row of chips above it,
each carrying a swatch of that property's current value so an unset colour is visibly unset rather
than reading as black. Six separate pickers in a 330 px dialog would be a scrolling contest.

### Documents written by the first build still import

`italic`, `underline`, `strike` and `wide` were booleans. `CX_APPEARANCE.normalise()` reads them
still — `italic: true` becomes `slant: "italic"`, `underline: true` becomes `"solid"`,
`strike: true` becomes `"single"`, `wide: true` becomes `letterSpacing: 6` — so an appearance
exported then applies now, and the editor shows the controls as set rather than presenting the
element as unstyled and losing the values on the next edit.

### Three things this build cannot do, and says so

They appear in the editor under *What this build cannot do*, not as absent controls. A control that
simply is not there reads as one nobody thought of.

| Not offered | Why |
| --- | --- |
| Variable-font axes past weight (width, optical size, slant) | A browser cannot enumerate the axes a locally installed font exposes, so there is no list to show. Weight is offered because CSS accepts it on any family. |
| A wavy underline *and* a double strikethrough at once | `text-decoration-style` is one property for every decoration line. The underline's style wins when both are set. |
| A baseline offset *and* superscript at once | Also one property, `vertical-align`. An explicit offset replaces the superscript rather than adding to it. |

`patchAppear` merges the patch into `state.appearance[target]`, writes the whole map to
`localStorage` under `codexstudio.appearance`, and `componentDidUpdate` calls `applyAppearance`,
which walks `document.querySelectorAll("[data-appear]")` and re-applies every stored style. So a
change lands live, on every instance of that named element, without a restart.

An unset property writes `""`, which removes the inline style and lets the Material 3 token
underneath show through — the editor never bakes a computed value it did not receive.

### The colour picker

A two-dimensional saturation/brightness field with a hue strip and three named sliders, writing
whichever of the six colour properties is selected above it. Described in full under
[The colour picker](#the-colour-picker-1) below.

> An earlier version of this section described three sliders and a hex-only text field, and sat a
> hundred lines above a second section saying something different. Both statements had been
> superseded: the field is two-dimensional, and the text input reads every representation the
> translator writes.

### The colour translator: twelve spaces

`CX.color.translate(hex)` returns twelve `[space, value]` pairs, each a click away from the
clipboard. These are the real values the app prints for `#D0BCFF`, the Material 3 primary:

| # | Space | Rendered as |
| --- | --- | --- |
| 1 | HEX | `#D0BCFF` |
| 2 | HEX8 | `#D0BCFF` — the alpha byte is appended only when alpha is below 1, so `#D0BCFF80` round-trips as `#D0BCFF80` |
| 3 | RGB | `rgb(208 188 255)` |
| 4 | RGBA | `rgb(208 188 255 / 1)` |
| 5 | HSL | `hsl(257.9 100% 86.9%)` |
| 6 | HSV | `hsv(257.9 26.3% 100%)` |
| 7 | HWB | `hwb(257.9 73.7% 0%)` |
| 8 | LAB | `lab(80% 20.2 -30.4)` |
| 9 | LCH | `lch(80% 36.5 303.5)` |
| 10 | OKLAB | `oklab(0.835 0.044 -0.083)` |
| 11 | OKLCH | `oklch(0.835 0.095 298)` |
| 12 | CMYK | `cmyk(18.4% 26.3% 0% 0%)` |

The maths is real, not approximated from a lookup table: sRGB is linearised (`lin`), converted to
CIE XYZ with the D65 matrix and on to CIELAB, and separately through the OKLab matrices; LCH and
OKLCH are the polar forms of their Cartesian pairs, with hue normalised into `[0, 360)`. Alpha
survives into HEX8 and RGBA. Hue is carried from HSV into HWB, whose whiteness and blackness come
from `min`/`max` of the channels.

### The contrast readout

Under the translator, computed live against the current theme's surface —
`#141218` in dark, `#FEF7FF` in light:

```
Contrast vs surface 10.91:1 — passes AA body text
```

(that is `#D0BCFF` against the dark surface; the same colour against the light surface reports
`1.62:1 — fails AA`, which is exactly the point of showing the number)

`CX.color.contrast` is the WCAG 2 formula over relative luminance
(`0.2126 R + 0.7152 G + 0.0722 B` on linearised channels, `(L₁+0.05)/(L₂+0.05)`). The verdict is
banded at the WCAG thresholds: **≥ 4.5** *passes AA body text*, **≥ 3** *large text only*, below
that *fails AA*. An unparseable colour reads *"Enter a valid colour to see contrast."* rather than
showing a wrong number.

## Reset, export and persistence

| Action | Where | Effect |
| --- | --- | --- |
| Reset element | Editor footer, and the root context menu | Deletes `appearance[target]` |
| Reset all | Editor footer | Clears the whole map |
| Reset every element | Studio → Appearance | Clears the map **and commits a revision**, so it is undoable from History |
| Export appearance to a file | Studio → Appearance | Downloads the document `CX_APPEARANCE.export()` builds — `format`, `version`, `exportedAt`, `app`, `elements`, `appearance`, `presets`, and any `dropped` or `warnings` — under a stable filename, so re-exporting a preset overwrites its own file |
| Import an appearance file | Studio → Appearance | A file picker. Anything the file asks for that this build cannot represent is named in `dropped` with the reason and shown, never silently discarded |
| Named presets | Studio → Appearance | Save the current appearance under a name, apply one, or delete one |
| Theme (light/dark) | Studio → Appearance, and the title bar | Sets `data-theme` on `<html>`, persisted under `codexstudio.theme` |

The appearance map is part of the local version-control snapshot (`vcs.snapshot()` reads both
`appearance` and `appearancePresets`), so restoring an earlier revision restores the styling that
was in force at the time — see [local-version-control.md](app-doc://article/codex-material.repository.a0ecf3aefb9f14d2).

## Configuration

| Knob | Where | Default |
| --- | --- | --- |
| Per-element styles | `localStorage["codexstudio.appearance"]` | `{}` |
| Theme | `localStorage["codexstudio.theme"]`, `data-theme` on `<html>` | `dark` |
| Font family options | `fontOptions()` in `app/index.html` | The five bundled entries — Default (Roboto), Roboto Mono, Georgia, Helvetica Neue, System UI — then every family `codex_fonts` finds installed on the machine |
| Size / weight ranges | The sliders' bounds, and the exact-entry field's | Size 70–180 % step 5 on the slider, 10–400 % typed; weight 100–900 step 100 |
| Default editor colour | `appearColor` fallback | `#D0BCFF` |
| Bundled faces | `app/fonts/` | Roboto and Roboto Mono, 10 woff2 files, Apache-2.0 |

Traditional Chinese glyphs fall through to the Windows system CJK stack
(`--cx-cjk`: Microsoft JhengHei UI, Noto Sans HK, PingFang HK, …) rather than shipping a
multi-megabyte CJK webfont, so Cantonese copy stays legible in every language mode.

## What is not implemented yet

Stated plainly, because a documented capability that does not exist is worse than an absent one.

- **The colour picker has no swatch grid, no recents, no eyedropper and no saved palettes.** The
  two-dimensional saturation/brightness field, the hue strip, the three named sliders and the
  free-text field are the whole picker. The six colour *targets* are chips, not swatches — they
  choose which property the one picker writes, and do not offer a palette to pick from.
- **No search bar inside the appearance editor.** The Studio settings surface has one, wired to the
  regex builder; the per-element popover does not. The font dropdown *does* carry its own filter and
  regex builder, which is what makes several hundred installed families usable rather than a wall.
- **Non-typographic properties are not editable per element** — no radius, border, spacing,
  background, icon or per-state (hover/focus/collapsed) targeting. `highlight` sets a background
  colour, but that is a text-highlight property rather than surface styling. Groups carry an
  `appearance` field in their record that nothing writes.
- **`density` and `reducedMotion` are stored but unread.** Both appear in the `CX.settings`
  defaults in `app/codex-core.js`; no control sets them and no code consumes them. The Studio
  Appearance section's description mentions density, which is currently inaccurate.
- **Gamut warnings are absent.** LAB, LCH, OKLab, OKLCH and CMYK are computed and displayed
  without checking whether the value is representable in sRGB, and nothing warns before clipping.

## The colour picker

A draggable **two-dimensional saturation/brightness field** with the thumb sitting at the current
colour, a hue strip painted in the hues it selects, and three named sliders beneath it for
keyboard use and exact numbers. Before this it was a swatch and three unlabelled range inputs —
neither continuous in two dimensions nor identifiable, since three identical sliders in a row
tell you nothing about which is which.

The free-text field reads **every representation the translator writes**: hex, hex8, `rgb()`,
`rgba()`, `hsl()`, `hsv()`/`hsb()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, `cmyk()`,
and the named colours. Both the legacy comma form and the modern space-with-slash-alpha form
parse, alpha is preserved rather than dropped, and anything that is not a colour returns `null`
rather than a guess — an unparseable value stays in the field instead of being swallowed
mid-keystroke.

> This was one-way until recently: the panel printed `oklch(0.85 0.06 300)` and then refused that
> exact string if you typed it into the field directly beneath. `CX.color.parse` is verified by
> round trip in `tools/test-frontend.mjs` — every space emitted for seven colours, parsed back,
> compared — because an inverse transform that is subtly wrong in one space is the bug nobody
> notices for a year. Worst channel drift is 1 of 255.

## Per-element keying, and why tabs use ids

The appearance store is keyed by the `data-appear` string. Every loose tab used to render with
the same literal `data-appear="Tab"`, so restyling one restyled all of them at once — and a tab
*inside a group* carried no `data-appear` at all and could not be restyled. Both chips now key by
`"Tab:" + tab.id`, which survives a rename where the visible title does not, and the editor
resolves the id back to the tab's title for its heading so nobody is asked to read `Tab:9f3c`.

## Every change is a revision

`patchAppear` and both reset buttons commit to the local version history, so restyling something
can be undone from the History panel like anything else. The commit is **debounced by 900 ms**:
`patchAppear` fires on every frame of a colour drag, and one revision per frame would bury the
log under a few hundred entries nobody will read. The two resets skip the debounce because they
are discrete, deliberate and destructive, and an unchanged state still records nothing.

See [local-version-control.md](app-doc://article/codex-material.repository.a0ecf3aefb9f14d2).

## Failure modes

| Symptom | What the user sees | Cause |
| --- | --- | --- |
| Right-click gives no appearance item | The element's own menu, unchanged | The element has no `data-appear`, or its menu omits `appearItem(e)` |
| Editor opens with an empty title | Header reads *"Appearance — "* | `appearTarget` is null; the root handler only opens the editor when a name was found |
| Invalid hex typed | Contrast line reads *"Enter a valid colour to see contrast."*; the swatch keeps the last valid colour | `hexToRgb` returned `null` |
| A style does not visibly apply | Nothing changes | Check it is one of the twenty-three in the table above, and that it is not one of the three the platform cannot represent — the editor lists those with their reasons |
| A cleared control leaves the old style in place | The element keeps a style nothing is set to | Only properties this system set on the previous pass are cleared. Clearing every property it knows about would erase the template's own inline styles, which is what happened once: the UI audit went from 23 findings to 251, all but 23 of them contrast failures, because the backgrounds were gone |
| Styling survives a reset | The old value returns | Reset removes the map entry; the Material 3 token underneath may look similar |
| Editor clipped at a window edge | It is not | Position is clamped to `innerWidth - 350` / `innerHeight - 470` before opening |

## Security considerations

- **Everything is local.** Styles live in `localStorage`; nothing is fetched or transmitted. The
  CSP (`style-src 'self' 'unsafe-inline'`, `font-src 'self'`) means a stored font family can only
  ever resolve to a bundled or system face — a hostile value cannot pull a remote font.
- **Values are applied as DOM style properties**, never interpolated into a stylesheet or markup
  string, so a crafted value cannot escape into CSS injection.
- **Export writes a file the user asked for.** It contains only element names and style
  values — no paths, no session content, no credentials.
- **Contrast is advisory.** The readout compares against the app's surface colour, not against
  whatever the element actually sits on. A passing number is not a guarantee for a chip on a
  coloured container.

## Verification

1. **Reach:** right-click each of the 41 targets and confirm the appearance entry appears and names
   that element.
2. **Shift path:** Shift+right-click opens the editor straight away; plain right-click
   keeps the element's own menu intact (test on a tab, which has a full management menu).
3. **Live application:** change size, weight, slant, capitalization, an underline style, a
   spacing and each of the six colours; every one must land immediately on every instance of that
   named element, with no restart.
4. **Clearing:** press each segmented control's already-selected segment and confirm the property goes
   away *and* the element's own inline styling — background, alignment, line height — survives.
5. **Persistence:** restart and confirm the styles return.
6. **Translator:** set `#D0BCFF` and check all twelve rows render; reach one by keyboard, activate
   it with Enter, and confirm the clipboard holds exactly that string.
7. **Contrast bands:** pick a colour near 4.5:1 and one near 3:1; confirm the verdict changes at
   the thresholds and that both light and dark themes recompute.
8. **Invalid input:** type `#zz` and confirm the contrast line reports it instead of showing a
   number.
9. **Reset:** reset one element, then reset all. Confirm *Reset every element* in Studio also
   records a revision that History can undo.
10. **Edge placement:** open the editor from an element at the extreme right and bottom of the
   window; it must stay fully on screen.
11. **Self-theming:** style the *Regex builder* and the *Dropdown* targets and confirm the popovers
    themselves change.
11. **Screenshot:** `node tools/capture.mjs --only appearance` renders the editor from the real
    app into `assets/screenshots/`.
