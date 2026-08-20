# `src/main/java/game/data/chunk/ChunkBinary.java`

**Java** · 145 lines · 4,726 bytes · 27 commit(s) · first 2019-05-11 · last 2023-02-28

## Purpose

Binary (raw NBT) version of a chunk.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2023-02-28 | `cd0d58e` | Mirco Kroon | Fixed some issues on earlier versions |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-06-11 | `f48d3a2` | Mirco Kroon | Store entities separately in 1.17 |
| 2021-03-09 | `c7577e3` | Mirco Kroon | Send lighting information for 1.14 and 1.15 |
| 2021-02-19 | `ca61619` | Mirco Kroon | Improved handling of entity data |
| 2021-02-16 | `bc80a7f` | Mirco Kroon | Improved handling of paths and working directories |
| 2021-02-15 | `242b6ec` | Mirco Kroon | Replace mkdirs with CreateDirectories |
| 2021-02-15 | `d782dda` | Mirco Kroon | Comments, small changes and fixes |
| 2021-02-15 | `ea5fff5` | Mirco Kroon | Slider for extended render distance |
| 2021-02-14 | `50416dc` | Mirco Kroon | Fixed world offset, added debug writing of chunks |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-07 | `13d51d9` | Mirco Kroon | Added class version to ChunkBinary |
| 2021-02-07 | `9f26707` | Mirco Kroon | Added comments, removed unused code |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-01-30 | `4110c70` | Mirco Kroon | Initiate ClientAuthenticator later for more recent auth details |
| 2020-10-15 | `6e0a9ab` | Mirco Kroon | Fixed issues with version 1.13.2 |
| 2020-08-28 | `cd7ad6c` | Mirco Kroon | Improved dimension handling |
| 2020-03-04 | `f18a1cc` | Unknown | Improved support for never versions |
| 2019-12-12 | `43d1605` | Unknown | Added exporting of image and loading of all chunks |
| 2019-05-19 | `f772ec7` | Unknown | transitioned to different nbt library, completed 1.13 world handling |
| 2019-05-15 | `00a5ea5` | Unknown | fixed small issues with saved chunks |
| 2019-05-15 | `08cb3b1` | Unknown | fixed off-by-one error on data size |
| 2019-05-12 | `d1c03fc` | Unknown | Prevent empty chunks from overwriting full ones |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-12 | `087ca98` | Unknown | masked host in handshake package to prevent nosy servers from kicking |
| 2019-05-11 | `42effc1` | Unknown | fixed chunk data being incorrectly saved |
| 2019-05-11 | `c83ac04` | Unknown | successful block storage (lighting issues remain) |

← file-history index
