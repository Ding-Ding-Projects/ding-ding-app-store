---
layout: doc
title: "App tabs"
---

# App tabs

The signed-in shell provides a browser-style **Open tabs** strip below the classification ribbon.

It complements the complete navigation rail and mobile navigation; it never removes a route from those surfaces.

Visiting a real page adds its tab to the local tab set, and returning to that page selects the
existing tab instead of creating a duplicate.

## Behavior and persistence

- Tabs use the real route hrefs (`/`, `/defense`, `/comfort`, `/energy`, `/logs`, `/controls`,
  `/settings`, `/repository`, `/guide`, `/wiki`, `/api-docs`, and `/changelog`).
- The tab order, pin state, and optional group name are stored in browser `localStorage` under
  `ac-defender-open-tabs`. The current payload is an array of `{ href, pinned, group }` records;
  the earlier string-array payload remains readable so an upgrade does not throw away a user's
  navigation layout. Invalid, duplicate, or unknown hrefs are discarded on load; `/` is always
  retained as the safe command tab, and the current route is always added.
- Pinning moves a route into a stable protected region at the front of the strip. The pin button
  is keyboard reachable and does not send a Home Assistant command. Grouping is a local label on
  the active route: type a short name in **Group active tab**, or clear it to ungroup. Group names
  are bounded to 48 characters and are presentation metadata only.
- Storage is a convenience only. If it is unavailable or malformed, the in-memory tab set starts
  from the command tab and the current route; no Home Assistant command or live state is changed.
- The horizontal viewport scrolls rather than clipping long tab sets. When navigation changes, the
  active tab is revealed inside that viewport.

## Accessibility and keyboard use

The strip is a `tablist`; each route is a named `tab` with `aria-selected`, `aria-controls`,
roving `tabindex`, and a visible focus ring. `ArrowLeft`/`ArrowRight` move between open tabs,
`Home`/`End` jump to the first/last tab, and Enter/Space activate the
focused route. The main route surface is the associated `tabpanel`. Hidden overflow remains
keyboard-reachable, and reduced-motion users do not receive animated scrolling.

## Failure and security considerations

Tab state contains only an allow-listed route path plus a bounded pin flag and group label; it never
stores Home Assistant tokens, climate readings, command payloads, or provider-authored content. A
broken local-storage value cannot redirect navigation outside the app's known routes. The rail
remains available if the tab strip fails to initialize, and route navigation never waits for Home
Assistant.

## Verification

1. Sign in and visit at least three rail pages. Confirm each appears once in **Open tabs** and the
   selected tab tracks the current route.
2. Reload the browser and confirm the tab membership/order survives.
3. At a 390 px viewport, open enough pages to overflow the strip. Confirm the viewport scrolls,
   the active tab is visible, and the document has no horizontal overflow.
4. Pin two tabs and confirm they stay together at the front after reload; assign and clear a group
   on two routes and confirm the labels survive reload without changing the defender snapshot.
5. Focus a tab and use Home, End, arrow keys, and Enter. Confirm
   `role=tablist`, `role=tab`, `aria-selected`, `aria-controls`, and `tabpanel` values remain truthful.

Suggested next steps: Command palette, Settings, and
Changelog.

## Failure modes

If **App tabs** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Suggested articles

- Feature briefs — find every documented surface and guard.
- Defender Logic — follow the complete decision cycle and its bypass rules.
- Settings — inspect persisted configuration, language modes, and safety limits.
