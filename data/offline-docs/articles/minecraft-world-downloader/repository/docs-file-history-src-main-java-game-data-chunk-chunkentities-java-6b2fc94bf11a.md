# `src/main/java/game/data/chunk/ChunkEntities.java`

**Java** · 364 lines · 14,641 bytes · 26 commit(s) · first 2021-02-17 · last 2026-06-07

## Purpose

Block-entity NBT fields that hold contents worth keeping across chunk re-sends / block updates (container items, lectern book, jukebox record, custom name, loot table, etc.).

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `088d876` | cafepromenade | Port remaining map-colour + safety leftovers from TheHecateII's fork |
| 2026-06-07 | `033c92a` | cafepromenade | Fix auto-open container saving; add configurable saved-container message and chat auto-reply |
| 2026-06-05 | `d1bb27a` | cafepromenade | Add opt-in, spectator-gated auto-open of nearby containers (#8) |
| 2026-06-03 | `60e20dc` | cafepromenade | Remove temporary container-save debug logging |
| 2026-06-03 | `e415496` | cafepromenade | Show saved-inventory message on action bar + chat; add save debug logging |
| 2026-06-03 | `3f38ec4` | cafepromenade | Don't "unsave" container inventories when a chunk is revisited |
| 2026-06-03 | `598af41` | cafepromenade | Make container inventory saving robust + custom save message |
| 2023-03-11 | `8759183` | Mirco Kroon | Updated renderDistanceExtender to use circles |
| 2022-06-15 | `a0fbc68` | Mirco Kroon | Prevent info messages when loading previously stored inventories |
| 2022-06-06 | `26327e0` | Mirco Kroon | Fixed blank banners not being saved |
| 2022-06-01 | `bee94c0` | Jorel Ali | Fixes lecterns with written and writable books |
| 2022-06-01 | `05727f1` | Mirco Kroon | Formatting etc |
| 2022-06-01 | `2187b73` | Jorel Ali | Squashed commit of the following: |
| 2022-06-01 | `3b1cfff` | Jorel Ali | Fix beds not rendering |
| 2022-05-31 | `0c37300` | Jorel Ali | Update chunks when blockentities or blocks are updated |
| 2022-05-30 | `fbe06fb` | Jorel Ali | 1.18.2 support. |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-06-11 | `2865f3a` | Mirco Kroon | Added comment |
| 2021-06-11 | `f48d3a2` | Mirco Kroon | Store entities separately in 1.17 |
| 2021-03-10 | `8960f88` | Mirco Kroon | Fixed missing lighting on some chunks, performance optimisations |
| 2021-02-26 | `fbe3bea` | Mirco Kroon | Fixed incorrect coordinate parsing, create missing tile entities |
| 2021-02-25 | `c2d3554` | Mirco Kroon | Send info messages for inventory saving |
| 2021-02-21 | `572cfd7` | Mirco Kroon | Move entity and map parsing to own threads |
| 2021-02-21 | `dba62ed` | Mirco Kroon | Fix incorrect tile entity names |
| 2021-02-19 | `ca61619` | Mirco Kroon | Improved handling of entity data |
| 2021-02-17 | `797d3a9` | Mirco Kroon | Improved overview rendering, reduced contents of Chunk class |

← file-history index
