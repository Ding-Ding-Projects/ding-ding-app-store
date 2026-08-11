# Verification and evidence

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

Verification reports a specific revision and labels every evidence class independently: documentation completeness, static contracts, unit/integration tests, TypeScript/build, packaged application launch, hidden-desktop interaction, screenshot, installer execution, updater state, GitHub Actions run, release record, and public deployment. A stronger-looking proxy never upgrades a missing result.

Each release resolves the first unused bilingual dim-sum code name whose image is already a published `catalog-v1*` asset in the public `Ding-Ding-Projects/dim-sum-photos` catalog. The release title and notes link that public photo; this repository does not copy or attach it. Catalog failure is recorded but does not block the software release.

The release workflow runs for ordinary branch pushes and manual dispatches only. Its branch filter deliberately excludes generated release-tag pushes, preventing a newly published immutable tag from recursively starting a second release for the same source commit while preserving the exact source-target verification, unsigned Squirrel assets, timing, line-count, and dim-sum metadata contract. Actions only builds, packages, and publishes: tests, lint, and type-checks remain local checks and never gate a cloud release.

The repository root also carries `build.bat` and `build-installer.bat`. Both accept `/s`, `--silent`, or `SILENT=1`; they resolve Node.js 22 from a user-scoped installation or a SHA-256-verified Node.js archive, run the locked `npm ci` path, and fail on the first missing output. `build-installer.bat` uses the same Squirrel.Windows packaging route as the release workflow, verifies `Setup.exe`, `RELEASES`, the full `.nupkg`, and an unsigned Authenticode state, then writes a local SHA-256 manifest tied to the source commit. The installer script never publishes, tags, dews, or invokes signing.

The repository keeps genuine hidden-desktop captures for the catalog, installed, updates, documentation, activity, settings, appearance settings, command palette, and tab-action surfaces. The documentation generator supplies a reproducible count and exact synchronized-output check rather than relying on a manual file list.

## Configuration

Run `npm run docs:check` for documentation coverage, `npm test` for focused root tests, `npm run check` for the combined documentation/type/test/workspace check, `npm run build` for renderer/main/preload output, `build.bat /s` for the fresh-machine local build path, `build-installer.bat /s` for the unsigned Squirrel installer path, and the project's sanctioned hidden-desktop harness for interactive Windows evidence. Record the exact command, revision, test count, artifact, and external run URL.

## Failure modes

Missing dependencies, stale generated docs, a failed link, type failure, test failure, build failure, unavailable headless route, absent package, cancelled or superseded workflow, missing release asset, unsigned-state mismatch, or feed 404 remains a named boundary. Mockups, source screenshots, queued runs, and static assertions cannot substitute for a real packaged state. A cloud workflow does not claim tests or lint ran; those results belong to the local verification record.

## Security considerations

Evidence excludes credentials, tokens, private paths, user data, and unredacted process environments. Public records use ordinary project language. External state is verified with `git` and `gh` against exact refs; a local commit alone is not proof that the hui or release contains it.

## Verification

The current production build was launched on the sanctioned hidden Windows desktop and captured through window-level background screenshots without touching the visible desktop. The fresh gallery under `docs/assets/screenshots/final-*.png` covers Catalog, Installed, Updates, Documentation, Activity, Settings, Appearance, command palette, and tab actions. It proves those rendered surfaces for this build, while still not claiming a new installer, successful self-update, deployment, per-app clean-machine install, or destructive removal.

## Suggested articles

- [Catalog discovery](Catalog-Discovery)
- [Offline documentation browser](Offline-Documentation-Browser)
- [App Store self-updater](App-Store-Self-Updater)
