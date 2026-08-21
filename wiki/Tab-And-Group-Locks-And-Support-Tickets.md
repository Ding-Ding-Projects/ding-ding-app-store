# Tab and group UX locks with local Support Tickets

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

The tab context menu exposes a first-class lock route for an individual tab and for each tab group. A locked target keeps its readable label and shows a lock affordance. Activating a locked tab or changing a locked group opens the target's own inline unlock prompt. Each lock has a persisted unlock-duration choice: **until this app closes**, **15 minutes**, or **60 minutes**. Timed unlocks relock automatically; **Lock again** relocks immediately. The Settings → Locks & Support surface lists every configured target and lets the user set, change, unlock, relock, or remove each password independently.

Support Tickets is a fictional, local-only desk reachable from Help, the lock setting, and the forgotten-credential link in an unlock prompt. It creates a bounded ticket number, category, description, severity, status, and canned first response on this device. The local list supports visible-scope checkbox and keyboard selection, Shift-range intent, select-shown, invert, clear, and reviewable counts. **Advance selected** moves each selected ticket one step from created to reviewed or reviewed to resolved; resolved and missing records are skipped. The native operation is serialized with single-ticket changes, writes one atomic `support-tickets.v1.json`, records one redacted history event, and returns committed, skipped, and uncertain identifiers. JSON and Markdown exports cover the visible scope or selected records and can download or open in Visual Studio Code. The desk never sends a request, creates a remote case, or deletes data. Its recovery action opens the exact application-data folder in the platform file manager so the user can delete that folder themselves when a forgotten lock must be reset.

Each target has an independent credential method: password or TOTP. TOTP pairing accepts an ephemeral user-entered Base32 secret in the lock form, draws its otpauth QR locally with the selected algorithm, digits, and period, and shows the manual secret only behind an explicit reveal/copy action. The normalized secret is encrypted inside the operating-system vault and one current code confirms the pairing. Appearance-property locks use the strict `appearance-property` target kind. The renderer never receives a stored secret, verifier, salt, or ciphertext; the entered pairing secret is cleared after save or cancellation. This remains a local UX lock, not a master credential or protection from another person using the machine.

## Configuration

Choose **Manage tab lock** or **Manage group lock** from the target's context menu, or open Settings → Locks & Support. Appearance locks use the canonical `element:token` target key. Select Password or TOTP in the credential-method picker, then choose **Until this app closes**, **15 minutes**, or **60 minutes** as the unlock duration. The duration is lock metadata, never a credential. TOTP setup accepts a bounded Base32 secret plus SHA-1, SHA-256, or SHA-512, 6–8 digits, and a 15–3600 second period; pairing accepts the current period plus one adjacent period for small clock drift. The surface draws a local otpauth QR, offers explicit manual-secret reveal/copy, and sends no QR or secret through IPC. Changing or removing an existing lock requires its current credential. The lock target picker searches tabs, groups, and appearance properties using the same local settings search and regex builder. Support Tickets has its own category, severity, description, local list, status actions, recovery-path copy action, and Open folder action.

The main process stores only lock metadata in the app-owned data directory. Password verifiers are salted with `scrypt`; password verifiers and normalized TOTP secrets are encrypted through Electron `safeStorage`. Plaintext passwords, TOTP secrets, salts, verifiers, and ticket secrets never enter renderer state, exports, history, logs, or Git. Appearance mutations are checked again in the main process, so a debounced renderer draft cannot bypass a locked token. When the operating-system credential vault is unavailable or unreadable, lock creation, unlock, and removal fail closed and the surface says that no pretend security is being offered.

## Failure modes

Invalid targets, short or oversized credentials, invalid TOTP codes, bounded repeated failures, credential mismatches, malformed local files, unavailable vaults, expired timed unlocks, and local write failures return typed failure states and keep the previous in-memory state. Timed unlock expiry is evaluated in the main process and never trusts renderer timestamps. Per-file writes use an atomic temporary-file rename; a failed companion write attempts to restore the previous lock metadata. Ticket persistence failures leave the in-memory list unchanged and report that nothing was sent.

The file-manager action can fail on a platform that cannot launch its native file manager. In that case the exact application-data path remains visible and copyable, and the user is told to open it themselves. The app never silently treats opening the folder as deleting it. Deleting the application-data folder is the documented blanket reset for these toy locks and local tickets. A batch write failure attempts a verified rollback; if rollback cannot be proven, the UI reports an uncertain outcome and keeps the affected identifiers reviewable.

## Security considerations

This is a user-experience lock, not encryption, access control, or a security boundary. The password path uses the operating-system credential vault when available and does not fall back to plaintext or an invented local security mechanism. The renderer submits only typed lock targets and credentials to typed IPC handlers; main-process handlers reject requests from any sender other than the active window. No Support Tickets operation uses `fetch`, a remote endpoint, telemetry, a support account, or an in-app delete path.

The recovery line names the real application-data folder because a forgotten toy credential must never strand the user's content. Users should not use this feature for sensitive data. Unlock duration is a convenience lifetime, not a security guarantee: session means process lifetime, while timed values are held only in main-process memory and disappear when the app closes. QR rendering is in-process and local-only; the typed pairing secret is ephemeral renderer state until confirmation and is never stored there. This feature does not claim a master credential, encrypted content, or another-person access boundary.

## Verification

Focused type checks cover the new main and renderer contracts. Source-level guards assert the safe-storage encryption boundary, salted verifier and timing-safe comparison, sender validation for every new IPC route, local-only ticket wording, recovery-folder opening without deletion, and the absence of network calls. Renderer checks cover Settings → Locks & Support, Help's Open Locks & Support action, lock indicators, inline unlock and recovery text, the three unlock-duration choices, bilingual labels, keyboard-reachable controls, and the vault-unavailable disabled state. Runtime verification should still use the packaged application on the sanctioned hidden desktop before a release claim.

## Suggested articles

- [Tab workspace](Tab-Navigation)
- [Notifications and operation status](Notifications-and-Status)
- [Privacy and security](Privacy-and-Security)
- [Local history and version restore](History-Versioning)
