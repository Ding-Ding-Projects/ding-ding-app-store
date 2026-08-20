# Linux TUI — revived August 2, 2026

> **Current status:** Desktop Material TUI is again an actively built,
> installable Linux-first terminal application. The Windows Electron app remains
> the graphical desktop edition; the TUI adapts its user outcomes to real
> terminal controls instead of pretending that a terminal owns desktop window
> chrome.

Desktop Material TUI is a separate terminal-native application built with
Textual. It targets Linux first and shares the desktop edition's repository,
Git, GitHub, search, safety, language, persistence, and release contracts where
the terminal can represent them honestly.

The terminal edition is interactive, not a read-only CLI. Users can click
buttons, tabs, lists, checkboxes, tables, and selectors in a mouse-reporting
terminal. Repository paths, clone URLs, branch names, commit summaries, commit
bodies, issue and pull-request text, API requests, regex patterns, and sample
text use real editable `Input` or `TextArea` controls. Every primary workflow
also remains keyboard reachable.

## Delivery state

The revived package provides a substantial interactive surface:

- open, create, clone, and switch among repositories;
- inspect changes and diffs, stage files, commit, fetch, pull, and push;
- browse history, branches, stashes, remotes, tags, and repository tools;
- inspect, preview, track, verify, and restore Windows-compatible Release-backed
  Cheap LFS pointers through a clickable manager and real text fields;
- drag or keyboard-resize the repository rail, retain its persisted width, and
  keep the workspace usable at narrow terminal sizes;
- browse repository files through a bounded, repository-confined Files tab and
  open a selected file in a detected external editor;
- keep persistent repository tabs with aliases, pins, favourites, groups,
  ordering, search, overflow, guarded bulk close, and bounded import/export;
- use GitHub issues, pull requests, Actions, releases, packages, projects
  inventory, and a bounded API explorer through an installed `gh` CLI;
- search collection surfaces in literal, fuzzy, or explicit RE2 mode and build a
  regular expression interactively;
- persist theme, density, accent, language, tone, editor, terminal, narrator,
  accessibility, and search preferences through XDG paths;
- retain reviewable notifications and isolated Git-backed settings history;
- occasionally show one locally bundled, verified dim-sum dish through a
  non-blocking, focus-safe 10% startup draw.

The generated parity contract covers all
202 rows in the desktop inventory and defaults every unmapped row to
`not_yet_available`. It is an implementation ledger, not marketing shorthand:
an adapted row carries source and test evidence, a partial row names its real
boundary, and terminal-owned behavior stays with the terminal emulator.
Regenerate it after the desktop inventory or an evidence mapping changes:

```bash
node tui/tools/generate-parity-contract.mjs
node tui/tools/generate-parity-contract.mjs --check
```

## Terminal captures

The five original, unedited captures came from the earlier packaged wheel
running in an off-screen Debian terminal. They remain historical evidence while
the August 2 revival has its own acceptance manifest and replacement captures.
They include the Changes overview, real
single-line and multiline editing, the clickable Cheap LFS manager, live RE2
matches, and the compact bilingual layout:

- Changes overview
- Editable Input and TextArea
- Cheap LFS inventory and local preview
- RE2 builder with live captures
- Bilingual narrow layout

## Documentation map

- [Install and package](app-doc://article/desktop-material.repository.30996ac7fda66789) — requirements, source
  installs, wheel artifacts, CI, launch, upgrade, and uninstall.
- [Container](app-doc://article/desktop-material.repository.235ef21b88b0aba2) — minimal non-root Docker image, current-repository
  bind mount, persisted XDG volumes, security, and troubleshooting.
- [Interaction and accessibility](app-doc://article/desktop-material.repository.f405afefeee4fa66) — mouse
  clicks, text boxes, keyboard focus, scrolling, resizing, assistive technology,
  and terminal constraints.
- [Repository path browser and quoted paste](app-doc://article/desktop-material.repository.b4622a1876d97e25) —
  folder-only mouse/keyboard browsing, Home/Up navigation, immediate safe
  unquoting, failure behavior, and path-boundary security.
- [Repository file browser](app-doc://article/desktop-material.repository.9b9ee65856f6f673) — bounded Files-tab enumeration,
  search and RE2, safe previews, symlink confinement, responsive interaction,
  and external-editor opening.
- [Architecture and XDG persistence](app-doc://article/desktop-material.repository.06a725ac6163a376) —
  boundaries, config, SQLite, locking, and isolated local history.
- [Repository tabs and saved sessions](app-doc://article/desktop-material.repository.aa061c78ba04a1a9) — aliases, pins,
  favourites, groups, overflow, search, guarded bulk close, and bounded session
  import/export.
- [Repositories and Git](app-doc://article/desktop-material.repository.69f857c71f960f5a) — available workflows,
  confirmation gates, concurrency, and current gaps.
- [GitHub workflows](app-doc://article/desktop-material.repository.1932cf7ef3255b08) — `gh` authentication, issues, pull
  requests, Actions, releases, packages, projects, and the API explorer.
- [Cheap LFS](app-doc://article/desktop-material.repository.09c0b0de12d76ba9) — Windows-compatible pointer limits, clickable
  manager, CLI, managed Release writes, verification, recovery, and current
  parity boundaries.
- [Cheap LFS-aware Git CLI wrapper](app-doc://article/desktop-material.repository.a7cdbfe097141946) — exact native
  Git argv passthrough, push preflight, materialized payload verification, and
  safe pull restoration.
- [Search and RE2](app-doc://article/desktop-material.repository.c0db038b19aed5eb) — modes, dialect, bounds, builder,
  flags, zero-width matches, and synchronization.
- [Language, appearance, and notifications](app-doc://article/desktop-material.repository.a0c20e582ca0b3f6)
  — English/Cantonese/bilingual copy, funny levels, terminal-safe appearance,
  narrator state, and notification history.
- [External editor and local version history](app-doc://article/desktop-material.repository.970057a078305183)
  — editor/terminal discovery and app-owned Git snapshots.
- [Security and failure modes](app-doc://article/desktop-material.repository.129f13f17b0109e5) — process,
  credential, path, network, storage, destructive-action, and recovery
  boundaries.
- [Verification](app-doc://article/desktop-material.repository.237f98619a8640c7) — local quality gates, packaged-wheel smoke
  checks, headless Linux interaction evidence, and the parity drift gate.

## Acceptance boundary

Source code or a green unit test does not prove a mouse path. The current
[revival verification manifest](app-doc://article/desktop-material.repository.e412af5905d625ca)
owns the packaged-wheel, real Linux terminal, mouse, text-entry, splitter,
Files-tab, resize, screenshot, installer, exit, and cleanup evidence for this
milestone. The original
[Linux TUI verification manifest](app-doc://article/desktop-material.repository.fa52a92ee8de19fe)
and the later
[path-browser and Git-wrapper manifest](app-doc://article/desktop-material.repository.f00dba4a50c9aae7)
remain dated historical evidence. A pending box stays pending until the real
artifact and interaction path have been observed; it never becomes a success
because a nearby unit test passed.
