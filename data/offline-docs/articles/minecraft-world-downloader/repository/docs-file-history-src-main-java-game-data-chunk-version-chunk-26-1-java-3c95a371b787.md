# `src/main/java/game/data/chunk/version/Chunk_26_1.java`

**Java** · 92 lines · 3,720 bytes · 1 commit(s) · first 2026-05-31 · last 2026-05-31

## Purpose

26.1 (protocol 775) chunk handling. The only change relevant to chunk parsing since 1.20 is the height-map encoding in the chunk-data packet. Up to 1.21.4 the height maps were sent as a single NBT compound; since 1.21.5 they are sent as a length-prefixed array of {@code (type, packed-long-array)} entries. We translate that wire form into the NBT compound Minecraft uses in region files - keyed by the same names - so that both saving chunks to disk and re-sending them to the client to extend the render distance keep working unchanged. Everything else in the chunk-data packet (paletted block/biom

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-05-31 | `64da528` | cafepromenade | Add support for Minecraft 26.1 (protocol 775) |

← file-history index
