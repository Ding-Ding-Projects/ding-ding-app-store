# `src/main/java/game/data/chunk/version/encoder/BlockLocationEncoder_1_16.java`

**Java** · 57 lines · 2,054 bytes · 4 commit(s) · first 2021-02-24 · last 2022-06-01

## Purpose

1.16 needs a a slightly different getPaletteIndex method. Instead of a blockstate now overlapping multiple longs, it will push the next index to the next long (so some bits at the end of each long may go unused). Luckily, this actually makes the method a little bit simpler.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2022-06-01 | `05727f1` | Mirco Kroon | Formatting etc |
| 2022-05-30 | `fbe06fb` | Jorel Ali | 1.18.2 support. |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-02-24 | `06f2479` | Mirco Kroon | Handle single-block updates for 1.13+ |

← file-history index
