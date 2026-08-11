# Tab workspace

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

Discover, Installed, Updates, Documentation, Activity, and Settings are six browser-style tabs. They remain in the workspace schema even when closed, so closing a tab never destroys its group/order metadata and the panel can reopen it. The active tab and pinned tabs receive capacity first so the selected page never disappears when space is tight. Pinned tabs are protected from bulk close unless the user explicitly includes them.

The rail docks to the left (the default), right, top, or bottom edge. Settings → Appearance exposes all four choices in the same searchable picker; changing the value dispatches the typed workspace `rail` patch immediately, so the live shell moves without a restart. Top and bottom use horizontal overflow arithmetic; left and right use vertical overflow arithmetic. The choice is persisted per workspace and remains keyboard accessible at every edge.

The rail has four independent discovery searches: the current strip, each group’s member list (each group owns its own search state and anchored regex builder), group names, and a master search across every open tab. Plain text is the default; every field has its own full regex builder, validation, and flags. The context menu also has a local keyboard-accessible search field so its actions can be filtered without changing their semantics. Tab and group menus include **Edit tab appearance…** and **Edit group appearance…**; each opens the shared appearance editor for that element family and restores focus to the originating tab or group header when the editor closes.

Moving a tab into a group uses one **Move… into group…** picker rather than expanding the context menu into one item per group. The anchored picker searches group names, shows each group’s colour and member count, supports keyboard selection, and offers **Create new group** when the bounded group capacity allows it. Moving into a collapsed group preserves that group’s collapsed state.

Tab actions include **Close tabs containing text** and **Close tabs not containing text**. Both show a live count and protected pinned-tab count before the second, plain-language confirmation click. Empty queries and invalid regexes cannot close anything. Closed tabs appear in the same panel with an explicit Reopen action, making the operation reversible.

Keyboard paths include `Ctrl+1`–`Ctrl+6`, `Ctrl+Tab`, `Ctrl+Shift+Tab`, `Ctrl+Shift+P` for pinning, `Ctrl+Shift+G` for a new group, `Ctrl+Shift+K` for rail search, `Shift+F10`/the context-menu key, `Alt+ArrowUp`/`Alt+ArrowDown`, and roving arrow/Home/End focus. Pointer drag is an additional route, not the only one.

The tab action menu shows a shortcut only when that exact chord is registered for the focused tab. Pin/unpin, move up/down, and new-group rows take both their visible key cap and `aria-keyshortcuts` value from the same typed registry used by the live keyboard handler. The visual `<kbd>` text is hidden from assistive technology so a screen reader announces the semantic shortcut once rather than spelling it twice. Menu search also indexes the displayed chord, and actions without a working chord show no placeholder shortcut.

## Configuration

`workspace.v1.json` persists the active tab, complete tab set (including each tab’s open/closed state), pinned state, group membership, group color and collapsed state, order, rail side, label mode, tab height, overflow mode, badge/color-bar preferences, icon-only pins, and rail width. Settings → Appearance exposes reset, JSON export, and bounded import. Older workspace files without `open` are migrated to open tabs.

## Failure modes

An unreadable workspace falls back to defaults. Main-process normalization removes duplicate/unknown IDs, invalid group references, excess groups, impossible pinned-group state, and a closed active tab. A rejected optimistic save restores the last accepted document and raises a notification. The reducer never closes the final open tab, never lets a closed tab become pinned or grouped, and reports protected pinned tabs in the preview.

## Security considerations

The renderer exchanges one typed workspace document. Imports are limited to 64 KB, parsed as JSON, validated, normalized, and persisted by the main process. No path, URL, command, CSS, or arbitrary identifier crosses this bridge. Tab customization cannot hide the destructive confirmation surface.

## Verification

Contract tests enumerate all six tabs, validate four dock edges, legacy `open` migration, workspace storage and normalization, command-registry reachability, and the Appearance picker’s four option values. Focused shortcut tests exercise exact modifier matching, reject extra modifiers, verify shared new-group construction, render every semantic `aria-keyshortcuts` value, prove every displayed chord reaches the shared live matcher, and check context-menu appearance actions plus focus restoration wiring. Source inspection covers keyboard and pointer routes, all four search surfaces, menu filtering, and bulk-close protection. Packaged captures show the left rail and the tab-actions panel at `docs/assets/screenshots/final-tab-actions-runtime.png`; a fresh packaged keyboard drive of these shortcuts and a dedicated runtime capture for every dock edge remain follow-up evidence boundaries.

## Suggested articles

- [Search and regex builder](Search-and-Regex-Builder)
- [Command palette](Command-Palette)
- [Appearance editor](Appearance-Editor)
