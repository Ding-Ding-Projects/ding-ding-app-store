# Tab navigation

Navigation is a persistent browser-style tab rail, left by default, holding the six fixed pages. Tabs pin, group, reorder, search with the full regex builder, and overflow into a menu when the rail runs short; the active tab and pinned tabs always stay visible.

- Configuration: `workspace.v1.json` beside settings, saved with a 300 ms trailing debounce; Settings → Appearance edits side, label mode, tab height, overflow mode, badges, colour bars, icon-only pinned tabs, and width, and resets/exports/imports the layout.
- Keyboard: `Ctrl+1`–`Ctrl+6`, `Ctrl+Tab`, `Ctrl+Shift+P` pin, `Ctrl+Shift+G` group, `Ctrl+Shift+K` rail search, `Alt+Arrow` reorder, `Shift+F10` menu, roving tabindex with Home/End. Drag reordering is pointer sugar only.
- Failure: a rejected save reverts to the last accepted document with an error notification; a corrupt file falls back to defaults; deleting a group keeps its tabs and offers Undo.
- Security: only the typed workspace document crosses the bridge — no paths, URLs, or CSS text; import is bounded and revalidated in the main process.
- Verification: renderer typecheck, `npm run build`, and 54 tests pass. Packaged-runtime capture is pending.

Detailed source: `docs/features/tab-navigation.md`.
