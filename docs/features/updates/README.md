# Updates and schedules

Catalog comparisons, the App Store updater, repeat checks, and quiet hours.

## Articles

- [Per-app update checker](./per-app-update-checker.md) — Compares each discovered version with the latest stable catalog release whenever catalog metadata refreshes; it does not yet download app updates.
- [App Store self-updater](./app-store-self-updater.md) — Runs a bounded unsigned Squirrel RELEASES state machine with package-integrity metadata, user-started downloads, recoverable failures, and an explicit restart action.
- [Update schedule](./update-schedule.md) — Runs one unavoidable startup self-check plus bounded repeat self-check and catalog-refresh timers with explicit history, backoff, and quiet-hour semantics.
