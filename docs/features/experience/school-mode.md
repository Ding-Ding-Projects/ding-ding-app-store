---
id: school-mode
title: Universal School mode
titleYue: 通用 School mode
category: experience
status: shipped
summary: A persisted, user-renamable English-only presentation mode with a shared local unlock verifier.
---
# Universal School mode

## Behaviour

School mode is a universal, user-renamable presentation mode. Its state is stored in the shared application-data location so another Ding Ding Projects app can use the same mode record. The user chooses a display name and an unlock kind (PIN, password, or passkey assertion input); the main process stores only a salted verifier digest, never the credential itself. Enabling the mode forces English presentation and funny level 1 while preserving the user's saved language and funny-level values for restoration after unlock.

While the mode is enabled, the renderer omits Cantonese, bilingual, funny-level, personal-vocabulary, and dim-sum controls, copy, routes, palette results, images, and release code-name references. The schedule surface explains that those temporary overrides are unavailable rather than exposing controls that would be ignored. The command palette still provides an English **Open School mode settings** destination so the mode is discoverable and can be disabled.

## Configuration

Open Settings → General → School mode. On first setup choose a name, unlock kind, and credential twice, then select **Configure and enable**. After setup, **Save name** changes the display label and **Enable/Disable School mode** changes state. Disabling always requires the local credential; enabling an already configured mode does not ask for it. The credential field is cleared after every operation and never enters settings export, history, notifications, logs, renderer state snapshots, or diagnostics.

The shared record is versioned as `school-mode.v1.json` under the platform application-data root, not inside the repository or a user project. A missing, malformed, or legacy record fails closed to the disabled `School mode` name. Deleting that shared record is the documented local reset path; this is a user-experience lock, not a security boundary.

## Failure modes

An invalid name or credential is rejected before any write. A wrong credential leaves an enabled mode enabled and does not change its name. Enabling before a verifier is configured is rejected, so a renamed but unconfigured record can never create an unlocked enabled mode. Malformed records are ignored and replaced in memory by the disabled fallback; the application does not attempt to recover unknown fields or guess a legacy credential format.

## Security considerations

Credential verification runs in the main process with a bounded `scrypt` derivation, a random salt, and constant-time digest comparison. IPC requests are accepted only from the app's own renderer; the preload bridge exposes typed operations and never exposes the file path, salt, digest, or raw credential. The display name is presentation-only and cannot change the app identity, package ID, update feed, or data location. Passkey assertion input is treated as a bounded local verifier value until a platform credential adapter is available; no WebAuthn or OS credential claim is made by this app.

## Verification

`tests/school-mode.test.ts` proves persistence, no raw credential in the stored JSON, correct and incorrect verification, disable protection, pre-setup fail-closed enabling, malformed-record migration, and palette discoverability filtering. `npm run build:main`, `npm run build:preload`, and the renderer type check prove the typed main/preload seam. The generated offline and site documentation bundles are checked with `npm run docs:check`.

## Suggested articles

- [Settings, language, and display name](settings-language-and-display-name)
- [Command palette](command-palette)
- [Privacy and security](privacy-and-security)
