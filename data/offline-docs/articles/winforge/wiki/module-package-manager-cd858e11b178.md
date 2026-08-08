# Package Manager · 套件管理

**Canonical .NET application · 正式 .NET app.** WinForge puts **11 manager adapters** behind one front-end: winget, Scoop, Chocolatey, pip, npm, .NET tools, PowerShell Gallery, PowerShell 7, Cargo, Bun, and vcpkg. Discover, update, uninstall, bundle, schedule, configure sources, and inspect the shared operation queue without leaving WinForge. Each result row retains its owning engine, while install/update/uninstall paths share cancellation, retry, duplicate suppression, history, notifications, and saved global/per-package options.

> **正式 .NET app。** WinForge 將 11 個 manager adapter 統一喺一個介面：winget、Scoop、Chocolatey、pip、npm、.NET tools、PowerShell Gallery、PowerShell 7、Cargo、Bun 同 vcpkg。搜尋、更新、解除安裝、bundle、排程、來源同共用操作佇列全部喺 app 內完成。

> The experimental C++/WinRT Package Manager port and its evidence now live in [WinForge-Native](https://github.com/codingmachineedge/WinForge-Native); they are not part of this canonical module reference. · 實驗性 C++/WinRT 套件管理移植同證據已搬去 [WinForge-Native](https://github.com/codingmachineedge/WinForge-Native)，唔屬於呢份正式模組參考。

*Image omitted from the offline bundle: Managed production Package Manager reference — multi-engine package hub.*

> **Screenshot provenance · 截圖來源：** this image is current evidence for the canonical .NET Package Manager UI. · 呢張圖係正式 .NET 套件管理介面嘅現行證據。

---

## What it does · 概覽

The module is a thin, robust orchestration layer over multiple package-manager CLIs. Every manager implements the same `IPackageManager` contract (`SearchAsync`, `ListInstalledAsync`, `ListUpdatesAsync`, `InstallAsync`, `UninstallAsync`, `UpdateAsync`), so the UI treats them uniformly. The registry (`PackageManagerRegistry`) holds all engines in a fixed order and runs cross-manager operations **concurrently**, skipping any engine that is not available and swallowing per-engine failures so one broken CLI never blocks the rest.

Core capabilities:

- **One search, many engines** — a query fans out across every selected, available manager in parallel and the results are concatenated into a single list (`SearchAllAsync`).
- **Per-manager filtering** — checkbox chips let you include/exclude individual engines; unavailable engines are auto-disabled.
- **Batch update** — *Update all* walks every available update across managers one by one and reports progress.
- **Bundle export/import** — snapshot your installed packages to a JSON bundle and reinstall them later (or on another machine).
- **Engine bootstrap** — install a missing engine (Scoop, Chocolatey, Python/pip, Node/npm, .NET SDK, Rust/Cargo) in one click from the **Setup** view.
- **Ignored updates** — hide updates you never want to see; they are remembered across sessions.
- **Sources view** — read each manager's configured sources, buckets and feeds.
- **Advanced install options** — version pin, scope, architecture, interactive mode and custom args via an **Options…** dialog.

---

## The eleven package managers · 十一個套件管理器

All 11 engines are registered in `PackageManagerRegistry.All`. Each has a stable **key**, bilingual display names, and a backing CLI or package-registry protocol.

| Key | English · 粵語 | Backing CLI | Availability probe |
|-----|---------------|-------------|--------------------|
| `winget` | Windows Package Manager · Windows 套件管理員 | `winget` | `winget --version` |
| `scoop` | Scoop | `scoop` | `scoop --version` (via PowerShell shim) |
| `choco` | Chocolatey | `choco` | `choco --version` |
| `pip` | pip (Python) · pip（Python） | `pip` | `pip --version` |
| `npm` | npm (Node global) · npm（Node 全域） | `npm` | `npm --version` |
| `dotnet` | .NET Tools · .NET 工具 | `dotnet` | `dotnet --version` |
| `psgallery` | PowerShell Gallery · PowerShell 資源庫 | `powershell` | `$PSVersionTable.PSVersion` |
| `pwsh7` | PowerShell 7 · PowerShell 7 套件 | `pwsh` | `pwsh --version` |
| `cargo` | Cargo (Rust) · Cargo（Rust） | `cargo` | `cargo --version` |
| `bun` | Bun | `bun` | `bun --version` |
| `vcpkg` | vcpkg | `vcpkg` | `vcpkg version` |

On load, the module probes each engine with a cheap `--version` call (`CheckAvailability`). Engines that respond are marked **Available · 可用**; the rest are shown as **(not found) · （搵唔到）** in the filter row, their checkbox disabled and de-selected so they never participate in cross-manager operations.

### Exact CLI commands per engine · 各引擎實際指令

The wrappers shell out to the genuine package-manager binaries. The table below quotes the real commands each operation issues. All queries/ids are run through `PkgParse.Q()`, which strips `"` and `` ` `` so a search term cannot break the shell line.

| Manager | Search | List installed | List updates | Install | Uninstall | Update |
|---------|--------|----------------|--------------|---------|-----------|--------|
| **winget** | `winget search --query "…"` | `winget list` | `winget upgrade` | `winget install --id … -e --silent` | `winget uninstall --id … -e --silent` | `winget upgrade --id … -e --silent` |
| **Scoop** | `scoop search …` | `scoop export` (JSON) → fallback `scoop list` | `scoop status` | `scoop install …` | `scoop uninstall …` | `scoop update …` |
| **Chocolatey** | `choco search … --limit-output` | `choco list --local-only --limit-output` | `choco outdated --limit-output` | `choco install … -y` | `choco uninstall … -y` | `choco upgrade … -y` |
| **pip** | *(unsupported — returns empty)* | `pip list --format=json` | `pip list --outdated --format=json` | `pip install …` | `pip uninstall -y …` | `pip install --upgrade …` |
| **npm** | `npm search … --json` | `npm ls -g --depth=0 --json` | `npm outdated -g --json` | `npm install -g …` | `npm uninstall -g …` | `npm install -g …@latest` |
| **.NET tools** | `dotnet tool search …` | `dotnet tool list -g` | *(no built-in — empty)* | `dotnet tool install -g …` | `dotnet tool uninstall -g …` | `dotnet tool update -g …` |
| **PowerShell Gallery** | `Find-Module -Name *…*` | `Get-InstalledModule` | *(no cheap built-in — empty)* | `Install-Module … -Force -Scope CurrentUser` | `Uninstall-Module …` | `Update-Module …` |
| **PowerShell 7 / PSResource** | `Find-PSResource -Name *…*` | `Get-InstalledPSResource` | compares installed resources with `Find-PSResource` | `Install-PSResource … -TrustRepository -Scope CurrentUser` | `Uninstall-PSResource …` | `Update-PSResource … -TrustRepository` |
| **Cargo** | `cargo search …` | `cargo install --list` | *(no built-in — empty)* | `cargo install …` | `cargo uninstall …` | `cargo install … --force` |
| **Bun** | npm registry search API | `bun pm ls` in Bun's global manifest | `bun outdated` in the global manifest | `bun add -g …` | `bun remove -g …` | `bun add -g …@latest` |
| **vcpkg** | `vcpkg search …` | `vcpkg list` | *(empty)* | `vcpkg install …` | `vcpkg remove …` | `vcpkg upgrade … --no-dry-run` |

Notes on engine quirks faithfully handled in code:

- **pip search** is intentionally a no-op — modern pip dropped the `search` subcommand, so `PipManager.SearchAsync` returns an empty list rather than erroring.
- **Scoop installed** prefers the structured `scoop export` JSON (handling both the new `{ apps: [...] }` shape and the old array shape) and only falls back to parsing the `scoop list` table if the JSON yields nothing.
- **Updates are not universal** — only winget, Scoop, Chocolatey, pip and npm expose a cheap "outdated" query. `.NET tools`, `PowerShell Gallery`, `Cargo` and `vcpkg` have no built-in outdated check, so their `ListUpdatesAsync` returns empty by design.
- **JSON outputs** (pip/npm) are sliced to the first `[`…`]` / `{`…`}` block before parsing, so leading banner text or BOM bytes don't break deserialization.

> **Safety · 安全**
> Every install/uninstall/update truly runs the underlying engine against your system. winget and Chocolatey operations may require elevation (Chocolatey runs through `RunCmd(..., elevate: true)`); **Uninstall** removes real software. Review the package id in each row before acting — the engine badge and the monospace id line tell you exactly which manager and package you are about to touch.

---

## Views · 檢視

A single `ViewCombo` dropdown switches between nine views. Each view repurposes the two action buttons (`PrimaryActionBtn` / `SecondaryActionBtn`) and the search box.

| # | View · 中文 | Search box | Primary button | Secondary button |
|---|------------|-----------|----------------|------------------|
| 0 | **Discover · 搜尋安裝** | enabled | Search · 搜尋 | — |
| 1 | **Updates · 可更新** | disabled | Refresh · 重新整理 | Update all · 全部更新 |
| 2 | **Installed · 已安裝** | disabled | Refresh · 重新整理 | — |
| 3 | **Bundles · 套件清單** | disabled | Export… · 匯出… | Import… · 匯入… |
| 4 | **Sources · 來源** | disabled | Refresh · 重新整理 | — |
| 5 | **Ignored · 已忽略** | disabled | Refresh · 重新整理 | — |
| 6 | **Setup · 設定引擎** | disabled | Install all deps · 安裝全部相依 | — |
| 7 | **Settings · 設定** | disabled | Save/apply package settings · 儲存／套用套件設定 | — |
| 8 | **Operations · 操作佇列** | disabled | Refresh/inspect shared queue and history · 重新整理／檢查共用佇列同歷史 | Cancel/retry where applicable · 可用時取消／重試 |

### Discover · 搜尋安裝

Type a query (e.g. `vscode`, `vlc`, `obs`) and press Enter or click **Search**. The query must be at least 2 characters. WinForge searches every selected, available engine concurrently and lists the merged results with a count header (`Results — N`). Each row offers:

- **Details · 詳情** — opens a dialog with the engine's native info output (`winget show`, `scoop info`, `choco info`, `pip show`, `npm view`, `dotnet tool search --detail`, `Find-Module | Format-List`, etc.).
- **Options… · 選項…** — the advanced install dialog (see below).
- **Install · 安裝** — runs the engine's silent install; the button text flips through *Installing… → Installed / Retry*.

### Updates · 可更新

Collects available updates across managers (`AllUpdatesAsync`), hides anything you've ignored, and shows `Updatable — N (M ignored)`. Per row:

- **Update · 更新** (labelled `Update → <version>` when a target version is known) runs the engine upgrade.
- **Ignore · 忽略** adds the package to your ignore list and re-renders.

**Update all · 全部更新** iterates every update sequentially, updating the header with live progress (`Updating <name>… (k/N)`) and finishing with `Updated k/N.`.

### Installed · 已安裝

Lists installed packages across all selected managers (`AllInstalledAsync`) with an `Installed — N` count. Each row offers **Details** and **Uninstall · 解除安裝**.

### Bundles · 套件清單

Portable, JSON-based snapshots of your installed set.

- **Export… · 匯出…** gathers installed packages across managers and writes a pretty-printed JSON array (default filename `winforge-packages.json`). Each entry stores `Manager`, `Id`, `Name`, `Version`.
- **Import… · 匯入…** reads a bundle and reinstalls each entry through its original manager — skipping any entry whose manager is missing/unavailable — with progress (`Installing <name>… (k/N)`) and a final `Installed k/N from bundle.`

Bundle entry shape:

```json
[
  { "Manager": "winget", "Id": "Microsoft.VisualStudioCode", "Name": "Visual Studio Code", "Version": "1.x" },
  { "Manager": "scoop",  "Id": "neovim",                      "Name": "neovim",             "Version": "0.x" }
]
```

This makes it easy to mirror a setup onto a fresh machine: export on the old box, import on the new one.

### Sources · 來源

Shows each selected manager's configured sources / buckets / feeds in a monospace, selectable card. The exact lookups:

| Manager | Command |
|---------|---------|
| winget | `winget source list` |
| Scoop | `scoop bucket list` |
| Chocolatey | `choco source list` |
| pip | `pip config list` |
| npm | `npm config get registry` |
| .NET | `dotnet nuget list source` |
| PowerShell Gallery | `Get-PSRepository \| Format-Table …` |
| Cargo | `crates.io (default registry)` (static) |
| vcpkg | `vcpkg x-update-baseline --dry-run` |

### Ignored · 已忽略

Lists updates you've chosen to hide (`Ignored updates — N`). Each entry has **Un-ignore · 取消忽略** to bring it back. The ignore list is keyed as `managerKey|id` and persisted in settings under `pkg.ignored` (newline-separated), so it survives restarts. If nothing is ignored, a hint explains how to use **Ignore** on an update.

### Setup · 設定引擎

The bootstrap and dependencies view, split into two sections.

**Package managers · 套件管理器** — every engine is listed with its live status (**Available · 可用** / **Not installed · 未安裝**). Missing engines that can be bootstrapped show an **Install · 安裝** button that runs a one-click installer:

| Engine | Bootstrap action |
|--------|------------------|
| **Scoop** | PowerShell: `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser -Force` then `irm https://get.scoop.sh \| iex` |
| **Chocolatey** | Elevated PowerShell: the official `community.chocolatey.org/install.ps1` bootstrap |
| **pip** | Installs `Python.Python.3.12` via winget |
| **npm** | Installs `OpenJS.NodeJS.LTS` via winget |
| **.NET tools** | Installs `Microsoft.DotNet.SDK.9` via winget |
| **Cargo** | Installs `Rustlang.Rustup` via winget |

(winget, PowerShell Gallery and vcpkg have no bootstrap — winget and PowerShell ship with Windows 11; vcpkg is set up manually.)

**Common dependencies (winget) · 常用相依（winget）** — a curated list of tools WinForge itself benefits from, each shown as **Installed · 已安裝** or **Missing · 欠缺** with a per-row **Install** button. **Install all deps · 安裝全部相依** installs every missing one in sequence.

Curated dependencies (`PackageService.Deps`, exact winget ids):

| Tool · 中文 | winget id |
|-------------|-----------|
| FFmpeg (media engine) · FFmpeg（媒體引擎） | `Gyan.FFmpeg` |
| 7-Zip | `7zip.7zip` |
| Git | `Git.Git` |
| Android Platform Tools (adb / fastboot) · Android 平台工具 | `Google.PlatformTools` |
| scrcpy (screen mirror) · scrcpy（螢幕鏡像） | `Genymobile.scrcpy` |
| Python 3 | `Python.Python.3.12` |
| Node.js LTS | `OpenJS.NodeJS.LTS` |
| PowerShell 7 | `Microsoft.PowerShell` |
| Windows Terminal · Windows 終端機 | `Microsoft.WindowsTerminal` |
| VLC media player · VLC 播放器 | `VideoLAN.VLC` |
| Notepad++ | `Notepad++.Notepad++` |
| Docker Desktop | `Docker.DockerDesktop` |
| VeraCrypt (encryption) · VeraCrypt（加密） | `IDRIX.VeraCrypt` |
| SQL Server Management Studio (SSMS) · SQL Server 管理工具 | `Microsoft.SQLServerManagementStudio` |

After a successful dependency install, `PackageService.RefreshProcessPath()` re-reads `PATH` from the machine + user registry into the running process, so a freshly-installed CLI resolves immediately — **no app restart needed**.

> **Safety · 安全**
> The Scoop and Chocolatey bootstraps download and execute install scripts from the internet (`get.scoop.sh`, `community.chocolatey.org`), and Chocolatey runs **elevated** with `Set-ExecutionPolicy Bypass`. These are the engines' own official installers, but only run them on machines where you intend to install those package managers.

---

## Per-manager filtering · 各管理器篩選

The **Package managers · 套件管理器** row (`ManagerFilters`) renders one checkbox per engine, in registry order. Behaviour:

- All available engines start **selected**; selection is held in a case-insensitive set.
- An engine probed as missing is labelled `… (not found) · （搵唔到）`, its checkbox **disabled**, and removed from the selection.
- Only engines that are both **selected** and **available** take part in any operation (`SelectedAvailable()`).
- Toggling a checkbox immediately adds/removes that engine from subsequent searches, update checks, installed listings, exports and sources.

This lets you, for example, search only `winget` + `scoop`, or check updates only for `npm` and `pip`, without uninstalling anything.

---

## Advanced install options · 進階安裝選項

The **Options… · 選項…** button on a Discover row opens an install dialog with:

- **Version (optional) · 版本（可選）** — pin a specific version.
- **Scope · 範圍** — `default` / `user` / `machine` (winget).
- **Architecture · 架構** — `default` / `x64` / `x86` / `arm64` (winget).
- **Interactive installer · 互動式安裝** — run the GUI installer instead of silent.
- **Custom args · 自訂參數** — extra flags appended verbatim.

These map onto each engine as far as it supports them (`InstallAdvancedAsync`): scope and architecture are winget-only; version pinning translates to `--version` (winget/choco/dotnet/cargo), `@version` (scoop/npm), `==version` (pip), or `-RequiredVersion` (PowerShell Gallery). A note in the dialog spells this out: *Scope / architecture apply to winget; version & custom args apply where the manager supports them.*

---

## Robustness model · 穩陣設計

The whole module is built to never crash on a flaky CLI:

- Every `IPackageManager` method wraps its shell call and returns an **empty list** (for queries) or `TweakResult.Fail` (for actions) on error — it never throws.
- `RunAcrossAsync` re-checks availability per engine, runs all engines via `Task.WhenAll`, and concatenates results, swallowing any individual failure.
- Table parsers (winget's column layout, Scoop/Chocolatey/Cargo line formats) are defensive: bad rows are skipped, missing columns yield empty strings.

The practical upshot: if one engine is half-installed or returns garbage, you still get clean results from the others.

---

## Related · 相關

- [Module-Misc-Utilities](app-doc://article/winforge.wiki.4bbe3f2c91da658b) — other convenience tools and helpers across WinForge.
- [Home](app-doc://article/winforge.wiki.355883cf07556dda) — full module index.

---
_Part of [Home](app-doc://article/winforge.wiki.355883cf07556dda) · WinForge wiki._

---

## Guided tour · 逐步導覽

Each control on the live page is numbered on the screenshot below and explained in the legend — what every **button, toggle, tab, box and label** does, in English and 粵語. Captured from the running app via UI Automation. 下面每個控件都有編號，逐個解釋佢哋嘅功能同標籤意思。

*Image omitted from the offline bundle: Package Manager — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | App-shell back button — returns to the previous page / the module grid you came from. Part of the window chrome, not the module itself. | "Back" = go back / 返回上一頁。 |
| 2 | Button | App-shell hamburger that collapses or expands the left navigation pane. Also window chrome. | "Toggle Navigation" = show/hide the side menu / 開關側邊導覽。 |
| 3 | Search box | The global app-wide search in the title bar (searches all WinForge modules/settings), separate from the package search below at #10. | "Search everything · 搜尋全部" — "Search everything" and 搜尋全部 both mean: search across the whole app. |
| 4 | Checkbox (manager filter) | Toggles whether **winget** is included in Discover/Updates/Installed/Sources operations. Checked managers are the ones searched and acted on. | "Windows Package Manager · Windows 套件管理員" — winget, Microsoft's built-in package manager; 套件管理員 = package manager. |
| 5 | Checkbox (manager filter) | Toggles whether **Scoop** is included in the current operation. | "Scoop · Scoop" — the Scoop command-line installer; name is the same in both languages. |
| 6 | Checkbox (manager filter) | Toggles whether **Chocolatey** is included. | "Chocolatey · Chocolatey" — the Chocolatey package manager; same name both sides. |
| 7 | Checkbox (manager filter) | Toggles whether **pip** (Python packages) is included. | "pip (Python) · pip（Python）" — pip, Python's package installer; 括號標明係 Python。 |
| 8 | Checkbox (manager filter, disabled) | The **npm** filter, shown greyed-out because Node/npm is not detected on this machine; it stays disabled until npm is installed (you can bootstrap it from the Setup view). | "npm (Node global) · npm（Node 全域）  (not found)" — npm global packages; (not found) / （搵唔到）means the engine isn't installed. |
| 9 | Dropdown | The **view selector**. Switches the page between nine modes: Discover, Updates, Installed, Bundles, Sources, Ignored, Setup, Settings, and Operations (shared queue/history). Changing it reloads the list and re-labels button #11. | Icon-only / empty name; the dynamic picker carries the bilingual names for all nine views. |
| 10 | Search box | The **package search box** (active in the Discover view). Type a query and press Enter to search the selected managers; it's disabled in the other views. Needs at least 2 characters. | Placeholder "Search packages (e.g. vscode, vlc, obs)… · 搜尋套件（例如 vscode、vlc、obs）…" — search for packages, with example names. |
| 11 | Button | The **primary action button**, whose label and job change with the view at #9: Discover → *Search* (run the query); Updates → *Refresh*; Installed → *Refresh*; Bundles → *Export…*; Sources/Ignored → *Refresh*; Setup → *Install all deps*. | Shown here as "Search · 搜尋" in Discover mode; the text rewrites itself per view (重新整理 / 匯出… / 安裝全部相依 etc.). |

**How to use it · 點用** — First select the available package managers you want in the dynamically generated filter row; unavailable engines are disabled. Pick a mode from the view dropdown (#9) — start with **Discover**, type a package name into the search box (#10), and press Enter or click **Search** (#11). Use **Updates** for batch upgrades, **Installed** for removal, **Bundles** for portable package sets, **Setup** for missing engines, **Settings** for scheduler/notification/option defaults, and **Operations** for cancellation, retry, and history.
