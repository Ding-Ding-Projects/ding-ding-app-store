# Regex builder

> Guided pattern construction, a raw editor, live matches and bounded evaluation — anchored beside
> the search bar it belongs to, and refusing outright the shapes no time budget can save it from.

**Implementation:** `evaluate`, `nestedQuantifier`, `overlappingBranches`, `CONSTRUCTS`, `FLAGS`
and `LIMITS` in `app/codex-core.js`; the builder panel, `openRegexFor`, `sampleFor` and `matcher`
in `app/index.html`; a second, independent guard for changelog search in `app/cx-changelog.js`
(`nested`, `matcher`); a third, deliberately simpler one for tab labels in `app/cx-tabs.js`
(`predicate`).

## The engine

The engine is **the JavaScript `RegExp` of the Chromium runtime Electron bundles** — the same
engine every list filter in the app already uses. There is no second dialect, no server-side
evaluation and no translation layer, so a pattern that works in the builder works in the search
bar it was built for, character for character. Because Electron ships its own Chromium, the
dialect is the same on every machine; it does not vary with what the user has installed.

Consequences worth stating, because they surprise people arriving from PCRE:

- **No atomic groups and no possessive quantifiers.** `a++` is a syntax error, not a possessive
  match. The construct palette labels it as such.
- **Lookbehind is supported** — `(?<=…)` and `(?<!…)` both compile.
- **Named groups** `(?<name>…)` are supported and surfaced as `named` on each match row.
- **`\p{…}` needs the `u` flag.** Without it the escape is a literal `p`.

### Supported flags

All eight JavaScript flags, from `CX.FLAGS`:

| Flag | Meaning |
| --- | --- |
| `g` | Global — every match, not just the first |
| `i` | Ignore case |
| `m` | Multiline anchors: `^`/`$` match at line breaks |
| `s` | Dot matches newline |
| `u` | Unicode mode (required for `\p{…}` and astral escapes) |
| `v` | Unicode sets |
| `y` | Sticky |
| `d` | Match indices |

`CX.evaluate()` **always adds `g`** internally, because it walks every match to build the results
list. That is an implementation detail of the preview, not a change to the pattern you copy out.

Every *filtering* path strips the stateful flags before testing, because a carried `lastIndex`
would make the same row match on one pass and miss on the next:

| Caller | Strips |
| --- | --- |
| `matcher()` in `app/index.html` | `g` |
| `matcher()` in `app/cx-changelog.js` | `g` and `y` |
| `predicate()` in `app/cx-tabs.js` | `g` and `y` |

## The bounds

`CX.LIMITS`, applied by `CX.evaluate(pattern, flags, sample)`:

| Limit | Value | Enforced how |
| --- | --- | --- |
| `pattern` | 2000 characters | Rejected before compiling: *"Pattern exceeds 2000 characters."* |
| `sample` | 20000 characters | Rejected before compiling: *"Sample exceeds 20000 characters."* |
| `matches` | 500 | Collection stops, `truncated: true` is reported, the pattern is still valid |
| `ms` | 300 | Elapsed time checked **every 200 matches**; on overrun `timedOut: true` and `ok: false` |

A zero-width match advances `lastIndex` by hand (`if (m[0] === "") re.lastIndex++`), so `^`, `\b`
or `(?:)` produce a finite result list instead of spinning forever.

`app/cx-tabs.js` keeps its own smaller set — `{ pattern: 2000, matches: 5000, ms: 250 }` — because
it matches short tab labels rather than a sample blob. `app/cx-changelog.js` reads `CX.LIMITS`
when it is present and falls back to the same numbers when it is not.

## Why a time budget is not enough

This is the part that matters, and it is not a theoretical concern.

**A single `RegExp.exec` (or `test`) call cannot be interrupted from JavaScript.** There is no
preemption point inside it. The `LIMITS.ms` check in `evaluate()` sits in the `while` loop
*between* matches:

```js
if (++guard % 200 === 0 && performance.now() - t0 > LIMITS.ms) { res.timedOut = true; break; }
```

