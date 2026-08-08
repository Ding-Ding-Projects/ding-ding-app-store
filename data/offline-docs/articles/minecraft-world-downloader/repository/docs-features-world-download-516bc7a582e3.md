# World download & saving

> Captures chunk columns streamed from a Minecraft server as the player explores and writes them to a standard, openable Minecraft save (region/entity MCA files plus `level.dat`).

## What it does

As the proxy relays packets between client and server, every chunk-data packet the server sends is intercepted, parsed into an in-memory chunk, grouped into 32x32-chunk regions, and periodically flushed to disk in the vanilla Anvil (`.mca`) region-file format. The result is a normal Minecraft world directory (default `world/`, with per-dimension `region/` and `entities/` subfolders and a `level.dat`) that can be opened in the game.

Beyond raw blocks and biomes, the saver also captures and preserves:

- Block entities (chests, barrels, furnaces, lecterns, jukeboxes, banners, command blocks, etc.) and their contents.
- Container inventories (`Slot` items) merged into the owning block entity's NBT.
- Entities, written to a separate `entities/` MCA file for 1.17+ worlds.
- Saved-content carry-over: when a chunk is re-sent (usually with empty containers) or revisited in a later session, previously captured inventories/contents are preserved rather than overwritten with empties.

## How it works

Flow, from packet to disk:

1. **Ingest (`ChunkFactory.addChunk`)** — A chunk-data packet handler hands the raw `DataTypeProvider` to `ChunkFactory`. Work runs on a single-threaded `ThreadPoolExecutor` ("Chunk Parser Service") so parsing is serialized and the queue size is observable. If `WorldManager` is paused, the chunk is discarded. The chunk's `(x, z)` is read and stored as an `UnparsedChunk` keyed by `CoordinateDim2D`; data that can arrive separately (tile entities, light) is buffered on that `UnparsedChunk` until the chunk body shows up (or it goes stale after `MAX_WAIT_TIME` = 10s).

2. **Version selection (`ChunkFactory.getVersionedChunk`)** — `VersionReporter.select` picks a concrete `Chunk` subclass by data version: `Chunk_26_1` (1.21.5–1.21.11, array-format heightmaps), `Chunk_1_20`, `Chunk_1_18`, `Chunk_1_17`, `Chunk_1_16`, `Chunk_1_15`, `Chunk_1_14`, `Chunk_1_13`, `Chunk_1_12` (also reused for 1.9–1.11), and `Chunk_1_8` (older direct block-array format). 1.8 Map-Chunk-Bulk packets take a separate path (`ChunkFactory.addBulkChunks` -> `Chunk_1_8.readBulkColumn`).

3. **Parse (`Chunk.parse(DataTypeProvider)` / `Chunk.readChunkColumn`)** — Reads the full/partial flag, the section bitmask, heightmaps (1.14+), 3D biome data (full chunks), then each present chunk section: block count, bits-per-block, palette, block long-array, and lights (sky light skipped in the Nether). Finally block entities are parsed via `parseBlockEntities`. A non-full chunk is flagged "new" (used by the mark-new-chunks overlay). Chunks can also be parsed from NBT (`Chunk.parse(Tag)` / `ChunkFactory.fromNbt`) when reading existing files back from disk.

4. **Register (`WorldManager.loadChunk`)** — The parsed chunk is placed into its `Region` (`region = chunkToDimRegion`), created on demand. Before a fresh chunk is parsed, `ChunkFactory.parseChunk` seeds its block entities from any on-disk copy (`WorldManager.getSavedChunkNbt` -> `seedBlockEntitiesFromDisk`) so a re-sent empty container doesn't unsave a previously captured inventory. Saved region files read back for this purpose are held in a small bounded LRU (max 4) in `WorldManager`.

5. **Block entities & inventories (`ChunkEntities`)** — `addBlockEntity` normalizes/repairs the entity id, offsets coordinates by the configured world center, and preserves a fixed set of content fields (`Items`, `Item`, `Book`, `RecordItem`, `CustomName`, `Lock`, `LootTable`, `LootTableSeed`) across re-sends. `addInventory` merges captured container slots (`Slot.toNbt`) into the block entity (a lectern stores a single `Book`; everything else stores an `Items` list). Each capture calls `WorldManager.touchChunk`, marking the chunk and its region dirty.

