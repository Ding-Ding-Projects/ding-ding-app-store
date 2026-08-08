# Feature documentation

This hand-written category inventory is the canonical map for the public site, wiki mirror, and offline in-app bundle. Status labels mean **shipped**, **limited** (implemented with explicit boundaries), or **pending** (not implemented and never presented as available).

## Discovery and catalog

Finding reviewed public applications and understanding their release state.

- [Catalog discovery](./discovery/catalog-discovery.md) — **shipped** — Loads a reviewed public-app allowlist, enriches it with live repository and stable-release metadata, and falls back honestly to a bounded cache.

## Installation and removal

Verified install adapters, fail-closed source builds, removal, and pending automation.

- [Verified installer operations](./installation/verified-installer-operations.md) — **limited** — Downloads one app-specific Squirrel, MSI, NSIS, jpackage, or portable-ZIP asset, verifies its bytes, and applies only a fixed reviewed adapter.
- [One-click installation and adapter coverage](./installation/one-click-installation.md) — **limited** — Dispatches 21 reviewed release adapters without typed confirmation and reports three current public-release blockers instead of guessing commands.
- [Source-build security](./installation/source-build-security.md) — **limited** — Provides a typed, bounded source-job and repair runtime but deliberately withholds execution until an attested hard-disposable Windows broker and reviewed recipe exist.
- [Protected uninstall](./installation/uninstall.md) — **shipped** — Removes only an installation whose Squirrel, MSI, or managed-portable ownership route was recorded or safely rediscovered.
- [Automatic repair and universal adapters](./installation/automatic-repair-and-universal-adapters.md) — **limited** — Keeps the typed terminal, pinned OpenCode, bounded repair, consent, and hard-isolation refusal separate from the 24 reviewed release-adapter records.

## Installed apps and history

Windows discovery, owned records, operation history, snapshots, and export.

- [Installed app discovery](./installed/installed-app-discovery.md) — **shipped** — Reconciles App Store records with exact reviewed registry identities and the managed portable directory, then derives uninstall authority afresh.
- [Activity history and export](./installed/activity-history.md) — **shipped** — Appends every install, build, and uninstall result, offers composed filters, and exports the complete stored log in four text formats.

## Updates and schedules

Catalog comparisons, the App Store updater, repeat checks, and quiet hours.

- [Per-app update checker](./updates/per-app-update-checker.md) — **limited** — Compares each discovered version with the latest stable catalog release whenever catalog metadata refreshes; it does not yet download app updates.
- [App Store self-updater](./updates/app-store-self-updater.md) — **limited** — Checks a bounded unsigned Squirrel RELEASES feed, separates availability from download, and restarts only after an explicit ready-state action.
- [Update schedule](./updates/update-schedule.md) — **shipped** — Runs one unavoidable startup self-check plus bounded repeat self-check and catalog-refresh timers with explicit history, backoff, and quiet-hour semantics.

## Workspace and customization

Tabs, search, command palette, settings, appearance, and notifications.

- [Tab workspace](./experience/tab-navigation.md) — **shipped** — Keeps six recoverable browser-style pages in a persistent four-edge tab rail with pinning, groups, independent searches, bulk close/reopen, overflow, keyboard control, and JSON import/export.
- [Search and regex builder](./experience/search-and-regex-builder.md) — **shipped** — Gives every current collection/settings surface independent plain-text-first search and the same adjacent guided JavaScript regex builder.
- [Command palette](./experience/command-palette.md) — **shipped** — Opens with Ctrl+Shift+F and searches page, tab, appearance, schedule, search, setting, and catalog-app registry entries.
- [Settings, language, and display name](./experience/settings-language-and-display-name.md) — **shipped** — Persists language, two independent funny levels, theme, density, accent, and a display-only app name through tabbed searchable settings.
- [Appearance editor](./experience/appearance-editor.md) — **limited** — Registers shell elements for bounded live CSS-variable overrides with per-element reset, import/export, and main-process validation.
- [Notifications and operation status](./experience/notifications-and-status.md) — **limited** — Stacks corner snackbars, retains searchable notification history, and keeps destructive decisions behind native super-confirmation.
- [Dim-sum startup surprise](./experience/dim-sum-surprise.md) — **shipped** — Gives later launches a small non-blocking dim-sum card using only metadata and a published public catalog photo URL.

## Documentation

The complete offline in-app browser and its generated public mirrors.

- [Offline documentation browser](./documentation/offline-documentation-browser.md) — **shipped** — Bundles every canonical feature article into the desktop build, renders one article at a time through safe React Markdown, and keeps links inside the browser.

## Security and privacy

Renderer isolation, privileged validation, local data, and evidence boundaries.

- [Privacy and security](./security/privacy-and-security.md) — **shipped** — Keeps network, filesystem, process, update, and persistence authority in the sandboxed main-process boundary with typed renderer requests.

## Verification

What static checks, tests, runtime captures, workflows, and releases prove.

- [Verification and evidence](./verification/verification.md) — **shipped** — Separates source structure, focused tests, build, packaged runtime, hidden-desktop capture, workflow, release, and installer evidence.
