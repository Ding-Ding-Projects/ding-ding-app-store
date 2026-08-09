---
id: changelog-viewer
title: Changelog viewer
titleYue: 更新記錄瀏覽器
category: experience
status: shipped
summary: Browses every released version with searchable commit links, typed date filters, an anchored month-jump range calendar, presets, and filtered copy/export actions.
---
# Changelog viewer

## Behaviour

The About tab opens an in-app changelog covering every released version. Each entry keeps its exact version, release date, categorized changes, and full commit SHA. Search is plain-text-first with the adjacent full regex builder, and filtered results support visible-scope selection, copy, Markdown export, and an app-owned Open in VS Code action.

The date filter keeps typed dates visible while adding an advanced calendar surface. Users can type a locale date or ISO date, jump directly to a month and year, move one month at a time, and select a range with two calendar clicks. The first click sets the start; the second sets the end, swapping the endpoints when the second click is earlier. A third click begins a fresh range. Named presets cover all releases, the latest seven days, and the latest thirty days. Search and date filtering compose, and the calendar is keyboard-operable through native buttons and inputs.

## Configuration

The viewer uses the app's active English, Hong Kong Cantonese, or bilingual mode for its controls. Date values are interpreted in the user's local timezone; the release timestamp remains the exact recorded source value. Clearing dates returns to the newest release month without changing the search query or selected entries.

## Failure modes

Impossible dates, partial input, and reversed typed ranges report an inline error while retaining the user's text and producing no results. Invalid calendar months produce no day grid rather than guessing. A missing or shortened commit SHA fails changelog validation and prevents the list from presenting an unverifiable link. Empty search/date results say what to clear; copy and export remain bounded to the filtered or selected entries.

## Security considerations

The calendar changes only local renderer filter state. It never submits a path, URL, command, or release metadata to a privileged bridge. Commit navigation uses the fixed external-navigation adapter, while Markdown export contains only validated changelog fields and the configured display name. No network request is made by the date picker.

## Verification

`tests/ui-completion.test.ts` validates impossible dates, a bounded 42-cell month grid, two-click range selection in either order, fresh-range reset, and the rendered month input/calendar wiring. Changelog schema validation, regex safety, filtered selection, copy/export, and external-editor fallback remain covered by the same suite. Docs generation synchronizes this article into the offline bundle, static site, and wiki. This change proves the calendar/filter state machine and local build; it does not claim a packaged hidden-desktop drive.

## Suggested articles

- [Command palette](command-palette.md)
- [External editor exports](external-editor-exports.md)
- [Verification and evidence](../verification/verification.md)
