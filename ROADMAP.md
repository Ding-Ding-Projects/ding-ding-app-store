# Roadmap

## In progress — 0.1.0

- [x] Public repository and isolated Electron/React/TypeScript foundation
- [x] Reviewed public-app catalog and stable-release discovery
- [x] Sandboxed renderer, typed IPC, and fixed installer boundary
- [x] Per-app update comparison and App Store self-update state machine
- [x] Initial Material Design 3 catalog/settings/docs surfaces
- [ ] Disposable Windows source-build runner
- [x] Common typed source-job runtime, M3 terminal simulator, consent, pinned OpenCode bootstrap contract, bounded repair loop, cancellation, and fail-closed isolation gate
- [x] Typed terminal retry path and guest-only pinned OpenCode bootstrap (reuses or downloads the exact archive without host PATH access)
- [x] Windows Sandbox capability probe and typed source-runner status (reports binary presence without launching a host process; fails closed while guest transport is absent)
- [x] Source isolation status is directly visible in Settings → General and reachable through a typed command-palette destination; the card remains read-only and fail-closed
- [x] Installed-app discovery for reviewed Squirrel, MSI, and managed-portable records, including typed discovery-only upstream installs with no inherited install/update/uninstall authority, plus append-only history/export
- [x] Truthful shared export registry: 18 history formats with UTF-8/LF/schema metadata, including bounded re-importable ZIP archives; nested documents remain complete JSON
- [x] One-click install/source-install dispatch with strict catalog-ID and typed-decision boundary; destructive uninstall confirmation unchanged
- [x] Closed release-adapter coverage for all 24 catalog records: 21 source-proven Windows routes and three explicit external blockers
- [x] Execute and launch every reviewed portable adapter on disposable clean-Windows profiles through `.github/workflows/install-adapter-proof.yml`: `dim-sum-atlas` proof `31264987569`, `winforge` proof `31267799564`, and `wimforge` proof `31267915704` all returned `verdict=true` with install, rediscovery, uninstall, and cleanup evidence on `windows-2022`; the remaining non-portable matrix still needs its own proof lanes, while WinSshCopyId, Photo Viewer, and ha-bambulab retain their explicit upstream blockers
- [x] Prove the first non-portable adapter on clean Windows: `qbittorrent-material-squirrel` proof `31268659194` returned `verdict=true` on `windows-2022` for commit `702501675210dd767953cfa7208e8f21e40c4f0a`, with direct SHA-256, empty initial target state, exact new registry ownership, Squirrel uninstall, and empty detected/persisted cleanup state
- [x] Prove the first MSI adapter on clean Windows: `keepassxc-msi` proof `31269200281` returned `verdict=true` on `windows-2022` for commit `ce44857f49fc4c34e96189138db9a7652cda88ef`, with direct SHA-256, empty initial target state, exact registry ownership, MSI product-code uninstall, and empty detected/persisted cleanup state
- [x] Prove a second MSI adapter on clean Windows: `codex-material-msi` proof `31270172555` returned `verdict=true` on `windows-2022` for commit `9cad7164e89cde7ce33f4d56f4242b68d070f418`, with direct SHA-256, empty initial target state, exact registry ownership, MSI product-code uninstall, and empty detected/persisted cleanup state
- [ ] Complete source-build execution only after a real hard-disposable broker exists; keep bounded OpenCode repair and its current host refusal intact
- [x] Generated offline catalog metadata for every reviewed catalog application, with stable IDs, public source links, adapter/blocker state, canonical boundary links, wiki/site mirrors, command-palette reachability, and fail-closed completeness coverage
- [x] Local operation history: every install/build/uninstall outcome recorded, filterable by action/result/date, exported as 18 truthful formats including re-importable ZIP
- [x] Local version browser: bounded Git snapshots with diff, labels, and explicit before/after restore revisions for settings, installed records, workspace, appearance, schedules, run metadata, and external-editor preference; credential vaults and staged update paths remain excluded
- [x] Persistent tab rail with left/right/top/bottom docking, pinning, grouping, overflow, four independent regex-backed tab searches, searchable Move… into group… picker, reversible bulk close/reopen, and full keyboard control
- [x] Single-source tab shortcut registry with live pin/group/search/move handlers, searchable context-menu key caps, and semantic `aria-keyshortcuts`
- [x] Independent search state and a full regex builder on every surface, including the command palette
- [x] Per-element appearance editor with live preview, reset, export, and import
- [x] Advanced changelog date filtering with typed dates, month/year jump, two-click range selection, presets, and localized keyboard controls
- [x] Truthful VS Code export launch outcomes: observed spawn succeeds; child errors and unconfirmed two-second launches fail closed while exports remain recoverable
- [x] Update schedule editor with last-run/next-run reporting and quiet hours
- [x] Optional renderer-only notification narrator: persisted opt-in, English/Hong Kong Cantonese/both serialized delivery, stale queue replacement, category cooldowns, and quiet/reduced-sound accessibility yielding
- [x] Truthful NotificationCenter bulk Recovery details with callback-free, operation-ID-free retained history and an explicit originating-surface retry boundary
- [x] NotificationCenter language-mode coverage for history, filters, bulk actions, export/open states, accessibility names, empty state, and destructive confirmation
- [ ] Packaged-artifact hidden-desktop interaction and accessibility proof
- [x] CI and release automation on pinned GitHub-hosted cloud runners (`windows-2022` for checks, packaging, and publication; `ubuntu-24.04` for Pages)
- [x] Unsigned Squirrel.Windows release, verified end to end: [`v0.1.0-756-1`](https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v0.1.0-756-1) targets `3f540a2`, is non-draft, `Setup.exe` is confirmed `NotSigned`, and the release includes `RELEASES`, a full `.nupkg`, and `release-changelog.json`
- [x] Documentation deployment: [`https://ding-ding-projects.github.io/ding-ding-app-store/`](https://ding-ding-projects.github.io/ding-ding-app-store/) is live and verified serving the real site
- [ ] Working update-feed proof (the self-updater code exists, but a clean-Windows restart/install cycle against the published unsigned feed still needs runtime evidence)

## Completion boundary

The project is not complete until every supported catalog application can truthfully report install/build/update/uninstall capability, the full documentation corpus is bundled and searchable offline, all universal user-surface requirements are implemented, the packaged app passes runtime checks, and the exact default-branch release is verified.
