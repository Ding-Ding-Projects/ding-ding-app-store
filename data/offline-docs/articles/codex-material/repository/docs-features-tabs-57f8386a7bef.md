# Tabs

> A browser-style strip: content is navigated, not scrolled. Pinning, groups, an overflow surface,
> four independent searches, and a bulk close whose two directions are built from one predicate.

**Implementation:** `app/cx-tabs.js`, attached as `window.CX_TABS` and instantiated once in
`app/codex-core.js` as `CX.tabs = CX_TABS.create(store)`. The module owns the **model only** —
order, pinning, groups, the searches and the predicate. Presentation lives in `app/index.html`
(`tabVals`, `tabChipFor`, `tabMenu`, `groupMenu`, the four `open*Search` methods, and
`dimSumVals`, which also carries the bulk-close bindings).

## Two invariants

Breaking either is a silent data-loss bug rather than a visual one, so they are stated at the top
of the module and repeated here.

1. **Bulk close matches the tab's visible label and nothing else.** It never inspects page
   contents or hidden state. A user closing "everything with `payments` in the name" must be able
   to predict the result from what the strip shows them.
2. **"Close tabs containing X" and "Close tabs NOT containing X" negate the exact same
   predicate.** If they were built separately, casing, Unicode handling or a regex flag could
   drift between them and the two actions would stop being inverses of each other.

## The tab model

Each tab is a plain object:

```jsonc
{ "id": "t-3f9a2b1", "title": "sandbox policy audit", "kind": "chat", "payload": { "session": "…" },
  "pinned": false, "groupId": null, "order": 4, "dirty": false, "workspace": "default" }
```

`kind` drives both the chip glyph and what activating the tab opens (`openTabPayload`): `chat`
(💬), `console` (▶), `changelog` (≡) and `studio`. A pinned tab shows 📌 instead of its kind glyph.
`workspace` is the app's profile — the master search spans all of them.

Groups are equally plain:

```jsonc
{ "id": "g-8c1d40", "name": "Review", "color": "#D0BCFF", "collapsed": false,
  "pinned": false, "icon": "", "order": 1, "appearance": null }
```

