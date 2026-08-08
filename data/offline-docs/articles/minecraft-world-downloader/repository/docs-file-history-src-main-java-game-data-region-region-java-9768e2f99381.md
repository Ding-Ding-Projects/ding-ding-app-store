# `src/main/java/game/data/region/Region.java`

**Java** · 205 lines · 6,773 bytes · 39 commit(s) · first 2019-05-11 · last 2023-03-12

## Purpose

_No leading comment/docstring found — see the file and its history below._

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2023-03-12 | `ac0493a` | Mirco Kroon | Fixed a few issues with unloading chunks or not loading them correctly |
| 2023-03-08 | `19e0835` | Mirco Kroon | Fixed memory leaks and performance issues |
| 2023-03-07 | `ce3e1e7` | Mirco Kroon | Added back unsaved chunk overlay |
| 2023-03-06 | `547bd1d` | Mirco Kroon | Changed GUI map to use region images instead of chunk images |
| 2021-06-29 | `ced1ca4` | Mirco Kroon | Prevent concurrent modification of chunks to be deleted |
| 2021-06-11 | `f48d3a2` | Mirco Kroon | Store entities separately in 1.17 |
| 2021-03-10 | `4df3069` | Mirco Kroon | Prompt for deleting chunks, option to prune images |
| 2021-03-10 | `8960f88` | Mirco Kroon | Fixed missing lighting on some chunks, performance optimisations |
| 2021-03-09 | `c7577e3` | Mirco Kroon | Send lighting information for 1.14 and 1.15 |
| 2021-03-09 | `8cf1f9d` | Mirco Kroon | Send lighting data for chunks |
| 2021-02-24 | `93c6ccb` | Mirco Kroon | Added multi-block changes, fixed some bugs |
| 2021-02-24 | `06f2479` | Mirco Kroon | Handle single-block updates for 1.13+ |
| 2021-02-21 | `405a5f5` | Mirco Kroon | Small fixes, added stats debug option |
| 2021-02-19 | `ca61619` | Mirco Kroon | Improved handling of entity data |
| 2021-02-17 | `b22a9f4` | Mirco Kroon | Fixed concurrency issues |
| 2021-02-15 | `ea5fff5` | Mirco Kroon | Slider for extended render distance |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-04 | `f2c4d75` | Mirco Kroon | Computed which chunks to send to the client for chunk extending |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2020-12-13 | `251f708` | Mirco Kroon | Added optional setting to mark unsaved chunks in red in the GUI |
| 2020-10-15 | `207a9cc` | Mirco Kroon | Fixed inventories not being saved when loaded after chunk saving |
| 2020-08-28 | `7503fed` | Mirco Kroon | Support for double chests |
| 2020-08-28 | `cd7ad6c` | Mirco Kroon | Improved dimension handling |
| 2020-08-27 | `41ce9b5` | Mirco Kroon | Keep chunks from different dimensions separated |
| 2019-12-12 | `e6191d9` | Unknown | Added support for basic entities, added proper 1.14.4 support |
| 2019-12-03 | `9a968ed` | Unknown | Added new chunk marking |
| 2019-05-20 | `56e214e` | Unknown | fixed handling of tile entities received before a chunk has been parsed |
| 2019-05-15 | `9229c39` | Unknown | fixed save thread blocking the proxy thread |
| 2019-05-13 | `f5853d3` | Unknown | performance: handle Unload Chunk packets |
| 2019-05-13 | `d70a48b` | Unknown | performance: deleted BlockState class & reduced delete distance |
| 2019-05-12 | `d406b74` | Unknown | properly prevented saving of empty chunks |
| 2019-05-12 | `d1c03fc` | Unknown | Prevent empty chunks from overwriting full ones |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-12 | `ba7936e` | Unknown | fixed player position |
| 2019-05-12 | `acc6507` | Unknown | added coordinate offset, bedrock masking, player position, chunk removal |
| 2019-05-12 | `27e0b69` | Unknown | added chunk unloading when out of range |
| 2019-05-12 | `57c4feb` | Unknown | added GUI to show saved/loaded chunks |
| 2019-05-11 | `a82d607` | Unknown | fixed incorrect region being selected |
| 2019-05-11 | `c83ac04` | Unknown | successful block storage (lighting issues remain) |

← file-history index
