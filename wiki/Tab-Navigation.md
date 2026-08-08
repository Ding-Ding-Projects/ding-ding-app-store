# Tab workspace

> **Status: shipped.** This wiki page is generated from the canonical categorized article.


## Behaviour

Discover, Installed, Updates, Documentation, Activity, and Settings are six fixed browser-style tabs. They cannot be opened, duplicated, or closed, which preserves access to every primary page. Tabs can be pinned into a protected region, reordered within their region, assigned to named color-coded groups, collapsed with their group, or reached through a searchable overflow. The active tab and pinned tabs receive capacity first so the selected page never disappears when space is tight.

Keyboard paths include `Ctrl+1`–`Ctrl+6`, `Ctrl+Tab`, `Ctrl+Shift+Tab`, `Ctrl+Shift+P` for pinning, `Ctrl+Shift+G` for a new group, `Ctrl+Shift+K` for rail search, `Shift+F10`/the context-menu key, `Alt+ArrowUp`/`Alt+ArrowDown`, and roving arrow/Home/End focus. Pointer drag is an additional route, not the only one.

## Configuration

`workspace.v1.json` persists the active tab, complete fixed tab set, pinned state, group membership, group color and collapsed state, order, rail side, label mode, tab height, overflow mode, badge/color-bar preferences, icon-only pins, and rail width. Settings → Appearance exposes reset, JSON export, and bounded import. This revision supports left or top docking; right and bottom are not implemented.

## Failure modes

An unreadable workspace falls back to defaults. Main-process normalization removes duplicate/unknown IDs, invalid group references, excess groups, and impossible pinned-group state. A rejected optimistic save restores the last accepted document and raises a notification. Deleting a group keeps its member tabs and offers a short undo; deleting a tab is impossible.

## Security considerations

The renderer exchanges one typed workspace document. Imports are limited to 64 KB, parsed as JSON, validated, normalized, and persisted by the main process. No path, URL, command, CSS, or arbitrary identifier crosses this bridge. Tab customization cannot hide the destructive confirmation surface.

## Verification

Contract tests enumerate all six tabs, validate workspace storage and normalization, and check command-registry reachability. Source inspection covers keyboard and pointer routes. Packaged captures show the basic rail; overflow and group interaction still need a dedicated runtime capture.

## Suggested articles

- [Search and regex builder](Search-and-Regex-Builder)
- [Command palette](Command-Palette)
- [Appearance editor](Appearance-Editor)
