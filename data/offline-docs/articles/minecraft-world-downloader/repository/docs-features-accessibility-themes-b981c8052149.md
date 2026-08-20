# Accessibility & themes

> Theming (dark / light / high-contrast) plus an accessibility-options menu — presets and fine-grained toggles for motion, calm mode, focus mode, dyslexia font, and text scaling — across both the web console and the Windows desktop manager.

## What it does

The project ships accessibility and theming controls in two separate front-ends:

- **Web console** (Flask templates + static assets). A floating wheelchair button (bottom-right) opens an "Accessibility" dialog. From there a user can pick:
  - **Theme** — `dark` (default), `light`, `contrast` (high contrast).
  - **Text size** — `normal`, `large`, `xlarge`.
  - **Reading font** — `default` or `dyslexic` (dyslexia-friendly font stack).
  - **Motion** — `full` or `reduced` (disables animations/transitions/smooth-scroll).
  - **Calm** — `off` or `on` (autism-friendly: removes glow/pulse, mutes saturation, flattens shadows).
  - **Focus mode** — `off` or `on` (ADHD: dims all panels except the hovered/focused one).
  - **Presets** — one-click bundles: "ADHD focus", "Calm", "Easy reading", "Low vision".
  - **Reset to defaults**.

  Choices persist per-device in `localStorage`. When the user hasn't chosen, the system honours OS preferences (`prefers-color-scheme: light`, `prefers-reduced-motion: reduce`, `prefers-contrast: more`). The console also provides a keyboard "Skip to content" link and a strong always-visible focus outline.

- **Windows desktop manager** (WPF). The app header has a persisted **Theme** combo box (`Dark` / `Light` / `High contrast`) and **Large text** control. Settings adds persisted font family/scale, language mode, and independent English/Cantonese funny levels. Browser-style tabs have visible keyboard focus, and non-decision status/error messages appear in a corner toast with a reviewable Notifications tab.

The two front-ends are independent implementations that share the same colour palettes and intent, but no code.

## How it works

### Web console

The logic lives entirely client-side in `web/static/a11y.js` (an IIFE) with the matching CSS in `web/static/style.css`. There is no server involvement — no Flask route, config key, or CLI flag.

Flow:

1. **State model.** `KEYS` defines six settings, each with an HTML attribute name, allowed `values`, and a default (`def`):
   - `theme` -> `data-theme` (`dark`/`light`/`contrast`, def `dark`)
   - `motion` -> `data-motion` (`full`/`reduced`, def `full`)
   - `calm` -> `data-calm` (`off`/`on`, def `off`)
   - `focus` -> `data-focus` (`off`/`on`, def `off`)
   - `font` -> `data-font` (`default`/`dyslexic`, def `default`)
   - `scale` -> `data-scale` (`normal`/`large`/`xlarge`, def `normal`)
2. **Load / persist.** `load()` reads JSON from `localStorage` under the key `wdl.a11y`; `save()` writes it back. Both are wrapped in try/catch so a disabled or full storage never breaks the page.
3. **System defaults.** `withDefaults(state)` fills in unset values from `matchMedia` queries: light scheme -> `theme:light`, reduced-motion -> `motion:reduced`, more-contrast -> `theme:contrast`. These only apply when the corresponding key isn't already chosen.
4. **Apply.** `apply(state)` iterates `KEYS` and sets `data-*` attributes on `document.documentElement` (`<html>`). To keep the DOM tidy, any value equal to its default is *removed* rather than set — except `theme`, which is always written so the default `dark` is explicit. CSS selectors like `html[data-theme="light"]`, `html[data-motion="reduced"]`, `html[data-calm="on"]`, `html[data-focus="on"]`, `html[data-font="dyslexic"]`, and `html[data-scale="large"|"xlarge"]` then take effect. `apply()` runs immediately on load (before UI is built) so there's minimal flash.
5. **UI build.** `buildUi()` (run on `DOMContentLoaded`, or immediately if the document is already parsed) creates two elements appended to `<body>`: a `.a11y-fab` button (`♿`, `aria-haspopup="dialog"`) and a `.a11y-panel` (`role="dialog"`). `render()` rebuilds the panel's inner HTML — a presets row plus one `row()` per setting. Each `row()` renders a segmented group of buttons; the currently-selected value gets `aria-pressed="true"`.
6. **Interaction.** A single delegated click handler on the panel inspects `data-*` on the clicked button: `data-preset` -> `applyPreset()`, `data-key`+`data-val` -> `set(key, val)`, or `.a11y-reset` -> clear state. The FAB toggles `.open` on the panel and updates `aria-expanded`; `Escape` closes the panel.
7. **Setters.** `set(key, value)` mutates `state`, saves, applies, and re-renders (so `aria-pressed` updates). `applyPreset(preset)` replaces the whole `state` object with a fixed bundle (preserving the current theme for `adhd`/`autism`), then saves/applies/renders:
   - `adhd` -> motion reduced, focus on, scale large.
   - `autism` -> motion reduced, calm on, scale normal.
   - `reading` -> theme light, motion reduced, dyslexic font, scale large.
   - `lowvision` -> theme contrast, motion reduced, scale xlarge.

