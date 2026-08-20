# External editor integration

> Detect what is actually installed, let the user choose one, open the working directory or a
> single file in it — and fall back to File Explorer, which is always there.

**Implementation:** `electron/lib/editors.js`, exposed as the IPC commands `codex_editors`,
`codex_open_external` and `codex_reveal` in `electron/commands.js`; the picker and the two actions
in Studio → External editor (`studioRows()` in `app/index.html`).

## Detection

Detection is **by executable, not by guessing**. An editor that is not on this machine is never
offered, so the picker can never lead to a "that isn't installed" failure the app could have
predicted.

`detect()` walks `CANDIDATES` in order and returns `{ editors: [ { id, label, exe } ] }` for
exactly those it resolved. That order is also the fallback order — with no editor chosen, the
first one that resolves is used.

| # | `id` | Label | Executables tried | Hint paths |
| --- | --- | --- | --- | --- |
| 1 | `vscode` | Visual Studio Code | `code.cmd`, `code` | `%LOCALAPPDATA%\Programs\Microsoft VS Code\bin\code.cmd`, `%PROGRAMFILES%\Microsoft VS Code\bin\code.cmd` |
| 2 | `vscode-insiders` | VS Code Insiders | `code-insiders.cmd`, `code-insiders` | `%LOCALAPPDATA%\Programs\Microsoft VS Code Insiders\bin\code-insiders.cmd` |
| 3 | `cursor` | Cursor | `cursor.cmd`, `cursor` | `%LOCALAPPDATA%\Programs\cursor\resources\app\bin\cursor.cmd` |
| 4 | `windsurf` | Windsurf | `windsurf.cmd`, `windsurf` | `%LOCALAPPDATA%\Programs\Windsurf\bin\windsurf.cmd` |
| 5 | `zed` | Zed | `zed.exe` | `%LOCALAPPDATA%\Zed\Zed.exe` |
| 6 | `sublime` | Sublime Text | `subl.exe` | `%PROGRAMFILES%\Sublime Text\subl.exe` |
| 7 | `notepadpp` | Notepad++ | `notepad++.exe` | `%PROGRAMFILES%\Notepad++\notepad++.exe` |
| 8 | `idea` | IntelliJ IDEA | `idea64.exe` | — |
| 9 | `notepad` | Notepad | `notepad.exe` | — |

There is no per-candidate argument template. The resolved executable is spawned with the target
path as its single argument, which is what every editor in the table accepts for both a file and a
folder.

### How a candidate resolves

`resolve(cand)` tries two things, in this order:

1. **PATH, via `where`.** Each name in `exes` is passed to `execFileSync("where", [exe])` and the
   first non-empty output line wins. `where` exits non-zero when nothing matches, which throws —
   caught, and the next name is tried. This is why every VS Code-family entry lists both `foo.cmd`
   and bare `foo`: `where` matches a literal filename, and the shim's real name on Windows is
   `code.cmd`.
2. **The hint paths.** Each hint goes through `expand()`, which replaces any `%NAME%` with
   `process.env.NAME` and leaves the token intact when the variable is unset, then is accepted only
   if `fs.statSync(p).isFile()` succeeds. That is how an installed VS Code whose `bin` was never
   added to PATH is still found.

The function returns `null` when neither route produces anything, and the candidate is simply
omitted from the list.

`notepad` is last on purpose. It always resolves on Windows, so a machine with no developer editor
still shows one working option instead of an empty picker.

Detection is not cached across launches and runs once, when the app mounts:

```js
CX.bridge.invoke("codex_editors").then((r) => this.setState({ editors: (r && r.editors) || [] }))
```

An editor installed while Studio is running is therefore not offered until the next launch.

## Opening

`open(target, editorId, customExe)` — reached as
`codex_open_external` with `{ path, editor, exe }`:

1. **The path must exist.** `if (!target || !fs.existsSync(target)) throw new Error(...)` — a clear
   *"&lt;path&gt; does not exist"* rather than launching an editor onto nothing. Both a file and a
   directory are valid targets, which is what lets one command serve "open this file" and "open
   this project folder".