6. **Periodic save (`WorldManager.start` / `save`)** — A single-threaded scheduled executor ("World Save Service") runs `save()` after an initial 5s delay, then every 12s. `save` writes `level.dat` (`LevelData.save`) and the map registry, then for each `Region` with changes calls `Region.toFile(playerChunkPos)`. The save task catches `Throwable` so one failing cycle doesn't permanently cancel the scheduler, and uses a per-dimension `savingDimension` guard so the same dimension isn't saved concurrently.

7. **Region -> MCA (`Region.toFile` -> `ChunkBinary` -> `McaFile.write`)** — `Region` skips regions with no changes since last write. For each unsaved chunk it produces a `ChunkBinary` (`ChunkBinary.fromChunk`: chunk -> NBT -> zlib-compressed -> length+compression-type header, sector-rounded size), and a separate entity `ChunkBinary` if the version stores entities separately. Chunks far from the player (beyond `UNLOAD_RANGE` = 24 Manhattan) are marked for deletion as a backup to the server's unload packets. `McaFile.write` recomputes per-chunk sector locations, builds the 4 KiB location + 4 KiB timestamp headers, concatenates chunk data on sector boundaries, and writes `r.<x>.<z>.mca` under `<output>/<dimension>/region/` (or `/entities/`).

8. **Merge on write (`McaFile`)** — When constructed for a region position, `McaFile` reads any existing `.mca` for that region first (`readFile`) so previously saved chunks are merged rather than dropped. `readFile` parses the Anvil header, validates sector indices, and ignores a region that contains only a single tiny chunk (treated as not really generated).

Dimension changes and disconnects (`WorldManager.setDimension` / `resetConnection`) flush and unload the current regions on the save thread before switching, keeping per-dimension data separate.

### Version branching highlights

- Chunk class chosen per data version (see step 2).
- Pre-1.18 worlds nest block/tile-entity and entity data under a `Level`/`TileEntities` tag; 1.18+ uses top-level `block_entities`, and 1.17+ stores entities in a separate `entities/` MCA file (`Chunk.hasSeparateEntities`, `toEntityNbt`).
- `Slot.toNbt` switches item NBT layout at 1.20.6+: stack size written as int `count` (vs. byte `Count`), and the old `tag` sub-compound is only written pre-1.20.6 (data components are not reconstructed).
- Sky light is omitted in the Nether (`Chunk.parseLights`).

## Key files

- `src/main/java/game/data/WorldManager.java` — Orchestrator: holds regions, runs the periodic/dimension-change save service, registers parsed chunks, reads saved chunk NBT back for content preservation.
- `src/main/java/game/data/chunk/ChunkFactory.java` — Parses incoming chunk packets on a dedicated thread; selects the version-specific `Chunk`; buffers out-of-order tile-entity/light data; rebuilds chunks from NBT.
- `src/main/java/game/data/chunk/Chunk.java` — Abstract chunk: reads chunk columns/sections from packets, serializes to NBT, exposes block-state lookups; base for version-specific subclasses.
- `src/main/java/game/data/chunk/ChunkEntities.java` — Block-entity and inventory handling: stores block entities, merges captured container contents, preserves content fields across re-sends, seeds from disk.
- `src/main/java/game/data/chunk/ChunkBinary.java` — Converts a chunk to/from the compressed binary blob stored inside an MCA file (zlib + Anvil per-chunk header).
- `src/main/java/game/data/region/Region.java` — One 32x32-chunk region: tracks dirty/unsaved chunks, builds the `McaFile`(s) on save, handles unload/delete bookkeeping.
- `src/main/java/game/data/region/McaFile.java` — Reads/writes the Anvil `.mca` region-file format (sector allocation, location/timestamp headers, merge-with-existing).
- `src/main/java/game/data/container/Slot.java` — A single inventory item stack; serializes item id + count (+ legacy `tag`) to NBT, version-aware for 1.20.6+.
- `src/main/java/game/data/LevelData.java` — Writes `level.dat` so the saved world is openable in-game.
- `src/main/java/config/Config.java` — Defines the CLI flags / settings below.

