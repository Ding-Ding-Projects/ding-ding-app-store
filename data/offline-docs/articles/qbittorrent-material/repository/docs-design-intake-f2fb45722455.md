# Design intake — mapping a Claude Design handoff to the code

This is the checklist for turning a [Claude Design](https://claude.ai/design)
handoff (a self-contained `*.dc.html` prototype under `design/incoming/`) into
the running Qt Quick / C++ app. It records where each kind of design artifact
lands so the next drop is a mechanical mapping rather than a re-discovery.

## 1. Where the handoff lives

- Raw drop: `design/incoming/<date>-<label>/` — committed verbatim, never edited.
- The primary file is `project/*.dc.html`. It is a working prototype:
  - a `PAL` object — the per-style, per-scheme color palette;
  - an `ST` object — the shared status colors;
  - `renderVals()` — every screen's data model and derived colors;
  - the markup — exact geometry (sizes, radii, paddings, motion).
  - Read it directly; it is the source of truth, not a screenshot.

## 2. Artifact → code touch points

| Handoff artifact | Code | Docs |
|---|---|---|
| Color palettes (`PAL`, `ST`) | `src/quick/theme/thememanager.cpp` — `buildStylePalette()` (per-style tables) and the shared status set; `src/quick/qml/theme/Theme.qml` convenience props; `StateColors.qml` semantic mappings | `DESIGN_SYSTEM.md` §1 |
| Typography scale / fonts | `src/quick/qml/theme/Typography.qml`; new TTFs → `resources/fonts/` + `resources/resources.qrc` | §2 |
| Spacing / geometry / radii / motion | `src/quick/qml/theme/Spacing.qml` | §3 |
| Icon set | `src/quick/qml/theme/Icons.qml` (codepoint map) or ligature names via `MDIcon { name: "..." }`; font in `resources/fonts/MaterialSymbolsOutlined.ttf` | §4 |
| Shell chrome (header, nav, status bar, sheets) | `src/quick/qml/shell/` — `AppHeader`, `NavRail`, `Sheet`, `HeaderIconButton`, … | §5 |
| Per-screen layouts | `src/quick/qml/` feature folders: `shell/` (redesigned transfers + sheets), `mainwindow/`, `properties/`, `content/`, `addtorrent/`, `dialogs/`, `options/`, `search/`, `rss/`, `log/`, `workspace/` | `PAGES.md`, `SCREENS.json` |

## 3. Multi-style palettes

The 2026-07-11 handoff ships **three** UI styles, each a full Material 3
palette. They are modeled as `ThemeManager::UiStyle` (TonalRail / SplitDock /
CardFlow), persisted as `Appearance/UiStyle`, and switched live from
Settings → Appearance (each switch is committed to the settings journal). The
active style's roles overwrite the shared role ids in `buildStylePalette()`,
so every existing `Theme.color(id)` consumer restyles automatically — no
per-consumer changes needed. QML branches on layout via `Theme.isTonalRail` /
`Theme.isSplitDock` / `Theme.isCardFlow`.

## 4. Runtime preview channel (no rebuild)

`ThemeManager::loadColorOverrides()` reads a `config.json`
(`{ "colors": {…}, "colors.dark": {…} }`) and applies it live over the base
palette. Use it to A/B a candidate palette from a handoff before committing it
to `thememanager.cpp`.

## 5. Verification harness

The app has a deterministic screenshot mode (used by `scripts/capture-ui.ps1`):

```
qbittorrent.exe --profile-root=<tmp> --capture-ui=<out.png> \
  --capture-theme=light|dark --capture-style=A|B|C \
  --capture-page=<0..4> [--capture-dialog=history|settings-sheet|regex|notifications|options|…] \
  --capture-width=<w> --capture-height=<h>
```

Capture every screen in both themes (and all three styles for shared chrome),
diff against the handoff, and record galleries in `SCREENSHOTS.md`.

## 6. Acceptance checklist

- [ ] Light/dark parity for every role in every style.
- [ ] No orphaned/unused token ids; no hardcoded hex outside the theme layer.
- [ ] `--capture` renders every screen with zero QML warnings.
- [ ] `DESIGN_SYSTEM.md` updated in the same PR as the token changes.
