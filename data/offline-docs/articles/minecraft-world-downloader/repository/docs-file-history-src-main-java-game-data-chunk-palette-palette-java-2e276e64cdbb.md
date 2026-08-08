# `src/main/java/game/data/chunk/palette/Palette.java`

**Java** · 268 lines · 8,239 bytes · 27 commit(s) · first 2019-12-12 · last 2024-05-17

## Purpose

Class to hold a palette of a chunk.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2023-03-13 | `f3f7ec4` | Mirco Kroon | Fixed palette conversion issue |
| 2023-03-11 | `8759183` | Mirco Kroon | Updated renderDistanceExtender to use circles |
| 2023-03-10 | `fbed308` | Mirco Kroon | Write chunks to packet for 1.18 and 1.19 |
| 2023-03-06 | `547bd1d` | Mirco Kroon | Changed GUI map to use region images instead of chunk images |
| 2022-06-16 | `f5ea0a4` | Mirco Kroon | Get biome IDs from server login instead of json file |
| 2022-06-07 | `9dab0be` | Mirco Kroon | Fixed issue with palette conversion |
| 2022-06-06 | `98ddc55` | Mirco Kroon | Convert direct palettes to proper palettes when saving |
| 2022-06-05 | `1a65536` | Mirco Kroon | Fixed two issues with chunk parsing |
| 2022-06-01 | `3699df7` | Mirco Kroon | Fixed index OOB for multi-block changes on some servers |
| 2022-06-01 | `05727f1` | Mirco Kroon | Formatting etc |
| 2022-06-01 | `c08adec` | Mirco Kroon | Moved registries out of WorldManager |
| 2022-05-30 | `fbe06fb` | Jorel Ali | 1.18.2 support. |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-06-29 | `97e1492` | Mirco Kroon | Correctly save sections with a large number of different blocks |
| 2021-02-24 | `06f2479` | Mirco Kroon | Handle single-block updates for 1.13+ |
| 2021-02-05 | `58ccb5c` | Mirco Kroon | Render-distance extending for 1.12.2 |
| 2021-02-04 | `7f931b2` | Mirco Kroon | Complete render-distance extending for 1.16 |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-01-30 | `e8501ba` | Mirco Kroon | Allow multiple global palettes for drawing previous chunks |
| 2020-08-25 | `9a809fc` | Mirco Kroon | Added support for Minecraft 1.16.2 |
| 2020-06-27 | `20ba5ce` | Mirco Kroon | Added 1.16 support |
| 2020-03-06 | `1e11862` | Unknown | Prevent crash on unknown block states |
| 2020-03-04 | `4a58f72` | Unknown | Fixed issue with too large palettes on some servers |
| 2020-03-04 | `f18a1cc` | Unknown | Improved support for never versions |
| 2019-12-14 | `7cbba15` | Unknown | Numerous improvements & bug fixes to GUI |
| 2019-12-12 | `43d1605` | Unknown | Added exporting of image and loading of all chunks |

← file-history index
