# `src/main/java/game/data/chunk/version/ChunkSection_1_16.java`

**Java** · 64 lines · 2,002 bytes · 11 commit(s) · first 2020-06-27 · last 2023-03-09

## Purpose

if blocks is empty or isn't the correct size, no need to copy

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2023-03-09 | `b8f05f8` | Mirco Kroon | Make chunk data versions independent of class version |
| 2023-03-06 | `38c8a5a` | Mirco Kroon | Correctly pass parent chunk to all sections |
| 2022-06-06 | `86ed426` | Mirco Kroon | Discard additional data sent by some servers for biomes |
| 2022-06-01 | `3699df7` | Mirco Kroon | Fixed index OOB for multi-block changes on some servers |
| 2021-06-29 | `97e1492` | Mirco Kroon | Correctly save sections with a large number of different blocks |
| 2021-06-07 | `b753aec` | Mirco Kroon | Added support for 1.17 |
| 2021-02-24 | `93c6ccb` | Mirco Kroon | Added multi-block changes, fixed some bugs |
| 2021-02-24 | `06f2479` | Mirco Kroon | Handle single-block updates for 1.13+ |
| 2021-02-07 | `c65d4d3` | Mirco Kroon | Removed support for 1.16.0 and 1.16.1 |
| 2021-01-30 | `e8501ba` | Mirco Kroon | Allow multiple global palettes for drawing previous chunks |
| 2020-06-27 | `20ba5ce` | Mirco Kroon | Added 1.16 support |

← file-history index