That loop body only runs after `re.exec()` has returned. A pattern whose cost is spent *inside*
one call never reaches the check at all. The window stops repainting, the title bar stops
responding, and the only remedy left to the user is killing the process.

So the ms budget protects against one thing — a cheap pattern producing an enormous number of
matches — and does nothing at all about the classic exponential blow-up. The only real defence is
to **refuse the shape before running it**.

### Measured, not reasoned about

Every threshold below comes from running the shape against the raw engine on 26 hostile
characters, not from reasoning about which shapes "look" catastrophic:

| Pattern | Raw engine | Verdict |
| --- | ---: | --- |
| `(a?a?)+$` | **195 000 ms** | refused |
| `([a-z]?[a-z]?)+$` | 178 000 ms | refused |
| `([a-z]*)+$` | 32 000 ms | refused |
| `(a\|a)*$` | 11 700 ms | refused |
| `(a+\|b)+$` | 8 200 ms | refused |
| `(a+)+$` | 8 100 ms | refused |
| `(a+a)+$` | 33 ms | **allowed** |
| `([A-Z][a-z]+)+$` | 0.0 ms | **allowed** |
| `(\.\w+)+$` | 0.0 ms | **allowed** |
| `(\s[A-Z][a-z]+)*$` | 0.0 ms | **allowed** |
| `(\s*,\s*)+$` | 0.0 ms | **allowed** |

The pattern in that data is **not** "contains a nested quantifier". It is whether each iteration
of the outer repeat has something it *must* consume. `(\.\w+)+` has to eat a literal dot every
time round, so there is exactly one way to divide the input into iterations and it runs in zero
milliseconds. `(a+)+` has no such anchor, so the outer repeat can re-split the same run of `a`s
an exponential number of ways. `(a+a)+` has a mandatory trailing `a` and lands at 33 ms, which is
why it is allowed rather than refused on principle.

> [!WARNING]
> **The previous rule refused any repeated group containing an unbounded quantifier anywhere
> after the first position.** That caught the top six *and* the bottom four — so "match a run of
> Title Case Words" and "match a chain of `.extensions`" were both rejected as catastrophic while
> measuring nothing at all, and `(a?a?)+$`, the one that takes three minutes, sailed straight
> through: it has no inner `+` for the scan to find and no repeated branch for the alternation
> scan. Over-refusing is a real cost, not a safe default. A guard that rejects working patterns
> teaches people to distrust it, and this one was doing that while missing the actual hazard.

### What is refused

`nestedQuantifier(pattern)` walks the pattern, finds each group that carries an unbounded outer
repeat, and applies three tests to its body. Each returns the **offending fragment**, which the
error message quotes back so the user can see which part of their pattern is the problem — and
each gives its **own** reason, because they are not the same problem.

**1. The body can match nothing** — `nullable(body)`.

`(a?a?)+`, `([a-z]*)+`, `(a|)+`, `(\s*)+`. Where the body is also ambiguous this is the worst
case in the whole table. Where it is not, the repeat still does nothing useful, because a group
matching the empty string cannot advance the position. Either way the pattern is a mistake.

**2. The alternation branches overlap** — `overlappingBranches(body)`.

`(a|a)*` and `(x|xx)+y` never touch a nested `+`, and blow up because two branches that can match
the same text give the engine an exponential number of equivalent ways to split the input. The
body is split on top-level `|` — skipping escapes, character classes and nested groups — and the
leading token of each branch compared; a shared or unresolvable leading token means they may
overlap.

**3. No branch has a fixed-count anchor** — `everyBranchAnchored(body)`.

An atom anchors when its quantifier is absent, or is `{n}`/`{n,m}` with `n ≥ 1` and `m` finite.
`?`, `*` and `+` do not anchor. A group atom anchors only if it is itself anchored all the way
down. If *any* top-level alternative lacks an anchor the pattern is refused, which is what catches
`(a+|b)+` — the `b` branch is anchored, the `a+` branch is not, and one unanchored branch is
enough.

