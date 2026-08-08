---
layout: doc
title: "Cooling Failure Watch"
description: "Raises a repeating MEGA alert when cool mode is demanded but the AC is not really cooling, escalates to a full-site OMEGA alert when a rising room confirms it, then turns the AC off only for that confirmed failure until the room warms 0.5 C."
---

Safety, Energy, and System algorithm

# Cooling Failure Watch


  
    Raises a repeating MEGA alert when cool mode is demanded but the AC is not really cooling, escalates to a full-site OMEGA alert when a rising room confirms it, then turns the AC off only for that confirmed failure until the room warms 0.5 C.
    These algorithms keep the product honest: real Home Assistant commands, real errors, real weather or usage data, and safety-first fallbacks whenever comfort or equipment protection matters.
    Back to all algorithms See it on the logic page
  
  
  
  
  1Watch
  2Decide
  3Act
  



*Image or external asset omitted from the offline bundle.*

## The short version

Raises a repeating MEGA alert when cool mode is demanded but the AC is not really cooling, escalates to a full-site OMEGA alert when a rising room confirms it, then turns the AC off only for that confirmed failure until the room warms 0.5 C.

## What it watches

Real Home Assistant data only: hvac_mode, hvac_action, the setpoint, and room-temperature history.

## How it decides

MEGA: it alerts if the entity is in cool, the room is clearly above the setpoint, and the action stays idle for about 30 minutes (possible breaker/equipment), or if the action says cooling but the room does not drop over the retained window (possible compressor/airflow). OMEGA: while the idle/breaker MEGA alert is up, if the room has also risen at least 0.4 C over the last 5 minutes — what a dead breaker looks like — it escalates to a full-site OMEGA alert. MEGA remains advisory; only OMEGA's independent room-rise evidence authorizes an automatic OFF. Requiring a real, sustained rise keeps false positives down. Alerts repeat about once a minute.

## What it changes

Surfaces a red alert and an event log entry, plus a site-wide overlay on OMEGA. Only a confirmed OMEGA failure turns the AC fully off and holds it off until the real room temperature rises 0.5 C above the reading captured at shutdown, then restores cool. A human turning the AC back on is respected for the rest of that failure episode, so a stale alert cannot repeatedly stop the unit.

## Safety boundaries

- Uses the real inputs listed above. It does not invent thermostat, weather, usage, or sensor state.
- Changes only the output listed above. Thermostat-affecting work goes through Home Assistant or returns a real error.
- The global AC Defender rules still apply: the website target remains the floor for cooling commands, the worker keeps refreshing real Home Assistant state 24/7, and comfort/safety rules are not bypassed by decorative timing.

## Settings

CoolingFailureWatchEnabled

## Where to see it

- **Defense page:** live card with state, verdict, evidence, and metrics.
- **Guide page:** generated from the same guard catalog entry.
- **Source:** `Guards/GuardCatalog.cs` describes this page; the implementation is coordinated by `Services/DefenderStateStore.cs` and `Services/AcDefenderService.cs`.

## Failure modes

If **Cooling Failure Watch** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Verification

Verify the shipped behavior at the feature's live page or endpoint, then run the repository's documented build and test commands. Confirm the real-input and real-error paths, keyboard access, reduced-motion behavior, and a 390 px viewport without horizontal overflow. Record the exact commit and workflow result when publishing a release; a static screenshot alone is not proof of a live Home Assistant command.
## Suggested articles

- Feature briefs — find every documented surface and guard.
- Defender Logic — follow the complete decision cycle and its bypass rules.
- Settings — inspect persisted configuration, language modes, and safety limits.
