# Config & Backup · 設定與備份

**Config & Backup** is WinForge's safety net: a single in-app module that snapshots, exports, restores and verifies your entire suite configuration. It wraps real Windows CLIs (`git`, `schtasks`, `reg`, `winget`, `robocopy`) so every action genuinely touches the system — no fake progress bars. Everything is portable, checksummed and fully bilingual.

> 設定與備份係 WinForge 嘅安全網：一個喺 app 內就影快照、匯出、還原同驗證成個套件設定嘅模組。背後真係叫 `git`、`schtasks`、`reg`、`winget`、`robocopy` 等 CLI 嚟做嘢。

*Image omitted from the offline bundle: Config & Backup module — bundle export/import, git snapshot history, capture & export, and scheduled daily backup.*

---

## What it does · 功能總覽

The module is organised into five clearly separated cards, each backed by a method on `ConfigBackupService`:

| Card · 卡 | Purpose · 用途 | Real tool · 真工具 |
|---|---|---|
| **Portable settings bundle · 可攜設定檔案** | Export/import all WinForge settings as one `.zip` with a manifest + SHA-256 | `System.IO.Compression` ZIP + `SettingsStore` |
| **Config snapshots · 設定快照** | Local git history of your config — browse, diff, restore | `git` |
| **Capture & export · 擷取與匯出** | Dump touched registry keys (`.reg`), the winget app list, taskbar/Start backup | `reg`, `winget` |
| **Automate & mirror · 自動化與鏡像** | Schedule a daily snapshot; mirror the repo to a folder/share | `schtasks`, `robocopy` |
| **Output · 輸出** | Shows raw command output (diffs, fsck logs, etc.) with a **Copy** button | — |

All work runs through a single `Run(...)` helper that disables re-entry (a `_busy` flag), surfaces success/failure in an `InfoBar`, and pipes raw stdout to the **Output** pane.

---

## Where everything lives · 檔案放喺邊

Everything is rooted under your local app data folder:

```
%LOCALAPPDATA%\WinForge\
├── settings.json          ← the live exported settings
└── snapshots\             ← the local git snapshot repository (SnapshotsDir)
    ├── .git\
    ├── settings.json       ← committed on every snapshot
    └── apps.json           ← winget app list, captured best-effort per snapshot
```

- **`AppDir`** = `%LOCALAPPDATA%\WinForge`
- **`SnapshotsDir`** = `%LOCALAPPDATA%\WinForge\snapshots`
- **`SettingsFile`** = `%LOCALAPPDATA%\WinForge\settings.json`

> 一切都喺 `%LOCALAPPDATA%\WinForge` 之下，唔會掂你 Documents 或者系統其他位置。

---

## Portable settings bundle · 可攜設定檔案

A bundle is a self-contained, version-stamped, integrity-checked `.zip` you can carry to another machine.

### Export bundle · 匯出檔案

Click **Export bundle… · 匯出檔案…** and choose a save path. The default filename is `WinForge-config-yyyyMMdd-HHmm.zip`. `ConfigBackupService.ExportBundle` then:

1. Calls `SettingsStore.ExportTo(SettingsFile)` so the on-disk settings are current.
2. Stages `settings.json` into a temp folder (writes `{}` if there is none yet).
3. Writes a **`manifest.json`** describing the bundle:

   ```json
   {
     "app": "WinForge",
     "bundleVersion": "1",
     "created": "<ISO-8601 timestamp>",
     "machine": "<MachineName>",
     "user": "<UserName>"
   }
   ```
4. Computes **SHA-256 checksums** for every staged file and writes them to **`checksums.txt`** (format: `<HEX-HASH>  <filename>`).
5. Zips the staging folder with `CompressionLevel.Optimal` (no base directory) to your chosen path, deleting any existing file first.

The temp staging folder is always cleaned up in a `finally` block.

### Import bundle · 匯入檔案

Click **Import bundle… · 匯入檔案…** and pick a `.zip`. `ImportBundle` extracts it to a temp folder and:

