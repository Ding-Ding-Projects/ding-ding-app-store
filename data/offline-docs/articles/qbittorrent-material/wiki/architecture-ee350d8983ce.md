# Architecture Guide

qBittorrent Material is a native C++20 and Qt 6 application. It separates the torrent engine from the presentation layer so Qt Quick screens bind to stable, testable models instead of reaching into libtorrent.

## Layers

```text
Qt Quick Material screens and reusable controls
                 ↓
Controllers and QAbstractItemModels
                 ↓
Application/session interfaces and settings
                 ↓
libtorrent-rasterbar, OpenSSL, Boost, and the OS
```

`src/main.cpp` selects the Qt Quick Material style before the application is created. `src/app/application.cpp` initializes the native services and loads the compiled `qBittorrent` QML module. `src/quick/qml/Main.qml` owns the application window and shared actions; QML remains the presentation layer rather than a browser or embedded web shell.

## Native interface composition

The current desktop shell is assembled from these QML components:

- `src/quick/qml/mainwindow/AppToolBar.qml` — the 64px command bar and high-frequency actions.
- `src/quick/qml/mainwindow/AppNavigationSidebar.qml` — the persistent 248px grouped navigation and Transfers-only filters.
- `src/quick/qml/mainwindow/CentralTabs.qml` — lifecycle and routing for Transfers, Search, RSS, Execution Log, and Workspace.
- `src/quick/qml/mainwindow/AppStatusBar.qml` — the compact 32px session footer.

The corresponding native workspace roots are `transferlist/TransfersTab.qml`, `search/SearchTab.qml`, `rss/RSSTab.qml`, `log/ExecutionLogTab.qml`, and `workspace/WorkspaceView.qml` beneath `src/quick/qml`. Each workspace applies 24px page gutters around flat, bordered 24px-radius panels. Shared controls use a 40px interaction target, while `components/DataTable.qml` and the feature-specific list models keep operational data compact.

The token boundary is explicit: `src/quick/qml/theme/Spacing.qml`, `Typography.qml`, and `Theme.qml` define geometry, type, and semantic color roles. `src/quick/theme/thememanager.cpp` resolves those roles for **System**, **Light**, and **Dark**, follows the operating-system scheme in System mode, and retains user color overrides.

Controllers expose commands and notifiable state without moving domain logic into QML. Examples include `transfercontroller.*`, `searchcontroller.*`, `rsscontroller.*`, `propertiescontroller.*`, `optionscontroller.*`, and the shell-facing `sessioncontroller.*` under `src/quick/controllers`. Table and filter data comes through the `QAbstractItemModel` implementations in `src/quick/models`; `workspacemanager.*` additionally owns the persistent personal-page repository and recovery workflow.

## Key directories

- `src/base` — domain types, session state, persistence, networking, search, and RSS.
- `src/quick/controllers` — UI-facing commands and orchestration.
- `src/quick/models` — list/table/filter models exposed to QML.
- `src/quick/qml` — the complete native Material shell, workspace roots, dialogs, reusable controls, and theme tokens.
- `src/quick/theme` — the C++ semantic palette, System/Light/Dark resolution, and user theme overrides.
- `resources` — fonts, icons, translations, branding, and platform assets.
- `docs` — architecture, contracts, screen inventories, design tokens, generated site corpus, and wiki.

For deeper details, read [Architecture](app-doc://article/qbittorrent-material.wiki.061496bef4e83358), [Engine API](app-doc://article/qbittorrent-material.wiki.031c6809c414ed96), and [Contracts](app-doc://article/qbittorrent-material.wiki.902214c4de2945ae).
