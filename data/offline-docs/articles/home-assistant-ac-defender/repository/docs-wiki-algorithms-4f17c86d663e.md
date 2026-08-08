---
layout: doc
title: "Algorithms"
description: "Search every AC Defender algorithm and open the full wiki article for each one."
---

# Algorithms

Every algorithm gets its own wiki article, generated from the same guard catalog that feeds the in-app Guide and Defense cards. Use this when you want the clearest answer to: “what happens when someone keeps making the thermostat too warm?”


  
    50 real algorithms, no simulator
    The whole defense brain, searchable.
    Each card has a unique generated thumbnail and opens a full article with a different unique explanatory graphic. No algorithm page shares the same image.
  
  *Image or external asset omitted from the offline bundle.*



  Search all algorithms
  Clear
  50 algorithms shownNo algorithms match that search.
  
  *Image or external asset omitted from the offline bundle.*
  
    Core
    Live card
  
  Comfort Sync (quiet recovery)
  Spaces out and softens corrections so a fixed thermostat does not look like an instant robot.
  WatchesRecent wall-touch count, time since the last defender command, and how far the room is above target.EffectHolds the correction until the chosen calm moment, then lets a softened nudge through.
  Key settings: NaturalRecoveryEnabled, AdaptiveQuietnessEnabled, MinimumNaturalDelaySeconds, MaximumNaturalDelaySeconds...

  *Image or external asset omitted from the offline bundle.*
  
    Core
    Live card
  
  Cool Mode Restore
  Puts the thermostat back into cool mode whenever someone switches it to heat/off/auto.
  WatchesThe Home Assistant HVAC mode, plus how far the room is above target.EffectSends climate.set_hvac_mode = cool once the delay (if any) elapses.
  Key settings: CoolModeRestoreDelayEnabled, CoolModeRestoreMinimumDelaySeconds, CoolModeRestoreMaximumDelaySeconds, CoolModeRestoreComfortBandCelsius

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Natural Walkback
  Walks a safe-band correction toward target in small, slightly random steps instead of one obvious jump.
  WatchesRecent wall-touch pressure (a 0–100 suspicion score) and how far the setpoint is from the defender target.EffectShapes the size of the setpoint command just before it is sent.
  Key settings: NaturalWalkbackEnabled, NaturalWalkbackTriggerTouches, NaturalWalkbackStepCelsius, NaturalWalkbackJitterCelsius...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Touch Signature
  Matches safe nudges to the size of steps people actually use on the wall thermostat.
  WatchesThe recent real wall-thermostat steps (their median size) inside the retention window.EffectLowers the per-command nudge size used by Natural Walkback.
  Key settings: TouchSignatureEnabled, TouchSignatureTriggerTouches, TouchSignatureRetentionMinutes, TouchSignatureMinimumStepCelsius...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Human Nudge
  Makes the final safe setpoint command look like a normal thermostat step instead of a precise bot number.
  WatchesRecent wall touches, the candidate defender command, the current thermostat setpoint, and room temperature.EffectRewrites the outgoing safe setpoint to a normal one-step-looking value.
  Key settings: HumanNudgeEnabled, HumanNudgeTriggerTouches, HumanNudgeStepCelsius, HumanNudgeSafetyBandCelsius

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Visibility Guard
  Slows the next safe nudge when a wall touch lands right after a defender command (someone likely noticed).
  WatchesWall touches that occur within the after-command window, counted as &#x27;notices&#x27; over the notice window.EffectDelays the next safe correction so the AC&#x27;s reaction looks less mechanical.
  Key settings: VisibilityGuardEnabled, VisibilityGuardTriggerNotices, VisibilityGuardNoticeWindowMinutes, VisibilityGuardAfterCommandSeconds...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Routine Timing
  Lines safe corrections up with a normal-looking comfort-check rhythm instead of firing instantly.
  WatchesRecent wall touches and the wall-clock minute.EffectDelays the safe correction to the next tidy time slot.
  Key settings: RoutineTimingEnabled, RoutineTimingTriggerTouches, RoutineTimingIntervalMinutes, RoutineTimingJitterMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Comfort Budget
  Caps how many safe corrections happen inside a rolling window so the AC is not constantly nudged.
  WatchesThe count of recent automatic setpoint commands in the budget window.EffectHolds new safe corrections until the budget frees up.
  Key settings: ComfortBudgetEnabled, ComfortBudgetWindowMinutes, ComfortBudgetMaxCommands, ComfortBudgetSafetyBandCelsius

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Command Camouflage
  Gives a recent helper command time to look normal before another safe correction appears.
  WatchesThe last real helper setpoint command, recent helper-command pressure, recent wall-touch pressure, and the room temperature.EffectHolds the next safe correction until the recent command has enough spacing.
  Key settings: CommandCamouflageEnabled, CommandCamouflageMinimumGapSeconds, CommandCamouflagePressureExtraSeconds, CommandCamouflageSafetyBandCelsius

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Stealth Governor
  Runs a whole-system low-profile hold when wall touches, noticed corrections, remote changes, and helper commands make the defender look too busy.
  WatchesRecent wall-touch pressure, noticed-correction pressure, Home Assistant remote-change pressure, helper command count, and room temperature.EffectHolds only safe corrections until the low-profile window ends.
  Key settings: StealthGovernorEnabled, StealthGovernorTriggerScore, StealthGovernorMinimumHoldMinutes, StealthGovernorMaximumHoldMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Natural Cadence
  Picks a variable future slot for safe nudges so they never land at identical, robotic times.
  WatchesRecent wall-touch pressure and recent command pressure.EffectDelays the safe correction to the chosen cadence slot.
  Key settings: NaturalCadenceEnabled, NaturalCadenceTriggerTouches, NaturalCadenceMinimumMinutes, NaturalCadenceMaximumMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Comfort Pace
  The high-frequency planner: under heavy wall fighting it waits for a calm weather, sensor, or clock-aligned slot.
  WatchesTouch pressure, command pressure, real outdoor-weather movement, the learned Home Assistant sensor beat, and 5/10-minute clock boundaries.EffectDelays the safe correction to the chosen calm climate slot.
  Key settings: NaturalChangePlannerEnabled, NaturalChangePlannerTriggerTouches, NaturalChangePlannerMinimumMinutes, NaturalChangePlannerMaximumMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Comfort Envelope
  Lets a tiny safe wall preference rest for a while instead of being corrected the instant it appears.
  WatchesThe wall setpoint relative to the defender target and how far the room is above target.EffectSuppresses the small correction while the wall preference is inside the safe range.
  Key settings: ComfortEnvelopeEnabled, ComfortEnvelopeTriggerTouches, ComfortEnvelopeHoldMinutes, ComfortEnvelopeMaxOffsetCelsius...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Comfort Compromise
  Blends a repeated wall choice into a temporary target, then fades it back to the website target.
  WatchesThe latest wall setpoint, the website target, and how far the room is above target.EffectTemporarily shifts the defender target the corrections aim for.
  Key settings: ComfortCompromiseEnabled, ComfortCompromiseTriggerTouches, ComfortCompromiseHoldMinutes, ComfortCompromiseDecayMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Comfort Memory
  Learns a small time-of-day target bias from repeated safe wall choices and re-applies it later that hour.
  WatchesThe current hour and the offsets learned for it; the room temperature.EffectAdjusts the defender target by the learned hourly bias.
  Key settings: ComfortMemoryEnabled, ComfortMemoryLearningTouches, ComfortMemoryRetentionHours, ComfortMemoryMaxOffsetCelsius...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Conflict Quiet
  Stands the defender down during an obvious tug-of-war over the thermostat.
  WatchesRecent wall touches within the touch window and how far the room is above target.EffectSuppresses corrections for the stand-down period.
  Key settings: ConflictQuietModeEnabled, ConflictQuietTouchThreshold, ConflictQuietMinutes, ConflictQuietComfortBandCelsius

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Tug-of-War Truce
  Calls a temporary truce when the real thermostat bounces up and down, so answer-back commands do not look like a duel.
  WatchesThe real external thermostat audit log: previous setpoint, new setpoint, timestamp, and source classification.EffectHolds safe corrections until the truce window ends, then lets the normal defender chain continue.
  Key settings: TugOfWarTruceEnabled, TugOfWarTruceMinimumFlips, TugOfWarTruceWindowMinutes, TugOfWarTruceHoldMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Wall Settling
  Waits for someone who is still tapping the wall thermostat to stop before correcting.
  WatchesRecent touches inside the settling window and the room temperature.EffectHolds the correction until the wall stops changing.
  Key settings: WallSettlingGuardEnabled, WallSettlingMinimumTouches, WallSettlingWindowMinutes, WallSettlingBaseSeconds...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Manual Comfort Grace
  Leaves a manual wall change alone while the room still feels comfortable.
  WatchesTime since the wall change and how far the room is above target.EffectSuppresses the correction while the wall change stays comfortable.
  Key settings: ManualComfortGraceEnabled, ManualComfortGraceMinutes, ManualComfortGraceBandCelsius

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Touch Intent
  Reads whether recent wall changes trend warmer, cooler, or mixed, and extends grace for a clear warmer pattern.
  WatchesThe net sum of recent wall setpoint changes inside the intent window.EffectLengthens Manual Comfort Grace when people clearly want warmer air.
  Key settings: TouchIntentEnabled, TouchIntentMinimumTouches, TouchIntentWindowMinutes, TouchIntentNetWarmThresholdCelsius...

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Live card
  
  Cooler Intent Fast Lane
  When people keep dialing the wall cooler, it skips quiet waits so the room cools sooner.
  WatchesThe net cooler movement of recent wall changes and whether the room is above target.EffectBypasses the quiet timing guards for a short window.
  Key settings: CoolerIntentFastLaneEnabled, CoolerIntentMinimumTouches, CoolerIntentWindowMinutes, CoolerIntentHoldMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    Sensor
    Live card
  
  Setpoint Echo
  Waits for Home Assistant to report back the last setpoint before sending another safe command.
  WatchesThe pending command setpoint and whether Home Assistant has echoed it yet.EffectBriefly holds the next safe command to avoid piling commands on a slow integration.
  Key settings: SetpointEchoGuardEnabled, SetpointEchoGraceSeconds, SetpointEchoSafetyBandCelsius

  *Image or external asset omitted from the offline bundle.*
  
    Sensor
    Live card
  
  Repeat Quiet
  Waits before sending the very same thermostat number again.
  WatchesThe setpoint about to be sent versus the last defender command, plus touch and command pressure.EffectHolds an identical follow-up command until the wait elapses.
  Key settings: RepeatCommandGuardEnabled, RepeatCommandMinimumWaitSeconds, RepeatCommandPressureExtraSeconds, RepeatCommandSafetyBandCelsius

  *Image or external asset omitted from the offline bundle.*
  
    Sensor
    Live card
  
  Setpoint Stillness
  Waits until the wall setpoint stops moving before a safe correction answers back.
  WatchesReal Home Assistant climate readings, the current reported setpoint, recent wall touches, and room temperature.EffectDelays only safe corrections until the wall setpoint looks settled.
  Key settings: SetpointStillnessGuardEnabled, SetpointStillnessTriggerTouches, SetpointStillnessRequiredSamples, SetpointStillnessMaxHoldSeconds...

  *Image or external asset omitted from the offline bundle.*
  
    Sensor
    Live card
  
  Sensor Rhythm
  Times nudges to just after the normal Home Assistant reading beat so they look less mechanical.
  WatchesTimestamps of real Home Assistant readings, used to learn the median update interval.EffectDelays the safe correction to align with the sensor&#x27;s update cadence.
  Key settings: SensorRhythmGuardEnabled, SensorRhythmMinimumSamples, SensorRhythmWindowMinutes, SensorRhythmJitterSeconds...

  *Image or external asset omitted from the offline bundle.*
  
    Sensor
    Live card
  
  HVAC Alibi
  Waits for a real HVAC action transition so a safe correction lands near a normal thermostat event.
  WatchesThe current Home Assistant hvac_action, the last action transition, recent wall touches, and room temperature.EffectDelays only safe corrections until a real HVAC action transition or the max hold expires.
  Key settings: HvacActionAlibiEnabled, HvacActionAlibiTriggerTouches, HvacActionAlibiTransitionWindowSeconds, HvacActionAlibiMaxHoldMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    Sensor
    Live card
  
  Telemetry Alibi
  Waits for a normal Home Assistant/weather/usage update before a safe correction, so the nudge is not an isolated event.
  WatchesRecent wall touches, real Home Assistant reading beats, weather samples, Alectra Hui usage updates, and room temperature.EffectDelays only safe corrections until a normal house telemetry update can act as cover.
  Key settings: TelemetryAlibiEnabled, TelemetryAlibiTriggerTouches, TelemetryAlibiMinimumHoldSeconds, TelemetryAlibiMaxHoldMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    Sensor
    Live card
  
  Cooling Runway
  Gives the AC time to work after cooling starts before nudging the setpoint again.
  WatchesThe Home Assistant hvac_action and how long ago cooling started, plus command pressure.EffectHolds the next safe nudge so a fresh cooling cycle is not interrupted.
  Key settings: CoolingRunwayGuardEnabled, CoolingRunwayMinimumSeconds, CoolingRunwayPressureExtraSeconds, CoolingRunwaySafetyBandCelsius

  *Image or external asset omitted from the offline bundle.*
  
    Sensor
    Live card
  
  Room Trend Guard
  Keeps observing when the room is already stable or cooling after a wall change.
  WatchesReal room-temperature samples: the oldest versus newest inside the trend window.EffectHolds the correction while the room is trending cooler on its own.
  Key settings: RoomTrendGuardEnabled, RoomTrendWindowMinutes, RoomTrendStableToleranceCelsius, RoomTrendHoldMinutes

  *Image or external asset omitted from the offline bundle.*
  
    Sensor
    Live card
  
  Thermal Momentum
  Waits when the room is already cooling fast enough to reach target soon on its own.
  WatchesReal room-temperature samples (to estimate cooling rate) and the active cooling action.EffectHolds the correction so existing momentum can finish the job.
  Key settings: ThermalMomentumGuardEnabled, ThermalMomentumMinimumCoolingRateCelsiusPerHour, ThermalMomentumLookAheadMinutes, ThermalMomentumHoldMinutes

  *Image or external asset omitted from the offline bundle.*
  
    Sensor
    Live card
  
  Weather Drift Timing
  Times safe corrections to real outdoor-weather movement instead of firing immediately.
  WatchesReal outdoor-temperature samples (oldest versus newest) inside the weather window.EffectHolds the safe correction until outdoor weather moves.
  Key settings: WeatherDriftGuardEnabled, WeatherDriftWindowMinutes, WeatherDriftMinimumChangeCelsius, WeatherDriftHoldMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    System
    Live card
  
  Website Debounce
  Blocks repeated website button taps for two minutes so the UI does not spam Home Assistant.
  WatchesThe last website command name and time.EffectRejects duplicate website actions until the window clears.
  Key settings: (fixed at 120 seconds)

  *Image or external asset omitted from the offline bundle.*
  
    System
    Live card
  
  Super Defender
  Detects repeated phone/Home Assistant thermostat changes and tightens correction timing without cutting thermostat Wi-Fi.
  WatchesHome Assistant context on climate state changes: user_id, parent_id, and context id.EffectShows source attribution, arms a strict response window, and can bypass quiet timing while cooling is needed.
  Key settings: SuperDefenderModeEnabled, SuperDefenderRemoteChangeThreshold, SuperDefenderWindowMinutes, SuperDefenderHoldMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    System
    Live card
  
  Rival Schedule Watch
  Knows the AC vendor app&#x27;s own temperature schedule (SLEEP / DEEP SLEEP / GOOD MORNING) and defends my temp when a scheduled block pushes the wall warmer while everyone sleeps.
  WatchesThe configured rival AC-app schedule blocks (start time + low/high setpoints per weekday), the live wall setpoint, Home Assistant change context, and the local clock.EffectAttributes schedule pushes in the audit log, announces block boundaries as events, and answers a scheduled warm push back toward my temp without human-style delays.
  Key settings: RivalScheduleWatchEnabled, RivalScheduleSetpointToleranceCelsius, RivalScheduleBypassQuietTiming, RivalScheduleSafetyBandCelsius...

  *Image or external asset omitted from the offline bundle.*
  
    System
    Live card
  
  Cool-Outdoor Shutdown (Open-Window Armistice)
  When it is genuinely cool outside and the forecast says it stays cool, the defender turns the AC fully off — and turns it back on by itself when the weather or the room demands it.
  WatchesThe real outdoor temperature, the hourly Home Assistant forecast over the gate hours, the room temperature, the thermostat mode, and the minimum-off dwell clock.EffectSends climate.set_hvac_mode = off once per cool episode, then a tagged automatic restore.
  Key settings: CoolOutdoorShutdownEnabled, CoolOutdoorShutdownBelowCelsius, CoolOutdoorRestoreMarginCelsius, CoolOutdoorMinimumOffMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    System
    Live card
  
  Siesta Watch (mess hall)
  Lets the whole guard force nap on command; while they sleep the AC eases off and the money it would have spent is banked as food rations.
  WatchesThe siesta timer, the room temperature against the wake band, the budget safety maximum, and the thermostat mode.EffectHolds the whole correction pipeline while the nap timer runs; sends one park/off command at the start.
  Key settings: SiestaEnabled, SiestaThermostatAction, SiestaWakeBandCelsius, SiestaMaxMinutes

  *Image or external asset omitted from the offline bundle.*
  
    System
    Live card
  
  Field Kitchen (food rations)
  Banks unspent AC dollars during siestas and cool-outdoor shutdowns, and spends them on forecast-hot days so the monthly budget eases exactly when cooling matters most.
  WatchesThe pantry balance and cap, the trailing-week compressor duty cycle, the Alectra TOU rate in force, the hourly forecast over the release lookahead, and the AC&#x27;s real per-slice estimated cost.EffectAdjusts the monthly budget&#x27;s over/under bookkeeping; moves no real money and sends no thermostat commands.
  Key settings: FoodRationsEnabled, FoodBalanceMaxCad, FoodReleaseHotThresholdCelsius, FoodReleaseLookaheadHours...

  *Image or external asset omitted from the offline bundle.*
  
    System
    Live card
  
  Desired-State Enforcer
  Makes the owner&#x27;s chosen AC state win automatically: if someone else turns the unit off or moves the setpoint, it restores the exact desired state and keeps it there.
  WatchesHome Assistant HVAC mode, the live setpoint vs the owner&#x27;s target, context.user_id attribution, recent override/assert counts, and the learned interference probability.EffectRestores the desired mode/setpoint, escalates on repeated interference, and notifies — using the trained interference/cadence models to pace itself.
  Key settings: EnforcerModeEnabled, EnforcerTargetTemperatureCelsius, EnforcerEnforceMode, EnforcerEnforceSetpoint...

  *Image or external asset omitted from the offline bundle.*
  
    System
    Live card
  
  Remote Settling Guard
  Gives repeated phone/Home Assistant or automation thermostat changes a quiet settling window before a safe answer-back.
  WatchesHome Assistant change source attribution, recent remote-style change count, room temperature, and the expected setpoint.EffectDelays only safe corrections after remote-style thermostat changes so the response does not look instant.
  Key settings: RemoteSettlingGuardEnabled, RemoteSettlingTriggerChanges, RemoteSettlingWindowMinutes, RemoteSettlingHoldMinutes...

  *Image or external asset omitted from the offline bundle.*
  
    System
    Live card
  
  Alectra Peak Power Saver
  Makes the defender more chill and resource-saving when Alectra Hui reports on-peak, high price, or high power use.
  WatchesAlectra Hui current TOU period, current price, current power, and current plan sensors from Home Assistant.EffectHolds safe cooling during expensive/high-load periods and prefers the saver fan mode.
  Key settings: PeakPowerSaverEnabled, PeakPowerSaverOnPeakEnabled, PeakPowerSaverHighPowerEnabled, PeakPowerSaverPowerThresholdKilowatts...

  *Image or external asset omitted from the offline bundle.*
  
    System
    Live card
  
  Front-door Guard Post
  Pauses the defender and can turn the thermostat off when a real front-door person detector trips.
  WatchesConfigured or auto-discovered Home Assistant front-door person sensors.EffectRuns the kill switch, hides the live boards while paused, and records the source.
  Key settings: FrontDoorKillSwitchEnabled, FrontDoorPersonEntityIds, FrontDoorKillSwitchHoldMinutes, FrontDoorKillSwitchRefreshSeconds...

  *Image or external asset omitted from the offline bundle.*
  
    System
    Live card
  
  Emergency Protocols
  One-tap stand-down modes for too-cold, someone-upset, and suspicion situations.
  WatchesThe chosen protocol and its remaining window.EffectSuppresses corrective commands for the protocol window.
  Key settings: (run from the Controls page)

  *Image or external asset omitted from the offline bundle.*
  
    System
    Live card
  
  Cooling Failure Watch
  Raises a repeating mega-alert when cool mode is demanded but the AC is not really cooling, escalates to a full-site OMEGA alert when a rising room confirms it, then turns the AC off until the room warms 0.5 C.
  WatchesReal Home Assistant data only: hvac_mode, hvac_action, the setpoint, and room-temperature history.EffectSurfaces a red alert, an event log entry, and (on OMEGA) a site-wide overlay. It also turns the AC fully off (a failing unit is only wasting power) and holds it off until the real room temperature rises 0.5 C above the reading captured at shutdown, then restores cool. A human turning the AC back on is always respected.
  Key settings: CoolingFailureWatchEnabled

  *Image or external asset omitted from the offline bundle.*
  
    System
    Guide only
  
  Dynamic Cooldown
  A frequency-based quiet period after a manual thermostat change.
  WatchesHow many wall touches happened recently inside the touch-frequency window.EffectHolds the next correction until the cooldown elapses.
  Key settings: BaseCooldownSeconds, MaxCooldownSeconds, TouchFrequencyWindowMinutes

  *Image or external asset omitted from the offline bundle.*
  
    System
    Guide only
  
  Fan Energy Saver
  Optionally moves the fan to an energy-saving mode when the room is near target.
  WatchesRoom temperature versus target and the thermostat&#x27;s available fan modes.EffectSets the fan to the saver mode; otherwise leaves the fan alone.
  Key settings: FanEnergySaverEnabled, FanEnergySaverThresholdCelsius, FanEnergySaverMode

  *Image or external asset omitted from the offline bundle.*
  
    System
    Guide only
  
  Upstairs Comfort Guard
  Prioritizes cooling when upstairs rooms get hot while someone is home.
  WatchesThe hottest configured (or auto-discovered) upstairs temperature sensor and optional presence entities.EffectLowers the effective target and can bypass quiet timing.
  Key settings: UpstairsComfortEnabled, UpstairsTemperatureEntityIds, UpstairsMaxComfortCelsius, UpstairsComfortTargetCelsius...

  *Image or external asset omitted from the offline bundle.*
  
    System
    Guide only
  
  Schedule &amp; Weather Rules
  Time-of-day target rules, each gated by a weather activation condition.
  WatchesThe active schedule entry for the current day/time and the weather rule.EffectSets the target and whether corrective action runs.
  Key settings: ScheduleEnabled, WeatherActivationMode, (per-rule Days / Start / End / Target / Weather)

  *Image or external asset omitted from the offline bundle.*
  
    Wall touch
    Guide only
  
  Repeated-Raise Surrender
  If a person re-raises the setpoint to about the same value 3+ times in 30 minutes, the defender adopts their number for 4 hours — the human wins the argument.
  WatchesRecent external RAISES (times and values, pruned to a 30-minute window).EffectRaises the effective target to the human&#x27;s number for 4 hours and logs the surrender.
  Key settings: (always on — fixed: 3 raises / 30 min window / 4 h hold / 27 C cap)

  *Image or external asset omitted from the offline bundle.*
  
    System
    Guide only
  
  Tamper Truce
  If the thermostat vanishes right after a correction exchange, assume a frustrated person detached it — stand down 2 hours instead of escalating.
  WatchesHome Assistant reachability, the last defender command time, and recent human touches.EffectRaises the ULTRA OMEGA ALERT, activates a 2-hour stand-down, and records the tamper-truce event.
  Key settings: (always on — fixed: 20 min command window / 45 min touch window / 2 h truce)

  *Image or external asset omitted from the offline bundle.*
  
    Sensor
    Guide only
  
  Wake-Up Truce (door sensor)
  A bedroom door opening at dawn means that person is awake — adopt the warm truce temperature before they ever touch the thermostat.
  WatchesThe configured bedroom door sensor (closed-to-open transitions) during the dawn window.EffectAdopts the truce target for the hold period and logs a friendly good-morning event.
  Key settings: WakeTruceDoorSensorEntityId, WakeTruceWindowStart, WakeTruceWindowEnd, WakeTruceTargetCelsius...



## Failure modes

If **Algorithms** cannot obtain one of its required real inputs, it reports a blocked, held, or unavailable result and leaves the background worker's Home Assistant refresh running. It never fills a missing room reading, audit event, weather sample, usage value, or device state with a simulator value. If a real Home Assistant command is rejected, the user sees the service's actual error and the article's surface remains available for recovery.
## Security considerations

This feature consumes only the configured Home Assistant entity data, local settings, and the audit context named above. Tokens and credentials stay in the server environment; the static documentation site does not collect analytics, transmit search text, or embed third-party assets. Logs and exports should be reviewed before sharing because real entity names and timestamps can identify a household.
## Verification

Verify the shipped behavior at the feature's live page or endpoint, then run the repository's documented build and test commands. Confirm the real-input and real-error paths, keyboard access, reduced-motion behavior, and a 390 px viewport without horizontal overflow. Record the exact commit and workflow result when publishing a release; a static screenshot alone is not proof of a live Home Assistant command.
## Suggested articles

- Feature briefs — find every documented surface and guard.
- Defender Logic — follow the complete decision cycle and its bypass rules.
- Settings — inspect persisted configuration, language modes, and safety limits.
