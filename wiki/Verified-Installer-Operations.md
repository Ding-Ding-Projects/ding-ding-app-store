# Verified installer operations

Installation begins only from an immutable release asset with expected version, platform, and integrity metadata. It stages, validates, reports progress, and declares success only after the installer succeeds.

- Configuration: validated install location, storage/elevation disclosure, unsigned-artifact label.
- Failure: missing asset, hash mismatch, cancellation, disk/permission error, or non-zero exit is never reported as success.
- Security: HTTPS, record-owned URLs, integrity validation, no false code-signing claim.
- Verification: runtime download/execution evidence is pending.

Detailed source: `docs/features/verified-installer-operations.md`.
