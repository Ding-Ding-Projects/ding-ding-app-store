# `src/main/java/config/Config.java`

**Java** · 751 lines · 29,589 bytes · 56 commit(s) · first 2021-02-13 · last 2026-06-07

## Purpose

fields marked transient so they are not written to JSON file

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `bf01ff9` | cafepromenade | Smooth out extended render distance (fix choppy chunk delivery) |
| 2026-06-07 | `f199366` | cafepromenade | Make remaining features settable: modded-colors disable, msg format, state file |
| 2026-06-07 | `1eb9f89` | cafepromenade | Auto-open: also skip shulker boxes while a player is nearby |
| 2026-06-07 | `74d73df` | cafepromenade | Headless map rendering + interactive web-console map |
| 2026-06-07 | `f397e31` | cafepromenade | Auto-open: raise default player-nearby radius to 100 blocks |
| 2026-06-07 | `ef5d1d2` | cafepromenade | Auto-open: also skip barrels while a player is nearby |
| 2026-06-07 | `cf52f76` | cafepromenade | Port from TheHecateII fork: voice-chat UDP proxy (PlasmoVoice / Simple Voice Chat) |
| 2026-06-07 | `c3fd028` | cafepromenade | Port from TheHecateII fork: modded block map colors + CustomPayload 1.20.6/1.21 |
| 2026-06-07 | `c8ddc47` | cafepromenade | Make 1.21.5+ fully work; player-aware chests; configurable auto-reply colours |
| 2026-06-07 | `8c892fa` | cafepromenade | Auto-open + chat-reply: fix modern-server capture, add item log, player-safe chests |
| 2026-06-07 | `033c92a` | cafepromenade | Fix auto-open container saving; add configurable saved-container message and chat auto-reply |
| 2026-06-07 | `734861d` | cafepromenade | auto open |
| 2026-06-05 | `3a74eed` | cafepromenade | Auto-open: configurable gamemodes (survival), fix swallowed real opens, capture crafters (#9) |
| 2026-06-05 | `d1bb27a` | cafepromenade | Add opt-in, spectator-gated auto-open of nearby containers (#8) |
| 2026-06-01 | `9290a94` | cafepromenade | Add support for Minecraft 1.8-1.11 |
| 2026-05-07 | `9d7eada` | cafepromenade | Reduce terminal error output and trim config I/O allocations |
| 2023-08-27 | `4c206c3` | Mirco Kroon | Disable cave rendering by default |
| 2023-08-21 | `7139106` | Mirco Kroon | Added switching between rendering modes |
| 2023-07-05 | `4d8e4a7` | Mirco Kroon | Simplified UI connection tab |
| 2023-03-12 | `4509d87` | Mirco Kroon | Added advanced settings section |
| 2023-03-11 | `8759183` | Mirco Kroon | Updated renderDistanceExtender to use circles |
| 2023-03-07 | `cd7eac6` | Mirco Kroon | Option to grey out older chunks |
| 2023-03-07 | `b6183c4` | Mirco Kroon | Added smooth zooming |
| 2023-03-05 | `4a80dbf` | Mirco Kroon | Fixed loading old chunks not working correctly since 1.18 |
| 2022-06-16 | `f5ea0a4` | Mirco Kroon | Get biome IDs from server login instead of json file |
| 2022-06-16 | `65ef8f1` | Mirco Kroon | Fixed crash when config file is empty |
| 2022-06-05 | `c086f84` | Mirco Kroon | Fixed issue with GUI not always appearing |
| 2022-06-05 | `1ee16cf` | Mirco Kroon | Improved authentication GUI and method handling |
| 2022-06-04 | `2c76e26` | Mirco Kroon | Added basic Microsoft oauth flow |
| 2022-06-01 | `05727f1` | Mirco Kroon | Formatting etc |
| 2022-06-01 | `c08adec` | Mirco Kroon | Moved registries out of WorldManager |
| 2022-05-31 | `1cdf24b` | Jorel Ali | Fix villager type/profession registries not being initialized properly |
| 2022-05-30 | `fbe06fb` | Jorel Ali | 1.18.2 support. |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-07-17 | `7f2357e` | Mirco Kroon | Retrieve auth details from game process instead of launcher file |
| 2021-06-07 | `b753aec` | Mirco Kroon | Added support for 1.17 |
| 2021-03-17 | `b635c40` | Mirco Kroon | Added realms menu |
| 2021-03-10 | `8960f88` | Mirco Kroon | Fixed missing lighting on some chunks, performance optimisations |
| 2021-03-05 | `ea218a7` | Esper Thomson | Made -z an alias of --overview-zoom. |
| 2021-02-25 | `c2d3554` | Mirco Kroon | Send info messages for inventory saving |
| 2021-02-24 | `2ae4a65` | Mirco Kroon | Single block changes for 1.12 |
| 2021-02-23 | `c4a41b7` | Mirco Kroon | Added option to render players to the minimap |
| 2021-02-20 | `7b3fd19` | Mirco Kroon | Improved structure of version handling code |
| 2021-02-19 | `ca61619` | Mirco Kroon | Improved handling of entity data |
| 2021-02-17 | `b22a9f4` | Mirco Kroon | Fixed concurrency issues |
| 2021-02-16 | `bc80a7f` | Mirco Kroon | Improved handling of paths and working directories |
| 2021-02-15 | `242b6ec` | Mirco Kroon | Replace mkdirs with CreateDirectories |
| 2021-02-15 | `b55aa0f` | Mirco Kroon | Cleaned up pom file |
| 2021-02-15 | `18f7b45` | Mirco Kroon | Reload previous settings from file |
| 2021-02-15 | `ea5fff5` | Mirco Kroon | Slider for extended render distance |
| 2021-02-14 | `50416dc` | Mirco Kroon | Fixed world offset, added debug writing of chunks |
| 2021-02-14 | `c2fb5bc` | Mirco Kroon | Improved authentication handling, removed interactive aspect |
| 2021-02-14 | `e5c3ff6` | Mirco Kroon | Added Minecraft path to settings |
| 2021-02-13 | `352e0c2` | Mirco Kroon | Redirect console output when not run from a terminal |
| 2021-02-13 | `1aba4e1` | Mirco Kroon | Added settings UI |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |

← file-history index
