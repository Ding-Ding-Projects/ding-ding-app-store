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
- [x] Installed-app discovery for reviewed Squirrel, MSI, and managed-portable records, including typed discovery-only upstream installs with no inherited install/update/uninstall authority, plus append-only history/export
- [x] Truthful shared export registry: 18 history formats with UTF-8/LF/schema metadata, including bounded re-importable ZIP archives; nested documents remain complete JSON
- [x] One-click install/source-install dispatch with strict catalog-ID and typed-decision boundary; destructive uninstall confirmation unchanged
- [x] Closed release-adapter coverage for all 24 catalog records: 21 source-proven Windows routes and three explicit external blockers
- [ ] Execute and launch every supported adapter on disposable clean-Windows profiles through `.github/workflows/install-adapter-proof.yml` (portable ZIP lane now verifies `dim-sum-atlas` end to end on `windows-2022`; `winforge` and `wimforge` remain pending); resolve the missing WinSshCopyId release, empty Photo Viewer release, and authorized Home Assistant target
- [ ] Complete source-build execution only after a real hard-disposable broker exists; keep bounded OpenCode repair and its current host refusal intact
- [x] Generated offline catalog metadata for every reviewed catalog application, with stable IDs, public source links, adapter/blocker state, canonical boundary links, wiki/site mirrors, command-palette reachability, and fail-closed completeness coverage
- [x] Local operation history: every install/build/uninstall outcome recorded, filterable by action/result/date, exported as 18 truthful formats including re-importable ZIP
- [x] Local version browser: bounded Git snapshots with diff, labels, and explicit before/after restore revisions for App Store-owned state
- [x] Persistent tab rail with left/right/top/bottom docking, pinning, grouping, overflow, four independent regex-backed tab searches, searchable Move… into group… picker, reversible bulk close/reopen, and full keyboard control
- [x] Independent search state and a full regex builder on every surface, including the command palette
- [x] Per-element appearance editor with live preview, reset, export, and import
- [x] Update schedule editor with last-run/next-run reporting and quiet hours
- [x] Optional renderer-only notification narrator: persisted opt-in, English/Hong Kong Cantonese/both serialized delivery, stale queue replacement, category cooldowns, and quiet/reduced-sound accessibility yielding
- [ ] Packaged-artifact hidden-desktop interaction and accessibility proof
- [x] CI and release automation on pinned GitHub-hosted cloud runners (`windows-2022` for checks, packaging, and publication; `ubuntu-24.04` for Pages)
- [x] Unsigned Squirrel.Windows release, verified end to end: [`v0.1.0-746-1`](https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v0.1.0-746-1) targets `2df87e7`, is non-draft, `Setup.exe` is confirmed `NotSigned`, and the release includes `RELEASES`, a full `.nupkg`, and `release-changelog.json`
- [x] Documentation deployment: [`https://ding-ding-projects.github.io/ding-ding-app-store/`](https://ding-ding-projects.github.io/ding-ding-app-store/) is live and verified serving the real site
- [ ] Working update-feed proof (the self-updater code exists, but a clean-Windows restart/install cycle against the published unsigned feed still needs runtime evidence)

## Completion boundary

The project is not complete until every supported catalog application can truthfully report install/build/update/uninstall capability, the full documentation corpus is bundled and searchable offline, all universal user-surface requirements are implemented, the packaged app passes runtime checks, and the exact default-branch release is verified.
