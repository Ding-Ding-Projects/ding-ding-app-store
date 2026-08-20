# `src/main/java/game/data/dimension/Biome.java`

**Java** · 111 lines · 3,709 bytes · 6 commit(s) · first 2021-01-31 · last 2024-05-17

## Purpose

Holds biomes that are registered the server. The server does not give us any information about world generation in these biomes so the client can't generate more of them, but we still need to register them as they may be used in the world.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2023-03-10 | `fbed308` | Mirco Kroon | Write chunks to packet for 1.18 and 1.19 |
| 2022-06-16 | `f5ea0a4` | Mirco Kroon | Get biome IDs from server login instead of json file |
| 2021-02-16 | `bc80a7f` | Mirco Kroon | Improved handling of paths and working directories |
| 2021-02-15 | `242b6ec` | Mirco Kroon | Replace mkdirs with CreateDirectories |
| 2021-01-31 | `662ac7d` | Mirco Kroon | Added support for custom dimensions |

← file-history index