The CSS also defines, independent of any toggle: a `.skip-link` (visually offscreen until focused), a strong `:focus-visible` outline on interactive elements, and a global `@media (prefers-reduced-motion: reduce)` rule that disables animation/transition regardless of the JS setting.

The script is loaded via `<script src=".../a11y.js">` at the bottom of `dashboard.html`, `login.html`, and `map.html`, so the menu appears on every page. The `.skip-link` element itself is only present in `dashboard.html`.

### Desktop manager (WPF)

Implemented in `desktop/MainWindow.xaml` (controls + brush resources) and `desktop/MainWindow.xaml.cs` (handlers).

- **Mutable brushes.** Eight `SolidColorBrush` resources (`Bg`, `Surface`, `Surface2`, `Outline`, `Text`, `Muted`, `Accent`, `Danger`) are declared with `po:Freeze="False"` (the `po` namespace is `presentation/options`). Staying unfrozen lets them be recoloured live.
- **Theme switch.** The `ThemeBox` combo (`Dark`/`Light`/`High contrast`) raises `Theme_Changed`, which reads the selected item's text and calls `ApplyTheme(name)`. `ApplyTheme` switches on the name and calls `SetBrush(key, hex)` for each of the eight brushes, then sets the window `Background` to the `Bg` brush. `SetBrush` recolours the existing brush in place when it's a non-frozen `SolidColorBrush`, otherwise replaces the resource — a defensive fallback so a frozen brush can't crash the window on launch.
- **Large text.** The `LargeTextBox` checkbox raises `LargeText_Changed`, which sets the `RootScale` `ScaleTransform` (a `LayoutTransform` on the root `StackPanel`) to `1.25` when checked, else `1.0`, scaling the whole UI.
- **Accessibility metadata.** Both controls carry `AutomationProperties.Name` and `ToolTip` for screen-reader / hover support.

The desktop palettes mirror the web ones (e.g. light `#F4F6FB`/`#1A9E5B`, high-contrast `#000000`/`#FFFFFF`/`#00E676`), though the dark base differs slightly (`#0F1419` desktop vs `#0d1117` web).

### Jar GUI (JavaFX)