2. `path.resolve(target)` — the editor is always handed an absolute path.
3. **`customExe` wins.** A caller may pass an arbitrary executable path, which is spawned directly
   with the resolved target as its single argument. Studio persists it as `settings.editorExe`.
   This is the escape hatch for an editor the table does not know.
4. Otherwise the chosen candidate is `CANDIDATES.find(c => c.id === editorId)` when an id was
   given, or **the first candidate that resolves** when none was. An unknown id rejects with
   `` unknown editor `<id>` ``.
5. `resolve(chosen)` runs **again** at open time, so an editor uninstalled since detection produces
   *"&lt;Label&gt; is configured but was not found on this machine"* instead of a raw spawn error.

On success: `{ opened, editor, label, exe, pid }`.

### The `.cmd` shim handling

This is the fiddly part, and the reason is in the source comment:

```js
const useShell = exe.toLowerCase().endsWith(".cmd") || exe.toLowerCase().endsWith(".bat");
const child = spawn(useShell ? `"${exe}"` : exe, [useShell ? `"${resolved}"` : resolved], {
  detached: true, stdio: "ignore", shell: useShell, windowsHide: false });
child.unref();
```

- **A `.cmd`/`.bat` shim is not an executable image.** `CreateProcess` cannot run it, so `spawn`
  fails unless a shell interprets it. VS Code, Insiders, Cursor and Windsurf all install as `.cmd`
  shims, so this is the common path rather than the exception.
- **`shell: true` means the argv is re-parsed as a command line**, so a path containing a space
  would split in two. Both the executable and the target are therefore quoted — and only in that
  branch.
- **A bare `.exe` takes the other branch**, spawned directly with no shell and no quoting, because
  quoting an argument that never reaches a shell would pass the literal quote characters to the
  program.
- **`detached: true` plus `unref()`** so the editor outlives Studio. Quitting Studio must not close
  the user's editor.
- **`windowsHide: false`** so the editor's own window actually appears.

## The Explorer fallback

```js
function reveal(target) {
  if (!target || !fs.existsSync(target)) throw new Error(`${target} does not exist`);
  const child = spawn("explorer.exe", [path.resolve(target)], { detached: true, stdio: "ignore" });
  child.unref();
  return { revealed: resolved };
}
```

`explorer.exe` is a real executable, not a shim, so no shell and no quoting. It ships with Windows,
which is the whole point: **Reveal in File Explorer is always available**, including on a machine
with no editor at all, and it cannot execute the target. The Studio row says so —
*"Always available, even with no editor installed."*

## The Studio surface

Studio → External editor has three rows:

| Row | Behaviour |
| --- | --- |
| **Editor** | A dropdown built from `state.editors`. Its subtitle reads *"N detected on this machine"*, or *"No supported editor was found — install one, or use Reveal in Explorer."* Picking one persists `settings.editor` and commits a revision to History. |
| **Open the working directory** | `codex_open_external` with the active profile's `cwd` and the stored editor id. On success, a toast: *"Opened &lt;path&gt;"*. |
| **Reveal in File Explorer** | `codex_reveal` with the same path. |

The picker's displayed label falls back to `"<first detected> (first found)"` when nothing has been
chosen, so the label matches what pressing **Open** would actually do.

`settings.editorExe` exists, is persisted and is honoured by the backend, but **no UI writes it
yet** — there is no "choose an executable…" file picker. Setting a custom editor today means
editing the stored settings by hand. Treat that picker as outstanding work.

## Configuration

| Knob | Where | Default |
| --- | --- | --- |
| Chosen editor id | `settings.editor` → `localStorage["codexstudio.settings"]` | `""` (first detected) |
| Custom executable | `settings.editorExe` | `""` (no UI writes it) |
| Candidate table | `CANDIDATES` in `electron/lib/editors.js` | the nine above |
| What gets opened | The active profile's `cwd` | — |

