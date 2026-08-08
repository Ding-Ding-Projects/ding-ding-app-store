# Appearance editor

Every registered element in the shell — shell, title bar, rail, tabs, cards, buttons, dialogs, palette, snackbar, and more — exposes background, text colour, radius, padding, text size, weight, border width, and elevation.

- Configuration: `Ctrl+Shift+E` or Settings → Appearance turns on edit mode; a click or keyboard focus selects the nearest registered element and the docked panel edits it live with its own search box and full regex builder. Reset one, reset all, export, and import are always available; a reset can be undone for ten seconds.
- Application: overrides become `--elx-<element>-<token>` custom properties applied through CSSOM only. The CSP forbids injected stylesheets, so no `<style>`, no `style` attribute, and no generated selector text is ever produced.
- Failure: an unreadable document falls back to no overrides and renames the bad file once; import is all-or-nothing with a truncated sanitised message; contrast problems warn but never block.
- Safety: there is no visibility, display, position, or size token, and the super-confirmation, its keys and slider, the emergency exit, and the window controls are never editable or hideable.
- Verification: renderer typecheck, `npm run build`, and 54 tests pass, including a fuzzed CSS-emitter injection guard and a palette-reachability test over every element/token pair. Packaged-runtime capture is pending.

Detailed source: `docs/features/appearance-editor.md`.
