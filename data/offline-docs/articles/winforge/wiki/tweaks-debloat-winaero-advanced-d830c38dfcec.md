# Tweaks: Debloat, Winaero & Windows 11 Advanced · 去煩擾、Winaero 與進階

These three catalog categories sit at the "power-user" end of WinForge's tweak engine. **Debloat / Annoyances** kills the most-complained-about Windows 11 nags — Copilot, Recall, Bing-in-Start, lock-screen ads and the never-ending "finish setting up your device" pop-ups. **Winaero Tweaks** is a Winaero-Tweaker-style grab bag of appearance, behavior, boot/logon, Explorer, context-menu and privacy refinements. **Windows 11 Advanced** (the `Win11Pro` catalog) bundles input/locale, snap & notification, performance/boot and Explorer power-options plus dozens of one-click Settings deep-links. A short read-only **System Information** category rounds out the page.

> 呢三個分類係 WinForge tweak 引擎入面最「進階」嗰批。去煩擾／除臃腫負責熄 Copilot、Recall、Bing 搜尋同一大堆廣告與纏擾；Winaero 係 Winaero-Tweaker 風格嘅外觀、行為、開機登入、檔案總管、右鍵選單同私隱微調；Windows 11 進階就有輸入／地區、貼齊與通知、效能與開機、Explorer 進階選項加幾十條設定深層連結。最後仲有一個唯讀嘅系統資訊分類。

*Image omitted from the offline bundle: Debloat & Annoyances tweaks.*

