# `bluemap/pipeline.py`

**Python** · 334 lines · 14,427 bytes · 1 commit(s) · first 2026-06-07 · last 2026-06-07

## Purpose

BlueMap pipeline for the Minecraft world-downloader. Turns a downloaded world into an interactive 3D web map: 1. upgrade — run a temporary server jar with --forceUpgrade to upgrade the saved world to the latest data format / folder structure, then it stops automatically. 2. render — run BlueMap (standalone CLI) to render the world into a web map. 3. serve — host the rendered web map with BlueMap's integrated webserver. 4. all — upgrade (optional) + render in one go. BlueMap supports Minecraft 1.13+ (3D rendering is best on 1.18+ worlds, which is the focus here). Examples: python pipeline.py fe

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `97c2198` | cafepromenade | Add BlueMap pipeline: server-jar world upgrade + 3D web map render |

← file-history index
