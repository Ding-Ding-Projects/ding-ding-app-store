# `src/main/java/game/data/container/ContainerAutoOpener.java`

**Java** · 343 lines · 17,684 bytes · 9 commit(s) · first 2026-06-05 · last 2026-06-07

## Purpose

EXPERIMENTAL, opt-in (--auto-open-containers). Automatically opens nearby containers, one at a time and rate-limited, so a passive world-download captures their contents without the player manually clicking each chest. How it works: as the player moves, {@link #tick(Coordinate3D)} (called on the client->server thread) finds the closest not-yet-captured container within reach and injects a serverbound "UseItemOn" packet to open it. The server replies with OpenScreen + ContainerSetContent, which the existing capture path records ({@link ContainerManager#items}). When that content arrives, {@l

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `1eb9f89` | cafepromenade | Auto-open: also skip shulker boxes while a player is nearby |
| 2026-06-07 | `ef5d1d2` | cafepromenade | Auto-open: also skip barrels while a player is nearby |
| 2026-06-07 | `3dd17b2` | cafepromenade | Fix modern (1.20.5+) container item NBT; auto-open container minecarts |
| 2026-06-07 | `c8ddc47` | cafepromenade | Make 1.21.5+ fully work; player-aware chests; configurable auto-reply colours |
| 2026-06-07 | `8c892fa` | cafepromenade | Auto-open + chat-reply: fix modern-server capture, add item log, player-safe chests |
| 2026-06-07 | `734861d` | cafepromenade | auto open |
| 2026-06-05 | `a5be3ae` | cafepromenade | Map GameEvent for 1.21-1.21.8; add auto-open action-bar diagnostic (#10) |
| 2026-06-05 | `3a74eed` | cafepromenade | Auto-open: configurable gamemodes (survival), fix swallowed real opens, capture crafters (#9) |
| 2026-06-05 | `d1bb27a` | cafepromenade | Add opt-in, spectator-gated auto-open of nearby containers (#8) |

← file-history index
