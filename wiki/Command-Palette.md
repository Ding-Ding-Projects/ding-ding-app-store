# Command palette

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

`Ctrl+Shift+F` opens the global palette (there is no competing `Ctrl+K` palette shortcut). Its registry is built from the same tables that define pages, settings, schedule fields, appearance elements/tokens, tab/group state, search surfaces, and current catalog apps. Results are grouped by Pages, Tabs, Appearance, Schedule, Search, Settings, and Apps. Arrow keys change the active option, Enter or Space runs it, Tab is trapped inside the dialog, Escape closes it, and closing restores focus to the invoker.

Page and app results navigate to their surface. Setting, schedule, and appearance results open the owning sub-tab or editor and focus the target. Command results perform the same typed action used by the original control. Rows for settings, schedule values, and appearance tokens expose the real control inline: select menus, sliders, colour inputs, switches, and bounded text fields. Changing an inline control sends the same typed action as the owning settings surface and keeps the palette open so several values can be adjusted in one pass.

Every action carries an optional typed destination (surface, article, tab, group, focus id, or appearance element). Selecting a result applies that destination, returns focus to the exact control, and briefly highlights it. Group destinations preserve collapsed state; revealing a tab or article does not rewrite unrelated tabs, searches, or preferences.

## Configuration

The palette has its own plain-text-first search and adjacent full regex builder. Browse mode limits each group to six rows; a non-empty query raises the per-group limit to 40. Inline control values are bounded by the same schemas as Settings, Schedule, and Appearance, including option allow-lists, slider ranges, colour validation, and text length limits.

## Failure modes

A disabled registry entry remains visible and is announced as unavailable. No matches produce an honest empty state. A result whose target is absent because source tables drift remains actionable only through its owning surface; completeness tests enumerate static pages, settings, schedules, elements, tabs, groups, and search surfaces, while the runtime destination helper fails closed without guessing a path. Invalid or unsupported inline values are rejected by the typed action boundary and do not close the palette.

## Security considerations

Rows contain typed `Action` objects and bounded `EntryControl` metadata, not executable strings or filesystem paths. Command identifiers route through a closed switch in the renderer, while privileged work still crosses a typed preload bridge and is revalidated in the main process. Search text and inline values never become a command or IPC channel; colour values are converted to the allow-listed appearance schema before dispatch.

## Verification

Registry tests assert page, settings, appearance, schedule, search, tab, group, and app reachability plus control metadata and typed destinations. Renderer contract tests cover inline range/colour/switch controls, `Ctrl+Shift+F`, and temporary target highlighting. Source inspection proves focus trapping/restoration and exact keyboard activation. The hidden-desktop capture at `docs/assets/screenshots/final-command-palette-runtime.png` shows the production command palette; a packaged runtime drive of every inline control and each teleport destination remains an evidence boundary for the next capture pass.

## Suggested articles

- [Search and regex builder](Search-and-Regex-Builder)
- [Settings, language, and display name](Settings-Language-and-Display-Name)
- [Appearance editor](Appearance-Editor)
