---
id: appearance-editor
title: Appearance editor
titleYue: 外觀編輯器
category: experience
status: limited
summary: Registers shell elements for bounded live CSS-variable overrides with per-element reset, import/export, and main-process validation.
---
# Appearance editor

## Behaviour

`Ctrl+Shift+E`, Settings, or the command palette enters edit mode. A pointer click, Enter/Space, or keyboard focus selects the nearest registered element without running its normal action. A docked panel shows the selected hierarchy and edits supported background, foreground, radius, border width, elevation, font scale, font weight, and padding scale tokens live. Overrides layer above theme, density, and accent.

The shell, title bar, rail, tab/group rows, content, headings, search, regex builder, cards, status, buttons, chips, banner, notifications, empty states, activity, docs, settings, schedule, dialog, palette, and snackbar are registered. Destructive confirmation controls, emergency exit, and window controls are deliberately not editable or hideable.

## Configuration

The panel has its own search and regex builder plus Colour, Shape, Type, and Layout sub-tabs. Reset one element, reset all, ten-second reset undo, JSON export, and all-or-nothing import are available. `appearance.v1.json` stores only non-empty overrides. The current editor offers a bounded token palette and hex colors; it does not yet implement installed-font selection, Word-depth typography, continuous multi-space color translation, draggable panels, or every pseudo-state, so status is limited.

## Failure modes

Unreadable data falls back to no overrides and is quarantined once. Imports above 64 KB, malformed JSON, unknown elements/tokens, invalid values, prototype keys, and unsafe CSS fragments are rejected with bounded sanitized messages. Off-screen selection remains editable and is named as off screen. Contrast advice is advisory and can apply a safe fix.

## Security considerations

The renderer uses closed custom-property names and CSSOM `setProperty`; it never injects a stylesheet, selector, `style` attribute, or HTML. Main-process schemas enforce element/token ownership and reject delimiter, URL, import, expression, comment, tag, and newline syntax. Appearance cannot alter display, position, visibility, commands, IPC, or confirmation behavior.

## Verification

Tests cover registry completeness, export/import round-trip, unknown/prototype payloads, CSS injection fuzzing, CSSOM-only application, and command-palette reachability. Type check and build pass on the base. Packaged capture of edit mode, keyboard selection, and panel collision behavior remains pending.

## Suggested articles

- [Settings, language, and display name](settings-language-and-display-name.md)
- [Tab workspace](tab-navigation.md)
- [Privacy and security](../security/privacy-and-security.md)
