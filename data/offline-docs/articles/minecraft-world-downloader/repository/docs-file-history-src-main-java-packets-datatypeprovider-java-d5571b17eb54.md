# `src/main/java/packets/DataTypeProvider.java`

**Java** · 360 lines · 10,969 bytes · 42 commit(s) · first 2019-05-10 · last 2026-06-07

## Purpose

_No leading comment/docstring found — see the file and its history below._

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `e5ebe84` | cafepromenade | Fix UTF-8 string decoding and VarLong overflow in DataTypeProvider |
| 2026-06-03 | `b633907` | cafepromenade | Read 1.20.6+ item data components so containers save again |
| 2024-06-29 | `220d8fc` | Mirco Kroon | Support for most of 1.21 |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2023-11-24 | `4a5c14c` | nnnlog | Update for 1.20.2 |
| 2023-03-10 | `fbed308` | Mirco Kroon | Write chunks to packet for 1.18 and 1.19 |
| 2022-06-06 | `86ed426` | Mirco Kroon | Discard additional data sent by some servers for biomes |
| 2022-05-30 | `fa9a9b2` | Jorel Ali | Fixed cat owner UUIDs and Set.of() bug |
| 2021-06-09 | `dd9d538` | Mirco Kroon | Fixed handling of lighting and network encoding for 1.17 |
| 2021-06-07 | `b753aec` | Mirco Kroon | Added support for 1.17 |
| 2021-03-09 | `8cf1f9d` | Mirco Kroon | Send lighting data for chunks |
| 2021-02-24 | `93c6ccb` | Mirco Kroon | Added multi-block changes, fixed some bugs |
| 2021-02-23 | `c4a41b7` | Mirco Kroon | Added option to render players to the minimap |
| 2021-02-20 | `7b3fd19` | Mirco Kroon | Improved structure of version handling code |
| 2021-02-20 | `5d9f688` | Mirco Kroon | Handle armorstands in 1.16 |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-09 | `d3a073b` | Mirco Kroon | Fixed buffer flip issue on java 8 |
| 2021-02-05 | `58ccb5c` | Mirco Kroon | Render-distance extending for 1.12.2 |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2021-02-01 | `f7b4e8b` | Mirco Kroon | Added tests for packet building/parsing |
| 2020-10-15 | `6e0a9ab` | Mirco Kroon | Fixed issues with version 1.13.2 |
| 2020-10-15 | `722be2e` | Mirco Kroon | Inventory saving & dimension handling for 1.12.2 |
| 2020-08-28 | `15d5dbc` | Mirco Kroon | Merge branch 'chest-saving' into dimension_handling_1_16 |
| 2020-06-27 | `20ba5ce` | Mirco Kroon | Added 1.16 support |
| 2020-05-22 | `63748a2` | Mirco Kroon | Automatically generate reports files |
| 2020-04-11 | `a3d8d6e` | Mirco Kroon | Initial code for container saving |
| 2020-03-04 | `f18a1cc` | Unknown | Improved support for never versions |
| 2019-12-14 | `7cbba15` | Unknown | Numerous improvements & bug fixes to GUI |
| 2019-12-12 | `6bdbd2a` | Unknown | Fixed coordinate parsing |
| 2019-12-12 | `e6191d9` | Unknown | Added support for basic entities, added proper 1.14.4 support |
| 2019-12-09 | `446c370` | Unknown | clean up |
| 2019-12-09 | `991bcec` | Unknown | added position reader |
| 2019-05-19 | `8ac7b01` | Unknown | added support for signs sent after chunk generation |
| 2019-05-19 | `bbab134` | Unknown | implemented most of 1.14 world handling |
| 2019-05-19 | `f772ec7` | Unknown | transitioned to different nbt library, completed 1.13 world handling |
| 2019-05-18 | `5a97219` | Unknown | nearly implemented chunk parsing & writing for 1.13 |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-12 | `c057c7b` | Unknown | implemented argument parsing |
| 2019-05-11 | `da03eb5` | Unknown | added tile entity parsing |
| 2019-05-11 | `3655d0c` | Unknown | implemented chunk parsing (for 4-bit palettes only) |
| 2019-05-10 | `b3f1383` | Unknown | clean up, added coordinate parsing and printing |
| 2019-05-10 | `5459d9a` | Unknown | added compression manager |

← file-history index
