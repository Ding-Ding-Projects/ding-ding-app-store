---
layout: doc
title: "Defender Logic"
description: "The searchable decision cycle and exact rule text for every AC Defender algorithm."
---

# Defender Logic

This page describes every algorithm AC Defender runs. The same catalog powers the in-app Guide, the Defense page help drawers, and the individual wiki articles. The implementation reads real Home Assistant state, real sensor/weather/usage evidence, and real thermostat audit context. There is no dummy climate entity, no fake state, and no simulator fallback.


  
    Super clear logic map
    Search one family at a time.
    Each family below has its own search bar. Every algorithm card shows the input evidence, decision, output, settings, animation, and link to its full article.
  
  *Image or external asset omitted from the offline bundle.*


## Decision cycle

1. Pull weather and outdoor temperature.
2. Pull the real dining-room Home Assistant climate entity.
3. Pull configured real front-door person detector entities when enabled.
4. Apply emergency, front-door, tamper, siesta, cool-outdoor, and paused-state stand-down rules before normal corrections.
5. Restore `cool` mode when needed, delaying only while the room remains inside the configured comfort band.
6. Choose the effective target from the website target, schedule, weather gates, upstairs comfort, compromise/memory, and budget policy.
7. If the room is warm, compute the expected setpoint from `WarmRoomApproachCelsius` below current room temperature (0.5 C by default), walking toward the website target without using the wall setpoint as the starting point.
8. Run the quiet, sensor, weather, energy, and stealth guards in order; each may hold only the safe correction it owns.
9. Shape the outgoing command with walkback/signature/human-nudge rules when safe.
10. Send the real Home Assistant command or surface a real error.
11. Keep refreshing Home Assistant state 24/7 even while paused, weather-blocked, budget-paced, or standing down.

## Warm-room command rule

When the room is above the effective target, the first direct-cooling command starts from the **current room temperature minus `WarmRoomApproachCelsius`**. The default approach is **0.5 C**. Repeated cycles continue toward the website target in small steps, and the command never cools below that website target.

