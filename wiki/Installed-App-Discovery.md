# Installed app discovery

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

Discovery runs during startup and whenever the renderer requests the installed list. It queries the standard per-user, machine, and 32-bit-on-64-bit uninstall registry keys. A complete registry snapshot can surface exactly one external install whose display name, package family, product code or approved uninstaller basename, and allowlisted root match the reviewed per-application adapter. That record is typed as `discovery-only`, appears in Installed and version comparison, and is labelled **Detected outside App Store**. Its path is not bridged to the renderer, it is not written into the ownership store, and install, update, and uninstall actions remain unavailable.

Previously App Store-managed records still require the same exact registry key and full fingerprint before any privileged action is enabled. Portable applications require the recorded adapter/root and expected executable inside the App Store's exact managed directory; an unrecorded portable directory is not adopted. The App Store therefore reports an upstream installation without claiming that it installed or owns it.

## Configuration

No folder scan, registry identity, package family, uninstaller basename, root, or argument is user-editable. `src/main/install-adapters.ts` owns those values. Immediately before an executable installer starts, the App Store captures a complete fail-closed snapshot of all reviewed registry hives. After exit zero another complete snapshot must contain exactly one new or changed matching entry; the App Store stores that exact key plus a SHA-256 fingerprint of its full identity. Later uninstall authority exists only when the same key and fingerprint still match. Catalog release discovery never reads the persisted installed file directly, so a stale record cannot make an unverified Install/Uninstall action appear.

## Failure modes

During routine list refresh, a failed or oversized registry-hive query contributes no entries for that hive. Discovery-only matching is disabled for the whole snapshot because an unseen duplicate could make the identity ambiguous. An owned record in the failed hive disappears from the actionable Installed view while its private ownership metadata is retained for recovery; portable records remain independently verifiable. During pre/post installation ownership capture and immediately before uninstall, any missing, timed-out, failed, or oversized hive query fails the whole authority check closed. Zero or multiple matching external entries, missing approved uninstallers, inaccessible version folders, malformed or unquoted executable commands, invalid MSI product codes, paths outside approved roots, malformed persisted ownership, and missing managed executables produce no discovery record.

## Security considerations

Display names and safe roots are discovery hints, never ownership. A discovery-only record always carries `ownership: null`, `uninstall: null`, and a null renderer-visible install root. Store ownership additionally requires the exact before/after registry key and fingerprint created or changed by an App Store installation. Executable uninstallers must have an approved basename, be safely delimited in the command string, exist on disk, and resolve beneath local application data or Program Files; Squirrel is narrower and remains below local application data. MSI discovery extracts only a canonical GUID. Portable ownership records the exact adapter ID and app-owned root. Renderer code receives typed source/management state but no ability to submit a discovery path, registry command, executable, or argument.

## Verification

Focused tests cover discovery without a prior ownership record, non-persistence of external detections, null privileged lookup, incomplete-hive refusal, ambiguous-match refusal, typed management classification, complete-versus-best-effort registry collection, failed-hive ownership retention/recovery routing, missing display names, exact name aliases, canonical and hostile MSI strings, safely delimited executables, root and basename rejection, registry fingerprint mutation, same-version identity reuse, Squirrel traversal rejection, and latest version-folder selection. UI contract tests require the external-install label and prove single/bulk install, update, and uninstall routes are gated by `store-managed`. The packaged Installed capture at `docs/assets/screenshots/installed-runtime.png` predates this discovery-only surface and is not visual proof for it.

## Suggested articles

- [Launch installed applications](Launch-Installed-Applications)
- [Protected uninstall](Uninstall)
- [Activity history and export](Activity-History)
- [Privacy and security](Privacy-and-Security)
