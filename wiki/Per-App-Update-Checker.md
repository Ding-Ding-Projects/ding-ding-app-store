# Per-app update checker

Each installed catalog app checks its own verified feed in the background and reports current, available, unavailable, or failed without blocking work.

- Configuration: bounded startup/background/manual checks and persisted notification preferences.
- Failure: offline, bad metadata, missing release, rate limit, or hash mismatch keeps a dated last-known state.
- Security: validated HTTPS metadata and verified asset integrity.
- Verification: runtime feed, scheduling, and notification evidence is pending.

Detailed source: `docs/features/per-app-update-checker.md`.
