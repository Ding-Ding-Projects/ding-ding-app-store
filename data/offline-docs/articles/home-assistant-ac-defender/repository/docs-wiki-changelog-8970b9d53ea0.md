---
layout: doc
title: "Changelog viewer"
---

# Changelog viewer

The signed-in **Release changelog** page (`/changelog`) is the in-app record of every
non-draft release published for AC Defender. It is bundled offline so a disconnected site
can still explain what shipped.

## What it shows

Each entry contains the version tag, release date, dim-sum code name, category, completing
commit subject, and the full 40-character commit SHA. The short SHA opens the exact commit
in the HomeAssistantAcDefender repository. The committed catalog is regenerated from the
current published non-draft release API before a release build, so the viewer stays current
without reaching the network at runtime.

At this 2026-08-04 regeneration checkpoint, 220 unique published tags were visible. Releases
published after the query are intentionally outside this immutable snapshot and are included
by the next catalog regeneration.

Some historical releases reuse a dim-sum code name or completing SHA because that is what
their published metadata says. Those entries are marked as legacy metadata in the viewer and
Markdown export; the app preserves the exact tag, date, name, and SHA instead of silently
rewriting history.

## Search, dates, and regex

The search is plain-text-first and matches version, code name, category, summary, and full
SHA. **Regex builder** is an explicit opt-in beside the field. It supports a raw .NET regex,
ignore-case (`i`), multiline (`m`), and dot-all (`s`) flags, validates patterns inline, and
uses a 100 ms evaluation timeout. The date filter uses an anchored Material calendar popover
beside the ISO text inputs. Typed `YYYY-MM-DD` values stay visible while incomplete or invalid
input is reported inline. The calendar supports previous/next month navigation, a
keyboard-reachable two-click range selection, and **Today**, **7 days**, and **30 days**
inclusive presets. **All dates** clears the range. Date filtering composes with search and
remains part of every Markdown export.

## Export and failure handling

The **Export & traceability** tab downloads or copies the currently filtered entries as
UTF-8 Markdown, including the active filters and full commit links. Invalid dates and regex
patterns keep the user's input visible and produce an inline error; no-match results say
which combined filter produced the empty view. Clipboard permission failures do not block
the Markdown download.

The catalog is static and contains no access token, Home Assistant state, or thermostat
command. If a release API refresh is unavailable, the last committed catalog remains usable;
the build should fail rather than emit a release entry without a real commit SHA.

The calendar is presentation-only: it never sends a thermostat command or changes the
published release facts. Its pure ISO parsing, inclusive presets, range ordering, and stable
six-week grid are covered by `ChangelogDateRangeTests`.

## Verification

1. Open **Command palette → Release changelog**.
2. Open the calendar beside the date fields, move between months, choose a start and end,
   then confirm the count composes that range with the search.
3. Type a partial (`2026-08`) and invalid (`2026-02-30`) date and confirm the value remains
   visible with an inline error. Try **Today**, **7 days**, and **30 days**.
4. Open Regex builder, enter `^v0\.1\.(8[0-9])$`, enable `i`, and confirm only matching
   versions remain. Enter `[` to verify inline validation and an honest empty state.
5. Open a commit link, download Markdown, and confirm the exported full SHA and active date
   range match the visible entry.
6. Repeat at a 390 px viewport and with bilingual mode; no horizontal overflow is allowed and
   the anchored popover remains within the viewport.

Suggested next steps: Release operations, Settings,
and Website Tour.

## Failure modes

If **Changelog viewer** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Suggested articles

- Feature briefs — find every documented surface and guard.
- Defender Logic — follow the complete decision cycle and its bypass rules.
- Settings — inspect persisted configuration, language modes, and safety limits.
