# Repository agent instructions

This is a sanitized public mirror of the applicable shared project rules. Update the canonical private instructions first, then refresh this mirror. Never copy machine paths, account details, tokens, host inventories, or private conversational vocabulary into this repository.

## Scope and completion

- Work in a fresh linked worktree and preserve unrelated changes.
- Use `git` for local Git operations and `gh` for GitHub operations.
- Finish repository changes with focused tests, factual documentation, a commit, a push, exact remote-branch proof, default-branch integration, and safe cleanup.
- Do not claim runtime, release, deployment, or visual success from static checks alone.
- Keep one rolling progress Discussion and an issue-backed handoff with exact commits, test counts, run links, blockers, and next actions.

## Product requirements

- The product is a real Windows Electron application, not a demo or mock catalog.
- Use Material Design 3 throughout, a frameless custom title bar, English/Cantonese/bilingual modes, independent funny-level controls, accessibility, narrow-layout support, reduced motion, and non-blocking notifications.
- Every search surface has an adjacent full regex builder. The command palette opens with `Ctrl+Shift+F` and reaches every page, command, setting, and appearance control.
- Navigation uses persistent browser-style tabs, left by default, with overflow, pinning, grouping, search, keyboard support, and appearance customization.
- Every settings/properties surface has its own search and tab navigation. Every rendered element offers a persisted appearance editor, reset, and export/import path.
- The app and documentation site ship complete feature articles, related-article links, offline in-app documentation, and a build completeness check.
- Informational state uses corner notifications; destructive actions use the native two-key plus full-slider super-confirmation with an emergency exit.

## Catalog and execution safety

- Catalog only reviewed public Ding Ding Projects applications. Never expose private repositories, secrets, internal builders, probes, or infrastructure as consumer apps.
- The renderer may submit only typed application identifiers and user decisions. It never supplies shell commands, executable paths, download URLs, installer arguments, or raw filesystem locations.
- Installer adapters are reviewed per application. Require bounded HTTPS downloads, allowlisted origins, immutable release metadata, SHA-256 verification, fixed shell-free arguments, hidden child processes, cancellation, and honest exit results.
- Never infer silent or uninstall arguments for opaque executables. Uninstall only through the exact recorded/discovered entry.
- Source builds execute only from pinned commits and reviewed recipes inside a disposable, resource-bounded Windows sandbox/VM with no user secrets or host mounts.
- Keep Electron `contextIsolation` and sandboxing enabled, Node integration disabled, permissions denied, navigation blocked, and remote-authored Markdown isolated and sanitized.

## Updates and release

- Maintain separate state machines for managed-app updates and the App Store self-updater. Update discovery never starts an installer.
- The self-updater checks on startup and a bounded schedule, downloads only after policy validation, warns that artifacts are unsigned, and restarts only after `Restart to install update`.
- Code signing is permanently prohibited. Squirrel.Windows output must include `Setup.exe`, `RELEASES`, and a full `.nupkg`; verify executables are unsigned.
- GitHub Actions jobs use pinned GitHub-hosted cloud runners (`windows-2022` for checks, packaging, and release publication; `ubuntu-24.04` for Pages). This repository is public and has no registered self-hosted capacity. Do not route these workflows back to an unavailable self-hosted label without a new explicit owner decision and live runner evidence.
- Successful push/dispatch workflows test first and publish one unique non-draft release with a real installer, verified timing, line-count table, and required release metadata. Failed tests publish no release.

## Documentation and evidence

- Keep `README.md`, `ROADMAP.md`, `HANDOFF.md`, categorized feature docs, wiki, landing site, and changelog current in every behavior-changing task.
- Feature articles cover behavior, configuration, failure modes, security, and verification, then end with suggested articles.
- Use genuine packaged-artifact screenshots from the sanctioned hidden desktop route. Never use a mockup as proof.
- Public records use ordinary project language and must not expose private conversational conventions or memory content.
