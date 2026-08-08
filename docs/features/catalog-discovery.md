# Catalog discovery

## Behaviour

The catalog presents Ding Ding Projects applications as searchable cards with name, summary, category, supported platform, published version, source location, and installer availability. Plain-text search is the default. Its adjacent regex builder can turn the same query into a bounded regular-expression search with explicit flags and validation. Filters and sorting never alter the catalog source; they only change the visible result set.

## Configuration

Choose a catalog source from the app’s approved project list, select platform and category filters, and optionally enable regex mode. The UI persists the last non-sensitive view preferences locally. A zero-result state names the active query and filters and offers a reset action.

## Failure modes

An unavailable catalog, malformed record, unsupported platform, invalid regex, or no matching application is reported as a non-blocking status with a recovery action. The app must not invent an installer URL or claim that a project is available when its record cannot be validated.

## Security considerations

Catalog records are data, not executable instructions. The catalog parser allowlists fields, bounds input size, rejects dangerous URL schemes, and treats displayed descriptions as untrusted text. Search evaluation is size- and time-bounded to reduce regex denial-of-service risk.

## Verification

Static documentation/site coverage is included in this docs lane. Runtime catalog fetching, filtering, and visual capture require the desktop application build and remain unverified here.

## Suggested articles

Continue with [verified installer operations](verified-installer-operations.md) before installing a discovered application, read [update schedule](update-schedule.md) for the scheduled refresh whose 30-minute floor matches this cache lifetime, or review [privacy and security](privacy-and-security.md) for trust boundaries.
