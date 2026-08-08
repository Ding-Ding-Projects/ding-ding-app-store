# Frequently Asked Questions

## Is this a theme for upstream qBittorrent?

No. It is a ground-up Qt 6/QML interface and application rewrite that aims for feature-for-feature behavior while using a Material design system everywhere.

## Does the site call a search service?

No. The complete documentation corpus is embedded in the static site. Search, regex evaluation, filters, imports, and exports run locally in the browser.

## Are imported documents uploaded?

No. Imported files stay in local browser storage unless you explicitly export and share a bundle.

## Does the Workspace feature need Git installed?

No. The application uses bundled libgit2 to create and commit its managed local
workspace repository. You can still inspect that repository with any compatible
Git client.

## Does renaming the app change its executable or settings profile?

No. It changes the persisted display name used by the window, Workspace header,
and tray tooltip while keeping application identity and paths stable.

## Is Workspace Git pushed to GitHub?

No. It has local history only. Nothing leaves the computer unless you export
and share a JSON snapshot or complete repository.

## Why does each push publish its own release?

The project favors traceable test builds. Each release points at one commit and contains the exact installer that passed the automated smoke gate.

## Why can the first Windows build take a long time?

Qt downloads and vcpkg native dependencies dominate a cold build. Caches make later runs much faster.

## Where should I report a problem?

Open a GitHub issue with the build tag, operating system, expected behavior, actual behavior, and a screenshot or log excerpt that does not contain private paths or tracker data.
