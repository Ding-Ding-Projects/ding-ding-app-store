# `pom.xml`

**XML** · 252 lines · 9,163 bytes · 61 commit(s) · first 2019-05-06 · last 2026-06-08

## Purpose

_No leading comment/docstring found — see the file and its history below._

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-08 | `3f713e0` | cafepromenade | Make `mvn package` skip tests by default (just build) |
| 2026-04-15 | `f88e6c6` | CafePromenade | Update pom.xml |
| 2026-04-15 | `a3d0380` | CafePromenade | Update pom.xml |
| 2026-04-15 | `5938b21` | CafePromenade | Add distribution management for GitHub Packages |
| 2024-07-22 | `fe845a8` | dependabot[bot] | Bump dnsjava:dnsjava from 3.5.1 to 3.6.0 |
| 2024-05-25 | `b69cb9a` | Mirco Kroon | Clearer authentication when on main settings page |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2023-08-17 | `57b98ce` | Mirco Kroon | Removed .exe builds |
| 2022-06-16 | `a6c9b92` | Mirco Kroon | Removed bouncycastle dependency |
| 2022-06-13 | `d8dd512` | Mirco Kroon | Updated login sequence for 1.19 |
| 2022-06-06 | `0c44914` | Mirco Kroon | Changed Microsoft authentication to happen in browser |
| 2022-06-04 | `9321d1e` | Mirco Kroon | Added webview dependency, updated some dependencies |
| 2022-06-02 | `cfef541` | Kerrinen Hope | Addressed a few maven warnings. |
| 2022-05-20 | `5ee056c` | dependabot[bot] | Bump gson from 2.8.5 to 2.8.9 |
| 2022-05-09 | `62d960d` | Agile | Update pom.xml |
| 2021-12-23 | `95fe9cc` | Mirco Kroon | Fixed pom file |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-09-07 | `3987da7` | Mirco Kroon | Add missing Java path |
| 2021-08-20 | `37a1082` | mircokroon | Merge pull request #194 from mircokroon/java-version |
| 2021-08-20 | `530a550` | Mirco Kroon | Fixed build issues |
| 2021-08-20 | `91b3c28` | Mirco Kroon | Require Java 16, search different paths for .exe |
| 2021-07-19 | `720adf8` | mircokroon | Merge pull request #181 from mircokroon/authfix |
| 2021-07-19 | `c219ec0` | Mirco Kroon | Don't require JavaFx to be manually installed |
| 2021-06-11 | `8ce4911` | mircokroon | Merge pull request #163 from mircokroon/1_17 |
| 2021-06-09 | `9dea640` | Mirco Kroon | Update build.yml |
| 2021-06-09 | `dd9d538` | Mirco Kroon | Fixed handling of lighting and network encoding for 1.17 |
| 2021-04-26 | `8490828` | dependabot[bot] | Bump commons-io from 2.4 to 2.7 |
| 2021-02-18 | `444e23a` | Mirco Kroon | Remove outdated tag |
| 2021-02-18 | `367f0bf` | Mirco Kroon | Include missing dependencies in minimized jar |
| 2021-02-16 | `a662979` | Mirco Kroon | Reduce jar filesize |
| 2021-02-16 | `bddff6a` | Mirco Kroon | Added .exe build step |
| 2021-02-16 | `bc80a7f` | Mirco Kroon | Improved handling of paths and working directories |
| 2021-02-15 | `20d3958` | Mirco Kroon | Fixed some Maven warnings |
| 2021-02-15 | `d782dda` | Mirco Kroon | Comments, small changes and fixes |
| 2021-02-15 | `b55aa0f` | Mirco Kroon | Cleaned up pom file |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-09 | `dddfe58` | Mirco Kroon | Downgrade java version to 8 |
| 2021-02-07 | `ddfc664` | Mirco Kroon | Added test step to Github actions |
| 2021-02-02 | `abc6aea` | Mirco Kroon | Instanced WorldManager, initial chunk network encoding |
| 2021-02-01 | `f7b4e8b` | Mirco Kroon | Added tests for packet building/parsing |
| 2020-10-13 | `f81709e` | dependabot[bot] | Bump junit from 4.12 to 4.13.1 |
| 2020-10-08 | `6aa4a86` | Mirco Kroon | Use latest version of jo-nbt |
| 2020-10-08 | `bd9d3e5` | Mirco Kroon | Added handling of SRV records |
| 2020-05-22 | `63748a2` | Mirco Kroon | Automatically generate reports files |
| 2020-05-22 | `6174442` | Mirco Kroon | Added missing dependency |
| 2020-04-02 | `b56c57f` | ChillerDragon | Bump compiler plugin to 3.8.1 |
| 2020-03-26 | `8ecd3a0` | ChillerDragon | Fix maven warning about missing version |
| 2020-03-04 | `1714c48` | Unknown | Updated version |
| 2019-05-19 | `f772ec7` | Unknown | transitioned to different nbt library, completed 1.13 world handling |
| 2019-05-12 | `42f89fd` | Unknown | added assembly to jar |
| 2019-05-12 | `50d7b79` | Unknown | set version to 1.8 |
| 2019-05-12 | `57c4feb` | Unknown | added GUI to show saved/loaded chunks |
| 2019-05-12 | `c057c7b` | Unknown | implemented argument parsing |
| 2019-05-11 | `da03eb5` | Unknown | added tile entity parsing |
| 2019-05-11 | `3655d0c` | Unknown | implemented chunk parsing (for 4-bit palettes only) |
| 2019-05-10 | `b459080` | Unknown | fixed issues with compression |
| 2019-05-10 | `4e894b8` | Unknown | added client authentication |
| 2019-05-10 | `3361dab` | Unknown | succesful token verification |
| 2019-05-08 | `300d52d` | Mirco Kroon | Added basic packet handling set up |
| 2019-05-08 | `7643650` | Mirco Kroon | improvements |
| 2019-05-06 | `5226c86` | Unknown | set up initial proxy |

← file-history index
