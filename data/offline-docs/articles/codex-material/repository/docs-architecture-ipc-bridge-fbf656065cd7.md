# The IPC bridge

> The complete contract between the renderer (`app/`) and the Electron main process
> (`electron/`). Every command below is registered in `electron/commands.js` and named in the
> allow-list in `electron/preload.js`.

There are **50** commands: 47 `codex_*` and 3 `window_*`. There is no HTTP API, no local server
and no socket — see [../api/README.md](app-doc://article/codex-material.repository.ac0e4a04bf399f08).

The two lists are asserted to agree by `tools/test-backend.mjs` ("every command the preload
exposes is registered by the main process"), because a name in one list and not the other is a
call the UI can make and the backend will refuse, which surfaces as a mystery error at runtime.

## Process posture

| Setting | Value | Why |
| --- | --- | --- |
| `contextIsolation` | `true` | The page cannot reach Node at all. It gets `window.CODEX_BRIDGE` and nothing else. |
| `nodeIntegration` | `false` | No `require`, no `process`, no `fs` in the renderer. |
| `sandbox` | `false` | The preload itself uses `require("electron")`. The renderer is still isolated. |
| `devTools` | `true` | The devtools console is how a real round trip is verified. |

`electron/preload.js` exposes **named commands, not a generic `invoke`**: a command absent from
its `COMMANDS` array is rejected in the preload with ``unknown backend command `<name>` `` rather
than being forwarded to a channel that was never designed to be called from the page.

The preload also blocks navigation-shaped escapes indirectly — `electron/main.js` denies every
`window.open` and every `will-navigate` to a non-`file://` URL, handing `http(s)` URLs to
`shell.openExternal` so a link opens in the user's real browser instead of inside the app.

## Calling convention

```js
// app/codex-core.js — CX.bridge.invoke routes to CODEX_BRIDGE.invoke under Electron
CX.bridge.invoke("codex_version");                          // no arguments
CX.bridge.invoke("codex_state", { cwd: "C:/src/repo" });    // flat object
CX.bridge.invoke("codex_set_config", { key: "model", value: "gpt-5.1-codex" });
```

**Arguments are one flat object.** There is no nesting, no struct wrapper and no positional
form: the handler receives exactly what the caller passed, defaulted to `{}`:

```js
// electron/commands.js
ipcMain.handle(name, async (_event, args) => handler(args || {}));
```

`CX.bridge` reports `mode === "electron"` when `window.CODEX_BRIDGE` exists and `"browser"`
otherwise; in browser mode `invoke()` falls through to the local simulation in
`app/codex-core.js` — see [frontend-runtime.md](app-doc://article/codex-material.repository.db80f8cc60983e2d#browser-preview-mode).

Window controls have their own convenience wrappers, so the UI calls
`CX.bridge.window.minimize()` rather than naming `window_minimize`.

### Errors

Every handler is wrapped:

```js
try { return await handler(args || {}); }
catch (e) { throw new Error(e && e.message ? e.message : String(e)); }
```

The message the module threw is what crosses the boundary — `codex mcp add …` failures carry the
CLI's own stderr, not a generic "operation failed". The renderer surfaces it through
`CX.notifyBackendFailure(section, err)`, which raises an error notification carrying that text
verbatim (see [../features/notifications.md](app-doc://article/codex-material.repository.7cc84c1f327737cf)). Do not pattern-match
on the exact string in the renderer: Electron decorates errors that cross the IPC boundary, so the
message is preserved but not byte-identical.

### The `codex://stdout` streaming channel

`codex_run` is the only command that pushes. It sends one message per line, as the line arrives,
to the channel named in its `stream` argument:

```js
const un = CX.bridge.listen("codex://stdout", (event) => {
  // event.payload === { id: "<run id>", level: "out" | "error", text: "<one line>" }
});
await CX.bridge.invoke("codex_run", {
  id: runId, args: ["exec", "--json", "fix the test"], cwd, stream: "codex://stdout"
});
un();   // listen() returns an unsubscribe function in both modes
```

- `level` is `"out"` for stdout and `"error"` for stderr (`pump()` in `electron/lib/cli.js`).
- Both pipes are drained **concurrently**. Reading one to completion before touching the other
  deadlocks the moment a chatty process fills the pipe nobody is reading.
- The send target is the window registered by `commands.setWindow(win)` — the app window in
  `electron/main.js`, the off-screen capture window in `tools/capture-main.cjs`.
- The preload refuses to subscribe to any channel that does not start with `codex://`
  (``refusing to listen on `<channel>` ``). The main process will send on whatever `stream` name
  the caller passes, so a name outside that prefix is emitted and can never be heard.
- `app/index.html` keeps **one** subscription for the whole app and routes each line by `line.id`
  to the surface that started that run.

---

## Identity and startup

### `codex_version()`
Runs `codex --version`. Returns:

```jsonc
{ "version": "codex-cli 0.58.0",  // stderr text when the CLI writes its version there
  "home": "C:\\Users\\me\\.codex",
  "bin": "C:\\Users\\me\\AppData\\Local\\…\\codex.cmd",
  "binSource": "CODEX_BIN | installed on this machine | bundled with Codex Studio | not found",
  "bundled": false, "bridge": "electron", "ok": true }
```

`binSource` is the honest half: the app says which `codex` it is actually running. Resolution
order is `CODEX_BIN`, then `codex` on `PATH`, then the bundled copy — the user's own install wins
because it owns their login and their `~/.codex` (`resolveCodex()` in `electron/lib/cli.js`).

### `codex_state({ cwd? })`
One round trip that fills the whole shell on launch. The seven CLI-backed sections each run inside
`soft()`, which records a failure under `errors.<section>` and returns an empty fallback, so a
missing marketplace does not blank the MCP list beside it. `hooks` and `config` share one
`try/catch` reported as `errors.config` (both read the same file), and `skills` is a filesystem
scan that already swallows an unreadable directory.

```jsonc
{
  "codexHome": "C:\\Users\\me\\.codex",
  "version": "codex-cli 0.58.0",
  "bin": "…", "binSource": "…", "bundled": false,
  "auth":         { "method": "chatgpt|api|none|unknown", "detail", "account", "store", "authFile", "ok" },
  "mcp":          [ /* codex_mcp_list rows */ ],
  "plugins":      [ /* codex_plugin_list rows */ ],
  "catalog":      [ /* codex_plugin_catalog rows */ ],
  "marketplaces": [ { "name", "url", "plugins" } ],
  "skills":       [ { "name", "dir", "path", "enabled", "source": "user|project", "desc" } ],
  "hooks":        [ /* codex_hook_list rows */ ],
  "features":     [ { "key", "stage", "enabled" } ],
  "sessions":     [ /* newest 300, codex_session_list rows */ ],
  "config":       { /* config.toml parsed to JSON, or null when it did not parse */ },
  "wslDistros":   ["Ubuntu-24.04"],
  "errors":       { "mcp": "…", "config": "…" }   // only the sections that failed
}
```

`errors` is the point of the design: a section that failed appears there by name with what the
CLI said, because a silently empty list reads as "you have none", which is a different fact. The
renderer raises one warning notification per key (`CX.live.hydrate`).

---

## Configuration — `$CODEX_HOME/config.toml`

### `codex_read_config()`
Parses `config.toml` with `smol-toml` and returns it as JSON. An absent or empty file is `{}`, not
an error. Invalid TOML throws ``<path> does not parse: <detail>``.

### `codex_read_config_text()`
Returns `{ path, text }` — the raw file for the TOML editor. A missing file yields `text: ""`.

### `codex_write_config({ tomlText | toml })`
Reads `tomlText` first, then `toml` (`a.tomlText ?? a.toml ?? ""`). **No other alias is read** —
`app/index.html` currently sends `{ config, toml_text, toml }`, and it is the `toml` field that
lands.

Validates the TOML **before** touching disk (`refusing to write invalid TOML: …`), copies the
existing file to `config.toml.studio-<epoch>.bak`, then writes.
Returns `{ written: true, path, backup: "<path>|null", bytes }`.

### `codex_set_config({ key, value })`
`key` is a dotted path such as `mcp_servers.github.enabled` or `model_reasoning_effort`.
Intermediate tables are created as needed; a `null` or `undefined` value **deletes** the key.
Returns the same shape as `codex_write_config`.

Two behaviours worth knowing before using it:

- An intermediate segment that currently holds a scalar or an array is **replaced with a table**.
  It does not refuse the write.
- The document is rewritten from the parsed tree (`toml.stringify(root)`), so **comments and
  original formatting in `config.toml` are not preserved**. The pre-write backup is the copy that
  still has them.

---

## Running the CLI

### `codex_run({ args, cwd?, stream?, id? })`
| Field | Type | Meaning |
| --- | --- | --- |
| `args` | `string[]` | Full argv **after** the `codex` binary, already composed by the GUI. |
| `cwd` | `string?` | Working directory for the child process. |
| `stream` | `string?` | Channel to push each line on, e.g. `"codex://stdout"`. |
| `id` | `string?` | Opaque id echoed on every line so the GUI can attribute it to the tab that started the run. |

Throws `no arguments were composed for this run` when `args` is empty or not an array.
Returns `{ code, id, lines: [{ level, text }] }` once the child exits — the full transcript, so a
surface that missed the stream can still render everything. `stdio` is `["ignore", "pipe", "pipe"]`:
stdin is closed, so a subcommand that prompts cannot hang waiting for a keystroke that can never
arrive.

### `codex_capture({ args?, cwd? })`
One-shot capture for panels that need the text, not a live stream. Returns
`{ code, stdout, stderr, ok }` verbatim; a non-zero exit is reported, not thrown. Times out after
120 s (`DEFAULT_TIMEOUT`).

---

## Catalogs

### `codex_doctor()`
Runs `codex doctor --json --all` with a 180 s timeout and regroups the flat check map by category.
Returns
`{ at, version, overall, groups: [{ name, checks: [{ name, ok, status, detail, details, remediation }] }] }`.

### `codex_mcp_list()`
Runs `codex mcp list --json` and normalises each row:

```jsonc
{ "name", "transport": "stdio|…", "command", "args": [], "url", "cwd",
  "enabled": true, "status": "configured|disabled|error", "disabledReason": null,
  "oauth": false, "authStatus": "", "startupTimeoutSec": null, "toolTimeoutSec": null }
```

### `codex_mcp_toggle({ name })`
Enable/disable is a **config edit, not a CLI verb**: it flips `mcp_servers.<name>.enabled`, which
Codex reads on its next run. Returns the refreshed list.

### `codex_mcp_add({ name, transport?, command?, args?, url? })`
`transport` defaults to `"stdio"`. A stdio server requires `command` (`a stdio MCP server needs a
command`) and runs `codex mcp add  --  [args…]`. Any other transport requires `url`
(`an HTTP MCP server needs a URL`) and runs `codex mcp add <name> --url <url>`. Returns the
refreshed list.

### `codex_mcp_remove({ name })`
Runs `codex mcp remove <name>`; throws the CLI's stderr on failure. Returns the refreshed list.

### `codex_plugin_list()`
`codex plugin list --json` → the `installed` array as
`{ id, name, marketplace, version, installed, enabled, path, installPolicy, authPolicy, desc }`.

### `codex_plugin_catalog()`
`codex plugin list --available --json`, merging `installed` + `available`, de-duplicated and
sorted by `id`. This is what the plugin marketplace browser renders.

### `codex_plugin_install({ name })` · `codex_plugin_uninstall({ name })`
`codex plugin add <name>` / `codex plugin remove <name>`. Both return the refreshed installed
list, or throw the CLI's stderr.

### `codex_marketplace_list()`
`codex plugin marketplace list --json` → `[{ name, url, plugins }]`, where `url` is the row's
`root` or `source` field.

### `codex_marketplace_add({ name, url })` · `codex_marketplace_remove({ name })`
`codex plugin marketplace add <name> <url>` / `… remove <name>`. Both return the refreshed list.

### `codex_skill_list({ cwd? })`
Never throws. Scans for directories containing a `SKILL.md` in `$CODEX_HOME/skills` and
`~/.agents/skills` (both tagged `source: "user"`) and, when `cwd` is given, `<cwd>/.codex/skills`
(tagged `"project"`). A skill is **disabled when its directory name ends in `.disabled`** — the
convention the CLI itself uses when skipping one. `desc` is the first `description:` line of the
manifest. Rows: `{ name, dir, path, enabled, source, desc }`.

### `codex_skill_toggle({ dir, cwd? })`
Renames `<dir>` ⇄ `<dir>.disabled` on disk, so the state survives whichever client wrote it.
Throws `<dir> is not a skill directory` when there is no `SKILL.md`. Returns the refreshed list
for `cwd`.

### `codex_hook_list()`
Reads `[hooks.<event>]` out of `config.toml` (a table or an array of tables) and returns
`[{ event, index, name, command, scope, trusted, enabled }]`. `enabled` defaults to `trusted`, so
an untrusted hook lists as present and off.

### `codex_hook_toggle({ event, index? })`
Flips `enabled` for `hooks.<event>` at `index` (default `0`). **Refuses untrusted hooks** with
`untrusted hooks never run and cannot be enabled here` — trust is granted by the CLI, never by the
GUI. Throws ``no hook <event>#<index>`` when the pair does not exist. Array-form hooks are
rewritten wholesale, because a dotted path cannot address an array element. Returns the refreshed
list.

### `codex_features()`
Parses `codex features list`, whose lines read `key  <stage words>  <bool>`. Parsed from both ends
so a multi-word stage such as `under development` survives. Returns `[{ key, stage, enabled }]`.
Throws only when the parse found nothing *and* the CLI exited non-zero.

### `codex_set_feature({ key, value })`
Runs `codex features enable|disable <key>`, then re-lists. Throws
``\`codex features <verb> <key>\` failed: ``.

### `codex_session_list()`
Never throws. Walks `$CODEX_HOME/sessions` and `archived_sessions` for `*.jsonl` rollouts, sorts
by mtime **before** opening anything, keeps the newest 300, and reads **only the first line** of
each (the `session_meta` record) so a few hundred multi-megabyte transcripts stay cheap. Rows:
`{ id, name, cwd, path, updatedAt, archived, originator, cliVersion, interactive }`, where
`interactive` is `originator !== "codex_exec"`.

### `codex_session_action({ id, action })`
`action` ∈ `archive` | `unarchive` | `delete`, mapped onto `codex <verb> <id>`. Any other value
throws ``unknown session action `<other>` ``. Returns the refreshed list.

---

## Authentication

### `codex_login_status()`
Never throws. Runs `codex login status` and classifies the first line into
`method: "api" | "chatgpt" | "none" | "unknown"`, alongside `detail`, `account`,
`store` (`"file"` when `$CODEX_HOME/auth.json` exists, else `"keyring"`), `authFile`, `ok`.
It reports only whether the file exists; nothing here reads its contents.

### `codex_login({ method? })`
`codex login` opens a browser and blocks on the callback, so it is **spawned detached**
(`stdio: "ignore"`, `unref()`) and the GUI polls `codex_login_status` for the result. Returns
`{ started: true, pid }`.

`method === "api"` is **refused by design** with a message telling the user to run
`codex login --with-api-key` in a terminal, so an API key never passes through the GUI process,
its IPC or its logs.

### `codex_logout()`
Runs `codex logout`. Returns `{ ok, detail, auth }` with a freshly read auth status.

---

## WSL runtimes

See [../features/wsl-runtimes.md](app-doc://article/codex-material.repository.0fbf2567a414b01e). `session` is the tab id and is the
only field every call needs.

| Command | Arguments | Returns |
| --- | --- | --- |
| `codex_wsl_list()` | none | `{ distros: string[], instances: { <session>: { session, distro, cwd, pid, startedAt, auto, status } } }` |
| `codex_wsl_spawn({ session, distro?, cwd?, auto? })` | `distro` defaults to the first installed, `cwd` to `~` | The new instance. Throws `no WSL distribution is installed` or ``\`<distro>\` is not an installed WSL distribution``. |
| `codex_wsl_stop({ session })` | — | The instance with `status: "stopped"`, or `{ session, status: "absent" }`. Never throws. |
| `codex_wsl_kill({ session })` | — | The full list after removal. Never throws. |
| `codex_wsl_set({ session, patch })` | `patch` accepts `cwd`, `distro`, `auto` | The full list. Never throws. |
| `codex_wsl_exec({ session, command?, distro?, cwd? })` | `command` defaults to `codex --version` | `{ code, session, distro, cwd, lines: [{ level: "cmd"\|"out"\|"error", text }] }` |

A spawned instance is `wsl.exe -d <distro> --cd <cwd> -- bash -lc "sleep infinity"`, which keeps
the namespace and mounted drives alive for the tab without holding a pty open. `wsl -l -q` output
is decoded as **UTF-16LE** — reading it as UTF-8 turns every distro name into NUL-separated
garbage that then fails every comparison downstream.

Every tracked shell is killed on `window-all-closed` and `before-quit` (`wsl.shutdown()`), because
quitting without that leaves one `sleep infinity` per tab running until the machine reboots.

---

## Local version history

Backed by a git repository at `$CODEX_HOME/studio`, never a `.git` inside the user's own project,
never pushed. See [../features/local-version-control.md](app-doc://article/codex-material.repository.a0ecf3aefb9f14d2).

| Command | Arguments | Returns |
| --- | --- | --- |
| `codex_history_commit({ message, kind?, snapshot? })` | `kind` defaults to `"change"` | `{ committed: true, id, message, kind, repo }`, or `{ committed: false, reason: "nothing changed" }` |
| `codex_history_log({ limit? })` | default 200 | `{ commits: [{ id, at, kind, message }], repo }` — empty, not an error, before the first commit |
| `codex_history_show({ id })` | — | The snapshot JSON as it stood at that revision |
| `codex_history_diff({ id })` | — | `{ id, diff }` from `git show --format= --unified=1 <id>` |
| `codex_history_prune({ keep? })` | default 100 | `{ pruned, kept }` |

The commit subject is stored as `[<kind>] <message>` and split back apart by `codex_history_log`.
Each commit also writes a copy of the live `config.toml` beside the snapshot, so a revision shows
what the CLI itself was configured with at that moment. Restoring is the caller applying a
snapshot and committing the result — history is append-only, so an undo can itself be undone.

---

## External editors

### `codex_editors()`
Never throws. Probes each known candidate through `where <exe>` and then through per-candidate
path hints. Returns `{ editors: [{ id, label, exe }] }` containing **only editors actually
installed on this machine**. Candidates: VS Code, VS Code Insiders, Cursor, Windsurf, Zed, Sublime
Text, Notepad++, IntelliJ IDEA, Notepad.

### `codex_open_external({ path, editor?, exe? })`
Opens a file or a folder. `exe` wins if given; otherwise `editor` selects a candidate by id;
otherwise the first detected editor is used. `.cmd`/`.bat` shims are launched through a shell with
explicit quoting, a bare `.exe` is not. Throws `<path> does not exist`, ``unknown editor `<id>` ``,
`<label> is configured but was not found on this machine`, or `no supported editor was found on
this machine`. Returns `{ opened, editor, label, exe, pid }` (no `label` when `exe` was supplied).

### `codex_reveal({ path })`
`explorer.exe <path>` — the always-available fallback when no editor is installed. Throws
`<path> does not exist`. Returns `{ revealed }`.

---

## Miscellaneous

### `codex_fonts()`
Never throws. Enumerates `%WINDIR%\Fonts` and `%LOCALAPPDATA%\Microsoft\Windows\Fonts` for
`.ttf`, `.otf` and `.ttc` files and returns `{ fonts: string[] }` of de-duplicated,
case-insensitively sorted file stems with underscores turned into spaces. Reading the two
directories is far cheaper than enumerating the registry and covers both machine-wide and per-user
installs.

> The names are **file stems, not typographic family names**: `seguisb`, not `Segoe UI Semibold`.
> The appearance editor should treat them as candidates to validate, not as CSS family names to
> trust blindly.

### `codex_read_text({ path })`
Reads a UTF-8 text file and returns `{ path, text }`. An **absolute** path is read as given. A
**relative** path is tried against, in order: `process.resourcesPath` when packaged, the repository
root (`electron/..`), then `app/`. All three are tried rather than assuming which build this is,
because getting it wrong shows the user an empty changelog and no reason why. Throws
``<path> was not found. Looked in: <candidates>``.

This is how the changelog viewer loads `CHANGELOG.md` from inside the installer: `package.json`
ships it both in `files` and in `extraResources`.

### `window_minimize()` · `window_toggle_maximize()` · `window_close()`
The app draws its own Material 3 title bar (`frame: false`), so the buttons need real window
commands. `window_toggle_maximize` returns `{ ok, maximized }`; the other two return `{ ok: true }`.
The renderer reaches them through `CX.bridge.window.minimize()` / `.toggleMaximize()` / `.close()`,
which are thin wrappers in the preload.

---

## What the UI currently calls

The renderer names 27 commands literally, plus three more through the toggle map in
`toggleExt()` — `codex_mcp_toggle`, `codex_skill_toggle` and `codex_hook_toggle`, which is why a
grep for a literal name misses them. 25 registered commands are reachable but not called
directly today, mostly because their data already arrives through `codex_state`, which runs the
same `electron/lib/catalog.js` functions in-process: `codex_capture`, `codex_features`,
`codex_fonts`, `codex_history_diff`, `codex_history_show`, `codex_hook_list`,
`codex_login_status`, `codex_marketplace_add/list/remove`, `codex_mcp_add/list/remove`,
`codex_plugin_catalog`, `codex_plugin_list`, `codex_read_config`, `codex_read_config_text`,
`codex_session_action`, `codex_session_list`, `codex_set_config`, `codex_skill_list`. The three
`window_*` commands are called through the preload's `window` wrappers rather than by name.

> **These four call sites disagreed with their handlers, and every one of them failed silently.**
> `toggleExt()` dispatched every Extend toggle as `{ name: x.id }` regardless of what the handler
> reads, and the promise had no `.catch()`, so the rejection went nowhere and the switch simply
> never moved.
>
> | Call | Handler reads | Was | Now |
> | --- | --- | --- | --- |
> | `codex_mcp_toggle` | `{ name }` | correct | unchanged |
> | `codex_skill_toggle` | `{ dir, cwd? }` | `dir` undefined — threw on every click | the row carries `ref: { dir }` |
> | `codex_hook_toggle` | `{ event, index? }` | threw `no hook undefined#0` | the row carries `ref: { event, index }` |
> | `codex_plugin_toggle` | *never registered* | the preload refused it | removed — see below |
>
> There is no plugin toggle because **the CLI has none**: `codex plugin` offers `add`, `list`,
> `marketplace` and `remove`, and nothing else. The switch was promising an operation that cannot
> exist. Plugin rows are `locked` now and say so when clicked, and Remove is the way to take one
> out.
>
> The toggle chain is `.then().catch()`, in that order. A `.catch()` placed first still runs the
> success handler afterwards, which would have recorded a history revision claiming a failed
> toggle had worked.

---

## Security considerations

- **Windows spawns the CLI through a shell, and Node does not escape argv.** `codex` on `PATH`
  resolves to a `.cmd` shim, which `spawn`/`execFile` will not execute directly, so
  `electron/lib/cli.js` passes `shell: true` on win32. With `shell: true` Node concatenates the
  arguments into one command line **without quoting or escaping them** — it emits `DEP0190` for
  exactly this. A shell metacharacter inside any composed argument (a chat prompt, a path, an MCP
  server name) is therefore interpreted by `cmd.exe`. Verified locally:

  ```console
  $ node -e "require('child_process').execFile('node',['-e','console.log(JSON.stringify(process.argv.slice(1)))','a b','c&echo INJECTED'],{shell:true},(e,o)=>console.log(o))"
  ["a","b","c"]
  INJECTED
  ```

  Treat every value that reaches `args` as reaching a shell. `electron/lib/wsl.js` does **not**
  use `shell`, and passes the user's command to `bash -lc` deliberately.
- **The frontend composes argv; the backend does not audit it.** Nothing stops the GUI from
  composing `--dangerously-bypass-approvals-and-sandbox`. That flag must stay visible in the
  command preview at every funny level.
- **Secrets never travel over IPC.** API-key login is refused with an explanation
  (`codex_login`). Nothing in the bridge reads `auth.json`; `codex_login_status` reports only
  whether the file exists.
- **Config writes are always recoverable.** Every write validates the TOML first and leaves a
  `config.toml.studio-<epoch>.bak` beside the original. A dotted-path set re-serialises the
  document, so the backup is the only copy that still has the user's comments.
- **Path arguments are trusted, and are the sharpest edge here.** `codex_read_text` reads any
  absolute path, `codex_open_external` launches any executable passed as `exe`, and `codex_reveal`
  opens any existing path. These are reachable only from the app's own UI; a future feature that
  let remote or file-supplied content choose those arguments would turn them into an
  arbitrary-read and arbitrary-execute primitive. Keep the caller in charge.
- **The renderer has no filesystem and no network of its own.** `contextIsolation` plus
  `nodeIntegration: false` means the only way out of the page is this command list, and the CSP in
  `app/index.html` admits `connect-src 'self'` only — see
  [frontend-runtime.md](app-doc://article/codex-material.repository.db80f8cc60983e2d#why-unsafe-eval-is-in-the-csp).

## Failure modes

| Symptom | Cause | Where to look |
| --- | --- | --- |
| Every command fails with `could not start \`codex\`` or a spawn error | No `codex` on `PATH` and no bundled copy staged | `node tools/fetch-codex.mjs`, or set `CODEX_BIN`. `resolveCodex()` in `electron/lib/cli.js` |
| The app reports a version but the wrong one | An older `codex` earlier on `PATH` wins over the bundled copy by design | `codex_version().binSource` names the winner |
| `codex_state` returns rows but `errors` is populated | One CLI subcommand failed; the rest succeeded | The `errors` object names the section and carries the CLI's message |
| A `--json` command throws `did not return JSON` | The subcommand printed a human banner and no JSON body | `parseLooseJson` already retries from the first `{`/`[`; beyond that the CLI's output changed |
| ``unknown backend command `x` `` | The name is missing from `COMMANDS` in `electron/preload.js` | Add it to both lists; `tools/test-backend.mjs` asserts they agree |
| `invoke` resolves with plausible but fake data | The page is running in a browser, not in Electron | The title bar reads `Browser preview`; `CX.bridge.mode === "browser"` |
| A call silently does nothing | The payload does not match what the handler reads, and the rejection was swallowed by `.catch()` | [What the UI currently calls](#what-the-ui-currently-calls) |
| Streamed lines never arrive | Nobody called `commands.setWindow(win)`, or the `stream` name does not start with `codex://` | `electron/main.js`, `electron/preload.js` |
| `Attempted to register a second handler for '…'` | `electron/commands.js` was required twice in one process — registration happens on require, and the exported `register()` is a no-op | `electron/commands.js` |
| A run never finishes | The child is waiting on input | stdin is already closed (`stdio: ["ignore","pipe","pipe"]`); a subcommand that still blocks needs a non-interactive flag |

## Verification

1. **The two lists agree, and the count is what this page says.**
   ```bash
   grep -cE '^  "[a-z_]+",$' electron/preload.js      # 50
   grep -cE '^command\("[a-z_]+"' electron/commands.js  # 50
   node tools/test-backend.mjs                        # 22 tests, includes the agreement assertion
   ```
2. **Audit call-site argument shapes.** List what the renderer names, then compare each against
   what the handler reads:
   ```bash
   grep -ohE '"codex_[a-z_]+"' app/index.html app/cx-*.js | sort -u
   grep -nE '^command\("' electron/commands.js
   ```
3. **A real round trip.** Launch the app (`npm start`), confirm the title bar reads `Electron IPC`,
   then in the devtools console:
   ```js
   await window.CODEX_BRIDGE.invoke("codex_version");
   await window.CODEX_BRIDGE.invoke("codex_doctor");
   ```
   The first must report the same version as `codex --version` in a terminal; the second must
   report the same failures as `codex doctor --all`.
4. **Streaming works.** Start a `codex_run` with `stream: "codex://stdout"` and confirm lines
   arrive before the promise resolves, not all at once after it.
5. **The renderer really is isolated.** In the same console, `typeof require` and `typeof process`
   must both be `"undefined"`, and `window.CODEX_BRIDGE.invoke("nope")` must reject with
   ``unknown backend command `nope` ``.
