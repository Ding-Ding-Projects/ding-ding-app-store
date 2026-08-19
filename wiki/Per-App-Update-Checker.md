# Per-app update checker

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

For each catalog app, the catalog service compares a discovered installed version with the latest stable release tag using semantic-version coercion only after the typed row's proof status is `verified`. Cards report `available`, `up-to-date`, `failed`, `unknown`, `unsupported`, or `blocked`; the Updates tab shows only `available` cards. A `blocked-until-proof` row remains unavailable, names its clean-Windows proof target, and exposes no update action. Comparisons refresh when the catalog refreshes, either manually, at startup/cache expiry, or through its schedule.

An installed app with an available stable release exposes **Download update**. The main process re-resolves the allowlisted catalog record, stable release, exact adapter asset, and SHA-256 evidence before it starts a bounded HTTPS download. Progress is reported in bytes, and **Cancel** is available while bytes are still arriving. A verified artifact moves to an app-owned staging directory and persists as `ready`; discovery and download never launch an installer. The card then exposes the release-notes link and an explicit **Restart to install update** action. That action is the only path that launches the reviewed fixed adapter, and it records an update result in the append-only activity history. Portable updates replace their managed directory transactionally and roll back before the metadata commit if replacement fails.

## Configuration

The catalog-refresh schedule controls when version metadata is refreshed. Users can refresh now and can search the Updates tab with its own plain-text field and adjacent regex builder. Per-app update checks are lazy when the Updates tab is opened; they never start downloads automatically. A staged artifact is retained under the app profile across a normal restart only after its size and digest are revalidated. There are no channel or per-app interval settings in the current schema.

## Failure modes

No installed version yields `unknown` when a release exists. No latest release yields `unsupported`. A version that cannot be coerced yields `failed`. A missing, unknown, or `blocked-until-proof` proof status yields `blocked` and never downloads or stages bytes. Network or metadata failures follow catalog cache behavior; a cached snapshot retains the older comparison and carries a warning rather than claiming a fresh check. Missing digest evidence, ambiguous assets, invalid redirects, size mismatches, hash mismatches, offline requests, cancellation, corrupted staged bytes, non-zero installer exit, and failed post-install ownership discovery remain explicit `failed`, `cancelled`, or `offline` states. A failed installation keeps the verified staged bytes for a deliberate retry; it never claims rollback for an external installer that may have changed the target app.

## Security considerations

Version comparison and download never start an installer. Latest releases are restricted to allowlisted public repositories and parsed through the release schema; the renderer supplies only an application ID and a closed decision. Update URLs, paths, arguments, package families, and digests are selected in the main process from the reviewed adapter map. Downloads reject credentials, non-HTTPS origins, unapproved redirects, oversized responses, and mismatched SHA-256 bytes. Installer processes are shell-free, hidden, bounded, and supplied a reduced environment. The unsigned-artifact warning is explicit; no code signature is requested or claimed.

## Verification

Comparison remains in `src/main/catalog-service.ts`; staged state, digest verification, cancellation, persistence, and adapter-specific restart are in `src/main/managed-update-service.ts`; typed IPC is in `src/main/main.ts` and `src/preload/index.ts`; the visible controls are in `src/renderer/pages/AppsPage.tsx` and `src/renderer/App.tsx`. Contract tests cover strict requests, allowlisted origins, digest evidence, progress/cancellation state, staged restart boundaries, and update history. TypeScript and production builds compile the full bridge. No end-to-end third-party app update has been downloaded or installed in this lane; clean-Windows/UAC behavior and real target-app restart remain runtime evidence to collect.

## Suggested articles

- [Catalog discovery](Catalog-Discovery)
- [App Store self-updater](App-Store-Self-Updater)
- [Update schedule](Update-Schedule)
