# Activity history and export

Every install, build, and uninstall outcome — success or failure — is recorded locally and shown in the Activity tab, newest first, with the exact app, action, result, and message.

- Configuration: filter by action, result, or date preset, plus the same search box and full regex builder used elsewhere; copy JSON or download JSON/CSV/Markdown.
- Failure: a history read/write failure never blocks or reverses the underlying operation; the store keeps only the most recent 500 entries.
- Security: no credentials, tokens, URLs, or file contents are stored — only outcomes already shown to the user — through the typed bridge, never a generic IPC channel.
- Verification: `npm run check` passes, including focused contract assertions for recording, bounding, export formats, and the rendered filters/export controls. Packaged-runtime capture is pending.

Detailed source: `docs/features/activity-history.md`.
