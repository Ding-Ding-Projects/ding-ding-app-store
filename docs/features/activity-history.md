# Activity history and export

## Behaviour

Every install, build, and uninstall outcome — success or failure — is recorded locally with the exact app, action, result, and message. The Activity tab lists real recorded entries instead of a placeholder, newest first, and refreshes immediately after each operation.

## Configuration

Entries can be filtered by action (install/build/uninstall), result (succeeded/failed), a date preset (today/7 days/30 days/all time), and the same adjacent search box and full regex builder used elsewhere in the app. The filtered view can be copied as JSON or downloaded as JSON, CSV, or Markdown.

## Failure modes

A history read or write failure never blocks or reverses the underlying operation; the app still reports the operation's own result even if recording its history entry fails. An empty or fully filtered history shows an explicit empty state rather than a blank panel. The store keeps only the most recent 500 entries.

## Security considerations

History stores only operation outcomes already shown in the non-blocking result notification (and, for destructive removal, its protected dialog) — no credentials, tokens, download URLs, or file contents. It is written through the same atomic, app-owned local JSON store used for installed-app records, and it is exposed to the renderer only through the typed `history.list()`/`history.export()` bridge methods, never a generic IPC channel.

## Verification

`npm run check` passes, including focused contract assertions that every `install`/`build`/`uninstall` return path routes through one recording helper, that the store bounds itself to 500 entries, that JSON/CSV/Markdown export are implemented, and that the Activity tab renders real filters and export controls. Packaged-runtime capture of the Activity tab is still pending.

## Suggested articles

Review [verified installer operations](verified-installer-operations.md) and [uninstall](uninstall.md) for the actions this history records, and [privacy and security](privacy-and-security.md) for what local records the app keeps.
