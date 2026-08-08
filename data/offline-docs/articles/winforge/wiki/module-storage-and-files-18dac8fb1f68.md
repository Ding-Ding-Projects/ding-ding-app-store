# Storage & Files · 儲存與檔案

WinForge bundles a complete in-app file-management workbench so you rarely have to reach for WinDirStat, PowerRename, or a third-party duplicate cleaner. Six modules cover **disk-usage analysis**, **drive health & disk images**, a **content-hash duplicate finder**, **bulk file operations**, **batch rename with live preview**, and a **font manager** — all written in pure C#, running off the UI thread, with no shelling out to other apps for the core work. Every module is fully bilingual (English + 粵語).

呢一頁講晒 WinForge 嘅檔案工具：磁碟分析、磁碟機總覽同磁碟映像、重複檔案搜尋、批次檔案操作、批次改名同字型管理。全部喺 app 入面做，刪除一律入回收筒，可以還原。

*Image omitted from the offline bundle: Disk Analyser showing folder sizes with percentage bars.*

> **Safety · 安全**
> The destructive actions on this page are designed to be reversible or guarded. **Deletes go to the Recycle Bin** (via `SHFileOperation` with `FOF_ALLOWUNDO`), not permanent erase. **Move / Flatten / Organise / Recycle** in Bulk Ops always show a confirmation dialog first. **Drive format / VHD creation and machine-wide font install need administrator rights.** Always check the preview/match count before you act. 刪除一律入回收筒，可以還原；移動、攤平、整理同回收前都有確認框；磁碟格式化、VHD 同全機字型安裝需要管理員權限。

---

## 1 · Disk Analyser · 磁碟分析

A pure-C# disk-usage analyser in the spirit of **WinDirStat / TreeSize**, but fully in-app and off-thread. Point it at a folder, and it shows the size of every immediate child with a proportional bar, a percentage of the total, and a human-readable size. Click a folder row to drill in; use **Up** to go back to the parent.

`DiskAnalyzerModule` + `DiskAnalyzer`：撳資料夾入去再睇，每個子項目都有大細、百分比同長條。

### Two scan modes · 兩種掃描模式

| Mode · 模式 | What it does | Source |
|---|---|---|
| **By folder · 按資料夾** | Sizes each immediate subfolder (recursive) plus loose files in the current folder, sorted largest first | `DiskAnalyzer.ByChild` |
| **Largest files · 最大檔案** | Walks the whole tree (`SearchOption.AllDirectories`) and returns the **top 200** biggest individual files | `DiskAnalyzer.LargestFiles(folder, 200, …)` |

### How it works · 點運作

- **`DirSize`** recurses through every subfolder, summing `FileInfo.Length`, and silently skips files/folders it can't read (access-denied or unreadable files are ignored rather than aborting the scan).
- Sizes render as proportional bars (max width **240px**), with each row's percentage computed against the total of the listing. The status line reports e.g. `42 items · 8.3 GB total`.
- Progress is streamed live: **By folder** shows `Sizing… <name>`, **Largest files** shows `Scanning… <count>` (it reports every 2,000 files enumerated).
- Folder rows get a folder glyph; file rows a document glyph. Only folder rows are clickable for drill-in.

### Recycle from the analyser · 喺分析器回收

Select any row and hit **Recycle selected · 回收選取**. It shows the file name + size in a confirmation dialog, then sends it to the Recycle Bin via `BulkFileOps.Recycle` and re-scans. Handy for nuking one giant file you just found.

---

## 2 · Drives · 磁碟機

*Image omitted from the offline bundle: Drives overview with used/free bars per volume.*

The **Drives · 磁碟機** module (`DrivesModule` + `DriveService`) gives an at-a-glance overview of every volume returned by `DriveInfo.GetDrives()`, plus disk-image mounting and VHD creation.

### Drive overview · 磁碟機總覽

Each ready drive shows:

- A type glyph (fixed disk, **CDRom**, **Removable**, or **Network**).
- Title: drive letter + volume label (`Local Disk · 本機磁碟` if unlabelled).
- Sub-line: `<Format> · <Type> · <used>% used`, e.g. `NTFS · Fixed · 67% used`.
- Free/total text: `120.4 GB free of 465.7 GB`.
- A **used-space bar** (track width 300px). The bar turns **critical red** (`SystemFillColorCriticalBrush`) when usage hits **≥ 90%**, otherwise it uses the accent colour.

