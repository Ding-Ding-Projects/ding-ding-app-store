# Android Tools · Android 工具

WinForge bundles a full **in-app Android toolkit** that drives the real Google Platform Tools (`adb`, `fastboot`), Genymobile's `scrcpy`, and the Android SDK emulator — no redirecting you out to a terminal. It is split across three modules: an **ADB console** (devices, APK install, shell, logcat, screenshots, a file push/pull browser, APK backup, live logcat, and screen mirroring), a **Fastboot / Flasher** panel (bootloader unlock/lock, partition flashing, factory-zip flash, OTA sideload — every action guarded), and an **Android Emulator** controller (list, create, launch, stop, wipe, delete AVDs). All three auto-detect their engine and offer one-click installation if it is missing.

> WinForge 內置一套完整嘅 **Android 工具**：直接驅動真實嘅 `adb`、`fastboot`、`scrcpy` 同 Android SDK 模擬器 — 唔會踢你出去用 terminal。分三個模組：ADB 主控台、Fastboot／刷機面板、同 Android 模擬器控制。每個模組都會自動偵測引擎，搵唔到就一撳安裝。

*Image omitted from the offline bundle: Android (ADB) console — devices, shell, screenshot, file browser and screen mirroring.*

---

## At a glance · 一覽

| Module · 模組 | Engine wrapped · 包住嘅引擎 | Auto-install id · 自動安裝 | What it does · 功能 |
|---|---|---|---|
| **Android (ADB) · Android（ADB）** | `adb` (+ `scrcpy`) | `Google.PlatformTools` · `Genymobile.scrcpy` | Console, files, APK backup, live logcat, screen mirror |
| **Fastboot / Flasher · Fastboot／刷機** | `fastboot` (+ `adb` for sideload) | `Google.PlatformTools` | Bootloader status, unlock/lock, flash, boot-once, factory zip, OTA sideload |
| **Android Emulator · Android 模擬器** | `emulator` + `avdmanager` + `sdkmanager` | Android SDK | List / create / launch / stop / wipe / delete AVDs |

Each module wraps the **real binary** — WinForge composes the exact command line and runs it; nothing is faked. The ADB and Fastboot services route most read-only queries through PowerShell (`adb … 2>&1 | Out-String`) and mutating actions through `ShellRunner.RunCmd`.

---

## 1 · Android (ADB) console · Android（ADB）主控台

**Source:** `Pages/AndroidAdbModule.xaml.cs`, `Services/AdbService.cs`, `Services/ScrcpyService.cs`

> Enable **USB debugging** on the phone first (Developer options), then plug it in or connect wirelessly. · 手機要先開 **USB 偵錯**（開發人員選項），再插線或者無線連接。

### Engine detection & auto-install · 引擎偵測同自動安裝

On load the page runs `AdbService.IsAvailable()` (it checks for `"Android Debug Bridge"` in `adb version`). If `adb` is missing, a warning **InfoBar** appears with an **Install adb automatically · 自動安裝 adb** button that runs `PackageService.AutoInstall("Google.PlatformTools")` via winget — no restart needed. A second bar does the same for `scrcpy` (`Genymobile.scrcpy`), needed only for screen mirroring.

### Device selection & wireless connect · 揀裝置同無線連接

- `AdbService.Devices()` parses `adb devices -l`, capturing **serial**, **state**, and the `model:` tag. Each row displays as `Model · serial (state)`.
- A **Connect · 連接** button pairs over TCP/IP: type an address into the `192.168.x.x:5555` box and it runs `adb connect <ip:port>`.
- The toolbar refresh re-checks the engine and re-lists devices.

> The companion service also exposes `Disconnect` (`adb disconnect`) and `KillServer` (`adb kill-server`) for callers, plus `Uninstall` (`adb … uninstall <package>`). · 服務層仲有 `Disconnect`、`KillServer`、`Uninstall` 等。

The ADB module is organised into five tabs: **Console · 主控台**, **Files · 檔案**, **APK backup · APK 備份**, **Live logcat · 即時 logcat**, and **Screen mirror · 螢幕鏡像**.

### Console tab · 主控台分頁

