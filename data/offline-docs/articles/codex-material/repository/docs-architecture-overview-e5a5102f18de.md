# Architecture overview

> Three layers, one rule: the CLI is the product, Studio is the surface.

Codex Studio is an **Electron 40** app. `electron/main.js` is the entry point named by
`package.json`'s `main`, and `electron-builder` packages the whole thing into a per-user NSIS
installer and a per-user MSI.

## 1. `app/` — the frontend (renderer)

Plain browser JavaScript. No bundler, no ES modules, no TypeScript, no build step. Files load in
the order `app/index.html` lists them and each attaches exactly one global.

| File | Global | Responsibility |
| --- | --- | --- |
| `app/vendor/react.production.min.js`, `react-dom.production.min.js` | `React`, `ReactDOM` | Vendored React **18.3.1** production UMD builds. Loaded in `<head>` before `support.js`, which throws `dc-runtime: window.React is not available yet` without them. |
| `app/support.js` | the `dc` runtime | Generated `dc-runtime`. Compiles the `<x-dc>` template into React elements and drives the logic class. **Do not hand-edit** — its first line says it is generated from `dc-runtime/src/*.ts`. |
| `app/codex-data.js` | `window.CODEX` | Static catalog of the CLI surface: `ENUMS`, `MODELS`, `SUBCOMMANDS`, `GLOBAL_FLAGS`, `SLASH`, `SETTINGS`, `FEATURES`, `HOOK_EVENTS`. Data, not behaviour — it drives the Console and Config panels. |
| `app/cx-i18n.js`, `cx-dimsum.js`, `cx-changelog.js`, `cx-notify.js`, `cx-tabs.js` | `window.CX_I18N`, `CX_DIMSUM`, `CX_CHANGELOG`, `CX_NOTIFY`, `CX_TABS` | Feature modules, each loadable on its own. `tools/test-frontend.mjs` unit-tests the first three; `cx-notify.js` and `cx-tabs.js` have no unit tests yet. |
| `app/codex-core.js` | `window.CX` | The runtime core: `bridge`, `store`, `toToml`, `evaluate` (regex), `CONSTRUCTS`, `FLAGS`, `LIMITS`, `color`, `i18n`, `narrator`, `vcs`, `notify`, `tabs`, `settings`, `dimsum`, `live`, `notifyBackendFailure`, and `sim` (the simulated state object). Loaded last, because it wires the `CX_*` modules into `CX` when they are present. |
| `app/index.html` | — | The `<x-dc>` template plus `class Component extends DCLogic`. |
| `app/fonts/`, `app/dimsum/`, `app/CHANGELOG.md` | — | Roboto and Roboto Mono (10 woff2 faces), the dim sum photographs with their `manifest.json`, and the changelog copy kept in step with the root file by `tools/sync-changelog.mjs`. |

