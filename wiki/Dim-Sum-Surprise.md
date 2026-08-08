# Dim-sum startup surprise

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

After the first usable launch, the app makes one fresh random draw per launch. Ten percent of later launches show a corner card with a bilingual dish name and the corresponding published photo from the public `Ding-Ding-Projects/dim-sum-photos` catalog. The card is non-blocking, dismissible, auto-safe around focus, and never delays the catalog becoming usable. It is skipped on first run, while an update banner or error is active, and when the catalog is unavailable. The dish name remains factual while the surrounding copy follows the active language mode and funny-level settings.

## Configuration

There is no opt-out switch. The first-run marker is local browser state only; no account, tracking, or analytics value is sent. The main process fetches the public catalog index and its published `catalog-v1*` release inventory through bounded HTTPS requests, then returns one validated metadata record and the public photo URL. Consumer builds never copy, generate, vendor, or attach dim-sum image files.

## Failure modes

Offline operation, HTTP errors, malformed catalog data, missing photo assets, invalid redirects, or a timeout produce an honest no-photo result and leave the app fully usable. A broken image cannot gate startup; dismissing the card removes only that card. The draw never repeats within one launch.

## Security considerations

Only `raw.githubusercontent.com` and `api.github.com` over HTTPS are accepted. Responses are capped at 4 MB, redirected requests are rejected, and the renderer receives only typed dish metadata and an allowlisted public asset URL. No credentials, local paths, or remote commands enter the bridge.

## Verification

Unit coverage exercises published-asset selection, no-photo fallback, first-run suppression, update/error suppression, bilingual rendering, and CSP allowlisting. The production type check and build cover the preload, main-process service, renderer card, and schedule-rule integration. A live external catalog response and a packaged hidden-desktop capture remain runtime evidence to collect separately.

## Suggested articles

- [Update schedule](Update-Schedule)
- [Notifications and operation status](Notifications-and-Status)
- [Privacy and security](Privacy-and-Security)
