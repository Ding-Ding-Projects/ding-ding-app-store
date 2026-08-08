# Developer, Terminal, WSL & Browser · 開發、終端、WSL 與瀏覽器

WinForge bundles a full developer cockpit for Windows 11: an in-app **WSL & VM launcher** that wraps `wsl.exe` and `WindowsSandbox.exe`, a 100-operation **Developer & Terminal** catalog category (winget, Docker, language runtimes, env/ports, CLIs), and a 100-operation **Browser Control** category covering Chrome, Edge, enterprise policies, profiles and web tools. Every entry runs a real command or writes a real registry policy — nothing here is a mock-up.

呢一頁覆蓋 WinForge 嘅開發者工具：app 內嘅 WSL／VM 啟動器、Developer & Terminal 類別（winget／Docker／執行階段／環境變數／CLI），同 Browser Control 類別（Chrome／Edge／政策／設定檔）。所有操作都係真正執行 `wsl.exe`、`docker`、`winget` 或者寫入登錄檔政策。

*Image omitted from the offline bundle: WinForge WSL & VM launcher with installed distros and the Windows Sandbox builder.*

> **Safety · 安全** — This page covers admin-elevated and destructive actions: `wsl --unregister` permanently deletes a distro, `docker system prune` / `volume prune` delete data, the cache-clear / cookie-clear operations remove files, and all browser **policy** toggles write to `HKLM\SOFTWARE\Policies\...` (requires administrator). Export a backup before unregistering a distro, and read the per-operation note before applying anything marked destructive.

---

## 1 · WSL & VM Launcher · WSL 與 VM 啟動器

The **WslVmModule** page is a standalone control centre (not a redirect to a `.cpl`). It detects which engines are present, manages installed WSL distributions, installs new ones from the online catalog, and generates a Windows Sandbox `.wsb` configuration that it launches for you.

Source: `Pages/WslVmModule.xaml.cs`, `Services/WslVmService.cs`. Every WSL call is wrapped with `$env:WSL_UTF8=1` so that `wsl.exe`'s UTF-16LE output is captured cleanly.

### 1.1 · Engine detection · 引擎偵測

On load the page calls `CheckEngines()` and shows an **InfoBar** with an action button whenever a prerequisite is missing:

| Engine · 引擎 | Detection | If missing, the action button runs |
|---|---|---|
| **WSL** | `WslVmService.IsWslAvailable()` runs `wsl --status` (falls back to `wsl --version`) | `wsl.exe --install --no-distribution` (a restart may be required) |
| **Windows Sandbox** | `IsSandboxAvailable()` checks for `WindowsSandbox.exe` in `System32` / Windows dir | `dism.exe /Online /Enable-Feature /FeatureName:Containers-DisposableClientVM /All /NoRestart` (elevated; reboot to finish) |

The Sandbox **Launch Sandbox** button stays disabled until `WindowsSandbox.exe` is found, and the InfoBar reminds you it is only available on Windows **Pro / Enterprise / Education**.

### 1.2 · Managing installed distributions · 管理已安裝發行版

`ListDistros()` parses `wsl --list --verbose` into rows, each carrying **Name · State · WSL version**, with the default distro marked by a ★. The list refreshes after every action. Per-distro actions (exposed via a flyout / `Tag`-based handlers) wrap these real commands:

| Action · 動作 | Wrapped command | Notes |
|---|---|---|
| **Launch terminal · 開終端機** | `wsl.exe -d "<name>"` | Opens its own console window via `UseShellExecute` |
| **Set default · 設為預設** | `wsl.exe --set-default "<name>"` | Marks the ★ default |
| **Terminate · 終止** | `wsl.exe --terminate "<name>"` | Stops one running distro |
| **Export · 匯出** | `wsl.exe --export "<name>" "<tar>"` | Save-file dialog, suggests `<name>-backup.tar` |
| **Unregister · 移除** | `wsl.exe --unregister "<name>"` | **Destructive** — confirmation dialog warns the delete cannot be undone |

A top-level **Shut down WSL (free RAM) · 關閉 WSL（釋放記憶體）** button runs `wsl --shutdown` to stop every distro and release the WSL2 VM's memory.

### 1.3 · Installing & importing · 安裝同匯入

