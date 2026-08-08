# WSL runtimes

> One long-lived Linux shell per tab, so `cd`, environment variables and background jobs persist
> between commands instead of every run starting from scratch.

**Implementation:** `electron/lib/wsl.js`, exposed as the IPC commands `codex_wsl_list`,
`codex_wsl_spawn`, `codex_wsl_stop`, `codex_wsl_kill`, `codex_wsl_set` and `codex_wsl_exec` in
`electron/commands.js`; the Runtime panel and the per-tab chip in `app/index.html`
(`runtimeRows`, `wslSpawn`, `wslFor`, `wslCommand`, `stopAllWsl`).

## Why per-tab

A tab is a working context: a directory, a profile, a train of thought. If every command started a
fresh `wsl.exe`, then `cd`, exported variables, an activated virtualenv and a background server
would all evaporate between runs, and the user would be typing `cd /mnt/c/…` before every command.

So Studio keeps **one instance per session id**, in a `Map` keyed by that id:

```js
/** sessionId -> instance */
const instances = new Map();
```

Instances are entirely independent. Stopping one tab's shell has no effect on another's, and each
carries its own distro and working directory.

## Listing distros, and the UTF-16LE trap

```js
function decodeWsl(buf) {
  if (buf.length >= 2) {
    let nulls = 0;
    for (let i = 1; i < buf.length; i += 2) if (buf[i] === 0) nulls++;
    if (nulls > buf.length / 4) return buf.toString("utf16le");
  }
  return buf.toString("utf8");
}
```

**`wsl -l -q` emits UTF-16LE**, not UTF-8. Decoding it as UTF-8 turns `Ubuntu-24.04` into
`U\0b\0u\0n\0t\0u\0…` — a string that renders as NUL-separated garbage and, worse, fails every
name comparison downstream, so `-d <distro>` is passed a name WSL does not recognise and every
spawn fails for a reason nobody can see.

The detection is a heuristic and deliberately so: count NUL bytes at odd offsets, and if more than
a quarter of the buffer's length is NULs in that position, decode as UTF-16LE. That handles both
the current output encoding and a future build that emits UTF-8, without hard-coding either.

`distros()` runs `execFile("wsl.exe", ["-l", "-q"], { encoding: "buffer", timeout: 15_000 })`,
strips a UTF-8 BOM if present, trims each line and drops the empties. **It never rejects**: an
error with no output resolves to `[]`, so a machine without WSL shows an empty distro list rather
than a broken panel.

## The instance

`spawn({ session, distro, cwd, auto })`:

1. Read the live distro list. No distro installed → *"no WSL distribution is installed"*.
2. Default to the first installed distro when none was named; reject a name that is not installed
   with `` `<distro>` is not an installed WSL distribution ``. The check is against what WSL
   actually reports, not against what was saved earlier.
3. `stopInstance(session)` first, so re-spawning a tab never leaks the previous shell.
4. Spawn the keeper process:

```js
spawn("wsl.exe", ["-d", distro, "--cd", cwd, "--", "bash", "-lc", "sleep infinity"],
      { windowsHide: true, stdio: "ignore", detached: false });
```

`sleep infinity` under a **login** shell (`bash -lc`) is what keeps the distro's namespace and its
mounted Windows drives alive for the tab, without holding a pty open or consuming CPU. `--cd` sets
the starting directory. `stdio: "ignore"` because nothing reads from it — it exists to be alive.

The tracked record is:

```jsonc
{ "session": "…", "distro": "Ubuntu-24.04", "cwd": "/mnt/c/Users/me/project",
  "pid": 24188, "startedAt": 1785000000, "auto": true, "status": "running" }
```

`startedAt` is epoch **seconds**. `status` is derived, not stored: `"running"` unless the child has
exited, in which case `"stopped"`. Both the `exit` and `error` events set `exited = true`, so a
shell that dies on its own is reported as stopped rather than as running-with-a-dead-pid.

## What persists — and what does not

**Inside the instance:** everything a login shell holds. `cd`, exported variables, a virtualenv, a
`tmux`/`screen` session, a background process — all of it survives between commands, because the
process is still there.

**In `wsl.js`:** nothing. `instances` is an in-memory `Map` with no serialisation. Quitting Studio
loses every instance, and the next launch starts with none. That is intentional — a `pid` from a
previous boot is worse than no record — but it does mean *"which distro this tab uses"* is not
remembered either.