The whole model persists to `localStorage` under `codexstudio.tabs` on **every** mutation —
`emit()` calls `persist()` before notifying subscribers — so tab order, pinned order, group
membership, group order and collapsed state all survive a restart. `load(seed)` restores it and
only falls back to the seed (the active profile's sessions) when nothing was saved.

## Pinning

Pinned tabs occupy a stable region ahead of the ordinary ones and keep their own relative order
within it. `sorted()` is the single place that decides:

```js
if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
return (a.order || 0) - (b.order || 0);
```

Consequences, all of them deliberate:

- `move(id, index)` reorders a tab **within its own region**. Moving a pinned tab can never drop it
  among the ordinary ones and vice versa, so pinning is not silently undone by a reorder. See
  [Reordering](#reordering) for how it is reached — for a long time it was not reached at all.
- `overflow(capacity)` computes `room = Math.max(pinnedCount, capacity)` before slicing, so
  **pinned tabs stay visible when ordinary tabs overflow**. That is the point of pinning.
- Pinned tabs are excluded from `closeOthers`, `closeToRight` and both text-based bulk closes
  unless the caller explicitly passes `includePinned`. The UI passes `false` for the two menu
  actions and exposes the choice as a toggle in the bulk-close dialog.
- Pinned chips cap their label at 150 px against 210 px for ordinary ones, and keep the full name
  in `title` so it is still reachable when truncated.

Pin and unpin are on the tab context menu (`pin(id)` with no second argument toggles), and the
searchable tab lists mark pinned rows with 📌.

## Groups

`createGroup`, `renameGroup`, `setGroup(patch)`, `moveGroup(id, index)`, `removeGroup`, `assign`
and `toggleCollapsed`. The group header's context menu offers collapse/expand, rename, colour,
*search this group*, *close tabs in this group containing text*, ungroup and **Edit appearance**.

Two behaviours are worth calling out:

- **Removing a group never closes its tabs.** `removeGroup` sets `groupId = null` on every member
  first, so they return to the loose region. The menu label says so: *"Ungroup (keeps every tab)"*.
- **A collapsed group stays collapsed.** Activating a tab inside one does not force the group open
  and does not rewrite the user's collapsed preference; `activate()` only sets `activeId`.

Group colour is currently chosen from a six-swatch dropdown that also accepts free entry
(`groupColourPrompt`, `allowFree: true`) rather than from the infinite colour picker the appearance
editor uses. The `icon` and `appearance` fields exist on the group record and persist, but no
control writes them yet — see [appearance.md](app-doc://article/codex-material.repository.76c14a1ab0254ae4) for the current reach of the
per-element editor.

## Reordering

| Route | Binding |
| --- | --- |
| Keyboard | Ctrl+Shift+← / → on the focused tab |
| Context menu | **Move left** and **Move right**, which show the same shortcut |

Both call `moveTabBy(tab, delta)`, which resolves the tab's position **within its own
pinned/unpinned region** and refuses a move past either end. One mover, two routes, so they
cannot drift apart. Focus stays on the tab that moved, so holding the shortcut walks a single tab
along the strip rather than shuffling whatever slides into the gap behind it.

> [!NOTE]
> `CX.tabs.move()` was written correctly, handled the two regions, renumbered and emitted — and
> **nothing in the application ever called it**. Not one call site. Reordering, a first-class
> requirement of the tab rules, was a function waiting in a file for a caller that never arrived,
> while this document described it as though it were reachable. If you are documenting a
> capability, grep for a call site before believing the function is the feature.

## Accessibility

A `tablist` exposes **exactly one tab stop**. Tab enters the strip, arrows move within
it, Tab leaves. Each tab carries `role="tab"`, `aria-selected`, a live
`aria-controls="tabpanel-main"`, and `tabindex="0"` only when it is the selected one — every
other tab is `-1`.

| Key | Effect |
| --- | --- |
| ← / → | Move between tabs; focus follows selection |
| Home / End | First / last tab |
| Delete or Ctrl+W | Close the focused tab |
| Ctrl+Shift+← / → | Move the focused tab |

The close **✕** inside each tab keeps its `role="button"` and its accessible name but is
`tabindex="-1"`, so it is not a second tab stop. It previously shared the tab's own `tabindex`
expression, which meant a selected tab contributed **two** stops and put a `role="button"` inside
a `role="tab"` — a nesting ARIA has no answer for. It is still operable from the keyboard through
Delete.

## Overflow

`overflow(capacity)` returns the tabs that do not fit; **the caller measures**. `tabCapacity()` in
`app/index.html` is that measurement:

```js
Math.max(2, Math.floor((window.innerWidth - 520) / 150))
```

Tabs are never silently clipped: the strip renders only what fits, and the `⋯ N` button beside it
opens a dropdown listing exactly the hidden ones, each with its pinned marker. The button turns
primary-coloured while anything is hidden and its tooltip states the count. With nothing hidden,
pressing it raises an informational toast rather than opening an empty menu.

## The four searches

All four hang off the tab-strip search menu (`tabSearchMenu`), and each opens an anchored dropdown
whose filter field carries `data-anchor="dd"` — so each gets the full regex builder bound to that
dropdown's query, with plain text as the default.

| # | Model call | Scope | What a row shows |
| --- | --- | --- | --- |
| 1 | `searchStrip(spec)` | Every tab in this strip | 📌 marker, title, and `▤ <group>` when grouped |
| 2 | `searchGroup(groupId, spec)` | One group, chosen from a picker | 📌 marker and title |
| 3 | `searchGroups(spec)` | Groups, by visible name and icon | Name, tab count, and whether it is collapsed |
| 4 | `searchAll(spec)` | Every tab across every workspace | Workspace, strip, group, pinned state and label |

Each returns `{ ok, error, mode, results, count }`. `mode` is `"text"` or `"regex"` so the caller
can say which one ran; `error` carries the compile failure or the empty-query message verbatim.

Search 3 reveals a hit inside a collapsed group by expanding it on activation
(`if (g && g.collapsed) CX.tabs.toggleCollapsed(g.id)`) — a deliberate, user-initiated expansion,
not a silent loss of the preference. Search 4 identifies each hit's workspace by name so a result
is never ambiguous, and picking a hit in another profile sets `activeProfile` before navigating.

`_search` caps at `LIMITS.matches` (5000) rows — far above any realistic tab count, and there so a
pathological pattern cannot build an unbounded array.

## Bulk close, from one predicate

`predicate(spec)` is the only matcher in the module. It takes
`{ text, regex: { pattern, flags[] } | null, caseSensitive }` and returns
`{ ok, error, mode, test(label) }`.

- **Plain text is the default.** With no `regex.pattern` it lowercases both sides unless
  `caseSensitive` is set, then does an `indexOf` test.
- **Regex is opt-in**, arriving from the anchored builder. `g` and `y` are stripped (a carried
  `lastIndex` would make the same label match on one pass and miss on the next), the pattern is
  length-checked against `LIMITS.pattern` (2000), and a compile failure comes back as `ok: false`
  with the constructor's own message.
- **An empty query is refused**, not treated as "matches everything":
  *"Enter text to match — an empty query closes nothing."*

Both directions run through it:

```js
var hit = p.test(t.title);
if (spec && spec.invert) hit = !hit;
```

That single negation is the entire implementation of "NOT containing". Flags, casing, Unicode
handling and scope physically cannot differ between the two actions, because there is one compiled
`RegExp` and one comparison.

### Preview, then apply

`previewBulkClose(spec)` closes nothing. It returns:

| Field | Meaning |
| --- | --- |
| `matched` | Tabs that would close |
| `protectedPinned` | Pinned tabs that matched but are excluded because `includePinned` is off |
| `dirty` | Matched tabs with unsaved work, so the preview can flag them |
| `total` | Size of the pool the scope selected |
| `mode`, `invert`, `scope`, `ok`, `error` | What ran, and on what |

`scope` is `{kind:"strip"}`, `{kind:"group", id}`, `{kind:"groups", ids[]}` or `{kind:"all"}`. The
preview never crosses a scope boundary silently: the dialog title states which direction it is and
the summary states the mode (`regex` or `plain text`) and the counts.

That dialog is the **one blocking modal in the app** (`role="dialog" aria-modal="true"`), because
closing tabs is a decision that must be made before anything else continues. It lists every matched
tab with a ✕, every protected pinned tab with a 📌 and the word *protected*, and marks dirty tabs
as unsaved. The apply button reads *"Nothing to close"* and is not actionable until something
matches.

`bulkClose(preview)` applies it and reports honestly:

```jsonc
{ "closed": [ … ], "skipped": [ … protected pinned … ], "error": null }
```

It never claims a protected tab went away. `applyBulk` in `app/index.html` takes a
`CX.tabs.snapshot()` **before** closing and offers **Undo** as an action on the resulting
notification, which calls `restore(snapshot)` — so a bulk close is reversible from the toast, not
only from History.

`closeOthers` and `closeToRight` are built from the same `bulkClose` entry point with a
hand-constructed preview, so they report skipped pinned tabs the same way.

## Configuration

| Knob | Where | Default |
| --- | --- | --- |
| Storage key | `create(store, { key })` | `"tabs"` → `localStorage["codexstudio.tabs"]` |
| Pattern length / result cap / ms budget | `LIMITS` in `app/cx-tabs.js` | 2000 / 5000 / 250 |
| Strip capacity | `tabCapacity()` in `app/index.html` | `max(2, floor((innerWidth - 520) / 150))` |
| Default group colour | `createGroup(name, color)` | `#D0BCFF` |
| Pinned label width | `tabChipFor` | 150 px pinned, 210 px ordinary |

## Failure modes

| Symptom | What happens | Why |
| --- | --- | --- |
| Empty bulk-close query | *"Enter text to match — an empty query closes nothing."*, apply inert | An empty predicate would close the whole strip |
| Invalid regex in bulk close | The constructor's message; `test()` returns `false` for everything, apply inert | Never close on a pattern that did not compile |
| Pattern over 2000 characters | *"Pattern exceeds 2000 characters."* | `LIMITS.pattern` |
| A pinned tab matches | Listed in the preview as *protected*, not closed, named in the result's `skipped` | Pinned exclusion is the default |
| Closing the active tab | The first tab in sorted order becomes active; `null` when none remain | `close()` and `bulkClose()` both re-resolve `activeId` |
| A subscriber throws while repainting | The others still repaint | `emit()` wraps each callback in `try/catch` |
| `assign` to a group that does not exist | Returns `false`, nothing changes | Guarded in `assign` |
| `restore` with a malformed snapshot | Returns `false`, nothing changes | Guarded in `restore` |

## Security considerations

- **Labels only.** Every search and both bulk closes match `t.title` and nothing else. No search
  reads transcript bodies, file contents, payloads or any hidden field.
- **Local evaluation, bounded.** Patterns compile and run in the renderer under the bounds above;
  see [regex-builder.md](app-doc://article/codex-material.repository.7ced8600c459bff3), including why a time budget alone is not sufficient and
  which pattern shapes are refused before they run.
- **Destructive actions are gated and reversible.** Preview before apply, pinned excluded by
  default, dirty tabs flagged, undo on the confirmation toast.
- **Persistence is local.** `localStorage` inside the app's own profile directory. Tab titles can
  contain session names and paths; they are never transmitted, and the tab model rides along in the
  local git snapshot described in [local-version-control.md](app-doc://article/codex-material.repository.a0ecf3aefb9f14d2).

## Verification

1. **Persistence:** open several tabs, pin two, group three, collapse the group, reorder, restart.
   Order, pinned region, group membership, group order and collapsed state must all come back.
2. **Pinned stay visible:** narrow the window until ordinary tabs overflow. Every pinned tab must
   remain in the strip, and the `⋯ N` count must equal the number of hidden ordinary tabs.
3. **Overflow completeness:** the dropdown must list exactly the hidden tabs — no more, no fewer.
4. **Ungroup is not a close:** remove a group with three tabs; all three must reappear loose.
5. **The four searches:** run each in turn. Search 3 must name the group and its collapsed state;
   search 4 must label the workspace on every row.
6. **Inverse pairs:** with tabs `alpha`, `beta`, `gamma`, run *close containing* `a` and note the
   preview, cancel, then run *close NOT containing* `a`. The two matched sets must partition the
   strip exactly — no tab in both, none in neither.
7. **Regex parity:** apply `^b` through the builder in both directions. Same requirement.
8. **Pinned protection:** pin `beta`, then *close containing* `b`. `beta` must appear as protected
   and survive. Enable *include pinned* and confirm it is then listed for closing — previewed
   before anything happens.
9. **Empty and invalid queries:** neither may close anything, and both must say why.
10. **Undo:** apply a bulk close, then press **Undo** on the toast. Every closed tab must return
    with its pinned state, group and order intact.
11. **Keyboard and screen reader:** the strip is a `role="tablist"` of `role="tab"` chips carrying
    `aria-selected`; each close affordance is a focusable `role="button"` with an `aria-label`
    naming its tab; the group header exposes `aria-expanded`. Confirm with a screen reader, and see
    [../experience/accessibility.md](app-doc://article/codex-material.repository.89891138dfc32b4e) for the gaps that remain.
