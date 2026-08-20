# `docker-compose.yml`

**YAML** · 37 lines · 1,494 bytes · 3 commit(s) · first 2026-06-01 · last 2026-06-07

## Purpose

The console has NO login by default. To gate it behind a username/password (recommended if you expose it beyond localhost), set both of these: WEB_USERNAME: "admin" WEB_PASSWORD: "change-me" SECRET_KEY: "set-a-long-random-string" # only used when login is enabled

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `12c1644` | cafepromenade | BlueMap: docker-compose service (profile) to render + serve the 3D map |
| 2026-06-01 | `72a9836` | cafepromenade | Make web console login optional (off by default) |
| 2026-06-01 | `0ad38e8` | cafepromenade | Add Docker web management console (login, account auth, all functions) |

← file-history index
