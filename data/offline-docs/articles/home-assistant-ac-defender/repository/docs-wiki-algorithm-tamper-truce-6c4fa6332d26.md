---
layout: doc
title: "Tamper Truce"
description: "If the thermostat vanishes right after a correction exchange, assume a frustrated person detached it — stand down 2 hours instead of escalating."
---

Safety, Energy, and System algorithm

# Tamper Truce


  
    If the thermostat vanishes right after a correction exchange, assume a frustrated person detached it — stand down 2 hours instead of escalating.
    These algorithms keep the product honest: real Home Assistant commands, real errors, real weather or usage data, and safety-first fallbacks whenever comfort or equipment protection matters.
    Back to all algorithms See it on the logic page
  
  
  
  
  1Watch
  2Decide
  3Act
  



*Image or external asset omitted from the offline bundle.*

## The short version

If the thermostat vanishes right after a correction exchange, assume a frustrated person detached it — stand down 2 hours instead of escalating.

## What it watches

Home Assistant reachability, the last defender command time, and recent human touches.

## How it decides

A thermostat that becomes unreachable within 20 minutes of a defender command AND 45 minutes of a human touch looks exactly like someone pulling the unit off the wall (it really happened, twice). This is the ULTRA OMEGA ALERT — one tier above MEGA (not cooling) and OMEGA (breaker off). Instead of fighting harder, the defender enters a 2-hour emergency quiet named &#x27;Tamper truce&#x27; and says why. Normal outages without a preceding exchange are unaffected.

## What it changes

Raises the ULTRA OMEGA ALERT, activates a 2-hour stand-down, and records the tamper-truce event.

## Safety boundaries

- Uses the real inputs listed above. It does not invent thermostat, weather, usage, or sensor state.
- Changes only the output listed above. Thermostat-affecting work goes through Home Assistant or returns a real error.
- The global AC Defender rules still apply: the website target remains the floor for cooling commands, the worker keeps refreshing real Home Assistant state 24/7, and comfort/safety rules are not bypassed by decorative timing.

## Settings

(always on — fixed: 20 min command window / 45 min touch window / 2 h truce)

## Where to see it

- **Defense page:** guide-only reference entry.
- **Guide page:** generated from the same guard catalog entry.
- **Source:** `Guards/GuardCatalog.cs` describes this page; the implementation is coordinated by `Services/DefenderStateStore.cs` and `Services/AcDefenderService.cs`.

## Failure modes

If **Tamper Truce** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Verification

Verify the shipped behavior at the feature's live page or endpoint, then run the repository's documented build and test commands. Confirm the real-input and real-error paths, keyboard access, reduced-motion behavior, and a 390 px viewport without horizontal overflow. Record the exact commit and workflow result when publishing a release; a static screenshot alone is not proof of a live Home Assistant command.
## Suggested articles

- Feature briefs — find every documented surface and guard.
- Defender Logic — follow the complete decision cycle and its bypass rules.
- Settings — inspect persisted configuration, language modes, and safety limits.
