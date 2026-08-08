---
layout: doc
title: "Dim-sum startup surprise"
---

Startup delight · bounded and non-blocking

# Dim-sum startup surprise

The signed-in command page has a small, non-blocking delight: each app launch gets one fresh
10% draw. When the draw succeeds, the card shows one dish name, a bundled-safe public release
photo URL, and bilingual alt text. It never controls the thermostat, delays boot, steals focus,
or interrupts a real operation.

## What is shipped

The app keeps a deliberately small metadata cache for five records from the public
[dim-sum catalog](https://raw.githubusercontent.com/Ding-Ding-Projects/dim-sum-photos/main/catalog/index.json),
pinned to catalog revision `f77ea1169db0bfc17365414c44ff495a823c6823`. Each row was cross-checked
against a published `catalog-v1` PNG release asset. The image bytes are not copied into this
repository: the card points at the immutable public release asset, for example
[Classic Har Gow](https://github.com/Ding-Ding-Projects/dim-sum-photos/releases/download/catalog-v1/hk-dish-0001-classic-har-gow.png).

The metadata source and revision are constants in `Services/DimSumSurpriseService.cs`. If the
public catalog changes, refresh the cache from the source and re-check every release asset before
changing those constants. Do not add generated, downloaded, or locally copied photographs.

## Runtime behavior

1. The layout waits until the boot sequence reaches its final step. If the browser already
   completed the session boot animation, it treats boot as complete and performs the same check.
2. A layout instance marks its draw as attempted before evaluating the route, so a launch can
   never draw twice. The fresh draw uses 1000 buckets; buckets `0..99` are the exact 10% success
   range. A successful bucket selects one cached dish uniformly.
3. The card appears only on the signed-in command route (`/`), with no active cooling-failure
   alert. Login/first-run, error/update surfaces, other routes, and alert states are left alone.
4. The card is an anchored `role="status"` surface with a polite live region. It does not move
   focus. It has a keyboard-sized dismiss button, an accessible image alt text, and an explicit
   link to the public photo. It auto-dismisses after 12 seconds.
5. If the public image fails to load, the card is removed and an informational snackbar explains
   that no local fallback was used. The app never invents or substitutes a dim-sum image.
6. The card's surrounding sentence follows the persisted English/Cantonese funny-level sliders;
   the dish name and image alt text remain factual.

## Failure and security boundaries

- No Home Assistant command or state is touched by the surprise.
- No image request is made during login, first run, boot, or another route. The external image is
  a public immutable release asset; no account token or user data is sent.
- Offline or blocked image delivery is an ordinary best-effort miss: the card disappears and the
  user receives a non-blocking notice. There is no generated or vendored fallback.
- The bounded cache is not a second catalog authority. Its source URL, revision, release tag,
  bilingual names, and alt text must remain auditable against the public repository.

## Verification

The focused regression checks in `HomeAssistantAcDefender.Tests/DimSumSurpriseTests.cs` verify:

- source URL and exact catalog revision are recorded;
- every cached row has bilingual names/alt text and a published immutable `catalog-v1` PNG URL;
- the draw boundary is exactly 10%, deterministic at its edges, and selects the requested row;
- invalid random buckets are rejected rather than silently clamped.

For browser proof, start the app with the AC Defender run skill, sign in, and clear
`sessionStorage["ops-boot-done"]` in a test browser before reloading. The card should appear only
when a test draw succeeds; confirm keyboard focus remains where it was, the close button works,
the card auto-dismisses, and a blocked image removes the card without a fallback.

## Suggested articles

- App tabs — navigate between the command surface and other signed-in pages.
- Notification history — review notices after a card or image failure.
- Settings — change language mode and the two funny-level controls.
- Architecture — understand the layout lifecycle and live state pump.

## Failure modes

If **Dim-sum startup surprise** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
