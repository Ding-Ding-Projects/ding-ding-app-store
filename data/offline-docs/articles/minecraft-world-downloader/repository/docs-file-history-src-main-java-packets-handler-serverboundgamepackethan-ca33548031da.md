# `src/main/java/packets/handler/ServerBoundGamePacketHandler.java`

**Java** · 121 lines · 4,799 bytes · 20 commit(s) · first 2021-02-01 · last 2026-06-07

## Purpose

newer versions first include a VarInt with the hand

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `c8ddc47` | cafepromenade | Make 1.21.5+ fully work; player-aware chests; configurable auto-reply colours |
| 2026-06-07 | `8c892fa` | cafepromenade | Auto-open + chat-reply: fix modern-server capture, add item log, player-safe chests |
| 2026-06-05 | `d1bb27a` | cafepromenade | Add opt-in, spectator-gated auto-open of nearby containers (#8) |
| 2024-02-08 | `e2359a8` | nnnlog | Update for 1.20.3 |
| 2023-11-26 | `91aacdf` | Mirco Kroon | Added support for network Configuration stage |
| 2023-09-23 | `c745530` | Zomabies | Check for previously saved villager trades |
| 2023-03-09 | `9abb16b` | Mirco Kroon | Reduced complexity of updating to new versions |
| 2023-03-07 | `f2e8c6a` | Mirco Kroon | Smoother panning on map |
| 2022-06-02 | `da81c1d` | Mirco Kroon | Formatting, changed packet names to 'official' ones |
| 2022-06-01 | `1eca8dc` | Jorel Ali | Link villager trades to storing the data for villagers |
| 2022-06-01 | `2187b73` | Jorel Ali | Squashed commit of the following: |
| 2022-05-31 | `3205a6a` | Jorel Ali | Fixes container saving. Fixes "last source index 10 out of bounds for byte[2]" bug. |
| 2021-05-29 | `d510cb0` | Mirco Kroon | Rename packets to official mapping names |
| 2021-02-20 | `7b3fd19` | Mirco Kroon | Improved structure of version handling code |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-04 | `f8c3f25` | Mirco Kroon | Show player facing direction in GUI |
| 2021-02-04 | `f2c4d75` | Mirco Kroon | Computed which chunks to send to the client for chunk extending |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2021-02-01 | `4136b3c` | Mirco Kroon | Rename PacketBuilder, created actual PacketBuilder |

← file-history index