Drives that aren't ready (empty optical drive, disconnected removable) show `<Type> · not ready · 未就緒` with no bar. **Refresh · 重新整理** re-reads everything.

### Disk images & VHDs · 磁碟映像同 VHD

| Action · 操作 | What it does | Backing command |
|---|---|---|
| **Mount image… · 掛載映像…** | Pick a `.iso` / `.vhd` / `.vhdx` / `.img` and mount it | `Mount-DiskImage -ImagePath …` |
| **Dismount image… · 卸載映像…** | Pick the same image and eject it | `Dismount-DiskImage -ImagePath …` |
| **Create VHD… · 建立 VHD…** | Save dialog → choose size (GB) and dynamic vs fixed | `New-VHD -Path … -SizeBytes <N>GB -Dynamic\|-Fixed` |

The **Create VHD** dialog offers a **Size (GB)** spinner (1 – 65,536 GB) and a **Dynamically expanding · 動態擴充** checkbox (on by default; unchecking it creates a fixed-size VHD). Paths are single-quote-escaped before being passed to PowerShell.

> **Safety · 安全**
> Mount/dismount/VHD all run through native cmdlets and **may require administrator rights**. If an operation fails while WinForge is not elevated, the result bar says e.g. *"Create VHD may need administrator rights · 建立 VHD可能需要管理員權限"* — relaunch as admin and retry. (This module does **not** format or wipe partitions; it only mounts images and creates new VHD files.)

---

## 3 · Duplicate Finder · 重複檔案搜尋

*Image omitted from the offline bundle: Duplicate finder grouping byte-identical files.*

`DuplicatesModule` + `DuplicateFinder` find **byte-identical** files and let you reclaim the wasted space — with **no false positives**, because matching is content-based, not name-based.

### Two-stage matching · 兩階段比對

1. **Group by size first** (cheap): only files that share an exact byte length are candidates. Zero-byte files are skipped.
2. **Hash only the candidates** with **SHA-256** (`SHA256.HashData` over the file stream). Files with an identical hash are grouped as true duplicates. Locked/unreadable files are skipped silently.

Because two different files can't share a SHA-256 hash in practice, every reported group is genuinely identical — safe to delete extras.

### The results table · 結果

- Groups are sorted by **most wasted space first** (`Size × (count − 1)`).
- Within each group, the **first file is the keeper** — labelled `Group N (keep) · 組 N（留）` — and the rest are flagged redundant.
- **Redundant copies are pre-checked** so you can reclaim space in one click while the original stays put.
- An optional **Subfolders · 子資料夾** checkbox controls recursive scanning.
- Status line: `12 groups · 28 redundant · 3.4 GB reclaimable · 可回收`. Hashing progress streams as `Hashing… <n>`.

### Reclaiming space · 回收空間

**Recycle checked · 回收已勾選** confirms the count, then sends the checked copies to the Recycle Bin and re-scans. Nothing is permanently deleted.

> **Safety · 安全**
> Only the copies you keep checked are touched, and they go to the Recycle Bin — restore from there if you change your mind. The keeper in each group is never pre-checked. 只有你勾選嘅副本會入回收筒，每組嘅「留」唔會預先勾選。

---

## 4 · Bulk File Ops · 批次檔案操作

*Image omitted from the offline bundle: Bulk file ops matching files by pattern.*

`BulkOpsModule` + `BulkFileOps` match a set of files by pattern, show a **live preview list with a running count**, and then apply one of five operations. Editing the pattern, switching match mode, or toggling **Subfolders** instantly re-computes the matches (`Recompute`).

### Match modes · 比對模式

| Mode · 模式 | Pattern example | Behaviour |
|---|---|---|
| **Wildcard · 萬用字元** | `*.jpg` | Standard Windows wildcard via `Directory.EnumerateFiles` |
| **Regex · 正則** | `^IMG.*` | .NET regex against the **file name**, case-insensitive |
| **Extension · 副檔名** | `png` or `.png` | Exact extension match (leading dot optional) |

A **Source · 來源** folder is required; a **Target · 目標** folder is required for copy/move. **Subfolders · 包括子資料夾** makes matching recursive.

### Operations · 操作

