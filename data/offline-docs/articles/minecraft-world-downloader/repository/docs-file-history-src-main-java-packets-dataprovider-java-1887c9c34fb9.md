# `src/main/java/packets/DataProvider.java`

**Java** · 50 lines · 1,929 bytes · 10 commit(s) · first 2019-05-10 · last 2021-02-01

## Purpose

packets over this size will crash the game client, so it may help to reject them here

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2019-05-29 | `16fa3bf` | Unknown | prevent packets over the size limit from being sent to the client |
| 2019-05-19 | `8ac7b01` | Unknown | added support for signs sent after chunk generation |
| 2019-05-19 | `f772ec7` | Unknown | transitioned to different nbt library, completed 1.13 world handling |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-11 | `9159209` | Unknown | fixed chunk loading from blocking the network thread |
| 2019-05-11 | `3655d0c` | Unknown | implemented chunk parsing (for 4-bit palettes only) |
| 2019-05-10 | `b3f1383` | Unknown | clean up, added coordinate parsing and printing |
| 2019-05-10 | `b459080` | Unknown | fixed issues with compression |
| 2019-05-10 | `5459d9a` | Unknown | added compression manager |

← file-history index
