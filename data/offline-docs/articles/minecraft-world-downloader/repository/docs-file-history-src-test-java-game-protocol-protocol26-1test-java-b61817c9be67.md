# `src/test/java/game/protocol/Protocol26_1Test.java`

**Java** · 41 lines · 1,829 bytes · 1 commit(s) · first 2026-06-07 · last 2026-06-07

## Purpose

26.1 (protocol 775) cannot be exercised by a live bot — mineflayer/minecraft-data have no 26.x protocol data ("unsupported protocol version: 26.1.2"). This test instead asserts that the proxy's 26.1 mapping is wired to the SAME code paths that are verified end-to-end on 1.21.8/1.21.11: the 1.21.5+ chunk handling, the 1.21.3+ Use Item On worldBorderHit field, NBT chat, and the serverbound ChatMessage id used by the auto-reply.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `cab4234` | cafepromenade | Add 26.1 (protocol 775) mapping test |

← file-history index
