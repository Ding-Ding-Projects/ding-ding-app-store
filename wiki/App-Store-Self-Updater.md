# App Store self-updater

The App Store checks a validated HTTPS feed and offers a persistent non-blocking ready state with version, notes, unsigned warning, restart, and later actions.

- Configuration: automatic bounded checks and manual check; restart is user-chosen.
- Failure: malformed feed, corrupt package, failed staging, cancellation, rollback, and blocked restart are explicit.
- Security: validates metadata and hashes; it does not claim code signing.
- Verification: no updater feed or restart was exercised in this docs lane.

Detailed source: `docs/features/app-store-self-updater.md`.
