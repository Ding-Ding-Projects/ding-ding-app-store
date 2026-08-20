# `scraper/scrape.js`

**JavaScript** · 441 lines · 21,192 bytes · 7 commit(s) · first 2026-06-07 · last 2026-06-07

## Purpose

mcwd-scraper — Mineflayer auto-explorer for the Minecraft world-downloader. Spawns one or more bots that connect THROUGH the world-downloader proxy and walk/fly a grid so the proxy passively captures every chunk in an area. Designed to automate world scraping end to end. Features: - Microsoft account login (prismarine-auth device-code flow) or offline accounts, per bot. - Multiple bots, each with its own account; the target grid is partitioned across them. - Gamemode-aware movement: creative/spectator fly the grid; survival/adventure walk it (mineflayer-pathfinder if installed, else a flat-wor

## Commit history

| Date | Commit | Author | Summary |
| --- | --- | --- | --- |
| 2026-06-07 | `a43af49` | cafepromenade | Bot Microsoft sign-in via the web console (device-code in the UI) |
| 2026-06-07 | `16393fb` | cafepromenade | Scraper: clearer Microsoft device-code sign-in output |
| 2026-06-07 | `b7009f4` | cafepromenade | Scraper: center-out spiral ordering (start near the player) |
| 2026-06-07 | `04a8ffa` | cafepromenade | Scraper: serpentine waypoint order (fixes slow/incomplete large scrapes) |
| 2026-06-07 | `be08aa6` | cafepromenade | Scraper: anti-stuck watchdog, auto-login, and creative preferFly |
| 2026-06-07 | `3c92350` | cafepromenade | Scraper: container-dwell + final-drain so containers get saved |
| 2026-06-07 | `01137cd` | cafepromenade | Add mineflayer auto-scraper bot (scraper/) |

← file-history index
