---
id: authenticator
title: Local authenticator preview
titleYue: 本機驗證器預覽
category: memory-sync
status: limited
summary: Calculates one RFC 6238 code in memory while the operating-system vault and full authenticator remain unavailable.
---
# Local authenticator preview

## Behaviour

The Authenticator tab is a real workspace destination in normal mode. It accepts a one-time Base32 secret, validates SHA-1, SHA-256, or SHA-512, 6–8 digits, and a bounded 1–3600 second period, then calculates the current RFC 6238 code locally. The code, countdown, and parameters are shown only for that preview; the input is cleared after calculation and the service never returns the secret.

This is deliberately a limited slice. It does not register an account, create or scan a QR code, parse an `otpauth://` URI, pair a device, show a next-code peek, keep an entry list, or provide rename, reorder, group, bulk, or secret-export actions. The operating-system credential vault is currently unavailable, so no credential is persisted. Those capabilities remain follow-up work rather than implied by the tab.

## Configuration

The preview has no persistent configuration. Algorithm, digits, period, and the one-shot secret are supplied for each calculation. A deterministic timestamp is accepted only by the main-process test seam; renderer requests cannot choose an arbitrary clock. The tab uses the app's normal language mode and adjacent regex builder for its local feature search.

## Failure modes

Malformed Base32, unsupported algorithm or digit count, a non-positive or oversized period, an invalid timestamp, and an unavailable vault return a bounded localized error. The UI does not echo parser details or the secret. School mode removes the tab, palette entries, notifications, and keyboard activation; an active tab falls back to Catalog.

## Security considerations

Secrets are handled as ephemeral input only. They are not written to settings, local history, exports, logs, notifications, screenshots, generated documentation, the renderer bundle, or Git. The preload validates response shapes and rejects unexpected secret or QR fields; the main process rejects unknown renderer senders and strips the test-only timestamp before invoking the service. The explicit `unavailable` vault status is fail-closed: this slice never substitutes plaintext storage.

## Verification

`tests/authenticator.test.ts` covers all published RFC 6238 SHA-1, SHA-256, and SHA-512 vectors, 6/7/8-digit formatting, rollover countdown, bounded Base32 errors, unavailable-vault status, secret-free responses, and legacy workspace migration. `tests/school-mode.test.ts` covers palette and route suppression. The contract Chut also checks preload response validation and the no-runtime-import boundary. Documentation generation synchronizes this article into the offline app bundle, static-site mirror, wiki mirror, and category indexes. These checks prove the memory-only preview, not a full vault-backed authenticator.

## Suggested articles

- [Secret and display-name mutation history](./secret-and-display-name-history.md)
- [Tab workspace](../experience/tab-navigation.md)
- [Search and regex builder](../experience/search-and-regex-builder.md)
- [Universal School mode](../experience/school-mode.md)
- [Privacy and security](../security/privacy-and-security.md)
- [Verification and evidence](../verification/verification.md)
