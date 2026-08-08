---
id: per-app-update-checker
title: Per-app update checker
titleYue: 每個 App 更新檢查
category: updates
status: limited
summary: Compares each discovered version with the latest stable catalog release whenever catalog metadata refreshes; it does not yet download app updates.
---
# Per-app update checker

## Behaviour

For each catalog app, the catalog service compares a discovered installed version with the latest stable release tag using semantic-version coercion. Cards report `available`, `up-to-date`, `failed`, `unknown`, or `unsupported`; the Updates tab shows only `available` cards. Comparisons refresh when the catalog refreshes, either manually, at startup/cache expiry, or through its schedule.

This revision does not have a separate per-app background downloader, staged update state, release-note confirmation, or update-specific install button. Reinstall uses the ordinary installer path. The article is **limited** so the existence of an Updates tab is never read as automatic app updating.

## Configuration

The catalog-refresh schedule controls when version metadata is refreshed. Users can refresh now and can search the Updates tab with its own plain-text field and adjacent regex builder. There are no per-app notification, channel, or update interval settings in the current schema.

## Failure modes

No installed version yields `unknown` when a release exists. No latest release yields `unsupported`. A version that cannot be coerced yields `failed`. Network or metadata failures follow catalog cache behavior; a cached snapshot retains the older comparison and carries a warning rather than claiming a fresh check.

## Security considerations

Version comparison never starts an installer. Latest releases are restricted to allowlisted public repositories and parsed through the release schema. Any later update still has to pass the same adapter, asset cardinality, HTTPS, size, and SHA-256 validation as an ordinary install.

## Verification

The comparison code is in `src/main/catalog-service.ts`, and the Updates page scope is in `src/renderer/pages/AppsPage.tsx`. Tests and type checks can prove state wiring. No end-to-end third-party app update has been downloaded or installed in this docs lane.

## Suggested articles

- [Catalog discovery](../discovery/catalog-discovery.md)
- [App Store self-updater](app-store-self-updater.md)
- [Update schedule](update-schedule.md)
