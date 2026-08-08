# Productivity · 生產力

WinForge's **Productivity** group bundles eight in-app power-user tools that normally need PowerToys, SharpKeys, or a dozen separate utilities. Every tool runs *inside* WinForge with pure Win32/registry plumbing — no `ms-settings:` redirect, no external installer, and each one keeps working while the app sits in the system tray. Everything here is bilingual: English on the left, 粵語 on the right.

> 一站式生產力工具：全域熱鍵、文字展開、剪貼簿歷史、保持喚醒、右鍵選單編輯、視窗管理、環境變數、滑鼠同鍵盤重對應 — 全部喺 app 內運行，收入系統匣都繼續做嘢。

*Image omitted from the offline bundle: Hotkey & Macro Runner.*

---

## Table of contents · 目錄

| Tool | 工具 | What it really does |
|------|------|---------------------|
| [Hotkey & macro runner](#hotkey--macro-runner--熱鍵與巨集) | 熱鍵與巨集 | Global chords that launch apps, run PowerShell, or type text |
| [Text expander](#text-expander--文字展開) | 文字展開 | Typed triggers replaced with snippets everywhere in Windows |
| [Clipboard](#clipboard--剪貼簿) | 剪貼簿 | Background history of text/images/files; QR, plain-text paste |
| [Awake](#awake--保持喚醒) | 保持喚醒 | Stop sleep / screen timeout, optionally on a timer |
| [Context-menu editor](#context-menu-editor--右鍵選單編輯器) | 右鍵選單編輯器 | Add/remove custom right-click verbs (per-user) |
| [Window manager](#window-manager--視窗管理) | 視窗管理 | Snap any window to halves/quarters/thirds, always-on-top |
| [Environment variables](#environment-variables--環境變數) | 環境變數 | View/add/edit/delete User & System vars; PATH list editor |
| [Mouse & pointer](#mouse--pointer--滑鼠與指標) | 滑鼠與指標 | Live native mouse tweaks via `SystemParametersInfo` |
| [Keyboard remapper](#keyboard-remapper--鍵盤重新對應) | 鍵盤重新對應 | Remap/disable keys via the HKLM Scancode Map |

---

## Hotkey & Macro Runner · 熱鍵與巨集

Register **global keyboard chords** (`Ctrl` / `Alt` / `Shift` / `Win` + a key) that fire from anywhere in Windows. Each chord runs one of three actions. Bindings are pumped on a dedicated background message thread, so they keep firing while WinForge is minimized to the tray.

> 登記全域組合鍵，喺任何地方都觸發到。每個組合鍵可以做三種動作之一。

### How a chord is built · 點樣砌一個組合鍵

1. **Modifiers · 修飾鍵** — tick any of **Ctrl / Alt / Shift / Win**. At least one is required.
2. **Key · 按鍵** — pick from the `PickableKeys` list (A–Z, 0–9, F1–F12, Space, Enter, Tab, Esc, Insert, Delete, Home, End, Page Up/Down, Print Screen, arrows).
3. **Action · 動作** — choose what it does (table below).
4. Optional **Name · 名稱**, then **Add hotkey · 加入熱鍵**.

The chord is rendered back as a human-readable label, e.g. `Ctrl + Alt + K`, via `HotkeyBinding.ChordText()`. Duplicate chords are rejected ("That chord is already used · 呢個組合鍵已經用咗").

### Action types · 動作種類

| Action (`MacroActionKind`) | 動作 | What runs |
|---|---|---|
| **Launch an app / file / URL** | 開啟程式／檔案／網址 | `Process.Start` with `UseShellExecute` — program, document, or URL, plus optional **Arguments · 參數**. A **Browse… · 瀏覽…** picker fills the target. |
| **Run a PowerShell snippet** | 執行 PowerShell 片段 | `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "…"`, run hidden (`CreateNoWindow`). |
| **Type text (SendInput)** | 自動打字（SendInput） | Replays the text character-by-character via `SendInput` in Unicode mode (`\n` → Enter, `\t` → Tab). |

### Under the hood · 內部運作

- Chords are registered with the user32 **`RegisterHotKey`** API on a background STA thread named `WinForge-Hotkeys`; `WM_HOTKEY` messages are dispatched to the matching binding. `MOD_NOREPEAT` is added so a held key fires once.
- Add/remove/toggle posts a `WM_APP` reload to the pump so re-registration is instant.
- Each binding has an **Enabled** toggle; disabled bindings are skipped during registration.
- Bindings persist as JSON via `SettingsStore` under the key `hotkeymacro.bindings`, so they survive restarts.
- When a chord fires, an InfoBar shows **Triggered · 已觸發** with the last event text.

> **Safety · 安全**
> The "Run a PowerShell snippet" action executes with `-ExecutionPolicy Bypass`. Only bind scripts you wrote or trust — a global hotkey runs the snippet with your current user rights, no confirmation prompt.

---

## Text Expander · 文字展開

A typed-trigger expander, like PowerToys' but built into WinForge. Type a short **trigger** anywhere in Windows and it is instantly replaced with its **expansion** text. Toggle it on with **Expand typed triggers · 展開打字縮寫**.

> 喺 Windows 任何地方打縮寫，就會即刻換成你設定嘅片語。

### Snippets · 片語

| Field | 欄位 | Example |
|---|---|---|
| **Trigger** | 縮寫 | `;addr` |
| **Replacement text** | 展開後嘅文字 | your full mailing address |

Add with **Add snippet · 加入片語**; each snippet has its own enable/disable toggle. Duplicate triggers are rejected.

### How the replacement happens · 換字原理

- When enabled, WinForge installs a low-level **`WH_KEYBOARD_LL`** keyboard hook on a background thread (`WinForge-Expander`).
- It keeps a rolling 64-character buffer of typed characters (decoded with `ToUnicode`). Non-text keys (arrows, Enter, Tab) clear the current word; Backspace trims the buffer.
- When the buffer ends with a trigger, the expander **backspaces over the trigger** and types the expansion via `SendInput`, suppressing its own hook so it doesn't loop.

The status line tells you which mode you're in:

- **On** — *"typing a trigger replaces it with its snippet anywhere in Windows · 喺 Windows 任何地方打縮寫都會自動換成片語."*
- **Off** — *"install a low-level keyboard hook to watch for triggers · 開咗會裝低階鍵盤掛鈎監察縮寫."*

> **Safety · 安全**
> The expander is a system-wide keyboard hook — by design it sees keystrokes in every app while it is on. WinForge only matches them against your own local snippet list and stores nothing off-device; turn the switch **Off** to remove the hook entirely.

---

## Clipboard · 剪貼簿

*Image omitted from the offline bundle: Clipboard manager.*

A Win+V-style **clipboard history** that captures everything you copy — **text, images and copied files** — automatically, in the background. Click any entry to act on it. The monitor keeps capturing even when the window is closed to the tray.

> 你複製過嘅嘢 — 文字、圖片同檔案 — 自動留喺度。撳一下就可以複製返、貼為純文字、整 QR 碼，或者轉檔。

### What gets captured · 捕捉到啲咩

| Kind (`ClipKind`) | 種類 | Stored as |
|---|---|---|
| **Text** | 文字 | the text body (preview trimmed to 200 chars) |
| **Image** | 圖片 | saved as a PNG in `%LocalAppData%\WinForge\clipboard` |
| **Files** | 檔案 | the list of copied file paths |

History holds up to **200 items**; the oldest roll off (and their PNGs are deleted). It persists to `history.json` and reloads on launch.

### Per-item actions · 每項操作

| Button | 按鈕 | Applies to |
|---|---|---|
| **Copy back** | 複製返 | all kinds — puts the entry back on the clipboard |
| **Paste as plain text** | 貼為純文字 | text & files — strips rich formatting (`Clipboard.Flush`) |
| **Make QR code** | 整 QR 碼 | text & files — see below |
| **Save / format picker** | 儲存 | images — convert to **PNG / JPG / BMP / GIF**, saved to Pictures |
| **Convert** | 轉檔 | file items that are media — re-encode to **mp3 / wav / flac / m4a / mp4 / mkv / gif** via ffmpeg |
| **Delete** | 刪除 | remove a single entry |
| **Clear all** | 清除全部 | empty the visible history |

### QR codes · QR 碼

QR codes are generated **fully offline** with the `QRCoder` library (ECC level Q). The dialog (**QR code · QR 碼**) shows the code and lets you **Save PNG… · 儲存 PNG…** (to Pictures) or **Copy image · 複製圖片** to the clipboard. Payloads over ~2,900 characters are politely rejected.

### Media conversion · 媒體轉檔

If a copied file is audio/video (`.mp3 .wav .flac .m4a .aac .ogg .opus .wma .mp4 .mkv .mov .avi .webm .wmv .flv`), a format dropdown + **Convert · 轉檔** appears. It shells out to bundled **ffmpeg** (`-y -i "<in>" "<out>"`), writing `<name>-wt.<ext>` beside the source. If ffmpeg isn't present you get **ffmpeg not found · 搵唔到 ffmpeg**.

### Run on startup · 開機自動執行

The blue **Running in the background · 喺背景運行緊** bar carries a **Run on startup · 開機自動執行** toggle. When on, `StartupManager.SetSelfStartup(true)` writes an `HKCU\…\Run` value:

```
"<WinForge.exe>" --minimized
```

so WinForge launches at login straight to the tray and the clipboard monitor starts capturing immediately. Right-click the tray icon to **Quit**.

> **Safety · 安全**
> Clipboard history is stored locally only, under `%LocalAppData%\WinForge\clipboard`. Be aware it captures *everything* you copy — including passwords or tokens — until you **Delete** an entry or **Clear all**. Images are real files on disk; deleting an entry deletes its PNG.

See also [Module-Misc-Utilities](app-doc://article/winforge.wiki.4bbe3f2c91da658b) for the tray and startup-apps manager.

---

## Awake · 保持喚醒

*Image omitted from the offline bundle: Keep awake.*

A PowerToys-Awake-style switch that stops your PC sleeping or dimming while WinForge runs — ideal for long downloads, installs, or presentations.

> WinForge 開住嘅時候令電腦保持清醒 — 唔瞓、螢幕唔熄。下載、安裝、做簡報啱用。

### Controls · 控制項

| Control | 控制項 | Effect |
|---|---|---|
| **Keep the PC awake** | 保持電腦清醒 | master switch — calls `AwakeService.KeepAwake` (`SetThreadExecutionState`) |
| **Keep the screen on too** | 連螢幕都唔好熄 | also blocks the display timeout |
| **Auto-off after (minutes, 0 = never)** | 幾耐後自動關（分鐘，0 = 唔關） | optional countdown timer |

When a timer is set, the status line counts down live: **Awake — MM:SS left · 清醒中 — 仲有 MM:SS**, and the switch flips itself off when the timer runs out. With `0` it shows **Awake — until turned off · 清醒中 — 直到關閉為止**. When off, sleep & screen timeout simply **follow your power plan · 跟返你嘅電源計劃**. The keep-awake state persists across pages for the whole WinForge session.

---

## Context Menu Editor · 右鍵選單編輯器

*Image omitted from the offline bundle: Context menu editor.*

Add your own **right-click commands** to Explorer and remove ones you created — applied instantly, **per-user only**. WinForge writes verbs under `HKCU\Software\Classes\…\shell`, so it **never touches the system HKLM/HKCR defaults**.

> 加自己嘅右鍵指令，又可以移除自己整嘅 — 只限本使用者、即時生效，唔會郁到系統預設。

### Scopes · 範圍

| Scope | 範圍 | Registry sub-path (under `HKCU\Software\Classes`) | Placeholder |
|---|---|---|---|
| All files | 所有檔案 | `*\shell` | `%1` |
| Folders | 資料夾 | `Directory\shell` | `%1` |
| Folder background | 資料夾空白處 | `Directory\Background\shell` | `%V` |
| Drives | 磁碟機 | `Drive\shell` | `%1` |

### Adding a verb · 加一個指令

Fill in:

- **Menu label · 選單文字** — e.g. *Open with Notepad*
- **Command · 指令** — e.g. `notepad.exe "%1"`. Use `%1` for the clicked file/folder, `%V` for a folder background.
- **Icon path (optional) · 圖示路徑（可選）** — e.g. `notepad.exe`. **Browse… · 瀏覽…** picks an `.exe` and auto-fills both command and icon.
- **Shift only · 淨係 Shift** — marks the verb `Extended` so it appears only in the Shift+right-click menu.

The new key is sanitised and prefixed `WT_` so WinForge can find and clean up its own verbs later.

### Quick presets · 快速範本

Two one-click presets land in **Folder background · 資料夾空白處**:

| Preset | Command |
|---|---|
| **Open PowerShell here · 喺呢度開 PowerShell** | `powershell.exe -NoExit -Command "Set-Location -LiteralPath '%V'"` |
| **Open Command Prompt here · 喺呢度開命令提示字元** | `cmd.exe /s /k pushd "%V"` |

The list shows every custom verb with its **Scope / Label / Command**, a live count (**Command — N custom · 指令 — N 個自訂**), and a per-row delete that removes the whole key tree.

> **Safety · 安全**
> All writes are under `HKCU` (current user) and are reversible from the list — WinForge never modifies system-wide context menus. Deleting a verb removes only the key WinForge created.

---

## Window Manager · 視窗管理

*Image omitted from the offline bundle: Window manager.*

A built-in FancyZones-lite. Pick any open top-level window on the left, then **snap** it to a zone — halves, quarters, thirds, maximise, centre, or pin always-on-top. Pure Win32 P/Invoke (`SetWindowPos` / `ShowWindow`), no external tool.

> 喺左邊揀一個開住嘅視窗，再貼去一個分區 — 一半、四分一、三分一、最大化、置中或者永遠置頂。

### The window list · 視窗清單

`WindowManager.List()` enumerates visible top-level windows, filtering out owned/dialog windows, tool windows (`WS_EX_TOOLWINDOW`), title-less windows, and WinForge itself. **Refresh · 重新整理** re-scans; a count shows **N windows · N 個視窗**.

### Snap zones · 分區

| Group | 組 | Buttons |
|---|---|---|
| **Halves · 一半** | | ◧ Left · 左 · ◨ Right · 右 · ⬒ Top · 上 · ⬓ Bottom · 下 |
| **Quarters · 四分一** | | ◰ Top-L 左上 · ◳ Top-R 右上 · ◱ Bot-L 左下 · ◲ Bot-R 右下 |
| **Thirds · 三分一** | | Left ⅓ 左 · Centre ⅓ 中 · Right ⅓ 右 |
| **Whole · 整個** | | Maximise 最大化 · Centre 置中 · Full area 全工作區 |

All geometry is computed against the monitor **work area** (`SPI_GETWORKAREA`, so the taskbar is respected). Snapping restores the window first (so a maximised window can be tiled), positions it, and brings it to the foreground. A success InfoBar reads **Snapped · 已貼齊**.

### Extras · 其他

- **Focus · 聚焦** — restore and bring the selected window forward.
- **On top / Normal · 置頂／正常** — toggle always-on-top via `HWND_TOPMOST` / `HWND_NOTOPMOST`.

---

## Environment Variables · 環境變數

*Image omitted from the offline bundle: Environment variables editor.*

A PowerToys-style editor to **view, add, edit and delete** environment variables for both **User** and **System** scopes — no `rundll32 sysdm.cpl` detour.

> 檢視、新增、編輯同刪除環境變數。使用者變數唔使管理員；系統變數要 WinForge 以管理員身分執行。

### Scope · 範圍

| Scope | 範圍 | Rights |
|---|---|---|
| **User variables** | 使用者變數 | writable without admin (`EnvironmentVariableTarget.User`) |
| **System variables (admin)** | 系統變數（管理員） | needs WinForge running as administrator (`…Target.Machine`) |

Variables are listed alphabetically with a count (**Value — N · 值 — N 個**). **Set · 設定** creates or updates; the per-row bin deletes.

### Smart PATH editor · PATH 編輯器

When you **Edit** a semicolon-list variable (PATH, PATHEXT…) with two or more entries, WinForge opens a friendly **one-entry-per-row** dialog instead of an unwieldy single line:

- Reorder entries with **↑ / ↓** arrows.
- Remove an entry with the bin.
- **Add an entry…** by typing, or **Browse…** to pick a folder.
- **Save** rejoins them with `;` and writes back.

Simple (non-list) variables just load back into the inline Name/Value boxes for editing.

> **Safety · 安全**
> Writing **System variables** requires administrator rights — without elevation the save fails with *"System variables need administrator rights — relaunch WinForge as admin · 系統變數要管理員權限."* Editing PATH-style System variables can affect every program on the machine; double-check entries before saving.

---

## Mouse & Pointer · 滑鼠與指標

*Image omitted from the offline bundle: Mouse & pointer settings.*

Native mouse settings that **apply instantly and persist** — no Settings app needed. Every control writes live via `SystemParametersInfo` with `SPIF_UPDATEINIFILE | SPIF_SENDWININICHANGE`, so the change sticks and other apps are notified.

> 原生滑鼠設定，即時生效又會記住 — 唔使開設定 app。

### Controls · 控制項

| Control | 控制項 | Backed by |
|---|---|---|
| **Swap primary & secondary buttons** | 交換左右鍵 | `SwapMouseButton` + `HKCU\Control Panel\Mouse\SwapMouseButtons` |
| **Pointer speed** (1–20, default 10) | 指標速度 | `SPI_SET/GETMOUSESPEED` |
| **Enhance pointer precision (acceleration)** | 增強指標精確度（加速） | `SPI_SET/GETMOUSE` — off gives 1:1 movement (gamers usually want this OFF) |
| **Double-click speed** (100–900 ms) | 雙擊速度 | `SetDoubleClickTime` + `…\Mouse\DoubleClickSpeed` |
| **Wheel scroll lines** (1–15) | 滾輪捲動行數 | `SPI_SET/GETWHEELSCROLLLINES` |
| **Hide pointer while typing** | 打字時隱藏指標 | `SPI_SET/GETMOUSEVANISH` |
| **Snap to the default button in dialogs** | 對話框自動跳去預設按鈕 | `SPI_SET/GETSNAPTODEFBUTTON` |

Each card reads the current OS value on load, so the toggles/sliders reflect your real system state.

---

## Keyboard Remapper · 鍵盤重新對應

*Image omitted from the offline bundle: Keyboard remapper.*

A SharpKeys-style remapper, built in. **Remap one key to another, or disable it entirely** by writing the Windows **Scancode Map**. No external tool, no redirect — but it needs **administrator** rights and a **reboot** to take effect.

> 將一個鍵改做另一個，或者完全停用佢。會寫入系統 Scancode Map — 需要管理員權限，重新開機先生效。

### Building a mapping · 砌一個對應

1. **From · 對應** — pick the source key.
2. **To** — pick a target key, **or** choose **✕ Disable key · ✕ 停用此鍵**.
3. **Add · 加入**. Only one mapping per source key is kept (a new one replaces the old). Mapping a key to itself is rejected.

Remappable keys (`KeyboardRemapper.Keys`, with their scancode words) include the keys most people actually want to move:

| Key | 鍵 | Scancode |
|---|---|---|
| Caps Lock | Caps Lock | `0x003A` |
| Left Ctrl / Alt / Shift | 左 Ctrl / Alt / Shift | `0x001D` / `0x0038` / `0x002A` |
| Left / Right Win | 左／右 Win | `0xE05B` / `0xE05C` |
| Menu (Apps) | 選單鍵 | `0xE05D` |
| Esc / Tab / Enter / Backspace | Esc / Tab / Enter / Backspace | `0x0001` / `0x000F` / `0x001C` / `0x000E` |
| Insert | Insert | `0xE052` |
| Scroll Lock / Num Lock | Scroll Lock / Num Lock | `0x0046` / `0x0045` |
| Print Screen | Print Screen | `0xE037` |

### Applying & clearing · 套用同清除

- **Apply (reboot) · 套用（重啟）** builds the `Scancode Map` `REG_BINARY` blob and writes it to `HKLM\SYSTEM\CurrentControlSet\Control\Keyboard Layout`. Confirmation: *"N mapping(s) written. Reboot for them to take effect · 已寫入 N 個對應。重新開機後生效."*
- **Clear all · 全部清除** deletes the value — *"All remaps removed. Reboot to restore default keys · 重新開機回復預設鍵."*

The current map is read back and shown on load, with a count (**N mapping(s) · N 個對應**), so you always see what's already in effect.

> **Safety · 安全**
> The Scancode Map lives in **HKLM** and applies to **all users at the OS level**. Without admin you get *"Writing the Scancode Map needs administrator rights — relaunch WinForge as admin."* Changes only take hold after a **reboot**; if you disable or misremap an essential key, use **Clear all** (as admin) and reboot to restore defaults.

---

## See also · 另見

- [Module-Misc-Utilities](app-doc://article/winforge.wiki.4bbe3f2c91da658b) — tray icon, run-on-startup, startup-apps manager and the rest of the convenience toolbox.
- [Home](app-doc://article/winforge.wiki.355883cf07556dda) — full module index.

---

_Part of [Home](app-doc://article/winforge.wiki.355883cf07556dda) · WinForge wiki._

---

## Guided tours · 逐步導覽

Each control on the live page is numbered on the screenshot below and explained in the legend — what every **button, toggle, tab, box and label** does, in English and 粵語. Captured from the running app via UI Automation. 下面每個控件都有編號，逐個解釋佢哋嘅功能同標籤意思。

### Hotkey & Macro Runner · 熱鍵與巨集

*Image omitted from the offline bundle: Hotkey & Macro Runner — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | Goes back to the previous page in the app's navigation stack. | "Back" — return to the page you came from（返回上一頁）. |
| 2 | Button | Collapses or expands the left navigation pane (the hamburger menu). | "Toggle Navigation" — show/hide the side menu（開關側邊導覽欄）. |
| 3 | Search box | The app-wide search field in the title bar; type to find any module or setting across WinForge. | "Search everything · 搜尋全部" — search the whole app; both halves mean the same thing. |
| 4 | Dropdown | The **Action** picker. Choose what the hotkey does: "Launch an app / file / URL", "Run a PowerShell snippet", or "Type text (SendInput)". Your choice swaps which input fields below are shown (the program fields, a PowerShell box, or a text box). | Empty accessible name; it is the "Action · 動作" selector for the new hotkey. |
| 5 | Checkbox | Adds **Ctrl** as a modifier to the chord. At least one modifier (Ctrl/Alt/Shift/Win) must be ticked or Add hotkey is rejected. | "Ctrl" — the Control key（控制鍵），part of the key combination. |
| 6 | Checkbox | Adds **Alt** as a modifier to the chord. | "Alt" — the Alt key（替代鍵），part of the combination. |
| 7 | Checkbox | Adds **Shift** as a modifier to the chord. | "Shift" — the Shift key（上檔鍵），part of the combination. |
| 8 | Checkbox | Adds **Win** (the Windows key) as a modifier to the chord. | "Win" — the Windows logo key（Windows 鍵），part of the combination. |
| 9 | Dropdown | The **Key** picker. Selects the main key of the chord (from WinForge's list of pickable keys) that combines with the ticked modifiers. | Empty accessible name; it is the "Chord · 組合鍵" key selector. |
| 10 | Text box | Optional friendly name for this hotkey, shown in the bindings list. | "Name (optional)" — a label you choose（名稱，可選）. |
| 11 | Text box | The program, file or URL to open — used when the action is "Launch an app / file / URL". | "Program / file / URL" — what to launch（程式／檔案／網址）. |
| 12 | Text box | Optional command-line arguments passed to the launched program. | "Arguments (optional)" — extra parameters（參數，可選）. |
| 13 | Button | Opens a Windows file picker and drops the chosen file's path into the Program field (#11). | "Browse…" — pick a file from disk（瀏覽…）. |
| 14 | Button | Validates the form and registers the new global hotkey: it checks a modifier and key are set, the action's field is filled, and the chord isn't already taken, then adds it to the list and clears the inputs. | "Add hotkey" — save this binding（加入熱鍵）. |
| 15 | Button | Per-row delete in the global-hotkeys list: removes that hotkey binding and unregisters its chord. (Each row also has an on/off toggle to temporarily disable a binding.) | Icon-only (empty name) — the per-row "Remove / 移除" button for that hotkey. |
| 16 | Text box | The replacement text that the expander types in place of the trigger. | "Replacement text" — what the snippet expands to（展開後嘅文字）. |
| 17 | Text box | The trigger string you type to fire the expansion (e.g. `;addr`). | "e.g. ;addr" — placeholder showing an example trigger（例如 ;addr，即縮寫）. |
| 18 | Button | Validates and saves a new text-expander snippet (trigger + replacement), refusing empty fields or a duplicate trigger, then clears the inputs. | "Add snippet" — save this expansion（加入片語）. |

**How to use it · 點用** To make a hotkey, tick one or more modifiers (#5–#8), pick a key (#9), then choose an action in the Action dropdown (#4) — the matching fields appear: a Program/Arguments pair (#11–#13, with Browse), a PowerShell box, or a text box. Give it an optional name (#10) and click **Add hotkey** (#14); it registers globally and keeps firing even when WinForge is in the tray, with each list row offering an enable toggle and a remove button (#15). For text expansion, type a short trigger (#17) and its replacement (#16), click **Add snippet** (#18), and turn on the expander toggle so typing the trigger anywhere in Windows swaps it for the snippet.

### Clipboard · 剪貼簿

*Image omitted from the offline bundle: Clipboard — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | App-shell back button: returns to the previously viewed module in the navigation history. Not part of the Clipboard module itself. | "Back" — go back to the previous page; 返回上一頁。 |
| 2 | Button | App-shell hamburger button: collapses or expands the left navigation pane so the content area gets more width. | "Toggle Navigation" — show/hide the side navigation menu; 開關側邊導覽列。 |
| 3 | Search box | Global search box in the title bar (app shell, not Clipboard-specific): type to jump to any module or setting across WinForge. | "Search everything · 搜尋全部" — English "Search everything" and 粵語 "搜尋全部" both mean search across the whole app. |
| 4 | Button (icon-only) | Title-bar window control with no accessible name, positioned at the far right edge — most likely the window caption/menu or theme button in the app's custom title bar. Its exact action isn't defined in the Clipboard source. | No label; inferred to be a title-bar window/caption control. |
| 5 | Toggle / 開關 | "Run on startup" switch inside the "Running in the background" info bar. Turning it on registers WinForge to launch (minimized to the system tray) at login via `StartupManager.SetSelfStartup`; turning it off removes that registration. It reflects the current state on load via `StartupManager.IsSelfStartupEnabled()`. | "Run on startup" / "開機自動執行" — English "Run on startup" and 粵語 "開機自動執行" both mean auto-launch the app when Windows starts. |

**How to use it · 點用** — This page shows your clipboard history (text, images and copied files) captured automatically by the background monitor; copy something while WinForge is running and a card appears for it. Each history card carries its own row of actions — Copy back (複製返), Paste as plain text (貼為純文字), Make QR code (整 QR 碼), Save/Convert with a format dropdown for images and media, and Delete (刪除) — plus a "Clear all · 清除全部" button to wipe the list. Because capturing only works while the monitor is alive, flip the "Run on startup · 開機自動執行" toggle (5) so WinForge relaunches to the tray at every login; the monitor keeps running even when the window is closed to the tray, and you quit it by right-clicking the tray icon.

### Awake · 保持喚醒

*Image omitted from the offline bundle: Awake — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | Goes back to the previous page in the app's navigation history. Standard WinForge shell button, not part of the Awake module itself. | "Back" — return to the previous screen (返回上一頁). |
| 2 | Button | Collapses or expands the left navigation pane, giving the content area more width. Part of the app shell. | "Toggle Navigation" — show/hide the side menu (開關導覽列). |
| 3 | Search box | App-wide search that filters/jumps to any module or setting across WinForge. Part of the shell, present on every page. | "Search everything · 搜尋全部" — search across the whole app; 搜尋全部 = "search everything". |
| 4 | Toggle / 開關 | The main on/off switch (`AwakeSwitch`). Turning it on calls `AwakeService.KeepAwake(...)`, which keeps the PC awake via `SetThreadExecutionState` and respects the "screen on" checkbox; if a minutes value is set it starts the countdown timer. Turning it off calls `AwakeService.AllowSleep()` and stops the timer. The toggle has no text accessible name, so it shows blank in the legend, but it sits under the "Keep the PC awake · 保持電腦清醒" title. | Icon/state-only switch with no label text; its heading reads "Keep the PC awake · 保持電腦清醒" = keep the computer awake. |
| 5 | Checkbox | Optional setting (`DisplayChk`). When checked, WinForge also prevents the screen from turning off, not just sleep. Changing it while the switch is on re-applies `AwakeService.KeepAwake` with the new display setting. | "Keep the screen on too · 連螢幕都唔好熄" — also keep the display lit; 連螢幕都唔好熄 = "don't let the screen turn off either". |
| 6 | Edit (number box) | The minutes value (`MinutesBox`). Type how many minutes to stay awake before auto-off; 0 means never auto-off (stays awake until you turn it off). The value is read when you flip the switch on, and drives the on-screen countdown ("Awake — MM:SS left"). | Unlabeled entry field; its caption reads "Auto-off after (minutes, 0 = never) · 幾耐後自動關（分鐘，0 = 唔關）" = turn off after N minutes, 0 = never. |
| 7 | Button | The number box's up-spinner — clicking it increases the minutes value by one step. | "Increase" — step the minutes up (加大數值). |
| 8 | Button | The number box's down-spinner — decreases the minutes value by one step. Shown disabled here because the value is already at its minimum (0). | "Decrease" — step the minutes down (調細數值). |

**How to use it · 點用** — Optionally tick "Keep the screen on too" (5) if you want the display to stay lit, then set a duration in the minutes box (6) using the up/down spinners (7, 8) — leave it at 0 to stay awake indefinitely. Flip the main toggle (4) on, and WinForge holds the PC awake while it runs; the status line updates to show either a live countdown or "Awake — until turned off". When you no longer need it, flip the toggle off (or let the timer expire) and sleep and screen-timeout return to your normal power plan.

### Context Menu · 右鍵選單

*Image omitted from the offline bundle: Context Menu — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | Goes back to the previous page in the app's navigation history. Standard app-shell back arrow, not part of this module. | "Back" = 返回上一頁。 |
| 2 | Button | Collapses or expands the left navigation pane (hamburger). App-shell control, not specific to this module. | "Toggle Navigation" = 開關／收合左邊嘅導覽列。 |
| 3 | Search box | Global app search box that filters/finds settings across all of WinForge. Belongs to the shell, not to this editor specifically. | "Search everything · 搜尋全部" — English "search everything" and 粵語「搜尋全部」both mean: type to search every module. |
| 4 | Dropdown | Picks the **scope** where your new menu item appears: where Windows will show this right-click command. Four choices — All files (`HKCU\…\*\shell`, uses `%1`), Folders (`Directory\shell`, `%1`), Folder background (`Directory\Background\shell`, `%V`), Drives (`Drive\shell`, `%1`). The choice also drives which placeholder Browse… inserts. Defaults to "Folder background". | Icon-only here, but it lists the four scopes: All files · 所有檔案 / Folders · 資料夾 / Folder background · 資料夾空白處 / Drives · 磁碟機. "Scope · 範圍" = where the command shows up. |
| 5 | Text box | The **label** text shown in the right-click menu — what the user reads (e.g. "Open with Notepad"). Required; leaving it blank blocks Add. | Placeholder "Menu label, e.g. Open with Notepad" → 粵語「選單文字，例如 用記事本開」= the wording that appears in the menu. |
| 6 | Text box | The **command** that runs when the item is clicked. Use `%1` for the selected file/folder and `%V` for folder-background. Required; blank blocks Add. Browse… fills this in for you. | Placeholder "Command, e.g. notepad.exe \"%1\"" → 粵語「指令，例如 notepad.exe \"%1\"」= the program/command to execute. |
| 7 | Button | Opens a file picker (filtered to `.exe`). After you choose a program it writes `"path" "%1"`/`"%V"` (matching the chosen scope) into the Command box, and copies the path into the Icon box if that's empty. | "Browse…" → 粵語「瀏覽…」= pick an .exe from disk. |
| 8 | Text box | Optional **icon path** for the menu item (e.g. `notepad.exe`). Leave empty for no icon. | Placeholder "Icon path (optional), e.g. notepad.exe" → 粵語「圖示路徑（可選），例如 notepad.exe」= where to get the icon, optional. |
| 9 | Toggle / Checkbox | When ticked, the item is an **extended** verb — Windows only shows it when you hold **Shift** while right-clicking, keeping the normal menu uncluttered. | "Shift only" → 粵語「淨係 Shift」= visible only with Shift held. |
| 10 | Button | **Adds** the new verb using the current Scope/Label/Command/Icon/Shift settings. Writes a per-user key under `HKCU\Software\Classes` (never system defaults), shows a success bar, clears the form, and refreshes the list below. Warns if Label or Command is empty. | "Add" → 粵語「新增」= create the menu item. |
| 11 | Button | One-click preset: adds an "Open PowerShell here" item to the **Folder background** scope, command `powershell.exe -NoExit -Command "Set-Location -LiteralPath '%V'"`, icon `powershell.exe`. Instantly appears in the list. | "PowerShell here" → 粵語「喺呢度開 PowerShell」= open a PowerShell prompt in the current folder. |
| 12 | Button | One-click preset: adds an "Open Command Prompt here" item to the **Folder background** scope, command `cmd.exe /s /k pushd "%V"`, icon `cmd.exe`. | "Command Prompt here" → 粵語「喺呢度開命令提示字元」= open a CMD prompt in the current folder. |

**How to use it · 點用** — Pick a **Scope** (4) for where the command should appear, type the menu wording in **Label** (5), and enter a **Command** (6) — either by hand using `%1` (the selected item) / `%V` (the folder background), or via **Browse…** (7) to point at an `.exe`. Optionally set an **Icon** (8) and tick **Shift only** (9) to hide it behind a Shift-right-click, then press **Add** (10); it takes effect immediately under your own user account and shows up in the list below, where each row has a Remove button to delete items you created. For the two most common needs, just hit **PowerShell here** (11) or **Command Prompt here** (12) to add an "open a terminal in this folder" command with one click.

### Window Manager · 視窗管理

*Image omitted from the offline bundle: Window Manager — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|---------------------------|--------------------------|
| 1 | Button | App shell back button — returns to the previous WinForge page / the module list. Not part of this module's logic. | "Back" = go back / 返回上一頁。 |
| 2 | Button | App shell hamburger — collapses or expands the left navigation pane. Global chrome, not module-specific. | "Toggle Navigation" = open/close the navigation sidebar / 開關側邊導覽列。 |
| 3 | Search box | App-wide search box in the title bar; type to find modules and settings across WinForge. It does not filter the window list below. | "Search everything · 搜尋全部" = search everything / 搜尋全部內容。 |
| 4 | Button | Re-scans all top-level windows and rebuilds the left-hand list (`Reload()` → `WindowManager.List()`), updating the "N windows" count. Press it after opening or closing apps. | "Refresh · 重新整理" = refresh / 重新整理個列表。 |
| 5 | Button | Snaps the selected window to the **left half** of the screen (`Zone.LeftHalf`). | "◧ Left · 左" = left half / 左半邊；the ◧ glyph shows the left side filled. |
| 6 | Button | Snaps the selected window to the **right half** (`Zone.RightHalf`). | "◨ Right · 右" = right half / 右半邊；◨ shows the right side filled. |
| 7 | Button | Snaps the selected window to the **top half** (`Zone.TopHalf`). | "⬒ Top · 上" = top half / 上半邊。 |
| 8 | Button | Snaps the selected window to the **bottom half** (`Zone.BottomHalf`). | "⬓ Bottom · 下" = bottom half / 下半邊。 |
| 9 | Button | Snaps the selected window to the **top-left quarter** (`Zone.TopLeft`). | "◰ Top-L · 左上" = top-left quarter / 左上角四分一。 |
| 10 | Button | Snaps the selected window to the **top-right quarter** (`Zone.TopRight`). | "◳ Top-R · 右上" = top-right quarter / 右上角四分一。 |
| 11 | Button | Snaps the selected window to the **bottom-left quarter** (`Zone.BottomLeft`). | "◱ Bot-L · 左下" = bottom-left quarter / 左下角四分一。 |
| 12 | Button | Snaps the selected window to the **bottom-right quarter** (`Zone.BottomRight`). | "◲ Bot-R · 右下" = bottom-right quarter / 右下角四分一。 |
| 13 | Button | Snaps the selected window to the **left third** of the screen (`Zone.LeftThird`). | "Left ⅓ · 左 ⅓" = left one-third column / 左邊三分一。 |
| 14 | Button | Snaps the selected window to the **centre third** (`Zone.CenterThird`). | "Centre ⅓ · 中 ⅓" = centre one-third column / 中間三分一。 |
| 15 | Button | Snaps the selected window to the **right third** (`Zone.RightThird`). | "Right ⅓ · 右 ⅓" = right one-third column / 右邊三分一。 |
| 16 | Button | **Maximises** the selected window (`Zone.Maximize`). | "Maximise · 最大化" = maximise / 最大化。 |
| 17 | Button | Centres the selected window on screen at its current size (`Zone.Center`). | "Centre · 置中" = centre the window / 置中。 |
| 18 | Button | Resizes the window to fill the full work area — the whole screen minus the taskbar (`Zone.FullArea`). | "Full area · 全工作區" = full work area / 全工作區（扣除工作列）。 |
| 19 | Toggle / 開關 | Always-on-top switch — when On it pins the selected window above all others (`WindowManager.SetTopMost(h, true)`); Off restores normal stacking. The label flips between its two states. | "Normal · 正常" (Off) ↔ "On top · 置頂" (On) = normal stacking vs. pinned on top / 正常層級 對 永遠置頂。 |
| 20 | Button | Brings the selected window to the foreground and gives it keyboard focus (`WindowManager.Focus(h)`), without resizing it. | "Focus · 聚焦" = focus / 聚焦（拉到最前並取得焦點）。 |

**How to use it · 點用** — First click **Refresh** (4) if your window isn't listed, then pick the target window from the list on the left (a snap action with nothing selected just shows a "Select a window first / 請先揀一個視窗" warning). With it selected, click any snap tile — halves (5–8), quarters (9–12), thirds (13–15), or whole-screen (16–18) — and the window jumps to that zone via pure Win32 with a green "Snapped · 已貼齊" confirmation. Use **Focus** (20) to surface a buried window and the **On top / Normal** toggle (19) to keep a reference window pinned above everything else.

### Environment Variables · 環境變數

*Image omitted from the offline bundle: Environment Variables — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | Returns to the previous page in WinForge's navigation history. | "Back" — go back / 返回上一頁. |
| 2 | Button | Collapses or expands the left navigation pane to give the variable list more room. | "Toggle Navigation" — show/hide the side menu / 收起或展開側邊導覽。 |
| 3 | Search box | App-wide search box in the title bar for jumping to any WinForge module; not the variable filter. | "Search everything · 搜尋全部" — search the whole app / 搜尋整個應用程式。 |
| 4 | Dropdown | Chooses which scope you are working in: **User variables** (no admin needed) or **System variables (admin)**. Switching it reloads the list for that scope. | Empty name; it's the scope picker — "User variables / 使用者變數" vs "System variables (admin) / 系統變數（管理員）"。 |
| 5 | Button | Refreshes the list, re-reading the current scope's variables from Windows. | Icon-only refresh button — reload the list / 重新整理清單。 |
| 6 | Edit | Type the variable's name here. Picking a row's edit pencil for a simple variable also fills this box with that name. | "Variable name" (placeholder) — 變數名稱。 |
| 7 | Edit | Type the variable's value here. Wide field because values like PATH can be long. | "Value" (placeholder) — 值。 |
| 8 | Button | Saves the name/value pair to the selected scope (creates it if new, overwrites if it exists), then clears the boxes and refreshes. System scope fails without admin rights. | "Set / 設定" — apply/save the variable / 設定（儲存）變數。 |
| 9–24 | Buttons (rows) | Per-row actions in the variable list — two buttons per row across 8 visible rows. The left button of each pair **edits** that variable (simple values load back into boxes 6–7; semicolon lists like PATH open a per-entry dialog to add, remove, reorder, or Browse… for a folder), and the right button **deletes** that variable from the current scope. | Icon-only row buttons — pencil = edit / 編輯, bin = delete / 刪除。 |

**How to use it · 點用** First pick the scope in the dropdown (4) — User variables work immediately, while System variables (admin) only save if WinForge is running as administrator. To add or change a variable, type its name in box 6 and value in box 7, then click **Set** (8). To modify an existing one, use its row's edit pencil: a PATH-style multi-entry variable opens a friendly editor where each entry is one row you can reorder, remove, or add (including via Browse… to pick a folder). Use the bin button to delete a variable, and the refresh button (5) to reload the list if it falls out of sync.

### Mouse & Pointer · 滑鼠與指標

*Image omitted from the offline bundle: Mouse & Pointer — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | App-shell back button — returns to the previous page in WinForge's navigation history. Not part of this module's settings. | "Back" — go back. |
| 2 | Button | App-shell button that collapses or expands the left navigation pane. Not part of this module's settings. | "Toggle Navigation" — show/hide the side menu. |
| 3 | Search box | Global search box in the app shell. Type to filter and jump to any module, setting, or app across WinForge. Not specific to this page. | "Search everything · 搜尋全部" — search across the whole app; 搜尋全部 = "search all". |
| 4 | Toggle / 開關 | **Swap primary & secondary buttons.** Turning it On makes the right button the primary click (handy for left-handers); Off keeps the left button primary. Applies live via Windows settings and persists. The "Off · 熄" label shown is the switch's current state. | "Off · 熄" = the toggle's off state; 熄 means "off". The card title is "Swap primary & secondary buttons · 交換左右鍵" (swap left/right mouse buttons). |
| 5 | Slider | **Pointer speed.** Drags from 1 to 20 (default 10) to set how fast the cursor moves; the value box on the right shows "n / 20". Applies instantly. | The card title is "Pointer speed · 指標速度" — 指標速度 means "pointer/cursor speed". |
| 6 | Toggle / 開關 | **Enhance pointer precision (acceleration).** On enables Windows pointer acceleration; Off gives 1:1 movement (gamers usually want it Off). Applies live and persists. The "On · 開" label shown is the switch's current state. | "On · 開" = the toggle's on state; 開 means "on". The card title is "Enhance pointer precision (acceleration) · 增強指標精確度（加速）" — improve cursor precision / acceleration. |
| 7 | Slider | **Double-click speed.** Drags from 100 to 900 ms to set the longest gap between two clicks that still counts as a double-click; the value box shows "n ms". Lower = you must click faster. | The card title is "Double-click speed · 雙擊速度" — 雙擊速度 means "double-click speed". |
| 8 | Slider | **Wheel scroll lines.** Drags from 1 to 15 to set how many lines the page scrolls per wheel notch; the value box shows the number. Applies instantly. | The card title is "Wheel scroll lines · 滾輪捲動行數" — 滾輪捲動行數 means "wheel scroll line count". |

**How to use it · 點用** — Scroll through the stacked cards and adjust whatever feels off: flip a toggle (swap buttons, pointer precision) or drag a slider (pointer speed, double-click speed, scroll lines) and the change applies to Windows immediately — no Settings app, no Apply button, and it persists across reboots. The toggle pills (4, 6) read "On · 開" / "Off · 熄" to show the current state, and each slider's right-hand box echoes the live value so you can dial in an exact number. Two further toggles further down the page — "Hide pointer while typing · 打字時隱藏指標" and "Snap to the default button in dialogs · 對話框自動跳去預設按鈕" — work the same way once you scroll to them.

### Keyboard Remapper · 鍵盤重新對應

*Image omitted from the offline bundle: Keyboard Remapper — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button (back) | Navigates back to the previous page in WinForge, leaving the Keyboard Remapper. | "Back" — go back / 返回上一頁. |
| 2 | Button (menu) | Collapses or expands the left navigation pane (hamburger toggle), giving the remapper more width. | "Toggle Navigation" — show/hide the side menu / 開關側邊導覽列. |
| 3 | Search box | The app-wide search field in the title bar; type here to jump to any module or setting in WinForge. It is not specific to this page. | "Search everything · 搜尋全部" — search across the whole app. 搜尋全部 = search everything. |
| 4 | Dropdown (From) | The **source** key picker (`FromBox`). Pick the physical key you want to change — e.g. Caps Lock, Left Ctrl, Left Win. The list holds the common remappable keys (Caps Lock, Left/Right Ctrl/Alt/Shift/Win, Menu, Esc, Tab, Insert, Scroll/Num Lock, Print Screen, Enter, Backspace). | Unlabelled in UIA, but the caption to its left reads "Map · 對應". 對應 = map/correspond — this is the key being mapped *from*. The small arrow after it points to the target box. |
| 5 | Dropdown (To) | The **target** key picker (`ToBox`). Choose what the source key should become — any key from the same list, or the special last item **"✕ Disable key · ✕ 停用此鍵"** to turn the key off entirely. It defaults to "Disable". | Unlabelled in UIA; it is the destination of the "Map · 對應" arrow. 停用此鍵 = disable this key. |
| 6 | Button | "Add" — commits the current From → To pair to the mapping list below. Only one mapping is kept per source key (adding the same source again replaces it); picking the same key for both shows a "Source and target are the same" warning. Nothing is written to the system yet. | "Add · 加入" — add this mapping to the list. 加入 = add. |
| — | List rows | Each row in the card lists one pending mapping as *SourceName → TargetName*, with a small **✕ (delete)** button on the right that removes just that row from the list (not yet applied to the system). | Per-row trash/✕ button = remove this one mapping / 移除呢個對應. |
| 7 | Button | "Apply (reboot)" — writes all listed mappings into the system **Scancode Map** registry value (HKLM). Needs administrator rights; if denied it tells you to relaunch WinForge as admin. Changes take effect only **after a reboot**. | "Apply (reboot) · 套用（重啟）" — apply now, but you must restart. 套用 = apply, 重啟 = reboot. |
| 8 | Button | "Clear all" — deletes the entire Scancode Map from the registry and empties the list, restoring all keys to their defaults after a reboot. | "Clear all · 全部清除" — remove every remap. 全部清除 = clear everything. |

**How to use it · 點用** — Pick the key you want to change in the left **Map · 對應** dropdown (4), pick what it should become — or **Disable key** — in the right dropdown (5), then press **Add** (6); repeat to stack up several mappings, each shown as a row you can delete with its ✕. When the list looks right, press **Apply (reboot)** (7) to write the Scancode Map (this prompts for admin and needs a restart to take effect), or **Clear all** (8) to wipe every remap. Remember nothing is live until you reboot, so finish your edits first, then apply once.

### Volume Mixer · 音量混合器

*Image omitted from the offline bundle: Volume Mixer — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|-------------------------|
| 1 | Button | Returns to the previous page in WinForge, leaving the Volume Mixer. | "Back" — go back / 返回上一頁. |
| 2 | Button | Shows or hides the app's left navigation pane so you can jump to other modules or widen the content area. | "Toggle Navigation" — toggle the side navigation menu / 開關側邊導覽列. |
| 3 | Search box | Global WinForge search; type here to find any module, setting, or tool across the whole app (not just the mixer). | "Search everything · 搜尋全部" — search across the entire app; 搜尋全部 = "search all". |
| 4 | Button (Rescan) | Re-reads the audio devices and re-enumerates every app currently playing sound, rebuilding the list of volume cards. Use it after you start or close an app. In code this is the `Rescan` / `Refresh_Click` button that calls `Build()`. | Icon-with-text refresh button labelled "Rescan · 重新掃描" — 重新掃描 = "scan again / re-scan". |
| 5 | Button | Closes the Volume Mixer page (or its containing pane). | "Close" — close / 關閉. |

The audio content itself is built dynamically below these controls, so it does not carry its own annotation numbers, but it is the heart of the module. The first card is the **Master volume · 主音量** (accent-coloured); beneath it appears one card per app that is currently producing sound, each showing the app name and its `PID`. Every card has a **mute button** on the left (toggles between the speaker and muted-speaker icon, tooltip "Mute / unmute · 靜音／取消"), a **volume slider** (0–100) in the middle, and a live **percentage** on the right.

**How to use it · 點用:** Drag the master slider to set the overall system level, then drag any app's slider to balance individual apps against each other — changes apply instantly via Core Audio/WASAPI. Click an app's speaker icon to mute or unmute just that app (dragging its slider auto-unmutes it, exactly like the Windows mixer). If an app you expect is missing, make sure it is actually playing audio, then press **Rescan (4)** to refresh the list.
