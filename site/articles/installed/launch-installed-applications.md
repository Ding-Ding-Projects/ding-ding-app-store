---
id: launch-installed-applications
title: Launch installed applications
titleYue: 啟動已安裝應用程式
category: installed
status: limited
summary: Starts an App Store-managed application through its exact reviewed executable identity without accepting renderer-supplied paths, commands, or arguments.
---
# Launch installed applications

## Behaviour

An App Store-managed catalog card exposes **Launch** only when the catalog row is proof-verified and its hand-written adapter contains a reviewed installed executable identity. The Installed page also supports selecting several eligible applications and launching them serially. The command palette adds a direct **Launch <application>** command only for the same currently managed and eligible records, so it cannot bypass the card's ownership boundary. Reinstall and uninstall remain separate actions. An installed application whose adapter has no proven launch identity shows a disabled **Launch unavailable** control with the reason instead of guessing from its display name.

The renderer submits only `{ appId, decision: "launch" }`. The preload bridge and main-process handler preserve that two-field request. The main process re-resolves the catalog row, proof status, current installed record, exact ownership record, adapter ID, install root, and executable immediately before every start. Discovery-only installations remain visible but cannot be launched because the App Store does not own their path or lifecycle identity.

Portable applications launch only the adapter's exact relative executable inside the App Store-owned portable directory. Registry-owned installers launch only an exact reviewed basename or relative path beneath the revalidated install root. Squirrel applications resolve the executable from the observed `app-<version>` directory. Nested reviewed paths, such as `program/soffice.exe`, are explicit adapter data. The resolver rejects missing, empty, ambiguous, linked, escaped, or non-allowlisted targets.

The target process starts detached with no shell, no arguments, hidden console chrome, ignored standard streams, and its working directory set to the executable's own directory. The call completes when Windows accepts the process start; it does not wait for a normal desktop application to exit. The result states that the start request was accepted while keeping application-window readiness as a separate runtime fact.

## Configuration

Launch identities are source-controlled in `src/main/install-adapters.ts`. They are never editable catalog text and never renderer input. A registry adapter may declare exact launch basenames, exact relative paths, or neither. Portable adapters already declare one exact executable-relative path. `launchAvailable` is recomputed from the current proof status and adapter metadata whenever catalog state is projected, including old cache files.

Changing a display name, language, theme, or application card does not change the executable identity. Adding a new launch route requires first-party source or published-package evidence that names the installed executable and layout. A product name, installer asset name, shortcut label, or plausible default is not sufficient.

## Failure modes

A malformed request, unknown renderer, blocked proof status, concurrent install/update/uninstall, discovery-only record, stale ownership fingerprint, mismatched adapter ID, missing install root, unproven launch identity, missing or multiple matching executable, path escape, symbolic link or junction, empty/non-file target, access failure, spawn error, or unconfirmed two-second process start produces a non-blocking failure notification and Activity entry. Error text never exposes the resolved executable path.

An accepted process start does not claim that the target window rendered, became interactive, remained alive, or loaded the expected version. Those are built-artifact interaction facts. A single-instance application may accept the start request by activating an existing process and then exit its short-lived launcher; that remains distinct from window-readiness proof.

## Security considerations

The renderer cannot submit an executable, directory, command, argument, environment value, URL, process ID, or shell fragment. The privileged boundary uses only the reviewed catalog ID and adapter metadata. Ownership is revalidated before launch, candidate paths must remain beneath both lexical and resolved roots, link components are rejected, and exactly one non-empty regular executable must match. The launcher uses `shell: false`, `detached: true`, `stdio: "ignore"`, and no arguments.

The launch control remains unavailable for proof-blocked rows and discovery-only installs. Installing an unrelated executable with a similar display name does not grant launch authority.

## Verification

The typed contract is in `src/shared/contracts.ts`; preload and IPC registration are in `src/preload/index.ts` and `src/main/main.ts`; target resolution and detached process start are in `src/main/app-launch-service.ts`; adapter identities are in `src/main/install-adapters.ts`; and the visible singular/bulk controls are in `src/renderer/pages/AppsPage.tsx` and `src/renderer/App.tsx`.

Focused tests cover strict two-field requests, proof and busy rejection, portable ownership, Squirrel version-directory selection, nested MSI paths, lexical and resolved containment, linked-path rejection, exact executable allowlists, detached shell-free spawn options, spawn errors, bounded unconfirmed starts, sanitized result text, Activity recording, card and command-palette visibility, and deliberate removal of each bridge marker. TypeScript checks cover the complete main, preload, and renderer types. Real packaged target launch and target-window readiness still require the approved hidden-desktop interaction proof; source and unit-test results do not supply that evidence.

## Suggested articles

- [Installed app discovery](installed-app-discovery.md)
- [Per-app update checker](../updates/per-app-update-checker.md)
- [Verified installer operations](../installation/verified-installer-operations.md)
- [Verification and evidence](../verification/verification.md)