| Action · 動作 | Button · 按鈕 | Underlying command · 底層指令 |
|---|---|---|
| **Install APK · 安裝 APK** | `InstallBtn` | `adb -s <serial> install -r "<apk>"` (file picker, `.apk`) |
| **Screenshot · 截圖** | `ShotBtn` | `adb shell screencap -p /sdcard/winforge_screen.png` → `adb pull` to **Pictures**, shown inline |
| **Logcat · Logcat** | `LogcatBtn` | `adb -s <serial> logcat -d -t 400` (last 400 lines, dumped) |
| **Packages · 已裝套件** | `PackagesBtn` | `adb -s <serial> shell pm list packages` |
| **Reboot · 重啟** | `RebootBtn` (split) | `adb -s <serial> reboot [bootloader\|recovery]` |
| **Run shell · 執行** | `ShellRunBtn` / Enter | `adb -s <serial> shell <command>` |

- **Reboot · 重啟** is a drop-down with three targets: **Reboot to system · 重啟入系統** (`reboot`), **Reboot to bootloader · 重啟入 bootloader** (`reboot bootloader`), and **Reboot to recovery · 重啟入 recovery** (`reboot recovery`). The bootloader target is how you hand off to the Fastboot module below.
- The **shell box** runs any ad-hoc command (placeholder hints `getprop ro.product.model`) and prints the captured output to the console pane. Press **Enter** to run.
- Screenshots are timestamped (`adb-yyyyMMdd-HHmmss.png`) and saved to **My Pictures**, then previewed in-app.

### Files tab — push / pull browser · 檔案分頁（推送／拉取）

A lightweight on-device file browser backed by `adb shell ls -1aF`:

- **Navigate · 瀏覽** — type a path into the path box (defaults to `/sdcard`) and press **Go · 前往**, double-tap a folder to descend, or use the **up** button to go to the parent. Directories are listed first, then files (sorted case-insensitively). `ls -F` type markers (`/ * @ | =`) are stripped; lines containing `Permission denied` / `No such file` are skipped.
- **Push file → · 推送檔案 →** — pick a local file and it lands at `<cwd>/<filename>` via `adb push`.
- **← Pull selected · ← 拉取所選** — copies the selected entry to your **Documents** folder via `adb pull`.
- **Delete · 刪除** — removes the selected file/folder with `adb shell rm -rf`, behind a confirmation dialog.

> **Safety · 安全** — Delete runs **`rm -rf`** on the device and is irreversible. WinForge shows a typed **Delete on device? · 喺裝置刪除？** dialog naming the exact remote path before anything is removed. · 刪除會喺裝置上跑 `rm -rf`，無法復原；WinForge 會先彈出確認對話框並顯示完整路徑。

### APK backup tab · APK 備份分頁

Pull installed apps back to a local `.apk`:

- **List installed apps · 列出已裝程式** — runs `pm list packages` (third-party only by default; tick **include system apps · 包埋系統程式** to pass no `-3` flag and list everything). Package names are sorted alphabetically.
- **Back up selected APK · 備份所選 APK** — resolves the on-device base APK path with `pm path <package>`, then `adb pull`s it to a location you choose with a save dialog. This is a clean way to archive an app's installer without root.

### Live logcat tab · 即時 logcat 分頁

A streaming, follow-mode logcat using a tracked background process (`AdbService.StartLogcatStream`):

- **Level · 等級** — choose `Verbose *:V`, `Debug *:D`, `Info *:I` (default), `Warn *:W`, or `Error *:E`.
- **Tag filter · 標籤過濾** — optional; e.g. `ActivityManager` builds a `-s <tag>:<level>` filter.
- **Start / Stop / Clear · 開始／停止／清除** — start spawns `adb -s <serial> logcat <filter>` and pipes each line live into the console; the buffer is auto-trimmed (~200 KB) so the view stays responsive. Stop kills the tracked process; the stream is also torn down automatically when you leave the page.

### Screen mirror tab (scrcpy) · 螢幕鏡像分頁

Mirror — and optionally record — the phone screen via Genymobile's `scrcpy`, launched as a tracked process so the UI can start/stop it. Options map directly to scrcpy flags (`ScrcpyOptions.BuildArgs()`):

