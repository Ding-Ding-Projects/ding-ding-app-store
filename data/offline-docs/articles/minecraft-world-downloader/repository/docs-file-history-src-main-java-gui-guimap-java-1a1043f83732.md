# `src/main/java/gui/GuiMap.java`

**Java** · 496 lines · 18,253 bytes · 52 commit(s) · first 2021-02-13 · last 2026-06-07

## Purpose

_No leading comment/docstring found — see the file and its history below._

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `66846c9` | cafepromenade | Port from TheHecateII fork: player skin-heads on map + null-safety fixes |
| 2024-06-29 | `220d8fc` | Mirco Kroon | Support for most of 1.21 |
| 2024-05-03 | `5d3689e` | Mirco Kroon | Fixed concurrency issue with chunk images |
| 2023-08-27 | `ec57e9a` | Mirco Kroon | Added distance measuring feature |
| 2023-08-26 | `f470761` | Mirco Kroon | Changed marker transforms |
| 2023-08-25 | `e87a954` | Mirco Kroon | Debugging highlight of chunks/regions |
| 2023-08-23 | `a83786f` | Mirco Kroon | Save smaller version of images to reduce memory used on start |
| 2023-08-23 | `087591d` | Mirco Kroon | Dynamically resize overview images |
| 2023-08-21 | `7139106` | Mirco Kroon | Added switching between rendering modes |
| 2023-08-20 | `7755de0` | Mirco Kroon | Added cave rendering mode |
| 2023-08-20 | `c6fc2d2` | Mirco Kroon | Nicer looking player marker |
| 2023-03-12 | `4509d87` | Mirco Kroon | Added advanced settings section |
| 2023-03-12 | `ac0493a` | Mirco Kroon | Fixed a few issues with unloading chunks or not loading them correctly |
| 2023-03-08 | `940b3a0` | Mirco Kroon | Adjusted map background colours |
| 2023-03-08 | `19e0835` | Mirco Kroon | Fixed memory leaks and performance issues |
| 2023-03-07 | `c998ad8` | Mirco Kroon | Cleaned up code |
| 2023-03-07 | `bb5dbe2` | Mirco Kroon | Delete overview images when chunks are deleted |
| 2023-03-07 | `cd7eac6` | Mirco Kroon | Option to grey out older chunks |
| 2023-03-07 | `f2e8c6a` | Mirco Kroon | Smoother panning on map |
| 2023-03-07 | `b6183c4` | Mirco Kroon | Added smooth zooming |
| 2023-03-07 | `ce3e1e7` | Mirco Kroon | Added back unsaved chunk overlay |
| 2023-03-06 | `9303cd6` | Mirco Kroon | Improved quitting behaviour |
| 2023-03-06 | `22de1b6` | Mirco Kroon | Caching of overview images |
| 2023-03-06 | `547bd1d` | Mirco Kroon | Changed GUI map to use region images instead of chunk images |
| 2022-06-15 | `73e1efb` | Mirco Kroon | Fixed small UI issues |
| 2022-06-05 | `1de8fdb` | Mirco Kroon | Added message for loading registries |
| 2021-04-18 | `63cc77a` | mircokroon | Merge pull request #156 from mircokroon/fix-151 |
| 2021-04-18 | `68c82f0` | Mirco Kroon | Added null check when drawing chunks |
| 2021-03-21 | `424b97a` | mircokroon | Merge pull request #139 from mircokroon/gui-controls |
| 2021-03-21 | `2f668a5` | Mirco Kroon | Added +/- as zoom controls |
| 2021-03-18 | `e549f9f` | Mirco Kroon | Fixed formatting |
| 2021-03-18 | `e19b219` | maxsupermanhd | Hide context menu only if primary button pressed |
| 2021-03-10 | `4df3069` | Mirco Kroon | Prompt for deleting chunks, option to prune images |
| 2021-03-09 | `8cf1f9d` | Mirco Kroon | Send lighting data for chunks |
| 2021-02-26 | `3b4391c` | Mirco Kroon | Fixed zooming issues on minimap |
| 2021-02-25 | `f69e52a` | Mirco Kroon | Improved GUI performance, added panning |
| 2021-02-24 | `93c6ccb` | Mirco Kroon | Added multi-block changes, fixed some bugs |
| 2021-02-24 | `2ae4a65` | Mirco Kroon | Single block changes for 1.12 |
| 2021-02-23 | `c4a41b7` | Mirco Kroon | Added option to render players to the minimap |
| 2021-02-21 | `405a5f5` | Mirco Kroon | Small fixes, added stats debug option |
| 2021-02-18 | `d57b285` | Mirco Kroon | Improve handling of black color for Java 8 |
| 2021-02-18 | `effdf7d` | Mirco Kroon | Manually draw image in Java 8 for NN interpolation |
| 2021-02-18 | `5aef8f3` | Mirco Kroon | Handle missing image smoothing method |
| 2021-02-17 | `b22a9f4` | Mirco Kroon | Fixed concurrency issues |
| 2021-02-16 | `bc80a7f` | Mirco Kroon | Improved handling of paths and working directories |
| 2021-02-15 | `a561d49` | Mirco Kroon | Added some comments |
| 2021-02-14 | `8c1f349` | Mirco Kroon | Fixed issues with closing and output rendering |
| 2021-02-14 | `c2fb5bc` | Mirco Kroon | Improved authentication handling, removed interactive aspect |
| 2021-02-13 | `352e0c2` | Mirco Kroon | Redirect console output when not run from a terminal |
| 2021-02-13 | `3c328ac` | Mirco Kroon | Fixed file output rendering |
| 2021-02-13 | `1aba4e1` | Mirco Kroon | Added settings UI |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |

← file-history index
