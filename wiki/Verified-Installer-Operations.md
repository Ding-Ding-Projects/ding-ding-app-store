# Verified installer operations

Selecting Install or Reinstall starts immediately with no phrase-entry dialog. The renderer sends only the catalog application ID and install decision; the main process resolves one immutable stable asset, validates its declared size and SHA-256 digest, launches fixed hidden arguments, and declares success only after the installer succeeds.

- Configuration: catalog-owned adapter, fixed unattended arguments, storage/elevation disclosure, unsigned-artifact label.
- Failure: missing asset, hash mismatch, cancellation, disk/permission error, or non-zero exit is never reported as success.
- Security: HTTPS, record-owned URLs, integrity validation, no false code-signing claim.
- Verification: direct one-click dispatch has focused source coverage; runtime download/execution evidence is pending.

Detailed source: `docs/features/verified-installer-operations.md`.
