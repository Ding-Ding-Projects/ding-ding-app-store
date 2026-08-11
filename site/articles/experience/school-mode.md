---
id: school-mode
title: Universal School mode
titleYue: 通用 School mode
category: experience
status: shipped
summary: One revisioned, user-renamable English-only presentation control that live-synchronizes across already-running apps.
---
# Universal School mode

## Behaviour

School mode is one universal, user-renamable presentation control. Every app reads the same record from the shared platform application-data area, owns a discoverable control for it, and observes the record's parent directory so an atomic replacement is visible without restarting. A bounded polling fallback reconciles events that the operating-system watcher may coalesce. Enabled state, the chosen display name, and unlock-verifier rotations therefore propagate to already-running apps through a typed main/preload subscription.

The public state carries an opaque `recordId` epoch plus a monotonic `revision`. The epoch changes after the user intentionally deletes and recreates the record, preventing an older app from confusing a new revision `1` with the old record's revision `1`. While the verified mode is enabled—or while the shared state is unreadable or cannot be watched—the renderer uses restricted English presentation and omits Cantonese, bilingual, funny-level, personal-vocabulary, and dim-sum controls, copy, routes, palette results, images, and release code-name references. Saved language and funny-level choices remain intact and return only after a verified disabled state arrives.

After a rename, user-facing labels, status, search, documentation destinations, and accessible copy use the verified chosen name. A cold app with no verified state uses the neutral label **Shared mode**, not the shipped name. A genuinely missing record is the only verified unconfigured state and may show the shipped default again.

Restricted notification and activity projections are deliberately allowlisted. Semantic School mutation notices are regenerated from their typed code and the current verified name; older free-form notices and all activity rows are withheld while restricted because they cannot prove that a previous custom name or serialized language, funny-level, voice, narrator, or other setting value is absent. They return after a verified disabled state.

## Configuration

Open Settings → General → School mode. On first setup choose a display name, a numeric PIN or local password, enter the credential twice, and select **Configure and enable**. PINs contain 4–64 digits; passwords contain 4–512 characters. This build does not expose a decorative passkey choice and does not claim WebAuthn or operating-system passkey support. A preview record tagged as `passkey` is reported as unsupported and unavailable rather than interpreted as a text password.

After setup, **Save name** changes the shared display label, **Enable/Disable** changes the shared state, and **Change credential** requires the current credential plus the new credential and confirmation. Disabling and renaming an enabled mode verify against the latest record under the cross-process lock. The renderer supplies the last observed `recordId` and `revision` with every mutation; a stale request is rejected and must reload before retrying. Credential fields are cleared whenever a new revision arrives, including a credential-only change from another running app.

The on-disk filename remains `school-mode.v1.json` for application-data location compatibility, while its strict payload schema is version `2`. A valid schema-v1 PIN/password verifier is migrated atomically to a fresh `recordId` at revision `1`. Deleting the record is the documented local reset path. This is a user-experience lock, not a security boundary.

## Failure modes

Missing (`ENOENT`) means verified unconfigured state. Read errors, oversized JSON, malformed or unknown schemas, passkey-tagged preview records, watcher failures, write/readback failures, and compare-and-swap conflicts are distinct closed status codes. They never become an ordinary disabled state. The renderer preserves the last verified chosen name and state when one exists, explains that live state is unavailable, disables mutations, and keeps restricted presentation active. No raw filesystem error or path crosses IPC.

Each process serializes its own operations. Cross-process mutations publish a fully populated lock candidate atomically, prove the current lock owner is dead before recovery, reread the latest record, compare both epoch and revision, validate the latest verifier, build an immutable candidate, write through a unique same-directory temporary file, flush it, rename it, and strictly read it back. Published memory and events change only after readback matches. A failed write can change the closed sync status but cannot substitute an unpersisted enabled state, name, or verifier in memory.

## Security considerations

Credential verification runs only in the main process with a bounded `scrypt` derivation, random salt, and constant-time digest comparison. The preload strictly validates exact snapshot keys and closed status reasons, freezes the result, and rejects extra fields; renderer snapshots and watcher events contain no credential, salt, verifier, digest, shared path, or raw exception text. IPC mutations are accepted only from the app's own renderer.

Lock recovery is deliberately fail-closed. Liveness is checked with the recorded process identity, so an ambiguous or reused process identity is treated as live rather than stolen; a bounded claimant chain also refuses to guess after its depth limit. In either case the app reports an unavailable shared state and retries later instead of risking a concurrent write. These are explicit availability limits, not security claims.

The lock owner record contains only an opaque token, process ID, and creation time. Age alone never authorizes lock theft: a suspended or slow live process keeps its lock. Recovery occurs only when a process-liveness probe proves `ESRCH`; permission errors, unknown results, malformed ownership, and live owners fail closed. Display-name changes remain presentation-only and never move the app identity, package ID, update feed, or application-data location.

## Verification

`tests/school-mode.test.ts`, `tests/school-mode-live-sync.test.ts`, and `tests/school-mode-bridge.test.ts` cover presentation restriction, name privacy, schema-v1 migration, secret exclusion, credential rotation, two simultaneous services, rename/enable/credential propagation, atomic-rename observation, stale-write conflict/retry, delete-and-recreate ABA defense, malformed/read/watch/write failure states, live-owner lock retention, dead-owner recovery, bounded recovery exhaustion, preload validation, subscription ordering, renderer observation ordering, and lifecycle cleanup. The focused matrix passes 42 tests; the full root matrix passes 319 tests across 45 files, with workspace suites at 11, 20, and 20 tests. Main/preload and renderer TypeScript checks plus the production build pass.

These checks are source and process-level evidence. The required sanctioned headless interaction route was unavailable for this lane, so no packaged runtime capture, focus behavior, screen-reader drive, or visible Settings proof is claimed.

## Suggested articles

- [Settings, language, and display name](settings-language-and-display-name)
- [Command palette](command-palette)
- [Privacy and security](privacy-and-security)
