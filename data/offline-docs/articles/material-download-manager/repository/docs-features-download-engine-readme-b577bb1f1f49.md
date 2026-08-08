# Download engine

This category documents the production download engine in
`design/electron/download/`. The engine is the real network-backed path used by
the Electron application; `prototype/` remains reference material only.

## Articles

- [Reliable transfers](app-doc://article/material-download-manager.repository.ac97334b68a84883) — headers, redirects, queues,
  timeouts, retries, persistence, and verification.
- [Separate download progress window](app-doc://article/material-download-manager.repository.68ec7ce07f46d42d) — a second live
  progress surface sharing the main-process download state.

## Scope

The engine currently covers segmented Range transfers, non-resumable fallback,
pause/resume, queue concurrency, schedule polling, custom request headers,
redirect limits, connection/idle/request timeouts, retry handling, local state
persistence, and the separate progress-window renderer route. Installer and
release evidence is documented in the updates category; this category does not
claim a release merely from a local build.
