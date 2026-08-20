# Packaging and updates

How WinSCP Material is built, installed, released and updated.

## Articles

| Article | Covers |
| --- | --- |
| [building.md](app-doc://article/material-winscp.repository.6aad0f73967b3eeb) | Building locally, the toolchain, and the real artefacts `npm run make` produces. |
| [installer.md](app-doc://article/material-winscp.repository.717d02e12a4672e9) | The Squirrel.Windows installer and the install/update lifecycle. |
| [ci.md](app-doc://article/material-winscp.repository.8db778203c304457) | The GitHub Actions workflow, its gating, and the token chain. |
| [site.md](app-doc://article/material-winscp.repository.8b4f79acaa2c8578) | The documentation site: its base path, what `--verify` proves, and how Pages publishes it. |
| [site-app.md](app-doc://article/material-winscp.repository.2614788641a445aa) | The site's client application: routing, search, appearance, tabs and accessibility. |
| [releases.md](app-doc://article/material-winscp.repository.ec20b3572803cd00) | Release tagging, assets, and the dim sum code names. |
| [updates.md](app-doc://article/material-winscp.repository.4dab9d9d6933f6db) | In-app update checks and how a user is offered a new version. |
| [changelog.md](app-doc://article/material-winscp.repository.fe6cd7532545ae84) | The in-app changelog viewer, its filters and its export. |

## Quick facts

| | |
| --- | --- |
| Runtime | Electron 33 |
| Installer | Squirrel.Windows, via `@electron-forge/maker-squirrel` |
| Also produced | A portable `.zip` |
| Code signing | **None.** SmartScreen will warn on first run. |
| CI runner | GitHub-hosted `windows-latest` |
| Release cadence | One release per successful CI run, uniquely tagged |

## Postman

Not applicable — this project exposes no HTTP API. See the
[documentation index](app-doc://article/material-winscp.repository.0b5ca119d2be595a).

## Suggested articles

- [The dim sum surprise](app-doc://article/material-winscp.repository.e023cb683da2e265) — the catalog release code names come from.
- Version history — the *other* thing in this project backed by git.
