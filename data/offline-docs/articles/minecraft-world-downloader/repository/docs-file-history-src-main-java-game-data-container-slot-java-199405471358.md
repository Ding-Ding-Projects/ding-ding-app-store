# `src/main/java/game/data/container/Slot.java`

**Java** · 77 lines · 2,519 bytes · 12 commit(s) · first 2020-04-11 · last 2026-06-07

## Purpose

1.20.5 reworked the item NBT format: the stack size moved from "Count" (byte) to "count" (int) and item data moved from "tag" into "components". Writing the old keys to a 1.20.5+ world makes the client read a default count of 1 (so saved containers looked almost empty in-game). Match the world's format; we don't reconstruct data components, so only id + count are written there.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `66846c9` | cafepromenade | Port from TheHecateII fork: player skin-heads on map + null-safety fixes |
| 2026-06-07 | `3dd17b2` | cafepromenade | Fix modern (1.20.5+) container item NBT; auto-open container minecarts |
| 2026-06-07 | `8c892fa` | cafepromenade | Auto-open + chat-reply: fix modern-server capture, add item log, player-safe chests |
| 2022-06-02 | `da81c1d` | Mirco Kroon | Formatting, changed packet names to 'official' ones |
| 2022-06-01 | `05727f1` | Mirco Kroon | Formatting etc |
| 2022-06-01 | `c08adec` | Mirco Kroon | Moved registries out of WorldManager |
| 2021-02-19 | `ca61619` | Mirco Kroon | Improved handling of entity data |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2020-10-15 | `722be2e` | Mirco Kroon | Inventory saving & dimension handling for 1.12.2 |
| 2020-08-28 | `7503fed` | Mirco Kroon | Support for double chests |
| 2020-08-28 | `ef11808` | Mirco Kroon | Single-chest item saving |
| 2020-04-11 | `a3d8d6e` | Mirco Kroon | Initial code for container saving |

← file-history index
