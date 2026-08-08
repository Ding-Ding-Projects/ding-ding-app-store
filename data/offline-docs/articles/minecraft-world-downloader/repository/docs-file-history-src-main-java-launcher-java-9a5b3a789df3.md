# `src/main/java/Launcher.java`

**Java** · 61 lines · 1,933 bytes · 29 commit(s) · first 2019-05-12 · last 2026-05-07

## Purpose

if we can't write to the working directory, try the jar file's location

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-05-07 | `9d7eada` | cafepromenade | Reduce terminal error output and trim config I/O allocations |
| 2021-02-16 | `bc80a7f` | Mirco Kroon | Improved handling of paths and working directories |
| 2021-02-13 | `1aba4e1` | Mirco Kroon | Added settings UI |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-08 | `8a0158c` | Mirco Kroon | Added option to override server reported render distance |
| 2021-02-07 | `7f327bf` | Mirco Kroon | Renamed some program arguments |
| 2021-02-07 | `3e600a9` | Mirco Kroon | Added developer mode option |
| 2021-02-04 | `f2c4d75` | Mirco Kroon | Computed which chunks to send to the client for chunk extending |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2020-12-13 | `251f708` | Mirco Kroon | Added optional setting to mark unsaved chunks in red in the GUI |
| 2020-10-08 | `bd9d3e5` | Mirco Kroon | Added handling of SRV records |
| 2020-08-27 | `a73c468` | Christopher Nethercott | Added OSX to getDefaultPath() |
| 2020-07-11 | `c40b67c` | Mirco Kroon | Use Paths.get to concatenate paths |
| 2020-07-10 | `bdaf127` | ChillerDrgon | Fix linux home path |
| 2020-06-29 | `756833b` | Mirco Kroon | Added option to set the world type to a superflat void |
| 2020-04-04 | `db2a633` | Unknown | Changed default Minecraft path on Linux |
| 2019-12-09 | `a1bad99` | Unknown | Made chunk writing optional, improved GUI |
| 2019-12-04 | `424ee70` | Unknown | Added adjustable render distance |
| 2019-05-19 | `ea79930` | Unknown | documentation for new classes |
| 2019-05-18 | `3d83221` | Unknown | implemented handling for packets of different Minecraft versions |
| 2019-05-14 | `1ae5c48` | Unknown | added launch option for alternative minecraft locations (psycho support) |
| 2019-05-13 | `d70a48b` | Unknown | performance: deleted BlockState class & reduced delete distance |
| 2019-05-13 | `616694e` | Unknown | added automatic level.dat writing |
| 2019-05-12 | `42f89fd` | Unknown | added assembly to jar |
| 2019-05-12 | `8f4dc62` | Unknown | documentation and refactoring |
| 2019-05-12 | `21d5d8b` | Unknown | added displaying of existing chunks |
| 2019-05-12 | `acc6507` | Unknown | added coordinate offset, bedrock masking, player position, chunk removal |
| 2019-05-12 | `57c4feb` | Unknown | added GUI to show saved/loaded chunks |
| 2019-05-12 | `c057c7b` | Unknown | implemented argument parsing |

← file-history index
