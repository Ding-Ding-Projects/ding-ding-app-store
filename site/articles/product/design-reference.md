---
id: design-reference
title: Public design reference
titleYue: 公開設計參考
category: product
status: limited
summary: Provides an offline public-safe reference for the seven pages, five Settings subtabs, responsive shell, themes, language modes, and deterministic overlays.
---
# Public design reference

## Behaviour

The repository ships an offline Material Design 3 reference at `design/reference.html`. It presents the seven application pages—Catalog, Installed, Updates, Authenticator, Documentation, Activity, and Settings—and the five Settings subtabs—General, Appearance, Schedule, About, and Locks & Support. The shell uses a 60px custom title bar, a 288px left rail, a centered `Ctrl+Shift+F` search affordance, a 56px page icon tile, and rounded surface containers.

The reference includes deterministic local fixtures and query-addressable overlays for the command palette, regex builder, tab management/context menu, notification center, anchored appearance panel, action/progress dialog, destructive super-confirmation, source terminal status, changelog, and the dim-sum surprise. It supports light/dark themes, English/Cantonese/bilingual labels, responsive 1440×920, 820×920, and 360×640 layouts, keyboard focus, and reduced motion.

## Configuration

Use `?page=<id>` to open a page, `?settings=<id>` or `?subtab=<id>` to select a Settings subtab, and `?overlay=<id>` to open an overlay. Supported overlay aliases include `command-palette`, `regex-builder`, `tab-management`, `context-menu`, `notification-center`, `appearance-panel`, `action-progress`, `destructive-super-confirm`, `source-terminal`, `changelog`, and `dim-sum-surprise`. `?lang=en|yue|bilingual` and `?theme=light|dark` select the presentation mode.

The plain Electron viewer is launched with `npm run design:reference`. Its compare mode is launched with `npm run design:compare`; the CLI accepts only an allowlisted mode and row identifier and resolves comparison evidence to fixed task-owned locations. A renderer never supplies a path, URL, command, or executable argument.

## Failure modes

Unknown query values fall back to the Catalog page, bilingual labels, light theme, or the reference mode. Unknown compare rows fall back to the `shell` row. The static page does not attempt a network request or start an installer. The viewer denies navigation, permissions, web requests, and new windows; a missing comparison artifact remains an honest unavailable comparison rather than a fabricated capture.

## Security considerations

The reference has a restrictive local Content Security Policy with no network connections or remote fonts. The Electron viewer uses a frameless window with context isolation and sandbox enabled, Node integration disabled, a fixed partition, denied permissions, blocked navigation, denied new windows, and cancellation of HTTP(S)/WebSocket requests. Comparison identifiers are validated before fixed-path resolution. The reference contains no credentials, private repository names, user paths, or simulated authentication data.

## Verification

Review the static page directly at each supported viewport and use the query examples above to exercise every page, Settings subtab, and overlay. Run the viewer through the package scripts when packaged-window evidence is needed. This document and `design/NOTICE.md` define the artifact boundary; they do not claim runtime or visual verification by themselves.

## Suggested articles

- [Command palette](../experience/command-palette.md)
- [Tab workspace](../experience/tab-navigation.md)
- [Privacy and security](../security/privacy-and-security.md)
