# Web management console

> A Flask-based web dashboard that runs as the Docker container's main process, letting you configure, start/stop, monitor, authenticate, and download from the headless Minecraft world downloader from a browser.

## What it does

The web management console is a login-optional web UI (`web/app.py`) that wraps the headless `world-downloader.jar` so the whole downloader can be driven from a browser instead of a desktop GUI. It is the container's `ENTRYPOINT`. From a single dashboard page it lets you:

- Edit every downloader option in a form that mirrors the CLI flags one-to-one, and persist those settings to disk.
- Start, stop, and restart the (headless) Java downloader process, with its full command line shown (the Minecraft token redacted).
- Stream the downloader's stdout/stderr logs live into the page.
- See run status: running/stopped, PID, uptime, and the proxy port.
- Sign in to a Minecraft account three ways — Microsoft OAuth device-code flow, a pasted access token ("manual"), or an offline username — and have those credentials passed to the downloader on launch.
- Download the saved world as a `.zip` or `.tar.gz`, or copy a timestamped snapshot into the mounted `./data/exports` directory.
- View a live overview map (separate `/map` page) rendered headlessly by the downloader.
- Launch and stop one or more mineflayer "auto-explore" bots (`node scrape.js`) that connect through the proxy and walk/fly a grid to force the area to download.

A separate console login (username/password) is **off by default** and can be enabled to gate the dashboard behind credentials. The Minecraft account login is independent and is required for online-mode servers.

## How it works

### Process model

