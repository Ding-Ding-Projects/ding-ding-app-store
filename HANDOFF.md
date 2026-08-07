# Handoff

## Current state

The repository contains a sandboxed Electron/React/TypeScript shell, reviewed 24-application catalog, stable-release/update comparison, SHA-256-gated installer path, protected uninstall path, App Store self-updater state machine, Material Design 3 navigation, language/funny-level settings, regex builder, command palette, real local operation history with export, and initial in-app documentation.

## Verified locally

- Strict renderer and main-process TypeScript compilation.
- Vite production renderer build.
- Initial security, packaging, catalog, update, language, regex, navigation, and destructive-confirmation contract tests.
- Unsigned Squirrel.Windows package creation with `Setup.exe`, `RELEASES`, and a full `.nupkg`; setup and packaged app both report `NotSigned`.
- Packaged application launch on the sanctioned cheap hidden desktop; the curated catalog rendered in the real artifact. See `docs/assets/screenshots/catalog-runtime.png`.

## Remaining

- Source builds are intentionally blocked until the disposable Windows runner is implemented.
- Install adapters need real-release verification per application; opaque installers remain unsupported instead of receiving guessed flags.
- Offline documentation import, tab pinning/grouping and its four searches, a per-element appearance editor, a schedule editor, CI, release, working update feed, and documentation deployment remain.
- The self-update failure state is runtime-verified: the repository has no release yet, so `RELEASES` returns HTTP 404. No successful update is claimed.
- GitHub Pages is not yet live: creating a Pages site for the first time needs an admin-level token, and the Actions `GITHUB_TOKEN` used by `pages.yml` doesn't have it. See the 2026-08-07 CI/release/Pages entry below for the exact one-time manual step needed.
- A real labelled self-hosted runner has not yet been observed for this repository; no remote CI or release claim is valid.

## Next owner action

Integrate the isolated catalog-domain and documentation branches, run the combined checks, package the unsigned Squirrel application, exercise it on the sanctioned hidden desktop, then continue the remaining roadmap without weakening the execution boundary.

## 2026-08-07 CI, release, and Pages workflows added (GitHub-hosted runners)

