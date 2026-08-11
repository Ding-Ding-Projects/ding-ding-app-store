# Local authenticator registration and entries

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

The Authenticator tab is a real workspace destination in normal mode. It accepts either a canonical `otpauth://totp/` URI or manual Base32 metadata, validates issuer/account fields, SHA-1/SHA-256/SHA-512, 6–8 digits, and a bounded 1–3600 second period, then renders a local QR matrix in-process. The matrix is a representation for the page; no QR image or URI is written to disk. A pairing preview stays in memory until the user enters one current code. Only then does the main process save metadata and ciphertext through the operating-system credential vault.

Saved entries return issuer, account, label, algorithm, digits, period, current code, and a numeric countdown. Codes are calculated in the main process and the renderer receives metadata and code display only. The local vault serializes metadata transactions across vault objects sharing the app-data paths and rolls back a newly published ciphertext if metadata publication fails, so a failed registration cannot leave an orphan secret file or silently replace a prior entry.

This remains a deliberately bounded slice. It does not claim QR image or clipboard import, camera scanning, next-code peek, rename, delete, reorder, groups, bulk actions, deliberate secret export, or a full protected-history/restore manager. Authenticator registration mutations are not yet recorded as local history events and authenticator files are not in the history snapshot allowlist; ordinary Activity/history exports therefore contain no authenticator secret material, but they also cannot restore these entries yet. These are follow-up capabilities rather than implied by the tab.

## Configuration

URI registration honours issuer, account, secret, algorithm, digits, and period carried by the URI. Manual registration exposes the same parameters and an explicit reveal control; after preparation it shows a grouped Base32 readout beside the local QR and offers an explicit local clipboard copy. URI input is password-masked by default and has its own explicit reveal and local copy actions. The page resets that reveal state when the source changes or a pairing succeeds, and clears the submitted secret/URI after success. Registration fields are locked while a preview is active, and a visible discard action cancels that pending identifier and clears the in-memory secret/URI. A registration identifier and pending secret/URI are held only in main-process memory for ten minutes, with a bounded five-attempt confirmation limit and an expiry timer that clears abandoned references.

The operating-system vault is the only persistence route. If safeStorage is unavailable, registration and list access fail closed with a localized explanation; there is no plaintext fallback. The tab uses the app's normal English, playful Hong Kong Cantonese, or bilingual mode and its adjacent regex builder for local search. School mode removes the tab, palette entry, route, keyboard activation, and capability at both renderer and main-process boundaries; a live transition clears pending pairings.

The source, algorithm, digit, and period fields use bounded native controls for this slice. They do not yet expose the full per-dropdown search field and anchored regex builder required by the universal picker contract; that limitation is intentionally named here and remains follow-up work rather than being presented as complete.

## Failure modes

Malformed percent encoding, duplicate or unknown URI parameters, issuer mismatches, `hotp` schemes, invalid Base32, unsupported algorithms/digits, control characters, oversized metadata, QR encoder failure, an unavailable vault, a wrong or expired pairing code, and vault write failures return bounded localized errors. A QR failure is handled before a pending pairing is published. A system clock outside the supported timestamp range is reported as a clock problem rather than as a wrong code or missing secret. Concurrent saves are serialized; failed metadata publication restores an existing ciphertext or removes a new one. If School mode changes or the user discards a pairing while a vault operation is waiting, the generation/cancellation fence rejects publication or removes the just-saved entry before reporting success, and list results are discarded rather than returned after the transition.

## Security considerations

Secrets are accepted once for pairing and are never returned from the main-process registration, list, status, QR, confirmation, history, export, notification, documentation, or preload responses. The page may reveal or copy only the still-entered manual or URI value after an explicit user action; stored values are never rehydrated into those controls. The metadata document contains only bounded non-secret fields. Each secret is encrypted by Electron `safeStorage` under an opaque UUID filename. Plaintext fallback, network QR services, remote images, telemetry, and URI/secret logging are not used. The main process rejects unknown renderer senders, strips the test-only timestamp from preview requests, validates the live School-mode restriction, fences every awaited authenticator operation against a live transition, and clears pending secrets on a restriction transition. Preload validators reject unexpected fields such as `secret` or `uri` and require complete success payloads. Electron's single-instance lock keeps one main process as the writer; vault objects in that process share a per-path transaction queue.

## Verification

`tests/authenticator.test.ts` covers RFC 6238 Appendix B vectors, 6/7/8-digit formatting, rollover countdown, Base32 bounds, unavailable-vault status, secret-free responses, and legacy workspace migration. `tests/authenticator-registration.test.ts` covers URI canonicalization and rejection cases, QR matrix bounds and secret exclusion, wrong/right/expired confirmation, unavailable vault, QR-before-pending ordering, ciphertext rollback for metadata and rename failures, same-instance and shared-path concurrent metadata saves, deferred School-mode fences for prepare/list/confirm/status, cancellation rollback, manual issuerless registration, renderer secret clearing/copy/discard wiring, preload shape rejection, and the main-process School-mode seam. `tests/school-mode.test.ts` covers live route and palette suppression. Main, renderer, and preload type/build checks plus documentation synchronization cover the bridge wiring. These checks prove this bounded registration/list slice, not a complete universal authenticator or history manager; packaged hidden-desktop capture and a real OS-vault runtime remain unclaimed here.

## Suggested articles

- [Secret and display-name mutation history](Secret-And-Display-Name-History)
- [Tab workspace](Tab-Navigation)
- [Search and regex builder](Search-and-Regex-Builder)
- [Universal School mode](School-Mode)
- [Privacy and security](Privacy-and-Security)
- [Verification and evidence](Verification)
