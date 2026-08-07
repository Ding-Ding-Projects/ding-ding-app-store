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
- Allowlisted Squirrel/MSI/managed-portable discovery, protected removal descriptors, append-only operation history, local Git snapshots, and filtered multi-format export.
- Installer execution owned by the main process; the renderer cannot provide commands, paths, URLs, or arguments.
- Offline documentation articles with an in-app browser and full local search/regex builder.

</details>

<details>
<summary><strong>Packaged runtime evidence</strong></summary>

The unsigned packaged application was driven on the sanctioned hidden Windows desktop. The real [Installed screen](docs/assets/screenshots/installed-runtime.png) discovered reviewed Squirrel and managed-portable records, and the [Activity screen](docs/assets/screenshots/activity-runtime.png) rendered an append-only settings event with filtered export controls.

</details>

<details id="security-and-trust">
<summary><strong>Security and trust</strong></summary>

Installable assets require an allowlisted application, a reviewed asset matcher, an HTTPS GitHub release origin, a bounded declared size, and a GitHub SHA-256 digest. Install results are recorded only after the child process exits successfully. Uninstall uses only the exact entry recorded for that installation and requires the two-key plus full-slider destructive confirmation.

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
