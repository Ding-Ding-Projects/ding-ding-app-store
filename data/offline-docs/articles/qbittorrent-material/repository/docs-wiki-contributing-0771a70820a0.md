# Contributing

## Keep changes focused

Use a short-lived `codex/` feature branch, make one logical commit per task, push for CI, merge into `master`, and delete the branch locally and remotely after verification.

## Code and UI expectations

- Preserve persisted preference keys and enum values.
- Keep engine work out of QML; expose it through controllers and models.
- Use the shared Material theme, spacing, typography, icons, and reusable controls.
- Make dialogs responsive and keep wide tables inside their own scroll areas.
- Add accessible names, keyboard behavior, empty states, and error feedback.
- Keep shell controls keyboard-operable with a visible focus state; test header
  icon buttons, the Add/navigation rail, and status-filter chips when changed.
- Route equivalent menu, toolbar, and tray commands through the shared QML
  `Action` objects instead of duplicating behavior at each surface.
- Stage Options edits until **Apply**; **Cancel** must not mutate live state,
  including the tray-icon style.
- Treat bundled and optional resources separately: the About GPL resource must
  load, while missing optional flag SVGs must retain the transparent fallback.

## Documentation workflow

1. Update the canonical Markdown or JSON file.
2. Run `scripts/generate-pages-content.ps1`.
3. Open `docs/index.html` through a local HTTP server.
4. Test plain, regex, filtered, imported, and exported searches.
5. Check desktop, tablet, and mobile widths in light and dark themes.
6. Add or refresh screenshots when visible behavior changes. Keep all 17
   capture filenames, their deterministic logical dimensions, gallery markup,
   and web-manifest entries synchronized.

## Before pushing

Run the relevant build, syntax checks, `git diff --check`, and a visual smoke
test. Exercise shared menu/toolbar/tray actions, the staged tray setting with
both Apply and Cancel, the About GPL notice, and the absent-flag fallback when
those surfaces change. The release workflow will perform the full Windows
installer gate for every pushed commit.
