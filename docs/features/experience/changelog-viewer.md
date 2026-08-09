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

The About tab opens an in-app changelog covering every released version. Each entry keeps its exact version, release date, categorized changes, and full commit SHA. Search is plain-text-first with the adjacent full regex builder, and filtered results support visible-scope selection, copy, Markdown export, an app-owned Open in VS Code action, and direct navigation to the exact commit.

The date filter keeps typed dates visible while adding an advanced calendar surface. Users can type a locale date or ISO date, jump directly to a month and year, move one month at a time, and select a range with two calendar clicks. The first click sets the start; the second sets the end, swapping the endpoints when the second click is earlier. A third click begins a fresh range. Named presets cover all releases, the latest seven days, and the latest thirty days. Search and date filtering compose, and the calendar is keyboard-operable through native buttons and inputs.

Every viewer-owned label, count, date-validation message, bulk action, copy/export outcome, Visual Studio Code state, commit-navigation control, and empty state follows the persisted English, playful Hong Kong Cantonese, or bilingual mode. Release dates and calendar-day accessible names are formatted with the app language rather than the operating-system display language. The exact version and full SHA remain singular factual values in bilingual rows; language changes never rewrite the generated changelog entries.

## Configuration

The viewer uses the app's active English, Hong Kong Cantonese, or bilingual mode for its controls. Its non-decision success and error messages use all five independent English and Cantonese funny levels: each level changes only the framing around the supplied fact, while counts, failure state, recovery route, version, date, and SHA stay unchanged. Date values are interpreted in the user's local timezone; the release timestamp remains the exact recorded source value in the semantic `dateTime` attribute. Clearing dates returns to the newest release month without changing the search query or selected entries.

## Failure modes

Impossible dates, partial input, and reversed typed ranges report a localized inline error while retaining the user's text and producing no results. Invalid calendar months produce no day grid rather than guessing. Known changelog validation predicates are localized while their affected release fact is rendered once; an unknown provider validation fact remains verbatim instead of being guessed. A missing or shortened commit SHA still prevents the list from presenting an unverifiable link. Empty search/date results say what to clear; copy and export remain bounded to the filtered or selected entries.

Clipboard and download exceptions become localized non-blocking failures. Unexpected exceptions expose one bounded operation code, never a caught message that could contain an internal path. Visual Studio Code failures are mapped from the typed bridge reason and always retain Markdown download as the recovery route. Commit navigation uses its typed English/Cantonese result pair; Cantonese-only mode never falls back to an unlocalized English bridge message. Invalid, unavailable, or rejected commit navigation retains copy-link as the recovery route.

## Security considerations

The calendar changes only local renderer filter state. It never submits a path, URL, command, or release metadata to a privileged bridge. Commit navigation sends only a full 40-hex SHA through a sender-validated typed bridge. The main process validates it again, constructs the fixed `https://github.com/Ding-Ding-Projects/ding-ding-app-store/commit/` destination, and invokes Electron's external opener; the renderer cannot choose a host, path prefix, command, or arbitrary URL. Markdown export contains only validated changelog fields and the configured display name. No network request is made by the date picker.

## Verification

`tests/changelog-localization.test.ts` proves five distinct message voices in each language, app-language date formatting, singular bilingual validation facts, typed Visual Studio Code failure mapping, Cantonese commit-result fallback, bounded exception facts, and a hand-written source-copy inventory. `tests/external-navigation.test.ts` drives the privileged service with valid, invalid, unavailable, and throwing opener states; proves the fixed URL and sanitized localized outcomes; checks sender/main/preload wiring; and exercises the renderer's enabled and unavailable paths. `tests/ui-completion.test.ts` continues to validate impossible dates, the bounded 42-cell month grid, two-click range selection in either order, fresh-range reset, and the rendered month input/calendar wiring. Changelog schema validation, regex safety, filtered selection, copy/export, and external-editor fallback remain covered. Docs generation synchronizes this article into the offline bundle, static site, and wiki. This source/test slice does not claim a packaged hidden-desktop interaction or capture.

## Suggested articles

- [Command palette](command-palette.md)
- [External editor exports](external-editor-exports.md)
- [Verification and evidence](../verification/verification.md)