- **Validates the manifest version.** If `manifest.json` declares a `bundleVersion` other than the supported **`"1"`** (`ManifestVersion`), the import is refused with a clear bilingual error.
- Requires a `settings.json` inside the bundle (otherwise fails with *"Bundle has no settings.json."*).
- Re-applies settings via `SettingsStore.ImportFrom(settings)`, then reports how many settings were imported:
  > *"Imported & re-applied N setting(s). Restart WinForge for all of them to take effect."*
  > *「已匯入並套用 N 項設定。重開 WinForge 全部即生效。」*

> **Note · 提示**: a full effect of an imported bundle may require restarting WinForge — the InfoBar says so explicitly.

---

## Config snapshots (local git history) · 設定快照（本地 git 歷史）

Each snapshot is a real **git commit** in `SnapshotsDir`, giving you a browsable, diffable, restorable history of your configuration over time.

### Taking a snapshot · 影快照

Type an optional note in the **Optional note… · 可填備註…** box and click **Take snapshot · 影快照**. `TakeSnapshot`:

1. Calls `InitSnapshotRepo` (idempotent) — `git init`, then sets a **local identity** so commits work even without a global git config:
   - `git config user.name WinForge`
   - `git config user.email winforge@localhost`
2. Exports live settings to `snapshots\settings.json`.
3. **Best-effort** captures a winget app list into `snapshots\apps.json` (failures are swallowed so a missing winget never blocks a snapshot).
4. `git add -A`, then `git commit` with a message of the form `yyyy-MM-dd HH:mm:ss` (plus `— <your note>` if you typed one). Double-quotes in your note are sanitised to single-quotes.
5. If git reports *"nothing to commit"*, the module returns a friendly *"No changes since the last snapshot. · 同上一個快照冇分別。"* instead of an error.

### Browsing snapshots · 瀏覽快照

`ListSnapshots` runs `git log --pretty=format:%H%x09%ad%x09%s --date=iso` and parses each line into a `SnapshotInfo`:

| Field · 欄 | Source · 來源 |
|---|---|
| `Hash` | full commit hash |
| `ShortHash` | first 7 chars (display) |
| `Date` | ISO commit date |
| `Subject` | commit message |

The list shows newest-first. When empty, a placeholder reads *"No snapshots yet — take one to start a config history. · 未有快照 — 影一個開始記錄設定歷史。"*

### Per-snapshot actions · 每個快照嘅操作

Each row has an actions button that opens a `MenuFlyout`:

- **Restore to this snapshot · 還原到呢個快照** — see below.
- **Diff vs current · 同而家比較** — runs `git diff <commit> -- settings.json` after re-exporting live settings, and prints the unified diff into the **Output** pane (or *"No differences. · 冇分別。"*).

### Restoring · 還原

`RestoreSnapshot` is deliberately **non-destructive**:

1. **First it auto-snapshots your current state** with the message `auto: before restore`, so you can always roll back the restore itself.
2. Runs `git checkout <commit> -- .` to bring the snapshot's files into the working tree.
3. Re-applies via `SettingsStore.ImportFrom(settings)` and reports the short hash + number of settings re-applied.

