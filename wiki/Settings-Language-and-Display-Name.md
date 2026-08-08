# Settings, language, and display name

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

Settings is divided into General, Appearance, Schedule, and About browser-style sub-tabs. Each sub-tab owns a search box and adjacent full regex builder and reports match counts on its tab. General persists exactly three language modes—English, playful Hong Kong Cantonese, and bilingual—plus independent English and Cantonese funny levels from 1 to 5. Appearance persists system/light/dark theme, comfortable/compact/spacious density, a six-digit accent color, and a user-selected display name.

The display name changes the title bar label only. Package identity, user-data directory, installer name, feed, and diagnostic product identity remain fixed. Reset restores the shipped values.

## Configuration

`settings.v1.json` is validated in the main process. Defaults are bilingual, English funny level 2, Cantonese funny level 4, system theme, comfortable density, accent `#6750A4`, and `Ding Ding App Store`. Language mode changes shared labels where translations exist; this revision still contains some English-only operational copy, so localization is broad but not complete.

## Failure modes

Missing or invalid settings fall back to the full default document. A save rejection raises a non-blocking error and leaves the last accepted state. Display names are trimmed, must contain 1–64 characters, and cannot affect filesystem or network identity. The current UI does not show a per-control default-provenance line or full progressive explanation for every field.

## Security considerations

Only enumerated settings, bounded funny levels, a validated color, and a bounded display label are accepted. The renderer never learns the settings file path. The funny level changes voice only; operation facts, affected app, failure, and available action remain exact.

## Verification

Schemas and defaults are covered by type/contract checks, and renderer code applies theme, density, accent, display name, and language settings. Runtime verification should still capture all three language modes at narrow width and demonstrate that both funny-level controls change representative copy at every level.

## Suggested articles

- [Command palette](Command-Palette)
- [Appearance editor](Appearance-Editor)
- [Update schedule](Update-Schedule)
