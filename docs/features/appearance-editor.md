# Appearance editor

## Behaviour

Every rendered element in the shell is registered for appearance editing: the shell, title bar and its brand and badge, the rail and its tabs and group headers, the command-palette hint, the content surface, page headings and titles, search fields, the regex builder, app cards and their titles and descriptions, status pills, filled/tonal/text/icon buttons, chips, the update banner, corner notifications, empty states, activity rows, documentation articles, settings and schedule cards, dialogs, the command palette, and the snackbar.

Edit mode (`Ctrl+Shift+E`, the Settings → Appearance switch, or the palette) marks the shell, outlines the element under the pointer, and turns a click or an `Enter`/`Space` press into a selection instead of the element's own action — so edit mode can never start an install, a build, or an uninstall. A `focusin` listener selects the nearest registered ancestor for keyboard-only users. The docked side panel shows an ancestor breadcrumb, so any level of the covering hierarchy is reachable, and edits apply live.

Each element exposes only the tokens that make sense for it: background, text colour, corner radius, padding scale, text size, text weight, border width, and elevation. There is no visibility, display, position, or size token: the super-confirmation, its two keys, its slider, the emergency exit, the destructive button, and the window controls are neither editable nor hideable.

## Configuration

Overrides live in `appearance.v1.json`, edited through the panel's own search box and full regex builder, its Colour/Shape/Type/Layout sub-tabs, and MD3 controls (role select plus colour picker plus paired hex field, chip groups, and a stepped range with `aria-valuetext`). Reset one element, reset everything, export, and import are available from the panel and from Settings → Appearance, which also lists every overridden element with its token count and a jump-to-edit action. A reset can be undone from the notification for ten seconds.

Values are emitted as `--elx-<element>-<token>` custom properties from a closed set of names and values and applied with `documentElement.style.setProperty`. Every stylesheet rule reads them as `var(--elx-…, <shipped default>)`, so overrides layer above the theme, density, and accent settings and survive changing them.

## Failure modes

An unreadable stored document falls back to no overrides, renames the bad file once instead of destroying it, and raises a corner notification. Import is all-or-nothing: the payload is size-checked before parsing, validated against the export schema, and rejected with a truncated, sanitised message that never contains a filesystem path, raw import text, or a raw validation error. Empty override objects are pruned on write, so "has overrides" is unambiguous. If the selected element is not on screen — for example after a tab switch — the panel keeps the selection, says so, and stays editable. Low-contrast pairs raise an advisory warning with a one-click fix; they are never blocked.

## Security considerations

The page's Content-Security-Policy has no `unsafe-inline`, so the editor never injects a stylesheet, never writes a `style` attribute, and never generates selector text. Property names are built only from registry constants and token suffixes, values come only from closed maps or a hex re-validated at emit time, and a final guard drops any pair containing `;`, braces, angle brackets, `url(`, `@import`, `expression(`, comment syntax, or a newline. The renderer sends only a typed element key and override object; the main process is the enforcement point and rejects unknown keys, unknown tokens, tokens an element does not own, and reserved record keys such as `__proto__`.

## Verification

`npx tsc -p tsconfig.renderer.json --noEmit`, `npm run build`, and `npm run test` (54 tests) pass, including a fuzzed injection guard over the CSS emitter, schema tests for unknown keys/tokens and prototype-pollution payloads, an export/import round-trip, a check that the renderer applies overrides through CSSOM and contains no `innerHTML`, `setAttribute('style')`, or `dangerouslySetInnerHTML`, and a registry test that every element/token pair is reachable from the command palette. Packaged-runtime capture of edit mode and the panel is still pending.

## Suggested articles

Read [tab navigation](tab-navigation.md) for the rail options that sit beside these tokens, [privacy and security](privacy-and-security.md) for the renderer boundary, and [verification](verification.md) for what the checks do and do not prove.
