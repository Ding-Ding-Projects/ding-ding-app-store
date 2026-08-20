# `src/main/java/game/data/chunk/Chunk.java`

**Java** · 571 lines · 17,790 bytes · 85 commit(s) · first 2019-05-11 · last 2026-06-01

## Purpose

_No leading comment/docstring found — see the file and its history below._

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-01 | `9290a94` | cafepromenade | Add support for Minecraft 1.8-1.11 |
| 2026-05-29 | `d198e74` | cafepromenade | Make ChunkHeightHandler init thread-safe to prevent NPE under parser pool |
| 2026-05-29 | `83a3a60` | cafepromenade | Fix NPE in Chunk_1_16.updateBlocks - lazily init chunkHeightHandler |
| 2023-11-01 | `62a05b9` | steve6472 | Small cleanup, Fix incorrect chunk selection |
| 2023-08-21 | `7139106` | Mirco Kroon | Added switching between rendering modes |
| 2023-03-18 | `38d60f2` | Mirco Kroon | Handle Forge plugin protocol (for 1.12.2) |
| 2023-03-13 | `127747e` | Mirco Kroon | Fixed lighting issues |
| 2023-03-13 | `c27018a` | Mirco Kroon | Adjusted render distance extending circles |
| 2023-03-09 | `9abb16b` | Mirco Kroon | Reduced complexity of updating to new versions |
| 2023-03-09 | `b8f05f8` | Mirco Kroon | Make chunk data versions independent of class version |
| 2023-03-08 | `19e0835` | Mirco Kroon | Fixed memory leaks and performance issues |
| 2023-03-07 | `ce3e1e7` | Mirco Kroon | Added back unsaved chunk overlay |
| 2022-06-05 | `1a65536` | Mirco Kroon | Fixed two issues with chunk parsing |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-09-15 | `ab20ae7` | Mirco Kroon | Don't complain when changing a block outside of the world height |
| 2021-06-29 | `97e1492` | Mirco Kroon | Correctly save sections with a large number of different blocks |
| 2021-06-11 | `fd4b6c1` | Mirco Kroon | Fixed issues with invalid chunks in earlier versions |
| 2021-06-11 | `f48d3a2` | Mirco Kroon | Store entities separately in 1.17 |
| 2021-06-09 | `dd9d538` | Mirco Kroon | Fixed handling of lighting and network encoding for 1.17 |
| 2021-06-07 | `b753aec` | Mirco Kroon | Added support for 1.17 |
| 2021-05-29 | `d510cb0` | Mirco Kroon | Rename packets to official mapping names |
| 2021-03-10 | `8960f88` | Mirco Kroon | Fixed missing lighting on some chunks, performance optimisations |
| 2021-03-09 | `4e43635` | Mirco Kroon | Fixed some index-out-of-bounds issues |
| 2021-03-09 | `8cf1f9d` | Mirco Kroon | Send lighting data for chunks |
| 2021-02-24 | `93c6ccb` | Mirco Kroon | Added multi-block changes, fixed some bugs |
| 2021-02-24 | `06f2479` | Mirco Kroon | Handle single-block updates for 1.13+ |
| 2021-02-20 | `7b3fd19` | Mirco Kroon | Improved structure of version handling code |
| 2021-02-19 | `ca61619` | Mirco Kroon | Improved handling of entity data |
| 2021-02-18 | `47cc5d5` | Mirco Kroon | Improved handling of adjacent image chunks |
| 2021-02-17 | `797d3a9` | Mirco Kroon | Improved overview rendering, reduced contents of Chunk class |
| 2021-02-15 | `242b6ec` | Mirco Kroon | Replace mkdirs with CreateDirectories |
| 2021-02-15 | `a561d49` | Mirco Kroon | Added some comments |
| 2021-02-14 | `50416dc` | Mirco Kroon | Fixed world offset, added debug writing of chunks |
| 2021-02-13 | `3c328ac` | Mirco Kroon | Fixed file output rendering |
| 2021-02-13 | `858a0de` | Mirco Kroon | Fixed overview rendering |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-08 | `fa35486` | Mirco Kroon | Cleaned up prints |
| 2021-02-08 | `31850eb` | Mirco Kroon | Prevent crashes on invalid entities |
| 2021-02-07 | `9f26707` | Mirco Kroon | Added comments, removed unused code |
| 2021-02-07 | `c65d4d3` | Mirco Kroon | Removed support for 1.16.0 and 1.16.1 |
| 2021-02-06 | `4a76c82` | Mirco Kroon | Chunk extending for 1.14 |
| 2021-02-06 | `7136837` | Mirco Kroon | Invalidate extended chunks on dimension change |
| 2021-02-05 | `58ccb5c` | Mirco Kroon | Render-distance extending for 1.12.2 |
| 2021-02-04 | `7f931b2` | Mirco Kroon | Complete render-distance extending for 1.16 |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2021-01-31 | `662ac7d` | Mirco Kroon | Added support for custom dimensions |
| 2021-01-30 | `e8501ba` | Mirco Kroon | Allow multiple global palettes for drawing previous chunks |
| 2021-01-30 | `307aa62` | Mirco Kroon | Prevent sampling of negative coordinates for water transperency |
| 2020-10-16 | `549800e` | Mirco Kroon | New tile entities check for previously acquired inventory data |
| 2020-10-15 | `207a9cc` | Mirco Kroon | Fixed inventories not being saved when loaded after chunk saving |
| 2020-08-28 | `7503fed` | Mirco Kroon | Support for double chests |
| 2020-08-28 | `ef11808` | Mirco Kroon | Single-chest item saving |
| 2020-08-28 | `e3add3f` | Mirco Kroon | Made minimap rendering in the nether actually useful |
| 2020-08-28 | `cd7ad6c` | Mirco Kroon | Improved dimension handling |
| 2020-08-27 | `41ce9b5` | Mirco Kroon | Keep chunks from different dimensions separated |
| 2020-06-27 | `20ba5ce` | Mirco Kroon | Added 1.16 support |
| 2020-03-04 | `f18a1cc` | Unknown | Improved support for never versions |
| 2019-12-14 | `7cbba15` | Unknown | Numerous improvements & bug fixes to GUI |
| 2019-12-12 | `43d1605` | Unknown | Added exporting of image and loading of all chunks |
| 2019-12-12 | `e6191d9` | Unknown | Added support for basic entities, added proper 1.14.4 support |
| 2019-12-11 | `b40288f` | Unknown | Fixed minimap issues, made minimap work on 1.13/1.14 |
| 2019-12-04 | `424ee70` | Unknown | Added adjustable render distance |
| 2019-12-03 | `9a968ed` | Unknown | Added new chunk marking |
| 2019-12-03 | `cac1575` | Unknown | Added GUI minimap for 1.12.2 (missing files) |
| 2019-05-25 | `ff20d89` | Unknown | made Coordinate3D extend Coordinate2D |
| 2019-05-19 | `ea79930` | Unknown | documentation for new classes |
| 2019-05-19 | `8ac7b01` | Unknown | added support for signs sent after chunk generation |
| 2019-05-19 | `fea52bd` | Unknown | removed print |
| 2019-05-19 | `22c2149` | Unknown | fixed offset issues |
| 2019-05-19 | `bbab134` | Unknown | implemented most of 1.14 world handling |
| 2019-05-19 | `f772ec7` | Unknown | transitioned to different nbt library, completed 1.13 world handling |
| 2019-05-18 | `5a97219` | Unknown | nearly implemented chunk parsing & writing for 1.13 |
| 2019-05-15 | `00a5ea5` | Unknown | fixed small issues with saved chunks |
| 2019-05-15 | `09af008` | Unknown | changed section Y to byte |
| 2019-05-13 | `f5853d3` | Unknown | performance: handle Unload Chunk packets |
| 2019-05-13 | `d70a48b` | Unknown | performance: deleted BlockState class & reduced delete distance |
| 2019-05-12 | `d406b74` | Unknown | properly prevented saving of empty chunks |
| 2019-05-12 | `d1c03fc` | Unknown | Prevent empty chunks from overwriting full ones |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-12 | `27e0b69` | Unknown | added chunk unloading when out of range |
| 2019-05-12 | `087ca98` | Unknown | masked host in handshake package to prevent nosy servers from kicking |
| 2019-05-11 | `9159209` | Unknown | fixed chunk loading from blocking the network thread |
| 2019-05-11 | `9ac8264` | Unknown | fixed lighting issues |
| 2019-05-11 | `c83ac04` | Unknown | successful block storage (lighting issues remain) |

← file-history index