Everything is loaded from disk. The CSP lives in a `<meta http-equiv="Content-Security-Policy">`
tag in `app/index.html` and starts `default-src 'self'`, so a CDN reference would simply fail. See
[frontend-runtime.md](app-doc://article/codex-material.repository.db80f8cc60983e2d#why-unsafe-eval-is-in-the-csp) for why `script-src`
carries `'unsafe-eval'`.

## 2. The `dc` runtime

`app/support.js` is a small template engine on top of React. It reads the `<x-dc>` element's inner
HTML, compiles `{{ … }}` holes, `sc-for`, `sc-if` and `style-*` attributes into React element
builders, evaluates the `<script data-dc-script>` block with `new Function`, and renders the
builders against the flat object returned by `Component.prototype.renderVals()`.

The important property: **the template is declarative and the logic is one class**. There is no
JSX, no component tree to thread props through, and no reactive graph. `renderVals()` returns
everything the template needs, computed fresh on each render. See
[frontend-runtime.md](app-doc://article/codex-material.repository.db80f8cc60983e2d).

## 3. `electron/` — the main process

Nine files, no framework, one dependency (`smol-toml`).

| File | Responsibility |
| --- | --- |
| `main.js` | Creates the `BrowserWindow` (1440×940, minimum 960×640, `frame: false` because the app draws its own Material 3 title bar), enforces the single-instance lock, denies every `window.open` and off-`file://` navigation, and kills every WSL shell on quit. |
| `preload.js` | The **only** bridge. Exposes `window.CODEX_BRIDGE` with an explicit 54-name allow-list, an `invoke`, a prefix-checked `listen` (`codex://` only), and three window helpers. |
| `commands.js` | Every `ipcMain.handle` registration in one place, each wrapped so the real error message reaches the GUI. Registration happens on `require`, which is why `tools/capture-main.cjs` can reuse it. |
| `lib/cli.js` | Finding and running `codex`: `codexHome()`, `resolveCodex()`, `run`, `runJson`, `parseLooseJson`, `stream` (both pipes drained concurrently, `onSpawn` handing back the child), `killTree`. |
| `lib/config.js` | `$CODEX_HOME/config.toml`: parse to JSON, write text rejecting invalid TOML, set or remove a dotted key path, and back the previous file up before every write. |
| `lib/catalog.js` | Everything the GUI lists — MCP servers, plugins, marketplaces, skills, hooks, feature flags, saved sessions, auth status, doctor, usage, cloud tasks — read from the real CLI and the real `$CODEX_HOME`, then normalised. |
| `lib/wsl.js` | Per-tab WSL runtimes: list distros (decoding UTF-16LE), spawn one long-lived shell per session, exec in it, stop, kill, shut down. |
| `lib/history.js` | The local git-backed append-only history in `$CODEX_HOME/studio`. |
| `lib/editors.js` | External editor detection by executable, launch, and reveal in File Explorer. |

## The process model

Electron's three contexts, and what each is allowed to touch:

```
┌ main process ─ electron/main.js, commands.js, lib/* ─────────────────┐
│  Full Node. Spawns codex.exe, wsl.exe, git, explorer.exe, editors.  │
│  Reads and writes $CODEX_HOME. Owns the window.                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ ipcMain.handle(name, handler)
                               │ win.webContents.send("codex://stdout", line)
┌──────────────────────────────┴──────────────────────────────────────┐
│  preload ─ electron/preload.js                                      │
│  Node available, but its ONLY export is contextBridge-exposed       │
│  window.CODEX_BRIDGE: a fixed command list, invoke, listen, window. │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ window.CODEX_BRIDGE.invoke(name, args)
┌──────────────────────────────┴──────────────────────────────────────┐
│  renderer ─ app/                                                    │
│  No require, no process, no fs, no network (CSP: connect-src 'self')│
│  Composes argv, renders what came back, owns localStorage.          │
└─────────────────────────────────────────────────────────────────────┘
                               │  child_process (from the main process only)
                      ┌────────┴────────┐
                      │  codex.exe      │  the real CLI — the only thing here
                      │  wsl.exe, git   │  that knows agent semantics
                      └─────────────────┘
```

`contextIsolation: true` and `nodeIntegration: false` are what make that middle row a boundary
rather than a suggestion: a bug in the page cannot reach the filesystem except through a command
that was deliberately put on the list. `sandbox: false` is set because the preload itself needs
`require("electron")`; the renderer is isolated either way. The full command surface, its argument
shapes and its security properties are in [ipc-bridge.md](app-doc://article/codex-material.repository.fbf656065cd7f1d8).

## Where the `codex` binary comes from

`electron/lib/cli.js` resolves it once, in this order, and reports which one won as
`binSource`:

1. **`CODEX_BIN`** — an explicit override always wins.
2. **The user's own install**, found with `where codex`. It owns their login, their `~/.codex` and
   their update channel. Shadowing it with a bundled copy is how a machine ends up "logged out" in
   this app and logged in everywhere else.
3. **The bundled copy** — `resources/codex-bin/bin/codex.exe` when packaged,
   `vendor/codex-bin/bin/codex.exe` from a checkout — so the app is useful on a machine that has
   never installed Codex.

`tools/fetch-codex.mjs` stages that copy from OpenAI's own published npm artifact
(`@openai/codex@<version>-win32-x64`), not a mirror. It is roughly **410 MB unpacked**, is
git-ignored, and is shipped as `extraResources` by `electron-builder`. `npm run dist` runs the
fetch before packaging.

If nothing is found, the resolver returns the bare name `codex` so the failure message names the
real problem rather than a path nobody recognises.

## Why the CLI is never reimplemented

Three reasons, in order of importance.

1. **Correctness.** Approval policy, sandbox behaviour, config precedence, plugin trust and hook
   trust are safety-relevant semantics that change with the CLI. A GUI that models them locally
   will eventually disagree with the binary the user actually runs, and the disagreement will be
   invisible until it matters. `electron/lib/cli.js` says it in one line: *"this module only knows
   how to find the binary, run it, and hand the output back verbatim."*
2. **Truthfulness.** When `codex doctor` reports a failure, Studio shows that failure. When a run
   exits non-zero, the exit code and both streams come back untouched (`codex_capture` returns
   `{ code, stdout, stderr, ok }`). Nothing is summarised into a friendlier lie, and a section of
   `codex_state` that failed is named in `errors` rather than rendered as an empty list.
3. **Maintenance.** A new subcommand or flag needs a catalog entry in `app/codex-data.js`, not a
   new code path. The composed argv goes to `codex_run` and the CLI decides what it means.

The two deliberate exceptions, both of which touch no agent behaviour:

- **`config.toml` writes.** Studio edits the file directly (`electron/lib/config.js`) rather than
  shelling out, because there is no CLI verb for "set this dotted key". Every write validates the
  TOML first and copies the previous file to `config.toml.studio-<epoch>.bak`.
- **Enable/disable toggles that are file state.** `mcp_servers.<name>.enabled` is a config key; a
  skill is disabled by renaming its directory to `<name>.disabled`, which is the convention the
  CLI itself uses when skipping one. Both are state on disk, not agent logic.

## Data that lives outside the app

| Location | Written by | Contents |
| --- | --- | --- |
| `$CODEX_HOME/config.toml` | The CLI and Studio | The real Codex configuration. `$CODEX_HOME` is the `CODEX_HOME` environment variable when set, else `%USERPROFILE%\.codex` (`codexHome()` in `electron/lib/cli.js`). |
| `$CODEX_HOME/config.toml.studio-*.bak` | Studio | Timestamped backups taken before each write. |
| `$CODEX_HOME/studio/` | Studio | The local git history repository — snapshot JSON plus a copy of `config.toml`. Local-only, never pushed, with its own committer identity so the user's global git config is untouched. |
| `$CODEX_HOME/sessions/`, `archived_sessions/` | The CLI | Rollout transcripts (`*.jsonl`). Studio reads only the first line of each to build the session list. |
| `$CODEX_HOME/skills/`, `~/.agents/skills/`, `<cwd>/.codex/skills/` | The user | Skill directories containing `SKILL.md`. |
| `localStorage`, keys prefixed `codexstudio.` | Studio | Everything that is Studio's own preference: theme, language mode, funny levels, appearance overrides, profiles, tab layout, notification history, cost inputs. |

Studio-only preferences never enter `config.toml`, and Codex configuration never enters
`localStorage`. Mixing the two would mean uninstalling Studio changed how the CLI behaves.

## Verification

```bash
node tools/test-frontend.mjs   # 23 tests across codex-core.js, cx-i18n.js, cx-dimsum.js, cx-changelog.js
node tools/test-backend.mjs    # 28 tests across electron/lib/* and the preload/commands agreement
npm start                      # the real app; the title bar must read "Electron IPC"
node tools/capture.mjs         # drives the real app and writes assets/screenshots/*.png
```

`tools/capture.mjs` is the honest check that a surface renders: it launches the same main process,
preload and frontend the installer ships, registers the **real** `electron/commands.js`, and
captures each panel with Electron's own `capturePage` in an off-screen window. A screenshot of a
panel that only works under the harness would be worse than no screenshot at all.
