# Command palette

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

`Ctrl+Shift+F` opens the global palette. Its registry is built from the same tables that define pages, settings, schedule fields, appearance elements/tokens, tab/group state, search surfaces, and current catalog apps. Results are grouped by Pages, Tabs, Appearance, Schedule, Search, Settings, and Apps. Arrow keys change the active option, Enter runs it, Tab is trapped inside the dialog, Escape closes it, and closing restores focus to the invoker.

Page and app results navigate to their surface. Setting, schedule, and appearance results open the owning sub-tab or editor and focus the target. Command results perform the same typed action used by the original control.

## Configuration

The palette has its own plain-text-first search and adjacent full regex builder. Browse mode limits each group to six rows; a non-empty query raises the per-group limit to 40. There is one default shortcut and no competing `Ctrl+K` binding.

## Failure modes

A disabled registry entry remains visible but cannot run. No matches produce an honest empty state. A result whose target is absent because source tables drift would fail to focus; completeness tests therefore enumerate static pages, settings, schedules, elements, and search surfaces. This revision shows command-like rows rather than every setting's live inline control, a known limit of the richer global-memory target.

## Security considerations

Rows contain typed `Action` objects, not executable strings. Command identifiers route through a closed switch in the renderer, while privileged work still crosses a typed preload bridge and is revalidated in the main process. Search text never becomes a command or IPC channel.

## Verification

Registry tests assert page, settings, appearance, schedule, search, tab, and app reachability. Source inspection proves focus trapping/restoration, keyboard selection, and exact `Ctrl+Shift+F` activation. The hidden-desktop capture at `docs/assets/screenshots/final-command-palette-runtime.png` shows the production command palette with page and tab results. Representative teleport-target and focus-highlight interaction remains a follow-up runtime evidence boundary.

## Suggested articles

- [Search and regex builder](Search-and-Regex-Builder)
- [Settings, language, and display name](Settings-Language-and-Display-Name)
- [Appearance editor](Appearance-Editor)
