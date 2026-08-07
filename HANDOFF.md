# Handoff

## Current state

The application foundation is continuing on `codex/complete-app-store-phase2`. In addition to the initial sandboxed Electron/React/TypeScript catalog, it now discovers reviewed Squirrel, MSI, and managed-portable installations; reconstructs only fixed safe uninstall descriptors; records append-only operation history plus local Git snapshots; and exposes filtered JSON, JSONL, CSV, and Markdown history exports.

## Verified locally

- Strict renderer and main-process TypeScript compilation.
- Vite production renderer build.
- Initial security, packaging, catalog, update, language, regex, navigation, and destructive-confirmation contract tests.
- Unsigned Squirrel.Windows package creation with `Setup.exe`, `RELEASES`, and a full `.nupkg`; setup and packaged app both report `NotSigned`.
- Packaged application launch on the sanctioned cheap hidden desktop; the curated catalog rendered in the real artifact. See `docs/assets/screenshots/catalog-runtime.png`.
- Phase-two packaged application launch on the same hidden route: the Installed screen discovered a real allowlisted Squirrel installation plus a managed-portable proof fixture, and the Activity screen rendered a settings-history event with export controls. See `docs/assets/screenshots/installed-runtime.png` and `docs/assets/screenshots/activity-runtime.png`.
- App/installed-state tests: 18/18; catalog tests: 11/11; domain tests: 20/20. All strict typechecks, builds, Squirrel packaging, and the high-severity dependency audit passed.

## Remaining

- Source builds are intentionally blocked until the disposable Windows runner is implemented.
- Install/uninstall adapters still need real-release verification per application; opaque installers remain unsupported instead of receiving guessed flags.
- Offline documentation import, full universal navigation/appearance/history/export/scheduling features, CI, release, working update feed, and documentation deployment remain.
- The self-update failure state is runtime-verified: the repository has no release yet, so `RELEASES` returns HTTP 404. No successful update is claimed.
- A real labelled self-hosted runner has not yet been observed for this repository; no remote CI or release claim is valid.

## Next owner action

Integrate the offline-docs and source-build lanes, run the combined checks, then complete real per-application adapter proofs, publication automation, and the remaining universal UI requirements without weakening the execution boundary.
