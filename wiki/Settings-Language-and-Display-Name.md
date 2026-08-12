# Settings, language, and display name

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

Settings is divided into General, Appearance, Schedule, and About browser-style sub-tabs. Each sub-tab owns a search box and adjacent full regex builder and reports match counts on its tab. General persists exactly three language modes—English, playful Hong Kong Cantonese, and bilingual—plus independent English and Cantonese funny levels from 1 to 5. It also persists an optional renderer-only spoken narrator (off by default), its English/Cantonese/both choice, and a reduced-sound switch. Appearance persists system/light/dark theme, comfortable/compact/spacious density, an accent color, and a user-selected display name. The accent field and command-palette appearance controls use the same continuous translator as the appearance editor: HEX/HEX8, RGB/RGBA, HSL/HSLA, HSV/HSB, HWB, Lab/LCH, OKLab/OKLCH, CMYK, bounded named colors, alpha, gamut clipping warnings, copy actions, and keyboard-accessible range controls.

Every control has a keyboard-reachable **What this controls** disclosure. It explains the real effect in the active language mode and places a provenance line beside it: a validated `settings.v1.json` value is labelled persisted, while a missing, malformed, or incomplete file is labelled compiled fallback with the exact value (`bilingual`, `2`, `4`, `true`, `system`, `comfortable`, `#6750A4`, `Ding Ding App Store`, or `false`). The registry keeps a hand-written completeness list so a new setting cannot silently ship without both pieces of copy.

General settings also expose **Show emojis in dialogs and message boxes**. It is persisted and enabled by default. When enabled, a small non-semantic emoji decorates visible title/body copy across destructive dialogs, the command palette, notification centre, appearance editor, regex builder, tab overflow, and group-picker surfaces; when disabled, the same factual text remains without decoration. Emoji never enters button text, field labels, accessible names, exports, history, or the spoken narrator. Every search builder receives the same setting, so a preference change does not silently apply to only one overlay.

General settings also expose a visible **Personal vocabulary** local JSON picker before any file exists. The neutral versioned document is `{ "schemaVersion": 1, "entries": [{ "source": "…", "replacement": "…" }] }`; the main process enforces UTF-8, duplicate-key, unknown-field, unsafe-key, depth, byte, entry, and string bounds before writing a validated cache under application data. The source path and file metadata are discarded. Replace, invalid-file, cache-corruption, and clear states retain or restore the last valid/original wording, and no vocabulary value is included in logs, history, exports, telemetry, or network requests. School mode removes this capability from the visible surface and command palette while preserving the cache for restoration.

About includes a searchable in-app changelog for every existing release tag in the baseline, preserving real tag gaps and duplicate target commits. Typed or native-calendar start/end filters compose with text or regex search; selected or filtered entries can be copied or exported with full commit SHAs. Validation rejects missing or shortened SHAs instead of rendering an unverifiable link.

The external-editor card persists Visual Studio Code as the preferred editor and exposes detection plus export-opening controls for catalog, activity, notifications, and changelog records. The renderer sends only a typed record kind, suggested filename, MIME type, and content. The reviewed main-process adapter validates installation discovery, controlled temporary-file creation, and shell-free launch; a child error or unconfirmed two-second launch reports failure while normal downloads remain usable, and no executable path or command is guessed by the renderer.

The display name changes every app-owned introduction surface: the custom title bar, the ready-to-install update banner, the About version card, and the heading of in-app changelog exports. Package identity, user-data directory, installer name, feed, and diagnostic product identity remain fixed. Reset restores the shipped values. Changelog exports generated outside the renderer retain the shipped name unless a display name is explicitly supplied.

The Schedule sub-tab can optionally resolve scheduled language, funny levels, theme, density, accent, and display name through a versioned HTTPS API or a Home Assistant boolean entity. These source controls are keyboard reachable, localized with the active settings mode, and discoverable through the sub-tab's existing search and adjacent regex builder. A Home Assistant token is not a settings field: the renderer cannot read or save it, and the privileged source service reads it only from the operating-system-protected vault.

## Configuration

The static documentation site carries a bounded local equivalent in Settings → General. Its checkbox is stored only in this browser, fails closed to enabled when browser storage is unavailable, and decorates the command-palette dialog title with an `aria-hidden` emoji span. The site-only Restricted presentation switch suppresses that decoration and hides the checkbox; this is an explicit site boundary, not the desktop app's shared School-mode record. The site does not claim parity for other desktop dialogs without a packaged browser capture.

`settings.v1.json` is validated in the main process. Defaults are bilingual, English funny level 2, Cantonese funny level 4, narrator disabled with English-then-Cantonese selected for a later opt-in, reduced sound disabled, dialog emojis enabled, system theme, comfortable density, accent `#6750A4`, `Ding Ding App Store`, and automatic repair consent `false`. The same compiled object is the provenance fallback contract used by the renderer; no opaque “default” label is shown. Language mode changes shared labels where translations exist; this revision still contains some English-only operational copy, so localization is broad but not complete.

## Failure modes

Missing or invalid settings fall back to the full default document and mark every field as compiled fallback. A save rejection raises a non-blocking error and leaves the last accepted state. Display names are trimmed, must contain 1–64 characters, and cannot affect filesystem or network identity. An unsaved edit is explicitly labelled a draft until Save succeeds; it is never misreported as persisted.

## Security considerations

Only enumerated settings, bounded funny levels, narrator choices, a validated HEX/HEX8 color, and a bounded display label are accepted. Unsupported color-space input remains visible and fails closed; alpha is preserved through the canonical HEX/HEX8 value. The renderer never learns the settings or vocabulary file path. Personal vocabulary is parsed and cached locally only after complete validation; duplicate keys and unsafe object keys fail closed, and the last valid cache remains active when replacement fails. The funny level changes voice only; operation facts, affected app, failure, and available action remain exact. The narrator has no network or privileged audio API and produces speech only from already-visible notifications.

## Verification

Schemas, the shared default object, the continuous color translator, the hand-written explanation lists, the local vocabulary parser, and the emoji-on/off copy boundary across every dialog surface are covered by `tests/settings-provenance.test.ts`, `tests/personal-vocabulary.test.ts`, `tests/dialog-emoji.test.ts`, `tests/color-translator.test.ts`, `tests/ui-completion.test.ts`, plus type/contract checks. Renderer code applies theme, density, accent, display name, language settings, dialog decoration, personal vocabulary status, and the optional narrator queue. Runtime verification should still capture all three language modes at narrow width and demonstrate that both funny-level controls change representative copy at every level.

## Suggested articles

- [Command palette](Command-Palette)
- [Appearance editor](Appearance-Editor)
- [Update schedule](Update-Schedule)
- [Optional spoken narrator](Optional-Spoken-Narrator)
