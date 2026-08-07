# App Store self-updater

## Behaviour

The App Store checks its own signed-status-labelled HTTPS release feed on startup and a bounded background schedule. A ready update appears as a persistent, non-blocking banner with the exact version, release-note link, an unsigned-artifact warning, `Restart to install update`, and `Later` actions.

## Configuration

Automatic checking is enabled by default; the settings surface also offers a manual check. Downloading occurs in the background, while restart remains a deliberate user action and observes unsaved-work protection. The configured feed is an identity constant, not affected by a user-facing display-name change.

## Failure modes

Offline operation, invalid feed metadata, corrupt asset, hash mismatch, cancelled download, failed staging, rollback, and blocked restart yield truthful update states and recovery actions. The UI never leaves a permanent spinner or claims a restart completed before it has.

## Security considerations

The updater validates HTTPS metadata and package hashes but does not claim code signing; release artifacts are explicitly unsigned. Credentials never enter renderer code, release assets, exports, or history.

## Verification

No updater feed, package, or restart has been exercised by this docs lane. This is a documented contract, not release/runtime proof.

## Suggested articles

Read [per-app update checker](per-app-update-checker.md) for catalog application updates and [verification](verification.md) for evidence boundaries.
