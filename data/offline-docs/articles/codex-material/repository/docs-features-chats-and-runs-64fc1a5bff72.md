# Chats and runs

> Every message is a real `codex` process. The frontend composes an argv **array**, the main
> process spawns it, and each stdout/stderr line is pushed back to the window as it arrives — so a
> long agent turn shows its work instead of a spinner that ends in a wall of text.

**Implementation:** `app/index.html` — `sendChat`, `profileArgv`, `expandPath`, `startRun`,
`buildArgv`, `buildCommand`, `doRun`, `stopChat`, and the single `codex://stdout` listener
registered in `componentDidMount`; `electron/commands.js` — `codex_run`, `codex_cancel`,
`codex_running` and the `Runs` map they share; `electron/lib/cli.js` — `stream`, `codexBin`,
`killTree`. The transcript itself is `state.messages`; the Console log is `state.runOutput`.

## The two surfaces, and the one function underneath them

| Surface | Started by | Argv built by | Rendered into |
| --- | --- | --- | --- |
| **Chat composer** | `sendChat` — the ↑ button, Enter without Shift (`onChatKey`), or the slash panel's **Run now** (`slashRun`) | `["exec"]` + `profileArgv()` + `[prompt]` | the reply bubble at `messages[replyIndex]` |
| **Console** | `doRun` — the **Run** button beside the command preview | `buildArgv(sub)` | `runOutput`, the black log below the preview |

Both call `startRun(argv, { cwd, onLine })`. There is no third path: nothing else in the app
invokes `codex_run`.

```js
startRun(argv, opts) {
  const id = "run-" + Math.random().toString(36).slice(2, 9);
  const o = opts || {};
  this._runs = this._runs || {};
  this._runs[id] = { onLine: o.onLine || (() => {}) };
  return CX.bridge
    .invoke("codex_run", { id: id, args: argv, cwd: o.cwd || null, stream: "codex://stdout" })
    .then((res) => { delete this._runs[id]; return Object.assign({ id: id }, res); })
    .catch((e) => { delete this._runs[id]; throw e; });
}
```

The id is the only thing that ties a streamed line back to the surface that asked for it, and the
entry is deleted on both settle paths so a finished run stops routing.

## What the composer executes

```js
const slash = text.startsWith("/");
const argv = slash
  ? text.slice(1).split(/\s+/).filter(Boolean).concat(this.profileArgv())
  : ["exec"].concat(this.profileArgv(), [text]);
```

An ordinary message becomes `codex exec … <prompt>`. A message beginning with `/` is **forwarded as
the subcommand it names**: `/mcp list` becomes `codex mcp list …`, with the same profile flags
appended after it.

`profileArgv()` is the part every chat run shares:

```js
profileArgv() {
  const p = this.profile();
  const argv = ["-C", this.expandPath(p.cwd), "--skip-git-repo-check"];
  if (p.model) argv.push("-m", p.model);
  if (this.state.yolo) {
    argv.push("--dangerously-bypass-approvals-and-sandbox");
  } else {
    if (p.sandbox) argv.push("-s", p.sandbox);
    if (p.approval) argv.push("-c", "approval_policy=" + JSON.stringify(p.approval));
  }
  return argv;
}
```

| Piece | Why it is there |
| --- | --- |
| `-C <expanded cwd>` | The agent's working root. The same directory is *also* passed as the child process's own `cwd` through `startRun`, so relative paths in the CLI's output mean what they look like. |
| `--skip-git-repo-check` | The profile's directory is frequently not a git repository (`$CODEX_HOME`, a scratch folder). Without this the run refuses to start. |
| `-m <model>` | Only when the profile actually has one. |
| `--dangerously-bypass-approvals-and-sandbox` | Under YOLO, **instead of** `-s`/`-c` — the two are mutually exclusive by construction, not by hope. |
| `-s <sandbox>` + `-c approval_policy=…` | The profile's sandbox and approval policy, when set. |

