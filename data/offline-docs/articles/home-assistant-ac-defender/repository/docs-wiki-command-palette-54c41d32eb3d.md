---
title: "Command palette"
---

# Command palette

AC Defender exposes a keyboard-first command palette from every signed-in page.
Press **Ctrl+Shift+F** (or the platform-equivalent modifier) or activate **COMMANDS** in the
header. The palette searches local command labels and descriptions, supports
Up/Down selection and Enter activation, and closes with Escape. It navigates to
the same real pages as the rail, so no command creates simulated thermostat
state or bypasses the existing authorization and safety gates.

## Configuration and accessibility

The palette is an in-app, non-networked overlay. It traps focus while open,
returns focus to the launching control when dismissed, provides an accessible
dialog name, and remains scrollable on narrow screens. Search is deliberately
plain-text-first; no query leaves the browser or is persisted.

## Failure modes and verification

If a destination is unavailable, the normal route and authorization handling
remain in force. The feature was verified with `dotnet build
HomeAssistantAcDefender.csproj --disable-build-servers` (0 warnings, 0 errors).
When a browser circuit disconnects during navigation, listener cleanup is
best-effort: the local handle is still disposed and the disconnect is not
surfaced as a server-side circuit error.

## Security

The palette only issues client-side navigation to existing routes. It does not
expose tokens, Home Assistant state, or command payloads and does not add a new
thermostat control path.

## Suggested articles

- Settings repository — local Git-backed settings history.
- API — authenticated real-device endpoints.
- Website tour — the full navigation map.

## Failure modes

If **Command palette** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Verification

Verify the shipped behavior at the feature's live page or endpoint, then run the repository's documented build and test commands. Confirm the real-input and real-error paths, keyboard access, reduced-motion behavior, and a 390 px viewport without horizontal overflow. Record the exact commit and workflow result when publishing a release; a static screenshot alone is not proof of a live Home Assistant command.
