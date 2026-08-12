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
- [x] Closed release-adapter coverage for all 25 catalog records: 22 source-proven Windows routes and three explicit external blockers
- [x] Typed exact release evidence for the Amulet Map Editor Squirrel candidate, including its source-manifest paths, immutable asset digests, workflow timing, and honest non-green upstream test disclosure
- [x] Execute and launch every reviewed portable adapter on disposable clean-Windows profiles through `.github/workflows/install-adapter-proof.yml`: `dim-sum-atlas` proof `31264987569`, `winforge` proof `31267799564`, and `wimforge` proof `31267915704` all returned `verdict=true` with install, rediscovery, uninstall, and cleanup evidence on `windows-2022`; the remaining non-portable matrix still needs its own proof lanes, while WinSshCopyId, Photo Viewer, and ha-bambulab retain their explicit upstream blockers
- [x] Prove the first non-portable adapter on clean Windows: `qbittorrent-material-squirrel` proof `31268659194` returned `verdict=true` on `windows-2022` for commit `702501675210dd767953cfa7208e8f21e40c4f0a`, with direct SHA-256, empty initial target state, exact new registry ownership, Squirrel uninstall, and empty detected/persisted cleanup state
- [x] Prove the first MSI adapter on clean Windows: `keepassxc-msi` proof `31269200281` returned `verdict=true` on `windows-2022` for commit `ce44857f49fc4c34e96189138db9a7652cda88ef`, with direct SHA-256, empty initial target state, exact registry ownership, MSI product-code uninstall, and empty detected/persisted cleanup state
- [x] Prove a second MSI adapter on clean Windows: `codex-material-msi` proof `31270172555` returned `verdict=true` on `windows-2022` for commit `9cad7164e89cde7ce33f4d56f4242b68d070f418`, with direct SHA-256, empty initial target state, exact registry ownership, MSI product-code uninstall, and empty detected/persisted cleanup state
- [ ] Complete source-build execution only after a real hard-disposable broker exists; keep bounded OpenCode repair and its current host refusal intact
- [x] Generated offline catalog metadata for every reviewed catalog application, with stable IDs, public source links, adapter/blocker state, canonical boundary links, wiki/site mirrors, command-palette reachability, and fail-closed completeness coverage
- [x] Local operation history: every install/build/uninstall outcome recorded, filterable by action/result/date, exported as 18 truthful formats including re-importable ZIP
- [x] Local version browser: bounded Git snapshots with diff, labels, coordinated live reload, durable interrupted-restore recovery, explicit before/after restore revisions for settings, installed records, workspace, appearance, schedules, run metadata, and external-editor preference, plus Activity search/date projection, range-aware version selection, and metadata-only JSON/Markdown export; credential vaults and staged update paths remain excluded
- [x] Persistent tab rail with left/right/top/bottom docking, pinning, grouping, overflow, four independent regex-backed tab searches, searchable Move… into group… picker, reversible bulk close/reopen, and full keyboard control
- [x] Bounded tab/group and appearance-property UX locks with independent password/TOTP credentials, encrypted main-process vault storage, rate limiting, fail-closed metadata handling, sender-checked appearance IPC, restore refusal while appearance locks are active, and per-token lock/manage affordances in both appearance editors; School-mode and unavailable-vault states are explicit. QR pairing, skew-aware OTP parameters, unlock durations, bulk/global scopes, and protected lock-history restore remain outside this slice
- [x] Local Support Tickets bulk management: visible-scope checkbox and keyboard selection, Shift-range intent, select-shown/invert/clear, serialized non-destructive Advance selected transitions, atomic rollback/uncertain reporting, redacted history, and JSON/Markdown/VS Code exports
- [x] Single-source tab shortcut registry with live pin/group/search/move handlers, searchable context-menu key caps, and semantic `aria-keyshortcuts`
- [x] Independent search state and a full regex builder on every surface, including the command palette
- [x] Per-element appearance editor with live preview, reset, export, import, and keyboard-accessible per-token lock/manage routing to Locks & Support
- [x] Advanced changelog date filtering with typed dates, month/year jump, two-click range selection, presets, and localized keyboard controls
- [x] Changelog viewer language-mode coverage for dates, validation, bulk/copy/export outcomes, empty states, and five-level message voice without rewriting version or SHA facts, plus sender-validated full-SHA commit navigation through a fixed main-process repository URL
- [x] Truthful VS Code export launch outcomes: observed spawn succeeds; child errors and unconfirmed two-second launches fail closed while exports remain recoverable
- [x] Update schedule editor with last-run/next-run reporting and quiet hours
- [x] Optional renderer-only notification narrator: persisted opt-in, English/Hong Kong Cantonese/both serialized delivery, stale queue replacement, category cooldowns, and quiet/reduced-sound accessibility yielding
- [x] Bounded authenticator registration and saved-entry management: local URI/Base32 metadata, in-process QR matrix, current-code pairing confirmation, safeStorage-backed metadata entries, current/next-code countdown list, metadata-only rename/reorder, stable groups with colour/order/collapse controls and a keyboard regex bulk-move picker, native two-key/full-slider group deletion, checkbox plus Shift-click/Shift+Space visible-range selection, destructive single/bulk entry delete, redacted JSON/CSV/Markdown export with optional VS Code handoff, School-mode suppression, and regex search
- [x] Authenticator registration source, algorithm, and digit choices use independent keyboard-searchable pickers with anchored regex builders and preview-state disabling
- [x] Authenticator successful confirmation and metadata mutations append localized redacted `settings` Activity events through a best-effort recorder; entries contain fixed action text plus opaque entry ID/count metadata only, and prepare/cancel/failure/restriction/uncertainty or recorder failures never change the truthful mutation result
- [x] Branded App Store launch identity: checked-in ICO/SVG assets, explicit native title/icon, early branded shell creation, renderer load-failure diagnostics, and packaged title/icon smoke coverage
- [ ] Authenticator follow-up: local clipboard `otpauth://totp/` import, bounded local QR image-file import, and stable group records/actions are shipped with sender validation, strict preload parsing, School-mode denial, bounded input, and in-memory normalization. Camera scanning, deliberate secret export, and protected secret history/restore remain pending. The next-code peek, visible-range selection, and localized non-blocking prepare/confirm bridge-rejection notifications are shipped.
- [x] Truthful NotificationCenter bulk Recovery details with callback-free, operation-ID-free retained history and an explicit originating-surface retry boundary
- [x] NotificationCenter language-mode coverage for history, filters, bulk actions, export/open states, accessibility names, empty state, and destructive confirmation
- [x] Catalog/Installed/Updates language-mode coverage for bulk actions, status facts, loading/empty states, update controls, and selection accessibility names
- [x] One shared School-mode control with record epoch/revision CAS, atomic verified writes, cross-process live enabled/name/credential propagation, PIN/password rotation, fail-closed unavailable presentation, and two-service lifecycle coverage
- [ ] Packaged-artifact hidden-desktop interaction and accessibility proof
- [x] CI and release automation on pinned GitHub-hosted cloud runners (`windows-2022` for checks, packaging, and publication; `ubuntu-24.04` for Pages)
- [x] Unsigned Squirrel.Windows release, verified end to end: [`v0.1.0-756-1`](https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v0.1.0-756-1) targets `3f540a2`, is non-draft, `Setup.exe` is confirmed `NotSigned`, and the release includes `RELEASES`, a full `.nupkg`, and `release-changelog.json`
- [x] Memory synchronization documentation category: shared Status Hub and convenience-skill articles with generated offline/site/wiki mirrors and fail-closed completeness tests
- [x] Documentation deployment: [`https://ding-ding-projects.github.io/ding-ding-app-store/`](https://ding-ding-projects.github.io/ding-ding-app-store/) is live and verified serving the real site
- [ ] Working update-feed proof (the self-updater code exists, but a clean-Windows restart/install cycle against the published unsigned feed still needs runtime evidence)

## Completion boundary

The project is not complete until every supported catalog application can truthfully report install/build/update/uninstall capability, the full documentation corpus is bundled and searchable offline, all universal user-surface requirements are implemented, the packaged app passes runtime checks, and the exact default-branch release is verified.
## Protected local history access

- ✅ Added a dedicated safeStorage-backed credential gate for Activity and Local versions, with sender-checked preload IPC, live School-mode invalidation, malformed-record fail-closed handling, bounded failed-attempts, and localized lock/unlock UI.
- ⏳ Authenticator metadata/ciphertext snapshot and vault-native restore remain unavailable on the production host until a reviewed native handle-relative no-follow adapter is implemented and verified. The current path-based filesystem operations cannot close reparse/junction races, so the app refuses protected snapshot/restore before mutation and retains any recovery journal; raw secrets and DPAPI bytes must never enter plaintext Git history.
