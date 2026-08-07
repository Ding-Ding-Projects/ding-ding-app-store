# Source-build security

Source building is an explicit fallback that names the approved repository revision, declared command, toolchain, and expected output. It uses an isolated working directory and never turns a failed build into an install.

- Configuration: catalog-approved revision and owned output folder.
- Failure: missing toolchain, rejected revision, failing build, cancellation, or missing output has an honest recovery state.
- Security: source builds execute code; bound paths, revisions, commands, environment, and logs are essential.
- Verification: no source build was executed in this documentation lane.

Detailed source: `docs/features/source-build-security.md`.