| Refused | Allowed |
| --- | --- |
| `(a?a?)+$` | `(a+a)+$` — the trailing `a` anchors each iteration |
| `(a+)+$` | `(\.\w+)+$` — the literal `\.` anchors it |
| `(a+\|b)+$` | `([A-Z][a-z]+)+$` — the `[A-Z]` anchors it |
| `([a-z]*)+$` | `(\s*,\s*)+$` — the comma anchors it |
| `(a\|a)*$` | `(?:abc)+$`, `(foo\|bar)+$`, `(https?://)+` |

Lookarounds are explicitly skipped — `(?=…)+` is a different shape — and `(?:…)` /
`(?<name>…)` prefixes are stripped from the body before it is examined.

### The message says the reason that applies

Three shapes, three messages. Telling a user that `(a?)+` will freeze their window is simply
false — it returns in a fraction of a millisecond — and a guard that cries catastrophe every
time is one people learn to click through.

| Shape | What the message says |
| --- | --- |
| nullable | "repeats a group that can match nothing at all… give the group something it must consume" |
| overlapping branches | "repeats a group whose branches can match the same text… make the branches distinguishable" |
| unanchored | "repeats a group with nothing in it that must appear a fixed number of times… add a part the group must consume once" |

`tools/test-frontend.mjs` asserts all three messages differ from each other, that each names its
own cause, and that the remedy never recommends bounding the outer repeat — an earlier version of
this guard suggested rewriting `(a+)+` as `(a+){1,20}`, and that advice was itself the defect:
bounding the outer repeat does not remove the ambiguity, it caps the number of ways the engine
may split the input at twenty, which is astronomically more work than `+` would do before giving
up on a short string.

The suite also pins the guard to the measurements: every pattern measured as catastrophic must be
refused, and every pattern measured at ~0 ms must not be. **Zero holes and zero false positives**
across that set, apart from four degenerate no-ops such as `(a?)+` that are refused deliberately
because a repeated group matching the empty string is a bug either way.

The changelog engine carries the same refusals under the `rx.*` keys in `app/cx-changelog.js`, in
all five funny levels and both languages. The bounds and the refusal are separate mechanisms and
neither replaces the other: the refusal handles shapes, the bounds handle volume.

### What the refusal does not cover

It is a syntactic guard over group structure, not a proof. A pattern that backtracks
catastrophically without repeating a group and without overlapping alternation branches will not be
caught, and will hit — or fail to hit — the ms budget exactly as described above. The 20 000-character
sample cap is the remaining load-bearing mitigation. **Do not raise it without moving evaluation off
the main thread**, which nothing in this repository does today.

### `evaluate()` returns

```jsonc
{ "ok": true, "error": null, "ms": 1.2, "truncated": false, "timedOut": false,
  "matches": [ { "index": 12, "text": "…", "groups": ["…"], "named": null } ] }
```

On a refusal it additionally carries `refused: "<the offending fragment>"`, which the test suite
asserts is non-empty so a refusal can never be a bare "no".

## Guided construction

`CX.CONSTRUCTS` supplies the palette, grouped so somebody who does not write regex daily can build
one by clicking:

| Group | Contents |
| --- | --- |
| Characters | `.` `\d` `\w` `\s` `\D` `\S` `[abc]` `[^abc]` `[a-z]` `\p{L}` |
| Anchors | `^` `$` `\b` `\B` |
| Quantifiers | `*` `+` `?` `{2,4}` `*?` — plus `++`, labelled *"(not in JS) use atomic-free rewrite"* |
| Groups | `(…)` `(?:…)` `(?<name>…)` `(?=…)` `(?!…)` `(?<=…)` `(?<!…)` `a\|b` |

Each token carries a plain-language description on hover; clicking appends it to the raw pattern
editor. The panel also shows the engine note verbatim:

> Engine: JavaScript RegExp — the same engine that filters these lists. Limits: pattern 2000 chars,
> sample 20000 chars, 500 matches, 300 ms. Nothing is persisted or sent anywhere.

## Every search bar has one, anchored beside it

This is the product rule, not a nicety: **a builder belongs to the field the user is already
typing in.**

