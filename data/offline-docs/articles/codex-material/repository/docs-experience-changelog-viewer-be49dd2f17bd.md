# Changelog viewer

The in-app changelog viewer shows every released version of Codex Studio, filtered by
date and by text at the same time, and exports exactly what the user is looking at.

Its engine is `app/cx-changelog.js`, exporting `window.CX_CHANGELOG`. The engine is pure
logic — no DOM, no `fetch`, no `localStorage` — so the surface that renders it owns all
presentation and the engine can be tested on its own. The changelog content itself lives
in `CHANGELOG.md` at the repository root, in [Keep a Changelog](https://keepachangelog.com/)
format, and is read through the existing `codex_read_text` IPC command like any other
bundled text file. Nothing is fetched over the network.

> **Status.** The engine, its parser, its filters and its exporter are implemented and
> verified (see [Verification](#verification)). The rendered viewer surface is owned by
> the app shell; this document describes the contract it consumes and the behaviour it
> must preserve.

---

## What the viewer shows

Every version, not only the newest. Release notes on a website do not satisfy this — the
history ships inside the app.

For each version the viewer shows:

| Field | Source | Notes |
| --- | --- | --- |
| `version` | the `## [x.y.z]` heading | `[Unreleased]` is recognised and flagged |
| `date` | the ` - yyyy-mm-dd` after the heading | kept **verbatim** even when unparseable |
| `time` | parsed from `date` | `null` when the date is not `yyyy-mm-dd` |
| `yanked` | a `[YANKED]` marker in the heading | rendered as a withdrawal, not hidden |
| `summary` | prose between the heading and the first `###` | optional |
| `sections` | each `###` heading and its bullets | `{ title, entries: [string] }` |
| `link` | a `[x.y.z]: url` reference definition | `null` when absent |

A bullet that wraps across lines, or carries nested bullets, is kept as one entry with
its continuation lines joined by newlines — so an entry is never truncated at the wrap.

**A version with no recorded changes says so.** It is parsed with an empty `sections`
array and rendered with an explicit "No changes are recorded for this version" line. It
is never quietly dropped from the list, and no filler entry is invented to occupy it.

### When the file is malformed

`parse()` never throws. It returns everything it could read, plus a `warnings` array on
the returned list, and the viewer shows those warnings rather than pretending the file
was clean. Each warning names the line number and what was wrong:

- a heading with no version number;
- a date that is not `yyyy-mm-dd` — shown as written, and excluded from date filtering
  because it cannot be placed on a calendar;
- a version declared twice — both are shown, because deciding which is correct is a
  human's job;
- bullets sitting outside any `###` section — grouped as uncategorised;
- a `###` section before any version heading — skipped;
- no `## [version]` heading anywhere — the file is not Keep a Changelog format;
- an empty file, or content that could not be read as text at all.

A parse that fails part-way keeps every version it had already read and appends one
warning explaining where it stopped.

---

## Date filter

### Calendar picker and presets

`CX_CHANGELOG.PRESETS` supplies the named ranges. Each has an `id`, a bilingual `label`
and a `range(now)` function returning `{ from, to }` as `Date` objects (or `null` for an
open bound):

| id | Range |
| --- | --- |
| `all` | no date filter at all |
| `7d` | today and the previous 6 days |
| `30d` | today and the previous 29 days |
| `90d` | today and the previous 89 days |
| `month` | the 1st of the current month to the end of today |
| `year` | 1 January of the current year to the end of today |
| `lastYear` | 1 January to 31 December of the previous year |

Bounds are snapped to local midnight and local end-of-day, so a release dated
`2026-07-30` falls inside a range whose bounds were picked from the same calendar the
user was looking at. The picker itself must also support month/year jump and free range
selection; the presets are shortcuts, not the whole control.

### Typed dates

`parseDate(text, locale)` accepts a typed date beside the calendar:

- an ISO date — `2026-07-30`, and also `2026/07/30` or `2026-7-3`; a four-digit leading
  group is always read as the year, whatever the separator;
- the locale forms `d/m/yyyy` and `m/d/yyyy`, with `/`, `.` or `-` as the separator.
  `m/d/yyyy` is used only for a US locale; Hong Kong and most of the world get `d/m/yyyy`.

It returns `{ ok, date, error, text, order, shape, partial, empty, iso }`.

**Partial or invalid input is reported inline and never discards what was typed.** The
`text` field returns the input exactly as given so the field can keep showing it while
the error sits beside it, and `partial: true` marks input that is on its way to being
valid rather than wrong:

| Typed | Result |
| --- | --- |
| `2026` | partial — "That is a year, not a date yet. Add a month and a day, e.g. `2026-01-31`." |
| `2026-07` | partial — "the day is still missing, e.g. `2026-07-01`" |
| `30/07` | partial — "The year is still missing — type it as `d/m/yyyy`" |
| `30/07/26` | partial — a two-digit year is ambiguous; type `2026` in full |
| `2026-02-30` | error — "There is no day 30 in `2026-02`; that month has 28 days" |
| `2026-13-01` | error — "There is no month 13; months run 1 to 12" |
| `13/5/2026` in a US locale | error — names the ambiguity: this field reads `m/d/yyyy`, the other order gives `2026-05-13`, type `2026-05-13` to be unambiguous |
| `1.2.3` | error — a version string is not a date |
| `banana` | error — names both accepted forms |
| empty | `ok: false`, `empty: true`, **`error: null`** — a blank field is not a mistake to shout about |

Leap years are real: `29/02/2024` parses, `29/02/2025` does not and says February 2025
has 28 days.

### Versions the range cannot place

An `[Unreleased]` section is dated *now* — it describes the state of the tree today — so
it passes any range that reaches the present. A version whose date could not be parsed
cannot be placed on a calendar at all; when a range is active it is excluded and counted
in `undated`, and the viewer reports that count rather than making the versions vanish
without explanation.

---

## Search and the regex builder

`filter(releases, range, query)` takes `query` as `{ text, regex: { pattern, flags } | null }`.

**Plain text is the default and regex is an explicit opt-in**, exactly as for every other
search bar in the app. The search bar carries the anchored full regex builder described
in [the regex builder documentation](app-doc://article/codex-material.repository.7ced8600c459bff3), and query, pattern,
flags, validation and mode synchronize bidirectionally with it.

Both modes leave through the **same predicate**, so a flag toggled in the builder cannot
drift away from what actually runs. `g` and `y` are stripped from the flags before
matching: a global or sticky regex carries `lastIndex` between calls, which would make
the same entry match or not depending on which entry was tested before it.

A query is matched against the version, the date, the summary, each section title and
each entry. Matching the version or the date keeps that version's entries whole — someone
searching `0.1.0` wants the version, not a subset of it. Matching a section title keeps
that section whole. Otherwise only the matching entries survive, and a section left with
no entries is dropped.

### The date filter and the search compose

They narrow, they never override. The range decides which versions are in play; the
search then narrows the entries inside them. `filter` returns `ranged: true` whenever a
date bound was actually applied, so the viewer can say which filters produced the view.

### Bounds on regex evaluation

Regex evaluation reuses `CX.evaluate` and `CX.LIMITS` from `app/codex-core.js` when they
are available, and falls back to an equivalent local path when they are not:

- **pattern length** capped at `CX.LIMITS.pattern` (2000 characters);
- **sample length** capped at `CX.LIMITS.sample` (20 000 characters) per entry;
- **wall time** capped at `CX.LIMITS.ms` (300 ms) for *the whole scan* — one shared
  deadline, not one budget per entry, so a slow pattern costs 300 ms across the changelog
  rather than 300 ms multiplied by the number of entries.

> [!IMPORTANT]
> **A time budget alone cannot save a synchronous engine.** A budget can only be checked
> *between* calls, and one `exec` of `(a+)+$` against sixty ordinary characters never
> returns to be checked at all — it would freeze the window with the budget still
> unspent. This was reproduced against the real engine before the guard was written.
>
> So the shapes that blow up exponentially are **refused before they run**: a group
> followed by an unbounded quantifier (`*`, `+`, `{n,}`) whose body contains another
> unbounded quantifier, or an alternation whose branches overlap. `(a+)+`, `(a*)*b`,
> `([a-z]+)*x`, `(\s+)+$`, `(a|a)+$`, `(a|ab)*c`, `(.*)*z` and `(?:x+)+y` are all
> refused in under a millisecond.
>
> The refusal names the construct it found and gives three concrete ways forward: bound
> the outer repeat (`{1,20}`), rewrite it without the nesting, or search plain text. It
> is deliberately narrow — `(foo|bar)+`, `(a+){1,10}`, `a+b+c+`, `\d{4}-\d{2}-\d{2}`,
> `(?=sand)\w+` and `(?<name>a)+` all run normally, because refusing a legitimate
> pattern is its own kind of failure.

An invalid, over-long or refused pattern does **not** silently empty the list. The
date-filtered view is kept, `mode` is set to `invalid`, and `error` explains what
happened — so the user sees their data plus the reason the text filter did not apply,
rather than an unexplained blank screen. A scan that hits the shared deadline sets
`timedOut` and shows what matched before it stopped, saying so.

---

## Export and copy

`exportView(releases, range, query, format)` runs the same filter and serialises the
result. `format` is `"markdown"` or `"text"`; both return a string the viewer can write
to a file or put on the clipboard.

**The export always states the range it covers**, so an exported file can never be
mistaken for the whole changelog. The header carries:

- the date range — either `2026-01-01 → 2026-12-31`, `2026-01-01 onwards`, `up to
  2026-12-31`, or "all time (no date filter)" — with the preset's name appended when the
  range came from one (pass its `id` on the range object);
- the search — plain text with the literal typed, `regex /pattern/flags`, or "none";
- the counts, in entries and versions;
- the number of versions excluded for having no usable date, when there are any;
- any filter error, verbatim;
- the export timestamp as an ISO-8601 stamp with timezone offset.

An empty result exports the header plus an explicit "Nothing matched this range and this
search, so no entries were exported" — never an empty file that looks like a bug.

Markdown export round-trips: exporting `CHANGELOG.md` unfiltered and re-parsing the
result returns the same versions and the same 22 entries with zero warnings.

---

## Language modes and the funny sliders

Every string the viewer's engine produces — parse warnings, date errors, regex refusals,
export headers, preset labels, the empty state — goes through the app's three language
modes (English, playful Hong Kong Cantonese, bilingual) and both funny-level sliders,
reading `CX.i18n.mode` and `CX.i18n.funny` from `app/codex-core.js`. When `CX` is not
loaded the engine falls back to English at level 3 rather than failing.

Each message carries variants per language; the active level selects one, monotonically,
so level 1 is fully professional and level 5 is maximum playfulness. The two sliders are
independent — English at 1 and Cantonese at 5 renders a straight English sentence beside
a playful Cantonese one in bilingual mode.

**The level moves the voice. It never moves a fact.** Placeholders are substituted
*after* the level is chosen, so version numbers, dates, entry counts, line numbers, the
offending pattern, the character limits and the millisecond budget are byte-identical at
level 1 and level 5. Every message, at every level, still names what happened, what is
affected and what the reader can do about it. This holds for the error and refusal copy
too — there is no exempt category. A warning nobody can act on is a broken warning, not
a funny one.

Cantonese copy is natural written Hong Kong Cantonese (唔係書面語), and it is never at the
user's expense.


The same refusal at English level 1 and level 5

**Level 1** — "This pattern repeats a repetition (`(a+)+$`), which can take exponential
time on an ordinary line and would freeze the window before any budget could stop it.
Put a bound on the outer repeat (for example `{1,20}`), rewrite it without the nesting,
or search plain text."

**Level 5** — "This pattern repeats a repetition (`(a+)+$`) — the classic way to make a
regex engine think until the heat death of the window. Bound the outer repeat (for
example `{1,20}`), drop the nesting, or search plain text."

The construct, the suggested bound and all three options are identical. Only the voice
moved.



---

## Content is never invented

`CHANGELOG.md` records what is actually in this repository and its git history. No
version, date, entry or fix is written to make a release look busier than it was, and a
version with nothing recorded says so rather than borrowing an entry from elsewhere.

The engine holds the same line. It never synthesises a version, a date or an entry: an
unparseable date is shown exactly as the author typed it rather than being guessed at, a
version that cannot be placed on a calendar is reported as excluded rather than silently
assigned one, and an empty result says it is empty.

---

## Failure modes

| Situation | Behaviour |
| --- | --- |
| `CHANGELOG.md` missing or empty | one warning, empty list, no throw |
| Not Keep a Changelog format | one warning naming the missing `## [version]` headings |
| Malformed section, date or heading | partial parse plus a line-numbered warning |
| Input that cannot be converted to text | one warning, empty list, no throw |
| Invalid regex | date-filtered view kept, `mode: "invalid"`, error explains |
| Over-long pattern | refused with the actual length and the limit |
| Catastrophic pattern | refused before it runs, naming the construct and three fixes |
| Slow scan | stops at the shared deadline, shows partial matches, says so |
| Empty search result | explicit empty state, honest export |
| `window.CX` not loaded | English at funny level 3, local regex path, still works |

---

## Security considerations

- **No network.** The changelog is a bundled local file read through the existing IPC
  command surface. The engine performs no `fetch` and holds no remote reference.
- **No persistence.** The engine writes nothing — no `localStorage`, no cookies, no
  telemetry. Patterns and typed dates are never transmitted or stored; they live only in
  the caller's component state.
- **Regex denial of service** is addressed on three axes — pattern length, sample length,
  and a shared wall-clock deadline — plus the structural refusal of exponential shapes
  described above, because on a single-threaded WebView a hung `exec` is an unrecoverable
  hang of the whole window.
- **Zero-width matches** are handled by `CX.evaluate`, which advances `lastIndex` past an
  empty match instead of looping on it forever.
- **No `eval`, no dynamic code.** Patterns reach `new RegExp` only, never a code path
  that could execute them as script.
- The engine is pure and side-effect free, so a malformed or hostile changelog file can
  cost at most one bounded parse.

---

## Verification

Exercised against the real `CHANGELOG.md` and against synthetic inputs, using the same
bounded-evaluation contract `app/codex-core.js` provides:

- **Parser** — the real file parses to 1 version, 3 sections, 22 entries, 0 warnings.
  Ten malformed inputs (bad date, no headings, empty, `null`, `undefined`, duplicate
  version, orphan section, `[YANKED]` with a link definition, `[Unreleased]` beside a
  prerelease version with wrapped and nested bullets, and an object whose `toString`
  throws) all return a partial result plus warnings, and none throws.
- **Typed dates** — 20 inputs across ISO, both locale orders, partials, ambiguities,
  impossible days and months, leap years, empty and non-dates; every message names the
  problem and preserves the typed text.
- **Presets** — all seven verified against a fixed clock in local time, including the
  previous-calendar-year bounds.
- **Composition** — range alone, search alone, and both together verified to narrow
  rather than override; version-heading matches keep the version whole; input releases
  are proven unmutated after filtering.
- **Regex safety** — 18 patterns classified: 8 catastrophic shapes refused in ≤1 ms,
  10 legitimate patterns allowed and matching correctly. The pre-guard version of this
  same test hung the process, which is what prompted the structural guard.
- **Export** — Markdown and plain text, with and without filters, with an empty result,
  and with undated versions present; markdown export re-parses to the identical 22
  entries with zero warnings.
- **Languages** — all three modes and all five funny levels per language render, with
  facts identical across levels; the no-`CX` fallback path verified.