Every value comes from the **Studio profile record**, which `adoptReal()` seeds from the real
`config.toml`: the `personal` profile takes the top-level `model`, `approval_policy` and
`sandbox_mode`, and each `[profiles.<name>]` table becomes its own profile. An unset key is an
empty string, and the `if (p.model)` / `if (p.sandbox)` / `if (p.approval)` guards drop it — so on
a machine that configures none of them the argv is simply
`exec -C <cwd> --skip-git-repo-check <prompt>` and the CLI applies its own defaults. Studio never
invents a model or a sandbox policy it was not given.

A worked example, Personal profile, YOLO off:

```console
codex exec -C C:\Users\me/Documents/GitHub/codex --skip-git-repo-check -m gpt-5.1-codex-max \
  -s workspace-write -c approval_policy="on-request" "rename the flaky test"
```

### Why these are `-c` overrides and not config writes

The comment above `profileArgv` says it directly:

> *Flags every run shares: where it runs and which profile settings apply. Written as
> `-c key=value` overrides rather than mutating config.toml, so a run never changes the user's
> saved configuration as a side effect.*

That is the whole rule. Pressing **Send** must not leave anything behind in `$CODEX_HOME`. If a run
persisted its approval policy, then a single YOLO message would silently disarm every later run —
including runs started from a terminal, by another tool, or by the user tomorrow, who never agreed
to it. An override lives for exactly one process.

`-c` is the CLI's own mechanism for this: in the vendored reference source it is declared
`short = 'c', long = "config", global = true` and each value is parsed as TOML with a raw-string
fallback (`vendor/codex/codex-rs/utils/cli/src/config_override.rs`). That is why the approval value
goes through `JSON.stringify` — `approval_policy="on-request"` is valid TOML, where a bare token
would rely on the fallback.

Studio *does* have a path that writes `config.toml`, and it is a separate, deliberate action:
`writeProfileConfig()` → `codex_set_config`, with a timestamped backup taken first
(`electron/lib/config.js`). Editing configuration and running the agent are different verbs and
different buttons.

### `expandPath` — `~` is the shell talking

```js
expandPath(dir) {
  const home = (CX.sim.codexHome || "").replace(/[\\/]\.codex$/, "");
  return String(dir || "").replace(/^~/, home || "");
}
```

`~` is expanded by a POSIX shell, not by `codex`, and not by `cmd.exe`. Passing `-C ~/proj`
verbatim would point the agent at a directory literally named `~`. The user profile is recovered by
stripping the trailing `.codex` from the real `$CODEX_HOME` that `codex_state` reported. Only a
leading `~` is touched; the rest of the string is left alone, which is why the expanded path keeps
whatever separators it already had (`C:\Users\me/Documents/…`). Windows accepts both.

### Slash commands

The panel behind the `/` button lists `DATA.SLASH` — 52 entries taken from the CLI's TUI slash
commands. `slashPreviewText()` assembles `/name arg arg` from the wizard fields, **Insert into
composer** drops that text into the input, and **Run now** sends it through `sendChat`, which
strips the `/` and splits on whitespace.

> [!IMPORTANT]
> A TUI slash command is not the same thing as a CLI subcommand. Of the 52 names in `DATA.SLASH`,
> **eight** — `review`, `archive`, `delete`, `resume`, `fork`, `app`, `mcp`, `logout` — are also
> names in `DATA.SUBCOMMANDS`. The other 44 (`/model`, `/status`, `/compact`, `/plan`, `/diff`, …)
> are forwarded to a binary that has no such subcommand, and come back as a usage error and a
> non-zero exit. Nothing in `sendChat` checks first.

The reply for a slash message is rendered as a `tool` message: the bubble shows `codex <name>` in
mono and the streamed output goes into the attached `out` block beneath it, rather than into the
bubble text.

## What the Console executes

`flagList()` is `DATA.GLOBAL_FLAGS.concat(this.currentSub().args || [])` — the global flags plus
whatever the selected subcommand declares. `buildArgv` turns the filled fields into an array with
three rules:

