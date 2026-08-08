# `src/main/java/packets/handler/ClientBoundLoginPacketHandler.java`

**Java** · 87 lines · 3,558 bytes · 9 commit(s) · first 2021-02-01 · last 2026-06-07

## Purpose

The server refused the login (the usual cause of an "instantly disconnected" connection, e.g. wrong version, not whitelisted, online-mode auth, anti-bot plugin). Show readable text plus the raw chat component for debugging.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `60a2ff3` | cafepromenade | Show the reason on disconnect (debug); fix swapped client/server labels |
| 2024-06-29 | `c2e0f3d` | Mirco Kroon | Fixed login on earlier versions |
| 2024-05-17 | `7cad7ea` | Mirco Kroon | Initial support for 1.20.6 |
| 2023-11-26 | `91aacdf` | Mirco Kroon | Added support for network Configuration stage |
| 2022-06-13 | `d8dd512` | Mirco Kroon | Updated login sequence for 1.19 |
| 2021-02-20 | `7b3fd19` | Mirco Kroon | Improved structure of version handling code |
| 2021-02-13 | `7916805` | Mirco Kroon | Refactored program arguments, switched UI to JavaFX |
| 2021-02-01 | `11f0706` | Mirco Kroon | Split Game class into ConnectionManager and Config |
| 2021-02-01 | `4136b3c` | Mirco Kroon | Rename PacketBuilder, created actual PacketBuilder |

← file-history index
