# Updates and schedules

Catalog comparisons, the App Store updater, repeat checks, and quiet hours.

## Articles

- [Per-app update checker](./per-app-update-checker.md) — Compares installed versions with stable releases and lets a user download, verify, cancel, and explicitly install a staged per-app update.
- [App Store self-updater](./app-store-self-updater.md) — Runs a bounded unsigned Squirrel RELEASES state machine with package-integrity metadata, user-started downloads, recoverable failures, and an explicit restart action.
- [Update schedule](./update-schedule.md) — Runs one unavoidable startup self-check plus bounded repeat self-check and catalog-refresh timers with explicit history, backoff, and quiet-hour semantics.
