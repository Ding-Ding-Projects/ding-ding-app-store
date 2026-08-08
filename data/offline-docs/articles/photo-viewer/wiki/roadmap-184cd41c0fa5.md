# Roadmap

Mirrors [ROADMAP.md](https://github.com/DingDingChae/Photo-Viewer/blob/main/ROADMAP.md) in the repo — the repo file is authoritative.

## ✅ Milestone 0 — Repository setup (done)
- GitHub repo, README/ROADMAP/HANDOFF, Discussions + rolling progress thread, linked Project board

## Milestone 1 — App scaffolding
- Vite + React + TypeScript
- Material Design 3 theming with runtime controls
- Language modes (EN / HK Cantonese / bilingual) + funny-level slider
- Non-blocking notifications
- CI workflow: test first, then one uniquely tagged release per successful run

## Milestone 2 — Library & media
- Browse-for-folder picker (persisted, rescanable)
- Local git-backed history of the photos folder
- Photo grid + viewer; video playback/thumbnails/scrubbing
- Video splitting — max 1 GB per file part
- EXIF / GPS metadata extraction

## Milestone 3 — AI indexing
- On-device analysis (objects, scenes, faces, OCR, colors)
- Persistent index storage — searchable across sessions
- Background indexing queue

## Milestone 4 — Search & organization
- Unified search + full regex builder
- Auto-sort by date/location/type; smart categories & albums

## Milestone 5 — Docker & self-hosting
- HTTP server for the library; original-file download endpoint
- Responsive UI on phone/tablet/desktop
- Dockerfile + compose; self-hosting guide

## Milestone 6 — Polish & release
- Accessibility + clipping/sizing passes
- Installable release artifact; docs site