| UI control · 控制項 | scrcpy flag · 旗標 | Notes · 備註 |
|---|---|---|
| **Resolution cap · 解像度上限** | `--max-size <px>` | `Native` (no cap) or 1920 / 1280 / 1024 / 800 px |
| **Bitrate · 位元率** | `--video-bit-rate <n>M` | 2 / 4 / 8 (default) / 12 / 16 Mbps |
| **Keep device awake · 保持裝置喚醒** | `--stay-awake` | |
| **Turn phone screen off · 鏡像時熄手機屏幕** | `--turn-screen-off` | Blank the handset while mirroring |
| **Show touches · 顯示觸控點** | `--show-touches` | |
| **Record to file… · 錄影到檔案…** | `--record "<path>"` | Save dialog, `.mp4` / `.mkv` |

- **Start mirroring · 開始鏡像** launches scrcpy with the chosen options; **Record to file… · 錄影到檔案…** does the same but also writes a video file; **Stop · 停止** kills the session. The three buttons enable/disable based on whether a session is already running. scrcpy's stdout/stderr are deliberately **not** redirected (it is long-running and chatty, and an unread pipe could deadlock it).

---

## 2 · Fastboot / Flasher · Fastboot／刷機

**Source:** `Pages/FastbootModule.xaml.cs`, `Services/FastbootService.cs`

A native, **PixelFlasher-style** workflow over `fastboot` (which ships inside Google Platform Tools alongside `adb`). It can read bootloader state, unlock/lock the bootloader, flash a `boot` partition, test a patched image with a temporary `boot`, flash a full factory zip, and sideload an OTA.

*Image omitted from the offline bundle: Fastboot / Flasher — bootloader status, unlock/lock, flash and sideload, all dry-run guarded.*

> **Safety · 安全** — **Flashing can wipe data or brick the device.** These are real `fastboot` operations. WinForge guards every mutating action **twice**: a **Dry-run · 試行** preview (default **ON**) that shows the exact command without running it, **and** a typed-keyword confirmation dialog. Always use a factory/boot image matching **your exact device model**. · 刷機可能清空資料或者整壞部機。每個會改動嘅動作都有雙重保護：預設開住嘅「試行」預覽 + 打字確認。請用啱你型號嘅 image。

### Getting into bootloader mode · 入 bootloader 模式

Put the phone in bootloader mode first — the easiest path is the ADB module's **Reboot → Reboot to bootloader · 重啟入 bootloader**. The Fastboot page's engine bar offers a one-click **Install Platform Tools automatically · 自動安裝 Platform Tools** if `fastboot` is missing. Devices are listed via `fastboot devices`, shown as `serial (mode)`.

### Bootloader status · Bootloader 狀態

**Bootloader status · Bootloader 狀態** runs a quick summary built from `fastboot getvar`:

- `product` — the device product string
- `current-slot` — the active A/B slot
- `bootloader` — the unlock state derived from `getvar unlocked` → **unlocked · 已解鎖** / **locked · 已鎖** / **unknown · 未知**

### Operations & their guards · 操作同保護

| Action · 動作 | Button · 按鈕 | Command · 指令 | Typed keyword · 確認字 |
|---|---|---|---|
| **Unlock · 解鎖** | `UnlockBtn` | `fastboot flashing unlock` | `UNLOCK` |
| **Lock · 上鎖** | `LockBtn` | `fastboot flashing lock` | `LOCK` |
| **Flash boot.img… · Flash boot.img…** | `FlashBootBtn` | `fastboot flash boot "<img>"` | `FLASH` |
| **Boot image once… · 暫時 boot 一張 image…** | `BootBtn` | `fastboot boot "<img>"` | *(none — non-destructive)* |
| **Flash factory zip… · 刷原廠 zip…** | `FactoryBtn` | `fastboot update "<zip>"` | `FLASH` |
| **Sideload OTA… · Sideload OTA…** | `SideloadBtn` | `adb sideload "<zip>"` | `SIDELOAD` |
| **Reboot to system · 重啟入系統** | `RebootBtn` | `fastboot reboot` | *(none)* |

Notes on the guard model:

