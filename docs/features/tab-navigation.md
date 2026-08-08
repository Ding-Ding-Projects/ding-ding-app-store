# Tab navigation

## Behaviour

Navigation is a persistent, browser-style tab rail, on the left by default. The six pages — Discover, Installed, Updates, Documentation, Activity, Settings — are fixed: tabs are never opened, duplicated, or closed, so every page stays reachable. Tabs can be pinned to a region at the top of the rail, collected into named colour-coded groups, reordered inside their region, and filtered with a rail search box that has the same full regex builder as every other search surface. The active tab is always rendered, even when its group is collapsed or the rail is too small for the full list.

When the rail runs out of room, the remaining rows move into an overflow menu (or scroll, if that mode is chosen). Pinned tabs and the active tab claim capacity first, and capacity is floored at one row so the active tab and the overflow control can never both disappear.

## Configuration

The layout lives in its own document, `workspace.v1.json`, beside settings rather than inside them, and is written back through a 300 ms trailing debounce. Settings → Appearance edits every rail option: side (left or top), label mode (full, compact, icon-only), tab height (compact, comfortable, tall), overflow mode (menu or scroll), update badges, group colour bars, icon-only pinned tabs, and rail width. The same section resets, exports, and imports the whole layout as JSON.

Keyboard coverage is complete and every shortcut is also a command-palette entry: `Ctrl+1`–`Ctrl+6` activate the nth visible tab, `Ctrl+Tab`/`Ctrl+Shift+Tab` cycle, `Ctrl+Shift+P` pins or unpins the active tab, `Ctrl+Shift+G` groups it, `Ctrl+Shift+K` focuses the rail search, `Shift+F10` or the context-menu key opens the tab menu, `Alt+ArrowUp`/`Alt+ArrowDown` reorder within a region, and arrow keys with Home/End move a roving tabindex across tabs and group headers. Drag-and-drop reordering is pointer sugar only; every one of its outcomes is available from the keyboard.

## Failure modes

A rejected save reverts the optimistic state to the last document the main process accepted and raises an error notification, so the rail never shows a layout that was not stored. A corrupt or unreadable workspace file falls back to the shipped default layout instead of throwing. Unknown tab ids, duplicate ids, group references that no longer exist, and pinned tabs still carrying a group are normalised away in the main process before anything is written back. Deleting a group keeps its tabs and offers an Undo in the notification; tabs are never removed.

## Security considerations

The rail exchanges only the typed workspace document over the existing bridge — no channel names, filesystem paths, URLs, or CSS text. Import takes a string the user chose from a file picker and is validated, normalised, and bounded (64 000 bytes) in the main process; the renderer never learns a path. Nothing in the rail can hide the destructive-action confirmation, and no rail option affects the two-key plus slider super-confirmation.

## Verification

`npx tsc -p tsconfig.renderer.json --noEmit`, `npm run build`, and `npm run test` (54 tests) pass, including contract assertions that the six tab ids still ship, that the renderer never imports Electron or Node, that the workspace document is stored beside settings rather than inside them, and that every tab command is present in the command registry. Packaged-runtime capture of the rail, its overflow menu, and its group behaviour is still pending.

## Suggested articles

Read [appearance editor](appearance-editor.md) for the per-element styling that the rail shares, [update schedule](update-schedule.md) for the badge the Updates tab shows, and [privacy and security](privacy-and-security.md) for the bridge boundary the rail respects.
