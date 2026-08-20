# `src/main/resources/protocol-versions.json`

**JSON** · 1118 lines · 29,978 bytes · 61 commit(s) · first 2021-02-04 · last 2026-06-08

## Purpose

_No leading comment/docstring found — see the file and its history below._

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-08 | `fa72244` | cafepromenade | Log the in-game (PLAY-phase) kick reason; map Disconnect for 1.12.2 |
| 2026-06-07 | `c3fd028` | cafepromenade | Port from TheHecateII fork: modded block map colors + CustomPayload 1.20.6/1.21 |
| 2026-06-07 | `8c892fa` | cafepromenade | Auto-open + chat-reply: fix modern-server capture, add item log, player-safe chests |
| 2026-06-07 | `033c92a` | cafepromenade | Fix auto-open container saving; add configurable saved-container message and chat auto-reply |
| 2026-06-05 | `a5be3ae` | cafepromenade | Map GameEvent for 1.21-1.21.8; add auto-open action-bar diagnostic (#10) |
| 2026-06-05 | `d1bb27a` | cafepromenade | Add opt-in, spectator-gated auto-open of nearby containers (#8) |
| 2026-06-04 | `72f3d1b` | cafepromenade | d |
| 2026-06-03 | `4f8cf07` | cafepromenade | Fix wrong 1.20.4 serverbound packet IDs (containers never saved) |
| 2026-06-01 | `cd0b105` | cafepromenade | Add protocol entries for 1.21.2-1.21.11 point releases |
| 2026-06-01 | `9290a94` | cafepromenade | Add support for Minecraft 1.8-1.11 |
| 2026-05-31 | `64da528` | cafepromenade | Add support for Minecraft 26.1 (protocol 775) |
| 2024-06-29 | `220d8fc` | Mirco Kroon | Support for most of 1.21 |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2024-02-08 | `e2359a8` | nnnlog | Update for 1.20.3 |
| 2023-11-26 | `91aacdf` | Mirco Kroon | Added support for network Configuration stage |
| 2023-11-24 | `4a5c14c` | nnnlog | Update for 1.20.2 |
| 2023-09-23 | `57f0922` | Zomabies | Fix villager trades packet parsing |
| 2023-06-18 | `00e7c7c` | n90p | Support for 1.20 |
| 2023-03-18 | `38d60f2` | Mirco Kroon | Handle Forge plugin protocol (for 1.12.2) |
| 2023-03-14 | `65bcc35` | Mirco Kroon | Added support for 1.19.4 |
| 2023-03-11 | `8759183` | Mirco Kroon | Updated renderDistanceExtender to use circles |
| 2023-03-09 | `9abb16b` | Mirco Kroon | Reduced complexity of updating to new versions |
| 2023-03-06 | `98c9d3b` | Logan Bell | Fix entity metadata not being parsed correctly |
| 2023-02-28 | `6699d2d` | Mirco Kroon | Removed support for protocol version 760 (1.19 to 19.2) |
| 2023-02-28 | `d433468` | Mirco Kroon | Merge remote-tracking branch 'LoganTheBell/master' into minecraft-1.19.3 |
| 2023-02-28 | `cd0d58e` | Mirco Kroon | Fixed some issues on earlier versions |
| 2023-02-26 | `e9390a5` | Logan Bell | Add support for 1.19.3 |
| 2022-09-28 | `3140f01` | Karen/あけみ | Support for Minecraft version 1.19.1/1.19.2 |
| 2022-09-09 | `9dd3b2f` | Karen/あけみ | Changed `dataVersion` value for protocol 760 (1.19.1/2) back to 3117 (1.19.1). ※ This ONLY affects the `DataVersion` value in `level.dat`, and not any actual region/chunk data. |
| 2022-08-30 | `eb284e1` | Karen/あけみ | Add new packet IDs for protocol 760 (1.19.1/2). ※ `dataVersion` is intentionally set to 3105 (1.19), please read the full commit message for more details. |
| 2022-06-14 | `4a95e3c` | Mirco Kroon | Correctly handle respawns & status messages, improved auth performance |
| 2022-06-13 | `d8dd512` | Mirco Kroon | Updated login sequence for 1.19 |
| 2022-06-02 | `da81c1d` | Mirco Kroon | Formatting, changed packet names to 'official' ones |
| 2022-06-01 | `1eca8dc` | Jorel Ali | Link villager trades to storing the data for villagers |
| 2022-05-31 | `613c98e` | Jorel Ali | Parse villager trade list packet |
| 2022-06-01 | `3699df7` | Mirco Kroon | Fixed index OOB for multi-block changes on some servers |
| 2022-06-01 | `05727f1` | Mirco Kroon | Formatting etc |
| 2022-06-01 | `2187b73` | Jorel Ali | Squashed commit of the following: |
| 2022-05-30 | `fbe06fb` | Jorel Ali | 1.18.2 support. |
| 2021-12-23 | `733753d` | Mirco Kroon | Disabled some functionality for 1.18 |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-06-09 | `dd9d538` | Mirco Kroon | Fixed handling of lighting and network encoding for 1.17 |
| 2021-06-07 | `b753aec` | Mirco Kroon | Added support for 1.17 |
| 2021-05-29 | `d510cb0` | Mirco Kroon | Rename packets to official mapping names |
| 2021-03-10 | `4df3069` | Mirco Kroon | Prompt for deleting chunks, option to prune images |
| 2021-02-25 | `c2d3554` | Mirco Kroon | Send info messages for inventory saving |
| 2021-02-24 | `93c6ccb` | Mirco Kroon | Added multi-block changes, fixed some bugs |
| 2021-02-24 | `2ae4a65` | Mirco Kroon | Single block changes for 1.12 |
| 2021-02-24 | `06f2479` | Mirco Kroon | Handle single-block updates for 1.13+ |
| 2021-02-23 | `c4a41b7` | Mirco Kroon | Added option to render players to the minimap |
| 2021-02-20 | `19a39bc` | Mirco Kroon | Entities & maps for other versions |
| 2021-02-20 | `7b3fd19` | Mirco Kroon | Improved structure of version handling code |
| 2021-02-20 | `5d9f688` | Mirco Kroon | Handle armorstands in 1.16 |
| 2021-02-20 | `b247243` | Mirco Kroon | Saving of map item contents |
| 2021-02-19 | `ca61619` | Mirco Kroon | Improved handling of entity data |
| 2021-02-07 | `c65d4d3` | Mirco Kroon | Removed support for 1.16.0 and 1.16.1 |
| 2021-02-07 | `5455bd4` | Mirco Kroon | Chunk extending for 1.15 |
| 2021-02-06 | `4a76c82` | Mirco Kroon | Chunk extending for 1.14 |
| 2021-02-06 | `7136837` | Mirco Kroon | Invalidate extended chunks on dimension change |
| 2021-02-05 | `58ccb5c` | Mirco Kroon | Render-distance extending for 1.12.2 |
| 2021-02-04 | `92959a7` | Mirco Kroon | Measure render distance on versions < 1.14 |

← file-history index
