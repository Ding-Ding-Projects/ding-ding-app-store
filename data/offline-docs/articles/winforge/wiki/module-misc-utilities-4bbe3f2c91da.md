# More Utilities · 更多工具

WinForge bundles a cluster of smaller, self-contained convenience tools that don't fit any one category but each do something genuinely useful — and, like everything else in the suite, each one acts on the real system rather than bouncing you out to Windows. This page covers seven of them: **OneDrive Files-On-Demand**, **Time & Unit Tools**, the **Settings & Control Panel hub**, **PowerToys Extras**, **Native Utilities**, the **App Uninstaller**, and the **Startup Apps** manager.

呢頁集合咗七個細而實用嘅工具：OneDrive 檔案隨選、時間與單位工具、設定與控制台總匯、PowerToys 額外工具、原生工具、應用程式解除安裝同開機程式管理員。每一個都係直接改真實系統 — 唔會將你彈返去 Windows 設定。

*Image omitted from the offline bundle: OneDrive Files-On-Demand control in WinForge.*

> **Safety · 安全** — Several tools here perform real, sometimes irreversible actions: dehydrating OneDrive files, uninstalling apps (deep uninstall deletes per-user data), logging off other users, unpairing Bluetooth, and forgetting Wi-Fi networks. A few entries (HKLM startup, listing inbound SMB sessions, logging off other sessions) need **administrator · 管理員** rights — WinForge tells you when it does and never silently fails.

---

## 1. OneDrive · OneDrive Files-On-Demand

In-app control over **OneDrive Files-On-Demand** — pin items to keep them always on the PC, or "free space" to make them online-only — without ever opening File Explorer or the OneDrive UI. Implemented in `OneDriveModule.xaml.cs` over `OneDriveService.cs`.

由應用程式內控制 OneDrive 檔案隨選，唔使開檔案總管或者 OneDrive 介面。

### What it does · 功能

- **Pick a folder · 揀資料夾** — On load it auto-detects your OneDrive root from the `%OneDrive%`, `%OneDriveConsumer%` or `%OneDriveCommercial%` environment variables, falling back to `%UserProfile%\OneDrive`. You can browse into subfolders (double-tap) or pick any folder with the folder picker.
- **Per-item state · 每項狀態** — Each row shows whether the item is **Always local · 永遠本機** (pinned), **Online-only · 只在雲端** (dehydrated), or plain **On-demand · 隨選**, colour-coded green / caution / neutral. State is read straight from the Cloud-Files placeholder attributes.
- **Pin (always local) · 釘選（永遠本機）** — runs `attrib +P -U` on the selection (recursive `/S /D` on folders).
- **Free space (online-only) · 釋放空間（只在雲端）** — runs `attrib +U -P` to dehydrate the selection.
- **Pause / Resume sync · 暫停／回復同步** — `OneDrive.exe /shutdown` to pause, `OneDrive.exe /background` to resume. The exe is located under `%LocalAppData%`, `%ProgramFiles%` or `%ProgramFiles(x86)%`.
- **Auto-free threshold · 自動釋放年期** — set "auto-free after N days" (0 = off). Writes the DWORD `ConfigStorageSenseCloudContentDehydrationThreshold` under `HKCU\…\StorageSense\Parameters\StoragePolicy`; 0 deletes the value.

### Placeholder attributes used · 用到嘅佔位屬性

| Attribute | Hex | Meaning |
|-----------|-----|---------|
| `FILE_ATTRIBUTE_PINNED` | `0x00080000` | +P — always-local (pinned) |
| `FILE_ATTRIBUTE_UNPINNED` | `0x00100000` | +U — online-only (dehydrated) |
| `FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS` | `0x00400000` | placeholder (content not local) |
| `FILE_ATTRIBUTE_OFFLINE` | `0x00001000` | offline / not materialised |

Bulk operations report **"X succeeded, Y failed"** so a single locked file never aborts the batch.

> **Safety · 安全** — "Free space" dehydrates files to online-only; the local copy is removed and the file must re-download on next open. Nothing is deleted from the cloud, but offline access is lost until re-pinned.

---

## 2. Time & Unit Tools · 時間與單位工具

A live world-clock board, a timezone converter and an offline unit converter, all driven purely by the OS's own time-zone data — **no network**. See `TimeUnitModule.xaml.cs`, `TimeZoneService.cs` and `UnitConvertService.cs`.

即時世界時鐘、時區換算同離線單位轉換，全部用 Windows 自己嘅時區資料，唔使上網。

*Image omitted from the offline bundle: World clock, timezone converter and unit converter.*

### World clock · 世界時鐘

- A ticking board (updates every second) of city cards, each showing display name, **UTC offset**, a `· DST · 夏令` badge when daylight saving is active, and the local time/date in `Consolas`.
- **Add city · 加城市** from any system time zone; remove a card with its × button. The top card always shows **this PC's time zone · 呢部電腦嘅時區**.
- Default board: **Honolulu, Los Angeles, New York, London, Berlin/Paris, Hong Kong/Beijing, Tokyo, Sydney** (filtered to zones the OS actually has).

