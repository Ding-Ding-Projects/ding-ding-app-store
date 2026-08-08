# Features

One page per feature. Each documents behaviour, configuration, failure modes, security
considerations and how to verify it.

Codex Studio is a **Windows-only Electron 40** application. The renderer talks to the main
process through `window.CODEX_BRIDGE.invoke(name, args)` — a fixed allow-list declared in
`electron/preload.js` — and every name on that list is registered with `ipcMain.handle` in
`electron/commands.js`. There is no Rust, no `window.__TAURI__` and no generic invoke.

| Feature | Owner file(s) | One line |
| --- | --- | --- |
| [Chats and runs](app-doc://article/codex-material.repository.64fc1a5bff729ef7) | `app/index.html` (`sendChat`, `profileArgv`, `expandPath`, `buildArgv`, `startRun`, `doRun`), `electron/commands.js` (`codex_run`), `electron/lib/cli.js` (`stream`) | How a prompt becomes an argv, and how its output streams back line by line over `codex://stdout` |
| [Regex builder](app-doc://article/codex-material.repository.7ced8600c459bff3) | `app/codex-core.js` (`evaluate`, `nestedQuantifier`, `CONSTRUCTS`, `FLAGS`, `LIMITS`), `app/index.html` | Every search bar has a full, anchored, bounded regex builder beside it — and refuses the shapes a time budget cannot save it from |
| [Tabs](app-doc://article/codex-material.repository.57f8386a7beff582) | `app/cx-tabs.js` (`window.CX_TABS`), `app/index.html` | Browser-style strip: pin, group, overflow, four searches, bulk close from one shared predicate |
| [Appearance](app-doc://article/codex-material.repository.76c14a1ab0254ae4) | `app/index.html` (the editor), `app/codex-core.js` (`color`) | Per-element editor, a twelve-space colour translator and a contrast readout |
| [Notifications](app-doc://article/codex-material.repository.7cc84c1f327737cf) | `app/cx-notify.js` (`window.CX_NOTIFY`), `app/index.html` | Non-blocking toasts, a reviewable centre, and the one place a modal is correct |
| [Local version control](app-doc://article/codex-material.repository.a0ecf3aefb9f14d2) | `electron/lib/history.js`, `app/codex-core.js` (`vcs`) | Append-only git history in `$CODEX_HOME/studio`; restoring is a new revision |
| [External editor](app-doc://article/codex-material.repository.636d8ce717d7ce5e) | `electron/lib/editors.js` | Detect what is installed, open a folder or file, fall back to Explorer |
| [WSL runtimes](app-doc://article/codex-material.repository.0fbf2567a414b01e) | `electron/lib/wsl.js` | One long-lived Linux shell per tab, so `cd` and env survive between commands |

Experience-level behaviour — the three language modes, the two funny sliders, accessibility, the
changelog viewer and the dim sum surprise — lives in [../experience/](app-doc://article/codex-material.repository.9f08d6582b2cf061).

## Rules that apply to every feature here

- **Every search bar gets the full anchored regex builder.** Not a reduced toggle, not a link
  elsewhere. Plain text stays the default; regex is an explicit opt-in. Nine fields carry a
  `data-anchor` today: `list`, `ext`, `set`, `clog`, `studio`, `slash`, `palette`, `dd` and
  `bulk`.
- **Every rendered element is an appearance target.** Give it `data-appear="<name>"` and end its
  context menu with `this.appearItem(e)`. There are 41 named targets in the shipped template.
- **Informational messages are notifications, never modals.** A modal is for a decision that must
  be made before anything else can continue. Exactly one exists: the bulk-close gate.
- **Anything the user could regret is committed to History**, with a message naming what changed
  rather than that something did.
- **All copy goes through `CX.i18n.t()`**, so all three language modes and both funny sliders
  apply — including to errors and destructive confirmations. See
  [../experience/language-modes.md](app-doc://article/codex-material.repository.2637d041ae1cdd3c).
- **Keyboard and screen-reader operation is a completion blocker**, not polish. The honest audit
  of what is and is not implemented is in
  [../experience/accessibility.md](app-doc://article/codex-material.repository.89891138dfc32b4e).

## Verifying anything on these pages

```
node tools/test-frontend.mjs     23 tests over app/codex-core.js, cx-i18n.js, cx-dimsum.js, cx-changelog.js
node tools/test-backend.mjs      22 tests over electron/lib/*.js and the preload/commands contract
node tools/capture.mjs           drives the real app and writes assets/screenshots/*.png
npm test                         both suites plus the bundled-changelog check
```

Both suites are dependency-free and need neither Electron nor a `codex` binary on PATH. The
counts above are the current pass counts, not targets.
