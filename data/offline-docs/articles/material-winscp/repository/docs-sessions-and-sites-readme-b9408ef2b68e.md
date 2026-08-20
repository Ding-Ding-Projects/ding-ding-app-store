# Sessions and sites

A **site** is saved connection data. A **session** is a live connection made
from one. A **workspace** is a set of sessions restored together. This category
covers all three, plus the machinery that gets you connected: session URLs,
tunnels, proxies and automatic reconnection.

## Articles

| Article | Covers |
| --- | --- |
| [site-manager.md](app-doc://article/material-winscp.repository.3daf06486972e947) | Sites, folders, colour tags, import/export and the session URL format. |
| [import-sessions.md](app-doc://article/material-winscp.repository.740371995e8d6690) | Bounded PuTTY/KiTTY, FileZilla, OpenSSH, WinSCP INI and known_hosts imports, including UTF-8 session-name compatibility. |
| [bookmarks.md](app-doc://article/material-winscp.repository.96ded5aa648ecaf9) | Ordered shared and per-site local/remote location profiles, duplicate policies and safe JSON persistence. |
| [session-info.md](app-doc://article/material-winscp.repository.3da6892215673979) | Secret-free protocol, endpoint, display and live-session information snapshots. |
| [session-dialog.md](app-doc://article/material-winscp.repository.8766b3f40a585f4d) | Bounded endpoint validation, secret-free dialog state, and stale-reconnect-safe close lifecycle. |
| [site-advanced-settings.md](app-doc://article/material-winscp.repository.18993c5535deb4c2) | Per-site advanced settings, capability-gap handling, secret-safe persistence, and timezone offset validation. |
| [terminal-lifecycle.md](app-doc://article/material-winscp.repository.ef49286aeaa56939) | Foreground operation ownership, cancellation, reconnect backoff/budgets, prompt refusal, and directory-cache invalidation. |
| [named-objects.md](app-doc://article/material-winscp.repository.357ddea56052dc56) | Bounded names for sessions, queue items, operations and UI bridges, with weak or explicit ownership and identifier-only export. |
| [workspaces.md](app-doc://article/material-winscp.repository.c764da55f312b773) | Saving and restoring sets of sessions, and the auto-workspace. |
| [tunnels-and-proxies.md](app-doc://article/material-winscp.repository.abd9b694c21333cb) | SSH tunnels, every proxy method, and how they compose. |
| [reconnection.md](app-doc://article/material-winscp.repository.d12c73c616be13c5) | Automatic reconnect, stall detection and idle handling. |

## Where the data lives

One JSON file, written atomically (temp file, then rename), at
`winscp-material.json` under the app's data directory — `paths.js` is the single
place that decides where that is. An INI export exists for WinSCP
interoperability, and neither format ever contains a secret in clear.

Sites, folders and workspaces are user-managed records, so every create, edit
and delete is offered to version history. Deleting a site
by mistake is undoable, and so is the undo.

## Postman

Not applicable — this project exposes no HTTP API. See the
[documentation index](app-doc://article/material-winscp.repository.0b5ca119d2be595a).

## Suggested articles

- Security and credentials — what happens to a saved password.
- Protocols — the per-protocol half of a site's configuration.
- Version history — the undo behind every site edit.
