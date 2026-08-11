---
id: tab-and-group-locks-and-support-tickets
title: Tab and group UX locks with local Support Tickets
titleYue: 分頁同分組 UX 鎖連本機支援票
category: experience
status: limited
summary: Password-backed, per-tab and per-group local UX locks with an honest operating-system vault boundary and an on-device recovery desk.
---

# Tab and group UX locks with local Support Tickets

## Behaviour

The tab context menu exposes a first-class lock route for an individual tab and for each tab group. A locked target keeps its readable label and shows a lock affordance. Activating a locked tab or changing a locked group opens the target's own inline unlock prompt; unlocking lasts for the current app session and **Lock again** restores the speed bump. The Settings → Locks & Support surface lists every configured target and lets the user set, change, unlock, relock, or remove each password independently.

Support Tickets is a fictional, local-only desk reachable from Help, the lock setting, and the forgotten-credential link in an unlock prompt. It creates a bounded ticket number, category, description, severity, status, and canned first response on this device. Advancing a ticket moves it from created to reviewed to resolved. The desk never sends a request, creates a remote case, or deletes data. Its recovery action opens the exact application-data folder in the platform file manager so the user can delete that folder themselves when a forgotten lock must be reset.

This slice intentionally implements password UX locks for tabs and groups only. It does not claim per-property appearance locks, OTP/TOTP locks, a master credential, or protection from another person who can access the machine.

## Configuration

Choose **Manage tab lock** or **Manage group lock** from the target's context menu, or open Settings → Locks & Support. Each target accepts its own password verifier; changing or removing an existing lock requires its current credential. The lock target picker searches tabs and groups using the same local settings search and regex builder. Support Tickets has its own category, severity, description, local list, status actions, recovery-path copy action, and Open folder action.

The main process stores only lock metadata in the app-owned data directory. Credential verifiers are salted with `scrypt` and encrypted through Electron `safeStorage`; plaintext passwords, salts, verifiers, and ticket secrets never enter renderer state, exports, history, logs, or Git. When the operating-system credential vault is unavailable or unreadable, lock creation, unlock, and removal fail closed and the surface says that no pretend security is being offered.

## Failure modes

Invalid targets, short or oversized credentials, credential mismatches, malformed local files, unavailable vaults, and local write failures return typed failure states and keep the previous in-memory state. Per-file writes use an atomic temporary-file rename; a failed companion write attempts to restore the previous lock metadata. Ticket persistence failures leave the in-memory list unchanged and report that nothing was sent.

The file-manager action can fail on a platform that cannot launch its native file manager. In that case the exact application-data path remains visible and copyable, and the user is told to open it themselves. The app never silently treats opening the folder as deleting it. Deleting the application-data folder is the documented blanket reset for these toy locks and local tickets.

## Security considerations

This is a user-experience lock, not encryption, access control, or a security boundary. The password path uses the operating-system credential vault when available and does not fall back to plaintext or an invented local security mechanism. The renderer submits only typed lock targets and credentials to typed IPC handlers; main-process handlers reject requests from any sender other than the active window. No Support Tickets operation uses `fetch`, a remote endpoint, telemetry, a support account, or an in-app delete path.

The recovery line names the real application-data folder because a forgotten toy credential must never strand the user's content. Users should not use this feature for sensitive data. OTP, QR pairing, and appearance-property locks remain outside this slice and are not presented as available.

## Verification

Focused type checks cover the new main and renderer contracts. Source-level Chuts assert the safe-storage encryption boundary, salted verifier and timing-safe comparison, sender validation for every new IPC route, local-only ticket wording, recovery-folder opening without deletion, and the absence of network calls. Renderer checks cover Settings → Locks & Support, Help's Open Locks & Support action, lock indicators, inline unlock and recovery text, bilingual labels, keyboard-reachable controls, and the vault-unavailable disabled state. Runtime verification should still use the packaged application on the sanctioned hidden desktop before a release claim.

## Suggested articles

- [Tab workspace](../experience/tab-navigation.md)
- [Notifications and operation status](../experience/notifications-and-status.md)
- [Privacy and security](../security/privacy-and-security.md)
- [Local history and version restore](../installed/history-versioning.md)