Every row here is a real `TweakDefinition` — a registry coordinate, a choice set, or a wrapped shell / PowerShell / DISM / `bcdedit` command — rendered by the shared **TweakCard**. Toggles really write the registry; commands really run. See [Windows-Tweaks-Overview](app-doc://article/winforge.wiki.d61526cf4cd055ec) for how cards, restart scopes and the admin model work across all 22 categories.

> **Safety · 安全** — Many tweaks on this page require **admin (HKLM)** and some are flagged **destructive** (e.g. disabling SysMain, disabling the HPET timer). Several change shutdown/boot/logon behavior. Read each card's description, and prefer testing on a non-critical machine. Anything that needs a sign-out or reboot says so via its restart scope.

---

## 1 · Debloat & Annoyances · 去煩擾／除臃腫

Source: `Catalog/AnnoyanceTweaks.cs`. Two logical groups: **copilot-search** (AI assistants, Copilot/Recall, web search in Start) and **ads-nags** (lock-screen Spotlight, Settings suggestions, Start recommendations, consumer features). Most are per-user (HKCU); the policy-level ones are admin (HKLM). Several restart Explorer; a few need sign-out or reboot.

### copilot-search · Copilot、Recall 同搜尋

| Tweak (EN · 粵語) | What it does | Key / value | Root · admin · restart |
|---|---|---|---|
| **Turn off Windows Copilot · 熄 Windows Copilot** | Disables the Copilot integration | `WindowsCopilot\TurnOffWindowsCopilot` = 1 | HKCU · Explorer |
| **Turn off Recall snapshots · 熄 Recall 截圖記錄** | Stops Recall continuously snapshotting your screen | `WindowsAI\DisableAIDataAnalysis` = 1 | HKCU · Explorer |
| **Turn off search box web suggestions · 熄搜尋框嘅網上建議** | Kills web suggestions in the Start search box | `Policies\…\Explorer\DisableSearchBoxSuggestions` = 1 | HKCU · Explorer |
| **Turn off Bing in Start search · 熄開始搜尋嘅 Bing** | Removes Bing / web results from Start search | `…\Search\BingSearchEnabled` = 0 | HKCU · Explorer |
| **Turn off Cortana consent in search · 熄搜尋度嘅 Cortana 同意** | Clears the Cortana web-search consent flag | `…\Search\CortanaConsent` = 0 | HKCU · Explorer |
| **Turn off Search Highlights · 熄搜尋焦點** | Stops the rotating illustrations/trivia | `SearchSettings\IsDynamicSearchBoxEnabled` = 0 | HKCU · Explorer |
| **Turn off Cortana · 熄 Cortana** | Blocks Cortana entirely via policy (all users) | `Windows Search\AllowCortana` = 0 | HKLM · admin · reboot |
| **Turn off web search in Search · 熄搜尋度嘅網上搜尋** | Stops Search connecting to the web | `Windows Search\ConnectedSearchUseWeb` = 0 | HKLM · admin · reboot |
| **Turn off web results in Search (policy) · 用原則熄搜尋嘅網上結果** | Keeps Search strictly local | `Windows Search\DisableWebSearch` = 1 | HKLM · admin · reboot |
| **Turn off Cortana above lock screen · 熄鎖屏上面嘅 Cortana** | Cortana unusable above lock | `Windows Search\AllowCortanaAboveLock` = 0 | HKLM · admin · reboot |
| **Turn off Edge Copilot sidebar · 熄 Edge Copilot 側欄** | Hides the Copilot/hubs sidebar button | `Edge\HubsSidebarEnabled` = 0 | HKLM · admin |
| **Turn off Edge shopping assistant · 熄 Edge 購物助手** | Disables shopping/discover & price compare | `Edge\EdgeShoppingAssistantEnabled` = 0 | HKLM · admin |
| **Turn off Edge Collections · 熄 Edge Collections** | Hides the Collections button | `Edge\EdgeCollectionsEnabled` = 0 | HKLM · admin |
| **Turn off Edge Copilot page context · 熄 Edge Copilot 讀取頁面內容** | Stops Edge Copilot reading page content | `Edge\CopilotPageContext` = 0 | HKLM · admin |
| **Remap the Copilot key to do nothing · 將 Copilot 鍵改成乜都唔做** | Clears the dedicated Copilot key's launch CLSID mapping | `reg add …CLSID\{2781761E-…}\InprocServer32 /ve` | HKCU cmd · Explorer |
| **Turn off Click to Do · 熄 Click to Do** | Disables the AI "Click to Do" overlay via policy | `reg add …WindowsAI /v DisableClickToDo /d 1` | HKCU cmd · Explorer |
| **Remove the Copilot app · 移除 Copilot app** | Policy-removes the standalone Copilot app | `WindowsAI\RemoveMicrosoftCopilotApp` = 1 | HKCU · sign-out |

### ads-nags · 廣告同纏擾

| Tweak (EN · 粵語) | What it does | Key / value | Root · admin · restart |
|---|---|---|---|
| **Turn off lock-screen Spotlight tips · 熄鎖機畫面 Spotlight 提示** | Stops rotating lock-screen tips/promos | `ContentDeliveryManager\RotatingLockScreenOverlayEnabled` = 0 | HKCU |
| **Turn off lock-screen fun facts & tips · 熄鎖機畫面趣聞同貼士** | Hides Spotlight "fun facts" | `SubscribedContent-338387Enabled` = 0 | HKCU |
| **Hide suggested content in Settings (1/2/3) · 收埋設定建議內容** | Three cards remove Settings promo content | `SubscribedContent-338393 / 353694 / 353696 Enabled` = 0 | HKCU |
| **Turn off "Get even more out of Windows" nag · 熄「再進一步善用 Windows」纏擾** | Kills the post-update SCOOBE finish-setup screen | `UserProfileEngagement\ScoobeSystemSettingEnabled` = 0 | HKCU |
| **Skip welcome experience after updates · 更新後跳過歡迎畫面** | Removes the post-update highlights page | `SubscribedContent-310093Enabled` = 0 | HKCU |
| **Turn off tips & suggestions (soft landing) · 熄提示同建議** | Disables the soft-landing tip pop-ups | `SoftLandingEnabled` = 0 | HKCU |
| **Turn off Windows tips notifications · 熄 Windows 貼士通知** | Stops "tips, tricks, suggestions" notifications | `SubscribedContent-338389Enabled` = 0 | HKCU |
| **Hide File Explorer sync-provider ads · 收埋檔案總管嘅 sync 推廣** | Disables OneDrive/sync promo banners in Explorer | `Explorer\Advanced\ShowSyncProviderNotifications` = 0 | HKCU · Explorer |
| **Turn off account notifications in Start · 熄開始選單嘅帳戶通知** | Stops account nags in Start | `Explorer\Advanced\Start_AccountNotifications` = 0 | HKCU · Explorer |
| **Reduce Start "recommended" suggestions · 減少開始選單「建議」推介** | Turns off Iris-driven Start recommendations | `Start_IrisRecommendations` = 0 | HKCU · Explorer |
| **Turn off Start menu app suggestions · 熄開始選單嘅 App 建議** | Stops suggested apps in Start | `SubscribedContent-338388Enabled` = 0 | HKCU · Explorer |
| **Stop silently installing suggested apps · 唔好靜雞雞裝建議 App** | Disables auto-installing promoted Store apps | `SilentInstalledAppsEnabled` = 0 | HKCU |
| **Turn off general content suggestions · 熄一般內容建議** | Master CDM switch for suggested content | `ContentDeliveryAllowed` = 0 | HKCU |
| **Disable the Widgets board · 停用小工具面板** | Turns off the news & interests Widgets board (all users) | `reg add …Dsh /v AllowNewsAndInterests /d 0` | HKLM cmd · admin · Explorer |
| **Disable Windows consumer features · 停用 Windows 消費者功能** | Stops auto-installing promoted apps & consumer suggestions | `CloudContent\DisableWindowsConsumerFeatures` = 1 | HKLM · admin · sign-out |
| **Hide the Settings homepage · 隱藏設定首頁** | Hides the ad-laden Settings Home so it opens to System | `Policies\Explorer\SettingsPageVisibility` = `hide:home` (string) | HKLM · admin |

**The big three people look for:**
- **Copilot · Copilot** — `annoy.copilot-off` (policy), `annoy.remove-copilot-app` (removes the app), and `annoy.copilot-key-remap` (neuters the hardware Copilot key).
- **Recall · Recall** — `annoy.recall-off` writes `DisableAIDataAnalysis` so Recall stops snapshotting the screen.
- **Bing / web in Start · Bing** — `annoy.bing-search-off`, `annoy.search-web-off`, `annoy.disable-web-search-policy-off` and the HKCU `DisableSearchBoxSuggestions` row all push Start search back to local-only.

> Tip — flip a whole cluster at once. The **[Recipes](app-doc://article/winforge.wiki.25b5a715032d1e0a)** page chains many of these annoyance toggles into one-click "debloat" presets so you don't have to hunt each card individually.

---

## 2 · Winaero Tweaks · Winaero 進階調校

*Image omitted from the offline bundle: Winaero-style tweaks.*

Source: `Catalog/WinaeroTweaks.cs`. Winaero-Tweaker-style refinements, all real registry keys and all reversible — when a tweak's "off" value is `null`, turning it off **deletes** the value so Windows reverts to its default behavior. Grouped into appearance, behavior, boot/logon, desktop & Explorer, context-menu and privacy/network.

### Appearance · 外觀

| Tweak (EN · 粵語) | What it does | Key / value | Root · restart |
|---|---|---|---|
| **Colored title bars · 彩色標題列** | Accent color on active title bars & borders | `DWM\ColorPrevalence` = 1 | HKCU |
| **Accent on Start, taskbar, action center · 開始/工作列/操作中心強調色** | Accent on those surfaces (Personalize key) | `Themes\Personalize\ColorPrevalence` = 1 | HKCU |
| **Inactive title bar color · 非作用中標題列顏色** | Custom color for background windows' title bars (0x00BBGGRR; default mid-gray 8421504) | `DWM\AccentColorInactive` = 8421504 | HKCU |
| **Menu show delay · 選單顯示延遲** | Snappier sub-menus — 0 ms vs default 400 | `Control Panel\Desktop\MenuShowDelay` = "0" | HKCU · sign-out |
| **Disable Aero Shake · 停用搖晃視窗** | Shaking a title bar no longer minimizes others | `Explorer\Advanced\DisallowShaking` = 1 | HKCU · Explorer |
| **Classic balloon tips · 傳統氣球提示** | Old XP/Win7 balloons instead of toasts | `Policies\…\Explorer\EnableLegacyBalloonNotifications` = 1 | HKCU · sign-out |
| **Scrollbar width · 捲動列闊度** | Thicker bars — "-360" (~24 px) vs default "-255" | `Desktop\WindowMetrics\ScrollWidth` = "-360" | HKCU · sign-out |
| **Desktop icon spacing · 桌面圖示水平間距** | Wider gaps — "-1500" (100 px) vs default "-1125" | `WindowMetrics\IconSpacing` = "-1500" | HKCU · sign-out |

### Behavior · 行為 (shutdown / hang timeouts / lock)

| Tweak (EN · 粵語) | What it does | Key / value | Root · admin · restart |
|---|---|---|---|
| **Disable Shutdown Event Tracker · 停用關機事件追蹤器** | Removes the "why did the PC shut down?" prompt | `…\Reliability\ShutdownReasonUI` = 0 | HKLM · admin · sign-out |
| **Auto-End Tasks on Shutdown · 關機時自動結束工作** | Force-closes hung apps instead of the "preventing shutdown" screen | `Desktop\AutoEndTasks` = "1" | HKCU · sign-out |
| **Hung App Timeout (1s) · 程式無回應等候時間** | 1000 ms vs 5000 default → End Task prompt faster | `Desktop\HungAppTimeout` = "1000" | HKCU · sign-out |
| **Wait To Kill App Timeout (2s) · 強制結束程式等候時間** | 2000 ms vs 20000 default → faster shutdown | `Desktop\WaitToKillAppTimeout` = "2000" | HKCU · sign-out |
| **Wait To Kill Service Timeout (2s) · 強制結束服務等候時間** | 2000 ms vs 5000 default for services | `…\Control\WaitToKillServiceTimeout` = "2000" | HKLM · admin · reboot |
| **Disable Win+L Lock · 停用 Win+L 鎖定** | Disables Win+L and removes Lock from Ctrl+Alt+Del/Start | `Policies\System\DisableLockWorkstation` = 1 | HKCU · sign-out |

### Boot & Logon · 開機與登入

| Tweak (EN · 粵語) | What it does | Key / value | Root · admin · restart |
|---|---|---|---|
| **Disable lock screen · 停用上鎖畫面** | Skips lock screen, straight to password | `Personalization\NoLockScreen` = 1 | HKLM · admin · sign-out |
| **Show last interactive logon info · 顯示上次互動登入資訊** | Shows last good + failed logon attempts | `Policies\System\DisplayLastLogonInfo` = 1 | HKLM · admin · sign-out |
| **Disable "Press Ctrl+Alt+Del" at logon · 停用登入 Ctrl+Alt+Del** | Removes the secure attention sequence | `Policies\System\DisableCAD` = 1 | HKLM · admin · sign-out |
| **Disable Windows startup sound · 停用開機音效** | Mutes the boot chime | `…\BootAnimation\DisableStartupSound` = 1 | HKLM · admin |
| **Disable automatic restart sign-on (ARSO) · 停用自動重啟登入** | No auto sign-in after Update reboots | `Policies\System\DisableAutomaticRestartSignOn` = 1 | HKLM · admin |
| **Disable blur on sign-in · 停用登入畫面模糊** | Sharp sign-in background (no acrylic blur) | `System\DisableAcrylicBackgroundOnLogon` = 1 | HKLM · admin · sign-out |
| **Disable sign-in background image · 停用登入背景圖** | Plain accent color instead of the picture | `System\DisableLogonBackgroundImage` = 1 | HKLM · admin · sign-out |
| **Enable Num Lock at startup · 開機時開啟 Num Lock** | Num Lock on at the sign-in screen | `.DEFAULT\…\Keyboard\InitialKeyboardIndicators` = "2147483650" | HKU · admin · sign-out |

### Desktop & Explorer · 桌面與檔案總管

| Tweak (EN · 粵語) | What it does | Key / value | Root · admin · restart |
|---|---|---|---|
| **Open Explorer to This PC · 檔案總管開啟「本機」** | This PC view instead of Home | `Explorer\Advanced\LaunchTo` = 1 | HKCU · Explorer |
| **Show seconds in taskbar clock · 工作列時鐘顯示秒數** | Tray clock shows seconds | `ShowSecondsInSystemClock` = 1 | HKCU · Explorer |
| **End task on taskbar right-click · 工作列右鍵加入結束工作** | Adds End task to the taskbar context menu | `TaskbarDeveloperSettings\TaskbarEndTask` = 1 | HKCU · Explorer |
| **Disable thumbnail cache · 停用縮圖快取** | No thumbs.db / central cache | `Advanced\DisableThumbnailCache` = 1 | HKCU · Explorer |
| **Expand to current folder · 導覽窗格展開至目前資料夾** | Nav pane auto-expands to the open folder | `NavPaneExpandToCurrentFolder` = 1 | HKCU · Explorer |
| **Show drive letters first · 磁碟機代號顯示喺前** | (C:) before the label in This PC | `Explorer\ShowDriveLettersFirst` = 4 | HKLM · admin · Explorer |
| **Checkboxes for item selection · 用核取方塊選取項目** | Selection checkboxes on files/folders | `Advanced\AutoCheckSelect` = 1 | HKCU · Explorer |
| **Use compact view · 使用精簡檢視** | Denser row spacing | `Advanced\UseCompactMode` = 1 | HKCU · Explorer |
| **Show Explorer status bar · 顯示狀態列** | Status bar at the window bottom | `Advanced\ShowStatusBar` = 1 | HKCU · Explorer |
| **Hide recent files in Quick access · 唔顯示快速存取最近檔案** | No recent files in Home/Quick access | `Explorer\ShowRecent` = 0 | HKCU · Explorer |

### Context menu · 右鍵選單 (shell-extension blockers)

These hide legacy right-click entries by writing an empty string to the **`Shell Extensions\Blocked`** key under each extension's CLSID. Disabling the tweak removes the block and the entry returns.

| Tweak (EN · 粵語) | Removes | Blocked CLSID |
|---|---|---|
| **Remove "Give access to" / Share · 移除「授權存取/共用」** | Legacy network-sharing submenu | `{f81e9010-6ea4-11ce-a7ff-00aa003ca9f6}` |
| **Remove "Cast to Device" · 移除「投放到裝置」** | Play To / DLNA cast entry on media | `{7AD84985-87B4-4a16-BE58-8B72A5B390F7}` |
| **Remove "Edit with Photos" · 移除「用相片編輯」** | Photos-app edit entry on images | `{BFE0E2A4-C70C-4AD7-AC3D-10D1ECEBB5B4}` |
| **Remove "Scan with Microsoft Defender" · 移除「用 Defender 掃描」** | Defender EPP scan entry | `{09A47860-11B0-4DA5-AFA5-26D86198A780}` |
| **Remove "Restore previous versions" · 移除「還原舊版本」** | Entry + Previous Versions properties tab | `{596AB062-B4D2-4215-9F74-E9109B0A8153}` |

### Privacy & Network · 私隱與網絡

| Tweak (EN · 粵語) | What it does | Key / value | Root · admin · restart |
|---|---|---|---|
| **Disable telemetry autologger (DiagTrack) · 停用遙測自動記錄器** | DiagTrack ETW trace doesn't start at boot | `…\AutoLogger-Diagtrack-Listener\Start` = 0 | HKLM · admin · reboot |
| **Disable feedback notifications · 停用意見反映通知** | No feedback prompts | `DataCollection\DoNotShowFeedbackNotifications` = 1 | HKLM · admin · sign-out |
| **Disable app launch tracking · 停用程式啟動追蹤** | Stops `Start_TrackProgs` tracking | `Advanced\Start_TrackProgs` = 0 | HKCU · Explorer |
| **Disable typing insights · 停用輸入分析** | No typing-suggestion insights collection | `Input\Settings\InsightsEnabled` = 0 | HKCU |
| **Deny apps access to location (policy) · 拒絕 App 存取位置** | Force-deny location for all apps | `AppPrivacy\LetAppsAccessLocation` = 2 | HKLM · admin · sign-out |
| **Delivery Optimization: no peering · 傳遞最佳化唔由其他 PC 下載** | HTTP-only, no P2P (`DODownloadMode` = 0) | `DeliveryOptimization\DODownloadMode` = 0 | HKLM · admin |
| **Disable tailored experiences · 停用量身體驗** | No personalized tips/ads from diagnostic data | `Privacy\TailoredExperiencesWithDiagnosticDataEnabled` = 0 | HKCU |
| **Disable feedback request frequency · 停用意見反映頻率** | SIUF survey frequency to 0 | `Siuf\Rules\NumberOfSIUFInPeriod` = 0 | HKCU |

---

## 3 · Windows 11 Advanced · Windows 11 進階 (Win11Pro)

*Image omitted from the offline bundle: Windows 11 Advanced tweaks.*

Source: `Catalog/Win11ProTweaks.cs`. Five sub-groups of ~20 each: **input/locale**, **storage & notifications (incl. Snap)**, **performance & boot**, **Explorer power-options**, and **Settings deep-links**. This category mixes `RegToggle`, `RegChoice` (dropdowns), and `Cmd` / `Powershell` / `Shell` actions — including wrapped **DISM**, **powercfg**, **bcdedit**, **fsutil**, **lodctr** and **sc** commands.

### 3.1 Input & International · 輸入與地區

Mouse, keyboard, accessibility and regional formatting.

| Tweak (EN · 粵語) | Kind | Key / value |
|---|---|---|
| **Disable mouse acceleration · 停用滑鼠加速** | toggle | `Control Panel\Mouse\MouseSpeed` = "0" |
| **Mouse threshold 1 / 2 off · 滑鼠閾值 1/2 關閉** | toggle | `MouseThreshold1` = "0", `MouseThreshold2` = "0" |
| **Keyboard repeat delay · 鍵盤重複延遲** | choice | `Keyboard\KeyboardDelay` 0–3 |
| **Keyboard repeat rate · 鍵盤重複速度** | choice | `KeyboardSpeed` 0 / 16 / 24 / 31 |
| **Filter / Sticky / Toggle Keys · 篩選／相黏／切換鍵** | toggles | `Accessibility\…\Flags` |
| **First day of week · 一週嘅第一日** | choice | `International\iFirstDayOfWeek` Mon–Sun |
| **Short date format · 短日期格式** | choice | `sShortDate` (yyyy-MM-dd, dd/MM/yyyy, …) |
| **Time format (24h / 12h) · 時間格式** | choice | `sShortTime` (HH:mm / h:mm tt) |
| **Cursor blink rate · 游標閃爍速度** | choice | `Desktop\CursorBlinkRate` (incl. "No blink" = -1) |
| **Double-click speed · 連按速度** | choice | `Mouse\DoubleClickSpeed` 200/500/900 |
| **Swap mouse buttons · 對調滑鼠按鍵** | toggle | `Mouse\SwapMouseButtons` = "1" |
| **Wheel scroll lines · 滾輪捲動行數** | choice | `Desktop\WheelScrollLines` 1/3/5/screen |
| **Caret (cursor) width · 游標闊度** | choice | `Desktop\CaretWidth` 1/2/5 px |
| **Open Mouse & touchpad / Region / Keyboard accessibility / Typing** | shell | `ms-settings:mousetouchpad`, `:regionformatting`, `:easeofaccess-keyboard`, `:typing` |

### 3.2 Storage & Notifications (incl. Snap) · 儲存、通知與貼齊

| Tweak (EN · 粵語) | Kind | Key / value |
|---|---|---|
| **Storage Sense · 儲存空間感知功能** | toggle | `StorageSense\…\StoragePolicy\01` = 1 |
| **Recycle Bin retention · 回收筒保留期** | choice | `StoragePolicy\256` (Never / 1 / 14 / 30 / 60 days) |
| **All notifications · 所有通知** | toggle | `Notifications\Settings\NOC_GLOBAL_SETTING_TOASTS_ENABLED` |
| **Notification sound · 通知聲音** | toggle | `…ALLOW_NOTIFICATION_SOUND` |
| **Lock-screen notifications · 鎖定畫面通知** | toggle | `…ALLOW_TOASTS_ABOVE_LOCK` |
| **Snap Assist / Snap fill / Joint resize · 貼齊助手／填充／同時調整** | toggles | `Explorer\Advanced\SnapAssist`, `SnapFill`, `JointResize` |
| **Snap layout bar / flyout / suggestions / tips · 貼齊工具列／飛出／建議／提示** | toggles | `EnableSnapBar`, `EnableSnapAssistFlyout`, `SnapAssistSuggestions`, `EnableSnapAssistFlyout2` |
| **Window arrangement animations · 視窗排列動畫** | toggle | `Desktop\WindowArrangementActive` = "1" |
| **Virtual desktops on all monitors · 所有螢幕顯示虛擬桌面** | toggle | `VirtualDesktopAllMonitorsEnabled` |
| **Alt-Tab shows browser tabs · Alt-Tab 顯示瀏覽器分頁** | choice | `MultiTaskingAltTabFilter` (windows only / 3 / 5 / 20 tabs) |
| **Shut down OneDrive · 關閉 OneDrive** | cmd | `OneDrive.exe /shutdown` |
| **Open Focus / Notifications / Multitasking / Storage** | shell | `ms-settings:quiethours`, `:notifications`, `:multitasking`, `:storagesense` |

### 3.3 Performance & Boot · 效能與開機

The most powerful — and riskiest — group. Most are admin; some are flagged **destructive**; several require a reboot.

| Tweak (EN · 粵語) | Wrapped tool / value | Notes |
|---|---|---|
| **Disable reserved storage · 停用保留儲存空間** | `DISM /Online /Set-ReservedStorageState /State:Disabled` | frees ~7 GB · admin |
| **Processor scheduling · 處理器排程** | `PriorityControl\Win32PrioritySeparation` (0x26 foreground / 0x18 services) | admin |
| **Disable USB selective suspend · 停用 USB 選擇性暫停** | `powercfg /SETACVALUEINDEX … 0` (AC+DC) | admin |
| **Set network to Private · 設網絡為私人** | `Set-NetConnectionProfile -NetworkCategory Private` | PowerShell · admin |
| **Hypervisor launch off / auto · 虛擬器啟動 Off／Auto** | `bcdedit /set hypervisorlaunchtype off` / `auto` | admin · reboot |
| **Rebuild performance counters · 重建效能計數器** | `lodctr /R` | admin |
| **Enable / Disable memory compression · 記憶體壓縮開／關** | `Enable-MMAgent` / `Disable-MMAgent -MemoryCompression` | admin · reboot |
| **Hardware-accelerated GPU scheduling · 硬件加速 GPU 排程 (HAGS)** | `GraphicsDrivers\HwSchMode` = 2 | admin · reboot |
| **Crash dump type · 當機傾印類型** | `CrashControl\CrashDumpEnabled` (minidump / kernel / complete / none) | admin |
| **Disable SysMain (Superfetch) · 停用 SysMain** | `sc config SysMain start= disabled && sc stop SysMain` | **destructive** · admin |
| **GPU TDR delay · GPU TDR 延遲** | `GraphicsDrivers\TdrDelay` = 8 | admin · reboot |
| **Rebuild search index · 重建搜尋索引** | `Windows Search\SetupCompletedSuccessfully` = 0 | admin · reboot |
| **Disable startup app delay · 停用啟動程式延遲** | `Serialize\StartupDelayInMSec` = 0 | Explorer |
| **Disable NTFS last-access · 停用 NTFS 最後存取** | `fsutil behavior set disablelastaccess 1` | admin |
| **Disable HPET timer · 停用 HPET 計時器** | `Disable-PnpDevice 'High precision event timer'` | **destructive** · admin · reboot |
| **Activate High Performance plan · 啟用高效能電源計劃** | `powercfg /SETACTIVE 8c5e7fda-…` | admin |
| **Disable Fast Startup · 停用快速啟動** | `powercfg /hibernate off` | admin · reboot |
| **Disable boot animation · 停用開機動畫** | `bcdedit /set bootuxdisabled on` | admin · reboot |

> **Safety · 安全** — `Disable SysMain` and `Disable HPET timer` are explicitly flagged **destructive** in the catalog; they stop a service / disable a hardware timer device and can affect stability. If a machine becomes unstable after the HPET tweak, re-enable the device in Device Manager. The `bcdedit` hypervisor toggles affect virtualization/WSL and need a reboot.

### 3.4 Explorer power-options · 檔案總管進階

| Tweak (EN · 粵語) | Kind | Key / value |
|---|---|---|
| **Always show all tray icons (legacy) · 永遠顯示所有系統匣圖示** | toggle | `Explorer\EnableAutoTray` = 0 (legacy flag) |
| **Remove 3D Objects folder · 移除 3D 物件資料夾** | toggle | namespace `{0DB7E03F-…}\ThisPCPolicy` = Hide · admin |
| **Expand the legacy ribbon · 預設展開舊版功能區** | toggle | `Ribbon\MinimizedStateTabletModeOff` = 0 |
| **Launch folder windows in a separate process · 用獨立處理序開資料夾視窗** | toggle | `Advanced\SeparateProcess` = 1 |
| **Drive letter display order · 磁碟機代號顯示次序** | choice | `ShowDriveLettersFirst` (0/1/2/4) · admin |
| **Restore folder windows at logon · 登入時還原資料夾視窗** | toggle | `Advanced\PersistBrowsers` = 1 |
| **Disable thumbnail caching · 停用縮圖快取** | toggle | `Advanced\DisableThumbnailCache` = 1 |
| **Maximise icon cache size · 加大圖示快取容量** | toggle | `Explorer\Max Cached Icons` = "4096" · admin |
| **Disable web search suggestions in Start · 停用開始網路搜尋建議** | toggle | `Policies\…\Explorer\DisableSearchBoxSuggestions` = 1 |
| **Disable the lock screen · 停用鎖定畫面** | toggle | `Personalization\NoLockScreen` = 1 · admin · reboot |
| **Disable Bing in Windows Search · 停用搜尋嘅 Bing** | toggle | `Search\BingSearchEnabled` = 0 |
| **Show details in file operation dialogs · 檔案操作顯示詳細資料** | toggle | `OperationStatusManager\EnthusiastMode` = 1 |
| **Always confirm before deleting files · 刪除前永遠確認** | toggle | `Advanced\ConfirmFileDelete` = 1 |
| **Disable Aero Shake to minimise · 停用 Aero 搖晃** | toggle | `Advanced\DisallowShaking` = 1 |
| **Restore classic volume mixer · 還原傳統音量混音器** | toggle | `MTCUVC\EnableMtcUvc` = 0 · admin |
| **Show seconds in the system clock · 系統時鐘顯示秒數** | toggle | `Advanced\ShowSecondsInSystemClock` = 1 |
| **Hide recent / frequent in Quick Access · 快速存取隱藏最近／常用** | toggles | `Explorer\ShowRecent` = 0, `ShowFrequent` = 0 |
| **Taskbar on multiple displays · 多顯示器工作列模式** | choice | `Advanced\MMTaskbarMode` (0/1/2) |
| **Combine taskbar buttons / show labels · 合併工作列按鈕／顯示標籤** | choice | `Advanced\TaskbarGlomLevel` (0/1/2) |

### 3.5 Settings deep-links · 設定深層連結

Twenty one-click `Cmd` shortcuts that launch `ms-settings:` pages — no registry writes, just fast navigation:

- **Bluetooth & devices · 藍牙同裝置** (`ms-settings:bluetooth`)
- **Display · 顯示器** (`:display`) · **Night light · 夜燈** (`:nightlight`) · **Sound · 音效** (`:sound`)
- **Power & battery · 電源同電池** (`:powersleep`) · **Storage · 儲存空間** (`:storagesense`)
- **Nearby sharing · 附近共用** (`:crossdevice`) · **Clipboard · 剪貼簿** (`:clipboard`) · **Multitasking · 多工** (`:multitasking`)
- **For developers · 開發人員** (`:developers`) · **Optional features · 選用功能** (`:optionalfeatures`)
- **Windows Update · 更新** (`:windowsupdate`) · **Windows Security · 安全性** (`:windowsdefender`) · **Backup · 備份** (`:backup`)
- **Activation · 啟用** (`:activation`) · **About this PC · 關於此電腦** (`:about`)
- **Date & time · 日期同時間** (`:dateandtime`) · **Language · 語言** (`:regionlanguage`)
- **Themes · 佈景主題** (`:themes`) · **Taskbar · 工作列** (`:taskbar`)

---

## 4 · System Information (Info) · 系統資訊

Source: `Catalog/InfoTweaks.cs`. A small **read-only** category — these rows have no toggle; each calls a live `SystemInfo` getter and shows the result. Nothing here changes the system; it's a quick at-a-glance "About this PC" pulled straight from the running OS.

| Row (EN · 粵語) | Shows |
|---|---|
| **Edition · 版本** | `OsProductName · OsEdition` |
| **Version & build · 版本與組建** | `OsDisplayVersion · OsBuild` |
| **Processor · 處理器** | `CpuName` |
| **Logical processors · 邏輯處理器** | `LogicalProcessors` threads · `Architecture` |
| **Installed memory · 已安裝記憶體** | `RamTotal` |
| **Memory in use · 記憶體用量** | `RamUsage` |
| **Graphics adapter · 顯示卡** | `GpuName` |
| **System drive · 系統磁碟** | free / total on the Windows drive |
| **Uptime · 運行時間** | time since last boot |
| **Last boot · 上次開機** | approx. last start time |
| **Device name · 裝置名稱** | `MachineName` |
| **Signed-in user · 登入使用者** | `UserName` |
| **Time zone · 時區** | active system time zone |
| **App runtime · 應用程式執行階段** | `.NET` runtime hosting WinForge |

---

## Related pages · 相關頁面

- [Windows-Tweaks-Overview](app-doc://article/winforge.wiki.d61526cf4cd055ec) — the tweak engine, TweakCard, restart scopes and admin model across all 22 categories.
- [Tweaks-Apps-PowerTools-Maintenance](app-doc://article/winforge.wiki.ec76e6955941aa4f) — app management, power tools and maintenance-side tweaks.
- [Recipes](app-doc://article/winforge.wiki.25b5a715032d1e0a) — one-click presets that chain many debloat/annoyance and performance tweaks together.

---
_Part of [Home](app-doc://article/winforge.wiki.355883cf07556dda) · WinForge wiki._
