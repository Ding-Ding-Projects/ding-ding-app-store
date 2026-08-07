# Per-app update checker

## Behaviour

Each installed catalog app has a non-blocking update check that compares its known installed version with the verified release feed for that specific app. The result is current, update available, unavailable, or failed; it never blocks browsing or installation work.

## Configuration

Checks occur at bounded startup/background intervals and on a manual `Check for updates` action. The app shows the source, latest version, release notes link, and unsigned-artifact warning before an install/restart choice. Per-app schedules and notifications use persisted local preferences.

## Failure modes

Offline state, malformed metadata, hash mismatch, missing release, unsupported updater, cancellation, and rate limiting retain the last known good state with a timestamp. A failed lookup does not masquerade as “up to date.”

## Security considerations

Feeds use validated HTTPS endpoints and bounded response parsing. Update metadata is allowlisted, redirects and embedded credentials are rejected, and an available update is not trusted until the selected asset’s integrity metadata is verified.

## Verification

The docs and site describe the checker state machine. Feed access, scheduler behaviour, asset validation, and visual notifications await application implementation and runtime tests.

## Suggested articles

See [App Store self-updater](app-store-self-updater.md) for updates to this application and [verified installer operations](verified-installer-operations.md) for verified artifact handling.
