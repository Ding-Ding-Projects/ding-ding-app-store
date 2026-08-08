# `src/main/java/game/data/container/ContainerManager.java`

**Java** · 303 lines · 13,804 bytes · 27 commit(s) · first 2020-08-28 · last 2026-06-07

## Purpose

volatile: written on the serverbound thread (auto-opener tick / real UseItemOn) and read on the clientbound thread (openWindow when OpenScreen arrives). Without the memory barrier the clientbound thread could observe null or a stale target, registering an auto-opened window at the wrong/no location so its contents are never saved.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `3dd17b2` | cafepromenade | Fix modern (1.20.5+) container item NBT; auto-open container minecarts |
| 2026-06-07 | `8c892fa` | cafepromenade | Auto-open + chat-reply: fix modern-server capture, add item log, player-safe chests |
| 2026-06-07 | `033c92a` | cafepromenade | Fix auto-open container saving; add configurable saved-container message and chat auto-reply |
| 2026-06-07 | `734861d` | cafepromenade | auto open |
| 2026-06-05 | `d1bb27a` | cafepromenade | Add opt-in, spectator-gated auto-open of nearby containers (#8) |
| 2026-06-04 | `72f3d1b` | cafepromenade | d |
| 2026-06-03 | `f5ef12b` | cafepromenade | Show saved-inventory message only on the action bar, not in chat |
| 2026-06-03 | `60e20dc` | cafepromenade | Remove temporary container-save debug logging |
| 2026-06-03 | `e415496` | cafepromenade | Show saved-inventory message on action bar + chat; add save debug logging |
| 2026-06-03 | `61cc4f7` | cafepromenade | Make the saved-inventory message actually show (chat + valid packet) |
| 2026-06-03 | `598af41` | cafepromenade | Make container inventory saving robust + custom save message |
| 2023-03-11 | `8759183` | Mirco Kroon | Updated renderDistanceExtender to use circles |
| 2022-06-15 | `a0fbc68` | Mirco Kroon | Prevent info messages when loading previously stored inventories |
| 2021-07-10 | `b8b0101` | Mirco Kroon | Fixed handling of container packets for 1.17.1 |
| 2021-02-26 | `8d5e9ab` | Mirco Kroon | Send messages for missing chunks/blocks when saving inventory |
| 2021-02-24 | `93c6ccb` | Mirco Kroon | Added multi-block changes, fixed some bugs |
| 2021-02-24 | `2ae4a65` | Mirco Kroon | Single block changes for 1.12 |
| 2021-02-17 | `b22a9f4` | Mirco Kroon | Fixed concurrency issues |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-06 | `7136837` | Mirco Kroon | Invalidate extended chunks on dimension change |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2020-10-16 | `549800e` | Mirco Kroon | New tile entities check for previously acquired inventory data |
| 2020-10-15 | `722be2e` | Mirco Kroon | Inventory saving & dimension handling for 1.12.2 |
| 2020-10-15 | `207a9cc` | Mirco Kroon | Fixed inventories not being saved when loaded after chunk saving |
| 2020-08-28 | `7503fed` | Mirco Kroon | Support for double chests |
| 2020-08-28 | `ef11808` | Mirco Kroon | Single-chest item saving |

← file-history index
