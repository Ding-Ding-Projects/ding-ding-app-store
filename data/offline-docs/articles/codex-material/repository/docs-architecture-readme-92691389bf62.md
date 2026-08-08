# Architecture

How Codex Studio is put together, and the contracts each layer owes the others.

| Page | What it covers |
| --- | --- |
| [Overview](app-doc://article/codex-material.repository.e5a5102f18de6b16) | The layers — `app/` frontend, the `dc` template runtime, the `electron/` main process — the main/preload/renderer process model, where the `codex` binary comes from, and why the CLI is never reimplemented |
| [IPC bridge](app-doc://article/codex-material.repository.fbf656065cd7f1d8) | The `CODEX_BRIDGE.invoke` contract and all 55 commands registered in `electron/commands.js`, with argument shapes, return shapes, the `codex://stdout` streaming channel and the security posture |
| [Frontend runtime](app-doc://article/codex-material.repository.db80f8cc60983e2d) | How the `<x-dc>` template and the `DCLogic` class render through vendored React 18.3.1, why the CSP needs `'unsafe-eval'`, and how to add a panel |

## The layers in one picture

```
┌ renderer (Chromium) ──────────────────────────────────────────────────┐
│  app/index.html                                                       │
│    <x-dc> …template… </x-dc>      declarative markup, {{ bindings }}   │
│    <script data-dc-script>        class Component extends DCLogic     │
│                                                                       │
│  app/vendor/react*.js  React 18.3.1 UMD, vendored — no CDN            │
│  app/support.js        generated dc-runtime: compiles the template to │
│                        React elements, drives the logic class         │
│  app/codex-core.js     window.CX — bridge, store, i18n, vcs, colour, …│
│  app/cx-*.js           window.CX_TABS / CX_NOTIFY / CX_I18N / …       │
│                                                                       │
│  no require · no process · no fs · CSP connect-src 'self'             │
└───────────────────────────────┬───────────────────────────────────────┘
                                │  window.CODEX_BRIDGE.invoke(cmd, args)
                                │  window.CODEX_BRIDGE.listen("codex://…")
┌ preload ── electron/preload.js ┴───────────────────────────────────────┐
│  contextBridge only. A 50-name allow-list, not a generic invoke.       │
└───────────────────────────────┬───────────────────────────────────────┘
                                │  ipcMain.handle / webContents.send
┌ main process ─────────────────┴───────────────────────────────────────┐
│  electron/main.js       window, lifecycle, navigation guards          │
│  electron/commands.js   all 50 ipcMain.handle registrations          │
│    lib/cli.js      find / run / stream the `codex` binary            │
│    lib/catalog.js  MCP, plugins, marketplaces, skills, hooks, …      │
│    lib/config.js   $CODEX_HOME/config.toml read + safe write         │
│    lib/history.js  git-backed append-only local history              │
│    lib/editors.js  external editor detection and launch              │
│    lib/wsl.js      per-tab WSL runtimes                              │
└───────────────────────────────┬───────────────────────────────────────┘
                                │  node:child_process
                       ┌────────┴────────┐
                       │  codex.exe      │  the real CLI — the only thing
                       │  wsl.exe, git   │  that knows agent semantics
                       └─────────────────┘
```

## Contracts between layers

- **Renderer → main** is one function: `CX.bridge.invoke(name, args)`, where `name` must be on the
  preload's list and `args` is one flat object. No `fetch`, no WebSocket, no HTTP server.
- **Main → renderer** is a command's return value, plus one push channel: `codex_run` sends each
  stdout/stderr line to `codex://stdout` as it arrives.
- **Main → the world** is `node:child_process`. Every capability is a real invocation of `codex`,
  `git`, `wsl.exe`, `explorer.exe` or an editor executable.
- Nothing in the app opens a network socket at runtime. React, the fonts, the dim sum photographs
  and the changelog are all bundled.
