---
layout: doc
title: "Notification history"
---

# Notification history

AC Defender keeps a reviewable history of defender activity notifications. The live dashboard still
shows the recent event tail, but the notification centre API retains notices after that tail rolls off,
so dismissing a snackbar does not erase the evidence.

The signed-in website exposes the same journal at `/notifications`; the page is searchable, level-filterable,
date-filterable, and includes dismissed records on demand. The Windows Electron controller reads the same
authenticated API.

## Behaviour

- Every event emitted by `DefenderStateStore` is recorded as an `info`, `success`, `warning`, or `error`
  notification (duplicate events suppressed by the defender are not recorded twice).
- Records are appended as JSON Lines beside the configured state file (`notification-history.jsonl`),
  on the same persisted Docker volume.
- `GET /api/notifications` returns active records newest-first, an unread count, and an active count.
  Use `includeDismissed=true` to review dismissed records or `level=warning` to narrow the centre. Optional
  `from` and `to` query parameters accept ISO-8601 timestamps or `YYYY-MM-DD` dates (`to` is inclusive for
  a date-only value), while comma-separated `actions` filters by the real journal actions.
- `POST /api/notifications/{id}/read`, `/dismiss`, and `/restore` append review actions to the journal;
  a restart reconstructs the same read and dismissed state. Each returned record carries its action history
  (`created`, `read`, `dismissed`, and `restored`), and the snapshot exposes counts derived from those entries.
- `/notifications` is a non-blocking review surface: mark-read, dismiss, and restore actions use toasts,
  while the anchored regex builder keeps plain-text search as the default. Start/end fields accept complete
  ISO dates with inline validation, presets cover today/7-day/30-day windows, and action checkboxes show
  counts from the stored journal rather than a guessed status list.
- Journal or disk failures never block a real Home Assistant command or a background poll. The event
  remains visible in the live snapshot and the failure is logged for recovery.

## Local exports

The notification centre can export the current filtered view with **Export JSON** or **Export Markdown**.
The browser creates the download locally from the already-filtered records; no export request, message,
credential, Home Assistant token, or thermostat state is sent to a server. Both formats are UTF-8 and carry
the schema identifier `ac-defender.notification-history.v1`, the UTC export time, the active search query,
plain/regex mode and flags, level filter, dismissed-record choice, date range, action selection, and exported
count. JSON keeps the complete record and action-history fields for machine processing. Markdown renders a
reviewable table, escapes pipes and line breaks, and writes an explicit no-match message for an empty filtered
view.

If browser download or serialization fails, the page keeps the notification centre open and shows a persistent
error toast; the journal and real defender command pipeline are unchanged. Treat exported files as local
user data: notification messages may contain operational details, so store or share them only with the same
care as the app's state directory.

## Configuration and security

The journal path follows `Defender:StateFilePath`; no new secret, token, thermostat state, or Home
Assistant credential is written. Messages are capped at 4,000 characters and levels are normalized to
the four supported values. The API remains inside the authenticated `/api` route group.

## Verification

`HomeAssistantAcDefender.Tests` runs `NotificationHistoryStoreTests.JournalSurvivesRestartAndReviewActions`,
`NotificationHistoryStoreTests.DateAndActionFiltersUseJournalHistory`, and
`NotificationExportServiceTests.JsonAndMarkdownExportsPreserveFiltersAndUtf8`. The checks prove UTF-8
Cantonese text, schema/search/date/action metadata, Markdown escaping, action-history replay, inclusive date
boundaries, and an explicit empty-result state; a static contract check also proves both buttons, date presets,
journal-action filters, and the local download bridge are wired into `/notifications`.
The journal test appends, reads, dismisses, restores, restarts, and replays a malformed final line; it proves
the valid prefix survives without inventing thermostat state. Browser verification uses the real signed-in
`/notifications` page and captures the two export controls in the built app.

## Suggested articles

- Website Tour — inspect the live activity and thermostat-change tails on Logs.
- Settings repository — local Git-backed snapshots for editable settings.
- API — authenticated JSON endpoints and the status stream.
- Windows Electron controller — the companion Windows review surface.

## Failure modes

If **Notification history** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