> **Safety · 安全**: Restore overwrites your current WinForge settings — but because it commits a `auto: before restore` snapshot first, the previous state is never lost. Some restored settings still need a WinForge restart to fully take effect. See [FAQ-and-Safety](app-doc://article/winforge.wiki.677bfeab3d50421e).

### Maintenance: verify, prune, bundle · 維護

| Button · 掣 | Method · 方法 | Underlying git · 底層 git |
|---|---|---|
| **Verify integrity · 驗證完整性** | `VerifyIntegrity` | `git fsck --full` (reports *"(no problems reported)"* when clean) |
| **Prune history · 清理歷史** | `PruneHistory` | `git reflog expire --expire=now --all` + `git gc --prune=now --aggressive` |
| **Save as .bundle… · 存做 .bundle…** | `CreateBundle` | `git bundle create <path> --all` |

- **Verify integrity** recomputes/validates the git object store. If there is no snapshot repo yet, it simply notes *"git fsck: (no snapshot repo)"* rather than failing hard.
- **Prune history** compacts the repo and reclaims space after many snapshots.
- **Save as .bundle…** packages the **entire history** into one portable `git` bundle file (default name `winforge-config-yyyyMMdd.bundle`) you can clone from elsewhere.

> **Safety · 安全**: **Prune history** runs an aggressive `gc` with `--prune=now`, which permanently discards unreferenced/expired objects. Once pruned, intermediate dangling states cannot be recovered. Your committed snapshots remain intact.

---

## Capture & export · 擷取與匯出

This card produces human-reviewable, re-importable artifacts outside the git repo.

### Export registry (.reg) · 匯出登錄檔

**Export registry (.reg)… · 匯出登錄檔（.reg）…** writes one consolidated `.reg` file (default `winforge-registry-yyyyMMdd.reg`) covering exactly the **HKCU** keys WinForge is known to touch. Because only `HKCU` is exported, **no admin elevation is required**.

`ExportRegistry` loops over `TouchedRegistryKeys`, runs `reg.exe export "<key>" "<tmp>" /y` for each, strips each fragment's own `Windows Registry Editor Version 5.00` header, and concatenates the key blocks under a labelled comment (`; --- <label> (<key>) ---`). The final file is written as UTF-8 (no BOM) with a single shared header.

The captured keys · 擷取嘅機碼:

| Registry key · 機碼 | Label · 標籤 |
|---|---|
| `HKCU\…\Explorer\Advanced` | Explorer Advanced |
| `HKCU\…\Explorer\Taskband` | Taskbar pins |
| `HKCU\…\CurrentVersion\Search` | Search |
| `HKCU\…\Themes\Personalize` | Personalize / dark mode · 深色模式 |
| `HKCU\…\CurrentVersion\AdvertisingInfo` | Advertising ID |
| `HKCU\…\ContentDeliveryManager` | Suggestions |
| `HKCU\Control Panel\Desktop` | Desktop / wallpaper quality |
| `HKCU\Control Panel\Mouse` | Mouse |
| `HKCU\Control Panel\Keyboard` | Keyboard |
| `HKCU\Software\Microsoft\Clipboard` | Clipboard |
| `HKCU\Environment` | User environment variables |

The result message reports how many keys were actually exported.

### Capture app list · 擷取程式清單

**Capture app list… · 擷取程式清單…** runs `winget export -o "<path>" --include-versions --accept-source-agreements` to a `.json` file (default `apps.json`). If winget is missing the module returns a clear *"winget export failed (is winget installed?). · winget 匯出失敗（有冇裝 winget？）。"* This same capture also runs **best-effort inside every snapshot** (`apps.json`), so your snapshot history records what was installed at each point in time.

### Back up taskbar / Start · 備份工作列／開始選單

**Back up taskbar / Start… · 備份工作列／開始選單…** prompts for a destination folder and `BackupTaskbarAndStart` writes:

- **`taskband.reg`** — `reg.exe export` of `HKCU\…\Explorer\Taskband` (your taskbar pins).
- **`start2.bin`** — copied from
  `…\Packages\Microsoft.Windows.StartMenuExperienceHost_cw5n1h2txyewy\LocalState\start2.bin` if present.

> **Note · 注意**: Windows 11 has **no supported Start-layout import**, so `start2.bin` is kept **for reference / manual re-pin only** — the module says so in its output. The taskbar `.reg` can be re-imported by double-clicking it.

---

## Automate & mirror · 自動化與鏡像

### Scheduled daily auto-backup · 每日自動備份

Enter a time (24h `HH:mm`, default **`03:00`**) and click **Schedule daily backup · 排定每日備份**. `ScheduleDailyBackup` registers a Windows Task Scheduler job via `schtasks.exe`:

```
schtasks /Create /SC DAILY /TN "WinForge Daily Backup" /TR "\"<WinForge.exe>\" --snapshot" /ST <time> /RL LIMITED /F
```

Key details:

- **Task name · 工作名**: `WinForge Daily Backup` (`DailyTaskName`).
- **Run level**: `/RL LIMITED` — runs at **limited (non-elevated)** privileges, no admin token needed.
- **Action**: launches WinForge itself with the **`--snapshot`** command-line switch, so the daily run is just a headless `TakeSnapshot`.
- `/F` forces overwrite if a task with that name already exists.

The card shows live status via `IsDailyBackupScheduled` (a `schtasks /Query` on the task name):

- **● Scheduled · ● 已排程**
- **○ Not scheduled · ○ 未排程**

**Remove schedule · 移除排程** runs `schtasks /Delete /TN "WinForge Daily Backup" /F` to deregister it.

### Mirror to folder · 鏡像去資料夾

**Mirror to folder… · 鏡像去資料夾…** prompts for a destination (a local folder or a network share) and mirrors the whole snapshot repo there with **robocopy**:

```
robocopy "<SnapshotsDir>" "<dest>" /MIR /R:2 /W:2 /NP
```

`MirrorTo` runs this through `cmd` and **normalises robocopy's exit codes** — robocopy returns 0–7 on success and only 8+ on real failure, so the wrapper maps `< 8` to exit 0 (otherwise `ShellRunner` would flag a successful mirror as a failure). It refuses to run if there are no snapshots yet, or if no destination is chosen.

> **Safety · 安全**: `/MIR` is a **mirror** — it makes the destination an exact copy of the snapshot repo, which means files in the destination that are not in the source are **deleted**. Always mirror to a dedicated, empty backup folder, never to a folder that holds other data. See [FAQ-and-Safety](app-doc://article/winforge.wiki.677bfeab3d50421e).

---

## Output pane · 輸出

Every operation that produces raw text — diffs, `git fsck` logs, prune/gc output, schedule registration, mirror logs — fills the **Output** box. **Copy · 複製** copies it to the clipboard via a `DataPackage`. The top **InfoBar** independently shows a green **Done · 完成** or red **Failed · 失敗** summary, and when an operation fails without elevation the module is aware admin may be the cause.

---

## How it fits together · 整體運作

- Reuses the existing **`SettingsStore`** export/import pipeline — the same serialization the rest of WinForge uses, so bundles and snapshots are always consistent with the live app.
- Reuses **`ShellRunner`** (`Run`, `RunIn`, `RunCmd`) for all external process execution; git always runs **in** `SnapshotsDir` via `RunIn`.
- The module is fully bilingual through `Loc.I.Pick(en, zh)` and re-renders every label when the app language changes — switch language and the whole page flips between English and 粵語 instantly.

---

## Quick reference · 快速參考

| Action · 動作 | Default filename · 預設檔名 | Backed by · 背後 |
|---|---|---|
| Export bundle · 匯出檔案 | `WinForge-config-yyyyMMdd-HHmm.zip` | ZIP + manifest + SHA-256 |
| Save as .bundle · 存做 bundle | `winforge-config-yyyyMMdd.bundle` | `git bundle … --all` |
| Export registry · 匯出登錄檔 | `winforge-registry-yyyyMMdd.reg` | `reg export` (HKCU only) |
| Capture app list · 擷取程式清單 | `apps.json` | `winget export` |
| Take snapshot · 影快照 | (commit) | `git add -A` + `git commit` |
| Schedule daily · 排定每日 | task `WinForge Daily Backup` | `schtasks /Create` |

---

_Part of [Home](app-doc://article/winforge.wiki.355883cf07556dda) · WinForge wiki._

---

## Guided tour · 逐步導覽

Each control on the live page is numbered on the screenshot below and explained in the legend — what every **button, toggle, tab, box and label** does, in English and 粵語. Captured from the running app via UI Automation. 下面每個控件都有編號，逐個解釋佢哋嘅功能同標籤意思。

*Image omitted from the offline bundle: Config & Backup — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | App-shell back button — returns you to the previous module / dashboard. Part of the window chrome, not this page. | "Back" — go back / 返回上一頁. |
| 2 | Button | App-shell hamburger that collapses or expands the left navigation pane. Window chrome, shared across all modules. | "Toggle Navigation" — show/hide the side menu / 開關側邊導覽。 |
| 3 | Search box | Global search box in the shell header; type to filter across all of WinForge's tweaks and modules. Not specific to this page. | "Search everything · 搜尋全部" — search everything (全部 = all). |
| 4 | Button | Opens a Save dialog and exports **every** WinForge setting into one portable `.zip` (with a version manifest + SHA-256 checksums) named `WinForge-config-<date>.zip`. | "Export bundle…" — export the settings bundle / 匯出（可攜設定）檔案。 |
| 5 | Button | Opens an Open dialog to pick a previously exported `.zip` bundle, then imports and re-applies all settings from it. | "Import bundle…" — import a settings bundle / 匯入檔案。 |
| 6 | Edit | Optional free-text note attached to the next snapshot (used as the git commit message). Cleared automatically after the snapshot is taken. | "Optional note…" — an optional note / 可填備註（可以唔填）。 |
| 7 | Button | Commits the current settings (plus a winget app list) to the local git snapshot repo, using the note in #6 as the message, then refreshes the snapshot list. | "Take snapshot" — take a snapshot / 影快照（記錄當前設定）。 |
| 8 | Button | Re-reads the local git history and reloads the snapshot list below. | "Refresh" — refresh / 重新整理列表。 |
| 9 | Button | Runs an integrity check (`git fsck`-style) on the snapshot repository to confirm no commits are corrupt. | "Verify integrity" — verify integrity / 驗證完整性。 |
| 10 | Button | Prunes old snapshot history (garbage-collects / trims the git repo) to reclaim space, then refreshes the list. | "Prune history" — prune the history / 清理（舊）歷史。 |
| 11 | Button | Opens a Save dialog and writes the entire snapshot repo to a single portable git `.bundle` file (`winforge-config-<date>.bundle`) you can copy elsewhere. | "Save as .bundle…" — save as a `.bundle` file / 存做 .bundle 檔案。 |
| 12 | Button | Opens a Save dialog and exports the registry keys WinForge touches into a `.reg` file (`winforge-registry-<date>.reg`). | "Export registry (.reg)…" — export the registry to a `.reg` file / 匯出登錄檔。 |
| 13 | Button | Opens a Save dialog and captures the list of installed apps via winget into a JSON file (`apps.json`). | "Capture app list…" — capture the installed-app list / 擷取程式清單。 |
| 14 | Button | Opens a folder picker and backs up your taskbar pins and the Start menu layout into the chosen folder. | "Back up taskbar / Start…" — back up the taskbar and Start menu / 備份工作列／開始選單。 |
| 15 | Edit | Time field for the daily backup schedule (HH:mm); defaults to `03:00` if left blank. Feeds the "Schedule daily backup" action. | (icon-only / empty name) — the "Daily at" time box next to it / 「每日」時間輸入格。 |
| 16 | Button | Creates a Windows scheduled task that takes a snapshot every day at the time in #15, then updates the on-screen schedule status. | "Schedule daily backup" — schedule a daily backup / 排定每日備份。 |
| 17 | Button | Deletes the daily-backup scheduled task and updates the schedule status indicator. | "Remove schedule" — remove the schedule / 移除排程。 |

**How to use it · 點用** — Start by taking a baseline: type an optional note (#6) and hit **Take snapshot** (#7) to begin a local git history, or use **Export bundle** (#4) to save a single portable `.zip` of everything you can re-apply later with **Import bundle** (#5). For specific assets use the **Capture & export** row — registry `.reg` (#12), winget app list (#13), and taskbar/Start layout (#14). To keep things current automatically, set a time (#15) and click **Schedule daily backup** (#16); **Remove schedule** (#17) turns it off again. Use **Verify integrity** (#9) and **Prune history** (#10) occasionally to keep the snapshot repo healthy, and **Save as .bundle** (#11) to move the whole history to another machine.
