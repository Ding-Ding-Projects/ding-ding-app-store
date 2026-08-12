---
id: app-store-self-updater
title: App Store self-updater
titleYue: App Store 自己更新
category: updates
status: limited
summary: Runs a bounded unsigned Squirrel RELEASES state machine with package-integrity metadata, user-started downloads, recoverable failures, and an explicit restart action.
---
# App Store self-updater

## Behaviour

The packaged App Store checks its own Squirrel `RELEASES` feed after launch and on the configured repeat schedule. A release is published only from `main`; the workflow fetches `origin/main` and requires its exact source SHA to equal that fresh tip before packaging and again before publication. This blocks a manual dispatch of an old commit and stops a release if `main` advances while it runs. It derives one stable semantic package version by adding the monotonic GitHub workflow run number to the base patch (for example, `0.1.0` becomes `0.1.42` for run 42). A rerun keeps that same version, while every later run sorts higher; values outside the safe numeric range are rejected. The same value drives the package, tag (`v<version>`), full `.nupkg` name, `RELEASES` row, and immutable release-note URL. Historical suffix tags such as `v0.1.0-1002-1` remain accepted only when reading the bounded release inventory; their exact tag, source commit, and release URL are retained for changelog display. New publication rejects suffix tags and requires the exact `v<effective-version>` form. The main process validates every bounded row (40-hex package digest, exact `DingDingAppStore` full/delta filename, positive package size, duplicate consistency, and at least one full package) before it compares the newest full version with the running app. It publishes idle, checking, up-to-date, available, downloading, ready, or failed state through the typed preload bridge. Discovery never starts an installer or download.

The persistent corner banner shows the exact version, immutable release-notes URL, package filename, declared bytes, and package digest. An available banner begins Squirrel download only after the user presses **Download**; a downloading banner offers **Cancel download**; a ready banner offers **Restart to install update** and **Later**. The restart action is armed only from ready state, after the main process records a pending marker, and the renderer refuses it while an install/build/uninstall, source job, or unsaved schedule edit is active. `quitAndInstall()` is never called during discovery.

Development builds skip the network request and report an up-to-date-style scheduled result that explicitly says no feed request was made. That keeps local development from impersonating packaged updater evidence.

## Configuration

The feed identity is a main-process constant and is unaffected by the user-facing display name. Startup checking cannot be disabled. Settings control repeat checks from 60 minutes through seven days, while a command or schedule button checks immediately. Quiet hours hold corner notifications but do not stop checks or hide the persistent update banner. A short-lived pending marker in application data records the exact package before restart; a version mismatch on the next launch becomes a recoverable rollback warning rather than an automatic retry or silent downgrade.

## Failure modes

The service rejects non-HTTPS or unapproved redirect hosts, credentials in URLs, more than three redirects, metadata beyond 128 KB, malformed package rows, conflicting duplicate rows, invalid package hashes/sizes, missing full packages, and network timeouts. A cancelled check returns to idle without advertising an update. Auto-updater errors (including a corrupt or hash-mismatched package) become a recoverable failed state; no restart is attempted. Calling download before available or restart before ready is a no-op or explicit failure. The current release feed may return 404 until a matching non-draft release publishes `RELEASES`; that is a real failure state, not an app crash. A staged version that does not become the running version is surfaced as a rollback warning and is never retried automatically.

## Security considerations

The project permanently ships unsigned artifacts. HTTPS, bounded feed metadata, exact Squirrel package hashes, and the update client's validation protect transport and package integrity but are not described as publisher authentication. The renderer cannot change the feed URL, package metadata, or authorize restart without the main-process ready state. Pending markers contain only version, package filename/hash/size, and a timestamp; no credentials, tokens, or user content are written.

## Verification

`tests/update-service.test.ts`, `tests/prepare-release-version.test.ts`, and `tests/workflow-contracts.test.ts` cover RELEASES parsing, semver/tag/feed naming, and the main-only ancestry contract. A prior packaged run reached the real feed and truthfully reported HTTP 404; this lane does not claim a successful download, hash-mismatch event, restart, rollback on a clean Windows VM, or a newly published release asset, so status remains limited at the runtime/release boundary.

## Suggested articles

- [Update schedule](update-schedule.md)
- [Notifications and operation status](../experience/notifications-and-status.md)
- [Verification and evidence](../verification/verification.md)