> Example: room `25.0 C`, website target `22.0 C`, wall moved to `26.0 C`, default approach `0.5 C` -> the direct correction begins at `24.5 C`, then walks down as real readings show the room and wall state.


  Core CoolingCore CoolingThe always-on spine that keeps the AC in cooling mode and gets warm rooms moving back toward the chosen target.Search coreClear2 shownNo algorithms in this family match that search.
  
  CoreComfort Sync (quiet recovery)Full article
  
  
  
  1Watch
  2Decide
  3Act
  

  Spaces out and softens corrections so a fixed thermostat does not look like an instant robot.
  WatchesRecent wall-touch count, time since the last defender command, and how far the room is above target.DecisionAfter a manual change it waits a random delay, may hold one or two extra short beats, enforces a minimum gap between commands, and shrinks the nudge size. Repeated touches raise the quiet level (Calm → Light → Quiet → Extra quiet → Softest), lengthening waits and shrinking steps. A warm room (over the safety override) skips all of it.EffectHolds the correction until the chosen calm moment, then lets a softened nudge through.
  Settings and live surfaceNaturalRecoveryEnabledAdaptiveQuietnessEnabledMinimumNaturalDelaySecondsMaximumNaturalDelaySecondsNaturalStepCelsiusNaturalHoldChancePercentMinimumCommandGapSecondsNaturalSafetyOverrideCelsiusDefense page: Shown as a live guard card with current evidence.

  CoreCool Mode RestoreFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Puts the thermostat back into cool mode whenever someone switches it to heat/off/auto.
  WatchesThe Home Assistant HVAC mode, plus how far the room is above target.DecisionIf the mode is not &#x27;cool&#x27; it normally waits a short random delay (between the min and max seconds) so the change is not jarring — but only while the room stays within the comfort band. If the room is warmer than target + band, upstairs is severely hot, or the safety override is crossed, it restores cool immediately.EffectSends climate.set_hvac_mode = cool once the delay (if any) elapses.
  Settings and live surfaceCoolModeRestoreDelayEnabledCoolModeRestoreMinimumDelaySecondsCoolModeRestoreMaximumDelaySecondsCoolModeRestoreComfortBandCelsiusDefense page: Shown as a live guard card with current evidence.




  Wall-Touch ResponseWall-Touch ResponseThe courtesy and stealth layer for real thermostat touches from people in the house.Search wall touchClear20 shownNo algorithms in this family match that search.
  
  Wall touchNatural WalkbackFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Walks a safe-band correction toward target in small, slightly random steps instead of one obvious jump.
  WatchesRecent wall-touch pressure (a 0–100 suspicion score) and how far the setpoint is from the defender target.DecisionOnce recent touches reach the trigger count and the room is inside the walkback safety band, each command moves only about the walkback step (plus a tiny jitter) toward target. A warm room that needs direct cooling skips walkback and still commands the configured warm-room approach below the current room temperature (0.5 C by default).EffectShapes the size of the setpoint command just before it is sent.
  Settings and live surfaceNaturalWalkbackEnabledNaturalWalkbackTriggerTouchesNaturalWalkbackStepCelsiusNaturalWalkbackJitterCelsiusNaturalWalkbackSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchTouch SignatureFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Matches safe nudges to the size of steps people actually use on the wall thermostat.
  WatchesThe recent real wall-thermostat steps (their median size) inside the retention window.DecisionWith enough recent steps and a room still inside the signature safety band, it learns the median wall-step size, clamps it between the min and max signature step, and caps safe nudges to that size. Too-warm rooms clear the signature so direct cooling resumes.EffectLowers the per-command nudge size used by Natural Walkback.
  Settings and live surfaceTouchSignatureEnabledTouchSignatureTriggerTouchesTouchSignatureRetentionMinutesTouchSignatureMinimumStepCelsiusTouchSignatureMaximumStepCelsiusTouchSignatureSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchHuman NudgeFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Makes the final safe setpoint command look like a normal thermostat step instead of a precise bot number.
  WatchesRecent wall touches, the candidate defender command, the current thermostat setpoint, and room temperature.DecisionAfter repeated touches and while the room is inside the safe band, it snaps only safe follow-up commands to the configured human step size. Direct warm-room cooling, upstairs heat, or quiet-timing bypasses skip this shaper.EffectRewrites the outgoing safe setpoint to a normal one-step-looking value.
  Settings and live surfaceHumanNudgeEnabledHumanNudgeTriggerTouchesHumanNudgeStepCelsiusHumanNudgeSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchVisibility GuardFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Slows the next safe nudge when a wall touch lands right after a defender command (someone likely noticed).
  WatchesWall touches that occur within the after-command window, counted as &#x27;notices&#x27; over the notice window.DecisionEach notice adds pressure (0–100). When notices reach the trigger, the next safe correction waits a variable hold between the min and max hold minutes, scaled by pressure. A room over the safety band clears the hold.EffectDelays the next safe correction so the AC&#x27;s reaction looks less mechanical.
  Settings and live surfaceVisibilityGuardEnabledVisibilityGuardTriggerNoticesVisibilityGuardNoticeWindowMinutesVisibilityGuardAfterCommandSecondsVisibilityGuardMinimumHoldMinutesVisibilityGuardMaximumHoldMinutesVisibilityGuardSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchRoutine TimingFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Lines safe corrections up with a normal-looking comfort-check rhythm instead of firing instantly.
  WatchesRecent wall touches and the wall-clock minute.DecisionAfter repeated touches and while the room is safe, the next correction waits until the next interval boundary (the routine minutes) plus a little random wiggle, capped at the max routine delay. Too-warm rooms clear it.EffectDelays the safe correction to the next tidy time slot.
  Settings and live surfaceRoutineTimingEnabledRoutineTimingTriggerTouchesRoutineTimingIntervalMinutesRoutineTimingJitterMinutesRoutineTimingMaxDelayMinutesRoutineTimingSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchComfort BudgetFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Caps how many safe corrections happen inside a rolling window so the AC is not constantly nudged.
  WatchesThe count of recent automatic setpoint commands in the budget window.DecisionIf the number of commands in the window reaches the max, it rests until the oldest command ages out of the window. A room over the safety band clears the budget.EffectHolds new safe corrections until the budget frees up.
  Settings and live surfaceComfortBudgetEnabledComfortBudgetWindowMinutesComfortBudgetMaxCommandsComfortBudgetSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchCommand CamouflageFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Gives a recent helper command time to look normal before another safe correction appears.
  WatchesThe last real helper setpoint command, recent helper-command pressure, recent wall-touch pressure, and the room temperature.DecisionAfter a setpoint command, it waits at least the minimum gap plus pressure-scaled extra seconds before another safe correction. Higher recent touch or command pressure makes the gap longer. A room over the safety band or any comfort/safety bypass clears it immediately.EffectHolds the next safe correction until the recent command has enough spacing.
  Settings and live surfaceCommandCamouflageEnabledCommandCamouflageMinimumGapSecondsCommandCamouflagePressureExtraSecondsCommandCamouflageSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchStealth GovernorFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Runs a whole-system low-profile hold when wall touches, noticed corrections, remote changes, and helper commands make the defender look too busy.
  WatchesRecent wall-touch pressure, noticed-correction pressure, Home Assistant remote-change pressure, helper command count, and room temperature.DecisionIt computes a 0-100 pressure score. If the score reaches the trigger and the room is inside the safety band, it holds the next safe correction for a min-to-max low-profile window scaled by the score. Direct comfort needs, upstairs heat, or a quiet-timing bypass clear it.EffectHolds only safe corrections until the low-profile window ends.
  Settings and live surfaceStealthGovernorEnabledStealthGovernorTriggerScoreStealthGovernorMinimumHoldMinutesStealthGovernorMaximumHoldMinutesStealthGovernorSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchNatural CadenceFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Picks a variable future slot for safe nudges so they never land at identical, robotic times.
  WatchesRecent wall-touch pressure and recent command pressure.DecisionAfter repeated touches it chooses a wait between the min and max cadence minutes (later as pressure rises) plus a small jitter. Too-warm rooms clear it.EffectDelays the safe correction to the chosen cadence slot.
  Settings and live surfaceNaturalCadenceEnabledNaturalCadenceTriggerTouchesNaturalCadenceMinimumMinutesNaturalCadenceMaximumMinutesNaturalCadenceJitterMinutesNaturalCadenceSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchComfort PaceFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  The high-frequency planner: under heavy wall fighting it waits for a calm weather, sensor, or clock-aligned slot.
  WatchesTouch pressure, command pressure, real outdoor-weather movement, the learned Home Assistant sensor beat, and 5/10-minute clock boundaries.DecisionWhen touches reach the trigger and the room is inside the safety band, it computes a base delay between the min and max pace minutes (scaling with pressure) and then snaps it to the nearest calm slot — a weather update, the sensor beat, or a clock boundary — recording why. Too-warm rooms clear it instantly.EffectDelays the safe correction to the chosen calm climate slot.
  Settings and live surfaceNaturalChangePlannerEnabledNaturalChangePlannerTriggerTouchesNaturalChangePlannerMinimumMinutesNaturalChangePlannerMaximumMinutesNaturalChangePlannerJitterMinutesNaturalChangePlannerPreferWeatherSlotsNaturalChangePlannerPreferSensorBeatDefense page: Shown as a live guard card with current evidence.

  Wall touchComfort EnvelopeFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Lets a tiny safe wall preference rest for a while instead of being corrected the instant it appears.
  WatchesThe wall setpoint relative to the defender target and how far the room is above target.DecisionAfter repeated touches, if the wall setpoint stays within the accepted range (target ± max offset) and the room is under the safety band, it simply observes for the hold minutes. A setpoint outside the range, a too-warm room, or a direct-cooling need clears it.EffectSuppresses the small correction while the wall preference is inside the safe range.
  Settings and live surfaceComfortEnvelopeEnabledComfortEnvelopeTriggerTouchesComfortEnvelopeHoldMinutesComfortEnvelopeMaxOffsetCelsiusComfortEnvelopeSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchComfort CompromiseFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Blends a repeated wall choice into a temporary target, then fades it back to the website target.
  WatchesThe latest wall setpoint, the website target, and how far the room is above target.DecisionIf touches repeat and the room is inside the compromise safety band, the wall setpoint pulls the effective target up to the max offset for the hold minutes, then eases back over the decay minutes. A too-warm room clears it immediately.EffectTemporarily shifts the defender target the corrections aim for.
  Settings and live surfaceComfortCompromiseEnabledComfortCompromiseTriggerTouchesComfortCompromiseHoldMinutesComfortCompromiseDecayMinutesComfortCompromiseMaxOffsetCelsiusComfortCompromiseSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchComfort MemoryFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Learns a small time-of-day target bias from repeated safe wall choices and re-applies it later that hour.
  WatchesThe current hour and the offsets learned for it; the room temperature.DecisionRepeated safe touches teach a bounded offset (± max offset) for the current hour slot. On later checks in the same window it nudges the target by that learned offset. Learned memory expires after the retention hours and is skipped when the room is warm or upstairs needs cooling.EffectAdjusts the defender target by the learned hourly bias.
  Settings and live surfaceComfortMemoryEnabledComfortMemoryLearningTouchesComfortMemoryRetentionHoursComfortMemoryMaxOffsetCelsiusComfortMemorySafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchConflict QuietFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Stands the defender down during an obvious tug-of-war over the thermostat.
  WatchesRecent wall touches within the touch window and how far the room is above target.DecisionWhen touches reach the conflict threshold, it stops sending visible corrections for the stand-down minutes — but only while the room stays within target + comfort band. A warmer room, severe upstairs heat, or a crossed safety override ends it.EffectSuppresses corrections for the stand-down period.
  Settings and live surfaceConflictQuietModeEnabledConflictQuietTouchThresholdConflictQuietMinutesConflictQuietComfortBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchTug-of-War TruceFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Calls a temporary truce when the real thermostat bounces up and down, so answer-back commands do not look like a duel.
  WatchesThe real external thermostat audit log: previous setpoint, new setpoint, timestamp, and source classification.DecisionInside the configured flip window it converts each external setpoint change into up/down/flat, counts direction flips, and compares that count to the flip trigger. If the flip trigger is met and the room is still inside the safety band, it holds only safe answer-back corrections for the truce minutes. A warm room, severe upstairs heat, matching setpoint, cooler-intent fast lane, or Super Defender strict bypass clears it.EffectHolds safe corrections until the truce window ends, then lets the normal defender chain continue.
  Settings and live surfaceTugOfWarTruceEnabledTugOfWarTruceMinimumFlipsTugOfWarTruceWindowMinutesTugOfWarTruceHoldMinutesTugOfWarTruceSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchWall SettlingFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Waits for someone who is still tapping the wall thermostat to stop before correcting.
  WatchesRecent touches inside the settling window and the room temperature.DecisionWith enough recent touches it holds for the base settle seconds plus extra pressure seconds (more touches = longer), measured from the latest touch. A room over the safety band clears it.EffectHolds the correction until the wall stops changing.
  Settings and live surfaceWallSettlingGuardEnabledWallSettlingMinimumTouchesWallSettlingWindowMinutesWallSettlingBaseSecondsWallSettlingPressureExtraSecondsWallSettlingSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchManual Comfort GraceFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Leaves a manual wall change alone while the room still feels comfortable.
  WatchesTime since the wall change and how far the room is above target.DecisionAfter cooldown it can keep waiting up to the grace minutes while the room stays within target + grace band. If the room rises above the band, the mode leaves cool, or upstairs becomes severely hot, grace ends. Touch Intent can extend the grace when recent changes are clearly warmer.EffectSuppresses the correction while the wall change stays comfortable.
  Settings and live surfaceManualComfortGraceEnabledManualComfortGraceMinutesManualComfortGraceBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchTouch IntentFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Reads whether recent wall changes trend warmer, cooler, or mixed, and extends grace for a clear warmer pattern.
  WatchesThe net sum of recent wall setpoint changes inside the intent window.DecisionIf the net movement is at least the warm threshold and the room is inside the intent safety band, it adds the extra grace minutes to Manual Comfort Grace. Cooler or mixed patterns get no extra grace; a too-warm room steps it aside.EffectLengthens Manual Comfort Grace when people clearly want warmer air.
  Settings and live surfaceTouchIntentEnabledTouchIntentMinimumTouchesTouchIntentWindowMinutesTouchIntentNetWarmThresholdCelsiusTouchIntentExtraGraceMinutesTouchIntentSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchCooler Intent Fast LaneFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  When people keep dialing the wall cooler, it skips quiet waits so the room cools sooner.
  WatchesThe net cooler movement of recent wall changes and whether the room is above target.DecisionIf repeated touches move the wall cooler by at least the cool threshold and the room is above target, it clears quiet waits (cooldown, grace, conflict quiet, cadence, repeat quiet, sensor rhythm, runway, and more) for the hold minutes. It never lowers the website target — warm-room cooling still starts at the current room temperature minus the configured WarmRoomApproachCelsius (0.5 °C by default), rather than subtracting the approach from the wall setpoint, and continues toward—but never below—the website target. A room over the safety band hands control back to normal safety rules.EffectBypasses the quiet timing guards for a short window.
  Settings and live surfaceCoolerIntentFastLaneEnabledCoolerIntentMinimumTouchesCoolerIntentWindowMinutesCoolerIntentHoldMinutesCoolerIntentNetCoolThresholdCelsiusCoolerIntentSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  Wall touchRepeated-Raise SurrenderFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  If a person re-raises the setpoint to about the same value 3+ times in 30 minutes, the defender adopts their number for 4 hours — the human wins the argument.
  WatchesRecent external RAISES (times and values, pruned to a 30-minute window).DecisionThree or more raises landing within 0.7 C of each other mean the person really wants that temperature. The defender adopts it (capped at 27 C) as the effective target for 4 hours — deliberately with NO &#x27;unless the room is too warm&#x27; escape, because that escape hatch is what turned dawn disagreements into a detached thermostat. My temp stays the hard floor, emergencies still win, and a deliberate website target clears the surrender.EffectRaises the effective target to the human&#x27;s number for 4 hours and logs the surrender.
  Settings and live surface(always on — fixed: 3 raises / 30 min window / 4 h hold / 27 C cap)Defense page: Guide-only reference; no live Defense card is projected.




  Sensor TimingSensor TimingTiming that lines corrections up with real Home Assistant readings, HVAC action, weather, and usage telemetry.Search sensorClear11 shownNo algorithms in this family match that search.
  
  SensorSetpoint EchoFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Waits for Home Assistant to report back the last setpoint before sending another safe command.
  WatchesThe pending command setpoint and whether Home Assistant has echoed it yet.DecisionAfter a command it waits up to the echo grace seconds for Home Assistant to report that setpoint within 0.15 °C. Once echoed, or after the grace expires, the next command is allowed. A too-warm room steps it aside.EffectBriefly holds the next safe command to avoid piling commands on a slow integration.
  Settings and live surfaceSetpointEchoGuardEnabledSetpointEchoGraceSecondsSetpointEchoSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  SensorRepeat QuietFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Waits before sending the very same thermostat number again.
  WatchesThe setpoint about to be sent versus the last defender command, plus touch and command pressure.DecisionIf the next safe command would repeat the last number, it waits at least the minimum wait seconds plus extra pressure seconds (scaling with recent touches and commands). Different one-degree step-downs pass straight through; a too-warm room steps it aside.EffectHolds an identical follow-up command until the wait elapses.
  Settings and live surfaceRepeatCommandGuardEnabledRepeatCommandMinimumWaitSecondsRepeatCommandPressureExtraSecondsRepeatCommandSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  SensorSetpoint StillnessFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Waits until the wall setpoint stops moving before a safe correction answers back.
  WatchesReal Home Assistant climate readings, the current reported setpoint, recent wall touches, and room temperature.DecisionAfter repeated external touches, while the room is still inside the safe band, it requires a few consecutive real Home Assistant readings at the same wall setpoint before allowing a safe correction. If the room gets too warm, a cooler-intent fast lane is active, the expected setpoint is already reached, or the max hold expires, it steps aside.EffectDelays only safe corrections until the wall setpoint looks settled.
  Settings and live surfaceSetpointStillnessGuardEnabledSetpointStillnessTriggerTouchesSetpointStillnessRequiredSamplesSetpointStillnessMaxHoldSecondsSetpointStillnessToleranceCelsiusSetpointStillnessSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  SensorSensor RhythmFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Times nudges to just after the normal Home Assistant reading beat so they look less mechanical.
  WatchesTimestamps of real Home Assistant readings, used to learn the median update interval.DecisionWith at least the minimum samples in the rhythm window, it learns the median interval between updates and waits until just after the next beat plus a small jitter. A too-warm room or upstairs heat clears it.EffectDelays the safe correction to align with the sensor&#x27;s update cadence.
  Settings and live surfaceSensorRhythmGuardEnabledSensorRhythmMinimumSamplesSensorRhythmWindowMinutesSensorRhythmJitterSecondsSensorRhythmSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  SensorHVAC AlibiFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Waits for a real HVAC action transition so a safe correction lands near a normal thermostat event.
  WatchesThe current Home Assistant hvac_action, the last action transition, recent wall touches, and room temperature.DecisionAfter repeated wall touches, while the room is still inside the safety band, it can hold a safe correction until hvac_action changes (for example idle to cooling or cooling to idle). A recent transition can also clear the hold. Direct comfort needs, upstairs heat, or a too-warm room bypass the wait immediately.EffectDelays only safe corrections until a real HVAC action transition or the max hold expires.
  Settings and live surfaceHvacActionAlibiEnabledHvacActionAlibiTriggerTouchesHvacActionAlibiTransitionWindowSecondsHvacActionAlibiMaxHoldMinutesHvacActionAlibiSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  SensorTelemetry AlibiFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Waits for a normal Home Assistant/weather/usage update before a safe correction, so the nudge is not an isolated event.
  WatchesRecent wall touches, real Home Assistant reading beats, weather samples, Alectra Hui usage updates, and room temperature.DecisionAfter repeated wall touches, while the room is still inside the safety band, it starts a short quiet hold and then waits for the next enabled real telemetry signal. A too-warm room, direct comfort need, matching setpoint, disabled signal source, or max wait clears the hold.EffectDelays only safe corrections until a normal house telemetry update can act as cover.
  Settings and live surfaceTelemetryAlibiEnabledTelemetryAlibiTriggerTouchesTelemetryAlibiMinimumHoldSecondsTelemetryAlibiMaxHoldMinutesTelemetryAlibiSafetyBandCelsiusTelemetryAlibiUseWeatherTelemetryAlibiUseSensorBeatTelemetryAlibiUsePeakPowerDefense page: Shown as a live guard card with current evidence.

  SensorCooling RunwayFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Gives the AC time to work after cooling starts before nudging the setpoint again.
  WatchesThe Home Assistant hvac_action and how long ago cooling started, plus command pressure.DecisionWhen the action turns to cooling it records the start and holds for the minimum runway seconds plus extra pressure seconds. If cooling stops or the room gets too warm, it clears immediately.EffectHolds the next safe nudge so a fresh cooling cycle is not interrupted.
  Settings and live surfaceCoolingRunwayGuardEnabledCoolingRunwayMinimumSecondsCoolingRunwayPressureExtraSecondsCoolingRunwaySafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  SensorRoom Trend GuardFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Keeps observing when the room is already stable or cooling after a wall change.
  WatchesReal room-temperature samples: the oldest versus newest inside the trend window.DecisionIf the room is cooling (delta below the negative stable tolerance) it holds for the trend hold minutes so cooling can continue. Stable or warming rooms let the correction proceed; rooms above the grace band or safety override always proceed.EffectHolds the correction while the room is trending cooler on its own.
  Settings and live surfaceRoomTrendGuardEnabledRoomTrendWindowMinutesRoomTrendStableToleranceCelsiusRoomTrendHoldMinutesDefense page: Shown as a live guard card with current evidence.

  SensorThermal MomentumFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Waits when the room is already cooling fast enough to reach target soon on its own.
  WatchesReal room-temperature samples (to estimate cooling rate) and the active cooling action.DecisionIt estimates the cooling rate and minutes-to-target. If the rate is at least the minimum C/hour and target is within the look-ahead minutes, it holds for the momentum hold minutes. A room near target or above the safety band proceeds.EffectHolds the correction so existing momentum can finish the job.
  Settings and live surfaceThermalMomentumGuardEnabledThermalMomentumMinimumCoolingRateCelsiusPerHourThermalMomentumLookAheadMinutesThermalMomentumHoldMinutesDefense page: Shown as a live guard card with current evidence.

  SensorWeather Drift TimingFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Times safe corrections to real outdoor-weather movement instead of firing immediately.
  WatchesReal outdoor-temperature samples (oldest versus newest) inside the weather window.DecisionAfter a wall touch, while the room is inside the weather safety band, stable or cooling outdoor temperatures let it hold for the weather hold minutes. Once the outdoor temperature genuinely warms by the minimum change, the hold clears so the correction lines up with real weather. A too-warm room clears it.EffectHolds the safe correction until outdoor weather moves.
  Settings and live surfaceWeatherDriftGuardEnabledWeatherDriftWindowMinutesWeatherDriftMinimumChangeCelsiusWeatherDriftHoldMinutesWeatherDriftSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  SensorWake-Up Truce (door sensor)Full article
  
  
  
  1Watch
  2Decide
  3Act
  

  A bedroom door opening at dawn means that person is awake — adopt the warm truce temperature before they ever touch the thermostat.
  WatchesThe configured bedroom door sensor (closed-to-open transitions) during the dawn window.DecisionWhen the door sensor flips from closed to open between the window start and end (default 04:00-09:00), the defender immediately adopts the truce temperature (default 25 C, never below my temp, capped at 27 C) for the hold period (default 2 h) using the same surrender machinery. The person wakes to a defender that already agrees with them.EffectAdopts the truce target for the hold period and logs a friendly good-morning event.
  Settings and live surfaceWakeTruceDoorSensorEntityIdWakeTruceWindowStartWakeTruceWindowEndWakeTruceTargetCelsiusWakeTruceHoldMinutesDefense page: Guide-only reference; no live Defense card is projected.




  Safety, Energy, and SystemSafety, Energy, and SystemSafety protocols, remote-change handling, energy policy, schedules, emergency controls, and owner-enforcement rules.Search systemClear17 shownNo algorithms in this family match that search.
  
  SystemWebsite DebounceFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Blocks repeated website button taps for two minutes so the UI does not spam Home Assistant.
  WatchesThe last website command name and time.DecisionThe first click runs; later clicks within the debounce seconds show the remaining wait instead of resending. Emergency actions bypass the debounce and then start a fresh window.EffectRejects duplicate website actions until the window clears.
  Settings and live surface(fixed at 120 seconds)Defense page: Shown as a live guard card with current evidence.

  SystemSuper DefenderFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Detects repeated phone/Home Assistant thermostat changes and tightens correction timing without cutting thermostat Wi-Fi.
  WatchesHome Assistant context on climate state changes: user_id, parent_id, and context id.DecisionChanges with user_id count as Home Assistant user or phone changes. Changes with parent_id count as automation/script changes. Repeated remote-style changes inside the configured window arm Super Defender for the hold minutes. While active and the room still needs cooling, it can bypass subtle quiet waits. Wi-Fi blocking is intentionally manual only because cutting the thermostat off can also remove monitoring and recovery.EffectShows source attribution, arms a strict response window, and can bypass quiet timing while cooling is needed.
  Settings and live surfaceSuperDefenderModeEnabledSuperDefenderRemoteChangeThresholdSuperDefenderWindowMinutesSuperDefenderHoldMinutesSuperDefenderSafetyBandCelsiusSuperDefenderBypassQuietTimingDefense page: Shown as a live guard card with current evidence.

  SystemRival Schedule WatchFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Knows the AC vendor app&#x27;s own temperature schedule (SLEEP / DEEP SLEEP / GOOD MORNING) and defends my temp when a scheduled block pushes the wall warmer while everyone sleeps.
  WatchesThe configured rival AC-app schedule blocks (start time + low/high setpoints per weekday), the live wall setpoint, Home Assistant change context, and the local clock.DecisionThe blocks are configuration (appsettings/environment), never code. A setpoint change that is not from a Home Assistant user and lands on the active block&#x27;s low/high number is attributed to the AC app schedule instead of a human wall touch — so it starts no cooldown, no comfort grace, no touch counters, no peace offering, and teaches nothing to comfort memory/compromise (otherwise the schedule would train the defender to like the rival&#x27;s warm blocks). While the wall sits at a scheduled setpoint above my temp and the room is warm, quiet waits are bypassed: a schedule is a machine running while the household sleeps, so nobody is watching the correction. My temp is never changed by the rival schedule, and extreme heat still defers to normal comfort safety. The vendor app&#x27;s Fan schedule tab is reserved in configuration but not enforced yet.EffectAttributes schedule pushes in the audit log, announces block boundaries as events, and answers a scheduled warm push back toward my temp without human-style delays.
  Settings and live surfaceRivalScheduleWatchEnabledRivalScheduleSetpointToleranceCelsiusRivalScheduleBypassQuietTimingRivalScheduleSafetyBandCelsiusRivalScheduleBlocksRivalFanScheduleBlocksDefense page: Shown as a live guard card with current evidence.

  SystemCool-Outdoor Shutdown (Open-Window Armistice)Full article
  
  
  
  1Watch
  2Decide
  3Act
  

  When it is genuinely cool outside and the forecast says it stays cool, the defender turns the AC fully off — and turns it back on by itself when the weather or the room demands it.
  WatchesThe real outdoor temperature, the hourly Home Assistant forecast over the gate hours, the room temperature, the thermostat mode, and the minimum-off dwell clock.DecisionBelow the shutdown threshold, and only when the forecast peak over the gate hours stays under threshold+margin (no off/on flapping before a hot afternoon), it sends ONE off command per cool episode and stands guard. It restores cool mode on its own once outdoor warms past threshold+margin (after the minimum off dwell) — or immediately, dwell ignored, if the room crosses the safety band. Someone turning the AC back on mid-episode wins for the rest of that episode; an AC already off by hand is adopted without a command. Unknown outdoor or a missing forecast means it does nothing new; safety bands always win. While it holds the AC off, the quiet minutes bank food rations.EffectSends climate.set_hvac_mode = off once per cool episode, then a tagged automatic restore.
  Settings and live surfaceCoolOutdoorShutdownEnabledCoolOutdoorShutdownBelowCelsiusCoolOutdoorRestoreMarginCelsiusCoolOutdoorMinimumOffMinutesCoolOutdoorForecastGateEnabledCoolOutdoorForecastGateHoursForecastRefreshMinutesDefense page: Shown as a live guard card with current evidence.

  SystemSiesta Watch (mess hall)Full article
  
  
  
  1Watch
  2Decide
  3Act
  

  Lets the whole guard force nap on command; while they sleep the AC eases off and the money it would have spent is banked as food rations.
  WatchesThe siesta timer, the room temperature against the wake band, the budget safety maximum, and the thermostat mode.DecisionA siesta starts from the dashboard (1h/2h/4h) and parks the thermostat — or turns it off — exactly once; a human changing it back mid-nap is respected, the accrual just pauses while the unit cools. The guards wake on the timer, immediately when the room passes target + wake band or the budget safety maximum, on cancel, or when an emergency fires or the master switch pauses the defender. Rations already earned are always kept.EffectHolds the whole correction pipeline while the nap timer runs; sends one park/off command at the start.
  Settings and live surfaceSiestaEnabledSiestaThermostatActionSiestaWakeBandCelsiusSiestaMaxMinutesDefense page: Shown as a live guard card with current evidence.

  SystemField Kitchen (food rations)Full article
  
  
  
  1Watch
  2Decide
  3Act
  

  Banks unspent AC dollars during siestas and cool-outdoor shutdowns, and spends them on forecast-hot days so the monthly budget eases exactly when cooling matters most.
  WatchesThe pantry balance and cap, the trailing-week compressor duty cycle, the Alectra TOU rate in force, the hourly forecast over the release lookahead, and the AC&#x27;s real per-slice estimated cost.DecisionWhile the guards nap, every quiet minute banks the money the AC would probably have spent — its usual share of run-time from the last week × its assumed power draw × the Alectra rate right now. On a forecast-hot day the pantry pays the AC&#x27;s bill: every dollar the AC actually spends during the hot window comes out of the food balance instead of counting against the monthly budget (up to the per-day cap, only while over pace). A slice where the compressor actually cools earns nothing, and no usage history means no accrual — the pantry never invents savings. Rations can also summon the WinForge reactor&#x27;s AI operator — one ration per hour.EffectAdjusts the monthly budget&#x27;s over/under bookkeeping; moves no real money and sends no thermostat commands.
  Settings and live surfaceFoodRationsEnabledFoodBalanceMaxCadFoodReleaseHotThresholdCelsiusFoodReleaseLookaheadHoursFoodReleaseMaxPerDayCadReactorPowerEnabledFoodRationSizeCadDefense page: Shown as a live guard card with current evidence.

  SystemDesired-State EnforcerFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Makes the owner&#x27;s chosen AC state win automatically: if someone else turns the unit off or moves the setpoint, it restores the exact desired state and keeps it there.
  WatchesHome Assistant HVAC mode, the live setpoint vs the owner&#x27;s target, context.user_id attribution, recent override/assert counts, and the learned interference probability.DecisionWhen a change is attributed to someone other than the owner (or has no owner user_id) it debounces, then either lets the human-like stealth pipeline ease the setpoint back (smart-stealth mode) or snaps to the exact target (hard mode). Cooldown, device-reject backoff, and a rate limit stop it thrashing; repeated overrides escalate it to firm mode and an optional notification. Owner changes are respected. It clamps to the device min/max and never acts while Home Assistant is unreachable.EffectRestores the desired mode/setpoint, escalates on repeated interference, and notifies — using the trained interference/cadence models to pace itself.
  Settings and live surfaceEnforcerModeEnabledEnforcerTargetTemperatureCelsiusEnforcerEnforceModeEnforcerEnforceSetpointEnforcerStealthShapingEnforcerRespectOwnerEnforcerOwnerUserIdsEnforcerDebounceSecondsEnforcerCooldownSecondsEnforcerRateWindowMinutesEnforcerMaxAssertsPerWindowEnforcerEscalateAfterOverridesEnforcerBackoffBaseSecondsEnforcerBackoffMaxSecondsEnforcerScheduleEnabledEnforcerStartTimeEnforcerEndTimeEnforcerRequirePresenceEnforcerNotifyEnabledEnforcerUseLearningDefense page: Shown as a live guard card with current evidence.

  SystemRemote Settling GuardFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Gives repeated phone/Home Assistant or automation thermostat changes a quiet settling window before a safe answer-back.
  WatchesHome Assistant change source attribution, recent remote-style change count, room temperature, and the expected setpoint.DecisionWhen Home Assistant context shows repeated user/phone or automation changes inside the configured window, and the room is still inside the safety band, it holds only safe corrections for the quiet hold minutes. A too-warm room, cooler intent, matching setpoint, disabled setting, or expired hold releases it immediately.EffectDelays only safe corrections after remote-style thermostat changes so the response does not look instant.
  Settings and live surfaceRemoteSettlingGuardEnabledRemoteSettlingTriggerChangesRemoteSettlingWindowMinutesRemoteSettlingHoldMinutesRemoteSettlingSafetyBandCelsiusDefense page: Shown as a live guard card with current evidence.

  SystemAlectra Peak Power SaverFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Makes the defender more chill and resource-saving when Alectra Hui reports on-peak, high price, or high power use.
  WatchesAlectra Hui current TOU period, current price, current power, and current plan sensors from Home Assistant.DecisionWhen enabled, On-peak TOU, price above the c/kWh threshold, or current power above the kW threshold arms a short saver window. During that window it holds only safe cooling commands that would demand more cooling, and it can set the configured fan saver mode if the room is still inside the safety band. If the room or upstairs gets too hot, or the command would save energy by warming the setpoint, it steps aside.EffectHolds safe cooling during expensive/high-load periods and prefers the saver fan mode.
  Settings and live surfacePeakPowerSaverEnabledPeakPowerSaverOnPeakEnabledPeakPowerSaverHighPowerEnabledPeakPowerSaverPowerThresholdKilowattsPeakPowerSaverPriceThresholdCentsPerKwhPeakPowerSaverHoldMinutesPeakPowerSaverSafetyBandCelsiusPeakPowerSaverFanSaverEnabledPeakPowerSaverFanModeDefense page: Shown as a live guard card with current evidence.

  SystemFront-door Guard PostFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Pauses the defender and can turn the thermostat off when a real front-door person detector trips.
  WatchesConfigured or auto-discovered Home Assistant front-door person sensors.DecisionThe worker reads the configured entities, or auto-discovers likely front-door/porch/entry person sensors. If any detector reports a person, the defender pauses immediately, holds the guard window, and sends thermostat OFF if that setting is enabled. The source is recorded as the front-door guard post so it does not look like a wall touch.EffectRuns the kill switch, hides the live boards while paused, and records the source.
  Settings and live surfaceFrontDoorKillSwitchEnabledFrontDoorPersonEntityIdsFrontDoorKillSwitchHoldMinutesFrontDoorKillSwitchRefreshSecondsFrontDoorKillSwitchTurnsThermostatOffDefense page: Shown as a live guard card with current evidence.

  SystemEmergency ProtocolsFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  One-tap stand-down modes for too-cold, someone-upset, and suspicion situations.
  WatchesThe chosen protocol and its remaining window.DecisionToo cold (30 min) pauses the defender and turns the thermostat off. Someone upset (45 min) and Suspicion quiet (90 min) keep reading the thermostat 24/7 but send no corrective commands until the window ends. Emergency actions bypass the website debounce.EffectSuppresses corrective commands for the protocol window.
  Settings and live surface(run from the Controls page)Defense page: Shown as a live guard card with current evidence.

  SystemCooling Failure WatchFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Raises a repeating MEGA alert when cool mode is demanded but the AC is not really cooling, escalates to a full-site OMEGA alert when a rising room confirms it, then turns the AC off only for that confirmed failure until the room warms 0.5 C.
  WatchesReal Home Assistant data only: hvac_mode, hvac_action, the setpoint, and room-temperature history.DecisionMEGA: it alerts if the entity is in cool, the room is clearly above the setpoint, and the action stays idle for about 30 minutes (possible breaker/equipment), or if the action says cooling but the room does not drop over the retained window (possible compressor/airflow). OMEGA: while the idle/breaker MEGA alert is up, if the room has also risen at least 0.4 C over the last 5 minutes — what a dead breaker looks like — it escalates to a full-site OMEGA alert. MEGA stays advisory; only OMEGA's independent room-rise evidence authorizes an automatic OFF. Requiring a real, sustained rise keeps false positives down. Alerts repeat about once a minute.EffectSurfaces a red alert and an event log entry, plus a site-wide overlay on OMEGA. Only a confirmed OMEGA failure turns the AC fully off and holds it off until the real room temperature rises 0.5 C above the reading captured at shutdown, then restores cool. A human turning the AC back on is respected for the rest of that failure episode.
  Settings and live surfaceCoolingFailureWatchEnabledDefense page: Shown as a live guard card with current evidence.

  SystemDynamic CooldownFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  A frequency-based quiet period after a manual thermostat change.
  WatchesHow many wall touches happened recently inside the touch-frequency window.Decisioncooldown = min(MaxCooldownSeconds, BaseCooldownSeconds × recentTouchCount) + a small random quiet delay. More repeated changes mean longer cooldowns.EffectHolds the next correction until the cooldown elapses.
  Settings and live surfaceBaseCooldownSecondsMaxCooldownSecondsTouchFrequencyWindowMinutesDefense page: Guide-only reference; no live Defense card is projected.

  SystemFan Energy SaverFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Optionally moves the fan to an energy-saving mode when the room is near target.
  WatchesRoom temperature versus target and the thermostat&#x27;s available fan modes.DecisionWhen enabled and the room is within the threshold of target, if the configured fan mode exists on the device it calls climate.set_fan_mode.EffectSets the fan to the saver mode; otherwise leaves the fan alone.
  Settings and live surfaceFanEnergySaverEnabledFanEnergySaverThresholdCelsiusFanEnergySaverModeDefense page: Guide-only reference; no live Defense card is projected.

  SystemUpstairs Comfort GuardFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Prioritizes cooling when upstairs rooms get hot while someone is home.
  WatchesThe hottest configured (or auto-discovered) upstairs temperature sensor and optional presence entities.DecisionIf the hottest upstairs room exceeds the comfort maximum, it lowers the target toward the comfort target and adds the cooling boost. Severe upstairs heat bypasses cooldown so comfort wins. When presence is required and nobody is detected, it assumes home rather than under-cooling.EffectLowers the effective target and can bypass quiet timing.
  Settings and live surfaceUpstairsComfortEnabledUpstairsTemperatureEntityIdsUpstairsMaxComfortCelsiusUpstairsComfortTargetCelsiusUpstairsComfortBoostCelsiusHomePresenceRequiredPresenceEntityIdsDefense page: Guide-only reference; no live Defense card is projected.

  SystemSchedule &amp; Weather RulesFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  Time-of-day target rules, each gated by a weather activation condition.
  WatchesThe active schedule entry for the current day/time and the weather rule.DecisionWhen the custom schedule is on, the matching rule supplies the target. Weather rules (always, room-above-outdoor, room-below-outdoor, outdoor-above-target, outdoor-below-target) decide whether corrective action is allowed. The defender still reads Home Assistant 24/7 even when a rule blocks correction.EffectSets the target and whether corrective action runs.
  Settings and live surfaceScheduleEnabledWeatherActivationMode(per-rule Days / Start / End / Target / Weather)Defense page: Guide-only reference; no live Defense card is projected.

  SystemTamper TruceFull article
  
  
  
  1Watch
  2Decide
  3Act
  

  If the thermostat vanishes right after a correction exchange, assume a frustrated person detached it — stand down 2 hours instead of escalating.
  WatchesHome Assistant reachability, the last defender command time, and recent human touches.DecisionA thermostat that becomes unreachable within 20 minutes of a defender command AND 45 minutes of a human touch looks exactly like someone pulling the unit off the wall (it really happened, twice). This is the ULTRA OMEGA ALERT — one tier above MEGA (not cooling) and OMEGA (breaker off). Instead of fighting harder, the defender enters a 2-hour emergency quiet named &#x27;Tamper truce&#x27; and says why. Normal outages without a preceding exchange are unaffected.EffectRaises the ULTRA OMEGA ALERT, activates a 2-hour stand-down, and records the tamper-truce event.
  Settings and live surface(always on — fixed: 20 min command window / 45 min touch window / 2 h truce)Defense page: Guide-only reference; no live Defense card is projected.



## Source files

- `Guards/GuardCatalog.cs` is the public explanation catalog.
- `Services/DefenderStateStore.cs` owns guard state, audit context, persistence, and most decisions.
- `Services/AcDefenderService.cs` orchestrates each cycle and sends Home Assistant commands.

## Failure modes

If **Defender Logic** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Verification

Verify the shipped behavior at the feature's live page or endpoint, then run the repository's documented build and test commands. Confirm the real-input and real-error paths, keyboard access, reduced-motion behavior, and a 390 px viewport without horizontal overflow. Record the exact commit and workflow result when publishing a release; a static screenshot alone is not proof of a live Home Assistant command.
## Suggested articles

- Feature briefs — find every documented surface and guard.
- Defender Logic — follow the complete decision cycle and its bypass rules.
- Settings — inspect persisted configuration, language modes, and safety limits.
