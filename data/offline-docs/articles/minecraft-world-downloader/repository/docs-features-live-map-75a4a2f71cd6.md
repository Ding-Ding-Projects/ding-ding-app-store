# Live overview map (headless + web)

> A JavaFX-free, top-down PNG region-tile renderer that lets the web console show a live, pannable map of the world as it downloads — without the desktop GUI.

## What it does

While the downloader runs, it renders a top-down overview of every loaded chunk into PNG "region tiles" on disk, plus a small `meta.json` index. The Flask web console reads those files and draws a live, pannable/zoomable map in the browser (`/map`). The map updates as you explore: new chunks appear, the player marker tracks position, and you can switch between dimensions and between a surface ("normal") and a "caves" render mode.

The whole pipeline is designed to work headless. The downloader is launched with `-Djava.awt.headless=true` and `--no-gui`, and the renderer uses only `java.awt`/`ImageIO` (no JavaFX toolkit), so it works in Docker / `--no-gui` runs where the desktop GUI map is unavailable. It deliberately reuses the *exact* per-block colours the GUI map uses, by sharing `ChunkImageFactory.computeArgb`, so the headless tiles look identical to the desktop map.

## How it works

### Java side: rendering tiles to disk

The renderer is a singleton, `game.data.map.OverviewMap` (`getInstance()`).

- **Hookup.** When a chunk is parsed/loaded, `WorldManager` notifies both the GUI and the overview map:
  ```java
  GuiManager.setChunkLoaded(coord, chunk);
  game.data.map.OverviewMap.getInstance().setChunkLoaded(coord, chunk);
  ```
  This happens in `WorldManager.loadChunk(...)` (via `chunk.whenParsed(...)`) and in the chunk-redraw path around lines 274–276.
- **Enablement gate.** `OverviewMap.isEnabled()` returns `Config.renderOverviewMap()`, which is `(renderMap || disableGui) && !disableMapRender` — i.e. on automatically in headless mode, also forceable with `--render-map`, and disableable with `--disable-map-render`. If disabled, `setChunkLoaded` returns immediately and nothing is rendered.
- **Pixel callback (JavaFX-free).** `setChunkLoaded` calls `start()` (lazy, idempotent), then registers a pixel callback on the chunk's `ChunkImageFactory` and requests an image:
  ```java
  factory.onPixels((pixelMap, saved) -> blit(coord, pixelMap));
  factory.requestImage();
  ```
  `ChunkImageFactory.onPixels(...)` is the headless counterpart to `onComplete(...)`: where `onComplete` produces JavaFX `Image`s, `onPixels` delivers a `Map<ImageMode, int[]>` of raw 16×16 ARGB pixel arrays. In `generateImages()`, if a pixel consumer is registered, the factory computes `NORMAL` and `CAVES` via `computeArgb(true)` / `computeArgb(false)` and hands them to the consumer. `computeArgb` is pure Java (the shared colour code: surface/cave colour selection, transparency blending, north/south height shading, new-chunk highlighting), so it never touches the JavaFX toolkit.
- **Blitting into region buffers.** `blit(...)` maps the chunk's coordinates to a region tile and an in-tile offset:
  - Tile size: `REGION_PX = 512` px = 32×32 chunks (`CHUNK_PX = 16`, `CHUNKS_PER_REGION = 32`).
  - Region index: `rx = floorDiv(cx, 32)`, `rz = floorDiv(cz, 32)`; in-tile offset `ox/oz = floorMod(...) * 16`.
  - For each mode (`NORMAL`, `CAVES`) it `obtain(...)`s the region's `int[512*512]` buffer and `System.arraycopy`s the 16 rows of chunk pixels into place, then marks the tile key dirty and "known". Buffer keys are `dim|MODE|rx|rz`.
  - The whole method is wrapped in `try/catch` that swallows everything — map rendering must never interfere with the actual download.
