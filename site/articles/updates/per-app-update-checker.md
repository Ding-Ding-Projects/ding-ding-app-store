---
id: per-app-update-checker
title: Per-app update checker
titleYue: 每個 App 更新檢查
category: updates
status: limited
summary: Compares installed versions with stable releases and lets a user download, verify, cancel, and explicitly install a staged per-app update.
---
# Per-app update checker

## Behaviour

For each catalog app, the catalog service compares a discovered installed version with the latest stable release tag using semantic-version coercion only after the typed row's proof status is `verified`. Cards report `available`, `up-to-date`, `failed`, `unknown`, `unsupported`, or `blocked`; the Updates tab shows only `available` cards. A `blocked-until-proof` row remains unavailable, names its clean-Windows proof target, and exposes no update action. Comparisons refresh when the catalog refreshes, either manually, at startup/cache expiry, or through its schedule.

An installed app with an available stable release exposes **Download update**. The main process re-resolves the allowlisted catalog record, stable release, exact adapter asset, and SHA-256 evidence before it starts a bounded HTTPS download. Progress is reported in bytes, and **Cancel** is available while bytes are still arriving. A verified artifact moves to an app-owned staging directory and persists as `ready`; discovery and download never launch an installer. The card then exposes the release-notes link and an explicit **Install update** action. The user is told to close the target application first. That action is the only path that launches the reviewed fixed adapter, and it records an update result in the append-only activity history. Portable updates replace their managed directory transactionally and roll back before the metadata commit if replacement fails. During archive extraction, the service uses Electron's unpatched filesystem for the app-owned output tree so a payload named `resources/app.asar` is preserved as data rather than interpreted as the App Store's own package; short-lived owned-directory locks are retried with bounded backoff before extraction begins.

Ordinary install/uninstall operations and managed-update installation share a main-process conflict boundary. A crafted IPC call cannot start the managed update installer while the same application has an install, launch, or uninstall operation active. After a successful external installer exit, changed registry ownership is rediscovered normally. If a Squirrel update leaves its uninstall registry entry byte-for-byte unchanged, the App Store accepts that existing owned fingerprint only when the installed `app-<version>` directory independently proves the requested release version. Installer exit code alone is never update success.

## Configuration

The catalog-refresh schedule controls when version metadata is refreshed. Users can refresh now and can search the Updates tab with its own plain-text field and adjacent regex builder. Per-app update checks are lazy when the Updates tab is opened; they never start downloads automatically. A staged artifact is retained under the app profile across a normal restart only after its size and digest are revalidated. There are no channel or per-app interval settings in the current schema.

## Failure modes

No installed version yields `unknown` when a release exists. No latest release yields `unsupported`. A version that cannot be coerced yields `failed`. A missing, unknown, or `blocked-until-proof` proof status yields `blocked` and never downloads or stages bytes. Network or metadata failures follow catalog cache behavior; a cached snapshot retains the older comparison and carries a warning rather than claiming a fresh check. Missing digest evidence, ambiguous assets, invalid redirects, size mismatches, hash mismatches, offline requests, cancellation, corrupted staged bytes, an active conflicting operation, non-zero installer exit, and failed post-install ownership/version discovery remain explicit `failed`, `cancelled`, or `offline` states. A transient lock on the App Store-owned extraction directory is retried only for `EACCES`, `EBUSY`, `ENOTEMPTY`, or `EPERM`; all other cleanup failures remain explicit failures. An unchanged owned registry entry whose installed directory still exposes the old version is rejected. A failed installation keeps the verified staged bytes for a deliberate retry; it never claims rollback for an external installer that may have changed the target application.

## Security considerations

Version comparison and download never start an installer. Latest releases are restricted to allowlisted public repositories and parsed through the release schema; the renderer supplies only an application ID and the closed `download-update`, `cancel-update`, or `install-update` decision. Update URLs, paths, arguments, package families, and digests are selected in the main process from the reviewed adapter map. Downloads reject credentials, non-HTTPS origins, unapproved redirects, oversized responses, and mismatched SHA-256 bytes. Installer processes are shell-free, hidden, bounded, and supplied a reduced environment. The unsigned-artifact warning is explicit; no code signature is requested or claimed.

## Verification

Comparison remains in `src/main/catalog-service.ts`; staged state, digest verification, cancellation, persistence, and adapter-specific installation are in `src/main/managed-update-service.ts`; ASAR-safe archive writing is in `src/main/safe-zip.ts`; installed ownership/version proof is in `src/main/installed-service.ts`; typed IPC is in `src/main/main.ts` and `src/preload/index.ts`; and the visible controls are in `src/renderer/pages/AppsPage.tsx` and `src/renderer/App.tsx`. Focused tests cover strict requests, allowlisted origins, digest evidence, progress/cancellation state, the explicit install boundary, shared-operation conflict checks, changed ownership, unchanged-fingerprint Squirrel version proof, tampered stages, update history, and transient owned-extraction cleanup locks. At source commit `23cc38b27fe9ad05dc7e95f96c8452e30428d667`, the approved hidden-desktop route installed a SHA-256-verified staged Dim Sum Atlas `v0.1.13` archive over `v0.1.12`, independently observed the new installed record, cleared the stage, and created the exact target process/window from the App Store's Launch action. The target window's Cheap Lowlevel capture remained black, so target rendered readiness, packaged-app interaction, clean-Windows/UAC behavior, and release-artifact interaction remain evidence to collect.

## Suggested articles

- [Catalog discovery](../discovery/catalog-discovery.md)
- [Launch installed applications](../installed/launch-installed-applications.md)
- [App Store self-updater](app-store-self-updater.md)
- [Update schedule](update-schedule.md)