`settings` is part of the version-control snapshot, so changing the editor is undoable from
History. Adding a candidate is four lines — id, label, executable names, hint paths — and is
preferable to telling users to fill in a custom path.

## Failure modes

| Symptom | Message / behaviour | Cause |
| --- | --- | --- |
| Nothing installed | *"no supported editor was found on this machine"* | `detect()` found nothing and no id was given. Reveal still works. |
| Chosen editor uninstalled since detection | *"&lt;Label&gt; is configured but was not found on this machine"* | Re-resolution at open time |
| Unknown id in settings | `` unknown editor `<id>` `` | The persisted id is not in `CANDIDATES` |
| Target missing | *"&lt;path&gt; does not exist"* | Existence check before spawn |
| Custom `exe` cannot start | The Node spawn error, verbatim | `customExe` is not a runnable image |
| Editor flashes and vanishes | — | A `.cmd` shim run without a shell; `useShell` is what prevents it |
| Editor dies when Studio quits | — | Would mean `detached`/`unref` regressed |
| A newly installed editor is not offered | — | Detection runs once at mount; restart Studio |
| Detection is slow on first launch | — | `where` is spawned per candidate name; results are not cached |

Every one of these reaches the renderer as a rejected promise carrying the real message, which
`notifyError("editor", e)` surfaces through the `err.editor` string — funny-styled title, verbatim
`{detail}`. See [notifications.md](app-doc://article/codex-material.repository.7cc84c1f327737cf).

## Security considerations

- **Only known executables are launched by name.** The candidate list is fixed in source. The app
  never scans for "something that looks like an editor" and never executes a path it found in a
  config file, in CLI output, or in anything downloaded.
- **`customExe` launches an arbitrary executable with an arbitrary argument.** It exists so a user
  can point at an editor the table does not know, and must only ever be filled from a value the
  user chose. Populating it from untrusted data would turn it into arbitrary code execution.
- **Quoting is tied to the shell branch.** Quoting happens only where `shell: true` is set, which
  is what keeps a path containing spaces or shell metacharacters from being split or interpreted.
- **The path is not sandboxed.** Both commands act on any existing path; the caller is in charge of
  which one is passed.
- **Nothing is elevated.** No `runas`, no UAC prompt, no per-machine write. Detection reads
  directories and asks `where`; opening spawns a user-level process with `windowsHide: true` for
  the detection call and a visible window for the editor itself.
- **The child inherits Studio's environment** and is detached. Do not put secrets in the process
  environment expecting them to stay inside Studio.
- **Nothing leaves the machine.** No network call exists in this module, and the renderer's CSP
  (`connect-src 'self'`) forbids one regardless.

## Verification

`node tools/test-backend.mjs` covers two directly:

- *editors.detect returns a well-formed list* — every entry has `id`, `label` and an `exe` that
  exists on disk. On a bare machine the list may be short, but it is never malformed.
- *editors.open refuses a path that does not exist*.

By hand:

1. **Detection accuracy:** open Studio → External editor. Every listed editor must actually be
   installed, and nothing installed may be missing.
2. **`.cmd` path:** choose VS Code (or Cursor/Windsurf) and press **Open**. It must open the
   working directory, not flash and vanish.
3. **Spaces:** point the active profile at a directory whose path contains a space and repeat. One
   directory must open, not two.
4. **`.exe` path:** choose Notepad++ or Zed and repeat.
5. **File vs folder:** call `codex_open_external` with a file and then with a folder; both must
   work.
6. **Survival:** with the editor open, quit Studio. The editor must stay open.
7. **Uninstalled:** rename the chosen editor's executable and press **Open**. The message must name
   that editor, and the app must keep running.
8. **Fallback:** on a machine with no editor at all, **Reveal in File Explorer** must still open
   Explorer at the folder.
9. **Missing path:** point a profile at a directory that does not exist and try both actions. Both
   must report the path.
10. **No console flash:** none of the above may pop a console window; detection spawns with
    `windowsHide: true`.