**In the frontend:** the Studio `settings` object and the tab model are persisted (see
[tabs.md](app-doc://article/codex-material.repository.57f8386a7beff582)), but neither carries a WSL binding. `CX.sim.wsl` is refreshed from
`codex_wsl_list` and is a live view, not storage.

`set(session, patch)` updates `cwd`, `distro` or `auto` on a tracked instance. It is a **record
update, not a re-exec**: changing `cwd` on a running instance changes what future `exec` calls pass
as `--cd`; it does not `cd` the keeper process, which is still parked wherever it started. Changing
`distro` on a running instance likewise retargets future commands without restarting the shell —
restart the instance if you want the keeper to move too.

## Executing

`exec({ session, command, distro, cwd })` runs **one command** and returns everything it printed:

```js
execFile("wsl.exe", ["-d", distro, "--cd", cwd, "--", "bash", "-lc", command],
         { windowsHide: true, maxBuffer: 16 * 1024 * 1024, timeout: 120_000 })
```

### The one-shot fallback

If the session has no tracked instance, `exec` does not fail and does not silently do nothing.
It falls back:

```js
const inst = instances.get(args.session);
let distro = inst ? inst.distro : args.distro;
const cwd = inst ? inst.cwd : args.cwd || "~";
if (!distro) {
  const available = await distros();
  if (!available.length) throw new Error("no WSL distribution is installed");
  distro = available[0];
}
```

So the order is: **the pinned instance's distro and cwd → whatever the caller passed → the first
installed distro at `~`**. The command runs as a one-shot invocation. It gets no persistence — no
`cd` carried over, no environment from a previous call — but it runs, and the returned `lines`
begin with a `cmd`-level line showing the exact `wsl -d … --cd … -- <command>` that was executed,
so the user can see which route was taken.

The default command when none is given is `codex --version`.

The result is always resolved, never rejected:

```jsonc
{ "code": 0, "session": "…", "distro": "Ubuntu-24.04", "cwd": "~",
  "lines": [ { "level": "cmd", "text": "wsl -d Ubuntu-24.04 --cd ~ -- uname -sr" },
             { "level": "out", "text": "Linux 6.6.87.2-microsoft-standard-WSL2" } ] }
```

stdout lines come back as `level: "out"`, stderr as `level: "error"`, and a non-zero exit is
reported in `code` rather than thrown — the caller renders it.

### What does *not* run inside WSL

Worth being explicit, because the UI can imply otherwise. When a tab has a running instance with
`auto` on, the Console's **command preview** wraps the composed line in
`wsl.exe -d <distro> --cd <cwd> -- …` (`wslCommand` / `buildCommand`). That is the displayed string
only. **Pressing Run still executes the Windows `codex` binary** through `codex_run` — see
[chats-and-runs.md](app-doc://article/codex-material.repository.64fc1a5bff729ef7) — because `startRun` invokes `cli.stream(cli.codexBin(), …)`
and never consults the WSL map. The only code path that genuinely executes inside a distro is
`codex_wsl_exec`, which the Runtime panel uses for its per-row probe
(`uname -sr && codex --version`).

Routing an actual run through WSL is outstanding work, not shipped behaviour.

## Shutdown

Three levels, and they mean different things:

| Call | Effect |
| --- | --- |
| `stop(session)` | Kills the child, marks the record `stopped`, **keeps the record** so the tab still shows which distro it had |
| `kill(session)` | Kills the child and **deletes the record**, then returns the fresh list |
| `shutdown()` | Kills every tracked child and clears the map |

`shutdown()` is wired to two lifecycle events in `electron/main.js`:

```js
app.on("window-all-closed", () => { wsl.shutdown(); app.quit(); });
app.on("before-quit", () => wsl.shutdown());
```

Every pinned shell is a real `sleep infinity` process. Quitting without killing them would leave
one per tab running until the machine reboots, which is exactly the kind of thing a GUI is blamed
for. Both hooks are registered because a quit can arrive by either route.

`stopInstance` swallows a kill failure (`try { inst.child.kill(); } catch {}`) — a process that is
already gone is a success, not an error — and always marks the record exited.

`stop()` on a session that was never spawned returns `{ session, status: "absent" }` rather than
throwing, which the backend test asserts.

## Configuration

| Knob | Where | Default |
| --- | --- | --- |
| Distro | `spawn({ distro })` | The first installed distro |
| Working directory | `spawn({ cwd })` | `~` |
| `auto` (wrap the console preview) | `spawn({ auto })` | `true` unless explicitly `false` |
| Distro-list timeout | `distros()` | 15 s |
| Exec timeout | `exec()` | 120 s |
| Exec output cap | `exec()` | 16 MB |
| Keeper command | `spawn()` | `bash -lc "sleep infinity"` |

## Failure modes

| Symptom | What the user sees | Cause |
| --- | --- | --- |
| No WSL installed | An empty distro list; spawn rejects with *"no WSL distribution is installed"* | `distros()` returned `[]` |
| Distro name not installed | `` `<name>` is not an installed WSL distribution `` | Checked against the live list, not a saved value |
| Distro names look like garbage | — | Would mean `decodeWsl` regressed; see above |
| Shell dies on its own | The row reports `stopped` | `exit`/`error` set `exited` |
| Command exceeds 120 s | `code` is non-zero and the error line carries the timeout message | `execFile` timeout |
| Output exceeds 16 MB | Same route — `maxBuffer` exceeded is reported, not thrown | `execFile` `maxBuffer` |
| `stop` on an unknown session | `{ status: "absent" }` | Guarded; asserted by the backend tests |
| Instances gone after a restart | The Runtime panel shows none | In-memory only, by design |
| `sleep infinity` still running after a crash | — | `shutdown()` covers a clean quit; a hard kill of the Electron process cannot run it. `wsl --shutdown` clears them. |
| A tab's spawn targets an odd path | `/mnt/cD:/src/…` | **Fixed.** `wslSpawn` used to prefix `/mnt/c` unconditionally and rewrite a leading `~` to a fixed account name — so a project on any other drive produced a nonsense path, and the account name reached a published screenshot. `toWslPath()` reads the drive letter from the path and resolves `~` from the real `CODEX_HOME`. |

## Security considerations

- **The command string is executed by a login shell.** `bash -lc "<command>"` interprets shell
  metacharacters, so a command assembled from untrusted input is a shell injection. Everything
  `exec` currently receives is either a fixed probe or something the user typed into their own
  Runtime panel.
- **Everything else stays an argv array.** `-d`, `--cd` and `--` are passed as separate arguments to
  `execFile`, never interpolated into a string, so a distro name or a path cannot break out of its
  position.
- **`--cd` reaches into the Windows filesystem** through `/mnt/c`, at the user's own privilege
  level. WSL is not a sandbox and Studio does not present it as one; the Codex sandbox settings
  still belong to the CLI.
- **No elevation.** Installing WSL itself needs an elevated terminal (`wsl --install`) and Studio
  says so in `err.wslMissing` rather than attempting it.
- **`windowsHide: true` on every spawn**, so nothing flashes a console window.
- **Output is returned verbatim** and rendered as text, never as markup.
- **Killing is scoped to what Studio started.** Only children tracked in the map are killed;
  `wsl --shutdown` or another tool's distro is never touched.

## Verification

`node tools/test-backend.mjs` covers two, both written to pass on a machine with no WSL at all:

- *wsl.list always answers, even with no WSL installed*
- *wsl.stop on an unknown session reports absent rather than throwing*

By hand, on a machine with WSL:

1. **Decoding:** open the Runtime panel and confirm distro names read as text
   (`Ubuntu-24.04`), not as spaced-out characters.
2. **Independence:** spawn instances for two tabs, stop one. The other must stay running with its
   own pid.
3. **Persistence inside the shell:** set a working directory on a row, run a command through the
   row's probe, and confirm it executes in that directory.
4. **Fallback:** run a command for a session with no instance. It must still execute, and the first
   returned line must show which distro and directory were used.
5. **Bad distro:** ask for a distro that is not installed. The message must name it.
6. **Stop vs kill:** stop an instance — the row must remain and report `stopped`. Remove it — the
   row must go.
7. **Shutdown:** spawn several, quit Studio, then run `wsl.exe -d  -- pgrep -fa "sleep
   infinity"`. Nothing Studio started may remain.
8. **No console flash:** none of the above may pop a console window.
