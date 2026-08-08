# Installation & Build · 安裝與編譯

WinForge is the canonical self-contained **.NET 11 / WinUI 3** desktop app for Windows 11 (it also runs on Windows 10 1809+). Every push and manual workflow dispatch runs the managed test-and-release pipeline; successful `main` runs publish stable Latest releases, while successful non-main runs publish prereleases.

粵語 — WinForge 係正式、自包含嘅 **.NET 11 / WinUI 3** 桌面程式，主打 Windows 11（Windows 10 1809 或以上都用得）。你可以喺 GitHub Releases 直接攞現成版本，或者自己 clone 落嚟編譯。每次 push 同手動 dispatch 都會先跑測試；成功後只發佈一個 `v1.1.x` release。`main` 係穩定 Latest，其他 branch 係 prerelease，兩者都有安裝程式同免安裝 zip。

> **Safety · 安全** — WinForge writes **real** Windows settings (registry, power, network, privacy, cleanup). Most modules run fine as a standard user, but a number of tweaks need **administrator rights** and some need a **restart / sign-out** to take effect. The build steps below are safe; the *running* of certain tweaks is where elevation matters. See [FAQ-and-Safety](app-doc://article/winforge.wiki.677bfeab3d50421e).

---

## System requirements · 系統需求

| Requirement · 需求 | Detail · 細節 |
|---|---|
| **OS · 作業系統** | Windows 11 recommended. Also runs on **Windows 10 1809+** — the project's `TargetPlatformMinVersion` is `10.0.17763.0` (Windows 10 1809). |
| **Architecture · 架構** | The project declares `x86`, `x64` and `ARM64` platforms. Official releases ship **x64** (self-contained). |
| **.NET SDK · .NET SDK** | The repo targets `net11.0-windows10.0.26100.0`, so you need the matching **.NET 11 SDK** to build from source (CI uses `dotnet-version: '11.0.x'`). |
| **Windows App SDK · Windows App SDK** | Used at version **2.2.0**. You do **not** need to install a Windows App SDK runtime separately — the build is **self-contained** (see below). |
| **Visual Studio (optional)** | **Visual Studio 2022** with the *.NET Desktop Development* and *Windows App SDK* workloads, if you prefer an IDE over the CLI. |
| **Inno Setup (CI only)** | Only needed if you want to build the installer locally; CI installs it via `choco install innosetup`. |

> **Self-contained · 自包含** — The project sets `WindowsAppSDKSelfContained=true` and `WindowsPackageType=None`. That means the published `WinForge.exe` carries its own Windows App SDK runtime, so the standalone exe (and the scheduled-task launcher that runs it) works **without a separately installed runtime**. published `exe` 自己帶埋 runtime，唔使另外裝。

---

## Option A — Download a release · 下載發佈版本

The fastest path. Every successful release workflow run produces one uniquely tagged GitHub Release with two installable assets. Releases from `main` are stable and become **Latest**; releases from non-main branches are marked **prerelease**.

最快方法係直接下載 release。每次 workflow 全部測試成功後只會建立一個獨立 tag 嘅 GitHub Release；`main` 係穩定 **Latest**，其他 branch 會標示做 **prerelease**。

| Asset · 檔案 | What it is · 係乜 |
|---|---|
| **`WinForge-Setup.exe`** | The Inno Setup **installer** · 安裝程式 (Start-menu + optional desktop shortcut, proper uninstaller). |
| **`WinForge-portable-x64-<ver>.zip`** | The **portable** build · 免安裝可攜版 — unzip anywhere and run `WinForge.exe`. |

Releases are versioned `v1.1.<run_number>` (the GitHub Actions run number), e.g. `v1.1.137`.

### Install with the setup wizard · 用安裝精靈

1. Download `WinForge-Setup.exe` from the [Releases](https://github.com/codingmachineedge/WinForge/releases) page.
2. Run it. It installs into `{autopf}\WinForge` (Program Files), creates a Start-menu group, and offers a **desktop shortcut · 桌面捷徑** task.
3. The final page can **Launch WinForge · 啟動 WinForge** for you.

The installer is built `lzma2/max` + solid compression, `x64compatible` only, and registers a clean uninstaller (`UninstallDisplayIcon` points at `WinForge.exe`).

### Run the portable zip · 用免安裝版

```powershell
# Unzip and run — no install, no admin needed for the app itself
Expand-Archive .\WinForge-portable-x64-1.1.137.zip -DestinationPath "$HOME\WinForge"
& "$HOME\WinForge\WinForge.exe"
```

Because the build is self-contained, the portable folder is fully standalone — copy it to a USB stick and it still runs.

---

## Option B — Build from source · 由原始碼編譯

### 1. Clone · 複製

```powershell
git clone https://github.com/codingmachineedge/WinForge.git
cd WinForge
```

> The repo registers ~40 upstream projects as **git submodules under `external/`**. They are vendored references only and are **excluded from the build** (`DefaultItemExcludes` adds `external\**`), so you do **not** need to run `git submodule update` just to build WinForge. Skipping submodules keeps the clone small and the build green.

### 2. Build & run with the .NET CLI · 用 .NET CLI 編譯同執行

```powershell
# Restore + build the whole solution — app + launcher (Release, x64) · 還原同編譯成個方案
dotnet build WinForge.sln -c Release -p:Platform=x64

# Run the app · 執行
dotnet run --project WinForge.csproj -c Release -p:Platform=x64
```

`-p:Platform=x64` matters — the project defines `x86;x64;ARM64`, and the publish profile / runtime identifier are derived from `$(Platform)`. Building for x64 keeps you aligned with the official releases.

### Independent C++/WinRT experiment · 獨立 C++/WinRT 實驗

The experimental native rewrite no longer builds from this repository. Its source, dependency setup, build commands, parity ledger, tests, screenshots, and releases are maintained in [codingmachineedge/WinForge-Native](https://github.com/codingmachineedge/WinForge-Native). See [Native-Cpp-Rewrite](app-doc://article/winforge.wiki.5cf2a9b848d69011) for the relocation links; the instructions on this page apply only to the canonical .NET application.

實驗性原生重寫已經唔再由呢個 repo 建置。source、相依設定、build 指令、對等清單、測試、截圖同 releases 全部由 [codingmachineedge/WinForge-Native](https://github.com/codingmachineedge/WinForge-Native) 維護。搬遷連結請睇 [Native-Cpp-Rewrite](app-doc://article/winforge.wiki.5cf2a9b848d69011)；本頁其他指引只適用於正式 .NET app。

> **The solution · 方案** — `WinForge.sln` contains **two** projects: **`WinForge`** (the app) and **`WinForgeLauncher`** (under `launcher/`), a tiny non-WinUI supervisor that relaunches `WinForge.exe` if it fail-fasts at startup. The launcher is a **self-contained, single-file, AnyCPU** exe (TFM `net11.0-windows`), so `dotnet build WinForge.sln -p:Platform=x64` pairs an AnyCPU launcher with the x64 app. `dotnet build WinForge.sln` — **or plain `dotnet build` from the repo root, which now resolves the solution** — builds **both** projects; use **`dotnet build WinForge.csproj`** to build just the app. `WinForge.sln` 包住兩個專案：app 同埋啟動器。See [Architecture](app-doc://article/winforge.wiki.ee350d8983cecfa1) and [FAQ-and-Safety](app-doc://article/winforge.wiki.677bfeab3d50421e).

> **Note · 注意** — The project pulls in `Microsoft.Windows.SDK.BuildTools.WinApp`, which hooks `dotnet run` so a packaged-style WinUI app launches correctly (it registers a debug identity and starts the app with package identity). This is why `dotnet run` works directly rather than needing a manual launch of the built exe.

### 3. Open in Visual Studio 2022 · 喺 Visual Studio 2022 打開

Open **`WinForge.sln`** in Visual Studio 2022 (with the *.NET Desktop* and *Windows App SDK* workloads installed), select the **x64** configuration, and press **F5**. Opening `WinForge.csproj` on its own works too — the solution just also includes the `WinForgeLauncher` project.

粵語 — 喺 Visual Studio 2022 打開 `WinForge.sln`，揀 **x64**，撳 **F5** 就得（淨係打開 `WinForge.csproj` 都得，個方案只係多咗啟動器專案）。

### 4. Produce a self-contained publish manually · 手動發佈自包含版本

To reproduce what CI ships:

```powershell
dotnet publish WinForge.csproj `
  -c Release -p:Platform=x64 -r win-x64 --self-contained true `
  -p:WindowsAppSDKSelfContained=true `
  -p:WindowsPackageType=None `
  -p:PublishTrimmed=false `
  -p:PublishReadyToRun=false
```

The output lands under `bin\x64\Release\net11.0-windows10.0.26100.0\win-x64\publish`. Everything in that folder is the portable app.

> **Trimming & ReadyToRun · 裁剪同 ReadyToRun** — The csproj sets **`PublishTrimmed=false`** *and* **`PublishReadyToRun=false`**, and CI publishes with both **off**. Both are known startup-fail-fast risk surfaces for a reflection-heavy WinUI 3 + CsWinRT + WMI app: trimming can strip WinRT activation factories and reflected code, and R2R native-init can fail-fast on a runtime-version mismatch. Keep both off for the artifacts you ship. 兩者都要關閉。

---

## The release pipeline · 發佈流程 (GitHub Actions)

The workflow `.github/workflows/release.yml` (**Build & Release · 建置同發佈**) runs on **every push** and on manual `workflow_dispatch`. It tests before publishing and creates exactly one unique `v1.1.<run_number>` release only after every gate succeeds. A `main` run creates a stable release and marks it **Latest**; a non-main run creates a **prerelease**. It runs on `windows-latest` with `contents: write` permission. Steps, in order:

呢個 workflow 會喺**每次 push** 同手動 `workflow_dispatch` 執行，所有測試閘門通過之後先建立唯一 `v1.1.<run_number>` release。`main` run 係穩定版並成為 **Latest**；非 `main` run 係 **prerelease**。測試失敗唔會建立 release。

| # | Step · 步驟 | What it does · 做乜 |
|---|---|---|
| 1 | **Checkout** | `actions/checkout@v4`. |
| 2 | **Set up .NET 8 + .NET 11 preview** | Installs the SDKs needed by the managed app and its test harnesses. |
| 3 | **Restore and test** | Restores the solution, enforces the XAML safety contract, and runs all managed test projects before any artifact is published. A failed gate creates no release. |
| 4 | **Build managed executables** | Builds the canonical app together with `WinForgeLauncher` and `WinForgeUpdater`. |
| 5 | **Publish self-contained x64** | Publishes Release `win-x64`, self-contained, with **trimming OFF** and **ReadyToRun OFF** (both are WinUI 3 + CsWinRT startup-fail-fast risk surfaces). |
| 6 | **Portable zip** | Packages the publish output as `WinForge-portable-x64-1.1.<run_number>.zip`. |
| 7 | **Build Inno Setup installer** | Compiles `installer\WinForge.iss` with the run-specific version and publish path, producing `WinForge-Setup.exe`. |
| 8 | **Create and verify one release** | Publishes `v1.1.<run_number>` with `WinForge-Setup.exe` plus the portable zip, assigns the stable/prerelease channel from the source branch, and verifies the tag, channel, assets, and Latest state. |

Concurrency is grouped per ref with `cancel-in-progress: false`, so releases queue rather than cancel each other. Each successful run produces a **brand-new, non-draft release**—there is no manual tag reuse. Failed tests produce no release.

---

## The Inno Setup installer · Inno Setup 安裝程式

`installer\WinForge.iss` is the installer script. Key facts:

- **App name / publisher** — `WinForge`, fixed `AppId` GUID, modern wizard style (`WizardStyle=modern`).
- **Install dir** — `{autopf}\WinForge` (Program Files), with `DisableProgramGroupPage=yes`.
- **Architecture** — `x64compatible` only (`ArchitecturesAllowed` / `ArchitecturesInstallIn64BitMode`).
- **Files** — copies the entire self-contained publish folder (`{#MyPublishDir}\*`) recursively into `{app}`.
- **Shortcuts** — a Start-menu `WinForge`, an uninstall entry, and an **optional desktop icon** (`Tasks: desktopicon`, *Create a desktop shortcut · 建立桌面捷徑*). The Start-menu and desktop shortcuts point at **`WinForgeLauncher.exe`** (with `WinForge.exe`'s icon), so installed launches go through the supervisor; the uninstaller's `UninstallDisplayIcon` still points at `WinForge.exe`.
- **Post-install** — offers to **Launch WinForge · 啟動 WinForge** (also via `WinForgeLauncher.exe`).
- **Compression** — `lzma2/max`, `SolidCompression=yes`.

To build it locally (after a publish):

```powershell
$ver = "1.1.0-local"
$pub = "bin\x64\Release\net11.0-windows10.0.26100.0\win-x64\publish"
& "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" "/DMyAppVersion=$ver" "/DMyPublishDir=$pub" "installer\WinForge.iss"
# Output: installer\out\WinForge-Setup.exe
```

---

## Running as administrator · 以管理員身分運行

Some tweaks (UAC, firewall, restore points, DISM/SFC, etc.) need elevation. The app manifest (`app.manifest`) does **not** force elevation — WinForge launches as a normal user and only asks for admin when a tweak requires it. The **Power Tools · 進階工具** / **Launcher** module surfaces your current state:

- **Elevation status · 提權狀態** (`launcher.status`) — reports *Elevated · 已提權* or *Standard user · 標準使用者* for the current instance (via `AdminHelper.IsElevated`).

### The no-UAC elevated launcher · 免 UAC 提權啟動器

WinForge ships a clever launcher that lets you start the suite **elevated with no UAC prompt**, defined in `Catalog/LauncherTweaks.cs`. It works by registering a Task Scheduler task at **highest privileges** plus a shortcut that triggers it — creating the task needs admin **once**, after which the shortcut never prompts again.

| Operation · 操作 | ID | What it does · 做乜 |
|---|---|---|
| **Create no-UAC elevated launcher · 建立免 UAC 提權啟動器** | `launcher.create` | Registers a `WinForgeSuiteElevated` scheduled task (`RunLevel Highest`, interactive logon) and creates a **`WinForge (Admin)`** shortcut on the Desktop and in the Start menu. *Requires admin once.* |
| **Run WinForge elevated now · 立即以管理員運行** | `launcher.run-now` | `schtasks.exe /run /tn WinForgeSuiteElevated` — starts a fresh elevated instance, no UAC. |
| **Remove the elevated launcher · 移除提權啟動器** | `launcher.remove` | Unregisters the task and deletes both shortcuts. *Destructive.* |
| **Open Task Scheduler · 開啟工作排程器** | `launcher.open-scheduler` | Opens `taskschd.msc` to inspect the task. |
| **Elevation status · 提權狀態** | `launcher.status` | Shows whether this instance is elevated. |

> **Safety · 安全** — Creating a highest-privilege scheduled task that runs without a UAC prompt is a real elevation-of-privilege convenience. Only set it up on a machine you control, and remove it (`launcher.remove`) if you no longer want a no-prompt admin shortcut sitting on your Desktop.

---

## Kiosk full-screen & the system tray · 全螢幕與系統匣

WinForge behaves like a kiosk-style control centre (`MainWindow.xaml.cs`):

- **Windowed by default · 預設視窗模式** — opens centred at roughly **82% × 86%** of the work area.
- **Full screen · 全螢幕** — press **F11** to toggle full-screen (kiosk) mode. The choice is **remembered** in settings (`fullscreen` key) and re-applied on next launch via `AppWindowPresenterKind.FullScreen`.
- **Runs in the background · 背景運行** — closing the window does **not** quit; it **hides to the system tray**. Background services (clipboard monitor, global hotkey pump) keep running. Use the tray menu to **Show** the window again or to truly **Quit**.
- **Tray icon · 系統匣圖示** — installed at startup with the label *WinForge · 視窗調校*.

---

## Command-line flags · 命令列旗標

Parsed in `App.xaml.cs` (`ParseArgs`). Two are standalone switches; two take the next token as a value.

| Flag · 旗標 | Type · 類型 | Effect · 作用 |
|---|---|---|
| **`--page <id>`** | value | Sets the **start page**. Navigates straight to a module on launch (e.g. `--page git`, `--page ai`, `--page cloudflare`, `--page regedit`, `--page services`, `--page tasks`). Also supports `--page search:<query>` to open the search results page for a query. |
| **`--minimized`** | switch | Starts **hidden in the tray** (background services still run). This is exactly what the login-startup entry uses. |
| **`--snapshot`** | switch | **Headless.** Takes one config snapshot (`ConfigBackupService.TakeSnapshot("scheduled")`) then exits. Used by the daily scheduled backup. |
| **`--export-docs <dir>`** | value | **Headless.** Exports per-feature Markdown docs to `<dir>` via `DocsExporter.Export`, writes `_export_count.txt`, then exits. |

### Examples · 例子

```powershell
# Jump straight to the Git & GitHub module
& .\WinForge.exe --page git

# Open the search page for a query
& .\WinForge.exe --page "search:dns"

# Start hidden in the tray (what login-startup uses)
& .\WinForge.exe --minimized

# Headless: take a config snapshot and exit
& .\WinForge.exe --snapshot

# Headless: export all feature docs to a folder and exit
& .\WinForge.exe --export-docs "C:\temp\winforge-docs"
```

### Run on startup · 開機自啟動

The **Startup** integration (`Services/StartupManager.cs`) registers WinForge under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, with the command line set to:

```
"<path>\WinForge.exe" --minimized
```

So at login WinForge launches straight into the tray, ready in the background, without stealing focus. 開機之後 WinForge 會靜靜哋坐喺系統匣，唔會搶 focus。

---

## Troubleshooting · 疑難排解

| Symptom · 徵狀 | Fix · 解決 |
|---|---|
| `dotnet build` can't find the SDK / wrong TFM | Install the **.NET 11 SDK** — the project targets `net11.0-windows10.0.26100.0`. |
| Build picks the wrong architecture | Always pass `-p:Platform=x64` (the project also defines `x86` and `ARM64`). |
| App won't launch after publish | Make sure you published **self-contained** (`--self-contained true -p:WindowsAppSDKSelfContained=true`); a framework-dependent build needs a runtime you may not have. |
| App opens then closes instantly (exit `0xC000027B`) | A WinUI startup fail-fast (a *stowed exception*) — usually a **type that failed to load** during XAML type-table init, before any window. Open `%LOCALAPPDATA%\WinForge\crash.log` and look for a `FirstChance:` loader entry naming the type ([`Services/StartupDiagnostics.cs`](https://github.com/codingmachineedge/WinForge/blob/main/Services/StartupDiagnostics.cs) records it before `Main` runs). Build the **whole solution** so `WinForgeLauncher.exe` is present — releases run the app through it and it auto-retries an early `0xC000027B`. See [FAQ-and-Safety](app-doc://article/winforge.wiki.677bfeab3d50421e). |
| Trimmed build behaves oddly | Publish with `-p:PublishTrimmed=false` (CI does this for releases). |
| Submodules failing on clone | They're not needed — `external/**` is excluded from the build; skip `git submodule update`. |
| A tweak does nothing | It likely needs **admin** or a **restart / sign-out** — check the card's badge, or use the no-UAC launcher above. |

---

## Where to go next · 跟住睇邊度

- [Architecture](app-doc://article/winforge.wiki.ee350d8983cecfa1) — how the managed `TweakDefinition` → `ControlRowList` → catalog pipeline is wired.
- [Native-Cpp-Rewrite](app-doc://article/winforge.wiki.5cf2a9b848d69011) — relocation links for the independent C++/WinRT experiment.
- [Navigation-and-Search](app-doc://article/winforge.wiki.a9693f2a72e1b458) — modules, the category menu, master search, and the `--page` deep links.
- [FAQ-and-Safety](app-doc://article/winforge.wiki.677bfeab3d50421e) — what needs admin, what needs a restart, and how to undo things.

---

_Part of [Home](app-doc://article/winforge.wiki.355883cf07556dda) · WinForge wiki._
