# FAQ & Safety · 常見問題與安全

A plain-English (plus 粵語) answer sheet for the questions people ask before they start flipping toggles: is this safe, what needs administrator rights, where does WinForge keep my data, and how do I undo something. Every answer here is grounded in WinForge's actual code — `AdminHelper`, `CrashLogger`, `SettingsStore`, `ConfigBackupService`, `ClipboardService`, `TrayService` and the `LauncherTweaks` catalog.

> WinForge 係 Windows 11 全方位控制中心，每個開關都會**真正改到部機**。所以開始之前，請先睇清楚呢頁嘅安全同常見問題。

---

## At a glance · 一眼睇晒

| Question · 問題 | Short answer · 簡答 |
|---|---|
| Is it safe? · 安唔安全？ | The tweaks change real Windows settings. Most are reversible; read each card first. · 大部分可逆，套用前睇清楚說明。 |
| Are changes reversible? · 可唔可以還原？ | Toggles flip back; choices reset; **Config & Backup** keeps git snapshots you can restore. · 開關撳返轉頭、快照可還原。 |
| Does it need admin? · 使唔使管理員？ | Only some tweaks (system-wide / HKLM / services / power). The app has one-click relaunch. · 部分先需要，一鍵重啟提權。 |
| Where is my data? · 資料喺邊？ | Everything under `%LOCALAPPDATA%\WinForge` — local only, no cloud. · 全部喺本機，唔上雲。 |
| Does it run in background? · 會唔會背景運行？ | Yes — closing hides to the **tray**; clipboard + hotkeys keep running. · 關窗收入系統匣，背景照跑。 |
| What's the licence? · 咩授權？ | **MIT**, "use at your own risk". · MIT 授權，自行承擔風險。 |

---

## Safety & reversibility · 安全與可逆

> **Safety · 安全** — These tweaks modify **real** Windows settings: registry keys, power plans, the network stack, privacy flags, Defender, services and on-disk cleanup. Most are reversible (toggle them back), but some need **administrator rights** or a **restart / sign-out** to take effect. Always read a card's bilingual description before applying it. WinForge is provided "as is" — **use at your own risk** (see the MIT [LICENSE](https://github.com/codingmachineedge/WinForge/blob/main/LICENSE)).

### Is WinForge safe to use? · WinForge 安唔安全？

WinForge is *honest about what it does*. The in-app **About** page states it directly:

> "These tweaks modify real Windows settings. Changes are reversible where possible, but please read each description first. Some require administrator rights or a restart to take effect."

Nothing is faked — every `TweakCard` maps to a documented Windows setting or a real command (`reg`, `sc`, `netsh`, `powercfg`, `sfc`, `DISM`, `winget`, `schtasks`, PowerShell). The risk is the same risk as editing those settings by hand; WinForge just makes them discoverable, bilingual, and one click away. The two things that protect you:

