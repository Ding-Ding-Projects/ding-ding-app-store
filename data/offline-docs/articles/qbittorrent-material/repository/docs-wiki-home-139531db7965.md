# qBittorrent Material Wiki

Welcome to the living handbook for qBittorrent Material: a native C++20 and Qt 6/QML rewrite of qBittorrent with a data-first Material interface.

This wiki is maintained in the main repository so the GitHub Wiki and the searchable documentation site share the same source. Use the site search for plain text, regular expressions, field filters, saved search profiles, and imported Markdown.

The completed desktop shell uses a 64px command bar, persistent 248px navigation, and a compact 32px footer. Transfers, Search, RSS, Execution Log, and the personal Workspace are native Qt Quick workspaces. Their content follows a consistent 24px page gutter, flat 24px-radius panels, 40px controls, and compact tables and split views. Choose **System**, **Light**, or **Dark** without changing the underlying workflows or data models.

## Smoke-tested shell behaviors

- The menu bar, header/toolbar, and Material tray menu route through shared
  actions, so equivalent commands invoke the same application behavior.
- Header icon buttons, the Add button and navigation rail, and status-filter
  chips are keyboard reachable, have accessible labels, and keep a visible
  focus state.
- The Behavior-page tray-icon style is an Options transaction: **Apply**
  commits and refreshes the tray icon, while **Cancel** keeps the active style.
- The About dialog reads its bundled GPL notice from the QRC resource bundle.
  Peer flags use the registered
  `image://flags` provider; missing optional SVGs intentionally render as a
  transparent fallback instead of a broken image.

*Image omitted from the offline bundle: qBittorrent Material dashboard.*

## Start here

- [Getting started](app-doc://article/qbittorrent-material.repository.0031b12c7c51db54) — install a release, build locally, and launch the app.
- [Interface tour](app-doc://article/qbittorrent-material.repository.446d24dc844b5431) — learn the navigation, filters, transfer table, properties, and status areas.
- [Windows desktop features](app-doc://article/qbittorrent-material.repository.67f3fd092e309583) — review language, notifications, dim sum, changelog, transfer export, tab discovery, appearance, history, editors, and delivery.
- [Workspace tabs](app-doc://article/qbittorrent-material.repository.2c14bbeee788e0ec) — create persistent pages, customize typography, and move snapshots or complete local Git history.
- [Search, filters, and portability](app-doc://article/qbittorrent-material.repository.2ef42e1dc78b87d3) — use regex search, the filter builder, and JSON/Markdown import and export.
- [Releases and automation](app-doc://article/qbittorrent-material.repository.cfd32d2865c0d458) — understand the installer pipeline and per-push releases.
- [Architecture](app-doc://article/qbittorrent-material.repository.896cf4fe8efd3d2f) — explore the engine, controller, model, and QML boundaries.
- [Troubleshooting](app-doc://article/qbittorrent-material.repository.4a277cfca1599131) — solve common build, packaging, launch, and documentation issues.
- [Contributing](app-doc://article/qbittorrent-material.repository.0771a70820a0b1fb) — keep code, visuals, and docs consistent.

## Project principles

1. Preserve qBittorrent behavior and configuration compatibility.
2. Keep every native workspace and first-party workflow in one coherent Material design system.
3. Make repeatable builds and self-contained Windows installers the default path.
4. Treat documentation and screenshots as tested product surfaces.
5. Keep personal workspace data local and portable by default.
