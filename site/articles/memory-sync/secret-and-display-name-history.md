---
id: secret-and-display-name-history
title: Secret and display-name mutation history
titleYue: 秘密同顯示名稱變更歷史
category: memory-sync
status: limited
summary: Records the shared instruction contract boundary for redacted local history of display-name and authenticator mutations.
---
# Secret and display-name mutation history

## Behaviour

The shared instruction contract requires every app that owns a renameable display name or authenticator entries to keep append-only, local Git history in its own application-data directory. A display-name rename, reset, or authenticator mutation is a separate history event; restores and imports create new revisions rather than rewriting the old ones. History views and exports must contain redacted metadata only: no password, PIN, TOTP secret, QR payload, or usable credential.

This App Store now records a display-name change as a typed `settings` Activity event and keeps the existing settings snapshot in the local version repository. The visible Activity route and generated article are the reachable part of this slice. The authenticator vault, QR registration, OS credential storage, password-protected history manager, and encrypted secret snapshots are not implemented here and remain explicit follow-up work; the app does not claim those capabilities.

## Configuration

Display names remain labels only. They do not change the package identity, update feed, application-data location, installer identity, or diagnostic identity. A rename is stored in the existing settings file, and its redacted Activity entry names the mutation without carrying any secret material. The local history repository stays beside application data and is never synced or pushed by default.

## Failure modes

If settings persistence fails, the rename is not reported as successful. If the best-effort local history append or snapshot cannot be created, the settings write remains successful but the audit event is unavailable; the app does not invent a revision. Missing authenticator storage, unavailable credential vaults, wrong history credentials, and interrupted encrypted commits remain unsupported in this slice and must be surfaced as unavailable rather than guessed into existence.

## Security considerations

The Activity entry and ordinary exports contain no password, PIN, TOTP secret, QR URI, salt, verifier, or credential-vault value. The renderer receives only the display-name label and typed history metadata. A future authenticator implementation must use the operating-system credential vault and encrypted-or-redacted snapshots; it must not put secrets into settings JSON, local Git blobs, exports, logs, screenshots, sync repositories, or public records.

## Verification

The adapter/catalog Chuts cover the newly reviewed public app records, while focused history and contract tests cover the typed `settings` event and its Activity label. Documentation generation checks this article, the memory-sync category index, the static-site mirror, the wiki page, and the offline bundle. These checks prove the bounded display-name history route only; they do not prove an authenticator vault, QR scan, TOTP vector suite, password-protected history manager, encrypted snapshot, or packaged runtime capture.

## Suggested articles

- [Settings, language, and display name](../experience/settings-language-and-display-name.md)
- [Local history and version restore](../installed/history-versioning.md)
- [Activity history and export](../installed/activity-history.md)
- [Privacy and security](../security/privacy-and-security.md)
- [Verification and evidence](../verification/verification.md)
