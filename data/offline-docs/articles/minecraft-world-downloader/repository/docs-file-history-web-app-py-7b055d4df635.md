# `web/app.py`

**Python** · 916 lines · 36,822 bytes · 9 commit(s) · first 2026-06-01 · last 2026-06-07

## Purpose

Web management UI for the Minecraft World Downloader. Runs as the container's main process. Serves a login-protected dashboard that mirrors every command-line option of the downloader, starts/stops/restarts the (headless) Java process, streams its logs, reports status, and lets you download the saved world as a zip. Configuration via environment variables: WEB_USERNAME dashboard login user (default: admin) WEB_PASSWORD dashboard login password (default: changeme) WEB_PORT port for this web UI (default: 8080) SECRET_KEY Flask session secret (default: generated + persisted under DATA_DIR) JAR_PA

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `a43af49` | cafepromenade | Bot Microsoft sign-in via the web console (device-code in the UI) |
| 2026-06-07 | `bf01ff9` | cafepromenade | Smooth out extended render distance (fix choppy chunk delivery) |
| 2026-06-07 | `f0b974f` | cafepromenade | Add the auto-explore bot to both UIs (web console + desktop GUI) |
| 2026-06-07 | `f199366` | cafepromenade | Make remaining features settable: modded-colors disable, msg format, state file |
| 2026-06-07 | `b4aabd9` | cafepromenade | Expose new downloader features in the web console + desktop GUI |
| 2026-06-07 | `74d73df` | cafepromenade | Headless map rendering + interactive web-console map |
| 2026-06-01 | `cdd5040` | cafepromenade | Web console: auto-copy Microsoft code, hide export until a world exists |
| 2026-06-01 | `72a9836` | cafepromenade | Make web console login optional (off by default) |
| 2026-06-01 | `0ad38e8` | cafepromenade | Add Docker web management console (login, account auth, all functions) |

← file-history index