- **Dry-run · 試行** (default ON) routes every mutating call through `Exec(..., dryRun: true)`, which returns `[dry-run] <exact command>` **without executing**. The dialog title becomes **Preview · 預覽** and no keyword is required — you see precisely what would run.
- When Dry-run is **off**, the confirmation dialog requires you to **type the keyword** above (`UNLOCK`, `FLASH`, etc.); a mismatch aborts with *Confirmation text did not match…*.
- **Boot image once · 暫時 boot 一張 image** is the **safe way to test a patched `boot.img`** — `fastboot boot` runs the image in RAM **without** flashing it, so it needs no typed keyword (but still previews).
- **Unlock · 解鎖** explicitly warns it **WIPES ALL DATA** and lowers device security; **Lock · 上鎖** warns it usually wipes data and can brick a device running unofficial firmware.
- **Sideload OTA · Sideload OTA** is actually an `adb sideload` operation (recovery, not fastboot) — the phone must be in **"Apply update from ADB"** (recovery sideload) mode.

All output is appended to the panel's console with a `✓` / `✗` prefix, including the dry-run command text.

---

## 3 · Android Emulator · Android 模擬器

**Source:** `Pages/EmulatorModule.xaml.cs`, `Services/EmulatorService.cs`

Control Android Virtual Devices (AVDs) straight from the SDK — list, create, launch (with optional cold-boot / wipe), stop, wipe, and delete. WinForge drives the SDK's own `emulator`, `avdmanager`, and `sdkmanager` tools; no redirect.

*Image omitted from the offline bundle: Android Emulator — list, create, launch, stop, wipe and delete AVDs.*

### SDK detection · SDK 偵測

`EmulatorService.SdkRoot()` locates the SDK from `ANDROID_SDK_ROOT`, then `ANDROID_HOME`, and finally the default `%LOCALAPPDATA%\Android\Sdk`. The engine bar (`Health()`) reports precisely what is missing:

- **Android SDK not found** → set `ANDROID_SDK_ROOT` or install the SDK command-line tools
- SDK present but **no `emulator`** → install the `emulator` package
- SDK present but **no `cmdline-tools` (avdmanager)** → install `cmdline-tools;latest`

`emulator.exe` is resolved under `emulator/`; `avdmanager.bat` and `sdkmanager.bat` are found under versioned `cmdline-tools/<ver>/bin/`.

### Managing AVDs · 管理 AVD

| Action · 動作 | Button · 按鈕 | Command · 指令 |
|---|---|---|
| **List · 列出** | (auto / refresh) | `avdmanager list avd` (parses Name / Device / Target) |
| **Create AVD… · 建立 AVD…** | `CreateBtn` | `echo no \| avdmanager create avd --name "<n>" --package "<img>" [--device "<p>"] --force` |
| **Launch · 啟動** | `LaunchBtn` | `emulator -avd "<n>" [-no-snapshot-load]` |
| **Stop · 停止** | `StopBtn` | `adb emu kill` (falls back to killing the tracked process) |
| **Wipe data · 清空資料** | `WipeBtn` | `emulator -avd "<n>" -wipe-data -no-snapshot-load` |
| **Delete · 刪除** | `DeleteBtn` | `avdmanager delete avd --name "<n>"` |

- **Create AVD · 建立 AVD** opens a dialog with three fields: **AVD name · AVD 名**, a **System image · 系統映像** drop-down populated from installed images (`sdkmanager --list_installed`, filtered to `system-images;…`), and an optional **Device profile · 裝置設定檔** (e.g. `pixel_7`). If no system images are installed, WinForge tells you to install one first, e.g. `sdkmanager "system-images;android-34;google_apis;x86_64"`.
- **Cold boot (no snapshot) · 冷開機（唔用快照）** — when ticked, **Launch** adds `-no-snapshot-load` so the AVD boots fresh instead of resuming a snapshot.
- **Launch** starts the emulator as a tracked process (hidden console). **Stop** first tries the graceful `adb emu kill` on the most recently started emulator console, then kills the tracked process if needed.
- **Wipe data · 清空資料** and **Delete · 刪除** each pop a confirmation dialog naming the AVD. Wipe erases the AVD's user data and cold-boots it fresh; Delete permanently removes the AVD and its data.

> **Safety · 安全** — **Wipe data · 清空資料** erases the AVD's user data, and **Delete · 刪除** permanently removes the AVD; both ask for confirmation first. These act only on virtual devices, not your physical phone. · 「清空資料」會抹走 AVD 資料、「刪除」會永久移除 AVD，兩者都會先確認。只影響虛擬裝置，唔關真機事。

