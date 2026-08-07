# Handoff

## Current state

The initial application foundation is in active development on `codex/initial-app-store`. The repository contains a sandboxed Electron/React/TypeScript shell, reviewed 24-application catalog, stable-release/update comparison, SHA-256-gated installer path, protected uninstall path, App Store self-updater state machine, Material Design 3 navigation, language/funny-level settings, regex builder, command palette, and initial in-app documentation.

## Verified locally

- Strict renderer and main-process TypeScript compilation.
- Vite production renderer build.
- Initial security, packaging, catalog, update, language, regex, navigation, and destructive-confirmation contract tests.
- Unsigned Squirrel.Windows package creation with `Setup.exe`, `RELEASES`, and a full `.nupkg`; setup and packaged app both report `NotSigned`.
- Packaged application launch on the sanctioned cheap hidden desktop; the curated catalog rendered in the real artifact. See `docs/assets/screenshots/catalog-runtime.png`.

## Remaining

- Source builds are intentionally blocked until the disposable Windows runner is implemented.
- Install adapters need real-release verification per application; opaque installers remain unsupported instead of receiving guessed flags.
- Offline documentation import, full universal navigation/appearance/history/export/scheduling features, CI, release, working update feed, and documentation deployment remain.
- The self-update failure state is runtime-verified: the repository has no release yet, so `RELEASES` returns HTTP 404. No successful update is claimed.
- A real labelled self-hosted runner has not yet been observed for this repository; no remote CI or release claim is valid.

## Next owner action

Integrate the isolated catalog-domain and documentation branches, run the combined checks, package the unsigned Squirrel application, exercise it on the sanctioned hidden desktop, then continue the remaining roadmap without weakening the execution boundary.