### Timezone converter · 時區換算

Pick a date/time, a **From** zone and a **To** zone; the result is computed with `TimeZoneInfo.ConvertTimeBySystemTimeZoneId`, DST-aware, and shows both offsets. A **Now · 而家** button snaps the inputs to the current moment.

### Unit converter · 單位換算

Linear conversion via base-unit factors (temperature uses an explicit affine transform). Every unit is bilingual. Categories:

| Category · 分類 | Units |
|------------------|-------|
| **Length · 長度** | mm, cm, m, km, in, ft, yd, mi, nautical mile |
| **Mass / Weight · 質量／重量** | mg, g, kg, t, oz, lb, stone, **catty (斤)** |
| **Temperature · 溫度** | °C, °F, K |
| **Data size · 資料大小** | B, KB, MB, GB, TB, KiB, MiB, GiB |
| **Speed · 速度** | m/s, km/h, mph, knot, ft/s |
| **Area · 面積** | m², km², ft², acre, hectare |
| **Volume · 體積** | mL, L, m³, tsp, tbsp, cup, gallon (US), gallon (UK) |

---

## 3. Settings & Control Panel · 設定與控制台

A two-mode hub for *everything* configuration-related. From `SettingsHubModule.xaml.cs` over `SettingsHubCatalog.cs`.

設定相關嘅雙模式總匯。

*Image omitted from the offline bundle: Settings & Control Panel hub.*

### Two modes · 兩種模式

1. **Change here (in-app) · 喺度改（應用內）** — the app's own live tweak catalog, grouped into categories. Each setting is rendered with a `TweakCard` that **reads its current value before showing it**, so toggles reflect real system state. Categories are lazy-built when you expand them. A search box filters across the whole catalog (up to 300 hits).
2. **Open in Windows · 喺 Windows 打開** — a curated, searchable launcher for every common Windows settings surface that has no in-app equivalent.

### Launcher catalog · 啟動器目錄

Each entry shows its real command in `Consolas` and opens it via `Process.Start`:

| Kind · 種類 | Launch mechanism | Example command |
|-------------|------------------|-----------------|
| **Settings** | `ms-settings:` URI (shell-executed) | `ms-settings:display` |
| **ControlApplet** | `control.exe /name <CanonicalName>` | `control /name Microsoft.Personalization` |
| **Cpl** | `control.exe <file.cpl>` | `control ncpa.cpl` |

