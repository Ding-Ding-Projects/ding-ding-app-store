---
layout: doc
title: "Remote Settling Guard"
description: "Gives repeated phone/Home Assistant or automation thermostat changes a quiet settling window before a safe answer-back."
---

Safety, Energy, and System algorithm

# Remote Settling Guard


  
    Gives repeated phone/Home Assistant or automation thermostat changes a quiet settling window before a safe answer-back.
    These algorithms keep the product honest: real Home Assistant commands, real errors, real weather or usage data, and safety-first fallbacks whenever comfort or equipment protection matters.
    Back to all algorithms See it on the logic page
  
  
  
  
  1Watch
  2Decide
  3Act
  



*Image or external asset omitted from the offline bundle.*

## The short version

Gives repeated phone/Home Assistant or automation thermostat changes a quiet settling window before a safe answer-back.

## What it watches

Home Assistant change source attribution, recent remote-style change count, room temperature, and the expected setpoint.

## How it decides

When Home Assistant context shows repeated user/phone or automation changes inside the configured window, and the room is still inside the safety band, it holds only safe corrections for the quiet hold minutes. A too-warm room, cooler intent, matching setpoint, disabled setting, or expired hold releases it immediately.

## What it changes

Delays only safe corrections after remote-style thermostat changes so the response does not look instant.

## Safety boundaries

- Uses the real inputs listed above. It does not invent thermostat, weather, usage, or sensor state.
- Changes only the output listed above. Thermostat-affecting work goes through Home Assistant or returns a real error.
- The global AC Defender rules still apply: the website target remains the floor for cooling commands, the worker keeps refreshing real Home Assistant state 24/7, and comfort/safety rules are not bypassed by decorative timing.

## Settings

RemoteSettlingGuardEnabledRemoteSettlingTriggerChangesRemoteSettlingWindowMinutesRemoteSettlingHoldMinutesRemoteSettlingSafetyBandCelsius

## Where to see it

- **Defense page:** live card with state, verdict, evidence, and metrics.
- **Guide page:** generated from the same guard catalog entry.
- **Source:** `Guards/GuardCatalog.cs` describes this page; the implementation is coordinated by `Services/DefenderStateStore.cs` and `Services/AcDefenderService.cs`.

## Failure modes

If **Remote Settling Guard** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Verification

Verify the shipped behavior at the feature's live page or endpoint, then run the repository's documented build and test commands. Confirm the real-input and real-error paths, keyboard access, reduced-motion behavior, and a 390 px viewport without horizontal overflow. Record the exact commit and workflow result when publishing a release; a static screenshot alone is not proof of a live Home Assistant command.
## Suggested articles

- Feature briefs — find every documented surface and guard.
- Defender Logic — follow the complete decision cycle and its bypass rules.
- Settings — inspect persisted configuration, language modes, and safety limits.
