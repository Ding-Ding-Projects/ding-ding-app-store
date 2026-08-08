# `web/auth.py`

**Python** · 193 lines · 7,741 bytes · 1 commit(s) · first 2026-06-01 · last 2026-06-01

## Purpose

Minecraft account authentication for the web console. Supports three login methods (mirroring the desktop app's options): * microsoft - OAuth 2.0 device-code flow (ideal for headless/web), then the Xbox Live -> XSTS -> Minecraft Services token chain. The resulting Minecraft access token + username are passed to the downloader via --token / --username. * manual - paste an existing Minecraft access token; we look up the profile for the username/uuid. * offline - just a username (for offline-mode / cracked servers); no token. Microsoft tokens are refreshed automatically using the stored refresh t

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-01 | `0ad38e8` | cafepromenade | Add Docker web management console (login, account auth, all functions) |

← file-history index
