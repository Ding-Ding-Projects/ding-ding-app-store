# `src/main/java/game/data/chunk/version/Chunk_1_12.java`

**Java** · 103 lines · 2,897 bytes · 23 commit(s) · first 2019-05-18 · last 2023-03-09

## Purpose

Chunks in the 1.12(.2) format. Biomes were a byte array in this version.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2023-03-09 | `b8f05f8` | Mirco Kroon | Make chunk data versions independent of class version |
| 2023-03-06 | `38c8a5a` | Mirco Kroon | Correctly pass parent chunk to all sections |
| 2021-06-29 | `97e1492` | Mirco Kroon | Correctly save sections with a large number of different blocks |
| 2021-06-07 | `b753aec` | Mirco Kroon | Added support for 1.17 |
| 2021-03-09 | `4e43635` | Mirco Kroon | Fixed some index-out-of-bounds issues |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-08 | `fa35486` | Mirco Kroon | Cleaned up prints |
| 2021-02-06 | `0c08b78` | Mirco Kroon | Chunk extending for 1.13 |
| 2021-02-05 | `58ccb5c` | Mirco Kroon | Render-distance extending for 1.12.2 |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-01-30 | `e8501ba` | Mirco Kroon | Allow multiple global palettes for drawing previous chunks |
| 2020-08-28 | `cd7ad6c` | Mirco Kroon | Improved dimension handling |
| 2020-03-04 | `f18a1cc` | Unknown | Improved support for never versions |
| 2019-12-12 | `43d1605` | Unknown | Added exporting of image and loading of all chunks |
| 2019-12-12 | `e6191d9` | Unknown | Added support for basic entities, added proper 1.14.4 support |
| 2019-12-11 | `b40288f` | Unknown | Fixed minimap issues, made minimap work on 1.13/1.14 |
| 2019-12-09 | `446c370` | Unknown | clean up |
| 2019-12-04 | `424ee70` | Unknown | Added adjustable render distance |
| 2019-12-03 | `9a968ed` | Unknown | Added new chunk marking |
| 2019-12-03 | `36e7bee` | Unknown | Added GUI minimap for 1.12.2 |
| 2019-05-19 | `ea79930` | Unknown | documentation for new classes |
| 2019-05-19 | `f772ec7` | Unknown | transitioned to different nbt library, completed 1.13 world handling |
| 2019-05-18 | `5a97219` | Unknown | nearly implemented chunk parsing & writing for 1.13 |

← file-history index
