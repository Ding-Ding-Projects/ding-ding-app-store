# Handoff

## Current state

The initial application foundation is in active development on `codex/initial-app-store`. The repository contains a sandboxed Electron/React/TypeScript shell, reviewed 24-application catalog, stable-release/update comparison, SHA-256-gated installer path, protected uninstall path, App Store self-updater state machine, Material Design 3 navigation, language/funny-level settings, regex builder, command palette, and initial in-app documentation.

## Verified locally

- Strict renderer and main-process TypeScript compilation.
- Vite production renderer build.
- Initial security, packaging, catalog, update, language, regex, navigation, and destructive-confirmation contract tests.

## Remaining

- Source builds are intentionally blocked until the disposable Windows runner is implemented.
- Install adapters need real-release verification per application; opaque installers remain unsupported instead of receiving guessed flags.
- Offline documentation import, full universal navigation/appearance/history/export/scheduling features, packaging, hidden-desktop runtime evidence, CI, release, update feed, and documentation deployment remain.
- A real labelled self-hosted runner has not yet been observed for this repository; no remote CI or release claim is valid.

## Next owner action

Integrate the isolated catalog-domain and documentation branches, run the combined checks, package the unsigned Squirrel application, exercise it on the sanctioned hidden desktop, then continue the remaining roadmap without weakening the execution boundary.
