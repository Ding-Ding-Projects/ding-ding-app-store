# Auto-open container sweep

> Experimental, opt-in mode that injects serverbound interactions to open nearby containers one at a time as the player moves, so a passive world download captures their contents without manual clicking.

## What it does

When enabled with `--auto-open-containers`, the downloader proxy automatically opens containers near the player as the player walks around. For each nearby container that has not yet been captured, it injects a serverbound "open" interaction toward the server. The server responds with the normal `OpenScreen` + `ContainerSetContent` packets, which the existing capture path records into the saved world. The proxy then injects a `ContainerClose` so the server frees the container and the sweep advances to the next one.

The screen that the server opens in response is *not* forwarded to the player's real client, so the player never sees a GUI pop open and can keep moving (an open container GUI would freeze movement and stall the sweep). Contents are still captured server-side regardless.

Both block containers (chests, barrels, hoppers, furnaces, shulker boxes, crafters, lecterns, etc.) and container minecarts (chest/hopper minecarts) are swept. Block-container contents are saved as block entities in the chunk; container-minecart contents are written into the entity NBT (the chunk's `Entities` list) on `ContainerMinecart`.

A per-container, human-readable log line is appended to a sidecar file (`AutoOpenItemLog`), and an action-bar message is shown to the player on each capture.

## How it works

Architecture / flow:

1. Movement trigger. `ServerBoundGamePacketHandler` handles serverbound movement packets (`MovePlayerPos`, `MovePlayerPosRot`, `MoveVehicle`). On each one it updates the tracked player position and calls `ContainerAutoOpener.tick(playerPos)` on the client->server thread. The same handler's `UseItemOn` operator records the latest block-change sequence (1.19+) via `setLastSequence(...)`, so injected opens never run ahead of the real client's sequence number.

2. `ContainerAutoOpener.tick(playerPos)` (client->server thread) — opens at most one container per call:
   - Returns immediately unless `Config.autoOpenContainers()` is set and `playerPos != null`.
   - Lazily loads the persisted "already attempted" set (`ensureLoaded()`).
   - Gamemode gate: `Config.autoOpenGamemodes()` returning `null` means "all gamemodes" (no gate, so it runs in survival on join without toggling); a non-null set restricts to those modes, and an unknown gamemode (`-1`) is never in the set.
   - Enforces one-at-a-time: while `waiting`, it returns until either the content arrives or `OPEN_TIMEOUT_MS` (1500 ms) elapses. On timeout it clears `waiting` and the stale `pendingOpen` flag and moves on (the container stays marked attempted).
   - Enforces the inter-open cooldown `Config.autoOpenDelayMs()` since `lastOpenMs`.
   - Finds the nearest uncaptured block container via `WorldManager.findOpenableContainerNear(...)`, excluding positions already in `attempted`, `trappedChestSkipped(...)` (trapped chests, unless opted in), or `blockedByNearbyPlayer(...)`. If none, it falls back to the nearest container minecart via `EntityRegistry.findContainerMinecartNear(...)`, excluding ids in `attemptedMinecarts`.
   - To open: it sets `ContainerManager.lastInteractedWith(pos)` itself (because the proxy injects the open packet rather than parsing one), injects the open, and sets `waiting`, `pendingOpen`, `pendingOpenMs`, `waitStartMs`, `lastOpenMs`.

3. Injected serverbound packets (`ContainerAutoOpener`):
   - Block open — `sendOpen(pos)` builds `UseItemOn`. Version branching matters in two places: the on-wire block-position packing (pre-1.14 packs `x<<38 | y<<26 | z`; 1.14+ packs `x<<38 | z<<12 | y`), and the field layout (pre-1.14 "Player Block Placement": location, face, hand, cursor; 1.14+ "Use Item On": hand, location, face, cursor, inside-block, plus `worldBorderHit` at 1.21.3+ and the block-change `sequence` at 1.19+). It always targets face=top with cursor 0.5/0.5/0.5.
   - Minecart open — `sendInteract(entityId)` builds `Interact` (target id, type=interact, hand=main, and a sneaking boolean added in 1.16).
   - Close — `sendClose(windowId)` builds `ContainerClose` with the window id byte.
   - All three no-op if the protocol lacks the packet (`packetId < 0`) or there is no serverbound injector.

4. Swallowing the screen. `ClientBoundGamePacketHandler_1_14`'s `OpenScreen` operator parses the window then calls `getContainerManager().openWindow(...)`. If `autoOpenContainers()` is set and `ContainerAutoOpener.claimPending()` returns true, it returns `false` so the packet is not forwarded to the real client. `claimPending()` only claims a pending flag younger than `PENDING_TTL_MS` (2000 ms); a stale/unset flag is cleared and returns false, so an auto-open the server never answered can never swallow the player's own real container open later.

5. Capturing contents. `ContainerManager.items(windowId, count, provider)` reads the slots into the known window. When `autoOpenContainers()` is set and the opener is `isWaiting()`:
   - If `getPendingMinecart() != null`, the contents belong to the entity: it calls `mc.setItems(...)`, marks the minecart's chunk unsaved, logs via `AutoOpenItemLog`, removes the window, and calls `opener.onContentCaptured(windowId)`.
   - Otherwise it closes/saves the window (`closeWindow`), logs via `AutoOpenItemLog`, and calls `opener.onContentCaptured(windowId)`. A `try/finally` guarantees `onContentCaptured` always runs even if the save or log throws (otherwise `DataReader` swallows the throwable and the sweep stalls until timeout). Logging is in its own nested `try` so a log failure is never reported as a save failure.

6. `onContentCaptured(windowId)` (clientbound thread) injects the `ContainerClose`, clears `waiting`/`pendingMinecart`, and resets `lastOpenMs` to now (so the cooldown is measured from capture, not from open).

7. Action-bar feedback. On a saved block window, `ContainerManager.closeWindow(...)` -> `sendInventorySavedMessage(...)` shows a green action-bar message built from `Config.containerMessageFormat()` with `{type} {count} {x} {y} {z}` placeholders; `{count}` is the number of non-empty slots and `{type}` is the block type resolved from the captured location.

State and dedup:
- `attempted` is a set of packed `(x,y,z)` keys for block positions (captured, blocked, or unopenable), persisted per world so a block is opened at most once *ever*, even across restarts (the app runs with restart-always, which would otherwise re-open everything). `ensureLoaded()` reads it and `persist(pos)` appends each newly attempted position.
- `attemptedMinecarts` is a per-session set of entity ids (not persisted, because minecarts move).
- The persist file location is resolved by `Config.resolveBesideWorldFile(...)`: a custom path is used verbatim, otherwise the default name is placed *beside* the world folder (in its parent dir) so it survives outside the world data and outside Docker's ephemeral layer.

Openable set (`ContainerAutoOpener.isOpenable`): `chest`, `trapped_chest`, `barrel`, `hopper`, `dropper`, `dispenser`, `furnace`, `blast_furnace`, `smoker`, `brewing_stand`, `crafter`, `lectern`, plus any block whose name ends in `_shulker_box`. (`isOpenable` is also used to recognise a *manually* opened container, so it still lists `trapped_chest`; the auto-sweep separately skips trapped chests by default — see below.)

Trapped-chest safety (`trappedChestSkipped`): trapped chests are excluded from the auto-sweep **by default**, because opening one emits a redstone pulse that can trigger redstone contraptions or alarms on a server. Opt in with `--auto-open-allow-trapped-chests`. Like the player-nearby check, a skipped trapped chest is *not* marked attempted, so it is opened later if the option is enabled. Manually opening a trapped chest yourself is still captured normally (this only governs the automatic sweep).

Player-aware safety (`blockedByNearbyPlayer`): only `chest`, `trapped_chest`, `barrel`, and any `*_shulker_box` are skipped while another player is within `Config.autoOpenPlayerRadius()` (default on; disabled by `--auto-open-allow-chest-near-players`). Skipped blocks are *not* marked attempted, so they are opened later once no player is nearby. The nearby-player check (`EntityRegistry.isPlayerNear`) covers both the legacy AddPlayer table and 1.20.2+ players spawned as generic `minecraft:player` entities, and never counts the downloading player.

## Key files

- `src/main/java/game/data/container/ContainerAutoOpener.java` — the sweep itself: `tick`, openable set, attempted-set persistence, player-proximity gate, injected `UseItemOn`/`Interact`/`ContainerClose`, pending-open claiming.
- `src/main/java/game/data/container/ContainerManager.java` — capture path: `items(...)` routes auto-opened content to block save or minecart, logs it, and calls `onContentCaptured`; `sendInventorySavedMessage` shows the action-bar message.
- `src/main/java/game/data/container/AutoOpenItemLog.java` — appends a per-container, aggregated, human-readable item list to a sidecar log file (best-effort).
- `src/main/java/game/data/entity/specific/ContainerMinecart.java` — holds captured minecart slots and writes them into the entity's `Items` NBT.
- `src/main/java/config/Config.java` — all `--auto-open-*` flags and getters, plus `resolveBesideWorldFile(...)` and `registerServerBoundInjector(...)`.
- `src/main/java/packets/handler/ServerBoundGamePacketHandler.java` — calls `tick(...)` on movement packets and records the block-change sequence.
- `src/main/java/packets/handler/version/ClientBoundGamePacketHandler_1_14.java` — `OpenScreen` operator that swallows the auto-opened screen via `claimPending()`.
- `src/main/java/game/data/WorldManager.java` — `findOpenableContainerNear(...)` and the `getContainerAutoOpener()` / `getAutoOpenItemLog()` accessors.
- `src/main/java/game/data/entity/EntityRegistry.java` — `findContainerMinecartNear(...)` and `isPlayerNear(...)`.

## Configuration / flags

All options are also configurable in the **jar GUI** (JavaFX settings → **Auto-open** tab, fields bound
in `gui/GuiSettings.java`) and the web console, not just the CLI. GUI changes save on tab switch and
apply live, since the sweep reads `Config` getters continuously.

All flags are defined in `Config.java` (args4j `@Option`):

- `--auto-open-containers` (default off) — master switch; enables the experimental sweep.
- `--auto-open-delay` (ms, default 400; floored to 50) — minimum gap between auto-opened containers. Higher is safer against anti-cheat.
- `--auto-open-reach` — **deprecated/ignored.** Reach is now fixed at the survival reach (4.0 blocks; `Config.AUTO_OPEN_REACH`) and cannot be changed, since a larger reach exceeds a legitimate player's and trips server anti-cheat / desyncs which contents the server sends. The flag is still accepted (it just does nothing) so older command lines don't error, and it is no longer shown in the web console.
- `--auto-open-state` (default `auto-open-attempted.txt` beside the world folder) — file recording which block positions were already opened, so a block is never re-opened (even across restarts). Set an absolute path to relocate.
- `--auto-open-log` (default `auto-open-items.log` beside the world folder) — file the human-readable captured-items list is appended to. Set an absolute path to relocate.
- `--auto-open-allow-trapped-chests` (default off, i.e. trapped chests are skipped) — **trapped chests are NOT auto-opened by default**, because opening one emits a redstone pulse that can fire redstone contraptions or alarms on a server. Pass this flag to auto-open them as well. The skip is enforced in `ContainerAutoOpener.trappedChestSkipped(...)` as part of the `findOpenableContainerNear` exclude predicate, and (like the player-nearby check) does **not** mark the block attempted, so trapped chests are opened later if the option is turned on. When enabled, trapped chests are still subject to the player-nearby protection below.
- `--auto-open-allow-chest-near-players` (default off, i.e. skipping is on) — by default chests/trapped chests/barrels/shulker boxes are NOT opened while another player is within `--auto-open-player-radius`; pass this to open them anyway. Affects only those container types; all others always auto-open.
- `--auto-open-player-radius` (blocks, default 100.0) — radius for the "other player nearby" check.
- `--auto-open-gamemodes` (default `all`) — which gamemodes the sweep runs in: `all`, or a comma list of `survival,creative,adventure,spectator` (names or ids 0-3). A restricted list only activates once that gamemode is observed.
- `--container-message-format` (default `"{type} ({count}) - {x} {y} {z}"`) — template for the saved-container action-bar message; placeholders `{type} {count} {x} {y} {z}`. Falls back to the default if blank.

Related (not auto-open specific): the action-bar message is suppressed if info messages are disabled (`--disable-messages`).

Internal constants (not flags): `OPEN_TIMEOUT_MS = 1500`, `PENDING_TTL_MS = 2000`.

## Usage

Run the downloader with the master flag plus any server connection arguments, e.g.:

```
--server <host> --auto-open-containers
```

Then simply walk near containers. As you move, the proxy opens each uncaptured container in reach one at a time and saves its contents; you keep moving normally (no GUI appears) and an action-bar line confirms each capture. You must still travel near every container, because the server only sends contents for containers within normal reach.

Tune behaviour with the other `--auto-open-*` flags above (e.g. raise `--auto-open-delay` if a server's anti-cheat reacts, restrict with `--auto-open-gamemodes spectator`, or relocate the state/log files with `--auto-open-state` / `--auto-open-log`). The captured items are recorded both in the saved world and in the `--auto-open-log` sidecar file.

## Verification

- Unit/protocol test: `src/test/java/game/protocol/Protocol26_1Test.java` (`serverboundPacketsForAutoOpenAndReplyArePresent`) asserts the serverbound packets the sweep injects (`UseItemOn`, `ContainerClose`) resolve to valid ids for a modern protocol. This is a static protocol-mapping check, not a behavioural test of the sweep.
- Live integration tests exist outside the repo at `C:/Users/cntow/mcwdtest/` (Paper + mineflayer harness). Per the project memory, `runtest.js` verifies auto-open of every container type plus saved-world item NBT across versions 1.12.2, 1.20.4, 1.21.8, 1.21.11; `testminecart.js` verifies chest-minecart capture and saved entity NBT; `testmultiplayer.js` exercises the player-aware chest safety; and `loadback.js` re-opens the *downloaded* world in a fresh server and reads chests back in-game (this caught the 1.20.5+ `Count`->`count` NBT bug). These are live, behavioural tests, but they live outside this repository.

## Gotchas & limitations

- This sends real interactions to the server. Use only where permitted. Rapid mass-opening can trip server anti-cheat (kick/ban); the delay gives a conservative gap — raise it if needed.
- The player must still travel near every container; the server only sends contents for containers within normal reach.
- Assumes default centering (`--center 0`): container positions are compared in real global coordinates against the player position, so a non-zero center offset will misalign the reach check.
- A timed-out open (1500 ms with no content) leaves the block in `attempted`, so it is never retried — an obstructed/blocked container is given up on permanently for that world.
- Block dedup is permanent per world via the persisted state file; deleting or relocating that file changes which blocks are considered "already opened". Minecart dedup is per-session only (ids are not persisted, since minecarts move).
- The screen is swallowed from the client only when the pending flag is fresh (< 2 s); the stale-claim guard exists specifically to avoid eating the player's own real container opens.
- Logging and state persistence are best-effort and deliberately never break the download or stall the sweep.

## Open items

None known.