## Configuration / flags

(from `config/Config.java`; flags are CLI options parsed via the `@Option` annotation)

- `--output` / `-o` (`worldOutputDir`, default `world`) — Output world directory; an existing world is updated/merged rather than replaced.
- `--center-x` / `--center-z` (`centerX` / `centerZ`, default 0; must be given together) — Offsets the output world so the given coordinate maps to world origin. Rounded down to multiples of 512 blocks. Used when offsetting block-entity coordinates and when seeding saved block entities from disk.
- `--disable-chunk-saving` (`disableWriteChunks`, default false) — Disables writing chunks to disk (`writeChunks()` returns `!disableWriteChunks`); mostly for debugging. Chunks are still parsed for the GUI but `save` returns early and `loadChunk` skips registering them into regions unless drawing.
- `--mark-new-chunks` (`markNewChunks`, default false) — Marks partially-sent ("new") chunks with an orange outline in the map; does not change what is saved.
- `--seed` (`levelSeed`, default 0) — Numeric level seed written into the output world's level data.
- Debug NBT dump: `Config.writeChunksAsNbt()` (toggled at runtime via `Config.toggleWriteChunkNbt()`, no dedicated CLI flag found) — when on, `ChunkBinary.fromChunk` also writes each chunk's NBT as text under `<output>/debug/` for inspection.

Save cadence is not configurable: `WorldManager.INIT_SAVE_DELAY` = 5000 ms and `SAVE_DELAY` = 12000 ms are constants. `Region.UNLOAD_RANGE` (24) is likewise a constant.

## Usage

Run the downloader against a server; saving is on by default. Typical invocation:

```
java -jar world-downloader.jar --server <host> --output my_world
```

Then connect your Minecraft client to the local proxy (default port `25565`, configurable via `--local-port`). As you walk around, chunks stream in and are flushed to `my_world/<dimension>/region/*.mca` every ~12 seconds and on dimension change/disconnect. Open captured containers in-game to record their inventories. When finished, open `my_world` directly in Minecraft. To capture without writing to disk (debugging), add `--disable-chunk-saving`.

## Verification

- Unit tests for chunk/region serialization exist in the repo's test tree (e.g. `src/test/.../chunk` and `region` tests) covering the parse/serialize round-trip; per the project's build notes there are two environment-only test failures unrelated to this feature.
- A live integration-test harness (Paper server + mineflayer client, per `MEMORY.md`'s integration-test notes) exercises the proxy end-to-end, including container capture and saving.
- This document is grounded in a direct read of the source listed under Key files; it has not been independently re-run as part of writing the doc (treat the behavioral claims as code-derived, not freshly executed here).

## Gotchas & limitations

- Servers typically send chunks with **empty containers**; inventory contents are only captured when a container is actually opened (or carried over from a prior save). The preservation logic in `ChunkEntities.addBlockEntity` / `seedBlockEntitiesFromDisk` exists specifically so a later empty re-send doesn't wipe a previously captured inventory.
- A region's chunks are only re-written when `updatedSinceLastWrite` is set, and individual chunks are skipped if already `saved` — relies on `touchChunk` being called on every meaningful change.
- `findOpenableContainerNear` (used by the auto-opener) assumes default centering (`--center 0`); positions are compared in real/global coordinates.
- `McaFile.readFile` discards a region file that contains only a single sector-sized chunk, assuming it isn't genuinely generated — an edge case that could drop a legitimately tiny region.
- Item data components are not reconstructed for 1.20.6+; only item id and count are written into container slots, so component-bearing items lose their extra data.
- Parsing errors are swallowed (to save memory) in `ChunkFactory.parse`, so a malformed chunk is silently dropped rather than surfaced.
- Save offset (`--center-x/-z`) is rounded to 512-block multiples; non-multiple values are silently snapped.

## Open items

(none known)
