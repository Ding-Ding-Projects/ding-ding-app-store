# Auto-explore bot

> Mineflayer bot(s) that connect *through* the world-downloader proxy and walk/fly a grid so the proxy passively captures every chunk in an area — automating world scraping end to end.

## What it does

The auto-explore bot (`mcwd-scraper`) is a Node.js / [mineflayer](https://github.com/PrismarineJS/mineflayer) program that drives one or more in-game bots over a configured area so a human doesn't have to walk it. The bots do **not** save anything themselves — they connect to the **world-downloader proxy** (not the real server), and as they move from chunk to chunk the proxy captures and writes each chunk to disk. The bot's only job is to make sure every target chunk is loaded around it.

Concretely it:

- Logs in via **Microsoft** account (prismarine-auth device-code flow) or **offline** account, per bot.
- Runs **multiple bots** at once, each with its own account; the target grid is partitioned across them.
- Is **gamemode-aware**: creative/spectator fly the grid, survival/adventure walk it (pathfinder if installed, else a flat-world control-state fallback).
- Covers an area defined as **center + radius** or an explicit **block bounding box** (`bbox`).
- **Dedups visited chunks**, persisted to disk, so re-runs skip already-downloaded chunks (override with `revisit`).
- Has an **anti-stuck watchdog** and per-waypoint timeouts so long runs don't hang.
- Optionally **auto-logs-in** to AuthMe-style login plugins on cracked/offline servers.
- Can **dwell** at each chunk and **drain** at the end so the proxy's auto-open-containers feature has time to open and save nearby containers.

It can be run directly from the command line, or started/stopped from the web management console (the "Auto-explore bot" panel), which writes a config file and launches `scrape.js` as a subprocess inside the container.

## How it works

### End-to-end flow

```
[scraper bot(s)]  ->  [world-downloader proxy]  ->  [Minecraft server]
   walks/flies a grid      saves chunks to disk
```

Start the downloader first, then point the bots at the **proxy** address (e.g. `127.0.0.1:25565`). As each bot reaches a chunk and dwells, the proxy receives that chunk from the server and writes it.

### CLI entry point and config (`scraper/scrape.js`)

- `main()` loads config (`loadConfig`), builds the target chunk list, creates a shared `VisitedStore`, then launches one `runBot` promise per account, staggering starts by `loginStaggerMs`. When all bots finish it flushes the visited cache and exits.
- `loadConfig()` merges, in order: a set of built-in defaults, environment variables (`SCRAPE_HOST`, `SCRAPE_PORT`, `SCRAPE_VERSION`), and a JSON file (`--config <file>` / `-c <file>`, else `config.json` in the cwd). The file overrides the defaults via `Object.assign`.

### Target grid (`buildTargets`)

- Converts the area (either `bbox` in blocks, or `center` + `radius` in blocks) into chunk coordinates.
- Generates waypoints as a **square spiral outward from the center** so coverage starts near the player and every consecutive waypoint is adjacent (~16 blocks) — chosen over a distance-sort because it never crisscrosses, which keeps walking efficient.
- `chunkStep` lets it visit every Nth chunk instead of every chunk.

### Visited-chunk dedup (`VisitedStore`)

- A `Set` of `"cx,cz"` keys, loaded from `visitedFile` on start (unless `revisit` is set), shared across all bots in the run.
- Auto-flushes to disk every 5 s (and at the end). Bots skip any chunk already in the set unless `revisit` is true.

### Per-bot lifecycle (`runBot`)

1. **Create bot** with options from `botOptionsFor` (host/port/username/version, plus auth). If `mineflayer-pathfinder` is installed it loads the plugin.
2. **Auto-login** (optional): if `autoLogin` is on (defaults on when `loginPassword` is set), on `login` and whenever a server message mentions `/login`, `please login`, `/register`, or `authme`, it sends `/register <pw> <pw>` then `/login <pw>`.
3. **On spawn**, reads `bot.game.gameMode` and decides movement:
   - `spectator` -> `fly` if `flyWhenAble`, else `idle`.
   - `creative` -> `walk` via pathfinder if available (most reliable); `fly` if `preferFly` + `flyWhenAble`; else fly if pathfinder absent and `flyWhenAble`.
   - `survival` / `adventure` -> `walk` if `walkWhenGrounded`, else `idle`.
4. **Pick this bot's chunks**: with `centerOnSpawn`, each bot builds a fresh grid around *its own* spawn position (full, unpartitioned). Otherwise each bot gets a contiguous slice of the shared grid (`allTargets.slice(index*per, ...)`) so each walks an efficient stretch.
5. **Walk the list**: for each target chunk, navigate to its block center `(cx*16+8, cz*16+8)`, then `sleep(loadWaitMs + containerDwellMs)` so the proxy captures it. Mark the chunk visited even on failure so it isn't retried forever.
6. **Drain & quit**: flush the visited store, wait `finalDrainMs` so the proxy finishes pending chunk/container saves, then `bot.quit()`.

### Movement helpers and version branching

- `flyTo(...)`: aerial movement via control states (`sprint`/`forward`, `jump`/`sneak` to reach `flyAltitude`), looking horizontally at the target; resolves on arrival (within `arriveRadius`) or after `waypointTimeoutMs`. Used for spectator and (after `bot.creative.startFlying()`) creative.
- `walkTo(...)`: if pathfinder is present, uses `GoalNearXZ(x, z, arriveRadius)` raced against `waypointTimeoutMs` (movements allow parkour, no digging, built from `minecraft-data(bot.version)`). Otherwise a flat-world fallback walks forward toward the target and jumps when it detects it's stuck.
- **Anti-stuck watchdog**: every ~`stuckCheckMs/2`, if the bot moved less than `stuckEpsilon` blocks while `navigating`, it hops, faces a random heading, and bursts forward (rising if flying). The watchdog only nudges controls for *manual* movement (fly or fallback-walk); when pathfinder drives, its own per-waypoint timeout handles stuck waypoints so manual nudging doesn't fight the planner.
- The bot does not branch on Minecraft protocol version itself; `version` is passed through to mineflayer (or left `false` to auto-detect), and pathfinder movements are built from `minecraft-data` for the negotiated `bot.version`.

### Microsoft device-code login

- For a `microsoft` account, `botOptionsFor` sets `auth: 'microsoft'` and a per-account `profilesFolder` (`.minecraft-auth/<username>/`) so tokens cache after the first interactive sign-in. The `onMsaCode` callback prints human-readable instructions plus a machine-readable `MSA_CODE {json}` line so the web console can surface the code.

### Web console integration (`web/app.py`)

- `BotManager` runs `node scrape.js --config bot-config.json` as a subprocess (cwd `SCRAPER_DIR`, default `/app/scraper`), capturing stdout. It refuses to start if `scrape.js` is missing ("Bot is not available in this image").
- `BotManager.start(form, proxy_port)` translates web form fields into a generated `bot-config.json` written under `DATA_DIR`:
  - `botAuth` -> `accounts[].auth` (`microsoft` or `offline`).
  - `botUser` -> account username/email. For Microsoft, exactly one bot is used and the email is not mangled. For offline with `botCount > 1`, it generates `User1..UserN`.
  - `botCount` -> number of offline accounts.
  - `botRadius` -> `radius`; `botCenterOnSpawn` -> `centerOnSpawn`; `botPreferFly` -> `preferFly`; `botRevisit` -> `revisit`; `botLoginPassword` -> `loginPassword` (only if non-empty).
  - Fixed in the generated config: `host: "127.0.0.1"`, `port` = the downloader's `portLocal`, `visitedFile` = `<DATA_DIR>/bot-visited.json`.
- The log reader watches for `MSA_CODE ...` lines and exposes `{code, url}` via `BotManager.status().msa` so the dashboard can show the Microsoft sign-in code; it's cleared once a line containing `spawned at` appears (i.e. a bot connected).
- The downloader image is built with the scraper and its deps baked in (`Dockerfile`: `COPY scraper /app/scraper` + `npm install --omit=dev`).

## Key files

- `scraper/scrape.js` — the whole bot: config loading, `buildTargets` (spiral grid), `VisitedStore` (dedup), `runBot` lifecycle, `flyTo`/`walkTo` movement, anti-stuck watchdog, Microsoft/offline auth, AuthMe auto-login.
- `scraper/config.example.json` — sample config with every recognized key; copy to `config.json` and edit.
- `scraper/README.md` — user-facing usage, settings table, gamemode/dedup/auto-login/anti-stuck notes, large-area guidance.
- `scraper/package.json` — package `mcwd-scraper`; deps `mineflayer`, `mineflayer-pathfinder`, `prismarine-auth`; `bin: mcwd-scrape`.
- `web/app.py` — `BotManager` class and `/api/bot/start|stop|status|logs` routes that launch and monitor `scrape.js` from the console and surface the Microsoft device code.
- `web/templates/dashboard.html` — the "Auto-explore bot" panel (form fields, Start/Stop, live log, Microsoft sign-in box).
- `Dockerfile` — bundles the scraper and installs its production deps into the image.

## Configuration / flags

Invocation flag (CLI): `--config <file.json>` / `-c <file.json>`. If omitted, it reads `config.json` from the current directory.

Environment variables (used as defaults, overridden by the config file): `SCRAPE_HOST`, `SCRAPE_PORT`, `SCRAPE_VERSION`.

Config-file keys (defaults from `scrape.js`):

| key | default | meaning |
|-----|---------|---------|
| `host` | `127.0.0.1` | proxy address the bots connect to |
| `port` | `25565` | proxy port |
| `version` | `false` | force a protocol version, or `false` to auto-detect |
| `accounts` | `[{auth:'offline',username:'Scraper'}]` | one entry per bot: `{auth:'microsoft'|'offline', username, cacheDir?}`; multiple entries = multiple bots, grid split across them |
| `center` | `{x:0,z:0}` | area center, in blocks |
| `radius` | `256` | area radius, in blocks |
| `bbox` | `null` | explicit box `{minX,minZ,maxX,maxZ}` in blocks; takes precedence over center/radius |
| `centerOnSpawn` | `false` | each bot covers `radius` around its own spawn (unpartitioned) |
| `chunkStep` | `1` | visit every Nth chunk |
| `flyWhenAble` | `true` | fly the grid in creative/spectator |
| `preferFly` | `false` | creative: fly instead of walking |
| `walkWhenGrounded` | `true` | walk the grid in survival/adventure |
| `flyAltitude` | `120` | Y to fly at |
| `arriveRadius` | `6` | XZ distance (blocks) considered "arrived" |
| `waypointTimeoutMs` | `20000` | give up on a waypoint after this long |
| `loadWaitMs` | `600` | pause at each chunk so the proxy captures it |
| `visitedFile` | `visited.json` | where visited chunks are remembered |
| `revisit` | `false` | ignore the visited cache and re-walk everything |
| `containerDwellMs` | `0` | extra pause per chunk (use with the downloader's `--auto-open-containers`) |
| `finalDrainMs` | `6000` | stay connected this long after the grid so the proxy flushes pending saves |
| `loginPassword` | `''` | if set, `/register` + `/login` with this password (AuthMe-style servers) |
| `autoLogin` | `undefined` | force auto-login on/off; defaults on when `loginPassword` is set |
| `stuckCheckMs` | `4000` | how often the anti-stuck watchdog checks for progress |
| `stuckEpsilon` | `1.5` | min blocks of movement counted as progress |
| `loginStaggerMs` | `4000` | delay between starting each bot |
| `auth` | `undefined` | present in defaults but not otherwise consumed by `scrape.js` |

Web console form fields (a subset, mapped to the generated `bot-config.json`): `botAuth`, `botUser`, `botRadius`, `botCount`, `botLoginPassword`, `botCenterOnSpawn`, `botPreferFly`, `botRevisit`. The console always sets `host`, `port` (from the downloader's local port), and `visitedFile`; it does not expose `bbox`, `chunkStep`, the fly/walk-enable toggles, the timing knobs, or the anti-stuck knobs (those use defaults).

## Usage

### Command line

```bash
cd scraper
npm install
cp config.example.json config.json   # edit it
node scrape.js --config config.json
```

Point `host`/`port` at the **proxy** (the running downloader), not the real server. Start the downloader first, then run the scraper. Progress is logged per bot (`[bot1] visited N/M chunks`); on completion it prints the total visited and exits.

### Web console

In the dashboard's "Auto-explore bot" panel, choose offline/Microsoft auth, set username, radius, bot count, optional AuthMe password, and the Center-on-spawn / Fly / Revisit toggles, then click **Start bot**. For Microsoft auth, a sign-in box shows the device code (and link) until a bot connects. Logs stream live; **Stop bot** terminates the subprocess.

### Capturing containers while scraping

Run the downloader with `--auto-open-containers`, set `containerDwellMs` (e.g. 400–800) so each chunk is dwelt on long enough for the open+save, and keep `finalDrainMs` non-zero so the last saves flush before the bots leave.

## Verification

Per `AGENTS.md`, a live integration harness (Paper server ← downloader proxy ← mineflayer bot) lives outside the repo on the maintainer's machine (`C:/Users/cntow/mcwdtest/`, scripts `testscraper*.js`, `run_all_tests.sh`). It exercises the scraper end-to-end: visited-chunk **dedup**, and movement in **survival**, **adventure**, **creative** (and the no-stuck / anti-stuck path). `scraper/README.md` states scraping is verified in survival and adventure (pathfinder walking) and in creative/spectator (flight) with download + visited-dedup confirmed end-to-end, and that survival/adventure/creative all keep making progress over a 5000×5000 area without stalling.

The bot itself has no in-repo unit tests (`scrape.js` exports `buildTargets` and `VisitedStore`, but the repo's JUnit suite under `src/test/java` covers the Java downloader, not the Node scraper). Verification of the bot is therefore integration-based (live harness) rather than compile-only.

## Gotchas & limitations

- **Point at the proxy, not the server.** The bot never saves chunks; the downloader does. Aiming the bot at the real server defeats the whole purpose.
- **Optional deps degrade silently.** Without `mineflayer-pathfinder`, survival/adventure use a simple flat-world walk fallback (jumps when stuck) that struggles on non-flat terrain. Without `prismarine-auth`, only offline accounts work. Both are listed as dependencies but loaded in `try/catch`.
- **First Microsoft sign-in is interactive** (device-code). Tokens cache per account under `.minecraft-auth/<username>/`; the CLI prints the code, and the web console surfaces it until a bot spawns.
- **Walking large areas is slow** — a 3000×3000 walk is many real-time hours. Use multiple bots and/or fly (creative/spectator) for big areas.
- **Unreachable chunks are skipped, not retried** — they're marked visited after `waypointTimeoutMs` even if never actually reached, so some chunks in difficult terrain may not be captured.
- **Auto-open of containers may trip server anti-cheat** (the downloader's feature is marked experimental); `containerDwellMs`/`finalDrainMs` only give it time, they don't make it safe.
- **AuthMe auto-login sends `/register` then `/login` blindly** using the configured password; it relies on message-text matching (English keywords) to re-trigger.
- **Web console exposes only a subset of config.** Bounding box, `chunkStep`, fly/walk enable toggles, and the timing/anti-stuck knobs are only configurable when running `scrape.js` directly with a hand-written config file.

## Open items

None known.
