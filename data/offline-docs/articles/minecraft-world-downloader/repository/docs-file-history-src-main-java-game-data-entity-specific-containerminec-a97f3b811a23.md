# `src/main/java/game/data/entity/specific/ContainerMinecart.java`

**Java** · 60 lines · 1,612 bytes · 1 commit(s) · first 2026-06-07 · last 2026-06-07

## Purpose

A container minecart (chest / hopper minecart). Minecarts are entities, not block entities, so their captured contents are written into the saved entity NBT (the chunk's "Entities" list) rather than as a block entity. Populated by the (opt-in) auto-open sweep when it interacts with the minecart.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `3dd17b2` | cafepromenade | Fix modern (1.20.5+) container item NBT; auto-open container minecarts |

← file-history index
