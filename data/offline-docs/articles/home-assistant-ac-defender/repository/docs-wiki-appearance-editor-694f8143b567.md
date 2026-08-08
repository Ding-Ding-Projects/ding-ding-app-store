---
layout: doc
title: "Appearance editor"
---

# Appearance editor

The **Settings → Appearance** card customizes the website shell without changing any
defender setting or sending a Home Assistant service call. It is available on the
server-rendered Blazor Settings surface and applies the result live through the loaded
`acAppearance` JavaScript bridge.

## Behavior and configuration

- **Theme** selects light or dark shell chrome and keeps the existing header toggle in sync.
- **Density** selects compact, comfortable, or spacious shell spacing.
- **Accent / seed color** has an accessible continuous spectrum picker plus synchronized
  HEX, RGB, HSL, and alpha controls. The translator also reports WCAG contrast against
  the dark and light shell surfaces; values are allow-listed before they reach CSS custom
  properties.
- **Appearance target** can be the whole shell, header, navigation rail, or main content.
  Header/rail/main overrides are persisted separately and inherit the shell accent until a
  target is explicitly changed. The target list is bounded to real rendered surfaces.
- This increment deliberately stops at the high-value HEX/RGB/HSL path and three shell
  targets. Word-depth typography, named/HSV/HWB/Lab/OKLab/CMYK translation, and per-control
  editors remain tracked follow-up work rather than being presented as shipped.
- **UI font family** selects from installed/common families (`Segoe UI`, `Arial`,
  `Cascadia Code`, `Consolas`, and `system-ui`). Each stack keeps a CJK-capable fallback.
- **UI font size** scales from `0.85×` to `1.35×` in bounded `0.05×` steps.

Apply writes schema version `2` to browser `localStorage` under
`ac-defender-appearance`, then updates the shell's CSS variables and theme/density data
attributes. Reset removes that record and applies the documented defaults. The preference
is presentation-only and is deliberately not part of `DefenderSettings`, the worker's
state store, or any Home Assistant request.

## Failure modes

If private browsing or a browser policy rejects `localStorage`, the shell still applies a
change for the current render and the Settings page shows a warning. A malformed or stale
record is normalized to safe defaults; unknown fonts, themes, densities, colors, target
names, alpha values, and out-of-range scales are never interpolated into CSS. A failed
preference write cannot block the real settings save or a thermostat command. Invalid
numeric color text remains a local editor validation message until corrected.

## Security considerations

Appearance values are untrusted browser input. The C# model and the JavaScript bridge both
enforce the same allow-list and bounds before applying them. Only validated HEX colors and
alpha values are used, family names map to fixed CSS stacks, and no preference is
transmitted to Home Assistant or included in logs. The bridge does not fetch fonts, images,
analytics, or any third-party asset. Contrast is calculated locally from the selected color
and fixed shell backgrounds; it is a readability signal, not a promise that every data
color has been changed.

## Verification

Run the focused contract check from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-appearance-editor.ps1
```

Then run `dotnet build`. In a browser, open **Settings → Appearance**, exercise the spectrum,
HEX, RGB, HSL, alpha, and contrast readouts, select each target, and apply light/dark, each
density, each font family, and the font-size range. Reload to verify persistence and use
Reset to verify defaults. Confirm that Dashboard/Defense/Controls still show live Home
Assistant state and that no appearance action emits a defender command.

Suggested articles: Settings, Accessibility,
Architecture, and Deployment.

## Suggested articles

- Feature briefs — find every documented surface and guard.
- Defender Logic — follow the complete decision cycle and its bypass rules.
- Settings — inspect persisted configuration, language modes, and safety limits.