```js
this.flagList().forEach((f) => {
  const val = v[f.flag];
  if (val == null || val === "" || val === false) return;
  if (f.type === "bool") argv.push(f.flag);
  else if (/^[A-Z]/.test(f.flag)) argv.push(String(val));   // positional
  else argv.push(f.flag, String(val));
});
```

- a boolean field contributes **its flag alone**;
- a field whose name starts with a capital letter is a **positional** (`PROMPT`, `SESSION_ID`) and
  contributes **its value alone**;
- everything else contributes **flag then value**, as two separate array elements.

Around that: the subcommand name unless it is `(interactive)`, the bypass flag when YOLO is on, and
`--profile <id>` when the active profile is not `personal`. Note that the Console path does **not**
call `profileArgv()` — it passes no `-C`, `-m`, `-s` or approval override. The profile reaches it
only as the child process's working directory (`startRun(argv, { cwd: this.expandPath(p.cwd) })`)
and, for a named profile, as `--profile`.

### The preview string is not what runs

`buildCommand()` produces the line under **Command preview**, and it deliberately differs from
`buildArgv()` in three ways:

1. it is prefixed with `codex`;
2. it quotes — `JSON.stringify` on positionals and on any value containing whitespace — so the line
   is readable and safe to paste into a terminal;
3. when the active tab has a running WSL instance with `auto` set, the whole line is wrapped in
   `wsl.exe -d <distro> --cd <cwd> -- …` (`wslCommand`).

None of that is executed. Splitting that display string on spaces to get an argv would tear
`"rename the flaky test"` into four arguments and would hand `wsl.exe`, `-d` and the distro name to
`codex` as flags. The comment on `buildArgv` states the rule:

> *The argv a run actually executes, as an array. Splitting the display string on spaces would tear
> a quoted prompt into pieces the moment it contains one.*

The first line the Console prints, `"$ codex " + argv.join(" ")`, is a **third** rendering — the
real argv, unquoted, shown so the user can see exactly what was composed. Where the preview and
that echo disagree about quoting, the array is the truth.

## The streaming path, end to end

```
sendChat / doRun                                              app/index.html
  └─ startRun(argv, { cwd, onLine })
       └─ CX.bridge.invoke("codex_run", { id, args, cwd, stream: "codex://stdout" })
            │                                                 electron/preload.js — name on the allow-list
            └─ ipcMain.handle("codex_run")                    electron/commands.js
                 └─ cli.stream(cli.codexBin(), args, { cwd, onSpawn }, onLine)  electron/lib/cli.js
                      ├─ spawn(program, args, { cwd, shell: WIN, windowsHide: true,
                      │                          stdio: ["ignore", "pipe", "pipe"] })
                      ├─ onSpawn(child) → Runs.set(id, { child, pid, startedAt })
                      ├─ pump(child.stdout, "out")    ─┐  both attached before
                      ├─ pump(child.stderr, "error")  ─┘  either can produce data
                      └─ "close" → resolve({ code, lines })
                 └─ per line: target.webContents.send("codex://stdout", { id, level, text })
       └─ the one listener from componentDidMount → this._runs[line.id].onLine(line)
            └─ buffer.push(line.text); if (!paint) paint = setTimeout(flush, 90)
```

