# Ding Ding App Store documentation

The wiki mirrors the same canonical feature articles bundled into the application and static site. Status labels distinguish shipped behaviour from limited and pending work.

## Discovery and catalog

- [Catalog discovery](Catalog-Discovery) — **shipped** — Loads a reviewed public-app allowlist, enriches it with live repository and stable-release metadata, and falls back honestly to a bounded cache.

## Installation and removal

- [Verified installer operations](Verified-Installer-Operations) — **limited** — Downloads one allowlisted stable asset, verifies its declared size and GitHub SHA-256 digest, then launches a fixed silent Squirrel or MSI argument vector.
- [Source-build security](Source-Build-Security) — **limited** — Catalogues source manifests but deliberately withholds execution until a disposable, resource-bounded Windows build runner exists.
- [Protected uninstall](Uninstall) — **shipped** — Removes only an installation whose Squirrel, MSI, or managed-portable ownership route was recorded or safely rediscovered.
- [Automatic repair and universal adapters](Automatic-Repair-and-Universal-Adapters) — **pending** — Records the requested touchless terminal, dependency bootstrap, OpenCode repair, and fresh-Windows adapter goal without presenting it as shipped.

## Installed apps and history

- [Installed app discovery](Installed-App-Discovery) — **shipped** — Reconciles App Store records with allowlisted Squirrel roots, Windows uninstall registry entries, and the managed portable directory.
- [Activity history and export](Activity-History) — **shipped** — Appends every install, build, and uninstall result, offers composed filters, and exports the complete stored log in four text formats.

## Updates and schedules

- [Per-app update checker](Per-App-Update-Checker) — **limited** — Compares each discovered version with the latest stable catalog release whenever catalog metadata refreshes; it does not yet download app updates.
- [App Store self-updater](App-Store-Self-Updater) — **limited** — Checks a bounded unsigned Squirrel RELEASES feed, separates availability from download, and restarts only after an explicit ready-state action.
- [Update schedule](Update-Schedule) — **shipped** — Runs one unavoidable startup self-check plus bounded repeat self-check and catalog-refresh timers with explicit history, backoff, and quiet-hour semantics.

## Workspace and customization

- [Tab workspace](Tab-Navigation) — **shipped** — Keeps six fixed pages in a persistent searchable rail with pinning, groups, reordering, overflow, keyboard control, and JSON import/export.
- [Search and regex builder](Search-and-Regex-Builder) — **shipped** — Gives every current collection/settings surface independent plain-text-first search and the same adjacent guided JavaScript regex builder.
- [Command palette](Command-Palette) — **shipped** — Opens with Ctrl+Shift+F and searches page, tab, appearance, schedule, search, setting, and catalog-app registry entries.
- [Settings, language, and display name](Settings-Language-and-Display-Name) — **shipped** — Persists language, two independent funny levels, theme, density, accent, and a display-only app name through tabbed searchable settings.
- [Appearance editor](Appearance-Editor) — **limited** — Registers shell elements for bounded live CSS-variable overrides with per-element reset, import/export, and main-process validation.
- [Notifications and operation status](Notifications-and-Status) — **limited** — Uses corner toasts and a persistent updater banner for non-decision state while keeping install/removal decisions in native dialogs.

## Documentation

- [Offline documentation browser](Offline-Documentation-Browser) — **shipped** — Bundles every canonical feature article into the desktop build, renders one article at a time through safe React Markdown, and keeps links inside the browser.

## Security and privacy

- [Privacy and security](Privacy-and-Security) — **shipped** — Keeps network, filesystem, process, update, and persistence authority in the sandboxed main-process boundary with typed renderer requests.

## Verification

- [Verification and evidence](Verification) — **shipped** — Separates source structure, focused tests, build, packaged runtime, hidden-desktop capture, workflow, release, and installer evidence.
