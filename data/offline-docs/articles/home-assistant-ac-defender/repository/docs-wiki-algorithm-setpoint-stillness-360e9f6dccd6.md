---
layout: doc
title: "Setpoint Stillness"
description: "Waits until the wall setpoint stops moving before a safe correction answers back."
---

Sensor Timing algorithm

# Setpoint Stillness


  
    Waits until the wall setpoint stops moving before a safe correction answers back.
    These algorithms make corrections land near real house signals instead of on a robotic beat, while still stepping aside when room comfort needs direct cooling.
    Back to all algorithms See it on the logic page
  
  
  
  
  1Watch
  2Decide
  3Act
  



*Image or external asset omitted from the offline bundle.*

## The short version

Waits until the wall setpoint stops moving before a safe correction answers back.

## What it watches

Real Home Assistant climate readings, the current reported setpoint, recent wall touches, and room temperature.

## How it decides

After repeated external touches, while the room is still inside the safe band, it requires a few consecutive real Home Assistant readings at the same wall setpoint before allowing a safe correction. If the room gets too warm, a cooler-intent fast lane is active, the expected setpoint is already reached, or the max hold expires, it steps aside.

## What it changes

Delays only safe corrections until the wall setpoint looks settled.

## Safety boundaries

- Uses the real inputs listed above. It does not invent thermostat, weather, usage, or sensor state.
- Changes only the output listed above. Thermostat-affecting work goes through Home Assistant or returns a real error.
- The global AC Defender rules still apply: the website target remains the floor for cooling commands, the worker keeps refreshing real Home Assistant state 24/7, and comfort/safety rules are not bypassed by decorative timing.

## Settings

SetpointStillnessGuardEnabledSetpointStillnessTriggerTouchesSetpointStillnessRequiredSamplesSetpointStillnessMaxHoldSecondsSetpointStillnessToleranceCelsiusSetpointStillnessSafetyBandCelsius

## Where to see it

- **Defense page:** live card with state, verdict, evidence, and metrics.
- **Guide page:** generated from the same guard catalog entry.
- **Source:** `Guards/GuardCatalog.cs` describes this page; the implementation is coordinated by `Services/DefenderStateStore.cs` and `Services/AcDefenderService.cs`.

## Failure modes

If **Setpoint Stillness** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Verification

Verify the shipped behavior at the feature's live page or endpoint, then run the repository's documented build and test commands. Confirm the real-input and real-error paths, keyboard access, reduced-motion behavior, and a 390 px viewport without horizontal overflow. Record the exact commit and workflow result when publishing a release; a static screenshot alone is not proof of a live Home Assistant command.
## Suggested articles

- Feature briefs — find every documented surface and guard.
- Defender Logic — follow the complete decision cycle and its bypass rules.
- Settings — inspect persisted configuration, language modes, and safety limits.
