# Update schedule

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

The scheduler owns two independent tasks: App Store self-update checks and catalog refresh. A self-check runs once after every launch and cannot be turned off; its repeat switch controls only later checks in that session. Catalog refresh can be enabled separately and is floored at the 30-minute catalog cache lifetime. Each task shows last run, trigger, outcome, exact message, next run, running state, and backoff state. Manual `Check now` and `Refresh now` use the same task functions.

Quiet hours never delay work. They hold corner notifications, keep the update banner live, count held notices, and emit one summary after quiet hours end. Timers are drift-safe single timeouts rather than polling intervals.

## Configuration

Settings → Schedule is a browser-style sub-tab with its own search and full regex builder. Self-update intervals range from 60 to 10,080 minutes; catalog intervals range from 30 to 10,080. Quiet hours use local minute-of-day values, may wrap midnight, and must span at least 15 minutes. The editor shows the resolved time zone and daylight-saving behavior. Save is the only operation that validates, persists, and re-arms timers; discard and reset are explicit.

## Failure modes

Invalid bounds or quiet-hour spans are rejected per field by the main process. Failed tasks retain their exact message and use capped exponential backoff. A catalog cache fallback is recorded as failed. Clock jumps, resume from sleep, concurrent manual clicks, and stale timer generations are guarded. When a task is already running, another run returns that state instead of duplicating work.

## Security considerations

The renderer sends only a typed schedule document or task identifier. It never supplies update URLs, commands, paths, or installer arguments. Scheduled self-checks can discover an update but cannot download or restart it. Configuration and run records live in separate versioned app-owned JSON files.

## Verification

Focused tests cover schema bounds, quiet-hour spans, the absence of polling timers, startup routing, updater separation, and cache-fallback failure. Type check and build cover renderer/main integration. A long-duration wall-clock soak and successful packaged self-update remain outside this article's proof.

## Suggested articles

- [App Store self-updater](App-Store-Self-Updater)
- [Catalog discovery](Catalog-Discovery)
- [Notifications and operation status](Notifications-and-Status)
