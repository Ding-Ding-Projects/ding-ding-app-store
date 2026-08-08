# `src/main/java/game/data/container/ItemRegistry.java`

**Java** · 73 lines · 2,684 bytes · 6 commit(s) · first 2020-08-28 · last 2026-06-07

## Purpose

The bundled legacy registry is {"items": {"": ""}}; parse it into both maps. (Deserializing straight into this class would not work: the field names don't match the JSON.)

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `8c892fa` | cafepromenade | Auto-open + chat-reply: fix modern-server capture, add item log, player-safe chests |
| 2026-05-08 | `a843d38` | cafepromenade | CI upgrade, add Dockerfile, use InputStream |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2022-06-02 | `da81c1d` | Mirco Kroon | Formatting, changed packet names to 'official' ones |
| 2020-10-15 | `722be2e` | Mirco Kroon | Inventory saving & dimension handling for 1.12.2 |
| 2020-08-28 | `ef11808` | Mirco Kroon | Single-chest item saving |

← file-history index
