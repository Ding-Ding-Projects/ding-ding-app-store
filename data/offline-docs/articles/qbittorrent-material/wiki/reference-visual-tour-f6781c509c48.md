# qBittorrent Material visual tour

The native Windows captures use an isolated, empty test profile. They show the
real Qt Quick interface without personal torrents, paths, tracker data, or
account details. Each saved PNG matches its documented logical window target.
The stable `01`–`17` filenames are retained for existing links, and the
complete tour includes compact Split Dock and Card Flow in both palettes.

## Capture matrix

| File | Logical target | Theme | Surface | Status |
| --- | ---: | --- | --- | --- |
| `01-main-window.png` | 960×900 | Light | Transfers and complete shell | Captured |
| `02-toolbar-and-filter.png` | 960×900 | Dark | Transfers and complete shell | Captured |
| `03-filter-sidebar.png` | 960×640 | Light | Compact Transfers shell | Captured |
| `04-transfer-list.png` | 960×768 | Light | Transfers table and filters | Captured |
| `05-properties-tabs.png` | 960×768 | Dark | Transfers properties | Captured |
| `06-statusbar.png` | 960×900 | Light | Execution Log | Captured |
| `07-navigation-and-toolbar.png` | 960×900 | Dark | Search | Captured |
| `08-main-workspace.png` | 960×900 | Light | RSS reader | Captured |
| `09-custom-workspace-tabs.png` | 960×900 | Light | Personal Workspace | Captured |
| `10-tab-context-menu.png` | 960×900 | Light | Options | Captured |
| `11-tab-typography-color.png` | 960×900 | Dark | Options | Captured |
| `12-workspace-portability.png` | 960×768 | Light | Download from URLs dialog | Captured |
| `13-restored-workspace.png` | 960×768 | Dark | About License dialog | Captured |
| `14-split-dock-compact.png` | 960×640 | Light | Compact Split Dock | Captured |
| `15-split-dock-dark-compact.png` | 960×640 | Dark | Compact Split Dock | Captured |
| `16-card-flow-compact.png` | 960×640 | Light | Compact Card Flow | Captured |
| `17-card-flow-dark-compact.png` | 960×640 | Dark | Compact Card Flow | Captured |

## Shared desktop shell

Every workspace uses the same compact geometry: a 64px command bar, persistent
248px grouped navigation, 24px content gutters, flat bordered panels with 24px
corners, 40px controls, and a 32px status footer. Operational values use
monospace type, while pale-blue selection and explicit labels keep state clear.

The menu bar, header/toolbar, and Material tray menu route commands through
shared actions. Header icon controls, the Add button and navigation rail, and
status-filter chips are keyboard operable with descriptive accessible names and
a visible focus indication.

System mode follows the operating system. Light and Dark can also be selected
explicitly; the first two Transfers captures show both palettes.

*Image omitted from the offline bundle: Light Transfers workspace.*

*Image omitted from the offline bundle: Dark Transfers workspace.*

The 960×640 capture verifies that the native desktop hierarchy remains usable
at the supported compact window size without pretending to be a phone layout.

*Image omitted from the offline bundle: Compact Transfers workspace.*

The additional compact captures extend that target to Split Dock and Card Flow
in both palettes, exercising their docked detail hierarchy without clipping.

| Split Dock · Light | Split Dock · Dark |
| --- | --- |
| *Image omitted from the offline bundle: Compact Split Dock layout in Light mode.* | *Image omitted from the offline bundle: Compact Split Dock layout in Dark mode.* |

| Card Flow · Light | Card Flow · Dark |
| --- | --- |
| *Image omitted from the offline bundle: Compact Card Flow layout in Light mode.* | *Image omitted from the offline bundle: Compact Card Flow layout in Dark mode.* |

## Transfers and properties

Transfers keeps state/category navigation, filtering, row actions, progress,
speed, peers, ETA, and selection in one dense operational surface.

*Image omitted from the offline bundle: Transfers table and filters.*

The lower detail region preserves General, Trackers, Peers, HTTP Sources,
Content, and Speed without leaving the selected torrent context.

*Image omitted from the offline bundle: Dark Transfers properties.*

## Search, RSS, and Execution Log

Execution Log provides timestamped runtime messages with text and severity
filters while retaining the persistent shell and status footer.

*Image omitted from the offline bundle: Execution Log workspace.*

Search combines query controls, installed-plugin scope, result filtering, and
download actions in the dark palette.

*Image omitted from the offline bundle: Dark Search workspace.*

RSS uses feed/article panes and keeps release actions close to automation
context.

*Image omitted from the offline bundle: RSS reader workspace.*

## Personal Workspace

Workspace provides persistent browser-style plain-text pages with per-tab
appearance and local Git-backed history. It is a first-class destination beside
Transfers, Search, RSS, and Execution Log.

*Image omitted from the offline bundle: Persistent personal Workspace.*

## Options and dialogs

Options keeps its settings categories and staged Apply/Cancel workflow inside a
large Material dialog. The paired captures verify Light and Dark rendering. In
particular, the tray-icon style remains staged until **Apply** commits it and
refreshes the native tray icon; **Cancel** leaves the active icon unchanged.

*Image omitted from the offline bundle: Options dialog in Light mode.*

*Image omitted from the offline bundle: Options dialog in Dark mode.*

The remaining captures cover shared dialog foundations: 24px corners,
restrained elevation, 40px actions, visible labels, and keyboard-safe focus.

*Image omitted from the offline bundle: Download from URLs dialog.*

*Image omitted from the offline bundle: About License dialog in Dark mode.*

The About License tab renders the bundled GPL notice directly from the QRC
resource. Peer-country flags are served by the registered `image://flags`
provider; optional missing SVG assets degrade to a transparent placeholder
rather than a broken image.

## Documentation experience

The GitHub Pages landing page presents the application at 80% of the viewport
on large screens, then reflows navigation, calls to action, and screenshots for
phones and tablets.

*Image omitted from the offline bundle: Material documentation landing page.*

The complete project corpus is searchable inside the page. Results are grouped
by document and highlight matching text without sending the query anywhere.

*Image omitted from the offline bundle: Embedded wiki search.*

The regex builder includes token shortcuts, flags, sample text, live match
highlighting, and portable pattern import/export.

*Image omitted from the offline bundle: Regex builder dialog.*

*Image omitted from the offline bundle: Mobile documentation landing page.*
