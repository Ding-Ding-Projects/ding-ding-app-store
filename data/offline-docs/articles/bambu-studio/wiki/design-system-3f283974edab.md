# Design system

Distilled from the canonical in-repo document
md3-design-system.md;
structural-anatomy status is tracked in the
MD3 parity register.
Where this page and those documents differ, the repo documents win.

The same visual language now extends to the static Pages and interactive Home surfaces through the
generated visual showcase:
eleven original WebP assets cover the hero, all nine feature cards, in-app project thumbnails, and
social sharing without baking essential UI copy into raster images.

## One vendored source of truth

The native application draws theme colors, typography, and layout metrics from a single vendored
Material Design 3 kit. The design source is
[`ui-md3/design-system/`](https://github.com/Ding-Ding-Projects/BambuStudio/tree/master/ui-md3/design-system);
the native source of truth is `src/slic3r/GUI/Widgets/MD3Tokens.hpp`, whose token values match the
kit exactly. C++ code resolves colors through `StateColor::semantic(MD3::Role[, ColorScheme])`,
`ThemeColor`, and `MD3::resolve(role, dark, scheme)` rather than hardcoded hexes.

`MD3Tokens.hpp` provides full kit parity (commit `23688c23d`):

- the complete role set, including `OnError`, `OnErrorContainer`, and `InversePrimary`, plus scrim
  and shadow tints;
- an elevation ladder `elev1`–`elev5` (offset-y and blur radius, colored by the theme shadow tint);
- `MD3::Viewport` axis and live colors;
- panel, dialog, and content metrics and shape radii under `MD3::Metrics`, including the pill rule
  `MD3::Metrics::pill_radius(height)` (radius = height / 2, recomputed at paint/layout time so it
  survives DPI and density changes) and, since the later waves, runtime density via
  `MD3::Metrics::active()`;
- the full 11-step `MD3::Type` scale (`headline` through `micro`) with the `Roboto` and
  `Roboto Mono` family constants and the `Material Symbols Outlined` icon-font name; and
- `accentFromSeed()`, the seed-ramp port that regenerates the six accent roles from a seed color.

## Migration coverage

A ground-up migration converted hardcoded theme colors and fonts across essentially the whole GUI
tree — roughly 120 files over six waves: the shared Widgets library and the ImGui theme; chrome and
status bars; Prepare/Plater; the preview renderer and timeline; gizmos and viewport overlays;
Device, StatusPanel, AMS, DeviceTab, and multi-machine surfaces; Settings, parameters, and Search;
the leaf dialogs including calibration; residual files; and the Project webview CSS, with the Home
webview verified tokenized. Numeric and technical values use the `Label::Mono_*` faces backed by
Roboto Mono.

Contextual schemes swap only the accent roles per workspace, resolved by the active workspace:
brand green for Prepare and general UI, Preview purple for the G-code preview, and Device teal for
the printer surfaces.

Functional data colors are deliberately not migrated: filament swatches, G-code feature colors, and
the 3D paint palettes keep their data-bearing meaning.

## Configuration

- The existing appearance setting selects light or dark mode; a change updates the global
  `StateColor` mode before semantic colors are resolved, then repaints the native widget tree.
- The Settings accent color regenerates the accent ramp live through `accentFromSeed()`.
- Contextual scheme selection is driven by the active workspace, not by a user setting.
- Roboto and Roboto Mono (Regular, Medium, Bold) ship under `resources/fonts` and are registered
  privately at startup by `Label::initSysFont`; they do not modify the system font collection.

## Failure modes

- A missing semantic dark-map entry falls back to its light token rather than terminating the app.
- Missing preferred fonts fall back through the existing system font path; CJK locales use their
  bundled families because Roboto does not contain those glyphs.
- Functional data colors are intentionally exempt from the token layer.

## Structural anatomy beyond the token layer

The token document originally recorded the Material Symbols icon-font infrastructure, the
camera-HUD overlay, and some pill-geometry variants as future structural work. The register-driven
waves have since landed the icon font and ImGui glyph atlas, the camera HUD, the rebuilt shared
widget kit, the `MD3Dialog`/MessageDialog family, the kit title bar, the Preferences NavRail with
runtime density/accent controls, and the glyph-to-GL-texture bridge, among others. As of 2026-07-22
the register stands at 120 done / 4 recorded deviations / 5 open (the deep Prepare-sidebar
rebuilds, in flight). The register is the live tracker for exact per-element status.

## Retained theme literals

A small set of raw color literals is kept on purpose where a fixed bitmap asset bakes a color that
a theme role would fight (tokenizing them would invert their contrast in one mode):

- the assembly-tree delete badge (dark badge backing a baked light cross glyph);
- the Helio rating header banner, which stays dark in both themes to match the partner brand asset;
- the preview-timeline current-step marker (coupled white pill + dark digits per the design spec);
- the "unsaved view" amber dot, retained until an amber/warning role exists in the token set.

Each site is anchored and justified in the canonical design-system document.

## Verification

- Local Release builds of the migrated tree succeed (VS2022 BuildTools; dependencies and app).
- The hosted Windows build job succeeded on the migrated tree, and the full publish pipeline is
  green (see [Releases](app-doc://article/bambu-studio.wiki.0558691a66bc6a7a)).
- An element-by-element parity audit against the kit reported the color, token, and typography
  layer complete; residual theme literals were either fixed or intentionally retained as above.
- Fresh full-compositor captures of the fully token-migrated surfaces are pending; the captures in
  the README that predate the sweep are marked as such.
