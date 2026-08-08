# Update schedule

Two scheduled tasks run: the App Store self-update check and the catalog refresh. A self-update check runs once at every launch and cannot be turned off; the repeat switch only controls further checks while the app stays open. No scheduled path ever starts a download or an installer.

- Configuration: `schedule.v1.json` with run records in `schedule-runs.v1.json`. Self-update intervals 60 minutes to 7 days; catalog refresh floored at 30 minutes to match the catalog cache lifetime; quiet hours are minute-of-day values that may wrap midnight. Saving is the only thing that re-arms the timers.
- Honesty: quiet hours never block a check — only corner notifications are held, the update banner stays live, and held notices are summarised when the window closes. A cache-fallback refresh is reported as failed, and a development build says no update feed request was made.
- Failure: last run, exact failure message, next run, backoff, and the empty states "Not scheduled", "Running now", and "Retrying after N failed checks" are all shown as they are.
- Security: timers live in one main-process scheduler with a single unref'd timeout per task, a generation guard, one catch-up after sleep, and power-resume re-evaluation without polling. The renderer sends only the typed document and a task id.
- Verification: renderer typecheck, `npm run build`, and 54 tests pass. Packaged-runtime capture of a real scheduled run is pending.

Detailed source: `docs/features/update-schedule.md`.