- AGENTS.md previously required an explicitly labelled self-hosted runner for every Actions job. No such runner has ever been registered for this repository (every prior handoff entry going back through this project's history records that as an open blocker). Asked the repository owner directly; they chose GitHub-hosted runners, both because none of the self-hosted alternative was actually available and because self-hosted runners on a *public* repository are a known risk (any pull request could execute code on infrastructure the owner controls). AGENTS.md is updated to match.
- Added `.github/workflows/ci.yml`: `ubuntu-latest`, runs `npm run check` (renderer/main typecheck, root contract tests, both workspace packages) and `npm run build` on push to `main` and on pull requests into `main`.
- Added `.github/workflows/release.yml`: a `test` job gates everything; on success, a `windows-latest` job builds the unsigned Squirrel.Windows installer (`npx electron-builder --win squirrel --publish never`), verifies the produced `Setup.exe` reports Authenticode status `NotSigned` (build fails otherwise), confirms `RELEASES` and a full `.nupkg` exist, and computes a line-count table; a final `ubuntu-latest` job publishes one non-draft GitHub Release tagged `v<version>-<run number>` with those three assets, verified UTC start/completion timestamps, measured end-to-end duration, the line-count table, and the source commit SHA. A failed `test` or `windows-build` job publishes no release.
- Added `.github/workflows/pages.yml`: `ubuntu-latest`, deploys the existing `site/` static documentation site (already self-contained, no CDN/remote assets) to GitHub Pages via `actions/configure-pages` + `actions/upload-pages-artifact` + `actions/deploy-pages`, matching the `homepage` already declared in `package.json`. This is a GitHub Actions Pages deployment (`pages: write`/`id-token: write`), not a self-hosted build job.
- **Real run evidence**, source commit `4ad8430` (merged via PR #3), all on GitHub-hosted runners:
  - CI: [run 31198047993](https://github.com/Ding-Ding-Projects/ding-ding-app-store/actions/runs/31198047993) — `ubuntu-latest`, `npm run check` + `npm run build`, succeeded.
  - Release: [run 31198047337](https://github.com/Ding-Ding-Projects/ding-ding-app-store/actions/runs/31198047337) — `test` (ubuntu) → `windows-build` (windows-latest, Squirrel packaging, `Get-AuthenticodeSignature` confirmed `NotSigned`, `RELEASES` + full `.nupkg` present) → `publish` (ubuntu), all succeeded end to end in 3m40s. Published [`v0.1.0-1`](https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v0.1.0-1): non-draft, non-prerelease, targets `4ad8430`, with `DingDingAppStore-Setup.exe` (143,888,384 bytes, `sha256:3dce957c…9ece18`), `DingDingAppStore-0.1.0-full.nupkg` (143,199,574 bytes, `sha256:68ca2ff5…5e4300c`), and `RELEASES` (87 bytes, `sha256:2cf77e2e…12f81f82`) — digests as recorded by GitHub on upload. Verified UTC start `2026-08-07T16:33:01Z`, completion `2026-08-07T16:35:45Z`, duration `00:02:44`, plus a CI-produced line-count table, all in the release notes.
  - A second push (the Pages fix below) produced release [run 31198471719](https://github.com/Ding-Ding-Projects/ding-ding-app-store/actions/runs/31198471719) targeting `468566d`; each push to `main` publishes its own uniquely tagged release, matching this repository's established per-change release convention.
  - Pages: [run 31198047324](https://github.com/Ding-Ding-Projects/ding-ding-app-store/actions/runs/31198047324) failed at `actions/configure-pages@v5` with `Get Pages site failed... Not Found`, because `enablement` defaults to `false` and this repo has never had a Pages site. Fixed in commit `468566d` by setting `enablement: true`. The retry, [run 31198471738](https://github.com/Ding-Ding-Projects/ding-ding-app-store/actions/runs/31198471738), still failed: `Create Pages site failed. Error: Resource not accessible by integration`. This is a real GitHub platform limit, not a workflow bug — the ephemeral Actions `GITHUB_TOKEN` cannot perform the one-time, admin-level action of creating a repository's first Pages site, even with `pages: write` permission and `enablement: true`. Every later deploy (once the site object exists) works fine through `GITHUB_TOKEN`; only the very first creation needs elevated access.
  - **External blocker, needs one manual step from a repository owner/admin**: open `https://github.com/Ding-Ding-Projects/ding-ding-app-store/settings/pages` and set **Build and deployment → Source** to **GitHub Actions** once. After that one click, `pages.yml` already deploys `site/` correctly on every push to `main` (or via manual dispatch) with no further code changes — re-run the workflow (or push again) once it's enabled. The `homepage` in `package.json` (`https://ding-ding-projects.github.io/ding-ding-app-store/`) will go live at that point.

## 2026-08-07 Real local operation history and export

- The Activity tab was a permanent stub (`No operations yet`) even though installs, builds, and uninstalls already ran; it never recorded anything. `src/main/history-service.ts` now records every operation outcome (app, action, ok/fail, message, timestamp) to a bounded (500-entry), atomically-written local JSON store via `OperationService`'s single `finish()` helper, so no return path in `install`/`build`/`uninstall` can skip recording.
- The typed `dingDingStore.history` bridge (`list()`, `export('json' | 'csv' | 'markdown')`) is the only path the renderer has to this data — no generic IPC channel was added.
- The Activity tab now renders real entries with action/result/date-preset filters, the same search box and full regex builder used elsewhere, and Copy JSON / download JSON / CSV / Markdown controls (client-side `Blob` download; no filesystem access was added to the renderer).
- `docs/features/uninstall.md` and `site/assets/app.js` already promised local operation history before this change; this change makes that promise true rather than aspirational. Added `docs/features/activity-history.md`, `wiki/Activity-History.md`, and a matching `site/assets/app.js` article, and linked all three from their respective indices.
- Local verification: `npm run check` passes (16/16 root contract tests plus the `catalog-contract` and `domain` workspace typecheck/test suites), and `npm run build` (renderer + main + preload) succeeds. No runtime/packaged/headless capture is claimed for this change — only static and build verification.
- Remaining gap this change does not close: tab pinning/grouping, the other three tab searches, a per-element appearance editor, and a schedule editor are still open roadmap work.
