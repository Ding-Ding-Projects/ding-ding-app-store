# Ding Ding App Store

Material Design 3 desktop software center for discovering, documenting, installing, updating, building, and uninstalling supported public applications from [Ding Ding Projects](https://github.com/Ding-Ding-Projects).

`npm install && npm start`

**Documentation site:** <https://ding-ding-projects.github.io/ding-ding-app-store/><br>
**Current state:** active development; no verified installer has been published yet.

## Contents

- [Application architecture](#application-architecture)
- [Security and trust](#security-and-trust)
- [Development](#development)
- [Project guidance](#project-guidance)

<details id="application-architecture">
<summary><strong>Application architecture</strong></summary>

- Frameless Electron window with a React/TypeScript Material Design 3 renderer.
- Sandboxed renderer (`contextIsolation`, no Node integration) and a narrow typed preload bridge.
- Reviewed, versioned public catalog; private repositories and infrastructure never enter the product catalog.
- Stable-release comparison for every catalog entry and a separate unsigned Squirrel self-updater.
- Installer execution owned by the main process; the renderer cannot provide commands, paths, URLs, or arguments.
- Offline documentation articles with an in-app browser and full local search/regex builder.
- Persistent browser-style tab rail with pinning, grouping, overflow, tab search, and complete keyboard control.
- Per-surface search state, a full regex builder everywhere, and a command palette that reaches every page, command, setting, and appearance control.
- Per-element appearance editor with live preview, reset, and export/import, applied through CSS custom properties only.
- Main-process update schedule with a launch check that cannot be disabled, bounded repeat intervals, and quiet hours that hold notifications without delaying checks.

</details>

<details id="security-and-trust">
<summary><strong>Security and trust</strong></summary>

Install and Reinstall are genuine one-click actions: the catalog button immediately submits only the application ID and a closed install decision, with no phrase-entry dialog. Installable assets still require an allowlisted application, a reviewed asset matcher, an HTTPS GitHub release origin, a bounded declared size, and a GitHub SHA-256 digest. Install results are recorded only after the hidden child process exits successfully. Uninstall uses only the exact entry recorded for that installation and still requires the two-key plus full-slider destructive confirmation.

The common dispatch is implemented, but fully automatic fresh-Windows coverage is not: the current [24-app adapter matrix](docs/features/one-click-installation.md) records every missing release, archive, source-toolchain, dependency-bootstrap, disposable-runner, bounded OpenCode-repair, cancellation, and runtime-proof requirement without treating a guessed command as an adapter.

Source recipes are catalogued but are never executed directly on the host. The product will enable that path only through a disposable, resource-bounded Windows build runner.

Code signing is intentionally prohibited. Published Windows packages are unsigned and may trigger Windows SmartScreen or an unknown-publisher warning.

</details>

<details id="development">
<summary><strong>Development and verification</strong></summary>

```powershell
npm install
npm run check
npm run build
npm run dist
```

The application uses Squirrel.Windows. A successful package must contain `Setup.exe`, `RELEASES`, and a full `.nupkg`, and the executable must be verified as unsigned.

</details>

<details id="project-guidance">
<summary><strong>Project guidance</strong></summary>

Repository-specific agent rules are in [`AGENTS.md`](AGENTS.md). The feature documentation under [`docs/features/`](docs/features/) and the in-app documentation bundle are the behavior record; update both whenever behavior changes.

</details>

## License

Apache-2.0. See [`LICENSE`](LICENSE).
