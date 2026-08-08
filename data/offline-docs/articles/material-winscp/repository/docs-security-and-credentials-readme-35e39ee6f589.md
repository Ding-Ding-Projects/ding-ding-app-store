# Security and credentials

Everything about proving who the server is, proving who you are, and keeping the
proof safe on disk.

## Articles

| Article | Covers |
| --- | --- |
| [host-keys.md](app-doc://article/material-winscp.repository.0748f1d3b696a738) | SSH host key and TLS certificate verification, and the trust store. |
| [credential-storage.md](app-doc://article/material-winscp.repository.9d2325dcc3bf8dd4) | How a saved secret is protected — and when it is refused rather than stored. |
| [master-password.md](app-doc://article/material-winscp.repository.615b74d9401eef58) | The master password, its derivation, and what it does and does not cover. |
| [master-password-rewrap-fail-closed.md](app-doc://article/material-winscp.repository.6a1984e533e780bf) | Fail-closed handling when a credential cannot be rewrapped. |
| [file-encryption.md](app-doc://article/material-winscp.repository.644e9d8291155c00) | At-rest encryption of transferred files. |
| [logging.md](app-doc://article/material-winscp.repository.d1ac326b8468819c) | Session logs, redaction, and what debug levels expose. |
| [putty-interop.md](app-doc://article/material-winscp.repository.53e2e88d508d9464) | Safe PuTTY key and session metadata import, normalization, and failure handling. |
| [putty-key-preflight.md](app-doc://article/material-winscp.repository.93667f41c74367bd) | Bounded PPK v2/v3 metadata validation before launching external PuTTY. |

## The three rules

1. **A secret is protected or it is not stored.** `design/main/crypto.js` wraps
   secrets with the OS keychain, or with a scrypt-derived key when a master
   password is set. If neither is available the secret is **not written** and the
   app asks each time. There is no "store it in plain text just this once".

2. **Trust decisions are explicit, pinned, and re-asked when they change.** Host
   keys and certificates are stored by fingerprint in `hostkeys.json`. A change
   stops the connection and asks — including, especially, during an automatic
   reconnect.

3. **Encryption is never silently downgraded.** Selecting an unencrypted
   protocol warns. Falling back from an encrypted protocol to an unencrypted one
   is offered, never performed automatically.

## Reporting a vulnerability

See `SECURITY.md` in the repository root.

## Postman

Not applicable — this project exposes no HTTP API. See the
[documentation index](app-doc://article/material-winscp.repository.0b5ca119d2be595a).

## Suggested articles

- Sessions and sites — where credentials are entered and stored.
- Protocols — the per-protocol security options.
- Version history — which snapshots encrypted data as ciphertext, never plaintext.
