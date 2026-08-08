# `src/main/java/game/data/entity/PlayerEntity.java`

**Java** · 209 lines · 7,338 bytes · 4 commit(s) · first 2021-02-23 · last 2026-06-07

## Purpose

Tracks a player entity seen in the world. Head loading strategy (fastest path first): 1. Memory cache -- sub-millisecond, same session 2. Disk cache -- ~1 ms, across sessions (cache/heads/{uuid}.png = 64x64 skin) 3. Mojang profile API -- async, fetches name + skin URL -> textures.minecraft.net CDN -- async, downloads raw skin PNG

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `66846c9` | cafepromenade | Port from TheHecateII fork: player skin-heads on map + null-safety fixes |
| 2023-11-24 | `4a5c14c` | nnnlog | Update for 1.20.2 |
| 2021-02-24 | `2ae4a65` | Mirco Kroon | Single block changes for 1.12 |
| 2021-02-23 | `c4a41b7` | Mirco Kroon | Added option to render players to the minimap |

← file-history index
