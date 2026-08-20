# Codex Studio — documentation

Codex Studio is a **Windows-only** Material 3 desktop GUI for the OpenAI Codex CLI, built on
**Electron 40** and packaged by electron-builder into a per-user NSIS installer and a per-user
MSI. It composes flags, runs the real `codex` binary and streams back exactly what the CLI said.
It never reimplements the agent, the sandbox, the config schema or the plugin system.

Everything here describes the repository as it actually stands. Where a capability is designed but
not yet shipped, the page says so in a **Status** line rather than describing it as if it were
finished.

## Categories

| Category | What lives there |
| --- | --- |
| [Architecture](app-doc://article/codex-material.repository.92691389bf6252f2) | How the `app/` frontend, the `dc` template runtime and the `electron/` main process fit together, the main/preload/renderer process model, and the full 50-command IPC surface |
| Build | Prerequisites, local builds, the bundled Codex CLI, installer packaging, continuous integration |
| [Features](app-doc://article/codex-material.repository.e7e392e08738485b) | Regex builder, tabs, appearance, notifications, local version control, external editors, WSL runtimes |
| [Experience](app-doc://article/codex-material.repository.9f08d6582b2cf061) | Language modes and funny levels, accessibility, changelog viewer, dim sum surprise |
| [API](app-doc://article/codex-material.repository.ac0e4a04bf399f08) | Why there is no HTTP API and no Postman collection, and where the IPC surface is documented instead |

The version history itself lives in `../CHANGELOG.md`, which is also shipped
inside the installer and rendered by the app's own changelog viewer.

## Repository map

```
app/                    frontend — no build step, plain browser JS
  index.html            the <x-dc> template plus `class Component extends DCLogic`
  support.js            generated dc-runtime (React-based template engine) — do not edit
  codex-core.js         window.CX — bridge, store, i18n, narrator, vcs, colour, regex engine
  codex-data.js         window.CODEX — CLI subcommand / flag / setting / slash-command catalog
  cx-i18n.js cx-tabs.js cx-notify.js cx-changelog.js cx-dimsum.js
                        feature modules attached to window.CX_*
  vendor/               React 18.3.1 UMD, vendored so nothing is fetched at runtime
  fonts/                Roboto and Roboto Mono woff2 (10 faces), bundled for the same reason
  dimsum/               the bundled dish photographs plus manifest.json
  CHANGELOG.md          mirror of the root file, kept in step by tools/sync-changelog.mjs
electron/               the main process
  main.js               window creation, lifecycle, navigation guards
  preload.js            the contextBridge allow-list — every command name the page may call
  commands.js           every ipcMain.handle registration, in one place
  lib/cli.js            binary resolution, run / runJson / stream
  lib/config.js         $CODEX_HOME/config.toml read, write, backup, dotted paths
  lib/catalog.js        MCP, plugins, marketplaces, skills, hooks, features, sessions, auth, doctor
  lib/wsl.js            per-tab WSL runtimes
  lib/history.js        git-backed append-only snapshots
  lib/editors.js        external editor detection
tools/                  fetch-codex.mjs (stage the bundled CLI), capture.mjs + capture-main.cjs
                        (screenshot harness), test-frontend.mjs, test-backend.mjs,
                        sync-changelog.mjs, make-icon.mjs, release-codename.mjs, sync-dimsum.ps1,
                        sync-dimsum-roster.mjs
vendor/codex-bin/       the bundled Codex CLI (~410 MB, git-ignored, staged by fetch-codex.mjs)
vendor/codex            git submodule pointing at https://github.com/openai/codex (reference only)
assets/                 icons, and screenshots written by the capture harness
design/                 the original design-tool export the app was grown from
docs/                   this tree
.github/workflows/ci.yml
```

## The commands that matter

```bash
npm start                     # run the app
npm test                      # frontend tests, backend tests, changelog mirror check
node tools/test-frontend.mjs  # 23 tests across app/codex-core.js and the cx-* modules
node tools/test-backend.mjs   # 22 tests across electron/lib/* and the preload/commands agreement
node tools/capture.mjs        # drive the real app, write assets/screenshots/*.png
npm run prepare:cli           # stage the bundled Codex CLI into vendor/codex-bin
npm run dist                  # NSIS + MSI installers into dist/
```

## Conventions used by these pages

- Every feature has its own file under a categorised subfolder; every category has a `README.md`
  index.
- Every feature page documents **behaviour, configuration, failure modes, security considerations
  and how to verify it**.
- Paths are repository-relative. Runtime paths use `$CODEX_HOME`, which is the `CODEX_HOME`
  environment variable when set and `%USERPROFILE%\.codex` otherwise (`codexHome()` in
  `electron/lib/cli.js`).
- Command names, config keys and flags in these pages were read out of the source. If one
  disagrees with the code, the code is right and the page is a bug.

## The one rule the whole product rests on

The GUI is a **front end**, not a reimplementation. Every panel either

1. invokes the real `codex` binary and renders its output, or
2. reads and writes a real file (`$CODEX_HOME/config.toml`, a skill directory, a rollout
   transcript), or
3. is a local convenience (cost arithmetic, the regex builder, appearance) that touches no agent
   behaviour at all.

If a change would require Studio to model something the CLI already models — approval policy
semantics, sandbox rules, config validation — the change is wrong. Run the CLI and show what it
said.

The corollary is where the binary comes from: `CODEX_BIN`, then whatever `codex` is on `PATH`,
then the copy bundled with the installer. The user's own install always wins, because it owns
their login and their `~/.codex`, and the app reports which one it is running
([architecture/overview.md](app-doc://article/codex-material.repository.e5a5102f18de6b16#where-the-codex-binary-comes-from)).
