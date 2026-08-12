# Activity history and export

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

Every install, source-build attempt, update, and uninstall result flows through one recording helper. Each JSONL entry has a random identifier, timestamp, app identifier and display name, action kind, success flag, and the exact result message. The Activity page lists newest first and combines its own search with action, result, and an advanced date range. Its format picker exports JSON, JSON Lines, YAML, TOML, XML, CSV, TSV, Markdown, HTML, SQLite-compatible SQL, TypeScript, JavaScript, Python, Go, Rust, JSON Schema, Protocol Buffers, or a bounded ZIP archive. It also exposes a strictly bounded 7z option editor (LZMA2, LZMA, PPMd, BZip2, Deflate; store through ultra; dictionary, word, solid, thread, split, and AES-256 header/content choices), but this build returns a typed unavailable result because no approved in-process 7z encoder is declared.

The date filter has a native start/end calendar picker, a typed field that accepts plain ISO dates or the active language's common local slash order. Bilingual mode accepts either English-first or Cantonese-first slash input, using English-first only when both interpretations are valid; ISO removes any ambiguity. It also has a month/year jump control, a 42-cell keyboard-accessible calendar grid, and named Today/7 days/30 days/All time presets. A partial or invalid value is kept and announced inline; it fails closed to no matching rows rather than silently widening the result set. Start and end bounds are inclusive local calendar days. Every Activity-owned control, filter label, empty/loading state, revision action, selection description, and destructive restore prompt follows the persisted English, Hong Kong Cantonese, or bilingual mode; operation result messages remain exact evidence rather than being rewritten.

Rows support checkbox selection, Shift-range selection, select-all for the currently shown result set, and inverse selection. Copy and export use the selected rows when selection exists and otherwise use the filtered view; counts always distinguish selected, shown, and total records. **Open in VS Code** uses the same filtered selection: text formats are written as complete documents, while ZIP is validated and extracted into an app-owned workspace before VS Code opens that folder. Deletion remains unavailable because operation history is append-only.

Successful operations also attempt a local Git snapshot of the installed-app and settings documents in an isolated repository under the App Store's history directory. Snapshots are append-only commits; no repository is created inside a user's project.

The adjacent **Local versions** browser lists those snapshots, loads a bounded diff, accepts one-line labels, and offers an explicit two-key/full-slider restore. Its list shares the Activity search/date projection and adds independent checkbox selection with Shift-range, visible-scope select-all/invert/clear, and metadata-only JSON/Markdown export. Restore remains single-target: it preserves the current state first and records a new revision after applying only the App Store-owned files; it never rewrites history.

## Configuration

The activity search is plain text by default and has its own adjacent full regex builder. Every archive picker owns the same local searchable picker and anchored builder. Action filters are derived from the actions actually present in history, show a live count beside each action, and allow multiple actions at once; an empty history never invents filter choices. Result filters cover succeeded or failed; date filtering composes with all of them and also filters Local versions. Exports serialize only the explicit selection or current filtered rows. Local versions exports are deliberately limited to JSON and Markdown metadata documents with schema `ding-ding-app-store.history-revisions.v1`, UTF-8/LF declarations, and an explicit omission list for snapshot bytes, credentials, and secrets. The main Activity picker retains its broader formats and ZIP archive contract; 7z never shells to an external executable.

## Failure modes

An absent log or local repository is an honest empty state. Reads reject logs above 10 MB and bound the parsed view to the newest 10,000 entries; version browsing is bounded to 200 commits and 120 KB per diff. A history append or local Git failure is swallowed by the operation path so it never reverses the primary install or removal. Invalid and partial date input keeps the typed value visible, reports the exact field problem, and shows no rows until corrected. Invalid revision IDs, incomplete snapshots, malformed JSON, and failed preservation/restore commits fail closed without claiming a restore. Archive requests reject duplicate, stale, malformed, or oversized record selections and fail closed before writing bytes; a filtered view with no rows keeps Export disabled.

## Security considerations

Entries contain operation results already shown to the user, not credentials, tokens, release bytes, or arbitrary file contents. Snapshots copy only the app-owned installed and settings documents. Child Git processes run hidden with a local application identity, fixed full-hex revisions, no system Git configuration, and never fetch or push. Restore never accepts a path or command from the renderer. Delimited values quote commas, tabs, quotes, and line breaks; XML/HTML escape markup; SQL quotes values; and every generated data module embeds the same complete record fields. The ZIP bridge accepts only UUID record IDs, re-reads matching persisted entries in the main process, applies strict field and count bounds, and writes only fixed relative member names. The 7z bridge accepts only UUIDs plus bounded options, refuses header encryption without content encryption, never accepts passwords or paths, and returns a typed dependency-unavailable result before any bytes are written. Nested documents such as settings, layout, and appearance remain JSON-only so their importer does not receive a lossy conversion.

## Verification

Contract tests prove operations route through the recording helper, every registered activity format keeps the test record, the format metadata stays UTF-8/LF, the date parser/range matcher handles ISO, local dates, invalid/partial input, inclusive bounds, and presets, the VS Code bridge has typed archive and history-revisions routes, and Local versions selection/export helpers preserve visible-scope and omission semantics. Archive tests extract the real ZIP, verify its fixed relative members, re-import one JSON object per JSONL line, and compare manifest byte counts and SHA-256 values. Versioning contracts prove the fixed state allowlist, bounded diff, label metadata commit, full-ID validation, before/after restore snapshots, and typed IPC/UI controls. Source inspection proves bounded reads, JSONL append, snapshot isolation, typed archive IDs, safe extraction, and non-blocking snapshot failure. Runtime capture at `docs/assets/screenshots/activity-runtime.png` predates the picker, archive action, and version browser and does not prove every future operation or calendar interaction was recorded.

## Suggested articles

- [Installed app discovery](Installed-App-Discovery)
- [Verified installer operations](Verified-Installer-Operations)
- [Privacy and security](Privacy-and-Security)
- [Local history and version restore](History-Versioning)