| Button · 按鈕 | What it does | Confirm? |
|---|---|---|
| **Copy → target · 複製 → 目標** | Copies matched files into the target | No |
| **Move → target · 移動 → 目標** | Moves matched files into the target | Yes |
| **Recycle · 放入回收筒** | Sends matched files to the Recycle Bin | Yes |
| **Flatten · 攤平** | Moves matched files up into the source **root** (collapses the tree) | Yes |
| **Organise by type · 按類型整理** | Moves each file into a subfolder named after its uppercased extension (`JPG\`, `PDF\`, `_noext\`) | Yes |

### Collision-safe by design · 防撞名

- Copy/Move/Flatten/Organise all route destination names through a **`Unique()`** helper that appends ` (1)`, ` (2)`, … when a name already exists — **nothing gets silently overwritten**.
- **Recycle** uses the same reversible `SHFileOperation` path as the rest of the suite.
- Flatten skips files already in the root (counts them as done), so it's idempotent.
- Every operation reports `Copied: 14 ok, 0 failed · 成功 14，失敗 0` and refreshes the match list afterward.

> **Safety · 安全**
> Four of the five operations *move or delete* files, so each pops a confirmation dialog showing the count (`Move 14 file(s)? · 移動 14 個檔案？`) before proceeding. Recycle is reversible; Copy is the only non-destructive op. Always glance at the match count first. 移動／攤平／整理／回收前都會問你；只有複製唔會改動原檔。

---

## 5 · Batch Rename · 批次改名

*Image omitted from the offline bundle: Batch rename with live preview and conflict highlighting.*

A **PowerRename-style** batch renamer (`RenameModule` + `RenameEngine`), fully in-app. Pick a folder, type a find & replace, and watch a **live two-column preview** (old name → new name) update as you type — *before* anything is committed.

### Options · 選項

| Option · 選項 | Effect |
|---|---|
| **Regex · 正則** | Treats *Find* as a .NET regex (replacement supports `$1` groups); plain substring otherwise |
| **Case sensitive · 區分大小寫** | Matches case exactly (otherwise case-insensitive) |
| **Include extension · 包括副檔名** | Find/replace runs over the **whole** file name; off = name part only, extension preserved |

### Live preview & conflict detection · 預覽同衝突偵測

Each preview row is colour-coded:

- **Unchanged** rows are dimmed (tertiary text).
- **Changed** rows are semibold primary text.
- **Conflict** rows turn **critical red** and are excluded from the apply set.

A name is flagged a conflict when it would be **invalid** (contains characters from `Path.GetInvalidFileNameChars()` or is blank), **duplicate** within the batch (two files resolving to the same final name, case-insensitive), or would **collide with an existing file** not itself being renamed. The count line reads `9 to rename · 2 conflict(s) · 9 個要改 · 2 個衝突`, and **Apply rename** is disabled when there's nothing safe to rename.

### Safe two-phase apply · 兩階段安全套用

On **Apply rename · 套用改名**, conflicting and invalid targets are dropped, then the rename runs in **two phases via temporary `.wtmp` names** — every file is first moved to a unique GUID temp name, then to its final name. This avoids intra-batch collisions (e.g. swapping `a.txt` ⇄ `b.txt`). The result bar reports `9 renamed, 0 failed · 成功 9 個，失敗 0 個` and the list reloads.

> **Safety · 安全**
> Rename is the one operation here that is **not** routed through the Recycle Bin — files are moved in place. The live preview and conflict guard exist precisely so you commit only what you've verified. Conflicts and invalid names are never applied. 改名唔會經回收筒，靠住預覽同衝突偵測保護你；衝突同無效名唔會套用。

---

## 6 · Font Manager · 字型管理

The **Font Manager · 字型管理** module (`FontManagerModule` + `FontService`) installs, previews, and uninstalls fonts entirely in-app, replacing the old Settings redirect.

### Install · 安裝

**Install fonts… (.ttf/.otf) · 安裝字型…** opens a multi-select file picker accepting `.ttf`, `.otf`, `.ttc`, `.otc`, and `.fon`. For each file WinForge:

1. Reads the real **typographic family name** straight from the font's OpenType/TrueType **`name` table** (preferring nameID 16, then 1, then 4; handles `.ttc`/`.otc` collections), falling back to the file name if it can't parse.
2. Copies the file into the install location.
3. Writes a registry value `"<Face> (TrueType|OpenType)"` under the Fonts key.
4. Calls `AddFontResource` and **broadcasts `WM_FONTCHANGE`** so running apps notice the new font.

| Scope · 範圍 | Location | Registry | Admin? |
|---|---|---|---|
| **Per-user (default)** | `%LOCALAPPDATA%\Microsoft\Windows\Fonts` | `HKCU\…\Fonts` | **No UAC** |
| **Machine-wide · 全機安裝（管理員）** | `%WINDIR%\Fonts` | `HKLM\…\Fonts` | **Yes** |

Per-user install needs **no administrator rights** — that's the default. Ticking **Machine-wide (admin) · 全機安裝（管理員）** when WinForge isn't elevated produces a clear error telling you to relaunch as admin or uncheck the box. Existing filenames are never clobbered (a `_1`, `_2`… suffix is added). Results report e.g. `Installed 3 font(s) for your account: Inter, JetBrains Mono`.

### Preview & uninstall · 預覽同移除

- The list shows **only fonts you installed for your user account** (HKCU), sorted by face name, each with its **face name + Kind** (TrueType / OpenType) and full path.
- Each row renders a **live preview in the installed face itself**, using your custom **Preview text · 預覽文字** (default *"The quick brown fox… 香港字型測試"*). Editing the sample re-renders every row.
- **Uninstall · 移除** deletes the registry value, calls `RemoveFontResource`, deletes the file (or leaves it for the next reboot if it's in use), and re-broadcasts `WM_FONTCHANGE`. Locked or admin-only fonts report a friendly *"That font is locked or needs admin to remove · 嗰個字型被鎖住或者要管理員先移到"*.

> **Note · 注意**
> After installing, some already-running apps need a restart before the new font appears in their font pickers, even though WinForge broadcasts `WM_FONTCHANGE`. 裝完之後，有啲程式要重開先見到新字型。

---

## Module map · 模組對照

| Module · 模組 | Page | Service |
|---|---|---|
| Disk Analyser · 磁碟分析 | `DiskAnalyzerModule` | `DiskAnalyzer` |
| Drives · 磁碟機 | `DrivesModule` | `DriveService` |
| Duplicate Finder · 重複檔案搜尋 | `DuplicatesModule` | `DuplicateFinder` |
| Bulk File Ops · 批次檔案操作 | `BulkOpsModule` | `BulkFileOps` |
| Batch Rename · 批次改名 | `RenameModule` | `RenameEngine` |
| Font Manager · 字型管理 | `FontManagerModule` | `FontService` |

### Shared behaviours · 共通行為

- **Reversible deletes everywhere** — every "delete" in this suite is a Recycle-Bin send via `SHFileOperation` + `FOF_ALLOWUNDO`.
- **Off-thread scanning** — disk analysis and duplicate hashing run on `Task.Run` with `IProgress<>` so the UI never freezes.
- **Bilingual to the core** — every label, status line, dialog, and error toggles instantly between English and 粵語 via `Loc.I`.
- **Collision-safe writes** — copy/move/flatten/organise/font-install all de-duplicate destination names instead of overwriting.

For other handy tools that don't fit the Storage & Files bucket, see [Module-Misc-Utilities](app-doc://article/winforge.wiki.4bbe3f2c91da658b).

---
_Part of [Home](app-doc://article/winforge.wiki.355883cf07556dda) · WinForge wiki._

---

## Guided tours · 逐步導覽

Each control on the live page is numbered on the screenshot below and explained in the legend — what every **button, toggle, tab, box and label** does, in English and 粵語. Captured from the running app via UI Automation. 下面每個控件都有編號，逐個解釋佢哋嘅功能同標籤意思。

### Disk Analyser · 磁碟分析

*Image omitted from the offline bundle: Disk Analyser — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | App-shell **Back** button — returns to the previously visited module. Not part of Disk Analyser itself; it lives in the window chrome above every page. | "Back" = go back to the previous screen. |
| 2 | Button | App-shell **Toggle Navigation** button — collapses or expands the left-hand navigation pane (the module list / hamburger). Also shell chrome, not module-specific. | "Toggle Navigation" = show/hide the side menu. |
| 3 | Search box | Global **Search everything** box in the shell header — type to find and jump to any module across WinForge. It searches the whole app, not the disk results below. | "Search everything · 搜尋全部" — English "Search everything"; 粵語 「搜尋全部」 means *search all*. |
| 4 | Dropdown | **Mode** selector for the scan. Choosing *By folder* sizes each child folder/file under the current path (`DiskAnalyzer.ByChild`); choosing *Largest files* lists the 200 biggest individual files anywhere beneath it (`DiskAnalyzer.LargestFiles`). Changing it re-runs the scan automatically. | Empty accessible name; the two items read "By folder · 按資料夾" (group by folder) and "Largest files · 最大檔案" (biggest files). |
| 5 | Edit (path box) | **Folder path** field showing the directory currently being analysed. It is filled when you Browse, drill into a folder, or go up; on first load it defaults to the app's own folder. You can also type a path here directly. | No label; it is the target-folder text box. |
| 6 | Button | **Browse…** — opens a folder picker; the chosen folder becomes the target and is scanned immediately. | "Browse… · 瀏覽…" — 「瀏覽」 means *browse/pick a folder*. |
| 7 | Button | **Analyse** — (re)runs the scan on the folder in the path box using the current mode, then fills the list with each item's size, percentage and a length-scaled bar. | "Analyse · 分析" — 「分析」 means *analyse*. |
| 8 | Button | Icon-only **Up** button — moves the target to the parent folder of the current path and rescans, letting you climb back out after drilling in. | No name (icon only); it is the *go up one folder* / 「上一層」 action. |
| 9 | Button | **Recycle selected** — sends the item highlighted in the results list to the Windows Recycle Bin after a confirmation dialog, then rescans. Warns "Select an item first" if nothing is selected. | "Recycle selected · 回收選取" — 「回收選取」 means *recycle the selected item*. |

**How to use it · 點用** Pick a starting folder with **Browse…** (6) or by typing into the path box (5), choose **By folder** or **Largest files** in the mode dropdown (4), then press **Analyse** (7) to see every child sized with a percentage bar. Click a folder row to drill into it, or use the **Up** button (8) to climb back to the parent — the path box (5) always shows where you are. When you find space to reclaim, select a row and press **Recycle selected** (9) to send it to the Recycle Bin after confirming.

### Drives · 磁碟機

*Image omitted from the offline bundle: Drives — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | Goes back to the previous page in the app's navigation history. This is the app shell's back arrow, not part of the Drives panel itself. | "Back" — return to the previous screen. |
| 2 | Button | Collapses or expands the left navigation pane so the drive list gets more width. Shell control shared by every module. | "Toggle Navigation" — show/hide the side menu (切換導覽). |
| 3 | Search box | App-wide search field in the title bar. Type here to jump to any module or setting across WinForge; it is not a filter for the drive list below. | "Search everything · 搜尋全部" — search the whole app. 搜尋全部 = "search everything". |
| 4 | Button | Re-reads every drive and redraws the used/free bars. Use it after plugging in a USB stick, ejecting media, or mounting/creating an image so the list reflects the current state. | "Refresh · 重新整理" — reload the list. 重新整理 = "refresh / reload". |
| 5 | Button | Opens a file picker for `.iso / .vhd / .vhdx / .img`; the chosen image is mounted as a drive letter via the native mount cmdlet. A success/error bar reports the result and the list refreshes. May need administrator rights. | "Mount image… · 掛載映像…" — attach a disk image. 掛載 = "mount", 映像 = "image". The ellipsis means a dialog follows. |
| 6 | Button | Opens the same file picker, then ejects/detaches the selected image so its drive letter disappears. Pick the `.iso`/`.vhd(x)` that is currently mounted. May need administrator rights. | "Dismount image… · 卸載映像…" — detach a mounted image. 卸載 = "dismount / unmount". |
| 7 | Button | Asks where to save a new virtual disk (`.vhdx`/`.vhd`), then shows a dialog for size in GB (1–65536, default 10) and a "Dynamically expanding" checkbox; on confirm it creates the VHD via the native cmdlet. | "Create VHD… · 建立 VHD…" — make a new virtual hard disk. 建立 = "create / build". |

**How to use it · 點用** — The page lists every drive with a used/free bar (the bar turns red past 90% full); hit **Refresh (4)** any time the picture looks stale. To work with an ISO or virtual disk, use **Mount image (5)** to attach one as a drive letter and **Dismount image (6)** to eject it again, picking the file in the dialog that opens. To make a fresh virtual disk, use **Create VHD (7)**, choose a save location, set the size and whether it grows dynamically, then confirm. If a mount, dismount, or create fails, the info bar will tell you — most of these actions need WinForge running as administrator.

### Duplicate Finder · 重複檔案搜尋

*Image omitted from the offline bundle: Duplicate Finder — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|-------------------------|
| 1 | Button | Returns to the previous page in WinForge's navigation stack — leaves the Duplicate Finder. | "Back" — go back / 返回上一頁. Icon-style chevron button in the title bar. |
| 2 | Button | Collapses or expands the left navigation pane so the file list gets more width. | "Toggle Navigation" — show/hide the side menu / 開關側邊導覽。 |
| 3 | Search box | The global app search box (part of the shell, not the duplicates logic). Type to jump to any WinForge module. | "Search everything · 搜尋全部" — search across the whole app / 搜尋成個程式。 |
| 4 | Edit box (Folder) | The folder path to scan (`FolderBox`). It is auto-filled with the app folder on first load; you can type a path directly here. The scan runs against this folder. | Empty accessible name; this is the **Folder · 資料夾** input — the root directory to search for duplicates. |
| 5 | Button | Opens a folder picker (`FileDialogs.OpenFolderAsync`) and writes your choice into the Folder box (#4). | "Browse…" — pick a folder / 瀏覽…（揀資料夾）。 |
| 6 | Toggle / 開關 (checkbox) | When ticked, the scan also descends into all subfolders; unticked scans only the chosen folder's top level. Read as `recursive` by `DuplicateFinder.Scan`. | "Subfolders · 子資料夾" — include nested folders / 連埋下面嘅子資料夾一齊掃。 |
| 7 | Button | Runs the duplicate scan: hashes files (size + SHA-256), groups byte-identical ones, and fills the list. Shows live "Hashing… N · 計緊雜湊… N" progress, then a summary of groups, redundant copies, and reclaimable space. | "Scan · 掃描" — start scanning / 開始掃描。 |
| 8–9 | Per-row checkbox | Rows 8–9 are the per-file tick boxes in the results list (one per duplicate found). The first file in each group is the "keeper" and starts unticked; the redundant copies start **pre-ticked** so they are queued for recycling. Tick/untick to choose exactly which copies to remove. | Empty name (icon-only). Each box = "recycle this copy?" / 揀邊個副本要回收。 |
| 10 | Button | Confirms via a dialog, then sends every ticked file to the Recycle Bin (`BulkFileOps.Recycle`), reports how many succeeded/failed, and re-scans. Warns "Nothing checked" if no box is ticked. | "Recycle checked · 回收已勾選" — send ticked files to the Recycle Bin / 將勾咗嘅檔案放入回收筒。 |

**How to use it · 點用** — Point the Folder box (#4) at the directory you want to clean, either by typing the path or using Browse… (#5), and tick Subfolders (#6) if you want nested folders included. Press Scan (#7); WinForge hashes the files and lists every set of byte-identical duplicates, grouped together, with one "keeper" left unticked and the extra copies pre-ticked. Review the rows and adjust the per-file checkboxes (#8–9) so only the copies you truly want gone stay ticked, then press Recycle checked (#10) and confirm the dialog to move them safely to the Recycle Bin (nothing is permanently deleted, so you can restore from the bin if needed).

### Bulk File Ops · 批次檔案操作

*Image omitted from the offline bundle: Bulk File Ops — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | Returns to the previous page in WinForge's navigation history. App chrome, not part of this module. | "Back" — the standard back arrow / 返回上一頁。 |
| 2 | Button | Collapses or expands the left navigation pane so the module gets the full window width. App chrome. | "Toggle Navigation" — 開／關側邊導覽列。 |
| 3 | Search box | Global app search (the shell's "search everything" field); jumps to any module or setting. Not specific to Bulk File Ops. | "Search everything · 搜尋全部" — search across the whole app / 搜尋全部内容。 |
| 4 | Source folder box | The **Source** path field. Holds the folder whose files are matched. Editing it (or typing a path) re-runs the match and refreshes the preview list. Defaults to the app's install folder on first load. | Empty name; it is the box under the "Source · 來源" caption — 來源資料夾路徑。 |
| 5 | Button | Opens a folder picker and sets the **Source** folder, then re-runs the match. | "Browse… · 瀏覽…" — browse for a folder / 揀資料夾。 |
| 6 | Dropdown | Chooses the **match mode**: Wildcard (萬用字元, e.g. `*.jpg`), Regex (正則, e.g. `^IMG.*`), or Extension (副檔名). Changing it re-filters the file list. | Empty name; it is the mode selector — 比對模式：萬用字元／正則／副檔名。 |
| 7 | Pattern box | The text you match against. Interpreted according to the dropdown (6): a wildcard glob, a regex, or an extension. Typing here re-runs the match live. Defaults to `*.dll`. | "Pattern (e.g. *.jpg or ^IMG.*)… · 樣式（例如 *.jpg 或 ^IMG.*）…" — the match pattern / 比對樣式。 |
| 8 | Checkbox | When ticked, the match also descends into **subfolders** of the source; unticked matches only the top level. Toggling re-runs the match. | "Subfolders · 包括子資料夾" — include subfolders / 連子資料夾一齊搵。 |
| 9 | Target folder box | The **Target** path field — the destination for Copy and Move. Set via the Browse button next to it; Copy/Move warn you if it is empty. | Empty name; it is the box under the "Target · 目標" caption — 目標（複製／移動的去處）。 |
| 10 | Button | **Copy** every matched file into the Target folder. Requires a target; reports how many succeeded/failed. Non-destructive. | "Copy → target · 複製 → 目標" — copy matches to the target / 複製到目標。 |
| 11 | Button | **Move** every matched file into the Target folder. Requires a target and shows a confirmation dialog first, then reports ok/failed. | "Move → target · 移動 → 目標" — move matches to the target / 移動到目標。 |
| 12 | Button | Sends all matched files to the **Recycle Bin** (recoverable). Asks for confirmation first. | "Recycle · 放入回收筒" — send to Recycle Bin / 放入回收筒。 |
| 13 | Button | **Flattens** the matches: moves them up into the source root folder (out of their subfolders). Asks for confirmation first. | "Flatten · 攤平" — flatten into source root / 攤平到來源根目錄。 |
| 14 | Button | **Organises by type**: sorts matched files into subfolders grouped by file extension inside the source. Asks for confirmation first. | "Organise by type · 按類型整理" — organise by extension / 按副檔名整理。 |

**How to use it · 點用** — Start by setting the **Source** folder (4/5) and a **Pattern** (7), then pick the matching style with the **mode dropdown** (6) — wildcard, regex or extension — and tick **Subfolders** (8) if you want a recursive sweep; the preview list and the "matched" count update live as you type. Once the matches look right, run an action: for **Copy** (10) or **Move** (11) first pick a **Target** folder (9), while **Recycle** (12), **Flatten** (13) and **Organise by type** (14) act on the source in place. Every destructive action except Copy pops a confirmation dialog before it runs, and a result bar afterwards reports how many files succeeded versus failed.

### Batch Rename · 批次改名

*Image omitted from the offline bundle: Batch Rename — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | App-shell back button: returns you to the previous page / the module list. Part of the window chrome, not the rename feature itself. | "Back" = go back / 返回。 |
| 2 | Button | App-shell hamburger that collapses or expands the left navigation pane. Global chrome shared by every module. | "Toggle Navigation" = 開關側邊導覽列。 |
| 3 | Search box | App-shell global search across all WinForge tweaks and modules. It is the top-bar search, not a filter on this rename list. | "Search everything · 搜尋全部" — search everything / 搜尋全部內容。 |
| 4 | Folder path box | Shows the folder whose files will be renamed (`FolderBox`). On first open it is pre-filled with the app's own folder as a safe demo; you can type or paste a path here, then the file list reloads. | Empty accessible name; it is the **Folder · 資料夾** path field (the "Folder / 資料夾" caption sits beside it). |
| 5 | Button | Opens a folder picker; the chosen folder becomes the rename target, its files are loaded, and the preview recomputes. | "Browse…" = 瀏覽…（揀資料夾）。 |
| 6 | Text box | The "find" pattern. Whatever you type here is searched for in each file name; combined with #8–#10 it drives the live preview. Empty = no change. | "Find…" placeholder = 搵…（要搵嘅文字 / 正則）。 |
| 7 | Text box | The "replace" text. Each match of the find pattern is replaced with this (may be empty to delete the matched text, or use regex group refs like `$1` when Regex is on). | "Replace with…" placeholder = 換成…（換成嘅文字）。 |
| 8 | Toggle / 開關 (checkbox) | When on, the Find box is treated as a .NET regular expression (`Regex.Replace`) instead of literal text; an invalid pattern simply leaves names unchanged. Toggling recomputes the preview. | "Regex" = 正則（正則表達式）。 |
| 9 | Toggle / 開關 (checkbox) | When on, matching is case-sensitive (`Ordinal`); off means "abc" also matches "ABC". Recomputes the preview. | "Case sensitive" = 區分大小寫。 |
| 10 | Toggle / 開關 (checkbox) | When on, the file extension is included in the search/replace; off (default) protects the extension and only the name stem is changed. Recomputes the preview. | "Include extension" = 包括副檔名（連 .ext 一齊改）。 |
| 11 | Button | Applies the rename to every previewed change. It skips invalid names and duplicate-target conflicts, renames safely via temporary names to avoid intra-set collisions, then reports how many succeeded / failed in a banner. Enabled only when there is at least one valid change. | "Apply rename" = 套用改名（執行批次改名）。 |

**How to use it · 點用** Point the module at a folder — type a path in the folder box (4) or click **Browse… (5)** to pick one. Type what to look for in **Find (6)** and what to put in its place in **Replace (7)**; flip **Regex (8)**, **Case sensitive (9)** or **Include extension (10)** as needed. The preview list under these fields updates live, showing each old → new name, highlighting changes and flagging conflicts (invalid characters, or two files that would end up with the same name), with a running "_N to rename · M conflict(s)_" count. When the preview looks right, click **Apply rename (11)** — conflicting and unchanged files are left alone, and a banner tells you how many were renamed.

### Font Manager · 字型管理

*Image omitted from the offline bundle: Font Manager — annotated tour.*

| # | Control | What it is & does · 功能 | Label meaning · 標籤意思 |
|---|---------|--------------------------|--------------------------|
| 1 | Button | App-shell back button — returns to the previous page / module you came from. Part of the WinForge window chrome, not the Font Manager itself. | "Back" = go back / 返回上一頁。 |
| 2 | Button | App-shell hamburger button — collapses or expands the left navigation pane so the content area gets more room. | "Toggle Navigation" = switch the side menu open/closed / 開關側邊導覽選單。 |
| 3 | Search box | Global WinForge search box in the title bar (searches across modules/settings). It is the app-wide search, not a filter for the installed-font list below. | "Search everything · 搜尋全部" — English "search everything" plus 粵語 "搜尋全部" (search all). |
| 4 | Button | Opens a file picker for `.ttf/.otf/.ttc/.otc/.fon` font files; the chosen fonts are installed and the list refreshes. If "Machine-wide" is ticked but WinForge isn't elevated, it stops and tells you to relaunch as admin. Per-user install copies to your profile's Fonts folder + HKCU (no admin needed). | "Install fonts… (.ttf/.otf)" / 安裝字型…（.ttf/.otf）— install font files; the trailing "…" means a dialog opens; .ttf/.otf are the font file types. |
| 5 | Checkbox | When ticked, the install goes machine-wide (Windows Fonts folder + HKLM) for **all** users and requires administrator rights; unticked installs only for your account. | "Machine-wide (admin)" / 全機安裝（管理員）— install for the whole machine; "(admin)" / 「管理員」flags that admin rights are needed. |
| 6 | Search box (text input) | Preview-text field. Whatever you type here is the sample string rendered under every font in the list, each drawn in its own face, so you can compare them live. Empty falls back to a default English/粵語 sample. | "Preview text…" / 預覽文字… — the placeholder for the sample text to preview; "…" hints you type your own string. |
| 7 | Button | Re-reads your user-installed fonts (HKCU) and rebuilds the list. Useful after installing/removing fonts elsewhere, or to re-render previews with new sample text. | "Refresh" / 重新整理 — reload the font list. |

**How to use it · 點用** — Type a phrase into the **Preview text** box (6) to see every font rendered in its own face, then scroll the list below to compare them. To add fonts, click **Install fonts…** (4) and pick `.ttf/.otf` files; leave **Machine-wide** (5) unticked for a no-admin per-user install, or tick it (and run WinForge as administrator) to install for all users. Each row in the list has its own **Uninstall · 移除** button to remove a font you installed, and **Refresh** (7) rebuilds the list after changes. Newly installed fonts are broadcast to running apps via `WM_FONTCHANGE`, though some apps need a restart before the new font appears.