- **Read-before-apply** — every card carries a bilingual **title + description** and shows **admin / restart badges** where relevant, so you know the consequence before you act.
- **Config snapshots** — the **Config & Backup** module takes git-versioned snapshots of your settings that you can diff and restore (see [Undo & restore](#undo--restore--還原與復原)).

### Are changes reversible? · 啲改動可唔可以還原？

In almost all cases, **yes**:

- **Toggle tweaks** (`Boolean` registry coordinates) flip straight back — switch the card off and the original value is rewritten.
- **Choice tweaks** (a choice set, e.g. telemetry level, power plan) let you pick the original option again.
- **Command tweaks** (shell / PowerShell) are the ones to read carefully — some are *one-way actions* (a cleanup that deletes temp files, a DNS flush, an `sfc /scannow`). These don't have an "undo button" because there's nothing to undo a deletion *to*. Destructive cards are flagged `destructive` in the catalog.

For a belt-and-braces undo of *configuration* changes, take a snapshot **before** a tweaking session — see below.

### What is genuinely irreversible? · 邊啲真係冇得返轉頭？

- **Cleanup & Storage** operations — emptying the Recycle Bin, clearing the Update cache, deleting temp files / thumbnails / event logs. The files are gone.
- **Network resets** — `netsh winsock reset`, TCP/IP reset (these need a restart and re-establish defaults).
- **Repair operations** — `sfc /scannow`, `DISM /RestoreHealth` modify system files in place.
- The **launcher.remove** / daily-backup-removal actions delete the scheduled task and shortcuts.

Read the description, and where the card is marked destructive, treat it like you would the same command in a terminal.

---

## Administrator rights · 管理員權限

### What needs administrator and why? · 邊啲要管理員，點解？

WinForge runs fine as a **standard user** for the bulk of its modules. Some operations are *system-wide* and Windows itself requires elevation for them. As the **Settings** page puts it, admin is needed for *"system-wide tweaks (HKLM, services, power)"* · 全系統調校需要（HKLM、服務、電源）。

Typical things that require admin:

| Needs admin · 要管理員 | Why · 點解 |
|---|---|
| **HKLM registry tweaks** | Writing under `HKEY_LOCAL_MACHINE` (machine-wide policy) requires elevation; `HKCU` (your own user hive) does not. |
| **Services** | Start / stop / change services (`sc`, service control). |
| **Power & boot** | Some `powercfg` and boot-configuration changes. |
| **Security** | UAC level, firewall, SmartScreen, Defender scans, Remote Desktop. |
| **Repair tools** | `sfc`, `DISM`, system file operations. |
| **HKLM startup items** | Toggling machine-wide `Run` entries. |
| **No-UAC launcher setup** | Registering the Task Scheduler task needs admin **once** (see below). |

### How do I run WinForge as administrator? · 點樣以管理員身分運行？

The app detects its own elevation via `AdminHelper.IsElevated`. On the **Settings** page:

- If elevated, it shows **"✓ Running as administrator · ✓ 正以管理員身分運行"**.
- If not, it shows a **"Relaunch as administrator · 以管理員身分重新啟動"** button. Clicking it calls `RelaunchElevated()`, which relaunches the same `.exe` with the `runas` verb (triggering one UAC prompt) and exits the old instance. If you decline the UAC prompt, nothing happens and the original instance keeps running.

The **Launcher** category also has a live **"Elevation status · 提權狀態"** info card that reports `Elevated · 已提權` or `Standard user · 標準使用者`.

> **Safety · 安全** — Only relaunch elevated when a tweak actually asks for it. Running every app as administrator all the time is a habit worth avoiding; WinForge is designed so you stay a standard user until a specific system-wide change needs more.

### The no-UAC elevated launcher · 免 UAC 提權啟動器

WinForge ships an optional convenience: a launcher that starts the app **elevated with NO UAC prompt**, defined in `Catalog/LauncherTweaks.cs`. It works the standard Windows way — a **Task Scheduler** task with `RunLevel = Highest` plus a shortcut that triggers it:

| Operation · 操作 | What it does · 做乜 | Admin? |
|---|---|---|
| **Create no-UAC elevated launcher · 建立免 UAC 提權啟動器** | Registers a scheduled task `WinForgeSuiteElevated` (highest privileges) **and** creates a `WinForge (Admin).lnk` shortcut on the **Desktop** and in the **Start menu** that runs it. | Yes (once) |
| **Run WinForge elevated now · 立即以管理員運行** | `schtasks.exe /run /tn WinForgeSuiteElevated` — starts a fresh elevated instance with no prompt (launcher must be set up first). | No |
| **Remove the elevated launcher · 移除提權啟動器** | `Unregister-ScheduledTask` + deletes both shortcuts. | Yes (destructive) |
| **Open Task Scheduler · 開啟工作排程器** | `mmc.exe taskschd.msc` so you can inspect the task yourself. | No |
| **Elevation status · 提權狀態** | Read-only: is *this* instance elevated. | — |

The trade-off, stated plainly: **creating** the task needs admin once (and one UAC prompt). After that, the shortcut launches elevated forever with no further prompts. That's the same mechanism many power-user tools use, and it's fully reversible via **Remove the elevated launcher**.

> **Safety · 安全** — A no-UAC elevated shortcut is a convenience, not a default. Anything that can run that shortcut runs WinForge as administrator without asking. Only set it up on a machine you control, and remove it (one click) if you no longer want it. The task is plainly named `WinForgeSuiteElevated` and visible in Task Scheduler.

See [Installation-and-Build](app-doc://article/winforge.wiki.f0839216d2277fe7) for build/run details.

---

## Where WinForge stores things · WinForge 將資料存喺邊

**Everything lives under one folder — `%LOCALAPPDATA%\WinForge`** (i.e. `C:\Users\<you>\AppData\Local\WinForge`). It is **local only**: WinForge does not phone home and does not sync anything to a cloud account.

| What · 內容 | Path · 路徑 | Notes · 備註 |
|---|---|---|
| **Settings · 設定** | `%LOCALAPPDATA%\WinForge\settings.json` | Language lead, theme, full-screen flag, etc. Plain indented JSON. (`SettingsStore`) |
| **Crash log · 當機記錄** | `%LOCALAPPDATA%\WinForge\crash.log` | Appended timestamped exception dumps, including early `FirstChance:` loader faults caught before `Main`. (`CrashLogger` / `StartupDiagnostics`) |
| **Startup trace · 啟動追蹤** | `%LOCALAPPDATA%\WinForge\startup-trace.log` | Per-launch step markers (truncated each launch) for diagnosing a slow or failed startup. (`CrashLogger.Mark`) |
| **Config snapshots · 設定快照** | `%LOCALAPPDATA%\WinForge\snapshots` | A local **git repo** of settings history (+ a captured `apps.json` winget list). (`ConfigBackupService`) |
| **Clipboard history · 剪貼簿記錄** | `%LOCALAPPDATA%\WinForge\clipboard` | `history.json` + saved `clip-*.png` images, with its **own local git log**. (`ClipboardService`) |

Because it's all under your local profile, you can inspect, back up, or delete any of it by hand. The settings store and snapshots are designed to survive corruption gracefully — a broken `settings.json` is simply ignored and rebuilt.

### Does WinForge run in the background / sit in the tray? · 會唔會背景運行／喺系統匣？

**Yes.** WinForge installs a **system-tray icon** (`TrayService`, pure `Shell_NotifyIcon` P/Invoke — no third-party dependency). The behaviour:

- **Closing the window does not quit the app.** `AppWindow.Closing` is intercepted and the window is *hidden to the tray* instead. Background work — the **clipboard monitor** and the **global hotkey pump** — keeps running.
- **Tray menu** (right-click): **"Open WinForge · 開啟 WinForge"** and **"Quit · 結束"**. Left-click / double-click reopens the window.
- **Quit** (from the tray menu) is the *only* thing that actually exits and removes the tray icon.
- **Run on login** — the startup manager can register WinForge to start with Windows **minimized to the tray** (the app accepts a `--minimized` flag and calls `StartHiddenInTray()`), so the clipboard history and hotkeys are live from boot without a window popping up.

If you'd rather it *not* live in the background, simply use **Quit** from the tray menu, and don't enable run-on-login.

### Kiosk / full-screen mode · Kiosk／全螢幕模式

WinForge is described as a **"kiosk-style control center"**, meaning it can run as a single full-screen surface:

- It opens **windowed by default** (roughly 82% of the screen).
- **F11** toggles **full-screen** (`AppWindowPresenterKind.FullScreen`); F11 again returns to a normal overlapped window.
- The choice is **remembered** across launches (persisted as the `fullscreen` key in `settings.json`).

This is presentation only — it does not lock down the machine or replace the Windows shell; it's a roomy full-screen layout for the suite, not an enterprise assigned-access kiosk.

---

## Undo & restore · 還原與復原

### How do I undo a single tweak? · 點樣還原一項調校？

1. **Toggle / choice tweaks** — open the card again and flip the toggle back, or re-select the original option. The card always shows both languages so you know exactly what you're reverting.
2. **Command tweaks** — if the description says it's a one-way action (cleanup, reset, repair), there is no in-card undo; treat it accordingly.

### How do I roll back a whole session? · 點樣還原成批改動？

Use the **Config & Backup** module (`ConfigBackupService`), which keeps a **git snapshot repo** of your configuration:

- **Take a snapshot · 影快照** — writes the current settings (and a winget app list) into the snapshots repo and commits them with a timestamp. Take one *before* a tweaking session.
- **List snapshots · 睇快照** — browse the history (newest first), each with a short hash, date and message.
- **Restore a snapshot · 還原快照** — checks out a past snapshot and re-applies it. It is **non-destructive**: WinForge automatically commits an `auto: before restore` safety snapshot first, so you can never paint yourself into a corner.
- **Diff · 比較** — see exactly what changed between now and any snapshot.
- **Export a `.reg` backup** — exports the **HKCU keys WinForge is known to touch** (Explorer Advanced, Taskbar pins, Search, Personalize/dark mode, Advertising ID, Suggestions, Desktop, Mouse, Keyboard, Clipboard, Environment) into one human-reviewable `.reg` file. Only HKCU keys are included, so **this export needs no admin**.
- **Portable `.zip` bundle** — export/import all settings with a version manifest + SHA-256 checksums; **Verify integrity** runs `git fsck` and re-checks the checksums.

> **Tip · 提示** — A snapshot before you start is the cheapest insurance there is. `Config & Backup → Take snapshot`, then tweak freely.

See [Windows-Tweaks-Overview](app-doc://article/winforge.wiki.d61526cf4cd055ec) for how individual tweaks are structured.

---

## Common gotchas · 常見問題

### Why are some lists empty until I run as admin? · 點解唔做管理員啲清單係空？

Several modules read **machine-wide** state that Windows simply won't reveal to a standard-user process — for example HKLM `Run` startup entries, certain services, and other privileged inventories. When WinForge isn't elevated, those queries return nothing (or a partial list), so a panel can look empty. **Relaunch as administrator** (Settings → the relaunch button, or the no-UAC launcher) and the lists populate. This is a Windows permission boundary, not a bug.

### Why didn't my tweak take effect immediately? · 點解套用咗都未生效？

Some Windows settings only apply after a **restart, sign-out, or restarting Explorer**. Cards that need this carry a **restart badge**. After importing a settings bundle, WinForge even says so: *"Restart WinForge for all of them to take effect · 重開 WinForge 全部即生效."*

### Why did the app survive a module error instead of crashing? · 點解一個模組出錯都冇冧 app？

By design. `CrashLogger` installs global handlers for XAML, `AppDomain` and unobserved task exceptions at startup. A faulting page or handler is **caught, logged to `crash.log`, and swallowed** rather than taking the whole suite down — *"A single module's error should never take the whole app down · 一個模組出錯唔應該拖冧成個 app."* If a module misbehaves, check `%LOCALAPPDATA%\WinForge\crash.log`.

### The app won't open / closes instantly at startup · 一開就閃退

A startup that dies **before any window** — Windows logs a crash in `Microsoft.UI.Xaml.dll` with exit code **`0xC000027B`** (a *stowed exception*) — is almost always a **type that failed to load** during WinUI's XAML type-table init. The generated `XamlTypeInfoProvider.InitTypeTables()` eagerly resolves **every** XAML-referenced type on the *first* XAML load (App.xaml's `XamlControlsResources`), which runs before `OnLaunched` — so even a type used only on a later page is loaded at startup, and the in-app `CrashLogger` never gets a turn. The earliest diagnostic is [`Services/StartupDiagnostics.cs`](https://github.com/codingmachineedge/WinForge/blob/main/Services/StartupDiagnostics.cs): a `[ModuleInitializer]` that runs *before* `Main` and writes any loader fault (TypeLoad, missing assembly/method/member, bad image) to `crash.log` as a `FirstChance:` entry — turning the opaque native code into a **named managed exception**.

> **One real example · 一個真實例子** — referencing **both** the `LibVLCSharp` and `LibVLCSharp.WinUI` NuGet packages (both ship an assembly named `LibVLCSharp.dll`) deployed the wrong flavour, so the Media Player's `VideoView` type was missing and **every** launch fail-fasted — a **100% deterministic** crash. It was fixed *permanently* by referencing only `LibVLCSharp.WinUI` (a one-line csproj change); a retry can't paper over a crash that happens every time. The separate **`WinForgeLauncher.exe`** supervisor — which relaunches the app on an early `0xC000027B` — is a safety net for *transient* fail-fasts, **not** the fix for a deterministic one. If you add a WinUI control from NuGet and the app suddenly won't start, check `crash.log` first. 加完 NuGet 控制項之後開唔到 app，先睇 `crash.log`。

### Is anything sent over the network? · 會唔會上網？

WinForge's tweaks and storage are local. Individual *modules* may reach the network when that's their whole purpose (e.g. the Package Manager talks to winget/Scoop/etc. sources, the Git module talks to GitHub via `gh`) — but that's the explicit job of those tools, not background telemetry. There is no WinForge analytics/telemetry phone-home.

---

## Licence & disclaimer · 授權與免責聲明

**EN —** WinForge is released under the **MIT License**. It is provided **"as is", without warranty of any kind**. In the README's own words: *"These tweaks modify real Windows settings… Use at your own risk."* The About page footer reads **"Version 1.0.0 · MIT License · Built with .NET + WinUI 3."**

**粵語 —** WinForge 以 **MIT 授權條款**發佈，按「現狀」提供，**不附任何形式嘅保證**。呢啲調校會改到真實嘅 Windows 設定，**自行承擔風險**。

Full text: [LICENSE](https://github.com/codingmachineedge/WinForge/blob/main/LICENSE) in the repo.

> **Safety · 安全** — "Use at your own risk" is not boilerplate here. WinForge can change privileged system state. Take a snapshot first, read each card, and only elevate when a tweak truly needs it.

---

## Reporting issues · 回報問題

The project lives at **[github.com/codingmachineedge/WinForge](https://github.com/codingmachineedge/WinForge)** (the in-app About page links straight to it). To report a problem:

1. **Reproduce** the issue and note which **module / tweak** and whether you were running **as administrator**.
2. **Grab the crash log** — `%LOCALAPPDATA%\WinForge\crash.log` (open the folder by pasting that path into Explorer's address bar). Attach the relevant timestamped block.
3. **Open a GitHub issue** at `https://github.com/codingmachineedge/WinForge/issues` with: your **Windows 11 build**, whether the app was **elevated**, the exact card/operation, and what you expected vs. what happened.
4. For a **bad tweak**, mention the card's English **or** 粵語 title (both appear on every card) so it can be found in the catalog quickly.

The sole contributor is **Claude**, so a clear, self-contained report with the crash-log excerpt is the fastest path to a fix.

---

_Part of [Home](app-doc://article/winforge.wiki.355883cf07556dda) · WinForge wiki._
