# Extended render distance

> Re-send already-downloaded chunks from disk back to the connected client so the world renders farther than the server's own view distance allows.

## What it does

The downloader sits as a proxy between your Minecraft client and the remote server. Normally the client only ever sees the chunks the server chooses to send (the server's view/render distance). With the extended render distance feature enabled, the downloader takes chunks it has *already saved to disk* and re-injects them into the client connection as the player moves, filling in a larger radius around the player than the server itself sends.

Concretely:
- It bumps the view distance the client is told about in the `Login` packet, so the client is willing to render the extra chunks.
- As the player moves between chunks, it loads previously-downloaded chunks from the world's `.mca` region files and streams them to the client as chunk-data packets.
- It tracks which chunks it has loaded versus which the game (server) has loaded, sends unload packets for chunks that fall out of range, and avoids re-sending chunks that are already present.

Because it only serves chunks that were *already downloaded in a prior visit*, it does not reveal anything the server hasn't already sent you at some point — it just keeps showing you what you have on disk.

## How it works

### Configuration entry point

`Config.extendedRenderDistance` (an `int`, default `0`, `0` = feature off) is read on startup. In `Config.settingsComplete()` the value is pushed into the world via `WorldManager.updateExtendedRenderDistance(extendedRenderDistance)` (`Config.java:201`), which delegates to `RenderDistanceExtender.setExtendedDistance(int)`.

### View-distance interception (so the client will render the extra chunks)

The server's advertised view distance is rewritten as it passes through the proxy. In each version-specific `ClientBoundGamePacketHandler_*`, the `Login` packet's view-distance field is replaced with `Math.max(viewDist, Config.getExtendedRenderDistance())`:
- `ClientBoundGamePacketHandler_1_14` (1.14)
- `ClientBoundGamePacketHandler_1_15`
- `ClientBoundGamePacketHandler_1_16`
- `ClientBoundGamePacketHandler_1_19`
- `ClientBoundGamePacketHandler_1_20_2`
- `ClientBoundGamePacketHandler_1_20_6`

Additionally, the base `ClientBoundGamePacketHandler` intercepts the server's `SetChunkCacheRadius` packet and only forwards it when `dist > Config.getExtendedRenderDistance()` (`ClientBoundGamePacketHandler.java:254-258`) — i.e. it suppresses the server shrinking the client's render radius below the extended value. Conversely, when the extender raises the distance itself it sends its *own* `SetChunkCacheRadius` to the client (see below).

### RenderDistanceExtender — the core

`RenderDistanceExtender` (constructed once by `WorldManager`'s constructor, `WorldManager.java:121`) owns the bookkeeping and chunk-sending logic. Key state:
- `extendedDistance` — current radius in chunks.
- `playerChunk` — the player's current chunk coordinate.
- `circles` — precomputed lists of relative chunk offsets per ring/radius, from `CircleGenerator`.
- `gameLoaded` — chunks the game/server has loaded (so we must not re-send them).
- `extenderLoaded` — chunks this feature has injected.
- `status` — `WAITING` until the first real chunk arrives, then `ACTIVE`.
- a single-threaded `ExecutorService` (named "Render Distance Extender") that serializes all send/unload work off the network thread.

**Ring precomputation.** `generateCircles(distance)` uses `CircleGenerator.computeUpToRadius(distance + 1)`. `CircleGenerator` walks a `(2r+1)²` grid, computes a ceil-Euclidean ring index per offset (with a `+1` adjustment along the center cross so single chunks don't "stick out"), and skips rings with `dist < 3` or `dist > radius`. The result is `circles.get(r)` = the list of relative coordinates that make up ring `r`.

**Lifecycle / activation.** The extender starts in `WAITING`. When `WorldManager.loadChunk(...)` runs it calls `renderDistanceExtender.notifyLoaded(chunk.location.stripDimension())` (`WorldManager.java:325`); the first such call flips status to `ACTIVE` and starts the executor via `start()`, which first runs a `delay()` (sleeps 1500 ms) so the downloader does not race the server's own initial chunks.

**Player movement.** `WorldManager.setPlayerPosition(...)` calls `renderDistanceExtender.updatePlayerPos(getPlayerPosition())` (`WorldManager.java:711-713`). `updatePlayerPos`:
1. Returns early if not `ACTIVE` or `extendedDistance == 0`.
2. Converts to a chunk coordinate; returns if the player hasn't changed chunks.
3. **Version gate:** returns early if `Config.versionReporter().isAtLeast(Version.V1_21)` — on 1.21+ the client currently cannot read the chunk-data packets the downloader generates, so chunk re-sending is disabled there (see `RenderDistanceExtender.java:91-94`). (Note: the `Login` view-distance bump and `SetChunkCacheRadius` handling are not gated this way, but no extra chunks are streamed on 1.21+.)
4. If the move was small (adjacent, per `isInRangeChebyshev(..., 1)` — which in this codebase is actually a Manhattan-sum test, see Gotchas), it runs `updateOuter` to add only the new outer ring and unload the ring that left range. Otherwise (a teleport/larger jump) it runs `updateFull`, first adding an extra `delay()` if the jump was large enough that the server is likely to send its own chunks.

**Adding chunks.**
- `updateFull(center, distance)` first calls `checkAllLoaded()` (which unloads any `extenderLoaded` chunks no longer in range via `worldManager.unloadChunks`), then iterates `updateCircle(i, center)` for every ring `0..distance`.
- `updateOuter(center, distance)` adds just `updateCircle(distance, center)` and then `unloadOuter(distance, center)` to drop the ring at `distance + 1` that has left range.
- `updateCircle(radius, center)` builds the set of desired chunk coords (skipping any already `isLoaded`) and calls `worldManager.sendChunksToPlayer(desired)`, recording the actually-sent chunks in `extenderLoaded`.

**Sending the chunks.** `WorldManager.sendChunksToPlayer(Collection<Coordinate2D>)` (`WorldManager.java:737-815`) does the heavy lifting:
- Sorts the desired chunks nearest-to-player first, so immediate surroundings fill in before distant ones.
- For each chunk: re-checks `renderDistanceExtender.isStillNeeded(coords)`; loads the owning `.mca` region file via `McaFile.ofCoords` (cached per region in `loadedFiles`); reads the `ChunkBinary`; skips chunks absent from the file or whose `getDataVersion()` doesn't match the current `Config.versionReporter().getDataVersion()`.
- Builds `chunk.toPacket()` (and `chunk.toLightPacket()` if present) and enqueues them via `Config.getPacketInjector()`.
- Optionally marks the chunk on the map as `ChunkImageState.EXTENDED` when `Config.drawExtendedChunks()` is set.
- Paces delivery: sleeps `Config.extendedRenderPaceMs()` ms (default 6, clamped `>= 0`) between chunks so chunks drip out steadily instead of in bursts. Returns the set actually sent.

**Unloading / range tests.** `isInRange(coords)` uses `coords.isInRangeEuclidean(playerChunk, extendedDistance)`. `WorldManager.canForget(co)` defers to `renderDistanceExtender.canUnload(co)` (i.e. a chunk can be forgotten when it is out of extended range). `WorldManager.unloadChunk(...)` calls `notifyUnloaded`, which removes the chunk from `gameLoaded` and, if still in range, moves it to `extenderLoaded`.

**Changing distance at runtime.** `setExtendedDistance(newDistance)`:
- No-op if unchanged.
- If `newDistance` exceeds the precomputed rings (`circles.size() - 2`), it regenerates the circles and sends a fresh `SetChunkCacheRadius` packet to the client via `sendNewRenderDistancePacket` — but only on `Version.V1_19_3`+ (older clients are skipped, `RenderDistanceExtender.java:184-186`).
- Stores the new value and, if not `WAITING`, schedules a `updateFull` to re-fill at the new radius.

**Reset.** `reset()` (called on dimension change `WorldManager.setDimension`, on `resetConnection`, and at construction) clears `gameLoaded`/`extenderLoaded`, resets `playerChunk` to a sentinel that is never "in range", sets status back to `WAITING`, and shuts down the executor.

### Version branching summary

- **< 1.19.3:** chunk re-sending works; the dynamic `SetChunkCacheRadius` packet for distance changes is suppressed (`sendNewRenderDistancePacket` no-ops).
- **1.19.3 – 1.20.x:** full behavior, including the dynamic `SetChunkCacheRadius` packet.
- **1.21+:** the `Login` view-distance bump and incoming `SetChunkCacheRadius` filtering still apply, but `updatePlayerPos` returns early, so **no extra chunks are streamed** (a known TODO in the code).

## Key files

- `src/main/java/game/data/RenderDistanceExtender.java` — core logic: ring bookkeeping, player-movement handling, add/unload of extended chunks, runtime distance changes, the 1.21 gate.
- `src/main/java/game/data/WorldManager.java` — owns the extender; `updateExtendedRenderDistance`, `sendChunksToPlayer` (reads `.mca`, builds and injects chunk packets, paces delivery), `notifyLoaded`/`notifyUnloaded`/`canForget`/`countExtendedChunks`, and the `reset()` hooks on dimension change / reconnect.
- `src/main/java/game/data/CircleGenerator.java` — precomputes the per-radius rings of relative chunk coordinates.
- `src/main/java/config/Config.java` — `--extended-render-distance` / `-r` option, `--extended-render-pace`, the `getExtendedRenderDistance()` / `extendedRenderPaceMs()` getters, and the `updateExtendedRenderDistance` call in `settingsComplete()`.
- `src/main/java/packets/handler/ClientBoundGamePacketHandler.java` — intercepts `SetChunkCacheRadius` from the server (forwards only when larger than the extended value).
- `src/main/java/packets/handler/version/ClientBoundGamePacketHandler_1_14.java` (and `_1_15`, `_1_16`, `_1_19`, `_1_20_2`, `_1_20_6`) — rewrite the `Login` view-distance field to `max(viewDist, extendedRenderDistance)`.
- `src/main/java/gui/GuiSettings.java` — settings-UI slider/text binding for the extended distance (`extendedDistance` / `extendedDistanceText`).
- `src/main/java/game/data/coordinates/Coordinate2D.java` — the `isInRangeEuclidean` / `isInRangeChebyshev` / `isInRangeManhattan` range tests used to decide what's in range.

## Configuration / flags

- `--extended-render-distance` (alias `-r`), config key `extendedRenderDistance`, default `0`. When set to a non-zero radius (in chunks), downloaded chunks are re-sent to the client to extend render distance to that amount. `0` disables the feature.
- `--extended-render-pace`, config key `extendedRenderPaceMs`, default `6`. Milliseconds to pause between each re-sent chunk. Lower = chunks appear faster but can stutter; higher = smoother but slower to fill in; `0` = send as fast as possible. Read via `Config.extendedRenderPaceMs()` (clamped to `>= 0`).
- `--draw-extended-chunks`, config key `drawExtendedChunks`, default `false`. When set, chunks injected by this feature are marked on the overview map with `ChunkImageState.EXTENDED`. (Related, optional.)
- GUI: the "general" tab exposes the extended distance as a slider + numeric field (`GuiSettings.java:118-119`, written back at `:321` as `Math.abs((int) extendedDistance.getValue())`).

## Usage

Headless example (re-send downloaded chunks out to a 32-chunk radius):

```
java -jar world-downloader.jar --server <host> --no-gui -r 32
```

Or set it together with the pacing:

```
java -jar world-downloader.jar -s <host> --no-gui --extended-render-distance 32 --extended-render-pace 10
```

In GUI mode, set the "Extended render distance" value in the settings (general tab) before connecting. Then connect your Minecraft client through the downloader proxy as usual; as you walk around, previously-downloaded chunks beyond the server's view distance will be streamed into your client. Make sure your in-game video-settings render distance is at least as large as the extended value, or the client will clamp it.

## Verification

- Documented behavior is taken directly from the source listed above (the option definitions, the `Login`/`SetChunkCacheRadius` rewrites, and the `RenderDistanceExtender` flow).
- No feature-specific automated test for `RenderDistanceExtender` was found in this pass; verification here is from reading the code (compile-level), not from a dedicated unit/integration test.
- The code itself documents a known runtime limitation on 1.21+ (the early-return TODO in `updatePlayerPos`), indicating the chunk-re-send path has not been made to work on that protocol family.

## Gotchas & limitations

- **No effect on 1.21+.** `updatePlayerPos` returns early for `Version.V1_21`+, so chunks are not re-sent on those versions (the generated chunk-data packets aren't readable by the current client — a TODO in the code). The advertised view distance is still bumped, which can make the client request/expect chunks it won't receive from the downloader.
- **Only serves already-downloaded chunks.** It reads from the world's `.mca` files; areas you've never visited (and so never saved) cannot be filled in. Chunks whose stored `dataVersion` doesn't match the current session's are skipped.
- **Data-version / dimension scoping.** On dimension change and on reconnect the extender is `reset()`, clearing its loaded sets; it re-warms from `WAITING` on the next real chunk.
- **Startup/teleport delays are intentional.** A 1500 ms `delay()` runs on activation and after large teleports to avoid colliding with the server's own chunk sends; expect a short lag before extended chunks appear.
- **Misleading range-method names.** In `Coordinate2D`, `isInRangeChebyshev` actually computes a Manhattan (`|dx| + |dz|`) sum and `isInRangeManhattan` computes a Chebyshev (`max`) test — the names are swapped relative to their implementations. The extender uses `isInRangeChebyshev(..., 1)` to detect an "adjacent" move (so it triggers the cheap outer-ring update only for true neighbors), and `isInRangeManhattan(..., 2)` to decide whether to add the post-teleport delay. Behavior is correct; the names are just misleading.
- **Pacing is a global serial drip.** All sending happens on one thread with a `sleep(pace)` between chunks, so very large radii fill in gradually; raising `--extended-render-distance` greatly increases the chunk count to stream.
- **`SetChunkCacheRadius` suppression cutoff.** The dynamic radius packet sent on runtime distance changes only goes out on 1.19.3+; older clients won't get the updated cache radius when the distance is changed mid-session.

## Open items

- The 1.21+ chunk-data incompatibility is an explicit, unresolved TODO (`RenderDistanceExtender.java:91`): "for 1.21, fix client unable to read chunk data packets generated by downloader for some reason." Until fixed, extended render distance does not stream chunks on 1.21+.
- The swapped `isInRangeChebyshev` / `isInRangeManhattan` method names in `Coordinate2D` are a latent readability/maintenance hazard (behavior is correct today, but the names invite future bugs).
