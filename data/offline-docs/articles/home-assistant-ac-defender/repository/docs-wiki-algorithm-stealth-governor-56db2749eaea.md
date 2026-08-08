---
layout: doc
title: "Stealth Governor"
description: "Runs a whole-system low-profile hold when wall touches, noticed corrections, remote changes, and helper commands make the defender look too busy."
---

Wall-Touch Response algorithm

# Stealth Governor


  
    Runs a whole-system low-profile hold when wall touches, noticed corrections, remote changes, and helper commands make the defender look too busy.
    These algorithms exist for the exact household fight AC Defender is built for: someone keeps raising the thermostat, but the room still needs to come back to your temperature without starting a visible duel.
    Back to all algorithms See it on the logic page
  
  
  
  
  1Watch
  2Decide
  3Act
  



*Image or external asset omitted from the offline bundle.*

## The short version

Runs a whole-system low-profile hold when wall touches, noticed corrections, remote changes, and helper commands make the defender look too busy.

## What it watches

Recent wall-touch pressure, noticed-correction pressure, Home Assistant remote-change pressure, helper command count, and room temperature.

## How it decides

It computes a 0-100 pressure score. If the score reaches the trigger and the room is inside the safety band, it holds the next safe correction for a min-to-max low-profile window scaled by the score. Direct comfort needs, upstairs heat, or a quiet-timing bypass clear it.

## What it changes

Holds only safe corrections until the low-profile window ends.

## Safety boundaries

- Uses the real inputs listed above. It does not invent thermostat, weather, usage, or sensor state.
- Changes only the output listed above. Thermostat-affecting work goes through Home Assistant or returns a real error.
- The global AC Defender rules still apply: the website target remains the floor for cooling commands, the worker keeps refreshing real Home Assistant state 24/7, and comfort/safety rules are not bypassed by decorative timing.

## Settings

StealthGovernorEnabledStealthGovernorTriggerScoreStealthGovernorMinimumHoldMinutesStealthGovernorMaximumHoldMinutesStealthGovernorSafetyBandCelsius

## Where to see it

- **Defense page:** live card with state, verdict, evidence, and metrics.
- **Guide page:** generated from the same guard catalog entry.
- **Source:** `Guards/GuardCatalog.cs` describes this page; the implementation is coordinated by `Services/DefenderStateStore.cs` and `Services/AcDefenderService.cs`.

## Failure modes

If **Stealth Governor** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Verification

Verify the shipped behavior at the feature's live page or endpoint, then run the repository's documented build and test commands. Confirm the real-input and real-error paths, keyboard access, reduced-motion behavior, and a 390 px viewport without horizontal overflow. Record the exact commit and workflow result when publishing a release; a static screenshot alone is not proof of a live Home Assistant command.
## Suggested articles

- Feature briefs — find every documented surface and guard.
- Defender Logic — follow the complete decision cycle and its bypass rules.
- Settings — inspect persisted configuration, language modes, and safety limits.
