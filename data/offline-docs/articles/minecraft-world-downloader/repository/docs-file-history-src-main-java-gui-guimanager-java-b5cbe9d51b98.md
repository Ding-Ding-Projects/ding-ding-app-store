# `src/main/java/gui/GuiManager.java`

**Java** · 356 lines · 10,811 bytes · 57 commit(s) · first 2019-05-12 · last 2023-03-13

## Purpose

_No leading comment/docstring found — see the file and its history below._

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2023-03-13 | `127747e` | Mirco Kroon | Fixed lighting issues |
| 2023-03-12 | `4509d87` | Mirco Kroon | Added advanced settings section |
| 2023-03-12 | `ac0493a` | Mirco Kroon | Fixed a few issues with unloading chunks or not loading them correctly |
| 2023-03-10 | `1a1784a` | Mirco Kroon | Clearer handling of failed authentication |
| 2023-03-08 | `19e0835` | Mirco Kroon | Fixed memory leaks and performance issues |
| 2023-03-07 | `bb5dbe2` | Mirco Kroon | Delete overview images when chunks are deleted |
| 2023-03-06 | `9303cd6` | Mirco Kroon | Improved quitting behaviour |
| 2023-03-06 | `547bd1d` | Mirco Kroon | Changed GUI map to use region images instead of chunk images |
| 2022-06-07 | `f4c0140` | Mirco Kroon | Added backup option for opening links |
| 2022-06-06 | `0c44914` | Mirco Kroon | Changed Microsoft authentication to happen in browser |
| 2022-06-05 | `1de8fdb` | Mirco Kroon | Added message for loading registries |
| 2022-06-05 | `c086f84` | Mirco Kroon | Fixed issue with GUI not always appearing |
| 2022-06-05 | `1ee16cf` | Mirco Kroon | Improved authentication GUI and method handling |
| 2022-06-04 | `2c76e26` | Mirco Kroon | Added basic Microsoft oauth flow |
| 2021-09-07 | `dc04d33` | Mirco Kroon | Fixed fonts on MacOS (hopefully) |
| 2021-03-10 | `4df3069` | Mirco Kroon | Prompt for deleting chunks, option to prune images |
| 2021-03-09 | `8cf1f9d` | Mirco Kroon | Send lighting data for chunks |
| 2021-02-18 | `42b7f90` | Mirco Kroon | Always exit program when GUI is closed |
| 2021-02-18 | `f75618f` | Mirco Kroon | Fixed handling of URLs |
| 2021-02-17 | `b22a9f4` | Mirco Kroon | Fixed concurrency issues |
| 2021-02-16 | `bc80a7f` | Mirco Kroon | Improved handling of paths and working directories |
| 2021-02-15 | `18f7b45` | Mirco Kroon | Reload previous settings from file |
| 2021-02-15 | `a561d49` | Mirco Kroon | Added some comments |
| 2021-02-15 | `d00f566` | Mirco Kroon | Added icon |
| 2021-02-14 | `8c1f349` | Mirco Kroon | Fixed issues with closing and output rendering |
| 2021-02-14 | `a0c7e0b` | Mirco Kroon | Fixed Java 8 incompatibility issues |
| 2021-02-14 | `c2fb5bc` | Mirco Kroon | Improved authentication handling, removed interactive aspect |
| 2021-02-13 | `352e0c2` | Mirco Kroon | Redirect console output when not run from a terminal |
| 2021-02-13 | `3c328ac` | Mirco Kroon | Fixed file output rendering |
| 2021-02-13 | `1aba4e1` | Mirco Kroon | Added settings UI |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-04 | `f2c4d75` | Mirco Kroon | Computed which chunks to send to the client for chunk extending |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2020-12-13 | `251f708` | Mirco Kroon | Added optional setting to mark unsaved chunks in red in the GUI |
| 2020-10-08 | `75c7a84` | Mirco Kroon | Added options to pause chunk saving, delete old chunks, save & exit |
| 2020-08-28 | `cd7ad6c` | Mirco Kroon | Improved dimension handling |
| 2020-03-04 | `f18a1cc` | Unknown | Improved support for never versions |
| 2019-12-12 | `43d1605` | Unknown | Added exporting of image and loading of all chunks |
| 2019-12-12 | `f8cfe3e` | Unknown | added basic image exporting |
| 2019-12-11 | `b40288f` | Unknown | Fixed minimap issues, made minimap work on 1.13/1.14 |
| 2019-12-09 | `a1bad99` | Unknown | Made chunk writing optional, improved GUI |
| 2019-12-06 | `2d39bf6` | Unknown | Made GUI prettier, small performance improvements |
| 2019-12-06 | `50866d2` | Unknown | Improved performance of GUI and fixed chunk parsing for other dimensions |
| 2019-12-04 | `d5695fe` | Unknown | Improved player marker |
| 2019-12-04 | `424ee70` | Unknown | Added adjustable render distance |
| 2019-12-03 | `9a968ed` | Unknown | Added new chunk marking |
| 2019-12-03 | `cac1575` | Unknown | Added GUI minimap for 1.12.2 (missing files) |
| 2019-05-15 | `c7c6e0f` | Unknown | prevent closing of the GUI from killing the connection |
| 2019-05-12 | `a9bc26d` | Unknown | added frame title |
| 2019-05-12 | `e99094a` | Unknown | added auto resizing of map |
| 2019-05-12 | `d406b74` | Unknown | properly prevented saving of empty chunks |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-12 | `21d5d8b` | Unknown | added displaying of existing chunks |
| 2019-05-12 | `ba7936e` | Unknown | fixed player position |
| 2019-05-12 | `acc6507` | Unknown | added coordinate offset, bedrock masking, player position, chunk removal |
| 2019-05-12 | `27e0b69` | Unknown | added chunk unloading when out of range |
| 2019-05-12 | `57c4feb` | Unknown | added GUI to show saved/loaded chunks |

← file-history index
