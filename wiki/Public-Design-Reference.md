# Public design reference

## Scope

The repository's sanitized design reference records the desktop shell rewrite without exposing private project data or executable behavior. It covers the exact seven pages: Catalog, Installed, Updates, Authenticator, Documentation, Activity, and Settings. Settings has five subtabs: General, Appearance, Schedule, About, and Locks & Support.

The shell follows the compact Material Design 3 contract: a 60px custom title bar, 288px left navigation rail, centered `Ctrl+Shift+F` search, a 56px page icon tile, and rounded surface containers. The static reference includes light/dark themes, English/Cantonese/bilingual labels, reduced-motion handling, and deterministic responsive fixtures for 1440×920, 820×920, and 360×640 layouts.

## Interaction states

The reference exposes query-addressable examples for the command palette, regex builder, tab-management/context menu, notification center, anchored appearance panel, action/progress dialog, destructive super-confirmation, source terminal, changelog, and dim-sum surprise. The fixtures are local and explanatory. They do not start downloads, installers, source builds, authentication, telemetry, or network requests.

## Secure comparison viewer

`tools/design-reference/main.mjs` provides the plain Electron viewer and a side-by-side comparison mode. The viewer enables context isolation and sandboxing, disables Node integration, denies permissions, blocks navigation and network protocols, and denies new windows. Comparison mode accepts only allowlisted mode and row identifiers and resolves those identifiers against fixed task-owned evidence locations. No renderer-provided path, URL, command, or executable argument is accepted.

## Evidence boundary

Yum Leung Cha verification intentionally did not run tests, linters, audits, reviews, builds, captures, or screenshots. The design reference documents the intended shell and interaction states; packaged runtime, comparison-artifact, and release evidence remain pending.

## Related pages

- [Tab navigation](Tab-Navigation)
- [Command palette](Command-Palette)
- [Expressive storefront](Expressive-Storefront)
- [Privacy and security](Privacy-and-Security)
