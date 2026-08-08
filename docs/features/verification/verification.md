---
id: verification
title: Verification and evidence
titleYue: 驗證同證據
category: verification
status: shipped
summary: Separates source structure, focused tests, build, packaged runtime, hidden-desktop capture, workflow, release, and installer evidence.
---
# Verification and evidence

## Behaviour

Verification reports a specific revision and labels every evidence class independently: documentation completeness, static contracts, unit/integration tests, TypeScript/build, packaged application launch, hidden-desktop interaction, screenshot, installer execution, updater state, GitHub Actions run, release record, and public deployment. A stronger-looking proxy never upgrades a missing result.

The repository keeps genuine packaged captures for the catalog, installed, and activity surfaces. The documentation generator supplies a reproducible count and exact synchronized-output check rather than relying on a manual file list.

## Configuration

Run `npm run docs:check` for documentation coverage, `npm test` for focused root tests, `npm run check` for the combined documentation/type/test/workspace gate, `npm run build` for renderer/main/preload output, and the project's sanctioned hidden-desktop harness for interactive Windows evidence. Record the exact command, revision, test count, artifact, and external run URL.

## Failure modes

Missing dependencies, stale generated docs, a failed link, type failure, test failure, build failure, unavailable headless route, absent package, cancelled or superseded workflow, missing release asset, or feed 404 remains a named boundary. Mockups, source screenshots, queued runs, and static assertions cannot substitute for a real packaged state.

## Security considerations

Evidence excludes credentials, tokens, private paths, user data, and unredacted process environments. Public records use ordinary project language. External state is verified with `git` and `gh` against exact refs; a local commit alone is not proof that the hui or release contains it.

## Verification

The prior packaged Windows x64 run rendered the catalog and found/fixed a CommonJS updater import crash, missing preload bridge, and packaged catalog path. It also truthfully observed an update-feed HTTP 404 because no matching `RELEASES` asset existed then. This docs lane will run the documentation guard, focused tests, type check, and production build; it does not claim a new installer, successful self-update, deployment, or destructive removal.

## Suggested articles

- [Catalog discovery](../discovery/catalog-discovery.md)
- [Offline documentation browser](../documentation/offline-documentation-browser.md)
- [App Store self-updater](../updates/app-store-self-updater.md)
