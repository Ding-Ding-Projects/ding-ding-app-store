# `src/main/java/config/Version.java`

**Java** · 42 lines · 1,567 bytes · 18 commit(s) · first 2021-02-20 · last 2026-06-07

## Purpose

version numbers correspond to the earliest full release. For 1.8-1.11 the protocol/data values are synthetic lower-bound anchors so that bestMatch maps each version family to the right handler (1.8 has no real data version; 1.9-1.11 use their release data versions).

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `c8ddc47` | cafepromenade | Make 1.21.5+ fully work; player-aware chests; configurable auto-reply colours |
| 2026-06-01 | `cd0b105` | cafepromenade | Add protocol entries for 1.21.2-1.21.11 point releases |
| 2026-06-01 | `9290a94` | cafepromenade | Add support for Minecraft 1.8-1.11 |
| 2026-05-31 | `64da528` | cafepromenade | Add support for Minecraft 26.1 (protocol 775) |
| 2024-06-29 | `6008888` | Mirco Kroon | Prevent some errors on 1.21 |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2024-02-08 | `e2359a8` | nnnlog | Update for 1.20.3 |
| 2023-11-24 | `4a5c14c` | nnnlog | Update for 1.20.2 |
| 2023-06-18 | `00e7c7c` | n90p | Support for 1.20 |
| 2023-03-09 | `9abb16b` | Mirco Kroon | Reduced complexity of updating to new versions |
| 2023-02-26 | `e9390a5` | Logan Bell | Add support for 1.19.3 |
| 2022-06-13 | `d8dd512` | Mirco Kroon | Updated login sequence for 1.19 |
| 2021-12-23 | `ddfc007` | Mirco Kroon | Block & biome saving for 1.18 |
| 2021-06-11 | `a25bfe3` | Mirco Kroon | Fixed broken tests |
| 2021-06-11 | `fd4b6c1` | Mirco Kroon | Fixed issues with invalid chunks in earlier versions |
| 2021-06-09 | `dd9d538` | Mirco Kroon | Fixed handling of lighting and network encoding for 1.17 |
| 2021-06-07 | `b753aec` | Mirco Kroon | Added support for 1.17 |
| 2021-02-20 | `7b3fd19` | Mirco Kroon | Improved structure of version handling code |

← file-history index
