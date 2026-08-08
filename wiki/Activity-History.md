# Activity history and export

> **Status: shipped.** This wiki page is generated from the canonical categorized article.


## Behaviour

Every install, source-build attempt, and uninstall result flows through one recording helper. Each JSONL entry has a random identifier, timestamp, app identifier and display name, action kind, success flag, and the exact result message. The Activity page lists newest first and combines its own search with action, result, and date-preset filters. Copy JSON and downloads for JSON, JSONL, CSV, and Markdown are available.

Rows support checkbox selection, Shift-range selection, select-all for the currently shown result set, and inverse selection. Copy and export use the selected rows when selection exists and otherwise use the filtered view; counts always distinguish selected, shown, and total records. Deletion remains unavailable because operation history is append-only.

Successful operations also attempt a local Git snapshot of the installed-app and settings documents in an isolated repository under the App Store's history directory. Snapshots are append-only commits; no repository is created inside a user's project.

## Configuration

The activity search is plain text by default and has its own adjacent full regex builder. Action filters cover install, build, and uninstall; result filters cover succeeded or failed; date presets cover today, seven days, 30 days, or all time. Exports serialize only the explicit selection or current filtered rows.

## Failure modes

An absent log is an honest empty state. Reads reject logs above 10 MB and bound the parsed view to the newest 10,000 entries. A history append or local Git failure is swallowed by the operation path so it never reverses the primary install or removal. The present renderer does not surface a separate warning when recording failed, which is a known evidence gap rather than proof that history exists.

## Security considerations

Entries contain operation results already shown to the user, not credentials, tokens, release bytes, or arbitrary file contents. Snapshots copy only the app-owned installed and settings documents. Child Git processes run hidden with a local application identity and never fetch or push. CSV quoting and Markdown pipe escaping keep exports structurally valid.

## Verification

Contract tests prove operations route through the recording helper and exports exist. Source inspection proves bounded reads, JSONL append, snapshot isolation, and non-blocking snapshot failure. Runtime capture at `docs/assets/screenshots/activity-runtime.png` shows the packaged Activity surface; it does not prove every future operation was recorded.

## Suggested articles

- [Installed app discovery](Installed-App-Discovery)
- [Verified installer operations](Verified-Installer-Operations)
- [Privacy and security](Privacy-and-Security)