`app.py` is a Flask application served by `waitress` (falling back to Flask's dev server if waitress is not importable) on `0.0.0.0:WEB_PORT` (default 8080). It is started directly by the Dockerfile `ENTRYPOINT` (`python3 /app/web/app.py`). On startup it ensures `DATA_DIR` exists and loads/creates a Flask `secret_key`.

### Configuration schema (`OPTIONS`)

The heart of the console is the `OPTIONS` list, a hand-maintained table that mirrors `config/Config.java` one-to-one. Each entry is `(group, key, flag, type, default, label, help)` where `type` is one of `text | int | password | bool`. `options_by_group()` groups these for rendering, and the dashboard template iterates the groups to build the form (checkboxes for `bool`, number/password/text inputs otherwise; the `server` field is marked `required`). Groups currently defined: Connection, World output, Render distance & map, Auto-open containers, Chat auto-reply, Advanced.

### Persisted config

`load_config()` reads `DATA_DIR/manager-config.json` (falling back to defaults derived from `OPTIONS`). `save_config()` writes it back but always strips `accessToken` so the token is never persisted. The dashboard posts the whole form; `_collect_cfg()` reconstructs the config dict from the request (booleans coerced via the `BOOL_TRUE` set `{"1","true","on","yes"}`).

### Downloader lifecycle (`Downloader` class)

A single module-level `downloader = Downloader()` instance manages the Java process under a lock.

- `build_command(cfg, creds)` assembles the argv: `java -Djava.awt.headless=true -jar JAR_PATH --no-gui`, then `--server <server>` (raising `ValueError` if blank). It then iterates `OPTIONS` (skipping `server`, `centerX`, `centerZ`, and `portLocal`): bool flags are appended when truthy, value flags are appended as `[flag, value]` when non-empty. `centerX`/`centerZ` are special-cased — both are only added (`--center-x`, `--center-z`) when *both* are present. **`--local-port` is then forced to the fixed `CONTAINER_PROXY_PORT` (25565)** — the port the Docker image EXPOSEs and that `docker run -p <hostPort>:25565` / compose publish — so the editable "Proxy port (host)" field can never move the listener off the published port (which would make the Minecraft client unable to connect at all). If `creds` are supplied, `--username` and `--token` are appended.
- `start()` clears the log, records a redacted command line (the Minecraft token replaced with `***`), spawns the process via `subprocess.Popen` with `cwd=DATA_DIR`, stdout+stderr merged into a pipe, then starts a daemon reader thread.
- `_reader()` reads lines into a bounded `deque(maxlen=5000)` and, on process exit, appends an `=== downloader process exited (code N) ===` marker.
- `logs_since(since)` returns `(total, new_lines)` so the browser can long-poll incrementally with a monotonically increasing `total` cursor.
- `stop()` calls `terminate()`, waits up to 10s, then `kill()`.
- `status()` reports `running`, `pid`, `uptime`, the last config (minus `accessToken`), the jar path, and the proxy port.

### Minecraft account auth (`auth.py` + `AuthStore`)

`AuthStore` persists the active account to `DATA_DIR/auth.json` (chmod 0600). Three methods:

- **microsoft** — `auth.begin_device_flow()` requests a device code from `login.live.com` (using the public Minecraft launcher client id `00000000402b5328` and scope `service::user.auth.xboxlive.com::MBI_SSL`, all overridable via env vars). The browser polls `/api/auth/microsoft/poll`, which calls `auth.poll_device_flow()`. On success it runs the Xbox Live → XSTS → Minecraft Services token chain (`_xbox_to_minecraft`), stores `mc_token`, `ms_refresh_token`, username, uuid, and the obtained timestamp. XSTS 401s are mapped to human-readable XErr messages.
- **manual** — `/api/auth/manual` takes a pasted token, resolves the profile via `profile_from_token()` (Minecraft profile endpoint), and stores it (method `manual`).
- **offline** — `/api/auth/offline` stores just a username; no token.

`credentials_for_launch()` returns `{username, mc_token?}` for the downloader and, for Microsoft accounts older than 20 hours, transparently refreshes the token via `auth.refresh_microsoft()` before launch. Tokens are never written to `manager-config.json`.

### Console login (separate from Minecraft auth)

The `login_required` decorator gates views only when `LOGIN_ENABLED` is true (i.e. when `WEB_PASSWORD` is non-empty). For `/api/*` paths it returns `401 JSON`; otherwise it redirects to `/login`. `/login` compares the submitted username/password against `WEB_USERNAME`/`WEB_PASSWORD` using `hmac.compare_digest` (constant-time) and sets a permanent session. `/logout` clears the session. If login is disabled, `/login` just redirects to the index.

### Live map (`/map`)

`map_view()` renders `templates/map.html`. The downloader renders the overview into `<world>/overview`. `/map/meta.json` serves that directory's `meta.json` (or a default JSON if absent), and `/map/tile/<dim>/<mode>/<rx>/<rz>.png` serves region tiles. Both endpoints set `Cache-Control: no-cache`. The tile route validates `mode` (`normal`/`caves`), constrains `dim` to `[A-Za-z0-9._-]+`, parses `rx`/`rz` as ints, and uses `os.path.normpath` + a prefix check to prevent path traversal outside the overview directory.

### Auto-explore bot (`BotManager`)

A second module-level instance `bot_manager` runs `node scrape.js` from `SCRAPER_DIR` (`/app/scraper`). `start(form, proxy_port, auth_only=False)` builds a `bot-config.json` in `DATA_DIR` from the form (auth offline/microsoft, username, bot count, radius, center-on-spawn, prefer-fly, revisit, optional AuthMe login password, a visited-file path), pointing the bot at `127.0.0.1:<proxy_port>` (the fixed `CONTAINER_PROXY_PORT`). The reader thread watches for `MSA_CODE <json>` lines (surfacing the bot's Microsoft device code in `status().msa`) and clears it once a bot reports `spawned at` or `sign-in complete`. Microsoft bot logins force `count = 1`, and the token is cached under the mounted volume (`/data/bot-auth`, set via each account's `cacheDir`) so sign-in survives container restarts.

A dedicated **`/api/bot/auth`** route runs `start(..., auth_only=True)`: the scraper does only the Microsoft device-code flow (no connecting/exploring), caching a token the explore bot then reuses silently. The device code is surfaced (and auto-copied) in the UI exactly like the explore path. This backs the bot panel's **"Sign in to Microsoft"** button.

### World export

`_world_path()` resolves `DATA_DIR/<worldOutputDir>` and aborts with 400 if the resolved path escapes `DATA_DIR`. `/api/download` zips (default) or tars (`fmt=tar`) the world in-memory and streams it. `/api/export-dir` copies the world to `DATA_DIR/exports/<name>-<utc-timestamp>` so it can be retrieved from the mounted volume. `/api/world-info` reports existence, byte size, and file count.

### Front-end (dashboard.html)

The dashboard is a single page with inline JS. The configuration form is grouped into **collapsible `<details>` accordion sections** (only the first is open) whose fields lay out in a responsive grid, so the long option list isn't one big scroll; the primary Start/Stop/Restart/Save bar is **sticky** to the viewport bottom while the form is in view. Inputs (including the bot panel's account `<select>`, username, radius, etc.) all use the same Material-style outlined floating-label fields. It polls `api/status` + `api/logs` every 1.5s, `api/world-info` every 5s, and `api/bot/status` + `api/bot/logs` every 2s (bot logs prefixed `[bot]` in the shared log pane). It disables config inputs while the downloader is running, drives the Microsoft device-code flow with a 4s polling loop, **auto-copies the bot's device code** when it appears, and shows the export section only once a world exists.

