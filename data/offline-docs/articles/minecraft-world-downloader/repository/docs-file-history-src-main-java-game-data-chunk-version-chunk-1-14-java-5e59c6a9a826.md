# `src/main/java/game/data/chunk/version/Chunk_1_14.java`

**Java** · 205 lines · 6,991 bytes · 23 commit(s) · first 2019-05-18 · last 2026-05-31

## Purpose

no lights here in 1.14+

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-05-31 | `c969ee7` | cafepromenade | Fix 1.20.2+ chunk NBT: write nameless heightmaps to client |
| 2023-03-13 | `127747e` | Mirco Kroon | Fixed lighting issues |
| 2023-03-09 | `b8f05f8` | Mirco Kroon | Make chunk data versions independent of class version |
| 2023-03-06 | `38c8a5a` | Mirco Kroon | Correctly pass parent chunk to all sections |
| 2021-09-15 | `919e0be` | Mirco Kroon | Fixed light section above the topmost section not being parsed |
| 2021-06-29 | `97e1492` | Mirco Kroon | Correctly save sections with a large number of different blocks |
| 2021-06-11 | `fd4b6c1` | Mirco Kroon | Fixed issues with invalid chunks in earlier versions |
| 2021-06-09 | `dd9d538` | Mirco Kroon | Fixed handling of lighting and network encoding for 1.17 |
| 2021-06-07 | `b753aec` | Mirco Kroon | Added support for 1.17 |
| 2021-05-29 | `d510cb0` | Mirco Kroon | Rename packets to official mapping names |
| 2021-03-10 | `8960f88` | Mirco Kroon | Fixed missing lighting on some chunks, performance optimisations |
| 2021-03-09 | `c7577e3` | Mirco Kroon | Send lighting information for 1.14 and 1.15 |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-04 | `7f931b2` | Mirco Kroon | Complete render-distance extending for 1.16 |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-01-30 | `e8501ba` | Mirco Kroon | Allow multiple global palettes for drawing previous chunks |
| 2020-10-15 | `7c56a84` | Mirco Kroon | Fixed issues with version 1.14.4 |
| 2020-08-28 | `cd7ad6c` | Mirco Kroon | Improved dimension handling |
| 2020-06-27 | `20ba5ce` | Mirco Kroon | Added 1.16 support |
| 2019-12-12 | `43d1605` | Unknown | Added exporting of image and loading of all chunks |
| 2019-05-19 | `ea79930` | Unknown | documentation for new classes |
| 2019-05-19 | `bbab134` | Unknown | implemented most of 1.14 world handling |
| 2019-05-18 | `5a97219` | Unknown | nearly implemented chunk parsing & writing for 1.13 |

← file-history index