**Spawn.** `stdio` is `["ignore", "pipe", "pipe"]`: stdin is closed, so a subcommand that would
prompt cannot hang forever waiting for a keystroke that can never arrive. `shell: true` on win32 is
there because `codex` on `PATH` is frequently a `.cmd` shim and Node refuses to spawn one directly
(`EINVAL`) — see [Known limitations](#known-limitations) for what that costs. Unlike `run()`,
**`stream()` sets no timeout**: an agent turn is allowed to take as long as it takes.

**Tracked from the first instant.** `stream()` calls `opts.onSpawn(child)` the moment the child
exists, before any output has arrived, and `codex_run` uses that to put the run in the `Runs` map
keyed by the renderer's run id. The timing matters: a run cancelled while it is still thinking has
printed nothing yet, and is the one most worth stopping. The entry is removed in a `finally`, so a
run that failed to start is not left behind as a run someone could try to cancel, and the removal
is guarded by an identity check (`Runs.get(id) === record`) so a slow exit cannot evict a newer run
that reused the id.

**Two reader threads.** `pump()` is attached to stdout and stderr *before* either can produce data,
each with its own line buffer, and each emitting `{ level, text }` — `"out"` for stdout, `"error"`
for stderr. A trailing fragment with no newline is emitted on `end`, so the last line is never
swallowed. The module comment says why they are read together:

> *Both pipes are read concurrently — draining one to completion before touching the other
> deadlocks the moment a chatty process fills the pipe nobody is reading.*

That is not a theoretical hazard. A pipe has a fixed OS buffer; when it fills, the child's next
write **blocks**. If the parent is sitting in a loop reading stdout to EOF, and the child is blocked
writing stderr, neither side can move again — the child never exits, so stdout never reaches EOF.
Codex writes progress and warnings to stderr while it writes results to stdout, so the run that
triggers it is an ordinary one, not a pathological one. This exact bug shipped once and is recorded
in the changelog.

**The channel.** `codex_run` is the only command that pushes. It sends on whatever `stream` name
the caller passed, guarded by `target && !target.isDestroyed()` so closing the window mid-run does
not throw on a dead `WebContents`. The preload will only *subscribe* to a channel starting with
`codex://` (``refusing to listen on `<channel>` ``), and the target window is the one registered by
`commands.setWindow` — the app window in `electron/main.js`, the off-screen window in
`tools/capture-main.cjs`.

**One listener, routed by run id.** The app subscribes exactly once, in `componentDidMount`, and
`componentWillUnmount` unsubscribes:

```js
this._runs = {};
this._unstream = CX.bridge.listen("codex://stdout", (event) => {
  const line = event && event.payload ? event.payload : event;
  if (!line) return;
  const run = this._runs[line.id];
  if (run) run.onLine(line);
});
```

A line whose id has no entry is dropped rather than painted into whatever happens to be on screen.
One subscription for the whole app means a new surface only has to hand `startRun` an `onLine`
callback; it never touches the bridge.

**The 90 ms coalescing repaint.** Both consumers do the same thing:

```js
onLine: (line) => {
  buffer.push(line.text);
  if (!paint) paint = setTimeout(flush, 90);
}
```

Every line is appended to a plain array immediately — nothing is dropped or sampled. What is
delayed is the **repaint**. `flush` calls `setState`, which re-renders the whole component through
`renderVals()`; a chatty run emits lines far faster than 60 Hz, and repainting per line makes the
window janky and can starve the event loop that is feeding it. A single pending timer per run
collapses a burst into one render at roughly 11 fps, which reads as live. The timer is cleared on
both settle paths, so the final state is always painted by the completion handler and never by a
stale timeout.

## When the process exits

`cli.stream` resolves `{ code, lines }` on `close` — the **complete** transcript, so a surface that
missed part of the stream can still render everything. `codex_run` returns
`{ code, id, lines, cancelled }`; neither consumer reads `cancelled` today.

**Chat.** The coalesced buffer is thrown away and replaced with `res.lines`, so the finished bubble
is authoritative rather than whatever the last repaint happened to contain. `thinking` goes false.
A non-zero exit raises an error notification — never a modal:

```js
if (res.code !== 0) {
  CX.notify.error(
    CX.i18n.t("chat.failed", { code: res.code }),
    (res.lines || []).filter((l) => l.level === "error").map((l) => l.text).join("\n")
      || ("codex exited " + res.code)
  );
}
```

The title is `chat.failed`, which carries `{code}` at every funny level in both languages; the body
is the run's own stderr, verbatim, falling back to `codex exited <n>` when the process failed
without saying anything. The output already on screen is left where it is — a failed run's partial
output is usually the most useful thing about it. Note that the bubble text is built from *every*
line regardless of level, so stderr warnings appear inline in the reply.

**Console.** A terminator line is appended: `{ level: "ok" | "error", text: "exit " + code }`,
green on zero and red otherwise, so the exit status is part of the log rather than a separate
badge.

**A run that never started** (a rejected `invoke`) is different from a run that failed. Chat calls
`notifyError("run", e)` → `CX.notifyBackendFailure` → the `err.run` string, whose `{detail}` is the
real message the main process threw. The Console replaces its output with that message *and*
notifies. Both are error-kind notifications, so they persist until dismissed and stay in the
notification centre.

## Stopping a run

The backend can genuinely stop one. Two commands sit beside `codex_run` in
`electron/commands.js`, both on the preload allow-list:

| Command | Argument | Returns |
| --- | --- | --- |
| `codex_cancel` | `{ id }` | `{ cancelled, id, pid?, reason? }` |
| `codex_running` | — | `{ ids, runs: [{ id, pid, startedAt }] }` |

`cancelRun` **reports rather than throws**, because a run that finished a moment before the user
reached Stop is not an error and should not put a red notification on a run that actually
succeeded. Each outcome names itself: `no run id was given`, ``run `<id>` is not running — it
already finished``, ``run `<id>` had already exited with code ``, `pid <n> was already gone`. A
successful cancel leaves the map entry in place for `codex_run`'s own `finally` to remove when the
child really closes, so pressing Stop twice reports *already gone* rather than *never heard of it*.
`codex_run`'s return value carries the flag: `{ code, id, lines, cancelled }`.

The kill itself is `cli.killTree(pid)`:

```js
execFileSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true, timeout: 10_000 });
```

`child.kill()` would not do. Everything goes through `shell: true` on Windows, so the pid Node
reports is the `cmd.exe` wrapper — signalling it leaves `codex`, and whatever `codex` spawned in
turn, running to completion with nobody left reading the output. `/T` walks the descendant tree and
`/F` skips asking politely, which is what a Stop button means. If `taskkill` is absent or the pid is
already gone it falls through to `process.kill(pid, "SIGKILL")` and returns whether anything was
actually killed — never a claimed kill that did not happen. It is synchronous on purpose:
`app.on("before-quit")` does not await, so `killAllRuns()` would lose the race and a run would
outlive the app that started it.

> [!WARNING]
> **No surface in the app calls either command yet.** At the commit this page documents,
> `grep -n "codex_cancel\|codex_running" app/index.html` returns nothing, and `stopChat` is still
> `this.setState({ thinking: false })` — see [Known limitations](#stop-is-not-reachable-from-the-ui-yet).

## Configuration

| Knob | Where | Value |
| --- | --- | --- |
| Working directory | active profile `cwd`, via `expandPath` | passed twice: `-C` (chat only) and the child's `cwd` (both) |
| Model | active profile `model` | `-m`, omitted when empty |
| Sandbox | active profile `sandbox` | `-s`, omitted when empty or under YOLO |
| Approval policy | active profile `approval` | `-c approval_policy="…"`, omitted when empty or under YOLO |
| YOLO | `CX.store` key `codexstudio.yolo`, the **⚡ YOLO** toggle in the title bar | `--dangerously-bypass-approvals-and-sandbox`, replacing `-s`/`-c` |
| Repaint window | `setTimeout(flush, 90)` in `sendChat` and `doRun` | 90 ms |
| Run timeout | `stream()` in `electron/lib/cli.js` | none — a run is not time-limited |
| Output cap | `stream()` | none; `lines` grows for the life of the run |
| Streaming channel | `startRun` | `"codex://stdout"` |
| Send key | `onChatKey` | Enter sends, Shift+Enter newlines |

## Known limitations

Stated plainly, because each one is reachable from the shipped UI.

### Every message is its own `codex exec` — there is no resumed thread

`sendChat` composes a fresh `exec` invocation per send. It passes no session id, no `resume`, no
`--last`, and no transcript of the preceding turns; the CLI starts a brand-new session each time.
`seedMessages()` returns `[]` and says so — *"A new thread starts empty. Nothing here is a canned
transcript."* — and selecting a saved session in the list panel sets `messages: []` rather than
loading that rollout.

So the bubbles above the composer are a Studio-side log of independent one-shot runs, not a
conversation the agent can see. Follow-up messages such as *"now do the same for the other file"*
reach a process with no memory of the first one. `resume` and `fork` exist in `DATA.SUBCOMMANDS`
and can be run from the Console; wiring them into the composer is not implemented.

### Stop is not reachable from the UI yet

The backend half landed and is tested (see [Stopping a run](#stopping-a-run)). The frontend half
has not. At the commit this page documents:

- `stopChat` exists in `renderVals` and its entire body is `this.setState({ thinking: false })` —
  it unblocks the composer and nothing else. Its own comment is honest about that: *"Stopping is
  honest about what it can do: the composer unblocks immediately, and the line says the process is
  still finishing rather than pretending it was killed."*
- **`stopChat` is not bound anywhere in the template.** `grep -n "stopChat" app/index.html` returns
  the definition and nothing else, so there is no Stop control in the chat surface at all. The
  Console has **Copy** and **Run** only.
- Neither `codex_cancel` nor `codex_running` is invoked anywhere in `app/`, and `startRun` does not
  keep the run id anywhere a Stop control could read it — `this._runs[id]` holds only the `onLine`
  callback and is deleted the moment the run settles.

So from a user's seat the old behaviour still stands: **once a run starts, the only way to stop it
is to quit the app** — which now does kill it (`killAllRuns()` on `before-quit`) along with every
pinned WSL shell (`wsl.shutdown()`). The remaining work is a Stop control bound to `stopChat`, a
retained run id, and an honest report of the partial output and the `cancelled` flag; the shape is
in `../../ROADMAP.md` (§5), and `../../HANDOFF.md` (§5)
still describes the pre-`codex_cancel` state.

### A multi-word prompt is split before `codex` sees it

`electron/lib/cli.js` passes `shell: WIN` to both `run()` and `stream()`, because `codex` on `PATH`
is often a `.cmd` shim that Node will not spawn directly. With `shell: true` Node **concatenates
the argv into one command line with no quoting** — it emits `DEP0190` for exactly this — and
`cmd.exe` then re-splits it on whitespace. Verified on this machine against the installed
`codex.exe`, through the same call shape `codex_run` uses:

```console
$ node -e "require('node:child_process').execFile('codex',['exec','--skip-git-repo-check','fix the failing test','--help'],{shell:true},(e,o,s)=>console.log(s))"
error: unrecognized subcommand 'the'

  tip: a similar subcommand exists: 'help'

Usage: codex exec [OPTIONS] [PROMPT]
$ node -e "…same argv, {shell:false}…"        # control
Run Codex non-interactively                    # exit 0 — the prompt is one positional
```

`codex exec` declares `prompt` as a single `Option<String>` positional, so the second word arrives
as an unexpected subcommand and the run exits 2 before doing anything. A one-word prompt works; a
sentence does not. The same mechanism splits any working directory containing a space, and strips
the quotes from `-c approval_policy="on-request"` (harmless here — the CLI falls back to treating
an unquotable value as a raw string).

This is the run-path consequence of the security property documented in
[../architecture/ipc-bridge.md](app-doc://article/codex-material.repository.fbf656065cd7f1d8#security-considerations): under
`shell: true`, every composed argument reaches a shell. Fixing it belongs in `electron/lib/cli.js`
— quote per-argument, or take the shell branch only when the resolved binary is a `.cmd`/`.bat`.

### The `-c key=value` row in the Console composes one argument, not two

`DATA.GLOBAL_FLAGS` contains an entry whose `flag` is the literal string `"-c key=value"`. Because
that is neither a `bool` nor capitalised, `buildArgv` pushes it as a **single** array element
followed by the typed value, so the run receives `-c key=value <what the user typed>`: the CLI
accepts an override of a key actually called `key`, and the user's text lands as a separate
argument. The intended override never happens, and nothing reports that it did not.

### Switching session or profile mid-run redirects the reply

`replyIndex` is a positional index captured when the message was sent. Opening another session, or
switching profile, sets `messages: []` while the run is still streaming, and `flush` then writes the
reply at that index of the now-empty transcript — leaving empty slots before it rather than landing
in the thread it belongs to. `thinking` stays true until the run settles, so a second send is
refused with `chat.busy` in the meantime.

### Neither surface asks for structured output

No `--json` is composed, so what is streamed is the CLI's human-readable output. Studio does not
parse it into tool calls, diffs or reasoning blocks; the `reasoning` and `tool` message roles exist
in the renderer but only the slash path produces a `tool` message today.

### `profileArgv()` is appended to slash commands unchecked

The suffix is the set of flags `codex exec` accepts. It is appended after *any* slash-derived
subcommand without checking that the subcommand defines them — `--skip-git-repo-check`, for
instance, is declared on the `exec` command tree in the reference source
(`vendor/codex/codex-rs/exec/src/cli.rs`), not on the root binary.

## Failure modes

| Symptom | What the user sees | Cause |
| --- | --- | --- |
| Prompt with a space fails instantly | Error notification `codex exited 2`, body `error: unrecognized subcommand '<second word>'` | `shell: true` argv concatenation — see above |
| Empty composition in the Console | `no arguments were composed for this run` | `codex_run` refuses an empty `args` rather than spawning a bare `codex`. Reachable with `(interactive)` selected, no flags set, on the `personal` profile |
| `codex` not installed and not bundled | ``could not start `codex`: …`` | `resolveCodex()` fell through to the bare name; the notification carries the spawn error verbatim |
| Slash command that is not a subcommand | Non-zero exit and the CLI's usage text in the `out` block | 44 of the 52 `DATA.SLASH` names have no CLI subcommand |
| Second send while a run is live | Info toast, `chat.busy` | `state.thinking` guard; the run is unaffected |
| `-C ~/…` reaches the CLI unexpanded | The agent runs in the wrong directory, or the run fails | A send issued before `CX.live.hydrate()` returned: `CX.sim.codexHome` is still the simulated `~/.codex`, so `expandPath` substitutes `~` for `~` |
| `CODEX_HOME` set to a directory not ending in `.codex` | `~` expands to that directory instead of the user profile | `expandPath` strips a trailing `.codex` and nothing else |
| Window closed mid-run | The run is killed with the app | `codex_run` checks `isDestroyed()` before each streamed send, and `killAllRuns()` on `before-quit` kills every tracked tree |
| Cancel arrives after the run finished | `cancelled: false` plus a `reason` naming the run as already finished | `cancelRun` reports instead of throwing — reachable from the backend only, today |
| Very long run | Memory grows | `lines` is uncapped in the main process and mirrored in the renderer |
| Run started, then the app reloaded | Output vanishes | `_runs` lives on the mounted component; a line whose id is unknown is dropped |
| Non-zero exit | Persistent error notification, output left on screen | `chat.failed` / the `exit <n>` terminator line |

## Security considerations

- **Everything composed here reaches a shell on Windows.** `shell: WIN` plus Node's
  no-escaping concatenation means a metacharacter in a prompt, a path or a flag value is
  interpreted by `cmd.exe`. Treat every element of `args` as shell input. This is the sharpest edge
  in the run path and it is documented in full in
  [../architecture/ipc-bridge.md](app-doc://article/codex-material.repository.fbf656065cd7f1d8#security-considerations).
- **A run never mutates saved configuration.** Model, sandbox and approval travel as flags and
  `-c` overrides that live for one process. Nothing in `sendChat`, `doRun`, `startRun` or
  `codex_run` writes to `config.toml`.
- **The bypass flag stays visible.** `--dangerously-bypass-approvals-and-sandbox` appears in the
  composed argv, in the Console preview and in the `$ codex …` echo, at every funny level and in
  every language mode. A run with approvals and sandboxing off must never be indistinguishable from
  one without.
- **The backend does not audit the argv.** `codex_run` checks only that it is a non-empty array.
  The frontend is the thing that decides what runs, so a future surface that composed argv from
  file or remote content would be composing shell input — keep the caller in charge.
- **stdin is closed** (`stdio: ["ignore", …]`). A run cannot be fed anything after it starts, and a
  subcommand that expects a keystroke fails instead of hanging invisibly.
- **Cancelling kills a tree, and only a tree Studio started.** `killTree` is called with a pid taken
  from the `Runs` map, which contains nothing but children this process spawned. `taskkill /T /F`
  is forceful by design, so the pid it is handed must never come from anywhere else — an id from
  the renderer selects a map entry, it is not itself a pid.
- **The prompt is never persisted by Studio.** It goes into the argv and into `state.messages` in
  memory. The CLI's own rollout files under `$CODEX_HOME/sessions` are written by the CLI, not by
  Studio.
- **Output is rendered as text, never as markup.** Bubbles and log lines are interpolated by the
  `dc` runtime into text nodes; nothing in a run's output becomes HTML.
- **The renderer can only reach this one command.** `codex_run` is on the preload allow-list; the
  listener is refused any channel outside the `codex://` prefix.

## Verification

Automated coverage today is the run **lifecycle**, not the argv **composition**:

```
node tools/test-backend.mjs    28 tests, 28 passed
node tools/test-frontend.mjs   23 tests, 23 passed
```

Six backend tests are about this page:

- *cli.stream hands the caller the child the moment it starts*
- *cli.killTree reports false for a pid nothing is using*
- *cli.killTree kills the process and everything under it*
- *codex_cancel answers for a run that is not running instead of throwing*
- *codex_running lists the live runs and codex_cancel kills one*
- *quitting kills every tracked run*

plus *every command the preload exposes is registered by the main process*, which is what keeps
`codex_run`, `codex_cancel` and `codex_running` on both sides of the bridge.

Both suites are dependency-free and need neither Electron nor a `codex` binary. **Neither
exercises argv composition** — there is no unit test for `sendChat`, `profileArgv` or `buildArgv`,
which is exactly why the prompt-splitting defect above could go unnoticed. That gap is real and
worth closing.

By hand, with `npm start`:

1. **The argv is an array, not a string.** Select `exec` in the Console, set `PROMPT` to something
   with spaces, and compare the preview line (quoted) with the `$ codex …` echo (unquoted). Both
   describe the same array.
2. **Streaming is live.** Run something chatty (`codex doctor` through the Console). Lines must
   appear while it is running, in bursts of about 90 ms, not all at once at the end.
3. **stderr is not lost.** A run that writes to stderr must show those lines, coloured as errors in
   the Console and included in the chat bubble.
4. **A non-zero exit is reported.** Run a subcommand with a bad flag. The Console must end with a
   red `exit <n>`; the chat must raise a persistent error notification whose body is the CLI's own
   stderr.
5. **No configuration is written.** Note the mtime of `$CODEX_HOME/config.toml`, send a message,
   check it again. It must not change, and no `config.toml.studio-*.bak` may appear.
6. **The run id routes.** Start a Console run, switch to Chat and back. The output must still be
   arriving in the Console.
7. **The prompt-splitting defect.** Send a single word, then a sentence. Until
   `electron/lib/cli.js` is fixed, the first succeeds and the second returns
   `error: unrecognized subcommand '<second word>'`.
8. **Nothing outlives the app.** Start a long run, quit Studio, then check Task Manager (or
   `tasklist /fi "imagename eq codex.exe"`). No `codex.exe` Studio started may remain.
9. **Language modes.** Set each of en / yue / bi and both funny sliders to 1 and to 5, and confirm
   `chat.busy`, `chat.failed` and `err.run` still name the exit code and the real detail at every
   level.