---

## Tips & gotchas · 貼士同注意

- **USB debugging is mandatory · 一定要開 USB 偵錯** — without it `adb devices` shows nothing. Approve the *Allow USB debugging?* prompt on the phone.
- **One engine, two modules · 一個引擎兩個模組** — `adb` and `fastboot` both come from `Google.PlatformTools`; installing it from either the ADB or Fastboot engine bar enables both.
- **Wireless ADB · 無線 ADB** uses `adb connect <ip>:5555`; the device must already have TCP/IP debugging enabled.
- **scrcpy is separate · scrcpy 獨立** — screen mirroring needs `Genymobile.scrcpy`; the ADB page installs it on demand.
- **Match your image · 對準型號** — for flashing, a wrong factory/boot image is the single biggest brick risk. Keep **Dry-run** on until you have verified the exact command.

---

## Related pages · 相關頁面

- [Module-Developer-and-Terminal](app-doc://article/winforge.wiki.bee6a89cac3eca15) — other developer-facing wrappers and the in-app terminal.
- [Home](app-doc://article/winforge.wiki.355883cf07556dda) — the full WinForge module index.

---

_Part of [Home](app-doc://article/winforge.wiki.355883cf07556dda) · WinForge wiki._

---

## Guided tours · 逐步導覽

Each control on the live page is numbered on the screenshot below and explained in the legend — what every **button, toggle, tab, box and label** does, in English and 粵語. Captured from the running app via UI Automation. 下面每個控件都有編號，逐個解釋佢哋嘅功能同標籤意思。

### Android (ADB) · Android（ADB）

*Image omitted from the offline bundle: Android (ADB) — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | Goes back to the previous page in the app's navigation stack. | "Back" — return to where you came from. |
| 2 | Button | Collapses or expands the app's left navigation pane. | "Toggle Navigation" — show/hide the side menu. |
| 3 | Search box | App-wide search box for jumping to any module or setting by name. | "Search everything · 搜尋全部" — 搜尋全部 = search all. |
| 4 | Button | Appears only when adb is missing; installs Google Platform Tools automatically via winget, then re-checks and lists devices. No restart needed. | "Install adb automatically · 自動安裝 adb" — 自動安裝 = install automatically. |
| 5 | Dropdown | The device picker (`DeviceBox`). Lists every attached/connected Android device by serial; the one you pick here is the target for all actions below. Populated on load and after Connect/Refresh. | Empty label — it is the active-device selector (裝置). |
| 6 | Text box | Type a phone's IP and port for a wireless adb connection. | Placeholder "192.168.x.x:5555" — example IP:port to enter. |
| 7 | Button | Runs `adb connect <ip>` to pair over Wi-Fi, then refreshes the device list. | "Connect · 連接" — 連接 = connect. |
| 8 | Button | Refresh: re-checks that adb/scrcpy exist and re-scans for attached devices. | Icon-only refresh control — 重新整理裝置 (rescan devices). |
| 9 | Tab | Opens the Console tab — quick actions plus an `adb shell` command line and output. | "Console · 主控台" — 主控台 = console. |
| 10 | Tab | Opens the Files tab — a push/pull file browser of the device's storage. | "Files · 檔案" — 檔案 = files. |
| 11 | Tab | Opens the APK backup tab — list installed apps and save an app's APK to your PC. | "APK backup · APK 備份" — 備份 = backup. |
| 12 | Tab | Opens the Live logcat tab — a continuously streaming, filterable log view. | "Live logcat · 即時 logcat" — 即時 = live/real-time. |
| 13 | Tab | Opens the Screen mirror tab — mirror/record the phone screen via scrcpy. | "Screen mirror · 螢幕鏡像" — 螢幕鏡像 = screen mirroring. |
| 14 | Button | Opens a file picker for an `.apk`, then runs `adb install` to the selected device. | "Install APK · 安裝 APK" — 安裝 = install. |
| 15 | Button | Captures the phone screen and saves a PNG to your Pictures folder, then previews it. | "Screenshot · 截圖" — 截圖 = screenshot. |
| 16 | Button | Dumps the last ~400 lines of logcat into the console output below. | "Logcat" — Android system log (label same in both languages). |
| 17 | Button | Lists the installed package names on the device into the console output. | "Packages · 已裝套件" — 已裝套件 = installed packages. |
| 18 | Button | A split/menu button to reboot the device — to system, to bootloader, or to recovery (`adb reboot [mode]`). | "Reboot · 重啟" — 重啟 = restart; menu items 重啟入系統／bootloader／recovery. |
| 19 | Text box | The `adb shell` command line. Type a shell command and press Enter (or Run) to execute it on the device. | Placeholder "adb shell … (e.g. getprop ro.product.model)" — example shell command. |
| 20 | Button | Runs the typed shell command and shows the result in the console output. | "Run · 執行" — 執行 = run/execute. |
| 21 | Text box (read-only) | The console output area where logcat, package lists, and shell results are printed. | Empty label — it is the read-only output console. |

**How to use it · 點用** — First make sure adb is installed (button 4 appears if it is missing) and enable USB debugging on the phone; plug it in (or enter its IP at 6 and press Connect at 7 for wireless), then pick it in the device dropdown (5). Use the tab strip (9–13) to choose a task: on the Console tab, the toolbar buttons (14–18) cover the common one-shot actions, while the shell line (19–20) runs any `adb shell` command with the result shown in the output box (21). If you add or unplug a device, press Refresh (8) to rescan.

### Fastboot / Flasher · Fastboot／刷機

*Image omitted from the offline bundle: Fastboot / Flasher — annotated tour.*

> Note · 註：this annotated capture shows the WinForge home **Dashboard** with the global search and module launcher — the surface you pass through to *reach* the Fastboot / Flasher module. The numbered controls below are the app shell and the dashboard's feature browser; the Fastboot module itself opens from tile **#19** (the "Fastboot / Flasher" card). The module's own toolbar (device picker, Dry-run, Bootloader status, Unlock/Lock, Flash boot.img, Boot once, Flash factory zip, Sideload OTA, Reboot) is described in the workflow note at the end.

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---|---|---|
| 1 | Button | App-shell **Back** button — returns to the previously viewed page in WinForge's navigation history. | "Back" — go back / 返回上一頁. |
| 2 | Button | **Toggle Navigation** — collapses or expands the left navigation pane (the hamburger). Use it to widen the content area or bring the module list back. | "Toggle Navigation" — open/close the side menu / 開關側邊導覽. |
| 3 | Search box | App-shell **global search** ("Search everything"). Type any feature, tweak, or module name in English or 粵語 to jump straight to it. | "Search everything · 搜尋全部" — search across the whole app; 搜尋全部 = search everything. |
| 4 | Button | **Relaunch as admin** — appears in the dashboard's warning bar when WinForge is running as a standard (non-elevated) user. Clicking it restarts the app elevated so system-level actions (including real fastboot operations) have the rights they need. | "Relaunch as admin · 以管理員身分重新啟動" — restart with administrator privileges; 以管理員身分重新啟動 = relaunch as administrator. |
| 5 | Search box | Dashboard **"Search all features"** box — a bilingual global filter over WinForge's full catalogue of tweaks and modules. Typing here (e.g. "fastboot", "刷機", "OTA") surfaces matching tiles/features to launch. | "Search all features · 搜尋全部功能 (EN / 粵語)…" — search every feature, in English or Cantonese; 搜尋全部功能 = search all features. |
| 6–20 | Tiles (buttons) | The dashboard's **module / feature launcher grid**. Each unlabeled card is a navigable tile that opens a suite module (Git & GitHub, Archives, Media, Registry Editor, System Doctors, Services, Scheduled Tasks, Devices, Startup Apps, Batch Rename, Bulk File Ops, Duplicate Finder, Disk Analyser, Drives, App Uninstaller, … Fastboot / Flasher). Clicking a tile calls `Navigator.GoToModule` for that module. **Tile #19 is the "Fastboot / Flasher" card** (glyph 0xE7BA → `module.fastboot`) — clicking it opens *this* module. The remaining tiles open their respective modules. | Cards are icon-led with a bilingual title + one-line subtitle (e.g. "Fastboot / Flasher · Fastboot／刷機"); the empty accessible name means the label lives in the card's inner text. 點各卡入相應模組，#19 就係入呢個 Fastboot／刷機模組。 |

**How to use it · 點用** — From this dashboard, either type into the **Search all features** box (#5) or scroll the tile grid and click the **Fastboot / Flasher** card (#19) to open the module. If the admin bar shows you're a standard user, hit **Relaunch as admin** (#4) first, since real flashing needs elevation. Inside the module, the safe sequence is: put the phone in bootloader mode (ADB page → Reboot to bootloader), pick the device from the dropdown, leave **Dry-run (preview only)** checked, run **Bootloader status** to confirm the connection, then choose an action (Unlock / Lock / Flash boot.img / Boot image once / Flash factory zip / Sideload OTA). Every mutating action first shows the exact fastboot command and, once you uncheck Dry-run, additionally requires you to type a confirmation keyword (UNLOCK / LOCK / FLASH / SIDELOAD) before WinForge runs the real binary — so nothing dangerous happens by accident.

### Android Emulator · Android 模擬器

*Image omitted from the offline bundle: Android Emulator · Android 模擬器 — annotated tour.*

> Note · 註: the numbered controls in this capture are WinForge's **app shell** (title bar + navigation + global search) and the **feature‑tile grid** that fronts the module, not the Emulator page's own buttons. Once you open the page from a tile, the in‑page controls are: a **Refresh** button, an accent **Create AVD…** button, a **Cold boot (no snapshot)** checkbox, the **AVD list**, and the **Launch / Stop / Wipe data / Delete** row — these are described in *How to use it* below.

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | Title‑bar **Back** arrow. Returns to the previous page in the navigation history; shown only when there is somewhere to go back to (`NavFrame.CanGoBack`). | "Back" = 返回上一頁。 |
| 2 | Button | **Toggle Navigation** (pane / hamburger button). Collapses or expands the left navigation pane that lists all WinForge modules. | "Toggle Navigation" = 開／關左邊嘅導覽窗格（模組清單）。 |
| 3 | Search box | The shell's global **"Search everything"** box (`SearchBox`, an AutoSuggestBox with a Find icon). Type here to search across every module/feature; submitting a query jumps to the match. | "Search everything · 搜尋全部" — English "Search everything"; 粵語「搜尋全部」= search across everything. |
| 4 | Button | **Relaunch as admin**. Restarts WinForge with elevated (administrator) privileges so actions that need elevation can run. | "Relaunch as admin · 以管理員身分重新啟動" — "Relaunch as admin"; 粵語「以管理員身分重新啟動」= restart as administrator. |
| 5 | Search box | The content surface's **"Search all features"** filter box. Type an English or 粵語 term to live‑filter the feature tiles below to matching features. | "Search all features · 搜尋全部功能 (EN / 粵語)…" — "Search all features"; 粵語「搜尋全部功能」= search all features; "(EN / 粵語)" notes you may type in either language. |
| 6–17 | Tile buttons | **Feature tiles** in a 3‑column grid (rows of three). Each is a clickable card that opens a WinForge module/feature page — the Android Emulator tile among them opens this module. Names are blank to UI Automation because the label lives inside the tile's template. | Icon/card tiles with no exposed text label — each tile's purpose is "open the named feature". |
| 18–20 | Tile buttons | The shorter **bottom row of feature tiles** (same 3‑column grid, partial last row). Same behaviour as 6–17: click to open that feature's page. | Same as above — unnamed feature‑launch tiles. |

**How to use it · 點用** — Reach the page via the global search (3) or the navigation pane (toggle with 2), or by clicking the Android Emulator **feature tile** in the grid (6–20); the "Search all features" box (5) helps you find that tile fast. Once on the Emulator page, WinForge auto‑locates your Android SDK and shows a health banner — if it warns that the SDK, `emulator`, or `cmdline-tools` is missing, install those first (and use **Relaunch as admin** (4) only if an action reports it needs elevation). Then **Create AVD…** to make a virtual device, **select** it in the list, tick **Cold boot** if you want a fresh boot with no snapshot, and hit **Launch**; use **Stop** to shut a running emulator down, **Wipe data** to reset an AVD to factory state, and **Delete** to remove it permanently (both Wipe and Delete ask for confirmation first).
