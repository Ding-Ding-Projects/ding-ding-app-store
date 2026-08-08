# Editing and commands

Working *on* files rather than moving them: opening a remote file in an editor,
running a command against a selection, and the mask language that decides which
files any of it applies to.

## Articles

| Article | Covers |
| --- | --- |
| [editors.md](app-doc://article/material-winscp.repository.29bfa1ddbd07f338) | The internal editor, external editors, and the download-edit-upload cycle. |
| [editor-preferences.md](app-doc://article/material-winscp.repository.af3432057659a5cf) | Ordered editor associations, first-match selection, validation, and filtered keyboard reordering. |
| [remote-edit-round-trip.md](app-doc://article/material-winscp.repository.80cce65c667c8079) | The renderer-to-IPC-to-main upload seam and its conflict/error behaviour. |
| [custom-commands.md](app-doc://article/material-winscp.repository.0f1843719a666217) | Command patterns, argument expansion, quoting and extensions. |
| [custom-command-validation.md](app-doc://article/material-winscp.repository.15af8513577faf65) | The shared UI/main validation contract for interactive and file patterns. |
| [file-masks.md](app-doc://article/material-winscp.repository.a3cb68eed237457c) | The WinSCP mask language — wildcards, exclusion, size and time filters. |
| [console.md](app-doc://article/material-winscp.repository.2036717365155926) | The remote terminal, and which protocols can offer one. |
| [script-runner.md](app-doc://article/material-winscp.repository.ef482e920571a327) | Batch scripting, `/script` and `/command` execution, exit status, and secure XML output. |
| [command-line.md](app-doc://article/material-winscp.repository.f227dc8465de1a51) | The `/` and `-` switch parser shared by startup and second-instance launches. |
| [cli.md](app-doc://article/material-winscp.repository.91a2af36decd0a9e) | The headless `winscp` entry point, console-compatible commands, and drag/drop simulation. |
| [file-find.md](app-doc://article/material-winscp.repository.634a07778b7f3027) | Streaming file search, cancellation, masks and zero-result limits. |
| [command-palette.md](app-doc://article/material-winscp.repository.9d8f1978aeaf6553) | The persisted keyboard palette: every registered command, Preferences destinations, regex search and exact setting teleport. |
| [explorer-properties-dispatch.md](app-doc://article/material-winscp.repository.5333eed891f02752) | Explorer-side dispatch and capability context for local and remote file properties. |
| [explorer-transfers.md](app-doc://article/material-winscp.repository.82289329979e31fa) | Remote copy and move reachability in the single-panel Explorer interface. |
| [drag-drop.md](app-doc://article/material-winscp.repository.ab81621741087a42) | Safe drag/drop effects, Explorer targets, queue drops and refusal conditions. |
| [generate-url-ipv6-escaping.md](app-doc://article/material-winscp.repository.1826894d297b581c) | URI-safe escaping and round-tripping for scoped IPv6 hosts. |

## Postman

Not applicable — this project exposes no HTTP API. See the
[documentation index](app-doc://article/material-winscp.repository.0b5ca119d2be595a).

## Suggested articles

- Protocols — `caps.exec` decides whether remote command
  execution is available; the console uses the same capability.
- Transfers and the queue — masks are shared with transfer settings.
- Search and regex — masks convert to regex for the builder.
