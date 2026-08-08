# The console

## What it does

Opens a terminal against the remote host on the session that is already
connected — no second login, no second password. It is a tab like any other, so
it participates in the tab strip, searches, grouping and appearance editing.

The console requires `caps.exec`. [SCP](app-doc://article/material-winscp.repository.5dc0057fa313f047) always provides
it, and SFTP provides it when the connected server/account exposes the required
SSH command execution path. On FTP, WebDAV and S3, and on an SFTP session
without execution support, the command is greyed out with a tooltip naming the
reason.

## Configuration

| Option | Default | Meaning |
| --- | --- | --- |
| `postLoginCommands` (per site) | `[]` | Commands run once when the shell opens. |
| `shell` (per site) | `''` | Which shell to invoke. |
| `returnVar` (per site) | `''` | Variable holding the last exit code. |
| `confirmCommandSession` | `true` | Confirm before opening a shell session. |
| `clearAliases`, `unsetNationalVars` | `true` | Normalize the environment so output stays parseable. |

The console's own scrollback has a search bar with the
[regex builder](app-doc://article/material-winscp.repository.e00a792e9bc916e2), and its appearance —
font, size, colours, spacing — is editable through the per-element
["Edit appearance…"](app-doc://article/material-winscp.repository.caaac4c702e76f8b) path like
any other surface.

Live console events are matched to the owning session before they enter the
scrollback. This keeps two open consoles isolated even when the main process
publishes events for both sessions.

## Failure modes

| Situation | What the user sees | Recoverable |
| --- | --- | --- |
| Protocol has no shell | The command is disabled with a tooltip explaining why. It never opens an empty console. | n/a |
| Command produces unbounded output (`yes`, `tail -f`) | The renderer keeps the newest 2,000 lines and marks the output as truncated. There is no interrupt channel; stopping the wait does not stop the remote command, and a later request failure does not produce a stale error notification after the wait was released. | Yes — stop it from another remote session or use a command with its own timeout |
| Full-screen program (`vim`, `top`) | Terminal emulation is line-oriented. Such programs are detected and reported as unsupported rather than rendering as escape-sequence soup. | Yes — use a terminal |
| A command changes the working directory | Reflected in the panel when `autoReadDirectoryAfterOp` is on. Otherwise the panel says it may be stale. | Yes |
| Non-POSIX login shell | The console opens and everything behaves oddly. The `shell` option is the fix, and the error names the shell the server reported. | Yes |
| Session drops with the console open | The console shows the disconnection and offers reconnect. Scrollback is preserved. | Yes |
| A command waits for input the user did not expect | It is interactive — that is what this surface is for. Interrupt is always available. | Yes |
| Console startup fails while creating its communication session | Startup reports the global initialization error and closes the session-owned channel, so a retry cannot reuse a half-open console. | Yes — retry after correcting the startup failure |
| Cleanup encounters a late session or XML-log error | The command keeps its established exit result, attempts both cleanup paths, and releases the runner state instead of rejecting after completion. | Yes — rerun after correcting the underlying resource error |
| The renderer window closes while a confirmation is pending | IPC resolves the pending question as `cancel` and removes its window listener, so the console or queued operation cannot wait forever for a destroyed renderer. | Yes — reopen the surface and retry |

## Security considerations

- **The console has the user's full remote privileges.** Everything typed runs
  as the logged-in user, and the app applies no filtering to it — filtering a
  terminal would be both futile and misleading.
- **`postLoginCommands` run automatically on every connect.** They come from the
  site record, so an imported site can carry commands. Import shows them
  explicitly and requires confirmation.
- **Console output goes to the session log** when logging is enabled, which can
  capture whatever a command prints — including a secret the user pasted.
  `logSensitive` does not gate this, because the console cannot know what is
  sensitive. The log's export warning covers it.
- **Nothing typed here is stored as a credential.** Command history is per
  session and not persisted, precisely because people type passwords into
  terminals.
- **Stop waiting is not remote interruption.** A runaway command continues on
  the server after the renderer releases its wait. Stop it from another remote
  session or use a command with its own timeout; the console will not surface a
  late request failure as though the released wait were still active.

## Verification

- Capability gating is tested to assert the console is unavailable without
  `caps.exec`.
- Session identity filtering is tested for matching, mismatched and malformed
  live console events.
- Output bounding is tested against a synthetic never-ending command. The
  current port has no remote interrupt channel.
- Full-screen program detection is tested with recorded escape sequences.
- Non-persistence of command history is tested by asserting nothing reaches the
  configuration file.
- Environment normalization (`clearAliases`, `unsetNationalVars`) is tested by
  inspecting the commands issued at shell open.
- Startup cleanup is tested by forcing initialization to fail and asserting the
  session-owned communication channel is closed before the global error returns.
- Runner cleanup is tested with failing session and XML-log close operations to
  ensure both are attempted without leaking the completed run's script state.
- Pending IPC questions are tested to resolve as `cancel` on window close and to
  remove their lifecycle listener after a normal answer.

## Suggested articles

- [SCP](app-doc://article/material-winscp.repository.5dc0057fa313f047) and [SFTP](app-doc://article/material-winscp.repository.07a5111c637447e9) — protocols that
  can expose remote command execution to the console.
- [Custom commands](app-doc://article/material-winscp.repository.0f1843719a666217) — for non-interactive commands with quoting.
- [Session logging](app-doc://article/material-winscp.repository.d1ac326b8468819c) — what console output ends up in.
- Tabs and navigation — the console is a tab, with all that implies.
