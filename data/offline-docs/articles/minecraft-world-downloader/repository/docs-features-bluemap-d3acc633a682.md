# BlueMap 3D map pipeline

> Turns a downloaded Minecraft world into an interactive 3D web map by optionally upgrading the world with a temporary server, rendering it with the BlueMap CLI, and serving it over BlueMap's webserver.

## What it does

The BlueMap pipeline (`bluemap/pipeline.py`) takes a world saved by the world-downloader and produces a self-contained, browsable 3D web map. It wraps the standalone [BlueMap](https://github.com/BlueMap-Minecraft/BlueMap) CLI jar and orchestrates four operations exposed as subcommands:

- `fetch-bluemap` — download the pinned BlueMap CLI jar.
- `upgrade` — run a temporary Paper/vanilla server with `--forceUpgrade --safeMode` to upgrade the saved world to the latest data format, then stop it automatically.
- `render` — generate/patch BlueMap config and render the world into a web map (`index.html` + `maps/`).
- `serve` — host the rendered map with BlueMap's integrated webserver.
- `all` — optional upgrade, then render, then optionally serve.

It is also packaged as an optional Docker service that renders the downloaded world once, serves it on a port, and re-renders periodically so the map follows new downloads.

The upgrade step exists because a freshly-downloaded world may be in an older data format than BlueMap expects; running it through a server's `--forceUpgrade` brings chunks and `level.dat` up to the current format. BlueMap supports Minecraft 1.13+, with 3D rendering best on 1.18+ worlds (the stated focus).

## How it works

Entry point is `main()` in `bluemap/pipeline.py`, an `argparse` CLI dispatching on a positional `command`. After parsing, `--workdir` is resolved to an absolute path and created. The workdir is the default home for the downloaded jar, BlueMap config, BlueMap data, and the rendered webroot.

**Java resolution.** `java_bin(explicit)` returns `--java` if given, else `$JAVA_HOME/bin/java[.exe]` if that file exists, else the bare `java` on PATH.

**fetch / ensure jar.** `fetch_bluemap(version, dest)` downloads `bluemap-{v}-cli.jar` from the BlueMap GitHub releases URL via `urllib.request.urlretrieve`. `ensure_bluemap(args)` returns `--bluemap-jar` if it points at an existing file; otherwise it computes `bluemap-{version}-cli.jar` under the workdir and downloads it if missing. The default version is pinned to `DEFAULT_BLUEMAP_VERSION = "5.16"` — the comment notes this is the last BlueMap release that runs on Java 21 (5.17+ require Java 25); override with `--bluemap-version`.

**1. upgrade (`upgrade`).** Validates the world dir and requires `--server-jar`. Two modes:
- Default (copy): copies the world into `<workdir>/upgrade-server/world` (removing any prior copy first); `level-name` is `world`.
- `--in-place`: upgrades the world in its own directory; `level-name` is the world folder's basename.

Before launching, it removes the stale `session.lock` and handles the downloader's version-specific `downloaded` datapack: in copy mode the `datapacks` directory is deleted from the working copy; in `--in-place` mode it is moved aside to `datapacks.bak` and restored after the run. This is because that datapack is a snapshot of the source server's registry and won't load on a different server version, which would otherwise abort the upgrade (`--safeMode` additionally makes the server ignore the `level.dat` reference to it).

It writes `eula.txt` (`eula=true`) and a `server.properties` bound to `127.0.0.1` on a free OS-assigned port (chosen by binding a socket to port 0), with `online-mode=false`, `max-players=1`, rcon/query disabled. It then runs `java -Xmx2G -jar <server-jar> --nogui --forceUpgrade --safeMode` via `subprocess.Popen` with `cwd` set to the server dir, streaming the server's combined stdout/stderr prefixed with `  [server]`. It watches output for upgrade-activity markers (e.g. `forcing world upgrade`, `upgrading`, `optimiz`, `% completed`, `% finished`) to set a diagnostic flag, and for startup-complete markers (`done (` or `for help, type`) at which point it writes `stop\n` to the server's stdin for a clean shutdown that flushes upgraded chunks and `level.dat`. After exit it restores moved datapacks (in-place mode) and, unless `--allow-nonzero`, raises on a non-zero exit code. Returns the upgraded world path.

**2. render (`render`).** Validates the world dir, resolves the jar, loads settings, and computes three locations: config dir (`--config` or `<workdir>/bluemap-config`), webroot (`--out` or `<workdir>/bluemap-web`), and data dir (`<workdir>/bluemap-data`). Steps:
1. If `core.conf` is absent in the config dir, generate BlueMap's default config by running `java -jar <jar> -c <cfg_dir>`.
2. Patch HOCON-style config files via `patch_file` / `set_conf` (regex replacement of an existing or commented `key: value` line, appending if absent; booleans/strings/numbers formatted appropriately):
   - `core.conf`: `accept-download`, `render-thread-count`, `data` (the data dir), `metrics: false`.
   - `webapp.conf`: `enabled: true`, `webroot`.
   - `webserver.conf`: `enabled`, `webroot`, `port`.
   - `storages/file.conf` (if present): `root` set to `<webroot>/maps`, so the webapp finds the rendered tiles (BlueMap's default root is a cwd-relative `web/maps`).
3. Per-dimension maps under `<cfg_dir>/maps/`. For each of `overworld`, `nether`, `end` that has a `.conf`: if the dimension is not in the selected `dimensions` set or is not present on disk (`dimension_exists` checks for `.mca` files in `region`, `DIM-1/region`, `DIM1/region` respectively), its `.conf` is deleted; otherwise the conf is patched with `world`, `ambient-light`, `sky-color`, `render-edges`, `save-hires-layer`, `min-y`, `max-y`. (Settings whose value is `None`/`null` are skipped by `patch_file`.)
4. Render with `java -jar <jar> -c <cfg_dir> -r`. On the first run BlueMap downloads the Minecraft client jar for textures. Unless `--allow-nonzero`, a non-zero exit raises.

All Windows path separators written into config are normalized to forward slashes.

**3. serve (`serve`).** Resolves java, jar, and config dir, then runs `java -jar <jar> -c <cfg_dir> -w` (BlueMap's integrated webserver). This call blocks/foregrounds the server.

**all.** If `--server-jar` is given, runs `upgrade` and uses its returned path as the world; then `render`; then, if `--serve`, `serve`.

**Settings.** `load_settings(path)` starts from `DEFAULT_SETTINGS` and shallow-merges a JSON file if provided. Defaults: `acceptDownload=True`, `renderThreadCount=0` (auto = cpu-1), `webserverPort=8100`, `webserverEnabled=True`, `dimensions=["overworld","nether","end"]`, `ambientLight=0.1`, `skyColor="#7dabff"`, `renderEdges=True`, `saveHiresLayer=True`, `minY=None`, `maxY=None`.

**Docker flow.** `bluemap/Dockerfile` builds on `eclipse-temurin:21-jre`, installs `python3` + `ca-certificates`, copies `pipeline.py` and `docker-entrypoint.sh`, sets `WORLD_DIR=/data/world`, `BLUEMAP_PORT=8100`, `WORKDIR=/data/bluemap`, and exposes 8100. `docker-entrypoint.sh` writes a minimal `settings.json` (only `acceptDownload`, `renderThreadCount`, `webserverEnabled`, `webserverPort`), waits (polling every 5s) until `$WORLD_DIR` exists, runs `pipeline.py render` once with `--allow-nonzero`, launches a background loop that re-renders every 900s (15 min), and then `exec`s `pipeline.py serve`. The Docker path does not invoke the `upgrade` step.

## Key files

- `bluemap/pipeline.py` — the entire pipeline CLI: fetch / upgrade / render / serve / all, config patching, settings handling.
- `bluemap/Dockerfile` — Temurin 21 JRE image bundling `pipeline.py` and the entrypoint; serves BlueMap on port 8100.
- `bluemap/docker-entrypoint.sh` — container runtime: write settings, wait for world, render once, re-render every 15 min, serve.
- `bluemap/settings.example.json` — example of the BlueMap-controllable settings file consumed by `--settings`.
- `bluemap/README.md` — user-facing overview, requirements, usage, settings table, Docker note, and verification notes.
- `docker-compose.yml` — defines the optional `bluemap` service (profile `bluemap`) building from `bluemap/Dockerfile`, mapping port 8100, mounting `./data`.

## Configuration / flags

CLI (`bluemap/pipeline.py`):
- positional `command` — one of `fetch-bluemap`, `upgrade`, `render`, `serve`, `all`.
- `--world` — path to the downloaded world.
- `--server-jar` — Paper/vanilla server jar for `--forceUpgrade` (required for `upgrade`).
- `--bluemap-jar` — path to an existing BlueMap CLI jar (downloaded if omitted).
- `--bluemap-version` — BlueMap version to download (default `5.16`).
- `--out` — webroot output directory for the rendered map.
- `--config` — BlueMap config directory.
- `--settings` — `settings.json` with BlueMap options.
- `--workdir` — working directory for config/data/jar (default current directory).
- `--java` — path to java (defaults to `$JAVA_HOME/bin/java`, else `java`).
- `--in-place` — upgrade the world in place (no copy).
- `--serve` — for `all`: serve after rendering (stored as `then_serve`).
- `--allow-nonzero` — don't fail on non-zero exit codes.

Settings keys (`--settings`, defaults in `DEFAULT_SETTINGS`): `acceptDownload`, `renderThreadCount`, `webserverPort`, `webserverEnabled`, `dimensions`, `ambientLight`, `skyColor`, `renderEdges`, `saveHiresLayer`, `minY`, `maxY`.

Environment variables (Docker/entrypoint): `WORLD_DIR`, `WORKDIR`, `BLUEMAP_PORT` (entrypoint), `JAVA_HOME` (used by `java_bin`).

## Usage

Direct CLI (from `bluemap/README.md`):

```bash
# download the BlueMap CLI jar (pinned to a Java-21-compatible version)
python pipeline.py fetch-bluemap --workdir ./bm

# upgrade a downloaded world to the latest format (optional but recommended)
python pipeline.py upgrade --world /data/world --server-jar paper.jar --workdir ./bm

# render the (upgraded) world to a web map
python pipeline.py render --world ./bm/upgrade-server/world --out ./bm/web --workdir ./bm

# do it all at once and serve it
python pipeline.py all --world /data/world --server-jar paper.jar --out ./bm/web --workdir ./bm --serve

# serve an already-rendered map
python pipeline.py serve --config ./bm/bluemap-config --workdir ./bm
```

The rendered web map is self-contained under `--out` (`index.html` + `maps/`); it can be served by `serve`, any static file server, or the world-downloader web console.

Docker:

```bash
docker compose --profile bluemap up -d bluemap
```

This renders `./data/world` and serves the map at `http://localhost:8100`, re-rendering every 15 minutes.

## Verification

Per `bluemap/README.md`, the `upgrade` (Paper `--forceUpgrade`) and `render` (BlueMap 5.16) steps were tested end-to-end on a downloaded 1.20.4 world: the upgrade to 1.21.11 completed and stopped cleanly, and BlueMap produced a self-contained web map. This is an integration-level verification of the upgrade + render path. There is no automated test suite in this directory for the pipeline; the Docker `serve` loop and `all --serve` ordering are not noted as separately verified.

## Gotchas & limitations

- **Java version coupling.** The default BlueMap `5.16` is pinned because 5.17+ require Java 25; the Docker image is Java 21. Bumping `--bluemap-version` past 5.16 needs a newer Java.
- **Upgrade requires a server jar.** Without `--server-jar`, `upgrade` aborts; `all` silently skips the upgrade and renders the world as-is.
- **Datapack stripping.** The downloader's version-specific `downloaded` datapack is removed (copy mode) or moved aside (in-place); in `--in-place` mode an interrupted run could leave a `datapacks.bak` directory if restore fails.
- **Upgrade detection is heuristic.** Stop is triggered on log strings (`done (`, `for help, type`); a server whose output differs may not be stopped automatically. The "upgrade activity detected" flag is diagnostic only and does not gate success.
- **First render needs network.** BlueMap downloads the Minecraft client jar for textures; `acceptDownload` must be true.
- **Config root co-location.** BlueMap's default storage root is cwd-relative `web/maps`; the pipeline patches `storages/file.conf` to point at `<webroot>/maps`, but only if that file exists in the generated config.
- **Dimension paths assume vanilla layout.** `dimension_exists` looks for `region`, `DIM-1/region`, `DIM1/region`; non-standard dimension folders are not detected/rendered.
- **Settings merge is shallow.** A provided `settings.json` overrides whole keys; there is no deep merge.
- **Docker path does not upgrade.** The container only renders and serves; worlds needing a format upgrade must be processed via the CLI `upgrade`/`all` path.

## Open items

- The README states the rendered map links from "the world-downloader web console," but no reference to BlueMap or port 8100 was found in the Java/HTML/JS sources — the linkage appears to be manual/documentation-only rather than code-backed.
