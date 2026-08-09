# Feature documentation

This hand-written category inventory is the canonical map for feature articles. It also indexes generated catalog metadata that is built only from reviewed local catalog and adapter records. Status labels mean **shipped**, **limited** (implemented with explicit boundaries), or **pending** (not implemented and never presented as available).

## Discovery and catalog

Finding reviewed public applications and understanding their release state.

- [Catalog discovery](./discovery/catalog-discovery.md) — **shipped** — Loads a reviewed public-app allowlist, enriches it with live repository and stable-release metadata, and falls back honestly to a bounded cache.
- [Lowlevel Computer Use MCP catalog record](../catalog-apps/catalog-app-lowlevel-computer-use-mcp.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Lowlevel Computer Use MCP: installable, squirrel, and adapter lowlevel-computer-use-mcp-squirrel.
- [Material Download Manager catalog record](../catalog-apps/catalog-app-material-download-manager.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Material Download Manager: installable, squirrel, and adapter material-download-manager-squirrel.
- [Material Designer catalog record](../catalog-apps/catalog-app-material-designer.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Material Designer: installable, squirrel, and adapter material-designer-squirrel.
- [Material BlueMap catalog record](../catalog-apps/catalog-app-material-bluemap.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Material BlueMap: installable, squirrel, and adapter material-bluemap-squirrel.
- [Desktop Material catalog record](../catalog-apps/catalog-app-desktop-material.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Desktop Material: installable, squirrel, and adapter desktop-material-squirrel.
- [Home Assistant AC Defender catalog record](../catalog-apps/catalog-app-home-assistant-ac-defender.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Home Assistant AC Defender: installable, squirrel, and adapter home-assistant-ac-defender-squirrel.
- [Material Email catalog record](../catalog-apps/catalog-app-material-email.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Material Email: installable, nsis, and adapter material-email-nsis.
- [OpenCodex catalog record](../catalog-apps/catalog-app-opencodex.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for OpenCodex: installable, squirrel, and adapter opencodex-squirrel.
- [qBittorrent Material catalog record](../catalog-apps/catalog-app-qbittorrent-material.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for qBittorrent Material: installable, squirrel, and adapter qbittorrent-material-squirrel.
- [WinSCP Material catalog record](../catalog-apps/catalog-app-material-winscp.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for WinSCP Material: installable, squirrel, and adapter material-winscp-squirrel.
- [Dim Sum Atlas catalog record](../catalog-apps/catalog-app-dim-sum-atlas.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Dim Sum Atlas: installable, archive, and adapter dim-sum-atlas-portable-zip.
- [Win SSH Copy ID catalog record](../catalog-apps/catalog-app-win-ssh-copy-id.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Win SSH Copy ID: unsupported, unsupported, and adapter win-ssh-copy-id-no-release.
- [Material Office catalog record](../catalog-apps/catalog-app-material-office.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Material Office: installable, nsis, and adapter material-office-nsis.
- [Minecraft World Downloader catalog record](../catalog-apps/catalog-app-minecraft-world-downloader.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Minecraft World Downloader: installable, nsis, and adapter minecraft-world-downloader-nsis.
- [Codex Material catalog record](../catalog-apps/catalog-app-codex-material.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Codex Material: installable, msi, and adapter codex-material-msi.
- [LibreOffice Material catalog record](../catalog-apps/catalog-app-libreoffice-material.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for LibreOffice Material: installable, msi, and adapter libreoffice-material-msi.
- [Material Mail catalog record](../catalog-apps/catalog-app-thunderbird-desktop.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Material Mail: installable, nsis, and adapter thunderbird-desktop-mozilla-nsis.
- [Bambu Studio catalog record](../catalog-apps/catalog-app-bambu-studio.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Bambu Studio: installable, nsis, and adapter bambu-studio-nsis.
- [KeePassXC catalog record](../catalog-apps/catalog-app-keepassxc.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for KeePassXC: installable, msi, and adapter keepassxc-msi.
- [JDownloader Material catalog record](../catalog-apps/catalog-app-jdownloader-material.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for JDownloader Material: installable, jpackage, and adapter jdownloader-material-jpackage.
- [Home Assistant Bambu Lab catalog record](../catalog-apps/catalog-app-ha-bambulab.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Home Assistant Bambu Lab: unsupported, unsupported, and adapter ha-bambulab-external-home-assistant.
- [WinForge catalog record](../catalog-apps/catalog-app-winforge.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for WinForge: installable, archive, and adapter winforge-portable-zip.
- [WimForge catalog record](../catalog-apps/catalog-app-wimforge.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for WimForge: installable, archive, and adapter wimforge-portable-zip.
- [Photo Viewer catalog record](../catalog-apps/catalog-app-photo-viewer.md) — **limited** — *(generated catalog metadata)* — Generated reviewed metadata for Photo Viewer: unsupported, unsupported, and adapter photo-viewer-empty-release.

## Installation and removal

Verified install adapters, fail-closed source builds, removal, and pending automation.

- [Verified installer operations](./installation/verified-installer-operations.md) — **limited** — Downloads one app-specific Squirrel, MSI, NSIS, jpackage, or portable-ZIP asset, verifies its bytes, and applies only a fixed reviewed adapter.
- [One-click installation and adapter coverage](./installation/one-click-installation.md) — **limited** — Dispatches 21 reviewed release adapters without typed confirmation and reports three current public-release blockers instead of guessing commands.
- [Source-build security](./installation/source-build-security.md) — **limited** — Provides a typed, bounded source-job and repair runtime with a truthful Windows Sandbox capability probe, but deliberately withholds execution until an attested hard-disposable guest transport and reviewed recipe exist.
- [Protected uninstall](./installation/uninstall.md) — **shipped** — Removes only an installation whose Squirrel, MSI, or managed-portable ownership route was recorded or safely rediscovered.
- [Automatic repair and universal adapters](./installation/automatic-repair-and-universal-adapters.md) — **limited** — Keeps the typed terminal, pinned OpenCode, bounded repair, consent, and truthful Windows Sandbox capability refusal separate from the 24 reviewed release-adapter records.

## Installed apps and history

Windows discovery, owned records, operation history, snapshots, and export.

- [Installed app discovery](./installed/installed-app-discovery.md) — **shipped** — Detects reviewed registry installs while keeping external discovery separate from exact App Store ownership and removal authority.
- [Activity history and export](./installed/activity-history.md) — **shipped** — Appends every install, build, and uninstall result, offers composed filters, exports the selected or filtered log, and links into local version history.
- [Local history and version restore](./installed/history-versioning.md) — **limited** — Browses bounded local-Git snapshots with diff, labels, and an explicit reversible restore path.

## Updates and schedules

Catalog comparisons, the App Store updater, repeat checks, and quiet hours.

- [Per-app update checker](./updates/per-app-update-checker.md) — **limited** — Compares discovered versions with stable releases and lets a user download, verify, cancel, and explicitly restart to install a staged per-app update.
- [App Store self-updater](./updates/app-store-self-updater.md) — **limited** — Runs a bounded unsigned Squirrel RELEASES state machine with package-integrity metadata, user-started downloads, recoverable failures, and an explicit restart action.
- [Update schedule](./updates/update-schedule.md) — **shipped** — Runs one unavoidable startup self-check plus bounded repeat self-check and catalog-refresh timers with explicit history, backoff, and quiet-hour semantics.

## Workspace and customization

Tabs, search, command palette, settings, appearance, and notifications.

- [Tab workspace](./experience/tab-navigation.md) — **shipped** — Keeps six recoverable browser-style pages in a persistent four-edge tab rail with pinning, groups, independent searches, bulk close/reopen, overflow, keyboard control, and JSON import/export.
- [Search and regex builder](./experience/search-and-regex-builder.md) — **shipped** — Gives every current collection/settings surface independent plain-text-first search and the same adjacent guided JavaScript regex builder.
- [Command palette](./experience/command-palette.md) — **shipped** — Opens with Ctrl+Shift+F and searches page, tab, appearance, schedule, search, setting, and catalog-app registry entries.
- [Settings, language, and display name](./experience/settings-language-and-display-name.md) — **shipped** — Persists language, two independent funny levels, optional narrator preferences, dialog emoji decoration, theme, density, accent, and a display-only app name through tabbed searchable settings.
- [Universal School mode](./experience/school-mode.md) — **shipped** — A persisted, user-renamable English-only presentation mode with a shared local unlock verifier.
- [Optional spoken narrator](./experience/optional-spoken-narrator.md) — **shipped** — Optional renderer-only notification speech with serialized English and Hong Kong Cantonese delivery.
- [External editor exports](./experience/external-editor-exports.md) — **shipped** — Exports every exposed record and view to an app-owned VS Code workspace through a validated, shell-free main-process adapter.
- [Appearance editor](./experience/appearance-editor.md) — **limited** — Registers shell elements for validated live CSS-variable overrides with a bidirectional colour translator, Word-depth typography controls, reset, import, and export.
- [Notifications and operation status](./experience/notifications-and-status.md) — **limited** — Stacks corner snackbars, retains searchable notification history, optionally narrates new notices, and keeps destructive decisions behind native super-confirmation.
- [Dim-sum startup surprise](./experience/dim-sum-surprise.md) — **shipped** — Gives later launches a small non-blocking dim-sum card using only metadata and a published public catalog photo URL.
- [Changelog viewer](./experience/changelog-viewer.md) — **shipped** — Browses every released version with searchable commit links, typed date filters, an anchored month-jump range calendar, presets, and filtered copy/export actions.

## Documentation

The complete offline in-app browser and its generated public mirrors.

- [Offline documentation browser](./documentation/offline-documentation-browser.md) — **shipped** — Bundles canonical feature articles plus generated reviewed catalog metadata into the desktop build, renders one article at a time through safe React Markdown, and keeps links inside the browser.

## Memory synchronization

Shared instruction provenance, offline bundles, and safe synchronization boundaries.

- [Shared Status Hub](./memory-sync/status-hub.md) — **limited** — Documents the interactive status and handoff surface, its session boundaries, and the evidence limits of this App Store bundle.
- [Shared convenience skills](./memory-sync/convenience-skills.md) — **limited** — Describes how shared skills are selected, mirrored, and kept provenance-aware without importing secrets or granting host authority.

## Security and privacy

Renderer isolation, privileged validation, local data, and evidence boundaries.

- [Privacy and security](./security/privacy-and-security.md) — **shipped** — Keeps network, filesystem, process, update, and persistence authority in the sandboxed main-process boundary with typed renderer requests.

## Verification

What static checks, tests, runtime captures, workflows, and releases prove.

- [Verification and evidence](./verification/verification.md) — **shipped** — Separates source structure, focused tests, build, packaged runtime, hidden-desktop capture, workflow, release, and installer evidence.
