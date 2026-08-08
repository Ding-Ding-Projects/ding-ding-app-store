# `src/main/java/game/data/WorldManager.java`

**Java** · 942 lines · 33,270 bytes · 113 commit(s) · first 2019-05-11 · last 2026-06-07

## Purpose

_No leading comment/docstring found — see the file and its history below._

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `bf01ff9` | cafepromenade | Smooth out extended render distance (fix choppy chunk delivery) |
| 2026-06-07 | `74d73df` | cafepromenade | Headless map rendering + interactive web-console map |
| 2026-06-07 | `8c892fa` | cafepromenade | Auto-open + chat-reply: fix modern-server capture, add item log, player-safe chests |
| 2026-06-07 | `033c92a` | cafepromenade | Fix auto-open container saving; add configurable saved-container message and chat auto-reply |
| 2026-06-05 | `d1bb27a` | cafepromenade | Add opt-in, spectator-gated auto-open of nearby containers (#8) |
| 2026-06-03 | `3f38ec4` | cafepromenade | Don't "unsave" container inventories when a chunk is revisited |
| 2026-05-29 | `5d9f30f` | cafepromenade | Keep periodic save running and release save lock reliably |
| 2026-05-29 | `4adeccd` | cafepromenade | Log suppressed exceptions in attemptQuiet to surface hidden errors |
| 2026-05-08 | `dd3a9e0` | cafepromenade | Enhance GitHub Actions & add release/report files |
| 2024-06-29 | `74fa526` | Mirco Kroon | Removed print |
| 2024-06-29 | `6008888` | Mirco Kroon | Prevent some errors on 1.21 |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2023-08-21 | `7139106` | Mirco Kroon | Added switching between rendering modes |
| 2023-03-18 | `38d60f2` | Mirco Kroon | Handle Forge plugin protocol (for 1.12.2) |
| 2023-03-13 | `c27018a` | Mirco Kroon | Adjusted render distance extending circles |
| 2023-03-13 | `6ffd362` | Mirco Kroon | Fixed more render distance extender issues |
| 2023-03-12 | `4509d87` | Mirco Kroon | Added advanced settings section |
| 2023-03-12 | `ac0493a` | Mirco Kroon | Fixed a few issues with unloading chunks or not loading them correctly |
| 2023-03-11 | `8759183` | Mirco Kroon | Updated renderDistanceExtender to use circles |
| 2023-03-08 | `19e0835` | Mirco Kroon | Fixed memory leaks and performance issues |
| 2023-03-07 | `f2e8c6a` | Mirco Kroon | Smoother panning on map |
| 2023-03-06 | `876e4f7` | Mirco Kroon | Formatting |
| 2023-03-06 | `9303cd6` | Mirco Kroon | Improved quitting behaviour |
| 2023-03-06 | `22de1b6` | Mirco Kroon | Caching of overview images |
| 2023-03-06 | `547bd1d` | Mirco Kroon | Changed GUI map to use region images instead of chunk images |
| 2023-03-05 | `4a80dbf` | Mirco Kroon | Fixed loading old chunks not working correctly since 1.18 |
| 2022-06-16 | `f5ea0a4` | Mirco Kroon | Get biome IDs from server login instead of json file |
| 2022-06-02 | `da81c1d` | Mirco Kroon | Formatting, changed packet names to 'official' ones |
| 2022-06-01 | `1eca8dc` | Jorel Ali | Link villager trades to storing the data for villagers |
| 2022-06-01 | `c08adec` | Mirco Kroon | Moved registries out of WorldManager |
| 2022-06-01 | `2187b73` | Jorel Ali | Squashed commit of the following: |
| 2022-05-31 | `1cdf24b` | Jorel Ali | Fix villager type/profession registries not being initialized properly |
| 2022-05-30 | `fbe06fb` | Jorel Ali | 1.18.2 support. |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-06-11 | `f48d3a2` | Mirco Kroon | Store entities separately in 1.17 |
| 2021-06-09 | `dd9d538` | Mirco Kroon | Fixed handling of lighting and network encoding for 1.17 |
| 2021-06-07 | `b753aec` | Mirco Kroon | Added support for 1.17 |
| 2021-03-10 | `4df3069` | Mirco Kroon | Prompt for deleting chunks, option to prune images |
| 2021-03-10 | `8960f88` | Mirco Kroon | Fixed missing lighting on some chunks, performance optimisations |
| 2021-03-09 | `c7577e3` | Mirco Kroon | Send lighting information for 1.14 and 1.15 |
| 2021-03-09 | `0d14419` | Mirco Kroon | Render extended chunks center-first |
| 2021-03-09 | `8cf1f9d` | Mirco Kroon | Send lighting data for chunks |
| 2021-02-26 | `8d5e9ab` | Mirco Kroon | Send messages for missing chunks/blocks when saving inventory |
| 2021-02-26 | `fbe3bea` | Mirco Kroon | Fixed incorrect coordinate parsing, create missing tile entities |
| 2021-02-26 | `3b4391c` | Mirco Kroon | Fixed zooming issues on minimap |
| 2021-02-25 | `f69e52a` | Mirco Kroon | Improved GUI performance, added panning |
| 2021-02-24 | `93c6ccb` | Mirco Kroon | Added multi-block changes, fixed some bugs |
| 2021-02-24 | `2ae4a65` | Mirco Kroon | Single block changes for 1.12 |
| 2021-02-24 | `06f2479` | Mirco Kroon | Handle single-block updates for 1.13+ |
| 2021-02-21 | `572cfd7` | Mirco Kroon | Move entity and map parsing to own threads |
| 2021-02-20 | `b247243` | Mirco Kroon | Saving of map item contents |
| 2021-02-19 | `ca61619` | Mirco Kroon | Improved handling of entity data |
| 2021-02-17 | `b22a9f4` | Mirco Kroon | Fixed concurrency issues |
| 2021-02-16 | `bc80a7f` | Mirco Kroon | Improved handling of paths and working directories |
| 2021-02-15 | `242b6ec` | Mirco Kroon | Replace mkdirs with CreateDirectories |
| 2021-02-14 | `50416dc` | Mirco Kroon | Fixed world offset, added debug writing of chunks |
| 2021-02-13 | `3c328ac` | Mirco Kroon | Fixed file output rendering |
| 2021-02-13 | `1aba4e1` | Mirco Kroon | Added settings UI |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-08 | `1a2ba1c` | Mirco Kroon | Ignore unrealistically large render distances when measuring |
| 2021-02-08 | `8a0158c` | Mirco Kroon | Added option to override server reported render distance |
| 2021-02-08 | `31850eb` | Mirco Kroon | Prevent crashes on invalid entities |
| 2021-02-07 | `9f26707` | Mirco Kroon | Added comments, removed unused code |
| 2021-02-06 | `4a76c82` | Mirco Kroon | Chunk extending for 1.14 |
| 2021-02-06 | `59ab9a5` | Mirco Kroon | Removed some prints |
| 2021-02-06 | `7136837` | Mirco Kroon | Invalidate extended chunks on dimension change |
| 2021-02-05 | `58ccb5c` | Mirco Kroon | Render-distance extending for 1.12.2 |
| 2021-02-04 | `92959a7` | Mirco Kroon | Measure render distance on versions < 1.14 |
| 2021-02-04 | `7f931b2` | Mirco Kroon | Complete render-distance extending for 1.16 |
| 2021-02-04 | `f8c3f25` | Mirco Kroon | Show player facing direction in GUI |
| 2021-02-04 | `f2c4d75` | Mirco Kroon | Computed which chunks to send to the client for chunk extending |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2021-01-31 | `662ac7d` | Mirco Kroon | Added support for custom dimensions |
| 2021-01-30 | `e8501ba` | Mirco Kroon | Allow multiple global palettes for drawing previous chunks |
| 2021-01-30 | `4b77da2` | Mirco Kroon | Replace loop with scheduled executor |
| 2020-10-15 | `722be2e` | Mirco Kroon | Inventory saving & dimension handling for 1.12.2 |
| 2020-10-15 | `207a9cc` | Mirco Kroon | Fixed inventories not being saved when loaded after chunk saving |
| 2020-10-08 | `75c7a84` | Mirco Kroon | Added options to pause chunk saving, delete old chunks, save & exit |
| 2020-10-08 | `6aa4a86` | Mirco Kroon | Use latest version of jo-nbt |
| 2020-08-28 | `ef11808` | Mirco Kroon | Single-chest item saving |
| 2020-08-28 | `15d5dbc` | Mirco Kroon | Merge branch 'chest-saving' into dimension_handling_1_16 |
| 2020-08-28 | `cd7ad6c` | Mirco Kroon | Improved dimension handling |
| 2020-08-27 | `41ce9b5` | Mirco Kroon | Keep chunks from different dimensions separated |
| 2020-07-08 | `ae9eda5` | Mirco Kroon | Ignore existing level.dat files to prevent memory leaks |
| 2020-06-29 | `756833b` | Mirco Kroon | Added option to set the world type to a superflat void |
| 2020-05-22 | `63748a2` | Mirco Kroon | Automatically generate reports files |
| 2020-04-11 | `a3d8d6e` | Mirco Kroon | Initial code for container saving |
| 2019-12-14 | `7cbba15` | Unknown | Numerous improvements & bug fixes to GUI |
| 2019-12-12 | `43d1605` | Unknown | Added exporting of image and loading of all chunks |
| 2019-12-12 | `e6191d9` | Unknown | Added support for basic entities, added proper 1.14.4 support |
| 2019-12-11 | `b40288f` | Unknown | Fixed minimap issues, made minimap work on 1.13/1.14 |
| 2019-12-09 | `446c370` | Unknown | clean up |
| 2019-12-09 | `a1bad99` | Unknown | Made chunk writing optional, improved GUI |
| 2019-12-06 | `50866d2` | Unknown | Improved performance of GUI and fixed chunk parsing for other dimensions |
| 2019-12-04 | `424ee70` | Unknown | Added adjustable render distance |
| 2019-12-03 | `9a968ed` | Unknown | Added new chunk marking |
| 2019-12-03 | `cac1575` | Unknown | Added GUI minimap for 1.12.2 (missing files) |
| 2019-05-19 | `8ac7b01` | Unknown | added support for signs sent after chunk generation |
| 2019-05-19 | `bbab134` | Unknown | implemented most of 1.14 world handling |
| 2019-05-19 | `f772ec7` | Unknown | transitioned to different nbt library, completed 1.13 world handling |
| 2019-05-18 | `5a97219` | Unknown | nearly implemented chunk parsing & writing for 1.13 |
| 2019-05-15 | `9229c39` | Unknown | fixed save thread blocking the proxy thread |
| 2019-05-15 | `1e0df96` | Unknown | added null check for regions that don't exist |
| 2019-05-13 | `f5853d3` | Unknown | performance: handle Unload Chunk packets |
| 2019-05-13 | `d70a48b` | Unknown | performance: deleted BlockState class & reduced delete distance |
| 2019-05-13 | `616694e` | Unknown | added automatic level.dat writing |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-12 | `21d5d8b` | Unknown | added displaying of existing chunks |
| 2019-05-12 | `acc6507` | Unknown | added coordinate offset, bedrock masking, player position, chunk removal |
| 2019-05-12 | `27e0b69` | Unknown | added chunk unloading when out of range |
| 2019-05-11 | `9159209` | Unknown | fixed chunk loading from blocking the network thread |
| 2019-05-11 | `c83ac04` | Unknown | successful block storage (lighting issues remain) |

← file-history index
