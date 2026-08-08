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
- [x] Installed-app discovery for reviewed Squirrel, MSI, and managed-portable records with append-only history/export
- [x] One-click install/source-install dispatch with strict catalog-ID and typed-decision boundary; destructive uninstall confirmation unchanged
- [x] Closed release-adapter coverage for all 24 catalog records: 21 source-proven Windows routes and three explicit external blockers
- [ ] Execute and launch every supported adapter on disposable clean-Windows profiles; resolve the missing WinSshCopyId release, empty Photo Viewer release, and authorized Home Assistant target
- [ ] Complete source-build execution only after a real hard-disposable broker exists; keep bounded OpenCode repair and its current host refusal intact
- [ ] Complete offline wiki/repository-doc import for every catalog application
- [x] Local operation history: every install/build/uninstall outcome recorded, filterable by action/result/date, exported as JSON/CSV/Markdown
- [x] Persistent tab rail with left/right/top/bottom docking, pinning, grouping, overflow, four independent regex-backed tab searches, reversible bulk close/reopen, and full keyboard control
- [x] Independent search state and a full regex builder on every surface, including the command palette
- [x] Per-element appearance editor with live preview, reset, export, and import
- [x] Update schedule editor with last-run/next-run reporting and quiet hours
- [ ] Packaged-artifact hidden-desktop interaction and accessibility proof
- [x] CI and release automation on pinned GitHub-hosted cloud runners (`windows-2022` for checks, packaging, and publication; `ubuntu-24.04` for Pages)
- [x] Unsigned Squirrel.Windows release, verified end to end: [`v0.1.0-1`](https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v0.1.0-1) is non-draft, `Setup.exe` confirmed `NotSigned`, with `RELEASES` and a full `.nupkg`
- [x] Documentation deployment: [`https://ding-ding-projects.github.io/ding-ding-app-store/`](https://ding-ding-projects.github.io/ding-ding-app-store/) is live and verified serving the real site
- [ ] Working update-feed proof (the self-updater code exists, but no release has yet been checked against a live feed end to end)

## Completion boundary

The project is not complete until every supported catalog application can truthfully report install/build/update/uninstall capability, the full documentation corpus is bundled and searchable offline, all universal user-surface requirements are implemented, the packaged app passes runtime checks, and the exact default-branch release is verified.
