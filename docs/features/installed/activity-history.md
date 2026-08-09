---
id: activity-history
title: Activity history and export
titleYue: 操作記錄同匯出
category: installed
status: shipped
summary: Appends every install, build, and uninstall result, offers composed filters, exports the selected or filtered log, and links into local version history.
---
# Activity history and export

## Behaviour

Every install, source-build attempt, update, and uninstall result flows through one recording helper. Each JSONL entry has a random identifier, timestamp, app identifier and display name, action kind, success flag, and the exact result message. The Activity page lists newest first and combines its own search with action, result, and an advanced date range. Its format picker exports JSON, JSON Lines, YAML, TOML, XML, CSV, TSV, Markdown, HTML, SQLite-compatible SQL, TypeScript, JavaScript, Python, Go, Rust, JSON Schema, Protocol Buffers, or a bounded ZIP archive.

The date filter has a native start/end calendar picker, a typed field that accepts plain ISO dates or the active language's common local slash order, a month/year jump control, a 42-cell keyboard-accessible calendar grid, and named Today/7 days/30 days/All time presets. A partial or invalid value is kept and announced inline; it fails closed to no matching rows rather than silently widening the result set. Start and end bounds are inclusive local calendar days.

Rows support checkbox selection, Shift-range selection, select-all for the currently shown result set, and inverse selection. Copy and export use the selected rows when selection exists and otherwise use the filtered view; counts always distinguish selected, shown, and total records. **Open in VS Code** uses the same filtered selection: text formats are written as complete documents, while ZIP is validated and extracted into an app-owned workspace before VS Code opens that folder. Deletion remains unavailable because operation history is append-only.

Successful operations also attempt a local Git snapshot of the installed-app and settings documents in an isolated repository under the App Store's history directory. Snapshots are append-only commits; no repository is created inside a user's project.

The adjacent **Local versions** browser lists those snapshots, loads a bounded diff, accepts one-line labels, and offers an explicit two-key/full-slider restore. Restore preserves the current state first and records a new revision after applying only the App Store-owned files; it never rewrites history.

## Configuration

The activity search is plain text by default and has its own adjacent full regex builder. Action filters are derived from the actions actually present in history, show a live count beside each action, and allow multiple actions at once; an empty history never invents filter choices. Result filters cover succeeded or failed; date filtering composes with all of them. Exports serialize only the explicit selection or current filtered rows. The picker states UTF-8 encoding, LF line endings, and the schema for the chosen format. JSON is the durable machine record; JSON Lines remains stream-friendly; schema and proto exports describe `HistoryEntry` rather than pretending to include live history data. ZIP is the only archive format advertised: it contains fixed relative members `manifest.json`, `history.jsonl`, `history.json`, and `README.txt`, records each data-file byte count and SHA-256 in the manifest, and names JSON Lines as the re-import route. No 7z controls or claims are presented because no reviewed 7z dependency is declared.

## Failure modes

An absent log or local repository is an honest empty state. Reads reject logs above 10 MB and bound the parsed view to the newest 10,000 entries; version browsing is bounded to 200 commits and 120 KB per diff. A history append or local Git failure is swallowed by the operation path so it never reverses the primary install or removal. Invalid and partial date input keeps the typed value visible, reports the exact field problem, and shows no rows until corrected. Invalid revision IDs, incomplete snapshots, malformed JSON, and failed preservation/restore commits fail closed without claiming a restore. Archive requests reject duplicate, stale, malformed, or oversized record selections and fail closed before writing bytes; a filtered view with no rows keeps Export disabled.

## Security considerations

Entries contain operation results already shown to the user, not credentials, tokens, release bytes, or arbitrary file contents. Snapshots copy only the app-owned installed and settings documents. Child Git processes run hidden with a local application identity, fixed full-hex revisions, no system Git configuration, and never fetch or push. Restore never accepts a path or command from the renderer. Delimited values quote commas, tabs, quotes, and line breaks; XML/HTML escape markup; SQL quotes values; and every generated data module embeds the same complete record fields. The ZIP bridge accepts only UUID record IDs, re-reads matching persisted entries in the main process, applies strict field and count bounds, and writes only fixed relative member names. Nested documents such as settings, layout, and appearance remain JSON-only so their importer does not receive a lossy conversion.

## Verification

Contract tests prove operations route through the recording helper, every registered activity format keeps the test record, the format metadata stays UTF-8/LF, the date parser/range matcher handles ISO, local dates, invalid/partial input, inclusive bounds, and presets, and the VS Code bridge has a typed archive route. Archive tests extract the real ZIP, verify its fixed relative members, re-import one JSON object per JSONL line, and compare manifest byte counts and SHA-256 values. Versioning contracts prove the fixed state allowlist, bounded diff, label metadata commit, full-ID validation, before/after restore snapshots, and typed IPC/UI controls. Source inspection proves bounded reads, JSONL append, snapshot isolation, typed archive IDs, safe extraction, and non-blocking snapshot failure. Runtime capture at `docs/assets/screenshots/activity-runtime.png` predates the picker, archive action, and version browser and does not prove every future operation or calendar interaction was recorded.

## Suggested articles

- [Installed app discovery](installed-app-discovery.md)
- [Verified installer operations](../installation/verified-installer-operations.md)
- [Privacy and security](../security/privacy-and-security.md)
- [Local history and version restore](history-versioning.md)
