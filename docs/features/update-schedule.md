# Update schedule

## Behaviour

Two scheduled tasks exist: the App Store self-update check and the catalog refresh. A self-update check runs once at every launch and cannot be turned off; the repeat switch only controls further checks while the app stays open, and the editor says exactly that next to the switch. Neither scheduled path ever starts a download or an installer — discovery stays separate from installation.

The schedule editor shows, per task, the last run with its absolute and relative time, its trigger, whether it came from a previous session, its outcome pill, and on failure the exact message the main process produced. It shows the next run, or an honest empty state: not scheduled, running now, or retrying after a number of failed checks. "Check now" and "Refresh now" are disabled only while that task is running — never by quiet hours.

## Configuration

The schedule lives in `schedule.v1.json` with its run records in `schedule-runs.v1.json`. Self-update intervals run from 60 minutes to 7 days; catalog refresh is floored at 30 minutes because that is the catalog cache lifetime, and any successful refresh, manual included, restarts the countdown. Quiet hours are two minute-of-day values with a minimum 15-minute span, may wrap midnight, and are shown with the resolved time zone and a daylight-saving note. Preset chips, a custom numeric field with a live readout, and time inputs all edit the same draft; Save, Discard, and Reset to defaults sit in the footer, and saving is the only thing that re-arms the timers.

Every field and every toggle is also a command-palette entry, including interval presets, the 22:00–07:00 quiet-hours preset, and a command that reports the next scheduled run times.

## Failure modes

Quiet hours never gate execution: checks still run, only corner notifications are held, the update banner stays live, and held notices are summarised once the window closes. A failed run is recorded with its exact message and backs off, and the backoff is surfaced instead of a fake countdown. A cache-fallback catalog refresh is reported as a failure, never as a successful refresh. In a development build the self-update task reports that no update feed request was made. Renderer-side bounds are advisory only: the main process validates the configuration and the editor renders its rejection per field.

## Security considerations

The renderer sends only the typed schedule document and a task identifier; it never supplies URLs, commands, paths, or installer arguments. Timers live entirely in the main process in one drift-safe scheduler that owns a single unref'd timeout per task, cancels and re-arms with a generation guard, runs at most one catch-up after a sleep, re-anchors on a backwards clock jump, and re-evaluates on power resume without polling. No scheduled path can reach the auto-updater's download or restart.

## Verification

`npx tsc -p tsconfig.renderer.json --noEmit`, `npm run build`, and `npm run test` (54 tests) pass, including schema tests for interval bounds and quiet-hours spans, an assertion that the main process contains no `setInterval` and routes the startup check through the scheduler, an assertion that the scheduler never references the auto-updater, and an assertion that a warning-bearing catalog snapshot is reported as failed. Packaged-runtime capture of a real scheduled run is still pending.

## Suggested articles

Read [App Store self-updater](app-store-self-updater.md) for the state machine this schedule triggers, [catalog discovery](catalog-discovery.md) for the cache lifetime the refresh floor matches, and [tab navigation](tab-navigation.md) for the Updates badge.
