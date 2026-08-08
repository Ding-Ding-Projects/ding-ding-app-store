# `src/main/java/game/data/chunk/palette/GlobalPaletteProvider.java`

**Java** · 85 lines · 3,000 bytes · 6 commit(s) · first 2021-01-30 · last 2024-05-17

## Purpose

This class manages the block registries. It can hold not only a palette for the current game version, but also for different versions when these are needed to load previously saved chunks.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2023-03-18 | `38d60f2` | Mirco Kroon | Handle Forge plugin protocol (for 1.12.2) |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-04 | `92959a7` | Mirco Kroon | Measure render distance on versions < 1.14 |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2021-01-30 | `e8501ba` | Mirco Kroon | Allow multiple global palettes for drawing previous chunks |

← file-history index
