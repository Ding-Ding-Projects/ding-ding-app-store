# Roadmap

## In progress — 0.1.0

- [x] Public repository and isolated Electron/React/TypeScript foundation
- [x] Reviewed public-app catalog and stable-release discovery
- [x] Sandboxed renderer, typed IPC, and fixed installer boundary
- [x] Per-app update comparison and App Store self-update state machine
- [x] Initial Material Design 3 catalog/settings/docs surfaces
- [ ] Disposable Windows source-build runner
- [ ] Installed-app discovery and adapter validation across every supported package type
- [ ] Complete offline wiki/repository-doc import for every catalog application
- [x] Local operation history: every install/build/uninstall outcome recorded, filterable by action/result/date, exported as JSON/CSV/Markdown
- [ ] Complete tab pinning/grouping, four tab searches, per-element appearance editor, and schedule editor
- [ ] Packaged-artifact hidden-desktop interaction and accessibility proof
- [x] CI on GitHub-hosted runners (`ubuntu-latest` typecheck/tests/build on push and PR)
- [x] Unsigned Squirrel.Windows release, verified end to end: [`v0.1.0-1`](https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v0.1.0-1) is non-draft, `Setup.exe` confirmed `NotSigned`, with `RELEASES` and a full `.nupkg`
- [ ] Documentation deployment: `pages.yml` is correct and will deploy on the next push once a repo admin sets Pages' build source to "GitHub Actions" once (`GITHUB_TOKEN` cannot create a repo's first Pages site itself — see HANDOFF.md)
- [ ] Working update-feed proof (the self-updater code exists, but no release has yet been checked against a live feed end to end)

## Completion boundary

The project is not complete until every supported catalog application can truthfully report install/build/update/uninstall capability, the full documentation corpus is bundled and searchable offline, all universal user-surface requirements are implemented, the packaged app passes runtime checks, and the exact default-branch release is verified.
