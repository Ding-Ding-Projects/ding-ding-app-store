# Workspace

Project- and workflow-level features of the native application: how projects are
opened, tracked, versioned, and how the app communicates with the user while
work is in progress.

- [Non-blocking notifications](app-doc://article/bambu-studio.repository.96ce1b7c9e406ecb) — informational,
  warning, and error messages surface as corner toasts instead of modal dialogs;
  decision dialogs stay modal.
- [Project version history](app-doc://article/bambu-studio.repository.e3513b11572dbea0) — local, libgit2-backed
  snapshots of every project, browsable/restorable from File ▸ Version history
  and the topbar history chip.
- [Browser-like project tabs](app-doc://article/bambu-studio.repository.0ee7ee3c372d8dbe) — one tab per project with
  snapshot-based switching, plus the new-tab and close affordances.
- [External editor](app-doc://article/bambu-studio.repository.a5489052c9efa1ef) — configurable "Open in External
  Editor" for the current project folder, with editor auto-detection.
- [Config profiles & full-data backup](app-doc://article/bambu-studio.repository.bf57ecf9946bd650) — export the
  entire data directory (secrets included, behind a slide-to-confirm gate),
  import it on another PC as a new profile, keep unlimited profiles, and give
  each one local Git-backed snapshot history.
- [Preferences auto-history](app-doc://article/bambu-studio.repository.26b7fa6bc206bd9f) — every settings change
  commits BambuStudio.conf into an isolated local Git repo (debounced,
  deduped), with a browser and restore-beside-the-live-file semantics.

## Postman collections

Not applicable. These are desktop workspace features with no HTTP or API
surface, so no Postman collection is provided for this category.
