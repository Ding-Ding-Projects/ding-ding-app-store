# Activity history and export

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

Every install, source-build attempt, update, and uninstall result flows through one recording helper. Each JSONL entry has a random identifier, timestamp, app identifier and display name, action kind, success flag, and the exact result message. The Activity page lists newest first and combines its own search with action, result, and an advanced date range. Its format picker exports JSON, JSON Lines, YAML, TOML, XML, CSV, TSV, Markdown, HTML, SQLite-compatible SQL, TypeScript, JavaScript, Python, Go, Rust, JSON Schema, or Protocol Buffers.

The date filter has a native start/end calendar picker, a typed field that accepts plain ISO dates or the active language's common local slash order, a month/year jump control, a 42-cell keyboard-accessible calendar grid, and named Today/7 days/30 days/All time presets. A partial or invalid value is kept and announced inline; it fails closed to no matching rows rather than silently widening the result set. Start and end bounds are inclusive local calendar days.

Rows support checkbox selection, Shift-range selection, select-all for the currently shown result set, and inverse selection. Copy and export use the selected rows when selection exists and otherwise use the filtered view; counts always distinguish selected, shown, and total records. Deletion remains unavailable because operation history is append-only.

Successful operations also attempt a local Git snapshot of the installed-app and settings documents in an isolated repository under the App Store's history directory. Snapshots are append-only commits; no repository is created inside a user's project.

## Configuration

The activity search is plain text by default and has its own adjacent full regex builder. Action filters cover install, update, build, and uninstall; result filters cover succeeded or failed; date filtering composes with all of them. Exports serialize only the explicit selection or current filtered rows. The picker states UTF-8 encoding, LF line endings, and the schema for the chosen format. JSON is the durable machine record; JSON Lines remains stream-friendly; schema and proto exports describe `HistoryEntry` rather than pretending to include live history data.

## Failure modes

An absent log is an honest empty state. Reads reject logs above 10 MB and bound the parsed view to the newest 10,000 entries. A history append or local Git failure is swallowed by the operation path so it never reverses the primary install or removal. Invalid and partial date input keeps the typed value visible, reports the exact field problem, and shows no rows until corrected. The present renderer does not surface a separate warning when recording failed, which is a known evidence gap rather than proof that history exists.

## Security considerations

Entries contain operation results already shown to the user, not credentials, tokens, release bytes, or arbitrary file contents. Snapshots copy only the app-owned installed and settings documents. Child Git processes run hidden with a local application identity and never fetch or push. Delimited values quote commas, tabs, quotes, and line breaks; XML/HTML escape markup; SQL quotes values; and every generated data module embeds the same complete record fields. Nested documents such as settings, layout, and appearance remain JSON-only so their importer does not receive a lossy conversion.

## Verification

Contract tests prove operations route through the recording helper, every registered activity format keeps the test record, the format metadata stays UTF-8/LF, and the date parser/range matcher handles ISO, local dates, invalid/partial input, inclusive bounds, and presets. Source inspection proves bounded reads, JSONL append, snapshot isolation, and non-blocking snapshot failure. Runtime capture at `docs/assets/screenshots/activity-runtime.png` predates the picker and does not prove every future operation or calendar interaction was recorded.

## Suggested articles

- [Installed app discovery](Installed-App-Discovery)
- [Verified installer operations](Verified-Installer-Operations)
- [Privacy and security](Privacy-and-Security)
