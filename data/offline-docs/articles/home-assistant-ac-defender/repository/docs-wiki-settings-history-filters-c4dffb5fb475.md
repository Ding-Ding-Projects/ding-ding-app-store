---
layout: doc
title: "Settings history filters and exports"
---

# Settings history filters and exports

The **Settings repository** page at `/settings/repository` keeps local Git-backed settings snapshots
reviewable without changing the append-only journal. Its history controls filter commits already
present in `settings-repo`; they never rewrite, delete, or upload that repository.

## Behaviour

- Each history row is classified from Git's actual parent metadata and commit message as `created`,
  `updated`, `restored`, or `undone`. The first parentless snapshot is `created`; ordinary later
  snapshots are `updated`; restore and revert messages remain explicit.
- Action checkboxes and counts are derived from the currently date-bounded history, not a hard-coded
  list. Selecting more than one action keeps a commit when it matches any selected action.
- Start and end fields accept a complete `YYYY-MM-DD` ISO date and the current culture's complete
  short date format. The end date is inclusive; invalid or reversed input is reported inline and
  returns an honest empty result rather than widening the range.
- Named presets cover Today, Last 7 days, Last 30 days, Last 90 days, and This month. Typing a date
  clears the preset so the two controls never silently disagree.
- Plain-text search remains the default. The adjacent regex builder keeps pattern, mode, and flags
  synchronized with the same commit set, including the derived action label in its searchable text.
  Date range, action selection, and search compose instead of replacing one another.

## Local exports

**Export JSON** and **Export Markdown** download only the currently filtered rows through the existing
local browser bridge. JSON uses the UTF-8 schema `ac-defender.settings-history.v1` and keeps full commit
hashes, timestamps, derived actions, messages, and every active filter. Markdown is a reviewable table,
escapes pipes and line breaks, and writes an explicit no-match sentence for an empty result.

## Failure modes and security

History reads are bounded to the local `settings.json` Git journal. A malformed timestamp is excluded
only when a date filter is active; an invalid regex or date range yields no rows and leaves the journal
untouched. Browser download or serialization failures stay in a persistent error toast. Export files
can contain settings-change reasons and operational details, so treat them like local state. No Home
Assistant token, account credential, runtime telemetry, or defender command is added to the export.

## Verification

`SettingsRepositoryHistoryFilterTests` covers parent-derived action classification, action counts,
inclusive UTC date bounds, named presets, plain-text and regex composition, invalid input, and UTF-8
JSON/Markdown metadata. `dotnet build` and the console regression suite run these checks against the
real page's committed source. Browser verification should open **Settings repository**, type a date,
choose an action, open the regex builder, and use each export button; the page remains usable at mobile
width because the existing filter row wraps.

## Suggested articles

- Settings — edit the values whose snapshots appear here.
- Appearance editor — customize the settings surface without changing defender state.
- Notification history — review and export append-only event notices.
- Command palette — jump directly to the repository page and its controls.

## Failure modes

If **Settings history filters and exports** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
