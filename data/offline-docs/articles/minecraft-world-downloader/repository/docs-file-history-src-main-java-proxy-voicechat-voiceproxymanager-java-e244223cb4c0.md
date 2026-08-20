# `src/main/java/proxy/voicechat/VoiceProxyManager.java`

**Java** · 217 lines · 8,565 bytes · 1 commit(s) · first 2026-06-07 · last 2026-06-07

## Purpose

Handles voice-mod plugin channels (Simple Voice Chat, PlasmoVoice). When a voice server info packet is intercepted: - A UDP proxy is started on localhost: forwarding to realServer:. - If the packet advertises a non-local host, it is rewritten to advertise an empty host so the Minecraft client falls back to using the Minecraft server address (= localhost = our proxy). This lets clients behind the world-downloader MITM proxy reach voice servers that would otherwise only be reachable via UDP directly to the remote server's IP.

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `cf52f76` | cafepromenade | Port from TheHecateII fork: voice-chat UDP proxy (PlasmoVoice / Simple Voice Chat) |

← file-history index
