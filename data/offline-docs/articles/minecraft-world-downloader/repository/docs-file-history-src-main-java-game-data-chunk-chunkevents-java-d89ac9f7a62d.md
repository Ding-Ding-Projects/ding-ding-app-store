# `src/main/java/game/data/chunk/ChunkEvents.java`

**Java** · 72 lines · 2,292 bytes · 3 commit(s) · first 2021-03-10 · last 2023-03-08

## Purpose

Handle tracking of chunk events (e.g. loading, unloading, lighting data) for debugging purposes. Should not be enabled during normal usage as events are never deleted (so memory usage grows unbounded).

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2023-03-08 | `19e0835` | Mirco Kroon | Fixed memory leaks and performance issues |
| 2021-03-10 | `ca32db4` | Mirco Kroon | Comments |
| 2021-03-10 | `8960f88` | Mirco Kroon | Fixed missing lighting on some chunks, performance optimisations |

← file-history index