Mechanically, in `app/index.html`:

1. The search field's container carries `data-anchor="<target>"`.
2. Its trailing `.*` button calls `openRegexFor("<target>", currentQuery)`.
3. `openRegexFor` finds the anchor with `document.querySelector('[data-anchor="…"]')`, measures it
   with `getBoundingClientRect()`, clamps the popover inside the viewport
   (`Math.min/Math.max` against `window.innerWidth`/`innerHeight`) and opens it just below the
   field — pre-loaded with the pattern already applied to that field, or the current query as a
   starting point.
4. `sampleFor(target)` fills the sample box with **the values that field actually filters** — the
   extension titles, the setting keys, the slash-command names, the dropdown options, the palette
   entries, the session names — so "does this match?" is answered against real data rather than a
   lorem-ipsum paragraph.
5. **Apply** stores `{ pattern, flags }` as `<target>Regex` in state and copies the pattern into
   `<target>Query`; `matcher(query, spec)` then filters with the compiled pattern instead of the
   plain-text substring test.

The nine anchored fields, one `data-anchor` each:

| Anchor | Field |
| --- | --- |
| `list` | The sidebar list search (sessions, commands, settings sections, history kinds — whatever the current tab lists) |
| `ext` | The Extend filter |
| `set` | The Config filter |
| `clog` | The changelog search |
| `studio` | The Studio settings search |
| `slash` | The slash-command catalog |
| `palette` | The command palette (Ctrl+Shift+F) |
| `dd` | The dropdown option filter — which is what the four tab searches ride on |
| `bulk` | The bulk-close query |

Each owns its own `<target>Query` and `<target>Regex` state, so no two fields share hidden state
and applying a pattern in one never changes another.

Every one of those fields also has a right-click menu (`filterItems`) offering *filter to this*,
*exclude this*, *starts with*, *exact match*, *open the regex builder with this* and *clear* — the
exclude/starts-with/exact entries write a real pattern into the same `<target>Regex` slot the
builder uses, so the modes cannot drift.

**Plain text is the default.** Typing in a field clears any applied pattern (every
`set<Target>Query` handler sets `<target>Regex: null`); regex applies only when the builder's
**Apply** is pressed. The field border and the `.*` button change colour while a pattern is active.

### Where the rule is not fully satisfied yet

The Config panel's search filters the fields of the **currently selected section only**
(`section.fields.filter(setMatch)`), so a setting whose name the user knows but whose section they
do not is not found, and there is no "this match is on another tab" affordance. That is
outstanding work, not documented behaviour.

### Stacking

The builder renders at `z-index: 99`, above every surface that can open it — the command palette's
scrim sits at 96 and the bulk-close dialog's at 98. It was previously at **85**, so the builder
those two dialogs offer opened *behind* the dialog offering it and could not be used at all: a
feature that existed exactly as far as the eye could see and no further. If you add an overlay
above 99, the builder has to move with it.

## Configuration

| Knob | Where | Default |
| --- | --- | --- |
| Bounds (`pattern`, `sample`, `matches`, `ms`) | `LIMITS` in `app/codex-core.js`, exported as `CX.LIMITS` | 2000 / 20000 / 500 / 300 |
| Tab-label bounds | `LIMITS` in `app/cx-tabs.js` | 2000 / 5000 / 250 |
| Initial flags for a newly opened builder | `state.regexFlags` in `app/index.html` | `["g", "i"]` |
| Per-field applied pattern | `state.<target>Regex` | `null` (plain text) |
| Construct palette | `CX.CONSTRUCTS` | four groups, as above |

None of these are user-editable settings and none are persisted: an applied pattern lasts for the
session, and closing the panel does not silently keep filtering.

## Failure modes