The JavaFX GUI supports the same three themes: **dark** (base, `ui/dark.css`, referenced by the FXML),
**light** (`ui/light.css`), and **high contrast** (`ui/contrast.css`). Light/contrast are *override*
stylesheets — `GuiManager.applyTheme` appends the selected override to the scene **root node's**
stylesheet list after `dark.css` (the root, not the Scene: in JavaFX a parent node's stylesheets outrank
the Scene's, so a scene-level override would silently lose). Select with `--gui-theme dark|light|contrast`
or the **Theme** picker on the settings window's Extras tab, which saves to `config.json` and calls
`GuiManager.reapplyTheme()` to restyle every open window live. Palettes match the web/desktop themes.

## Key files

- `web/static/a11y.js` — the entire web accessibility/theme engine: state model, localStorage persistence, system-preference defaults, the floating FAB + dialog UI, presets, and `data-*` application on `<html>`.
- `web/static/style.css` — all the theme/accessibility CSS: light & high-contrast palettes, reduced-motion / calm / focus / dyslexic-font / text-scale rules, `:focus-visible` outline, `.skip-link`, and the `.a11y-fab` / `.a11y-panel` styling.
- `web/templates/dashboard.html` — main console page; includes the `.skip-link`, the `#main` landmark, and loads `a11y.js`.
- `web/templates/login.html`, `web/templates/map.html` — also load `a11y.js` so the menu is available everywhere.
- `desktop/MainWindow.xaml` — WPF brush resources (`po:Freeze="False"`), the `ThemeBox` combo, the `LargeTextBox` checkbox, and the `RootScale` transform.
- `desktop/MainWindow.xaml.cs` — `Theme_Changed`, `ApplyTheme`, `SetBrush`, and `LargeText_Changed` handlers.

## Configuration / flags

None. There are no CLI flags, server-side config keys, or settings-file entries for this feature.

- Web preferences are stored client-side only, in `localStorage` under the key `wdl.a11y` (per browser/device). The DOM contract is the set of `data-*` attributes on `<html>` listed under "How it works".
- Desktop theme/large-text selections are runtime UI state and are **not** saved to the desktop `Settings` (unlike data folder, ports, image, login, etc.); they reset to Dark / normal on each launch.

## Usage

**Web console:** Click the round `♿` button in the bottom-right corner. In the panel, either click a preset (ADHD focus / Calm / Easy reading / Low vision) or fine-tune individual rows (Theme, Text size, Reading font, Motion, Calm, Focus mode). Changes apply instantly and are remembered on that device. "Reset to defaults" clears them. Keyboard users can press Tab to reach the "Skip to content" link, and `Escape` closes the panel. With no choices made, the console follows the OS's colour-scheme / reduced-motion / contrast preferences.

**Desktop manager:** Use the **Theme** dropdown in the top-right of the window header to switch Dark / Light / High contrast, and tick **Large text** to enlarge everything to 1.25x. These take effect immediately.

## Verification

The desktop preference and localization foundations are covered by `desktop.tests`; the web implementation remains verified by its own source/runtime checks:

- The web side is self-contained client JS/CSS with no backend coupling; the `data-*` attribute names in `a11y.js` match the CSS selectors in `style.css`, and `a11y.js` is referenced by all three templates.
- The desktop side's `SetBrush` keys match the eight `po:Freeze="False"` brush resources declared in `MainWindow.xaml`, and the `Theme_Changed` / `LargeText_Changed` handlers are wired to the `ThemeBox` / `LargeTextBox` controls.

This should be treated as compile/read-verified rather than integration-tested or screenshot-verified.

## Gotchas & limitations

- **Two independent implementations.** Web and desktop share palettes/intent but no code; a change to one does not affect the other, and their dark bases differ slightly.
- **Persistence asymmetry.** Web prefs persist in `localStorage` per device/browser (cleared by clearing site data and not synced across devices); desktop theme/large-text do **not** persist and reset every launch.
- **Theme attribute always written.** Because `apply()` always sets `data-theme` (even for `dark`), other tools/CSS shouldn't assume the absence of `data-theme` means default.
- **`prefers-color-scheme: dark` is not auto-detected** — only light, reduced-motion, and more-contrast media queries seed defaults; dark is simply the built-in default.
- **External font dependencies.** The dyslexic stack prefers `"Atkinson Hyperlegible"` and the base UI uses Google-hosted Roboto / Material Symbols via `@import`; if those aren't installed/reachable the browser falls back (e.g. Comic Sans/Verdana for dyslexic mode), so the exact look depends on available fonts and network access.
- **Calm mode** applies a `saturate(0.8)` filter on `<html>` while also forcing `filter: none` on descendants; the page-level desaturation is the intended effect.
- **Desktop "Large text"** uses a `LayoutTransform` scale, not a font-size change, so it scales layout geometry uniformly (including spacing), and only the two fixed steps (1.0 / 1.25) exist.
- **Skip link** exists only on `dashboard.html`; `login.html` and `map.html` load the menu but have no skip-to-content link.

## Open items

None known.
