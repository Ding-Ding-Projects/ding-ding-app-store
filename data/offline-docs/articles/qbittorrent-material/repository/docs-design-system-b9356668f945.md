# Material Design System


# Material Design System — qBittorrent Quick (Qt Quick Controls 2, Material style)

The app forces `QQuickStyle::setStyle("Material")` at startup and drives every color through a single QML singleton `Theme` (backed by C++ `ThemeManager`). Qt Quick Controls' Material attached properties (`Material.theme/accent/background/foreground/primary/elevation`) are set from `Theme` so stock controls and custom components stay in sync. The three legacy user options are preserved verbatim (same setting keys): `Appearance/ColorScheme` (System/Light/Dark) and `Appearance/TrayIconStyle` (Normal/Monochrome). `System` follows `Qt.styleHints.colorScheme`.

## 0. Material 3 rebuild — three switchable UI styles (2026-07)

The current design (handoff in `design/incoming/2026-07-11-claude/`, intake in
[DESIGN_INTAKE.md](app-doc://article/qbittorrent-material.repository.f2fb457224554a58)) ships **three UI styles**, each a
complete Material 3 palette in light and dark, selected in Settings →
Appearance and persisted as `Appearance/UiStyle`:

- **A — Tonal Rail** (purple, `primary` `#5646d6`/`#c4c0ff`): an 84px labeled
  navigation rail + FAB, status filter chips, a comfortable 56px-row table,
  and a floating selection action bar.
- **B — Split Dock** (teal, `#00696d`/`#80d4d9`): navigation as header
  segments, the classic 232px filter sidebar, a dense 34px table with
  queue/status/ratio columns, and a bottom properties dock.
- **C — Card Flow** (pink, `#8c4a60`/`#ffb1c8`): a 64px icon rail + FAB,
  chips, a card list, and a persistent 340px detail panel.

Each style defines the 13 core roles (`bg surf sc sc2 on onv ol olv pr onPr pc
onPc shadow`) per scheme; a shared GitHub-style status set (`success error
warning done muted info`) is layered on top, along with hover overlays
(`hover`/`hoverStrong`), an inverse snackbar surface, and per-style container
tints. `ThemeManager::buildStylePalette()` maps these onto the same role ids
the whole app already resolves through `Theme.color(id)`, so switching style
or scheme restyles every screen without per-consumer changes. QML branches
layout on `Theme.isTonalRail` / `Theme.isSplitDock` / `Theme.isCardFlow`.

The redesign also adds non-blocking right **sheets** (`src/quick/qml/shell/`):
the git History manager, the notification center, quick Settings (theme +
style switch + retention), and the Regex Builder — none of them modal.

The sections below document the original single-accent palette and remain the
reference for typography, geometry, icons, and motion, which the rebuild
inherits unchanged.

## 1. Color roles (qBittorrent Material + Google dark)
The light palette is the supplied qBittorrent Material system verbatim: cool neutral surfaces, one Google-blue action accent, and explicit semantic status colors. The dark palette uses Google's dark UI neutrals and dark-theme status colors while retaining the same role graph. Purple and decorative accent families are intentionally absent; `done` resolves to success and `info` resolves to primary.

Core scheme (light / dark): canvas/background `#f8fafd`/`#202124`; surface `#ffffff`/`#292a2d`; neutral surfaceVariant `#f8fafd`/`#303134`; selected/hover surface (`surfaceWarm`, `selectedSurface`, `primaryContainer`) `#e8f0fe`/`#394457`; foreground/onSurface `#202124`/`#e8eaed`; foregroundSecondary `#3c4043`/`#bdc1c6`; muted/onSurfaceVariant `#5f6368`/`#9aa0a6`; border/outline `#dadce0`/`#5f6368`; borderSoft/outlineVariant `#edf0f2`/`#3c4043`; accent/primary `#1a73e8`/`#8ab4f8`; success `#188038`/`#81c995`; warning `#f9ab00`/`#fdd663`; danger/error `#d93025`/`#f28b82`.

Light primary hover and pressed roles are the source CSS Oklab mixes, frozen as `#1666d0` and `#135dbe`. The focus ring is blue at 24% (`#3d1a73e8` in Qt's AARRGGBB form); the light dialog scrim is `#59202124` (foreground at 35%). Status containers are restrained Google Material support colors, while ordinary structure remains border-led and flat.

### Named-id → Material role map
`Theme.color("<id>")` checks the active `config.json` override table first, then follows named aliases, then reads the active base palette. This order is unchanged: overrides may target either canonical names such as `surfaceWarm`/`accent`/`danger` or Material names such as `primaryContainer`/`primary`/`error`. Existing torrent, log, RSS, and pieces identifiers remain data-driven.
Transfer-list row TEXT colors (one per TorrentState): Downloading/DownloadingMetadata/ForcedDownloading*/Checking*/Moving→success; StalledDownloading→successEmphasis; Uploading/ForcedUploading→primary; StalledUploading→primaryEmphasis; QueuedDownloading/QueuedUploading→warning; StoppedDownloading→muted; StoppedUploading→done; MissingFiles/Error→error.
Log colors: Log.TimeStamp→muted, Log.Info→primary, Log.Warning→severe, Log.Critical/Log.BannedPeer→error, Log.Normal→onSurface.
RSS: UnreadArticle→primary + SemiBold; ReadArticle→muted + Normal.
PiecesBar: Piece→primary, PartialPiece→primary@50%/primaryContainer, MissingPiece→surfaceVariant, Border→outlineVariant.
ProgressBar chunk (unset)→primary; when `GUI/TransferList/ProgressBarFollowsTextColor` it takes the row state color.
Row/progress/icon are three independent channels gated by different prefs (`UseTorrentStatesColors` vs `ProgressBarFollowsTextColor`) — never coupled.

## 2. Typography
Display roles use the verified Roboto fallback because Google Sans is not bundled. Body roles use Roboto; operational data uses Roboto Mono. Canonical roles are: `pageTitle` 32/600 with -0.02em tracking; `sectionTitle` 24/600 with -0.01em; `brand` 20/600 with -0.01em; `body` 14/400; `tableHeader` and `navLabel` 11/600, uppercase-compatible, with 0.07em tracking; `metric` 18/600 mono; `metadata` 12/400; and `metadataMono` 12/400 mono. The supported scale is 12, 14, 16, 18, 24, 32, 48, and 64px.

Existing QML names remain available: `headlineSmall` aliases `sectionTitle`; `bodyLarge`/`bodyMedium` alias the 14px body role; `bodySmall` aliases metadata; button `labelLarge` remains 14/500; and numeric `mono` is 14px. Roboto and Roboto Mono are bundled with their OFL attribution files.

## 3. Geometry, spacing, elevation, and motion
The spacing rhythm is 4, 8, 12, 16, 20, 24, 32, and 48px. Shell geometry tokens are `topBarHeight=64`, `navigationWidth=248`, `statusBarHeight=32`, `controlHeight=40`, `rowHeight=48`, and `pagePadding=24`. Panel headers use 16px vertical / 20px horizontal padding; table cells use 14px / 20px. Progress tracks are 6px high and standard dialogs are 520px wide.

Radius hierarchy is field 4px, control/nested card 12px, and dominant panel/dialog 24px; pills use a full radius. `radiusCard=12` remains as the nested-card compatibility name, while new dominant surfaces use `radiusPanel=24`. Panels, rows, and toolbars are flat with 1px borders. Menus, dialogs, snackbars, and FABs use the restrained raised level (`elevation=3`), corresponding to the source `0 3px 8px rgba(60,64,67,.18)` recipe.

Motion tokens are `motionFast=150ms`, `motionBase=250ms`, progress fill 480ms, row stagger 45ms, and standard easing `cubic-bezier(.2,0,0,1)`. Routine hover/color/border/press feedback uses fast motion; content handoffs and dialogs use base motion. Reduced-motion callers must reduce these transitions to effectively instantaneous state changes.

## 4. Icons — Material Symbols Outlined (bundled variable font)
`Icons` QML singleton maps every legacy icon id → codepoint; `MDIcon.qml` renders the glyph as text (size/color/fill/weight). Country flags (369 SVGs) reused verbatim via a `FlagImageProvider` (`image://flags/<iso>`) — no Material equivalent. Tray keeps `qbittorrent-tray[-mono|-light|-dark]`.
Authoritative id→symbol map: add torrent `note_add`; add link `add_link`; delete `delete`; start `play_arrow`; stop `pause`; force start `bolt`; resume/pause session `play_circle`/`pause_circle`; queue top/up/down/bottom `vertical_align_top`/`arrow_upward`/`arrow_downward`/`vertical_align_bottom`; open folder `folder_open`; create torrent `build`; options `settings`; lock `lock`; speed limits `speed`; statistics `bar_chart`; about `info`; docs `menu_book`; donate `volunteer_activism`; exit `logout`; cookies `cookie`; plugins `extension`; check updates `system_update`; log `article`; set location `drive_file_move`; force recheck `fact_check`; force reannounce `campaign`; preview `preview`; torrent options `tune`; category `category`; tags `sell`; queue `low_priority`; copy `content_copy`; magnet `link`; hash `tag`; export `save_alt`; rename/edit `edit`. Status bar: connected `cloud_done`; disconnected `cloud_off`; firewalled `shield`; download `download`; upload `upload`; alt-speed `speed`. Status filter: all `apps`; active `trending_up`; inactive `trending_down`; stalled `hourglass_empty`; completed `check_circle`; error `error`; moving `drive_file_move`. Filters: categories `category`; tags `sell`; trackers `dns`; trackerless `cloud_off`; tracker-warning `warning`; tracker-error `error`. Options tabs: Behavior `palette`; Downloads `download`; Connection `lan`; Speed `speed`; BitTorrent `swap_vert`; Search `search`; RSS `rss_feed`; WebUI `language`; Advanced `settings_suggest`. Properties tabs: General `description`; Trackers `dns`; Peers `groups`; HTTP Sources `public`; Content `folder`; Speed `show_chart`. RSS: feed `rss_feed`; read/unread `mark_email_read`/`mail`; inbox `inbox`; new folder `create_new_folder`; loading `progress_activity`; error `block`; mark read `done_all`; refresh `refresh`; open url `open_in_new`. Search: search `search`; plugins `extension`; download `download`; open desc `open_in_new`. Peers: add `person_add`; ban `person_remove`. Shared: warning `warning`; security-high/low `shield`/`gpp_bad`; ip-blocked `block`; file `insert_drive_file`.

## 5. Component conventions (Qt Quick Controls 2 Material)
- Shell: `ApplicationWindow` + the 64px `AppToolBar` command surface, `AppMenuBar` (native `MenuBar`; platform bar on macOS), persistent 248px `AppNavigationSidebar`, routed `CentralTabs` `StackLayout`, and bottom `AppStatusBar`. Transfers and Workspace stay available while Search/RSS/Execution Log load on demand. Workspace owns a nested browser-style tab strip and page stack. Transfer lists/properties use persisted `SplitView` sizing.
- Cards: `MaterialCard.qml` for General-tab Transfer/Information groups, Statistics, options group boxes. Checkable group boxes → `CheckableGroupBox.qml` (header `Switch` enables/disables body; elevation change on expand).
- Navigation: the application shell uses grouped destinations in `AppNavigationSidebar`; selecting one routes `CentralTabs` to its workspace. The Options dialog uses a NavigationRail-style left list → `StackLayout`, while the personal Workspace keeps its own nested browser-style tab strip.
- Tables: `DataTable.qml` wraps `HorizontalHeaderView`+`TableView`: movable first section, per-column right-align, sort indicator, header `ColumnHeaderMenu.qml` (checkable visibility with last-column guard + "Resize columns"), persisted header state. Used by transfer list, peers, trackers, content, search results, cookies, preview, watched folders. Progress cells → `ProgressCell.qml` (Material `ProgressBar` + centered % label, `enabled:false` for Error/Stopped/Unknown). Priority cells → `ComboBox` delegate. Name cells → `CheckBox`+`MDIcon`.
- Dialogs: Material `Dialog` (modal, radius24, restrained raised elevation3) + `DialogButtonBox`. One-line prompts → `TextInputDialog.qml`. Confirmations → `ConfirmDialog.qml` (remember/don't-ask-again). Deletion surfaces a warning `MDIcon`.
- Menus: Material `Menu`/`MenuItem`, tri-state (`checkState`) items for AutoTMM/super-seeding/tags; submenus Category/Tags/Queue/Copy.
- Feedback: `Snackbar.qml` for in-app notifications when tab unfocused (search finished, added-to-tray) plus native tray notifications via C++ `DesktopIntegration`.
- FAB: optional extended `RoundButton` "Add torrent" on Transfers tab for touch layouts.
- Fields: `PathField`/`PathComboField`, `SpeedSpinBox` (sentinel `textFromValue` for ∞/0 (disabled)/Never/system default), `TriStateComboField` (Default/Yes/No → std::optional), `FilterTextField` (clear affordance + regex-toggle + `FilterPatternFormatMenu`).
- Pieces/speed: `PiecesBar.qml` (C++ `QQuickPaintedItem`), `SpeedPlotView.qml` (Canvas/Qt Charts, 10 series, period combo, series-toggle menu).
- Responsive: dialogs cap at min(implicit, window*0.9) and scroll; General-tab grids reflow 3→2→1 columns; body never scrolls horizontally (tables scroll in their own viewport).
