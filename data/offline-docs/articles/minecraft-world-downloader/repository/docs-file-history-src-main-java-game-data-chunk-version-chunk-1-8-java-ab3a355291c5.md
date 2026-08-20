# `src/main/java/game/data/chunk/version/Chunk_1_8.java`

**Java** · 124 lines · 4,851 bytes · 1 commit(s) · first 2026-06-01 · last 2026-06-01

## Purpose

Minecraft 1.8 chunk format. This predates the per-section palette that was introduced in 1.9, so the block data is sent as a raw array of little-endian shorts holding {@code (blockId << 4) | metadata}, with no palette. The column layout also differs from 1.9+: all section block arrays come first, followed by all block-light arrays, then all sky-light arrays (overworld only), then the 256-byte biome array for full chunks. The chunk-data packet carries no trailing block-entity array. On disk 1.8 uses the same anvil section format (Blocks/Data/BlockLight/SkyLight + byte biomes) as 1.9-1.12, so we

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-01 | `9290a94` | cafepromenade | Add support for Minecraft 1.8-1.11 |

← file-history index
