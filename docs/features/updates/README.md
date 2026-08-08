# Updates and schedules

Catalog comparisons, the App Store updater, repeat checks, and quiet hours.

## Articles

- [Per-app update checker](./per-app-update-checker.md) — Compares discovered versions with stable releases and lets a user download, verify, cancel, and explicitly restart to install a staged per-app update.
- [App Store self-updater](./app-store-self-updater.md) — Checks a bounded unsigned Squirrel RELEASES feed, separates availability from download, and restarts only after an explicit ready-state action.
- [Update schedule](./update-schedule.md) — Runs one unavoidable startup self-check plus bounded repeat self-check and catalog-refresh timers with explicit history, backoff, and quiet-hour semantics.
