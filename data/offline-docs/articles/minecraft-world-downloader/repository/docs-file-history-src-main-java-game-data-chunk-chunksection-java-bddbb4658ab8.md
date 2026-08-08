# `src/main/java/game/data/chunk/ChunkSection.java`

**Java** · 222 lines · 6,374 bytes · 35 commit(s) · first 2019-05-11 · last 2024-05-17

## Purpose

_No leading comment/docstring found — see the file and its history below._

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2023-03-13 | `127747e` | Mirco Kroon | Fixed lighting issues |
| 2023-03-09 | `b8f05f8` | Mirco Kroon | Make chunk data versions independent of class version |
| 2023-03-06 | `38c8a5a` | Mirco Kroon | Correctly pass parent chunk to all sections |
| 2023-03-05 | `4a80dbf` | Mirco Kroon | Fixed loading old chunks not working correctly since 1.18 |
| 2022-06-01 | `3699df7` | Mirco Kroon | Fixed index OOB for multi-block changes on some servers |
| 2022-05-31 | `0c37300` | Jorel Ali | Update chunks when blockentities or blocks are updated |
| 2022-05-30 | `fbe06fb` | Jorel Ali | 1.18.2 support. |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-06-29 | `97e1492` | Mirco Kroon | Correctly save sections with a large number of different blocks |
| 2021-03-10 | `8960f88` | Mirco Kroon | Fixed missing lighting on some chunks, performance optimisations |
| 2021-03-09 | `8cf1f9d` | Mirco Kroon | Send lighting data for chunks |
| 2021-02-24 | `93c6ccb` | Mirco Kroon | Added multi-block changes, fixed some bugs |
| 2021-02-24 | `06f2479` | Mirco Kroon | Handle single-block updates for 1.13+ |
| 2021-02-17 | `797d3a9` | Mirco Kroon | Improved overview rendering, reduced contents of Chunk class |
| 2021-02-06 | `0c08b78` | Mirco Kroon | Chunk extending for 1.13 |
| 2021-02-05 | `58ccb5c` | Mirco Kroon | Render-distance extending for 1.12.2 |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-01-30 | `e8501ba` | Mirco Kroon | Allow multiple global palettes for drawing previous chunks |
| 2020-06-27 | `20ba5ce` | Mirco Kroon | Added 1.16 support |
| 2020-03-04 | `f18a1cc` | Unknown | Improved support for never versions |
| 2019-12-14 | `7cbba15` | Unknown | Numerous improvements & bug fixes to GUI |
| 2019-12-12 | `43d1605` | Unknown | Added exporting of image and loading of all chunks |
| 2019-12-12 | `e6191d9` | Unknown | Added support for basic entities, added proper 1.14.4 support |
| 2019-12-11 | `b40288f` | Unknown | Fixed minimap issues, made minimap work on 1.13/1.14 |
| 2019-12-03 | `cac1575` | Unknown | Added GUI minimap for 1.12.2 (missing files) |
| 2019-05-19 | `ea79930` | Unknown | documentation for new classes |
| 2019-05-19 | `f772ec7` | Unknown | transitioned to different nbt library, completed 1.13 world handling |
| 2019-05-18 | `5a97219` | Unknown | nearly implemented chunk parsing & writing for 1.13 |
| 2019-05-15 | `09af008` | Unknown | changed section Y to byte |
| 2019-05-13 | `d70a48b` | Unknown | performance: deleted BlockState class & reduced delete distance |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-11 | `42effc1` | Unknown | fixed chunk data being incorrectly saved |
| 2019-05-11 | `9ac8264` | Unknown | fixed lighting issues |
| 2019-05-11 | `c83ac04` | Unknown | successful block storage (lighting issues remain) |

← file-history index