Entries are heuristically bucketed into groups — **System · 系統, Devices · 裝置, Network · 網絡, Personalization · 個人化, Apps · 應用程式, Accounts · 帳戶, Time & Language · 時間與語言, Gaming · 遊戲, Accessibility · 協助工具, Privacy & Security · 私隱與安全, Update & Recovery · 更新與復原, Control Panel · 控制台, Other · 其他**. The catalog covers the full set of modern `ms-settings:` pages plus 54 classic Control Panel applets / `.cpl` files. See also [Module-Productivity](app-doc://article/winforge.wiki.21e184ccbea5944d) for the productivity-focused modules.

---

## 4. PowerToys Extras · PowerToys 額外工具

Four native, in-app PowerToys-style utilities, no redirects. From `PowerToysExtrasModule.xaml.cs`.

四個原生、應用程式內嘅 PowerToys 式工具。

*Image omitted from the offline bundle: PowerToys Extras — image resizer, OCR, always-on-top, paste plain text.*

### Image Resizer · 圖片縮放

Bulk-resize pictures with WinRT imaging (`Windows.Graphics.Imaging`), always preserving aspect ratio.

- Add images (`.jpg .jpeg .png .bmp .gif .tif .tiff .webp`), pick an output folder (defaults to `Pictures\WinForge Resized`).
- **Size presets · 尺寸預設**: Small (854×480), Medium (1366×768), **Large (1920×1080, default)**, Phone (1080×1920), Thumbnail (256×256) — or set your own max width/height.
- **Shrink only (never enlarge) · 只縮唔放** checkbox, JPEG quality (1–100), filename suffix.
- Resizes the whole batch with a live `i/total — filename` progress line and a "X done, Y failed" summary.

### Text Extractor (OCR) · 文字擷取（OCR）

On-screen OCR via `Windows.Media.Ocr`. **Extract from screen** captures the virtual screen, recognises the text, drops it in the result box **and auto-copies it to the clipboard**. Pick an OCR language if more than one pack is installed; a hint tells you when none is found.

### Always On Top · 視窗置頂

Lists open windows; **Pin on top · 釘喺最上** flips a window to `HWND_TOPMOST` via `SetWindowPos`, with a per-row toggle (`On top ✓ · 置頂中 ✓`), a live pinned count, and **Un-pin all · 全部取消置頂**.

### Paste as Plain Text · 純文字貼上

- **Strip the clipboard now · 立即淨化剪貼簿** — replaces the current clipboard contents with their plain-text equivalent.
- **Global hotkey · 全域熱鍵 (Ctrl + Shift + V)** — a toggle that installs a low-level keyboard hook so pressing the hotkey anywhere strips the clipboard then pastes as plain text. Works app-wide while WinForge is running.

---

## 5. Native Utilities · 原生工具

A suite of in-app tools, each built straight on a documented Win32 API (System32 DLL P/Invoke) — no external tools, no redirects. From `NativeUtilitiesModule.xaml.cs` over `NativeUtilitiesService.cs`. The page is a Pivot; each tab loads on first view.

每個工具都直接建喺有文件記載嘅 Win32 API 之上。

*Image omitted from the offline bundle: Native Utilities — Wi-Fi, SMB, brightness, certificates, Bluetooth and more.*

### Tools & their APIs · 工具同 API

| Tab · 分頁 | Win32 API · Win32 API | What it shows / does |
|-----------|------------------------|----------------------|
| **Saved Wi-Fi · 已儲存 Wi-Fi** | `wlanapi` — `WlanGetProfile` with `WLAN_PROFILE_GET_PLAINTEXT_KEY` | Lists saved profiles with their **plaintext passwords**; copy a password, or **forget** a network (`WlanDeleteProfile`) |
| **Nearby Wi-Fi · 附近 Wi-Fi** | `wlanapi` — `WlanScan` + `WlanGetAvailableNetworkList` | Visible networks with SSID, signal %, auth/cipher (e.g. WPA2-PSK · CCMP), and a `saved · 已儲存` badge |
| **SMB shares · SMB 共享** | `netapi32` — `NetShareEnum` (lvl 2) + `NetSessionEnum` (lvl 10) | Published shares (name/path/type) and inbound sessions (computer, user, active/idle seconds) |
| **Brightness · 亮度** | `dxva2` + `user32` — `Get/SetMonitorBrightness` | Per-monitor brightness sliders for **DDC/CI external displays** (internal laptop panels aren't controllable) |
| **User sessions · 使用者工作階段** | `wtsapi32` — `WTSEnumerateSessions` | Logged-on users with station & state; **log off / disconnect** others (`WTSLogoffSession` / `WTSDisconnectSession`); never lets you log off yourself |
| **Certificates · 憑證** | `crypt32` — `CertOpenSystemStore` | View certs in **Personal (My) · 個人**, **Trusted Roots (Root) · 受信任根** or **Intermediate (CA) · 中繼**; subject, issuer, thumbprint, validity (expired ones flagged red) |
| **Live counters · 即時計數** | `pdh` — English counter paths | Live `\PhysicalDisk(_Total)` % busy / read / write B/s and `\GPU Engine(*)` % utilisation, updating each second with a Live/Paused toggle |
| **Process modules · 程序模組** | `psapi` — `EnumProcessModulesEx` | Pick a process; lists every loaded DLL/EXE module with path and image size (Process Explorer-style) |
| **Bluetooth · 藍牙** | `bluetoothapis` — `BluetoothFindFirstDevice` | Paired devices with connected/paired/remembered status and last-seen time; **unpair** with `BluetoothRemoveDevice` |

> **Safety · 安全** — Saved-Wi-Fi shows real passwords in clear text, so be mindful of who's watching. Logging off or disconnecting other users, and listing inbound SMB sessions, need administrator rights — WinForge says so if it can't. Unpairing Bluetooth and forgetting Wi-Fi are immediate.

---

## 6. App Uninstaller · 應用程式解除安裝

Silent, per-row removal of Store/UWP apps (bloatware) — no Settings redirect. From `AppUninstallerModule.xaml.cs` over `UninstallManager.cs`.

靜靜哋移除商店／UWP 應用程式（臃腫程式）。

*Image omitted from the offline bundle: App Uninstaller listing Store/UWP apps with sizes.*

- **Listing** via the `PackageManager` API (`FindPackagesForUser`) — rich metadata: logo, display name, publisher, version, package family name. **Frameworks and resource packages are excluded** so shared runtimes can't be removed.
- **On-disk size · 磁碟用量** is measured off the UI thread (install folder + `%LocalAppData%\Packages\<family>`) and streams into each row.
- **Filter · 篩選** by display name, package name or publisher (e.g. *Xbox, Bing, Clipchamp*).
- **Uninstall · 解除安裝** — `Remove-AppxPackage` for the current user.
- **Deep uninstall (clear leftovers) · 徹底解除安裝（清殘留）** — removes the package **then deletes** its per-user leftover data folder (`%LocalAppData%\Packages\<PackageFamilyName>`) and reports how much it freed.
- Both actions require a confirmation dialog. If a removal fails on a system app, WinForge suggests it may need administrator rights.

> **Safety · 安全** — Deep uninstall permanently deletes the app's per-user data. Apps can be reinstalled from the Microsoft Store, but their saved state/settings won't come back after a deep uninstall.

---

## 7. Startup Apps · 開機程式

An in-app replacement for Task Manager's Startup tab — list and enable/disable every login startup entry. From `StartupModule.xaml.cs` over `StartupManager.cs`.

取代工作管理員「啟動」分頁嘅應用程式內開機程式管理員。

*Image omitted from the offline bundle: Startup Apps manager.*

### What it reads · 讀取邊度

| Source · 來源 | Location | Toggle store |
|---------------|----------|--------------|
| **HKCU Run** | `HKCU\…\CurrentVersion\Run` | `StartupApproved\Run` |
| **HKLM Run** | `HKLM\…\CurrentVersion\Run` *(admin)* | `StartupApproved\Run` |
| **HKLM Run (32-bit)** | `HKLM\…\WOW6432Node\…\Run` *(admin)* | `StartupApproved\Run32` |
| **Startup folder** | per-user `Startup` folder | `StartupApproved\StartupFolder` |
| **Startup folder (all users)** | `CommonStartup` folder | `StartupApproved\StartupFolder` |

### Enable / disable · 啟用／停用

Toggling writes the Explorer **`StartupApproved`** binary blob (`byte[0]` even `0x02` = enabled, odd `0x03` = disabled) — exactly the mechanism Task Manager uses, so changes show up there too. Each row shows its command and an `Enabled · 已啟用` / `Disabled · 已停用` state.

> **Safety · 安全** — System-wide (HKLM) entries need administrator rights; toggling one without elevation raises a clear *"relaunch as administrator · 請以管理員身分重開"* message rather than failing silently. `StartupManager` also exposes WinForge's own **run-at-login** setting (HKCU Run, started `--minimized` to the tray).

---

## Related · 相關

- [Module-Productivity](app-doc://article/winforge.wiki.21e184ccbea5944d) — productivity-focused tools that complement these utilities.
- [Module-Storage-and-Files](app-doc://article/winforge.wiki.18dac8fb1f68abea) — cleanup, disk and file tooling (pairs naturally with OneDrive space-freeing and the App Uninstaller's size readout).
- [Home](app-doc://article/winforge.wiki.355883cf07556dda) — the full module index.

---

_Part of [Home](app-doc://article/winforge.wiki.355883cf07556dda) · WinForge wiki._

---

## Guided tours · 逐步導覽

Each control on the live page is numbered on the screenshot below and explained in the legend — what every **button, toggle, tab, box and label** does, in English and 粵語. Captured from the running app via UI Automation. 下面每個控件都有編號，逐個解釋佢哋嘅功能同標籤意思。

### App Uninstaller · 應用程式解除安裝

*Image omitted from the offline bundle: App Uninstaller — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | App-wide back button in the title bar — returns to the previous page / dashboard you came from. Part of the shell, not this module. | "Back" = go back / 返回上一頁. |
| 2 | Button | App-wide hamburger button that collapses or expands the left navigation pane. Shell control, shared by every module. | "Toggle Navigation" = show/hide the side menu / 開合導覽列. |
| 3 | Search box | Global shell search at the top of the window — searches across all of WinForge's modules and settings, not just this page. | "Search everything · 搜尋全部" — "Search everything" and 搜尋全部 both mean search across the whole app. |
| 4 | Filter box | This module's own filter. Type any text (app name, package name, or publisher) and the list below narrows live as you type — matching is case-insensitive against DisplayName, package Name, and Publisher. Leave blank to show every app. | Placeholder "Filter apps (e.g. Xbox, Bing, Clipchamp)…" / "篩選應用程式（例如 Xbox、Bing、Clipchamp）…" — filter the app list; the examples are common bloatware names. |
| 5 | Button | Refresh — re-scans installed Store/UWP packages and rebuilds the list (it also runs once automatically when the page loads). Use it after an uninstall or to pick up newly installed apps. | "Refresh · 重新整理" — reload / refresh the list. |
| 6–19 | Buttons (per-row) | Rows 6–19: the per-app **"Uninstall"** button on each list item. Clicking it opens a small dropdown menu with two choices: **Uninstall** (remove the app for the current user via Remove-AppxPackage) and **Deep uninstall (clear leftovers)** (also wipes the app's leftover per-user data in %LocalAppData%\Packages). Either choice first shows a confirmation dialog; nothing is removed until you confirm. Shared frameworks are hidden from the list, so you can't break them. (Row 19 is the last/partly-scrolled item button.) | Each button reads "Uninstall · 解除安裝" with a small caret (the dropdown arrow). 解除安裝 = uninstall; the menu items are "Uninstall · 解除安裝" and "Deep uninstall (clear leftovers) · 徹底解除安裝（清殘留）". |

**How to use it · 點用** — The list auto-loads when you open the page; each row shows an app's friendly name, its package id, on-disk size, and version. Type in the filter box (4) to find a specific app, then click its **Uninstall · 解除安裝** button (6–19) and pick either a plain uninstall or a deep uninstall that also clears leftover data. Confirm in the dialog and WinForge removes the app silently; if it fails because the app is a protected system app, you may be told to relaunch with administrator rights. Hit **Refresh · 重新整理** (5) anytime to re-scan — and remember anything you remove can be reinstalled from the Microsoft Store later.

### Startup Apps · 開機程式

*Image omitted from the offline bundle: Startup Apps · 開機程式 — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | Returns to the previous page in the app's navigation history. App-shell chrome, not part of this module. | "Back" — go back / 返回上一頁。 |
| 2 | Button | Collapses or expands the left navigation pane. App-shell chrome shared by every module. | "Toggle Navigation" — show/hide the side menu / 開關側邊導覽列。 |
| 3 | Search box | The global app-wide search box in the title bar; searches across all WinForge modules and settings, not just this page. | "Search everything · 搜尋全部" — search everything across the whole app / 搜尋全部。 |
| 4 | Filter box | The module's own filter. Typing here live-filters the startup list by app name or command path (`Filter_TextChanged` → `ApplyFilter`); the count updates to "shown / total apps". | "Filter startup apps…" — narrow down the startup-apps list / 篩選開機程式…。 The placeholder shows 粵語 "篩選開機程式…" when the app language is Cantonese. |
| 5 | Button | Re-reads all startup entries from the registry Run keys and Startup folders and rebuilds the list (`Refresh_Click` → `Reload`). Use after changing entries elsewhere. | "Refresh" — reload the list / 重新整理。 Shows "重新整理" in 粵語. |
| 6–28 | Buttons (Enable / Disable per row) | These are the per-item action buttons, two per startup app (left + right of each row). One enables the entry (`Enable_Click`), the other disables it (`Disable_Click`); both call `StartupManager.SetEnabled`, which flips the Windows `StartupApproved` blob so the app does or doesn't launch at boot. A success bar reports "Enabled/Disabled ''" ("已啟用/已停用「…」"); a system-wide HKLM entry fails with a prompt to relaunch as administrator (「請以管理員身分重開」). Rows 6/7 belong to the first app, 8/9 to the second, and so on down the list. | Icon-only buttons with no text label — they read as Enable (啟用) and Disable (停用) for each startup app row. Their job is inferred from the paired layout and the `Enable_Click` / `Disable_Click` handlers. |

**How to use it · 點用** — When the page opens it automatically lists every program that launches at sign-in (registry Run keys plus the Startup folders). Type in the filter box (4) to find a specific app by name or path, then use that row's pair of buttons (6–28) to enable or disable it; the toggle is applied in place without sending you to Task Manager or Settings. A green bar confirms each change, and the list refreshes itself — hit Refresh (5) if you've changed entries outside the app. If a control reports a system (HKLM) entry, close WinForge and relaunch it as administrator to edit machine-wide startup items.

### Native Utilities · 原生工具

*Image omitted from the offline bundle: Native Utilities — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | Returns to the previous page in the app's navigation stack — leaves the Native Utilities module. | "Back" / 返回 — standard back arrow in the title bar. |
| 2 | Button | Collapses or expands the app's left navigation pane to give the content more room. | "Toggle Navigation" / 切換導覽 — show/hide the side menu. |
| 3 | Search box | The app-wide search field at the top of the shell; type a feature or setting name to jump to it. | "Search everything · 搜尋全部" — search across the whole app, not just this module. |
| 4 | Button | The refresh action for the currently open tab. On the Saved Wi-Fi tab shown, it re-reads saved wireless profiles via `wlanapi` and rebuilds the list with the profile count. Each tab (Nearby Wi-Fi "Scan", SMB, Brightness, Sessions, Certificates, Bluetooth) has its own copy of this button that re-queries that tab's Windows API. | Icon + text button reading "Refresh · 重新整理" (or "Scan · 掃描" on the Nearby Wi-Fi tab) — reload this tab's data. |
| 5 | Button (per-row) | Copy action on a Saved Wi-Fi row: copies that network's stored password to the clipboard. If the profile has no key it shows "No password to copy · 冇密碼可以複製". | Icon-only copy button — "copy password · 複製密碼". |
| 6 | Button (per-row) | Delete/forget action on the same Saved Wi-Fi row: removes that wireless profile from Windows (`WlanDeleteProfile`), then refreshes the list. | Icon-only delete button — "forget network · 移除網絡". |
| 7 | Button (per-row) | Copy action on the next Saved Wi-Fi row — same as #5, applied to that row's stored password. | Icon-only copy button — "copy password · 複製密碼". |
| 8 | Button (per-row) | Delete/forget action on the next Saved Wi-Fi row — same as #6, removes that profile and refreshes. | Icon-only delete button — "forget network · 移除網絡". |

Rows 5–8 are repeated per-item actions: every Saved Wi-Fi entry carries its own copy and forget pair, so the screenshot captures two consecutive rows (copy + delete, then copy + delete).

**How to use it · 點用** — This module is a tabbed suite of in-app tools, each built directly on a documented Windows API (saved/nearby Wi-Fi, SMB shares, monitor brightness, user sessions, certificates, live disk/GPU counters, process modules, Bluetooth). Pick a tab along the top; the first time you open a tab it auto-loads its data, and you can press its Refresh/Scan button (4) any time to re-query. On the Saved Wi-Fi tab pictured here, use a row's copy button (5/7) to grab a stored password or its delete button (6/8) to forget the network — note that actions touching other users' sessions or some SMB session listings require running WinForge as administrator.

### OneDrive · OneDrive

*Image omitted from the offline bundle: OneDrive — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | App shell **Back** button — returns to the previous WinForge page. Not part of this module. | "Back" = go back / 返回上一頁。 |
| 2 | Button | App shell **hamburger** button — collapses or expands the left navigation pane. Not part of this module. | "Toggle Navigation" = show/hide the side menu / 開關側邊導覽選單。 |
| 3 | Search box | App shell global **search** box at the top of the window. Not part of this module's own controls. | "Search everything · 搜尋全部" = search across the whole app; 搜尋全部 means "search everything". |
| 4 | Button | **Pick folder** — opens a folder picker; the OneDrive folder you choose becomes the working folder and its files are listed below. On first load WinForge auto-selects your default OneDrive root. | "Pick folder…" = choose a folder; 揀資料夾… ("jaap2 zi1 liu2 gaa3") means "pick a folder". |
| 5 | Path box | Read-only **current-folder path** display. It shows the folder being managed; you cannot type into it — change folders with Pick folder (4), Up (7), or by double-clicking a folder row. | (no label — shows the active folder path) / 顯示目前資料夾路徑。 |
| 6 | Button | **Refresh** — re-reads the current folder and redraws the file list with up-to-date pin/online-only states. | "Refresh" = reload the list; 重新整理 ("cung4 san1 zing2 lei5") means "refresh / reload". |
| 7 | Button | **Up** — moves to the parent folder of the current path and lists it. Icon-only (up-arrow glyph). | (no name; tooltip "Up · 上一層") = go up one folder level; 上一層 means "the level above". |
| 8 | Button | **Pin (always local)** — downloads the selected items and keeps them permanently on this PC so they're available offline. Disabled until you select at least one row. | (label off-screen) "Pin (always local) · 釘選（永遠本機）" = pin so it always stays on this machine; 永遠本機 = "always on the local machine". |
| 9 | Button | **Free space (online-only)** — dehydrates the selected items, removing the local copy and leaving an online-only placeholder to reclaim disk space. Disabled until something is selected. | (label off-screen) "Free space (online-only) · 釋放空間（只在雲端）" = free space, keep file in the cloud only; 只在雲端 = "only in the cloud". |
| 10 | Button | **Select all** — selects every row currently shown in the list. | "Select all" = select everything; 全選 ("cyun4 syun2") means "select all". |
| 11 | Button | **Clear** — clears the current selection (deselects all rows). | "Clear" = clear the selection; 清除 ("cing1 ceoi4") means "clear". |
| 12 | Button | **Pause sync** — tells the OneDrive client to pause syncing. Icon-only here (pause glyph + label). | (label off-screen) "Pause sync · 暫停同步" = pause syncing; 暫停同步 means "pause sync". |
| 13 | Button | **Resume sync** — resumes OneDrive syncing after it was paused. Icon-only here (play glyph + label). | (label off-screen) "Resume sync · 回復同步" = resume syncing; 回復同步 means "resume/restore sync". |
| 14 | Number box | **Auto-free threshold** value — the number of days after which unused files are automatically dehydrated; 0 turns auto-free off. Edit it directly or use the spin buttons (16/17). | (no inline label; described by 15's caption) "Auto-free after (days, 0 = off) · 幾多日後自動釋放（0 = 關閉）" = how many days before auto-freeing; 0 = 關閉 means "0 = off". |
| 15 | Button | **Apply** — saves the day count in the box (14) as the auto-dehydration threshold and shows a result message. | "Apply" = apply/save the setting; 套用 ("tou3 jung6") means "apply". |
| 16 | Button | **Increase** — spinner up-arrow of the day box; bumps the threshold up by 1 (large step 7). | "Increase" = step the number up; 加大／增加 (raise the value). |
| 17 | Button | **Decrease** — spinner down-arrow of the day box; lowers the threshold by 1. Disabled at the minimum (0). | "Decrease" = step the number down; 減少 (lower the value). |

**How to use it · 點用** — Start by confirming the working folder in the path bar (5); WinForge opens your default OneDrive root, but you can use Pick folder (4) to choose another, double-click folder rows to drill in, or Up (7) to go back out. Tick one or more files/folders in the list (use Select all (10) / Clear (11) to help), then hit Pin (8) to keep them always on this PC or Free space (9) to make them online-only and reclaim disk space — the result bar reports how many succeeded. Use Pause sync (12) / Resume sync (13) to stop or restart OneDrive syncing, and set the auto-free day count with the number box (14, spin with 16/17) followed by Apply (15) to have Windows dehydrate unused files automatically; enter 0 and Apply to turn that off. Press Refresh (6) any time to re-read the folder and see updated states.

### Time & Unit Tools · 時間與單位工具

*Image omitted from the offline bundle: Time & Unit Tools — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | App chrome, not part of this module. Returns to the previous page in WinForge. | "Back" — go back / 返回上一頁。 |
| 2 | Button | App chrome. Collapses or expands the left navigation pane. | "Toggle Navigation" — show/hide the side menu / 開關側邊導覽列。 |
| 3 | Search box | App-wide search at the top of the window. Type to find any tool or setting across WinForge; not specific to this page. | "Search everything · 搜尋全部" — search across the whole app; 搜尋全部功能。 |
| 4 | Dropdown | The "Add city" picker for the World clock. Lists every time zone Windows knows (offset + display name); pick one, then press 5 to add it as a clock card. | Icon-only / no label. It is the add-city zone selector / 選城市加入世界時鐘。 |
| 5 | Button | Adds the zone currently chosen in dropdown 4 to the World clock board as a new live card. Ignores duplicates. | "Add city · 加城市" — add a city's clock / 加一個城市時鐘。 |
| 6–11 | Buttons (per-row) | The trash-can buttons on each World-clock city card (one per row, e.g. Honolulu, Anchorage, …). Clicking one removes that city from the board. Each ticks live once per second. | Icon-only (delete glyph); tooltip reads "Remove · 移除" — remove this city / 移除呢個城市。 |
| 12 | Dropdown | Timezone converter "From" zone. Choose the source zone whose time you want to convert; defaults to this PC's zone. Changing it re-runs the conversion instantly. | Icon-only; labelled by the "From · 由" caption beside it / 來源時區。 |
| 13 | Dropdown | Timezone converter "To" zone. Choose the target zone; the result line shows the From time and its equivalent To time with both UTC offsets. | Icon-only; labelled by the "To · 去" caption / 目標時區。 |
| 14 | Dropdown | Unit converter category selector. Picks the kind of quantity (e.g. length, mass, temperature). Changing it repopulates the From/To unit lists below and reconverts. | Icon-only; the "Unit converter · 單位換算" picker for the measurement type / 換算類別。 |
| 15 | Dropdown | Unit converter "From" unit. The unit you are converting out of, within the chosen category. | Icon-only; labelled by the "From · 由" caption / 來源單位。 |
| 16 | Dropdown | Unit converter "To" unit. The unit you are converting into; the result line shows your value in both units. | Icon-only; labelled by the "To · 去" caption / 目標單位。 |

**How to use it · 點用** — The top card shows this PC's own zone and a live World clock; pick a city in dropdown 4 and press "Add city" (5) to add more clocks, and use each card's trash button (6–11) to remove ones you don't need — every clock ticks once a second. To convert a time, set the When date/time, pick the source zone in 12 and the target in 13 (press "Now" to snap to the current moment), and read the converted result below. For units, choose a category in 14, then the From (15) and To (16) units, type a value, and the answer updates instantly. Everything is offline — all zones come straight from Windows' own time-zone data, with no network calls.

### Settings & Control Panel · 設定與控制台

*Image omitted from the offline bundle: Settings & Control Panel — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|-------------------------|
| 1 | Button | App-shell back button — returns to the previously visited module. Not part of this page's own logic; it's the global navigation back arrow. | "Back" = 返回上一頁。 |
| 2 | Button | App-shell hamburger — collapses or expands the left navigation pane. Global chrome, shared by every module. | "Toggle Navigation" = 開／關側邊導覽欄。 |
| 3 | Search box | Global app search ("Search everything"), the top-bar search that finds modules across all of WinForge. It is the shell search, separate from this page's own settings filter (item 5). | "Search everything · 搜尋全部" — search across the whole app; 搜尋全部 = search everything. |
| 4 | Dropdown | Mode selector. Two choices: "Change here (in-app) · 喺度改（應用內）" applies live tweaks from WinForge's own catalog (each card reads the setting's current value), and "Open in Windows · 喺 Windows 打開" lists every `ms-settings:` page and Control Panel applet to launch. Switching mode rebuilds the list below. | Icon-only here (empty accessible name); it is the in-app-vs-open-in-Windows mode picker. |
| 5 | Search box | Page filter ("Search settings…"). Typing flattens the grouped sections into a live result list — in in-app mode it filters the tweak catalog, in Open-in-Windows mode it searches launcher entries by name/keyword/command. Clearing it restores the grouped section view. | "Search settings… · 搜尋設定…" — filter the settings/launchers on this page. |
| 6–17 | Buttons (category rows / cards) | The body list. In sectioned view (no filter) each row is a collapsible category **Expander** — e.g. System · 系統, Devices · 裝置, Network · 網絡, Personalization · 個人化, Apps · 應用程式, Accounts · 帳戶, Time & Language · 時間與語言, Gaming · 遊戲, Accessibility · 協助工具, Privacy & Security · 私隱與安全, Update & Recovery · 更新與復原, Control Panel · 控制台, Other · 其他 — each showing an item count and expanding to reveal tweak cards or launcher cards. In filtered/Open-in-Windows search view these become flat cards: each shows the target's bilingual name plus its command text (e.g. an `ms-settings:` URI or Control Panel applet) and an **Open · 開啟** button that runs it via `Process.Start`; a result bar then reports "Opened · 已開啟" or "Failed · 失敗". | Empty accessible names because the labels live inside the card's text/glyph; rows 6–17 are the per-category section headers (or per-item launch cards), each tagged with its English · 粵語 name and item count. |

**How to use it · 點用** First pick a mode in the dropdown (item 4): leave it on **Change here (in-app)** to adjust Windows settings directly inside WinForge — each tweak card reads its current value first — or switch to **Open in Windows** to jump straight into the native Settings app or a Control Panel applet. Browse by expanding a category section (items 6–17), or type in the page filter (item 5) to flatten everything into a live result list. In Open-in-Windows mode, hit the **Open · 開啟** button on a card to launch that exact `ms-settings:` page or applet; a banner confirms whether it opened.

### PowerToys Extras · PowerToys 額外工具

*Image omitted from the offline bundle: PowerToys Extras — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | App chrome — returns to the previous page in WinForge's navigation history. | "Back" = 返回上一頁。 |
| 2 | Button | App chrome — collapses or expands the left navigation pane. | "Toggle Navigation" = 開合左邊導覽列。 |
| 3 | Search box | Global WinForge search; type to find any module/setting across the app. Not specific to this page. | "Search everything · 搜尋全部" — 搜尋整個應用程式嘅功能同設定。 |
| 4 | Tab | Opens the **Image Resizer** tool — bulk-resize a batch of pictures (controls 8–20 belong to this tab). | "Image Resizer" = 圖片縮放：批次縮細圖片。 |
| 5 | Tab | Opens the **Text Extractor (OCR)** tool — captures the screen and reads text off it via Windows.Media.Ocr, auto-copying to the clipboard. | "Text Extractor (OCR)" = 文字擷取（OCR）：由螢幕辨識文字。 |
| 6 | Tab | Opens the **Always On Top** tool — pins any open window above all others (SetWindowPos HWND_TOPMOST). | "Always On Top" = 視窗置頂：令視窗永遠喺最上面。 |
| 7 | Tab | Opens the **Paste Plain Text** tool — strips clipboard formatting and offers a global Ctrl+Shift+V hotkey. | "Paste Plain Text" = 純文字貼上：移除剪貼簿格式。 |
| 8 | Button | Opens a file picker to add images (supported extensions only) into the resize batch; duplicates are skipped. | "Add images…" = 加入圖片…：揀檔加入縮放清單。 |
| 9 | Button | Empties the current batch of images so you can start over. | "Clear" = 清空：清走清單入面所有圖。 |
| 10 | Dropdown | **Size preset** picker (e.g. Small/Medium/Large 1920×1080); choosing one fills the width/height boxes for you. Defaults to the Large preset. | Unlabelled here, but the field heading is "Size preset · 尺寸預設" — 揀預設尺寸。 |
| 11 | Checkbox | When ticked, images are only ever shrunk, never enlarged past their original size. On by default. | "Shrink only (never enlarge)" = 只縮唔放（唔放大）。 |
| 12 | Number box | **Max width (px)** — the largest width in pixels the output may reach; aspect ratio is always kept. Filled by the preset but editable. | Field heading "Max width (px) · 最大闊度（像素）" — 最大輸出闊度。 |
| 13 | Number box | **Max height (px)** — the largest height in pixels the output may reach. Filled by the preset but editable. | Field heading "Max height (px) · 最大高度（像素）" — 最大輸出高度。 |
| 14 | Button (spinner ▲) | Step the adjacent number box up by one. | "Increase" = 增加：數值加一。 |
| 15 | Button (spinner ▼) | Step the adjacent number box down by one. | "Decrease" = 減少：數值減一。 |
| 16 | Number box | **JPEG quality (1–100)** — compression quality for JPEG output; higher means larger, sharper files. Defaults to 90. | Field heading "JPEG quality (1–100) · JPEG 品質（1–100）" — JPEG 壓縮品質。 |
| 17 | Edit box | **Filename suffix** — text appended to each resized file's name so originals are not overwritten. | Field heading "Filename suffix · 檔名後綴" — 加喺檔名後面嘅字。 |
| 18 | Edit box | **Output folder** path; resized images are written here. Pre-filled with "Pictures\WinForge Resized". | Field heading "Output folder · 輸出資料夾" — 輸出資料夾路徑。 |
| 19 | Button | Opens a folder picker to set the output folder (control 18). | "Browse…" = 瀏覽…：揀輸出資料夾。 |
| 20 | Button | Runs the batch resize now — warns if no images or no output folder, shows progress, then reports how many succeeded/failed. | "Resize all" = 全部縮放：一次過縮放整批。 |

**How to use it · 點用** — Pick a tool with the tabs (4–7); the page opens on Image Resizer. There, click **Add images…** (8) to load pictures, choose a **Size preset** (10) or type your own **Max width/height** (12–13), tweak **JPEG quality** (16) and a **Filename suffix** (17) if you like, keep **Shrink only** (11) ticked to avoid upscaling, then point the **Output folder** (18/19) somewhere and press **Resize all** (20) — a results bar tells you the outcome. The other tabs work similarly: OCR extracts on-screen text straight to your clipboard, Always On Top pins windows on top, and Paste Plain Text cleans clipboard formatting on demand or via a Ctrl+Shift+V hotkey.
