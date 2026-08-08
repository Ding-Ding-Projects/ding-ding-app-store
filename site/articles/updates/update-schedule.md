---
id: update-schedule
title: Update schedule
titleYue: 更新排程
category: updates
status: shipped
summary: Runs one unavoidable startup self-check plus bounded repeat self-check and catalog-refresh timers with explicit history, backoff, and quiet-hour semantics.
---
# Update schedule

## Behaviour

The scheduler owns two independent tasks: App Store self-update checks and catalog refresh. A self-check runs once after every launch and cannot be turned off; its repeat switch controls only later checks in that session. Catalog refresh can be enabled separately and is floored at the 30-minute catalog cache lifetime. Each task shows last run, trigger, outcome, exact message, next run, running state, and backoff state. Manual `Check now` and `Refresh now` use the same task functions.

Quiet hours never delay work. They hold corner notifications, keep the update banner live, count held notices, and emit one summary after quiet hours end. Timers are drift-safe single timeouts rather than polling intervals.

## Configuration

Settings → Schedule is a browser-style sub-tab with its own search and full regex builder. Self-update intervals range from 60 to 10,080 minutes; catalog intervals range from 30 to 10,080. Quiet hours use local minute-of-day values, may wrap midnight, and must span at least 15 minutes. The editor shows the resolved time zone and daylight-saving behavior. Save is the only operation that validates, persists, and re-arms timers; discard and reset are explicit.

Every schedule control has a progressive explanation and provenance line. A validated `schedule.v1.json` value is labelled persisted; a missing or malformed file is labelled compiled fallback with the exact shipped value (`true`, `360 minutes`, `false`, `22:00`, `07:00`, or `0 rules`). Unsaved edits are labelled drafts until Save succeeds. This metadata is held in a hand-written list that fails completeness checks when a schedule field is missing an explanation or fallback.

The same editor stores up to 32 versioned scheduled-setting rules. A rule can temporarily override language mode, either funny-level slider, theme, density, accent, or display name; it carries a stable id, label, priority, optional ISO start/end dates, start/end times, an explicit weekday set, and an IANA time zone. Every-day means all seven weekdays. Cross-midnight windows are evaluated as one continuous window, and matching rules resolve by ascending priority then id. The base settings remain untouched and are restored automatically when no rule matches. Schema v1 and v2 files migrate to schema v3 without losing their local rules.

Each rule has a local value plus an optional external source. A versioned HTTPS API must return a bounded JSON document shaped as `{ "version": 1, "settings": { ... } }`; only the seven supported scheduled fields are accepted. A Home Assistant source reads one `input_boolean` or `binary_sensor`: `on` activates that rule's local value and `off` leaves it inactive. The main process refreshes active external sources at activation, after schedule saves, and at a bounded five-minute interval. It aborts a superseded request and ignores an older response that arrives after a newer refresh. The editor shows an accessible, localized per-rule source state without echoing URLs, entity values, or credentials. The Schedule sub-tab already has its own plain-text-first search and adjacent full regex builder; no detached search state is introduced for sources.

## Failure modes

Invalid bounds, source URLs, entity identifiers, version values, oversized responses, redirects, and quiet-hour spans are rejected per field by the main process. Failed tasks retain their exact message and use capped exponential backoff. A catalog cache fallback is recorded as failed. An offline/malformed external source, a missing Home Assistant vault token, or Home Assistant `off` never overwrites a base setting: the rule falls back to its local scheduled value or remains inactive. Clock jumps, resume from sleep, concurrent manual clicks, and stale timer generations are guarded. When a task is already running, another run returns that state instead of duplicating work.

## Security considerations

The renderer sends only a typed schedule document or task identifier. It never fetches external settings and never supplies commands, paths, or installer arguments. API sources require public HTTPS without embedded credentials or fragments, reject redirects, time out after eight seconds, and cap bodies at 32 KB. Home Assistant accepts public HTTPS only: loopback, private IPv4, local hostnames, IPv6 loopback, ULA, link-local, and IPv4-mapped private/loopback hosts are rejected by both the persisted schema and the main-process resolver before it reads or sends the vault bearer token. The resolver examines every A/AAAA answer and rejects the entire host when any address is private or loopback; production requests are pinned to an approved address with the original HTTPS host retained for TLS identity validation, so a second DNS lookup cannot rebind the request. The sole development exception is a literal `http://127.0.0.1` base URL; `localhost`, IPv6 loopback, and shorthand/numeric IPv4 forms are not accepted. The bearer token is read only by the main process from Electron safeStorage (Windows DPAPI), is never saved in `schedule.v1.json`, emitted through IPC, copied to history, or shown in status. Configuration and run records live in separate versioned app-owned JSON files. Settings rules are validated in the main process before persistence; malformed dates, duplicate weekdays, empty value sets, invalid source documents, and equal start/end values are rejected without replacing the last valid schedule.

## Verification

Focused tests cover schema bounds, v2-to-v3 local-rule migration, valid/invalid/offline API results, response validation, Home Assistant on/off/missing-token behavior, private/loopback IPv4 and IPv6 source rejection, runtime revalidation and A/AAAA rejection before vault-token access, stale refresh rejection, cross-midnight and date/weekday resolution, the absence of polling timers, startup routing, updater separation, cache-fallback failure, and settings/schedule explanation completeness. Type check and build cover renderer/main integration. A long-duration wall-clock soak, real credential-vault provisioning, live Home Assistant traffic, and successful packaged self-update remain outside this article's proof.

## Suggested articles

- [App Store self-updater](app-store-self-updater.md)
- [Catalog discovery](../discovery/catalog-discovery.md)
- [Notifications and operation status](../experience/notifications-and-status.md)
- [Dim-sum startup surprise](../experience/dim-sum-surprise.md)
