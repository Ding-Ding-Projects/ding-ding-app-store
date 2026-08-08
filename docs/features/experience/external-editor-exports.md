---
id: external-editor-exports
title: External editor exports
titleYue: 外置編輯器匯出
category: experience
status: shipped
summary: Exports every exposed record and view to an app-owned VS Code workspace through a validated, shell-free main-process adapter.
---
# External editor exports

## Behaviour

Every exportable app-store surface keeps its normal download action and also offers **Open in VS Code**: catalog and installed records, activity, notifications, changelog entries, offline documentation articles, settings, appearance, and tab layout. The main process writes the selected UTF-8 document into an app-owned workspace folder and launches the chosen validated VS Code edition with that folder as its workspace root. Opening an export never blocks the app or replaces the download.

## Configuration

Settings → About contains the searchable External editor card. Stable, Insiders, portable, and validated-fallback choices are persisted in `external-editor.v1.json` by the main process. Detection checks `code.exe`/`code-insiders.exe` on PATH, bounded per-user and machine install locations, Scoop locations, and an explicitly selected executable from the native file picker. The add action accepts only a real `Code.exe` or `Code - Insiders.exe`; the renderer cannot provide a path or command.

## Failure modes

Missing VS Code, a stale selected executable, an invalid filename or MIME type, oversized content, an unwritable app-owned export folder, or a failed launch produces a localized non-blocking notification. The download action remains available. A failed launch never claims that the export opened, and the generated file remains inside the app-owned workspace for recovery.

## Security considerations

The preload API exposes only typed editor ids, editions, record kinds, bounded suggested names, allowlisted MIME types, and bounded text. Main-process schemas reject traversal, repeated dots, unknown keys, executable paths, and oversized payloads. Launch uses a validated executable with `shell: false`, `windowsHide: true`, and no renderer-controlled arguments. The workspace folder is created below application data with a restrictive file mode.

## Verification

Contract tests reject traversal, executable-path injection, unknown editions, unknown keys, and oversized content. Source checks prove the main/preload IPC handlers, native validation picker, PATH/install discovery, app-owned workspace write, shell-free launch, and every renderer export action. `npm run check`, `npm run build`, and `npm run docs:check` are required before integration. A packaged hidden-desktop run should still verify the real VS Code availability boundary on the target Windows machine; this source lane does not claim that runtime launch.

## Suggested articles

- [Settings, language, and display name](settings-language-and-display-name.md)
- [Activity history and export](../installed/activity-history.md)
- [Offline documentation browser](../documentation/offline-documentation-browser.md)
- [Privacy and security](../security/privacy-and-security.md)

