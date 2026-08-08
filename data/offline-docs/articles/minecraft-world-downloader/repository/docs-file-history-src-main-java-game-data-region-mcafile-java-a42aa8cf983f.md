# `src/main/java/game/data/region/McaFile.java`

**Java** · 403 lines · 14,889 bytes · 35 commit(s) · first 2019-05-11 · last 2026-05-08

## Purpose

_No leading comment/docstring found — see the file and its history below._

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-05-08 | `a843d38` | cafepromenade | CI upgrade, add Dockerfile, use InputStream |
| 2026-05-07 | `e85f166` | cafepromenade | Fix unclosed streams causing memory/resource leaks |
| 2023-03-08 | `19e0835` | Mirco Kroon | Fixed memory leaks and performance issues |
| 2023-03-06 | `22de1b6` | Mirco Kroon | Caching of overview images |
| 2021-06-11 | `f48d3a2` | Mirco Kroon | Store entities separately in 1.17 |
| 2021-04-08 | `8df8cc9` | Mirco Kroon | Fix issue with adding chunks to empty regions |
| 2021-03-10 | `8960f88` | Mirco Kroon | Fixed missing lighting on some chunks, performance optimisations |
| 2021-03-09 | `0eca71e` | Mirco Kroon | Fixed last chunk in region being skipped |
| 2021-03-09 | `cf8c12c` | Mirco Kroon | Fix issue with loading Mca files |
| 2021-03-09 | `c7577e3` | Mirco Kroon | Send lighting information for 1.14 and 1.15 |
| 2021-03-09 | `8cf1f9d` | Mirco Kroon | Send lighting data for chunks |
| 2021-02-26 | `3b4391c` | Mirco Kroon | Fixed zooming issues on minimap |
| 2021-02-25 | `f69e52a` | Mirco Kroon | Improved GUI performance, added panning |
| 2021-02-20 | `4e7ad5b` | Mirco Kroon | Correct armorstand handling for 1.16 |
| 2021-02-19 | `ca61619` | Mirco Kroon | Improved handling of entity data |
| 2021-02-17 | `b22a9f4` | Mirco Kroon | Fixed concurrency issues |
| 2021-02-16 | `bc80a7f` | Mirco Kroon | Improved handling of paths and working directories |
| 2021-02-15 | `242b6ec` | Mirco Kroon | Replace mkdirs with CreateDirectories |
| 2021-02-14 | `50416dc` | Mirco Kroon | Fixed world offset, added debug writing of chunks |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-08 | `cdc4d5d` | Mirco Kroon | Prevent issues with MCA files that are being saved |
| 2021-02-04 | `f2c4d75` | Mirco Kroon | Computed which chunks to send to the client for chunk extending |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2021-01-31 | `662ac7d` | Mirco Kroon | Added support for custom dimensions |
| 2020-10-08 | `75c7a84` | Mirco Kroon | Added options to pause chunk saving, delete old chunks, save & exit |
| 2020-08-28 | `cd7ad6c` | Mirco Kroon | Improved dimension handling |
| 2020-08-27 | `41ce9b5` | Mirco Kroon | Keep chunks from different dimensions separated |
| 2019-12-12 | `43d1605` | Unknown | Added exporting of image and loading of all chunks |
| 2019-12-06 | `50866d2` | Unknown | Improved performance of GUI and fixed chunk parsing for other dimensions |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-12 | `21d5d8b` | Unknown | added displaying of existing chunks |
| 2019-05-12 | `bb2ab0b` | Unknown | added reading & merging of region files |
| 2019-05-12 | `c057c7b` | Unknown | implemented argument parsing |
| 2019-05-11 | `c83ac04` | Unknown | successful block storage (lighting issues remain) |

← file-history index
