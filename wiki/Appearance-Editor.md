# Appearance editor

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

`Ctrl+Shift+E`, Settings, or the command palette enters edit mode. A pointer click, Enter/Space, or keyboard focus selects the nearest registered element without running its normal action. A docked panel shows the selected hierarchy and edits supported background, foreground, radius, border width, elevation, font scale, font weight, and padding scale tokens live. Overrides layer above theme, density, and accent.

The shell, title bar, rail, tab/group rows, content, headings, search, regex builder, cards, status, buttons, chips, banner, notifications, empty states, activity, docs, settings, schedule, dialog, palette, and snackbar are registered. Destructive confirmation controls, emergency exit, and window controls are deliberately not editable or hideable.

Each editable token has a keyboard-reachable **What this controls** disclosure. The explanation names the actual effect and its bounded validation. The same disclosure reports either a persisted appearance override or the exact compiled fallback (for example `system-ui`, `100%`, `140%`, `md`, `none`, or the inherited Material surface/text colour); an unset override is never described as a mysterious “default”.

## Configuration

The panel has its own search and regex builder plus Colour, Shape, Type, and Layout sub-tabs. Reset one element, reset all, ten-second reset undo, JSON export, and all-or-nothing import are available. `appearance.v1.json` stores only non-empty overrides. Colour editing now includes a continuous native field with hue, saturation, lightness, alpha, HEX/HEX8, RGB/A, and HSL/A entry, an accessible contrast readout, and an explicit note for unsupported HSV/HSB, HWB, Lab/LCH, OKLab/OKLCH, and CMYK spaces. Type editing includes searchable installed/bundled family choices, size, weight, style, underline/strike, letter spacing, and line height. More advanced Word properties (variation axes, underline colour, overline, capitalization, text effects, alignment, and pseudo-state editing) remain visible as future capability rather than silently discarded, so status is limited.

## Failure modes

Unreadable data falls back to no overrides and is quarantined once. Imports above 64 KB, malformed JSON, unknown elements/tokens, invalid values, prototype keys, and unsafe CSS fragments are rejected with bounded sanitized messages. Off-screen selection remains editable and is named as off screen. Contrast advice is advisory and can apply a safe fix.

## Security considerations

The renderer uses closed custom-property names and CSSOM `setProperty`; it never injects a stylesheet, selector rule, or HTML. Typography values are copied only into closed per-element custom properties and the bundled stylesheet consumes those properties. Main-process schemas enforce element/token ownership and reject delimiter, URL, import, expression, comment, tag, and newline syntax. Appearance cannot alter display, position, visibility, commands, IPC, or confirmation behavior.

## Verification

Tests cover the hand-written token explanation list, registry completeness, export/import round-trip, HEX8 and typography validation, unknown/prototype payloads, CSS injection fuzzing, CSSOM-only application, CSS readers for new typography tokens, and command-palette reachability. Type check and build are run on this branch; packaged capture of edit mode, keyboard selection, and panel collision behavior remains pending.

## Suggested articles

- [Settings, language, and display name](Settings-Language-and-Display-Name)
- [Tab workspace](Tab-Navigation)
- [Privacy and security](Privacy-and-Security)
