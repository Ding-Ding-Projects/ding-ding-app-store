# `src/main/java/game/data/chunk/version/Chunk_1_13.java`

**Java** · 110 lines · 3,124 bytes · 20 commit(s) · first 2019-05-18 · last 2023-03-09

## Purpose

Chunk format for 1.13+. Now includes a status tag and the biomes are integers.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2023-03-09 | `b8f05f8` | Mirco Kroon | Make chunk data versions independent of class version |
| 2023-03-06 | `38c8a5a` | Mirco Kroon | Correctly pass parent chunk to all sections |
| 2021-06-29 | `97e1492` | Mirco Kroon | Correctly save sections with a large number of different blocks |
| 2021-06-07 | `b753aec` | Mirco Kroon | Added support for 1.17 |
| 2021-02-19 | `ca61619` | Mirco Kroon | Improved handling of entity data |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-07 | `5455bd4` | Mirco Kroon | Chunk extending for 1.15 |
| 2021-02-06 | `0c08b78` | Mirco Kroon | Chunk extending for 1.13 |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-01-30 | `e8501ba` | Mirco Kroon | Allow multiple global palettes for drawing previous chunks |
| 2020-10-15 | `6e0a9ab` | Mirco Kroon | Fixed issues with version 1.13.2 |
| 2020-08-28 | `cd7ad6c` | Mirco Kroon | Improved dimension handling |
| 2020-03-04 | `f18a1cc` | Unknown | Improved support for never versions |
| 2019-12-12 | `43d1605` | Unknown | Added exporting of image and loading of all chunks |
| 2019-12-11 | `b40288f` | Unknown | Fixed minimap issues, made minimap work on 1.13/1.14 |
| 2019-12-03 | `cac1575` | Unknown | Added GUI minimap for 1.12.2 (missing files) |
| 2019-05-19 | `ea79930` | Unknown | documentation for new classes |
| 2019-05-19 | `009b2e8` | Unknown | changed world status to full |
| 2019-05-19 | `f772ec7` | Unknown | transitioned to different nbt library, completed 1.13 world handling |
| 2019-05-18 | `5a97219` | Unknown | nearly implemented chunk parsing & writing for 1.13 |

← file-history index