- **Install a new distribution · 安裝新發行版** — `ListOnline()` parses `wsl --list --online` into a dropdown (`FriendlyName (Name)`). The **Install** button runs `wsl.exe --install -d "<name>" --no-launch`.
- **Import from .tar… · 從 .tar 匯入…** — a three-step flow: pick the `.tar` backup, pick a target install directory, then name the distro in a dialog. Runs `wsl.exe --import "<name>" "<dir>" "<tar>"`. Pairs perfectly with **Export** for moving a distro between machines.

> All distro names are quoted and stripped of embedded `"` (`Quote()` in `WslVmService`) before being passed to `wsl.exe`.

### 1.4 · Windows Sandbox builder · Windows 沙盒產生器

The page builds a `.wsb` XML via `WslVmService.BuildWsbXml(...)` from the controls you set, then either previews it, saves it, or launches it:

*Image omitted from the offline bundle: Developer & Terminal category with winget, Docker and runtime operations.*

| Control · 控制項 | `.wsb` element | Off / unset value |
|---|---|---|
| **Mapped folder · 對應資料夾** (+ **Read-only · 唯讀**) | `<MappedFolders><MappedFolder><HostFolder>…</HostFolder><ReadOnly>true/false</ReadOnly>` | omitted if blank |
| **Networking · 網絡** | `<Networking>Default</Networking>` | `Disable` |
| **vGPU** | `<vGPU>Enable</vGPU>` | `Disable` |
| **Clipboard · 剪貼簿** | `<ClipboardRedirection>Default</ClipboardRedirection>` | `Disable` |
| **Logon command · 登入指令** (optional) | `<LogonCommand><Command>…</Command></LogonCommand>` | omitted if blank |

Three buttons:

- **Preview .wsb · 預覽 .wsb** — renders the generated XML inline so you can read it before running.
- **Save .wsb… · 儲存 .wsb…** — writes a `winforge-sandbox.wsb` you can keep and reuse.
- **Launch Sandbox · 啟動沙盒** — writes a timestamped `winforge-<date>.wsb` to `%TEMP%` and starts `WindowsSandbox.exe` with it.

Host folder paths and the logon command are XML-escaped (`Esc()`) so `&`, `<`, `>`, `"` cannot break the config.

---

## 2 · Developer & Terminal category · 開發與終端類別

The catalog category **Developer & Terminal** (`Catalog/DevTerminalTweaks.cs`) holds **100 operations** across five sub-groups of 20. Each is a `TweakDefinition` rendered as a `TweakCard` with a bilingual title, description and run button. Operations are typed: `Tweak.Cmd` (cmd shell), `Tweak.Powershell` (PowerShell), and `Tweak.Shell` (launch an exe / shell verb). Anything that changes state is flagged `requiresAdmin` or `destructive`.

### 2.1 · winget — package management · 套件管理 (20)

A near-complete front-end for the Windows Package Manager. All search/show/list calls pass `--accept-source-agreements`; installs add `--accept-package-agreements`.

| Operation · 操作 | Command |
|---|---|
| **Search a package · 搜尋套件** | `winget search 7zip` |
| **Install by ID · 按 ID 安裝** | `winget install --id 7zip.7zip --exact` |
| **Upgrade all apps · 更新所有應用程式** *(admin)* | `winget upgrade --all --include-unknown` |
| **List installed · 列出已安裝** | `winget list` |
| **List upgradable · 列出可更新** | `winget upgrade --include-unknown` |
| **Export installed list · 匯出已安裝清單** | `winget export --output …\Desktop\winget-packages.json` |
| **Import package list · 匯入套件清單** *(admin)* | `winget import --import-file …\winget-packages.json --ignore-unavailable` |
| **Uninstall a package · 解除安裝套件** *(destructive)* | `winget uninstall --id 7zip.7zip --exact` |
| **Show package info · 顯示套件資料** | `winget show --id Microsoft.PowerToys` |
| **List / Update sources · 列出／更新來源** | `winget source list` · `winget source update` |
| **Pin / List pins · 釘選／列出釘選** | `winget pin add --id …` · `winget pin list` |
| **Check winget version · 檢查版本** | `winget --version` |
| **Repair a package · 修復套件** *(admin)* | `winget repair --id Microsoft.PowerToys` |
| **Validate a manifest · 驗證資訊清單** | `winget validate --manifest …\manifest.yaml` |
| **Download only · 只下載** | `winget download --id … --download-directory …\Desktop` |
| **Search by tag · 按標籤搜尋** | `winget search --tag editor` |
| **Show package versions · 顯示套件版本** | `winget show --id … --versions` |
| **Show configuration · 顯示組態** | `winget configure show --file …\configuration.dsc.yaml` |

