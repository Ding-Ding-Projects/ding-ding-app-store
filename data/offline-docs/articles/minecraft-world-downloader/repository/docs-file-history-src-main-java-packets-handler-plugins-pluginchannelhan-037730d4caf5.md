# `src/main/java/packets/handler/plugins/PluginChannelHandler.java`

**Java** · 44 lines · 1,530 bytes · 3 commit(s) · first 2023-03-18 · last 2026-06-07

## Purpose

1.13+ namespaced channel (e.g. "forge:handshake", "minecraft:brand", a voice-chat channel). The voice proxy may rewrite + re-inject the packet (returning false to drop the original).

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `cf52f76` | cafepromenade | Port from TheHecateII fork: voice-chat UDP proxy (PlasmoVoice / Simple Voice Chat) |
| 2026-06-07 | `c3fd028` | cafepromenade | Port from TheHecateII fork: modded block map colors + CustomPayload 1.20.6/1.21 |
| 2023-03-18 | `38d60f2` | Mirco Kroon | Handle Forge plugin protocol (for 1.12.2) |

← file-history index
