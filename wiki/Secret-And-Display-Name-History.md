# Secret and display-name mutation history

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

The shared instruction contract requires every app that owns a renameable display name or authenticator entries to keep append-only, local Git history in its own application-data directory. A display-name rename, reset, or authenticator mutation is a separate history event; restores and imports create new revisions rather than rewriting the old ones. History views and exports must contain redacted metadata only: no password, PIN, TOTP secret, QR payload, or usable credential.

This App Store now records a display-name change as a typed `settings` Activity event and keeps the existing settings snapshot in the local version repository. The visible Activity route and generated article are the reachable part of that history slice. A separate Authenticator tab now offers bounded local URI/Base32 registration, QR pairing, safeStorage-backed entries, and metadata-only rename, reorder, label-only grouping, checkbox selection, destructive deletion, and redacted export. These authenticator mutations are not yet Activity events and authenticator metadata/ciphertext are not in the history snapshot allowlist; protected authenticator history, restore, stable group records, and deliberate secret export remain explicit follow-up work.

## Configuration

Display names remain labels only. They do not change the package identity, update feed, application-data location, installer identity, or diagnostic identity. A rename is stored in the existing settings file, and its redacted Activity entry names the mutation without carrying any secret material. The local history repository stays beside application data and is never synced or pushed by default.

## Failure modes

If settings persistence fails, the rename is not reported as successful. If the best-effort local history append or snapshot cannot be created, the settings write remains successful but the audit event is unavailable; the app does not invent a revision. Authenticator registration reports an unavailable credential vault, invalid URI/secret, pairing mismatch, clock-range failure, or rollback failure as an explicit bounded status. Wrong history credentials and interrupted encrypted commits remain unsupported in this slice and must be surfaced as unavailable rather than guessed into existence.

## Security considerations

The Activity entry and ordinary exports contain no password, PIN, TOTP secret, QR URI, salt, verifier, or credential-vault value. Authenticator registration clears pending secrets after confirmation/expiry, returns only metadata and code display, and keeps safeStorage ciphertext outside ordinary exports/history. The authenticator metadata export explicitly omits `secret`, `uri`, `code`, `nextCode`, `remainingSeconds`, and `expiresAt`; its CSV form carries schema and omission columns for standards-compatible parsing, and its Markdown form escapes label/group cells. A future history integration must add only redacted metadata snapshots; it must not put secrets into settings JSON, local Git blobs, exports, logs, screenshots, sync repositories, or public records.

## Verification

The adapter/catalog Chuts cover the newly reviewed public app records, while focused history and contract tests cover the typed `settings` event and its Activity label. Authenticator registration tests cover URI/Base32 parsing, local QR matrices, pairing, vault rollback/concurrency, preload shapes, clock bounds, and School-mode suppression. Documentation generation checks this article, the memory-sync category index, the static-site mirror, the wiki page, and the offline bundle. These checks prove the bounded display-name history and registration/list routes only; they do not prove protected authenticator history/restore, QR image scanning, or packaged runtime capture.

## Suggested articles

- [Settings, language, and display name](Settings-Language-and-Display-Name)
- [Local history and version restore](History-Versioning)
- [Activity history and export](Activity-History)
- [Privacy and security](Privacy-and-Security)
- [Verification and evidence](Verification)