The **Export → Import** pair is a practical way to migrate an app set to a new machine. See also [Module-Git-and-GitHub](app-doc://article/winforge.wiki.601ce19fadb2bf7e) for Git-side migration.

### 2.2 · Docker — engine, containers, cleanup · 引擎與容器 (20)

Read-only inspection plus the standard pruning suite. Pruning operations are flagged **destructive**.

| Operation · 操作 | Command |
|---|---|
| **List running / all containers** | `docker ps` · `docker ps -a` |
| **List images / volumes / networks** | `docker images` · `docker volume ls` · `docker network ls` |
| **Disk usage · 磁碟用量** | `docker system df` |
| **Container stats · 容器統計** | `docker stats --no-stream` |
| **Docker version / info** | `docker version` · `docker info` |
| **Compose services · Compose 服務** | `docker compose ps` |
| **List contexts · 列出 context** | `docker context ls` |
| **Prune system** *(destructive)* | `docker system prune -f` |
| **Prune containers / images / volumes / build cache** *(destructive)* | `docker container prune -f` · `docker image prune -f` · `docker volume prune -f` · `docker builder prune -f` |
| **Restart Docker Desktop · 重啟** *(destructive, PowerShell)* | Stops `Docker Desktop` then relaunches `Docker Desktop.exe` to recover a hung engine |
| **Logs / top / history help** | `docker logs --help` · `docker top --help` · `docker history --help` (usage hints; pass a container/image yourself) |

### 2.3 · Language runtimes · 程式語言執行階段 (20)

Version and inventory checks across the common toolchains — handy for confirming what is actually on `PATH`:

- **Node / npm · Node.js 版本** — `node --version`, `npm --version`, `npm list -g --depth=0`, `npm outdated -g`, `npm cache verify`, **Clear npm cache** `npm cache clean --force` *(destructive)*.
- **Python · Python 版本** — `python --version`, `pip --version`, `pip list`, `pip list --outdated`, `py -0` (list all installs via the py launcher).
- **.NET · .NET 資訊** — `dotnet --info`, `dotnet --list-sdks`, `dotnet --list-runtimes`, `dotnet nuget locals all --list`.
- **Other runtimes** — `java -version`, `go version`, `rustc --version`, `deno --version` (each reports "not found" gracefully if absent).
- **Locate node and python · 搵 node 同 python** — `where node & where python`.

### 2.4 · Environment & ports · 環境變數與端口 (20)

System and network introspection plus a few process-control utilities (PowerShell unless noted):

| Operation · 操作 | What it does |
|---|---|
| **List environment variables · 列出環境變數** | `Get-ChildItem Env:` formatted as a table |
| **Show PATH per-line · 逐行顯示 PATH** | splits `$env:Path` on `;` |
| **Refresh environment · 重新整理環境變數** | reloads machine+user `Path` into the session without rebooting |
| **List listening TCP ports · 列出監聽端口** | `Get-NetTCPConnection -State Listen` with owning process |
| **Find process by port · 用端口搵進程** | resolves the owner of TCP **8080** (editable) |
| **List active TCP connections · 已建立連線** | `Get-NetTCPConnection -State Established` + process names |
| **Top processes by CPU · 按 CPU 排名** | top 15 by CPU time with working-set MB |
| **Show system uptime · 系統運行時間** | computes uptime from `LastBootUpTime` |
| **Kill process by PID / name · 終止進程** *(destructive)* | `taskkill /PID 1234 /F` · `taskkill /IM notepad.exe /F` (edit first) |
| **Show hostname / ipconfig / whoami /all** | `hostname` · `ipconfig /all` · `whoami /all` |
| **Show current user SID · 用戶 SID** | `whoami /user` |
| **List local administrators · 本機管理員** | `net localgroup administrators` |
| **Show DNS client cache · DNS 快取** | `Get-DnsClientCache` |
| **List scheduled reboot tasks · 排程重啟** | scheduled tasks whose action runs `shutdown.exe` |
| **Open Environment Variables editor · 環境變數編輯器** | `rundll32 sysdm.cpl,EditEnvironmentVariables` |
| **Open System Properties (Advanced) · 系統內容（進階）** | `SystemPropertiesAdvanced.exe` |
| **Echo a specific env var · 顯示指定環境變數** | prints `USERPROFILE` (editable) |

### 2.5 · CLIs & developer tools · CLI 工具 (20)

Quick health-checks and launchers for the developer toolbelt:

- **AI coding CLIs** — `claude --version`, `codex --version`, `opencode --version`. (For driving the agents themselves, see [Module-AI-Agents](app-doc://article/winforge.wiki.01970ad90efb566d).)
- **GitHub / Git** — `gh --version`, `gh auth status`, `git --version`, `git config --global --list`, **List Git aliases** `git config --global --get-regexp "^alias\."`. (See [Module-Git-and-GitHub](app-doc://article/winforge.wiki.601ce19fadb2bf7e).)
- **Generate SSH key (Ed25519)** — `ssh-keygen -t ed25519 -C "%USERNAME%@%COMPUTERNAME%" -f "%USERPROFILE%\.ssh\id_ed25519"`.
- **Crypto / data utilities** (PowerShell) — **New GUID** `[guid]::NewGuid()`, **Base64 encode text**, **SHA256 of clipboard text**.
- **Launchers** — **Open VS Code here** `code "%USERPROFILE%"`, **Open Windows Terminal** `start "" wt`, **Open Git Bash** (`git-bash.exe`).
- **WSL shortcuts** — `wsl --list --verbose`, `wsl --status` (the full launcher lives in §1 above).
- **Tool versions** — `curl -sI https://example.com`, `jq --version`, `openssl version`.

---

## 3 · Browser Control category · 瀏覽器控制類別

The catalog category **Browser Control** (`Catalog/BrowserTweaks.cs`) holds **100 operations** in five sub-groups of 20: Chrome modes, Edge modes, enterprise **policies** (registry), profile management, and general web tools.

*Image omitted from the offline bundle: Browser Control category — Chrome/Edge launch modes, policies and profiles.*

### 3.1 · Chrome launch modes & internal pages · Chrome 模式 (20)

`Tweak.Shell` entries that launch `chrome` with flags or open `chrome://` pages:

| Operation · 操作 | Flag / URL |
|---|---|
| **Launch Chrome · 啟動** | `chrome` |
| **Open Incognito window · 無痕視窗** | `--incognito` |
| **Open in App mode · 應用程式模式** | `--app=https://www.google.com` |
| **Open in Kiosk mode · Kiosk** | `--kiosk https://www.google.com` |
| **New / Guest window** | `--new-window` · `--guest` |
| **Open specific profile · 指定設定檔** | `--profile-directory=Default` |
| **Launch without extensions · 停用擴充** | `--disable-extensions` |
| **Safe diagnostic mode · 安全診斷模式** | `chrome --disable-extensions --user-data-dir=%TEMP%\chrome-safe` |
| **Launch with proxy · 用代理** | `--proxy-server=127.0.0.1:8080` |
| **Launch with GPU disabled · 停 GPU** | `--disable-gpu` |
| **Experimental flags · 實驗功能** | `chrome://flags` |
| **Settings / Version** | `chrome://settings` · `chrome://version` |
| **DNS cache page · DNS 快取頁** | `chrome://net-internals/#dns` |
| **Extensions / Downloads / History** | `chrome://extensions` · `chrome://downloads` · `chrome://history` |
| **Clear data dialog · 清除資料** | `chrome://settings/clearBrowserData` |
| **Open URL in new window** | `--new-window https://www.google.com` |

### 3.2 · Edge launch modes & internal pages · Edge 模式 (20)

The same idea for `msedge.exe`:

| Operation · 操作 | Flag / URL |
|---|---|
| **Launch / InPrivate** | `msedge.exe` · `--inprivate` |
| **App mode / Kiosk** | `--app=https://example.com` · `--kiosk … --edge-kiosk-type=fullscreen` |
| **Flags / Settings / Version** | `edge://flags` · `edge://settings` · `edge://version` |
| **Clear browsing data · 清除瀏覽資料** | `edge://settings/clearBrowserData` |
| **Extensions / Favorites / Downloads** | `edge://extensions` · `edge://favorites` · `edge://downloads` |
| **Profiles & sync · 設定檔同步** | `edge://settings/profiles` |
| **IE mode settings · IE 模式** | `edge://settings/defaultBrowser` |
| **Privacy / Passwords** | `edge://settings/privacy` · `edge://settings/passwords` |
| **GPU diagnostics / Network logger** | `edge://gpu` · `edge://net-export` |
| **Startup boost setting · 啟動加速** | `edge://settings/system` |
| **Open URL in new window** | `--new-window https://www.microsoft.com` |
| **Set as default browser · 設預設** | `ms-settings:defaultapps` |

### 3.3 · Enterprise policies (registry) · 政策（登錄檔）(20)

These are the only **stateful, reversible toggles** in the browser category. Each writes a Group-Policy value under `HKLM\SOFTWARE\Policies\...` and **requires administrator**. `RegToggle` flips between on/off values; `RegChoice` offers a fixed value set.

> **Safety · 安全** — Policy values are machine-wide and survive reboots. Forcing or disabling Incognito/InPrivate, password managers or Safe Browsing changes behaviour for every user on the PC. WinForge's toggle UI lets you set the policy back to its "off"/cleared value to undo it.

**Chrome policies** — path `SOFTWARE\Policies\Google\Chrome`:

| Policy value · 政策值 | Type | Meaning |
|---|---|---|
| `HomepageLocation` | String | force homepage URL |
| `NewTabPageLocation` | String | force new-tab URL |
| `BookmarkBarEnabled` | DWord (1) | force bookmark bar on |
| `IncognitoModeAvailability` | choice | **0** Enabled / **1** Disabled / **2** Forced |
| `PasswordManagerEnabled` | 1 / 0 | built-in password manager |
| `DefaultBrowserSettingEnabled` | 1 / 0 | default-browser prompt |
| `MetricsReportingEnabled` | 0 / 1 | usage + crash telemetry |
| `BackgroundModeEnabled` | 0 / 1 | keep running after windows close |
| `SafeBrowsingEnabled` | 1 / 0 | Safe Browsing protection |
| `AutofillAddressEnabled` | 1 / 0 | address autofill |

**Edge policies** — path `SOFTWARE\Policies\Microsoft\Edge`:

| Policy value · 政策值 | Type | Meaning |
|---|---|---|
| `HomepageLocation` | String | force homepage URL |
| `InPrivateModeAvailability` | choice | **0** Enabled / **1** Disabled / **2** Forced |
| `BackgroundModeEnabled` | 0 / 1 | background running |
| `StartupBoostEnabled` | 0 / 1 | pre-launch at sign-in |
| `SmartScreenEnabled` | 1 / 0 | Defender SmartScreen |
| `HubsSidebarEnabled` | 0 / 1 | hubs sidebar |
| `EdgeShoppingAssistantEnabled` | 0 / 1 | shopping assistant |
| `PasswordManagerEnabled` | 1 / 0 | built-in password manager |
| `PersonalizationReportingEnabled` | 0 / 1 | ad/search/news personalization |
| `DefaultBrowserSettingEnabled` | 1 / 0 | default-browser prompt |

### 3.4 · Profile management · 設定檔管理 (20)

Hands-on profile, cache and bookmark tools (PowerShell unless noted). Cache / cookie / reset operations are **destructive** — close the browser first.

| Operation · 操作 | What it does |
|---|---|
| **List Chrome / Edge profiles · 列出設定檔** | enumerates profile folders under `%LOCALAPPDATA%\…\User Data` |
| **Open Chrome / Edge user data folder · 開用戶資料夾** | `explorer "%LOCALAPPDATA%\…\User Data"` |
| **Clear Chrome / Edge cache · 清除快取** *(destructive)* | deletes the Default profile `Cache` folder |
| **Clear Chrome cookies · 清除 Cookies** *(destructive)* | deletes `Default\Network\Cookies` (signs you out) |
| **Reset Chrome Default profile · 重設預設設定檔** *(destructive)* | renames `Default` to a timestamped `.bak` so Chrome rebuilds it |
| **Backup Chrome / Edge bookmarks · 備份書籤** | copies the `Bookmarks` file to your Desktop with a date stamp |
| **Show Chrome version · 顯示版本** | reads version from the registry (`BLBeacon` / Uninstall key) |
| **Chrome / Edge profile disk usage · 磁碟用量** | totals the User Data folder in MB |
| **Kill all Chrome / Edge processes · 結束程序** *(destructive)* | `taskkill /im chrome.exe /f /t` · `taskkill /im msedge.exe /f /t` |
| **List installed browsers · 列出已安裝瀏覽器** | reads `StartMenuInternet` registry keys (HKLM + HKCU) |
| **Set default browser / Open Default apps** | `ms-settings:defaultapps` |
| **Open downloads folder / Edge download folder** | opens `%USERPROFILE%\Downloads` or Edge's configured `DownloadDirectory` |

### 3.5 · Web tools · 網頁工具 (20)

General networking, IE/WinINET, and Edge-specific helpers:

- **Open URL / blank page / Chrome Web Store** — `start "" https://…`, `start "" about:blank`, `start "" https://chromewebstore.google.com/`.
- **Flush DNS cache · 清除 DNS 快取** — `ipconfig /flushdns`.
- **Open Internet Options / Reset IE-WinINET / Proxy settings** — `control inetcpl.cpl`, `control inetcpl.cpl,,6` (Advanced tab), `ms-settings:network-proxy`.
- **Open Credential Manager · 認證管理員** — `control keymgr.dll` (review stored web credentials).
- **List saved Wi-Fi profiles · 已儲存 Wi-Fi** — `netsh wlan show profiles`.
- **List installed PWAs · 列出 PWA** — filters `Get-StartApps` by `Edge|Chrome|_crx_|MSEdgeApp`.
- **Edge deep-links** — Collections (`microsoft-edge:--show-collections`), Favorites, Site permissions (`edge://settings/content`), Startup pages (`edge://settings/onStartup`).
- **DevTools / task manager / screenshot notes** — reminders that **F12** (or Ctrl+Shift+I) opens DevTools, **Shift+Esc** opens the browser task manager, and **Ctrl+Shift+S** captures a page in Edge.
- **Edge efficiency mode policy** *(registry, HKCU)* — `Software\Policies\Microsoft\Edge\EfficiencyMode = 1`; off clears the value.
- **Edge startup behavior policy** *(registry choice, HKCU)* — `RestoreOnStartup`: **5** new tab page / **1** restore last session / **4** open a set of pages.

---

## Cross-references · 相關頁面

- [Module-AI-Agents](app-doc://article/winforge.wiki.01970ad90efb566d) — the **claude / codex / opencode** CLIs surfaced here have a dedicated agents module.
- [AWS-Manager](app-doc://article/winforge.wiki.5ab3b0ef9d924be6) — the Console-style AWS account workspace, native S3 manager, resource discovery, and optional advanced AWS CLI workbench.
- [Module-Git-and-GitHub](app-doc://article/winforge.wiki.601ce19fadb2bf7e) — Git, `gh`, SSH-key and config tooling in depth.
- [Home](app-doc://article/winforge.wiki.355883cf07556dda) — the full module and catalog index.

---

_Part of [Home](app-doc://article/winforge.wiki.355883cf07556dda) · WinForge wiki._

---

## Guided tour · 逐步導覽

Each control on the live page is numbered on the screenshot below and explained in the legend — what every **button, toggle, tab, box and label** does, in English and 粵語. Captured from the running app via UI Automation. 下面每個控件都有編號，逐個解釋佢哋嘅功能同標籤意思。

*Image omitted from the offline bundle: WSL & VM Launcher — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|---------------------------|--------------------------|
| 1 | Button | App shell **Back** button — returns to the previously viewed module. Not part of this page's own logic. | "Back" = 返回上一頁。 |
| 2 | Button | App shell **Toggle Navigation** button — collapses or expands the left navigation pane. | "Toggle Navigation" = 開關側邊導覽列。 |
| 3 | Search box | Global **Search everything** box in the app shell — type to filter/jump across all modules; not specific to this page. | "Search everything · 搜尋全部" — English "search everything", 粵語「搜尋全部」(search all). |
| 4 | Button | **Refresh** (icon + label). Re-checks the WSL/Sandbox engines, re-lists installed distros, and reloads the online-distro dropdown. Runs `WslVmService.ListDistros` / `ListOnline`. | Icon-only accessible name is empty; the visible label reads "Refresh · 重新整理" (refresh / reload). |
| 5 | Button | **Shut down WSL (free RAM)** — runs `wsl --shutdown` to stop every running distro and release the WSL VM's memory. | "Shut down WSL (free RAM) · 關閉 WSL（釋放記憶體）" — stop all distros and free RAM. |
| 6 | Button | **Import from .tar…** — prompts for a `.tar` backup file, then an install folder, then a name, and imports it as a new distro (`WslVmService.Import`). | "Import from .tar… · 從 .tar 匯入…" — bring in a distro from a `.tar` archive. Ellipsis = a dialog follows. |
| 7 | Button | Per-distro **actions menu** (the "⋮" button on each row of the installed-distro list). Opens a flyout: Launch terminal · Set as default · Export (back up) · Terminate (stop) · Unregister (delete). | Icon-only (MoreVertical "⋮"), no accessible name — means "more actions for this distribution / 呢個發行版嘅更多操作". |
| 8 | Dropdown | **Online distributions** list — populated from `wsl --list --online`. Pick the distribution you want to install from here. | No label of its own; it sits under "Install a new distribution · 安裝新發行版". |
| 9 | Button | **Install** — installs the distribution selected in dropdown #8 via `WslVmService.InstallDistro` (`wsl --install -d <name>`), then refreshes the list. | "Install · 安裝" — install the chosen distro. |
| 10 | Edit | **Mapped folder** path box for Windows Sandbox — type or paste a host folder to share into the sandbox. The folder-picker button (#12) fills it in. | Placeholder "C:\path\to\share" — example path showing where to enter the folder to share (對應／分享入沙盒嘅資料夾). |
| 11 | Checkbox | **Read-only** — when ticked, the mapped folder (#10) is shared into the sandbox in read-only mode (the sandbox can't modify your files). | "Read-only · 唯讀" — read-only share. |
| 12 | Button | **Browse** (folder icon next to #10) — opens a folder picker and writes the chosen path into the mapped-folder box. | Icon-only (folder glyph), empty accessible name — means "browse for a folder / 揀資料夾". |
| 13 | Checkbox | **Networking** — toggles whether the sandbox has network access in the generated `.wsb` config. | "Networking · 網絡" — enable/disable sandbox networking. |
| 14 | Checkbox | **vGPU** — toggles virtual GPU (hardware-accelerated graphics) for the sandbox in the `.wsb` config. | "vGPU · vGPU" — virtual GPU passthrough. |
| 15 | Checkbox | **Clipboard** — toggles clipboard sharing (redirection) between host and sandbox in the `.wsb` config. | "Clipboard · 剪貼簿" — share the clipboard. |
| 16 | Edit | **Logon command** box (optional) — a command auto-run when the sandbox starts; written into the `.wsb`'s LogonCommand. | Placeholder "explorer.exe" — example logon command; section title is "Logon command (optional) · 登入指令（選填）". |
| 17 | Button | **Launch Sandbox** — builds the `.wsb` from the settings above and starts Windows Sandbox via `WindowsSandbox.exe` (`WslVmService.LaunchSandbox`). Disabled if the Sandbox feature isn't enabled. | "Launch Sandbox · 啟動沙盒" — start Windows Sandbox now. |
| 18 | Button | **Preview .wsb** — builds the `.wsb` XML and shows it in a read-only preview card without launching anything. | "Preview .wsb · 預覽 .wsb" — preview the generated `.wsb` config. |
| 19 | Button | **Save .wsb…** — builds the `.wsb` and saves it to a file you choose, so you can reuse or double-click it later. | "Save .wsb… · 儲存 .wsb…" — save the config to disk. Ellipsis = a save dialog follows. |

**How to use it · 點用** — The top card manages WSL: hit **Refresh** (#4) to detect WSL and list your installed Linux distros, pick one from the **online dropdown** (#8) and **Install** (#9) to add a new one, or use the per-row **⋮ menu** (#7) to launch a terminal, set default, export/import a backup, terminate, or delete a distro; **Shut down WSL** (#5) frees RAM when you're done. The bottom card builds a Windows Sandbox: point the **mapped-folder** box (#10, via **Browse** #12) at a host folder, tick the **Read-only / Networking / vGPU / Clipboard** options (#11, #13–15) and an optional **logon command** (#16), then **Launch Sandbox** (#17) to run it, **Preview .wsb** (#18) to inspect the generated config first, or **Save .wsb…** (#19) to keep it for later.