### Health check

`/healthz` (not login-gated) returns `{ok, running}` and is used by the Dockerfile `HEALTHCHECK`.

## Key files

- `web/app.py` — the entire Flask app: option schema, config persistence, `Downloader`/`BotManager`/`AuthStore` classes, console login, and all routes (dashboard, status/logs, start/stop/restart, auth, world download/export, map, bot, healthz).
- `web/auth.py` — Minecraft account authentication: Microsoft device-code flow, Xbox Live → XSTS → Minecraft token chain, token refresh, and profile lookup.
- `web/templates/dashboard.html` — the single-page dashboard UI (config form, account card, bot panel, log pane) plus all polling/control JavaScript.
- `web/templates/login.html` — the console username/password sign-in page (only used when login is enabled).
- `web/templates/map.html` — the live overview-map page rendered by `/map`.
- `web/requirements.txt` — Python deps: `Flask`, `waitress`, `requests`.
- `web/static/style.css`, `web/static/a11y.js` — dashboard styling and accessibility helper.
- `Dockerfile` — builds the jar (Maven/Temurin 21), installs Python + Node, copies `web/` and `scraper/`, sets `JAR_PATH`/`DATA_DIR`/`WEB_PORT`, exposes 8080/25565, and runs `python3 /app/web/app.py` as entrypoint.
- `docker-compose.yml` — service definition mapping ports 8080/25565, mounting `./data:/data`, and documenting the optional `WEB_USERNAME`/`WEB_PASSWORD`/`SECRET_KEY` env vars (plus an optional BlueMap profile).

## Configuration / flags

The console is configured via **environment variables** (read in `app.py` / `auth.py`):

- `WEB_USERNAME` — dashboard login user (default `admin`).
- `WEB_PASSWORD` — dashboard login password. **Empty by default**, which disables the console login entirely (`LOGIN_ENABLED = bool(PASSWORD)`). Set it to gate the dashboard.
- `WEB_PORT` — port the web UI listens on (default `8080`).
- `SECRET_KEY` — Flask session secret. If unset, a key is generated and persisted to `DATA_DIR/.secret_key` (chmod 0600).
- `JAR_PATH` — path to `world-downloader.jar` (default `/app/world-downloader.jar`).
- `DATA_DIR` — working dir for worlds, cache, and saved settings (default `/data`).
- `SCRAPER_DIR` — directory containing `scrape.js` for the auto-explore bot (default `/app/scraper`).
- `MS_CLIENT_ID` — Microsoft OAuth client id (default `00000000402b5328`, the public launcher id).
- `MS_DEVICE_CODE_URL`, `MS_TOKEN_URL`, `MS_SCOPE` — overridable Microsoft OAuth endpoints/scope for the device-code flow.

The **downloader's own options** are not console env vars; they are the `OPTIONS` schema rendered as the dashboard config form and translated into `world-downloader.jar` CLI flags by `build_command()` (e.g. `--server`, `--local-port`, `--output`, `--extended-render-distance`, `--auto-open-containers`, `--auto-reply`, etc., always with `--no-gui` and headless AWT). These are persisted to `DATA_DIR/manager-config.json`.

## Usage

Typical flow (matching `docker-compose.yml`):