- **In-memory buffer cache (LRU).** `buffers` is an access-ordered `LinkedHashMap` capped at `MAX_BUFFERS = 96` (~1 MB each). `obtain(...)` returns a live buffer, loading an existing tile PNG from disk if present (`loadTile`) or allocating a fresh transparent buffer. When over cap, the eldest entry is evicted and, if dirty, flushed to disk first.
- **Periodic flush.** `start()` spins up a single daemon thread `overview-map-flush` that runs `flush()` every `FLUSH_INTERVAL_MS = 3000` ms, and registers a JVM shutdown hook to flush on exit. `flush()` snapshots dirty buffers under a lock (cloning them so disk I/O happens outside the lock), writes each as a PNG via `writeTile`, and (re)writes `meta.json`. All flush failures are swallowed (`flushSafe`) so a failed flush can never crash the downloader.
- **Disk layout.** Tiles live under `<output>/overview/<dimension>/<mode>/r.<rx>.<rz>.png`, where `<output>` is `Config.getWorldOutputDir()`, `<mode>` is `normal` or `caves`, and `<dimension>` is sanitised by `safe(...)` (any char outside `[a-zA-Z0-9._-]` becomes `_`, e.g. `minecraft:overworld` → `minecraft_overworld`). Each tile is a 512×512 `TYPE_INT_ARGB` PNG.
- **The index (`meta.json`).** `writeMeta()` writes `<output>/overview/meta.json`, hand-built as JSON containing:
  - `regionPx` (512), `chunkPx` (16), `updated` (epoch millis — used by the client as a cache-buster/version),
  - `currentDimension` (sanitised name from `WorldManager`, or `null`),
  - `player` (`{x,y,z}` from `WorldManager.getPlayerPosition()`, or `null`),
  - `tiles`: a nested map `dimension -> mode -> [[rx,rz], ...]` built from `knownTiles` (so it doesn't need to scan the disk).

### Web side: serving and drawing

Flask app `web/app.py` serves the map under the same login gate as the rest of the console (`login_required`):

- `GET /map` (`map_view`) renders `web/templates/map.html`.
- `GET /map/meta.json` (`map_meta`) serves `<world>/overview/meta.json` with `Cache-Control: no-cache`; if the file doesn't exist yet it returns an empty stub (`{regionPx:512, chunkPx:16, updated:0, currentDimension:null, player:null, tiles:{}}`).
- `GET /map/tile/<dim>/<mode>/<rx>/<rz>.png` (`map_tile`) serves an individual tile. It validates `mode ∈ {normal, caves}`, requires `dim` to match `[A-Za-z0-9._-]+`, parses `rx`/`rz` as ints, and normalises the path and checks it stays inside the overview dir (path-traversal guard) before sending the PNG with `Cache-Control: no-cache`.
- The world/overview path comes from `_world_path()` → `<DATA_DIR>/<worldOutputDir>/overview`, with a guard that the resolved world path stays under `DATA_DIR`.

`web/templates/map.html` is a single-file canvas app (no map library):

- **Polling.** `pollMeta()` fetches `/map/meta.json` (`cache: no-store`) on load and every 3000 ms. It tracks `meta.updated` as `state.version` and uses it as a `?v=` cache-buster on tile URLs so updated tiles are re-fetched. A "live · N tiles" / "waiting for tiles…" badge reflects the total tile count.
- **Rendering.** A custom canvas renderer keeps a camera (`camX/camZ` world coords at screen centre) and `scale` (pixels per block). `draw()` computes the visible region range (with a 1-region margin), pulls each known tile via `getTile()` (a cached `Image` keyed by `rx,rz` and version), and draws it at `REGION (512) * scale`. `imageSmoothingEnabled` is on only when zoomed out (`scale < 1`). The player is drawn as a green dot only when the selected dimension equals `meta.currentDimension`.
- **Controls.** Top bar: a dimension `<select>` (populated from `meta.tiles` keys, prettified by stripping a `minecraft_` prefix and replacing `_` with spaces) and a Surface/Caves segmented toggle (`state.mode`). Bottom-left card: zoom in/out (`scale` clamped to `[0.05, 8]`), reset view, and a "follow player" toggle (default on). Bottom-right: a live `x, z` coordinate readout under the cursor. Mouse drag pans (and turns follow off); wheel zooms around the cursor.
- **Centering.** On first load (and on dimension/mode change / reset) it centres on the player if in the current dimension, otherwise on the centroid of available tiles.

### Version branching

There is no Minecraft-version branching specific to this feature. Version differences are absorbed upstream by the chunk/colour layer (`ChunkImageFactory.computeArgb` and the block-state/palette code it calls); the overview renderer only consumes the resulting ARGB pixels. The only mode branching is the two render modes (`ImageMode.NORMAL` / `ImageMode.CAVES`), and a dimension branch inside `computeArgb` (Nether uses the "ignore bedrock" surface variant rather than the cave colouring).

## Key files

- `src/main/java/game/data/map/OverviewMap.java` — the headless renderer: chunk → region-tile blitting, LRU buffer cache, periodic/shutdown flush, PNG tile + `meta.json` writing, disk layout.
- `src/main/java/game/data/chunk/ChunkImageFactory.java` — produces the per-chunk pixels; `onPixels(...)` callback and `computeArgb(boolean)` are the JavaFX-free path shared with the GUI map.
- `src/main/java/game/data/WorldManager.java` — wires `OverviewMap.getInstance().setChunkLoaded(...)` into chunk load/redraw, alongside the GUI map.
- `src/main/java/config/Config.java` — `renderMap`, `disableGui`, `disableMapRender` flags and the `renderOverviewMap()` gate; `getWorldOutputDir()`.
- `src/main/java/gui/images/ImageMode.java` — the `NORMAL` / `CAVES` enum used as the per-mode key.
- `web/app.py` — Flask routes `/map`, `/map/meta.json`, `/map/tile/<dim>/<mode>/<rx>/<rz>.png`, path/traversal guards.
- `web/templates/map.html` — the browser map: canvas renderer, meta polling, tile fetching, pan/zoom/follow controls, dimension/mode switching.
- `web/templates/dashboard.html` — the "Map" link into `/map` from the console.

## Configuration / flags

CLI flags (defined in `config/Config.java`):

- `--render-map` — force the overview-map rendering on. Enabled automatically in `--no-gui` mode, so this flag is only needed to render tiles while also showing the desktop GUI.
- `--disable-map-render` — turn the overview-map rendering off, even when running headless. Exposed in the web console as the "Disable live map" option.
- `--no-gui` (`disableGui`) — disables the desktop GUI; as a side effect it turns the overview-map rendering on (unless `--disable-map-render` is set). The web console always launches the downloader with `--no-gui`.

Gate logic: `renderOverviewMap() == (renderMap || disableGui) && !disableMapRender`.

Related options that affect what the tiles look like (they feed `ChunkImageFactory`/colour code, not the overview renderer directly): `--mark-new-chunks` (orange outline on new chunks), `--mark-old-chunks` (on by default), `--disable-modded-block-colors`. There are no overview-map-specific flags for tile size, output sub-path, flush interval, or buffer cap — those are compile-time constants (`REGION_PX=512`, `FLUSH_INTERVAL_MS=3000`, `MAX_BUFFERS=96`).

Output location: tiles and `meta.json` are written under `<worldOutputDir>/overview/...`. There is no separate flag to relocate just the overview output; it follows `--output`.

Web environment variables relevant to serving the map (from `web/app.py`): `DATA_DIR` (working dir that contains `<worldOutputDir>`), `WEB_PORT`, and the console login gate `WEB_USERNAME` / `WEB_PASSWORD` (the map routes are behind `login_required`).

## Usage

Headless / web-console (the intended path):

1. Run the web console (`web/app.py`, the container's main process). Open it in a browser and authenticate the Minecraft account.
2. Start the downloader from the dashboard. The console launches it with `java -Djava.awt.headless=true -jar ... --no-gui`, which turns overview rendering on by default.
3. Connect your Minecraft client through the downloader's proxy and explore. Tiles render to `<world>/overview/...` and `meta.json` is refreshed roughly every 3 s.
4. Click "Map" in the dashboard (links to `/map`). Pan by dragging, zoom with the wheel or +/− buttons, switch dimension via the dropdown, toggle Surface/Caves, and use "follow player" to keep the camera on you.

Standalone CLI (no web console): run the jar with `--no-gui --server <host>` (overview rendering on automatically), or with the GUI plus `--render-map` to also produce tiles. The PNG tiles and `meta.json` then exist under `<output>/overview/` and could be served by any static file server, but the bundled viewer is the Flask `/map` page.

## Verification

- Compile-time: the feature is plain `java.awt`/`ImageIO` and standard Flask; it builds with the project (JDK 21 per the project's build environment).
- Behaviour grounded in code review of the files above; no dedicated unit test for `OverviewMap` was found in this pass.
- Robustness is built in defensively rather than via tests: `blit`, `flushSafe`, `writeTile`, `loadTile`, and `writeMeta` all swallow their exceptions so map rendering cannot crash or slow the download; the web tile/meta routes validate inputs and guard against path traversal.
- The project's live integration harness (Paper + mineflayer, under `C:/Users/cntow/mcwdtest`) exercises the downloader end-to-end and is the appropriate place to confirm tiles actually populate and the `/map` page renders against a real session; treat full end-to-end map verification as integration-tested there rather than asserted from this doc.

## Gotchas & limitations

- **Headless-only by design.** The overview tiles are produced by the headless renderer. With the desktop GUI you must pass `--render-map` to get tiles; otherwise only the in-window JavaFX map is drawn.
- **Eventual consistency / ~3 s lag.** Tiles and `meta.json` are flushed on a 3 s timer (and on shutdown), and the browser polls every 3 s. Freshly explored chunks can take a few seconds to appear; in-memory edits not yet flushed are not visible to the web client.
- **Two fixed render modes only.** `NORMAL` and `CAVES`. The Nether is rendered with the surface (ignore-bedrock) variant inside `computeArgb`, not the cave path.
- **Dimension names are sanitised for the filesystem**, so the web UI shows the sanitised id (e.g. `minecraft_overworld`), only prettified by stripping `minecraft_` and swapping underscores for spaces.
- **Buffer cap can cause repeated tile re-reads.** With more than 96 hot region tiles, evicted-then-touched-again tiles are reloaded from PNG on the next `blit`, adding disk I/O when ranging across a very wide area quickly.
- **`meta.json` is hand-rolled JSON.** It is built by string concatenation rather than a JSON library; it relies on sanitised dimension names to stay valid and is not pretty-printed.
- **No tile pruning / size management.** Tiles accumulate under `<output>/overview/` for the life of the world; nothing deletes stale tiles, and there is no zoom-pyramid (a single full-resolution layer is scaled in the browser).
- **Player marker only in the current dimension.** If you switch the viewer to a dimension other than the player's current one, no player dot is shown.
- **Web map routes are gated by the console login**, but tiles themselves are served as-is from disk; anyone with console access can view the full explored map.

## Open items

None known.
