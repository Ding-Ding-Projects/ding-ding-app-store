---
id: appearance-editor
title: Appearance editor
titleYue: 外觀編輯器
category: experience
status: limited
summary: Registers shell elements for validated live CSS-variable overrides with continuous HEX/RGB/HSL colour controls, typography controls, reset, import, and export.
---
# Appearance editor

## Behaviour

`Ctrl+Shift+E`, Settings, or the command palette enters edit mode. A pointer click, Enter/Space, or keyboard focus selects the nearest registered element without running its normal action. A docked panel shows the selected hierarchy and edits supported background, foreground, radius, border width, elevation, font scale, font weight, and padding scale tokens live. Overrides layer above theme, density, and accent.

The shell, title bar, rail, tab/group rows, content, headings, search, regex builder, cards, status, buttons, chips, banner, notifications, empty states, activity, docs, settings, schedule, dialog, palette, and snackbar are registered. Destructive confirmation controls, emergency exit, and window controls are deliberately not editable or hideable.

## Configuration

The panel has its own search and regex builder plus Colour, Shape, Type, and Layout sub-tabs. Reset one element, reset all, ten-second reset undo, JSON export, and all-or-nothing import are available. `appearance.v1.json` stores only non-empty overrides. Colour editing now includes a continuous native field with hue, saturation, lightness, alpha, HEX/HEX8, RGB/A, and HSL/A entry, an accessible contrast readout, and an explicit note for unsupported HSV/HSB, HWB, Lab/LCH, OKLab/OKLCH, and CMYK spaces. Type editing includes searchable installed/bundled family choices, size, weight, style, underline/strike, letter spacing, and line height. More advanced Word properties (variation axes, underline colour, overline, capitalization, text effects, alignment, and pseudo-state editing) remain visible as future capability rather than silently discarded, so status is limited.

## Failure modes

Unreadable data falls back to no overrides and is quarantined once. Imports above 64 KB, malformed JSON, unknown elements/tokens, invalid values, prototype keys, and unsafe CSS fragments are rejected with bounded sanitized messages. Off-screen selection remains editable and is named as off screen. Contrast advice is advisory and can apply a safe fix.

## Security considerations

The renderer uses closed custom-property names and CSSOM `setProperty`; it never injects a stylesheet, selector rule, or HTML. Typography values are copied only into closed per-element custom properties and the bundled stylesheet consumes those properties. Main-process schemas enforce element/token ownership and reject delimiter, URL, import, expression, comment, tag, and newline syntax. Appearance cannot alter display, position, visibility, commands, IPC, or confirmation behavior.

## Verification

Tests cover registry completeness, export/import round-trip, HEX8 and typography validation, unknown/prototype payloads, CSS injection fuzzing, CSSOM-only application, CSS readers for new typography tokens, and command-palette reachability. Type check and build are run on this branch; packaged capture of edit mode, keyboard selection, and panel collision behavior remains pending.

## Suggested articles

- [Settings, language, and display name](settings-language-and-display-name.md)
- [Tab workspace](tab-navigation.md)
- [Privacy and security](../security/privacy-and-security.md)