1. `docker compose up -d` (builds the image, starts the container). The console is published on `http://localhost:8080` and the Minecraft proxy on `localhost:25565`; `./data` is mounted to `/data`.
2. (Optional) To protect the console, set `WEB_USERNAME` + `WEB_PASSWORD` (and ideally `SECRET_KEY`) in the compose environment before starting; then sign in at `/login`.
3. Open the dashboard. Under **Minecraft account**, sign in with Microsoft (open the shown `microsoft.com/link`, enter the code), paste an access token, or enter an offline username — required for online-mode servers.
4. Fill in **Configuration** (at minimum the server address), then press **Save** (persist only) or **Start** (save + launch the downloader).
5. Point your Minecraft client at `this-host:<published proxy port>` (default 25565) and play; chunks download as you explore. The proxy always listens on 25565 inside the container; the "Proxy port (host)" field is just the host-side mapped port shown in the connect hint.
6. Watch live status and logs in the page; optionally open **Map** for the live overview, or start an **Auto-explore bot** to fill the area automatically.
7. Use **Stop**/**Restart** as needed. When done, download the world as `.zip`/`.tar.gz`, or use **Export directory** to drop a snapshot into `./data/exports`; the live world is also directly at `./data/<worldOutputDir>` on the host.

## Verification

- The console is shipped and wired into the container: the `Dockerfile` installs `web/requirements.txt`, copies `web/`, and runs `python3 /app/web/app.py` as `ENTRYPOINT`, with a `HEALTHCHECK` hitting `/healthz`. `docker-compose.yml` publishes and mounts it. This confirms the integration path at the packaging level.
- A compiled bytecode artifact (`web/__pycache__/app.cpython-312.pyc`) is present, indicating the module has been imported/run in a Python 3.12 environment.
- This document was produced by reading the actual source (`web/app.py`, `web/auth.py`, the templates, `Dockerfile`, `docker-compose.yml`, `web/requirements.txt`); behaviour described is taken directly from that code.
- No automated unit/integration tests for the web console were found in the files reviewed, so console behaviour beyond the above should be treated as compile/run-verified rather than test-covered. (The repo's MEMORY notes a separate live Paper+mineflayer integration harness, which is relevant to the downloader/bot but not specifically a test of these Flask routes.)

## Gotchas & limitations

- **Console login is OFF by default.** With no `WEB_PASSWORD`, every route except the explicit login page is open. Anyone who can reach port 8080 can drive the downloader, read logs, change settings, sign in/out Minecraft accounts, and download the world. Set `WEB_PASSWORD` (and `SECRET_KEY`) before exposing it beyond localhost.
- **No CSRF protection / no per-action auth on the API.** API routes rely solely on the session check; there is no CSRF token.
- **Single global downloader and single global bot manager.** Only one downloader process and one bot process can run at a time (`start()` refuses if already running); the app is not multi-tenant.
- **Logs are in-memory and bounded** (`deque` maxlen 5000 for the downloader, 3000 for the bot). Older lines are dropped and nothing is persisted to disk; a restart loses history. Restart/stop also resets the browser's log view.
- **The `OPTIONS` table is hand-maintained** to mirror `config/Config.java`. If a new CLI flag is added to the Java side, it will not appear in the console until this list is updated — there is no automatic sync.
- **`markOldChunks` defaults true and `disableMarkUnsavedChunks` exist as options**, but several map defaults are "on by default" in the downloader; the console only emits flags it generates from the form, so toggling some on/off depends on the underlying jar's flag semantics.
- **Microsoft token refresh happens lazily at launch** (only when older than 20h and a refresh token exists). A stale token without a refresh token will fail at start time and surface as an "Account error" 409.
- **The container-internal proxy port is fixed at 25565** (`CONTAINER_PROXY_PORT`). The "Proxy port (host)" field is display-only — it does not move the listener (which must stay on the port Docker publishes). To change the host-side port, change the `-p <hostPort>:25565` mapping in the desktop manager / compose, not this field.
- **The auto-explore bot is only available if `scrape.js` exists in the image** (`start()` returns "Bot is not available in this image" otherwise). It connects to `127.0.0.1:25565` (the fixed internal proxy port), so the downloader must be running first.
- **Pending Microsoft device-code flows are stored in-memory** (`auth._flows`); a console restart cancels any in-progress sign-in.
- **Path safety** for world download/export and map tiles is enforced via `normpath` + prefix checks; this assumes `DATA_DIR` itself is trusted.

## Open items

None known.
