---
layout: doc
title: "Thermostat OFF super-confirmation"
---

# Thermostat OFF super-confirmation

The **Controls → OFF** action and the compact Dashboard thermostat control use a native,
anchored super-confirmation gate before they can send a destructive command to the real
Home Assistant climate entity. The gate is safety UI in the Blazor app itself; it is not a
helper site, a second app, or a simulated thermostat.

## Behavior and configuration

The gate identifies the exact affected device (`climate.dining_room`) and the exact
Home Assistant call (`climate.set_hvac_mode → off`). It presents two separately operated
arming keys. The full-range slider remains disabled until both keys are on, and the
command callback is invoked only after the slider reaches its completed range. A 30-second
arming timeout disarms both keys if the user pauses.

The surface is an anchored dialog beside the originating OFF control. **Emergency exit**
and Escape cancel without sending a Home Assistant request. Completion and
in-progress states use non-blocking status animation; `prefers-reduced-motion: reduce`
removes the animation while preserving the state text and keyboard behavior. Focus is
returned to the originating OFF control after cancellation or authorization.

When the Controls shortcut is used, the defender is stood down only after authorization and
before the real OFF call, preventing Cool Mode Restore from immediately undoing a deliberate
stand-down. If the master-switch flow has already paused the defender and the user cancels
the gate, the thermostat is parked at the configured stand-down value instead. All calls
still pass through the existing serialized `AcDefenderService` Home Assistant pipeline.

## Failure modes

- Missing either key, an incomplete slider, an empty gesture, or an Escape/cancel action
  sends no command.
- A superseded defender operation stops the sequence before OFF and reports that no OFF
  command was sent.
- Home Assistant rejection, timeout, or an unavailable climate entity follows the existing
  real-command error path and is shown as a dismissible notification; no fake state is
  substituted.
- If focus restoration cannot find the original element, the shared accessibility bridge
  falls back to the main content landmark.

## Security considerations

The gate never collects credentials and never sends keys, slider values, or sample text to
the network. It only gates the already-authenticated, server-side Home Assistant command.
The affected entity and command are rendered as facts, while the visual animation is
presentation-only. The emergency exit remains available, and Escape is handled at the
dialog root so keyboard and assistive-technology users have the same cancellation path.

## Verification

Run the focused regression runner from the repository root:

```powershell
dotnet run --project HomeAssistantAcDefender.Tests/HomeAssistantAcDefender.Tests.csproj --configuration Release --no-build
```

The runner checks that Controls and Dashboard contain the gate, that both keys gate the
slider and focus-return bridge, and that the reduced-motion contract remains present. Then
run `dotnet build HomeAssistantAcDefender.csproj --configuration Release --no-restore`.
In a browser, sign in, open **Controls**, click **OFF**, verify the exact entity/command
facts, test one-key-only and partial-slider states, cancel with Emergency exit and Escape,
and confirm focus returns to the OFF button. Repeat from the Dashboard thermostat popover.

Suggested articles: Controls, Emergency protocols,
Accessibility, Command palette, and
Architecture.

## Suggested articles

- Feature briefs — find every documented surface and guard.
- Defender Logic — follow the complete decision cycle and its bypass rules.
- Settings — inspect persisted configuration, language modes, and safety limits.
