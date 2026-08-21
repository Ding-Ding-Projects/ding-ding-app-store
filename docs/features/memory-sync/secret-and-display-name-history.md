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

This App Store now records a display-name change as a typed `settings` Activity event and keeps the existing settings snapshot in the local version repository. The visible Activity route and generated article are the reachable part of that history slice. A separate Authenticator tab now offers bounded local URI/Base32 registration, QR pairing, safeStorage-backed entries, metadata-only rename/reorder, stable group entities with persisted order/collapse state and bulk movement, checkbox selection, destructive deletion, and redacted export. Successful authenticator confirmation and metadata mutations append localized redacted `settings` Activity events through a best-effort recorder; each event carries fixed action text and opaque entry ID/count metadata only. Prepare, cancel, failed, restricted, and uncertain-only results never record. The Activity/local-versions surface now has a separate safeStorage-backed protected-history credential gate with sender-checked, School-mode-aware unlock and lock-again controls. Protected authenticator metadata/ciphertext restore is explicitly unavailable on the production host until a reviewed native handle-relative no-follow adapter exists; the app returns typed `EUNSUPPORTED` before mutation and leaves ordinary history restore intact. Legacy seven-file revisions remain ordinary restorable App Store history; only revisions containing the protected authenticator slot are fenced.

## Configuration

Display names remain labels only. They do not change the package identity, update feed, application-data location, installer identity, or diagnostic identity. A rename is stored in the existing settings file, and its redacted Activity entry names the mutation without carrying any secret material. The local history repository stays beside application data and is never synced or pushed by default.

## Failure modes

If settings persistence fails, the rename is not reported as successful. If the best-effort local history append or snapshot cannot be created, the settings write remains successful but the audit event is unavailable; the app does not invent a revision. Authenticator registration reports an unavailable credential vault, invalid URI/secret, pairing mismatch, clock-range failure, or rollback failure as an explicit bounded status. Wrong protected-history credentials, malformed encrypted verifier records, unavailable safeStorage, and live School-mode transitions fail closed; no history bytes or credential details are returned while locked.

## Security considerations

The Activity entry and ordinary exports contain no password, PIN, TOTP secret, QR URI, salt, verifier, or credential-vault value. Authenticator registration clears pending secrets after confirmation/expiry, returns only metadata and code display, and keeps safeStorage ciphertext outside ordinary exports/history. The protected-history gate stores only an operating-system-vault-encrypted salted verifier; the renderer sees typed status and outcome copy, never verifier bytes or credential material. The authenticator metadata export explicitly omits `secret`, `uri`, `code`, `nextCode`, `remainingSeconds`, and `expiresAt`; its CSV form carries schema and omission columns for standards-compatible parsing, and its Markdown form escapes label/group cells. Redacted authenticator Activity events are audit-only and cannot restore an entry. Future protected authenticator restore must coordinate vault-native rehydration rather than placing secrets or DPAPI ciphertext into settings JSON, local Git blobs, exports, logs, screenshots, sync repositories, or public records.

## Verification

The adapter/catalog checks cover the newly reviewed public app records, while focused history and contract tests cover the typed `settings` event, protected-history verifier/session behavior, wrong credentials, malformed vault records, unavailable safeStorage, and Activity gating. Authenticator registration tests cover URI/Base32 parsing, local QR matrices, pairing, vault rollback/concurrency, preload shapes, clock bounds, and School-mode suppression. Documentation generation checks this article, the memory-sync category index, the static-site mirror, the wiki page, and the offline bundle. These checks prove protected access to the existing redacted history plus bounded display-name history and registration/list routes; they do not prove protected authenticator metadata restore, QR image scanning, or packaged runtime capture.

The focused recorder and real-history seam tests prove the append-only localized event path and its redaction only; they do not claim protected authenticator snapshots or restore.

## Suggested articles

- [Settings, language, and display name](../experience/settings-language-and-display-name.md)
- [Local history and version restore](../installed/history-versioning.md)
- [Activity history and export](../installed/activity-history.md)
- [Privacy and security](../security/privacy-and-security.md)
- [Verification and evidence](../verification/verification.md)
