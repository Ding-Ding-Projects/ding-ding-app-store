# `src/main/java/packets/handler/ClientBoundGamePacketHandler.java`

**Java** · 284 lines · 11,438 bytes · 44 commit(s) · first 2021-02-01 · last 2026-06-08

## Purpose

Track the player's gamemode so the (opt-in) auto-open feature can gate on spectator mode. The Game Event packet is [unsigned byte event][float value]; event 3 = change game mode,

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-08 | `fa72244` | cafepromenade | Log the in-game (PLAY-phase) kick reason; map Disconnect for 1.12.2 |
| 2026-06-07 | `cf52f76` | cafepromenade | Port from TheHecateII fork: voice-chat UDP proxy (PlasmoVoice / Simple Voice Chat) |
| 2026-06-07 | `8c892fa` | cafepromenade | Auto-open + chat-reply: fix modern-server capture, add item log, player-safe chests |
| 2026-06-07 | `033c92a` | cafepromenade | Fix auto-open container saving; add configurable saved-container message and chat auto-reply |
| 2026-06-05 | `d1bb27a` | cafepromenade | Add opt-in, spectator-gated auto-open of nearby containers (#8) |
| 2026-06-04 | `72f3d1b` | cafepromenade | d |
| 2026-06-01 | `9290a94` | cafepromenade | Add support for Minecraft 1.8-1.11 |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2023-11-24 | `4a5c14c` | nnnlog | Update for 1.20.2 |
| 2023-09-23 | `c745530` | Zomabies | Check for previously saved villager trades |
| 2023-08-27 | `449732b` | Mirco Kroon | Prevent server from lowering view radius |
| 2023-03-18 | `38d60f2` | Mirco Kroon | Handle Forge plugin protocol (for 1.12.2) |
| 2023-03-11 | `8759183` | Mirco Kroon | Updated renderDistanceExtender to use circles |
| 2022-06-14 | `a0aba8b` | Mirco Kroon | Blocks & entities for 1.19 |
| 2022-06-01 | `1eca8dc` | Jorel Ali | Link villager trades to storing the data for villagers |
| 2022-05-31 | `613c98e` | Jorel Ali | Parse villager trade list packet |
| 2022-05-31 | `3205a6a` | Jorel Ali | Fixes container saving. Fixes "last source index 10 out of bounds for byte[2]" bug. |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-07-10 | `b8b0101` | Mirco Kroon | Fixed handling of container packets for 1.17.1 |
| 2021-05-29 | `d510cb0` | Mirco Kroon | Rename packets to official mapping names |
| 2021-03-10 | `4df3069` | Mirco Kroon | Prompt for deleting chunks, option to prune images |
| 2021-03-09 | `8cf1f9d` | Mirco Kroon | Send lighting data for chunks |
| 2021-02-24 | `93c6ccb` | Mirco Kroon | Added multi-block changes, fixed some bugs |
| 2021-02-24 | `2ae4a65` | Mirco Kroon | Single block changes for 1.12 |
| 2021-02-24 | `06f2479` | Mirco Kroon | Handle single-block updates for 1.13+ |
| 2021-02-23 | `c4a41b7` | Mirco Kroon | Added option to render players to the minimap |
| 2021-02-20 | `7b3fd19` | Mirco Kroon | Improved structure of version handling code |
| 2021-02-20 | `5d9f688` | Mirco Kroon | Handle armorstands in 1.16 |
| 2021-02-20 | `b247243` | Mirco Kroon | Saving of map item contents |
| 2021-02-19 | `ca61619` | Mirco Kroon | Improved handling of entity data |
| 2021-02-17 | `b22a9f4` | Mirco Kroon | Fixed concurrency issues |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-08 | `8a0158c` | Mirco Kroon | Added option to override server reported render distance |
| 2021-02-08 | `31850eb` | Mirco Kroon | Prevent crashes on invalid entities |
| 2021-02-07 | `5455bd4` | Mirco Kroon | Chunk extending for 1.15 |
| 2021-02-06 | `4a76c82` | Mirco Kroon | Chunk extending for 1.14 |
| 2021-02-06 | `59ab9a5` | Mirco Kroon | Removed some prints |
| 2021-02-06 | `7136837` | Mirco Kroon | Invalidate extended chunks on dimension change |
| 2021-02-05 | `58ccb5c` | Mirco Kroon | Render-distance extending for 1.12.2 |
| 2021-02-04 | `7f931b2` | Mirco Kroon | Complete render-distance extending for 1.16 |
| 2021-02-04 | `f2c4d75` | Mirco Kroon | Computed which chunks to send to the client for chunk extending |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2021-02-01 | `4136b3c` | Mirco Kroon | Rename PacketBuilder, created actual PacketBuilder |

← file-history index
