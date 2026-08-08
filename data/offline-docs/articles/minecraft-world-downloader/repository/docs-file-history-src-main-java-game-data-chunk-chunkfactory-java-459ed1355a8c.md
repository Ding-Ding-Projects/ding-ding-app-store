# `src/main/java/game/data/chunk/ChunkFactory.java`

**Java** · 329 lines · 11,739 bytes · 61 commit(s) · first 2019-05-11 · last 2026-06-03

## Purpose

same as newSingleThreadExecutor except we can observe the queue size

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-03 | `3f38ec4` | cafepromenade | Don't "unsave" container inventories when a chunk is revisited |
| 2026-06-01 | `cd0b105` | cafepromenade | Add protocol entries for 1.21.2-1.21.11 point releases |
| 2026-06-01 | `9290a94` | cafepromenade | Add support for Minecraft 1.8-1.11 |
| 2026-05-31 | `64da528` | cafepromenade | Add support for Minecraft 26.1 (protocol 775) |
| 2026-05-08 | `dd3a9e0` | cafepromenade | Enhance GitHub Actions & add release/report files |
| 2023-06-19 | `d7da042` | Mirco Kroon | Handle trust edges parameter being removed in 1.20 |
| 2023-03-09 | `9abb16b` | Mirco Kroon | Reduced complexity of updating to new versions |
| 2023-03-09 | `b8f05f8` | Mirco Kroon | Make chunk data versions independent of class version |
| 2023-03-08 | `19e0835` | Mirco Kroon | Fixed memory leaks and performance issues |
| 2023-02-26 | `e9390a5` | Logan Bell | Add support for 1.19.3 |
| 2022-06-14 | `a0aba8b` | Mirco Kroon | Blocks & entities for 1.19 |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-06-07 | `b753aec` | Mirco Kroon | Added support for 1.17 |
| 2021-03-10 | `ca32db4` | Mirco Kroon | Comments |
| 2021-03-10 | `8960f88` | Mirco Kroon | Fixed missing lighting on some chunks, performance optimisations |
| 2021-03-09 | `8cf1f9d` | Mirco Kroon | Send lighting data for chunks |
| 2021-02-24 | `06f2479` | Mirco Kroon | Handle single-block updates for 1.13+ |
| 2021-02-21 | `572cfd7` | Mirco Kroon | Move entity and map parsing to own threads |
| 2021-02-20 | `19a39bc` | Mirco Kroon | Entities & maps for other versions |
| 2021-02-20 | `7b3fd19` | Mirco Kroon | Improved structure of version handling code |
| 2021-02-19 | `ca61619` | Mirco Kroon | Improved handling of entity data |
| 2021-02-17 | `b22a9f4` | Mirco Kroon | Fixed concurrency issues |
| 2021-02-14 | `50416dc` | Mirco Kroon | Fixed world offset, added debug writing of chunks |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-08 | `31850eb` | Mirco Kroon | Prevent crashes on invalid entities |
| 2021-02-07 | `c65d4d3` | Mirco Kroon | Removed support for 1.16.0 and 1.16.1 |
| 2021-02-06 | `7136837` | Mirco Kroon | Invalidate extended chunks on dimension change |
| 2021-02-04 | `7f931b2` | Mirco Kroon | Complete render-distance extending for 1.16 |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2021-01-31 | `662ac7d` | Mirco Kroon | Added support for custom dimensions |
| 2021-01-30 | `e8501ba` | Mirco Kroon | Allow multiple global palettes for drawing previous chunks |
| 2020-10-08 | `75c7a84` | Mirco Kroon | Added options to pause chunk saving, delete old chunks, save & exit |
| 2020-08-28 | `7503fed` | Mirco Kroon | Support for double chests |
| 2020-08-28 | `cd7ad6c` | Mirco Kroon | Improved dimension handling |
| 2020-08-27 | `41ce9b5` | Mirco Kroon | Keep chunks from different dimensions separated |
| 2020-08-25 | `9a809fc` | Mirco Kroon | Added support for Minecraft 1.16.2 |
| 2020-06-27 | `20ba5ce` | Mirco Kroon | Added 1.16 support |
| 2020-06-26 | `f17b9c6` | Mirco Kroon | Fixed some issues with report generating, added caching |
| 2020-05-22 | `63748a2` | Mirco Kroon | Automatically generate reports files |
| 2020-04-01 | `13337ef` | Unknown | Removed JavaFX dependency |
| 2020-03-04 | `14d8062` | Unknown | Prevent re-saving of GUI-loaded chunks |
| 2020-03-04 | `f18a1cc` | Unknown | Improved support for never versions |
| 2019-12-12 | `43d1605` | Unknown | Added exporting of image and loading of all chunks |
| 2019-12-12 | `e6191d9` | Unknown | Added support for basic entities, added proper 1.14.4 support |
| 2019-12-03 | `9a968ed` | Unknown | Added new chunk marking |
| 2019-12-03 | `cac1575` | Unknown | Added GUI minimap for 1.12.2 (missing files) |
| 2019-05-25 | `ff20d89` | Unknown | made Coordinate3D extend Coordinate2D |
| 2019-05-20 | `56e214e` | Unknown | fixed handling of tile entities received before a chunk has been parsed |
| 2019-05-19 | `ea79930` | Unknown | documentation for new classes |
| 2019-05-19 | `8ac7b01` | Unknown | added support for signs sent after chunk generation |
| 2019-05-19 | `bbab134` | Unknown | implemented most of 1.14 world handling |
| 2019-05-19 | `f772ec7` | Unknown | transitioned to different nbt library, completed 1.13 world handling |
| 2019-05-18 | `5a97219` | Unknown | nearly implemented chunk parsing & writing for 1.13 |
| 2019-05-15 | `9229c39` | Unknown | fixed save thread blocking the proxy thread |
| 2019-05-13 | `cce0311` | Unknown | changed parser to use wait/notify |
| 2019-05-13 | `f5853d3` | Unknown | performance: handle Unload Chunk packets |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-12 | `acc6507` | Unknown | added coordinate offset, bedrock masking, player position, chunk removal |
| 2019-05-12 | `27e0b69` | Unknown | added chunk unloading when out of range |
| 2019-05-11 | `9159209` | Unknown | fixed chunk loading from blocking the network thread |

← file-history index
