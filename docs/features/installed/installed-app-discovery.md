---
id: installed-app-discovery
title: Installed app discovery
titleYue: 已安裝 App 偵測
category: installed
status: shipped
summary: Reconciles App Store records with exact reviewed registry identities and the managed portable directory, then derives uninstall authority afresh.
---
# Installed app discovery

## Behaviour

Discovery runs during startup and whenever the renderer requests the installed list. It queries the standard per-user, machine, and 32-bit-on-64-bit uninstall registry keys, then revalidates only records previously installed and owned by this App Store. MSI and jpackage records require the same exact registry key and full fingerprint plus a canonical product code. Squirrel, NSIS, and Mozilla NSIS records additionally require an adapter-approved uninstaller basename beneath an allowlisted local-app-data or Program Files root. Portable applications require the recorded adapter/root and expected executable inside the App Store's exact managed directory. Manual or upstream installations are intentionally not claimed as managed and do not appear in the Installed tab.

## Configuration

No folder scan, registry identity, package family, uninstaller basename, root, or argument is user-editable. `src/main/install-adapters.ts` owns those values. Immediately before an executable installer starts, the App Store captures a complete fail-closed snapshot of all reviewed registry hives. After exit zero another complete snapshot must contain exactly one new or changed matching entry; the App Store stores that exact key plus a SHA-256 fingerprint of its full identity. Later uninstall authority exists only when the same key and fingerprint still match. Catalog release discovery never reads the persisted installed file directly, so a stale record cannot make an unverified Install/Uninstall action appear.

## Failure modes

During routine list refresh, a failed or oversized registry-hive query contributes no entries for that hive, so its records disappear from the actionable Installed view rather than remaining stale. Their ownership metadata is retained privately and can recover on the next healthy refresh; it is not bridged to the renderer while unverified. Portable records remain independently verifiable. During pre/post installation ownership capture and immediately before uninstall, any missing, timed-out, failed, or oversized hive query fails the whole authority check closed. Missing approved uninstallers, inaccessible version folders, malformed or unquoted executable commands, invalid MSI product codes, paths outside approved roots, malformed persisted ownership, and missing managed executables are treated as no supported detection.

## Security considerations

Display names and safe roots are discovery hints, not ownership. Store ownership additionally requires the exact before/after registry key and fingerprint created or changed by that installation. Executable uninstallers must have an approved basename, be safely delimited in the command string, and resolve beneath local application data or Program Files; Squirrel is narrower and remains below local application data. MSI discovery extracts only a canonical GUID. Portable ownership records the exact adapter ID and app-owned root. Renderer code receives typed records but no ability to submit a discovery path or registry command.

## Verification

Focused tests cover complete-versus-best-effort registry collection, failed-hive ownership retention/recovery routing, output with multiple records, missing display names, exact name aliases, canonical and hostile MSI strings, safely delimited executables, root and basename rejection, registry fingerprint mutation, same-version identity reuse, Squirrel traversal rejection, and latest version-folder selection. Update-state tests cover outdated, current, and absent verified records and prove stale cached versions are cleared. Static contract checks cover the before/after changed-entry gate, shared per-app install/uninstall locking, and the requirement for exactly one match. The 24-ID adapter coverage test proves every installable row names the same supported adapter that discovery consumes. The packaged Installed capture at `docs/assets/screenshots/installed-runtime.png` predates the expanded adapter matrix and is not runtime proof for the 21 new routes.

## Suggested articles

- [Protected uninstall](../installation/uninstall.md)
- [Activity history and export](activity-history.md)
- [Privacy and security](../security/privacy-and-security.md)
