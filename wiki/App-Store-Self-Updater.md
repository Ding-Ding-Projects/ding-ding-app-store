# App Store self-updater

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

The packaged App Store checks its own Squirrel `RELEASES` feed after launch and on the configured repeat schedule. It parses full-package versions, compares the newest valid version with the running app, and publishes idle, checking, up-to-date, available, downloading, ready, or failed state. An available banner begins download only after the user acts; a ready banner offers `Restart to install update` and `Later`. Restart calls `quitAndInstall()` only from the ready state.

Development builds skip the network request and report an up-to-date-style scheduled result that explicitly says no feed request was made. That keeps local development from impersonating packaged updater evidence.

## Configuration

The feed identity is a main-process constant and is unaffected by the user-facing display name. Startup checking cannot be disabled. Settings control repeat checks from 60 minutes through seven days, while a command or schedule button checks immediately. Quiet hours hold corner notifications but do not stop checks or hide the persistent update banner.

## Failure modes

The service rejects non-HTTPS or unapproved redirect hosts, credentials in URLs, more than three redirects, metadata beyond 128 KB, malformed package rows, and network timeouts. Auto-updater errors become failed state. Calling download before available or restart before ready is a no-op or explicit failure. The current release feed may return 404 until a matching non-draft release publishes `RELEASES`; that is a real failure state, not an app crash.

## Security considerations

The project permanently ships unsigned artifacts. HTTPS, bounded feed metadata, Squirrel package hashes, and the update client's validation protect transport and package integrity but are not described as publisher authentication. The renderer cannot change the feed URL or authorize restart without the main-process ready state.

## Verification

Source and focused tests cover feed parsing and the state boundary. A prior packaged run reached the real feed and truthfully reported HTTP 404. No successful download, ready event, restart, rollback, or published release asset is proven by this docs branch, so status remains limited.

## Suggested articles

- [Update schedule](Update-Schedule)
- [Notifications and operation status](Notifications-and-Status)
- [Verification and evidence](Verification)
