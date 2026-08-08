# `src/main/java/proxy/voicechat/UdpProxy.java`

**Java** · 133 lines · 5,322 bytes · 1 commit(s) · first 2026-06-07 · last 2026-06-07

## Purpose

Bidirectional UDP proxy: listens on localPort (all interfaces), forwards all packets to remoteHost:remotePort, and relays responses back to the originating client address. This is used so that voice mod clients connecting to localhost can reach a remote voice server.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `cf52f76` | cafepromenade | Port from TheHecateII fork: voice-chat UDP proxy (PlasmoVoice / Simple Voice Chat) |

← file-history index
