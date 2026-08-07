# Verification

Verification names the exact revision and separates static checks, focused tests, builds, runtime operations, headless captures, release assets, and remote workflows.

- Configuration: focused checks first, then relevant build/runtime and required headless capture.
- Failure: absent dependency, failed test/build, unavailable headless route, missing artifact, or cancelled workflow is a boundary, not success.
- Security: evidence must redact secrets and protect private data.
- Verification: this lane proves static docs/site structure only; runtime, CI, release, installer, updater, and capture evidence remains pending.

Detailed source: `docs/features/verification.md`.
