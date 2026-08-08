# `src/main/java/game/data/chunk/palette/ModdedBlockColorExtractor.java`

**Java** · 218 lines · 8,454 bytes · 1 commit(s) · first 2026-06-07 · last 2026-06-07

## Purpose

Provides colors for modded blocks not in block-colors.json. Two strategies, tried in order: 1. Extract the average color of the block's top-face texture from the mod JAR inside .minecraft/mods/. 2. Generate a deterministic pastel color from the block name's hash so the block is at least visible on the map even when no texture can be found. Results are cached so each block name is only resolved once per session.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `c3fd028` | cafepromenade | Port from TheHecateII fork: modded block map colors + CustomPayload 1.20.6/1.21 |

← file-history index
