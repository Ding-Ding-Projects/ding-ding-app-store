---
id: settings-language-and-display-name
title: Settings, language, and display name
titleYue: 設定、語言同顯示名稱
category: experience
status: shipped
summary: Persists language, two independent funny levels, theme, density, accent, and a display-only app name through tabbed searchable settings.
---
# Settings, language, and display name

## Behaviour

Settings is divided into General, Appearance, Schedule, and About browser-style sub-tabs. Each sub-tab owns a search box and adjacent full regex builder and reports match counts on its tab. General persists exactly three language modes—English, playful Hong Kong Cantonese, and bilingual—plus independent English and Cantonese funny levels from 1 to 5. Appearance persists system/light/dark theme, comfortable/compact/spacious density, a six-digit accent color, and a user-selected display name.

Every control has a keyboard-reachable **What this controls** disclosure. It explains the real effect in the active language mode and places a provenance line beside it: a validated `settings.v1.json` value is labelled persisted, while a missing, malformed, or incomplete file is labelled compiled fallback with the exact value (`bilingual`, `2`, `4`, `system`, `comfortable`, `#6750A4`, `Ding Ding App Store`, or `false`). The registry keeps a hand-written completeness list so a new setting cannot silently ship without both pieces of copy.

About includes a searchable in-app changelog for every existing release tag in the baseline, preserving real tag gaps and duplicate target commits. Typed or native-calendar start/end filters compose with text or regex search; selected or filtered entries can be copied or exported with full commit SHAs. Validation rejects missing or shortened SHAs instead of rendering an unverifiable link.

The external-editor card persists Visual Studio Code as the preferred editor and exposes detection plus export-opening controls for catalog, activity, notifications, and changelog records. The renderer sends only a typed record kind, suggested filename, MIME type, and content. Until a reviewed privileged adapter implements installation discovery, controlled temporary-file creation, and launch, the controls report unavailable and normal downloads remain usable; no executable path or command is guessed.

The display name changes the title bar label only. Package identity, user-data directory, installer name, feed, and diagnostic product identity remain fixed. Reset restores the shipped values.

## Configuration

`settings.v1.json` is validated in the main process. Defaults are bilingual, English funny level 2, Cantonese funny level 4, system theme, comfortable density, accent `#6750A4`, `Ding Ding App Store`, and automatic repair consent `false`. The same compiled object is the provenance fallback contract used by the renderer; no opaque “default” label is shown. Language mode changes shared labels where translations exist; this revision still contains some English-only operational copy, so localization is broad but not complete.

## Failure modes

Missing or invalid settings fall back to the full default document and mark every field as compiled fallback. A save rejection raises a non-blocking error and leaves the last accepted state. Display names are trimmed, must contain 1–64 characters, and cannot affect filesystem or network identity. An unsaved edit is explicitly labelled a draft until Save succeeds; it is never misreported as persisted.

## Security considerations

Only enumerated settings, bounded funny levels, a validated color, and a bounded display label are accepted. The renderer never learns the settings file path. The funny level changes voice only; operation facts, affected app, failure, and available action remain exact.

## Verification

Schemas, the shared default object, and the hand-written explanation lists are covered by `tests/settings-provenance.test.ts` plus type/contract checks. Renderer code applies theme, density, accent, display name, and language settings. Runtime verification should still capture all three language modes at narrow width and demonstrate that both funny-level controls change representative copy at every level.

## Suggested articles

- [Command palette](command-palette.md)
- [Appearance editor](appearance-editor.md)
- [Update schedule](../updates/update-schedule.md)
