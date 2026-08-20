# Documentation-site architecture

This category documents the Worldlens documentation site as a user-facing application rather than
as a bag of static pages.

| Article | What it covers |
|---|---|
| [Material Design 3 Expressive Pages rewrite](app-doc://article/material-bluemap.repository.bad6da41776ec6cb) | Ground-up shell architecture, M3 tokens and components, responsive navigation, accessibility, persistence, offline delivery and verification. |
| [Action walkthrough animations](app-doc://article/material-bluemap.repository.c5f7dbd46bea065d) | The complete twelve-animation inventory, capture provenance, finite playback, reduced-motion stills, lazy loading, file budgets and regeneration. |
| [Pages feature parity](app-doc://article/material-bluemap.repository.4f38f12cc06d79b0) | The hand-written shared-feature inventory and the browser-platform boundaries that keep it honest. |
| [Scheduled settings and external sources](app-doc://article/material-bluemap.repository.46044e0d11da0c2f) | Versioned language and appearance schedules driven by local time, bounded JSON APIs and Home Assistant boolean entities. |
| [Panel geometry](app-doc://article/material-bluemap.repository.97b2bcc5d8bae38e) | Resize, drag, viewport bounds, persistence, reset and keyboard control for site panels. |

The site has no HTTP API of its own, so a Postman collection is not applicable. External schedule
sources are read-only browser requests documented in their own article; they do not turn this
static site into an API server.