| Symptom | What the user sees | Cause |
| --- | --- | --- |
| Repeat over a repeating group | *"Refused: `(a+)+` repeats a group that already repeats…"*, with the fragment quoted | The guard, before compiling — see above |
| Overlapping alternation under a repeat | The same refusal, quoting `(a\|a)*` or `(x\|xx)+y` | `overlappingBranches` |
| Invalid pattern | The `RegExp` constructor's own message, verbatim | Syntax error; the message names the position |
| Empty pattern | *"Empty pattern — nothing is matched."* | Guard against a blank filter silently hiding everything |
| Pattern or sample too long | *"Pattern exceeds 2000 characters."* / *"Sample exceeds 20000 characters."* | Bounds, checked before compiling |
| More than 500 matches | Results truncated, `truncated: true`, status line says so | Bound; the pattern is still valid |
| Evaluation timeout | *"Evaluation stopped after 300 ms (possible catastrophic backtracking)."* | The between-match budget — a cheap pattern with an enormous match count |
| Applied pattern matches nothing | An empty list | Honest no-match, not an error |
| A broken pattern applied to a list | `matcher()` returns `() => true` and everything is shown | Deliberate: a filter that cannot compile must not hide every row and imply the list is empty |

## Security considerations

- **Everything is evaluated locally**, in the renderer. Patterns and sample text never leave the
  process: no network call, no telemetry, no write to disk. The CSP in `app/index.html` blocks the
  first of those at the platform level (`connect-src 'self'`).
- **Regex denial of service is mitigated in two layers**, and the layers do different jobs. The
  refusal removes the shapes that cannot be timed out; the bounds cap the shapes that can. Neither
  alone is sufficient and neither is a guarantee.
- **The sample cap is load-bearing.** It is the only thing standing between an uncaught
  pathological pattern and a frozen window.
- **Sample text can contain whatever the field filters**, which may include file paths, session
  names or config keys. It is never logged, never committed to the local history and never sent
  anywhere.
- **Applied patterns filter labels only.** No search in Studio inspects file contents, transcript
  bodies or hidden state — a user must be able to predict a filter's result from what is on screen.
- **Unicode is opt-in.** Without `u`, `\p{…}` means something else entirely. The palette labels the
  requirement so a user does not conclude the class is broken.

## Verification

`node tools/test-frontend.mjs` covers the engine directly — the refusal (five adversarial patterns,
each asserted to be refused in under 250 ms and to name its fragment), the four ordinary patterns
that must still be allowed, zero-width termination, invalid patterns, the match cap, the size
bounds, and capture/named groups.

By hand, from a real search field:

1. **Valid pattern:** `^gpt-5` against the model list — matches; the results panel lists index and
   text.
2. **Refusal:** `(a+)+$` — refused immediately, the fragment is quoted, and the message does not
   recommend `{1,20}`.
3. **The trap:** `(a+){1,20}$` — refused just as fast. If this one ever runs, the guard has
   regressed and the window will freeze.
4. **Overlap:** `(a|a)*$` and `(x|xx)+y` — both refused.
5. **False positives:** `(ab){1,3}`, `^(a|b)+$`, `\d+`, `^(mcp|plugin)-` must all still be
   accepted and match.
6. **Invalid pattern:** `(` — the constructor's message appears, nothing crashes, the list keeps
   rendering.
7. **No match:** `zzzz` — an honest empty state, not an error.
8. **Unicode:** `\p{Han}` with `u` matches Cantonese labels; without `u` it reports something
   different and correct. Switch the app to 廣東話 first so there is Han text to match.
9. **Multiline:** `^codex` with `m` over a multi-line sample matches every line.
10. **Zero-width:** `\b` terminates with finite, strictly increasing match indices.
11. **Capture groups:** `(\w+)-(\w+)` shows both groups; `(?<a>\w+)` populates `named`.
12. **Bounds:** a 2001-character pattern and a 20001-character sample are both refused by message.
13. **Plain text vs regex:** typing `.*` in the field with no pattern applied matches those literal
    characters; the same string applied through the builder matches everything. The two modes must
    visibly differ.
14. **Anchoring:** open the builder from each of the nine fields in turn. The popover must appear
    beside *that* field, stay inside the viewport near a window edge, and close on Esc.
15. **Independence:** apply a pattern to the Extend filter, then to the Config filter. Neither may
    change the other's query, flags or mode.
