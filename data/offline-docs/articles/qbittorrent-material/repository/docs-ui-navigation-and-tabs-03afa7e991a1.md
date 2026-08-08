# Navigation and tabs

## Behavior

The shell exposes Transfers, Search, RSS, Log, and Notes destinations through
the active visual style's navigation controls. Search, RSS, and Log are loaded
on demand; selecting one enables its loader before changing the central stack
index. The application-menu plugin action selects Search and opens the same
plugin dialog as the Search workspace shortcut.

The Split Dock details strip exposes General, Trackers, Peers, Content, and
Speed as keyboard-reachable buttons. The selected index drives the active
details body and the visible indicator.

## Configuration

Search, RSS, and Log availability persists through the existing Preferences
keys. No network or system setting is changed by selecting a destination or a
details tab.

## Failure modes and safety

If an optional loader cannot be created, the destination remains safe to
select but its page is unavailable; startup logs record the QML load failure.
The plugin action does not install or download a plugin. Network-backed plugin
operations still require the existing Search workspace controls.

## Verification

- `powershell -ExecutionPolicy Bypass -File .\run.ps1 -NoRun -Jobs 4`
- `powershell -ExecutionPolicy Bypass -File .\scripts\capture-ui.ps1 -Executable .\build\qbittorrent.exe -OutputDirectory .\build\smoke-20260721\captures-fixed2 -CaptureRoot .\build\smoke-20260721\capture-runs-fixed2`
- All 17 documented captures completed with exit code 0; current inspected
  evidence includes Search, Workspace, Split Dock, and Card Flow.
- A cold capture launch exited 0, wrote its PNG, and emitted no startup QML
  warnings or errors.
