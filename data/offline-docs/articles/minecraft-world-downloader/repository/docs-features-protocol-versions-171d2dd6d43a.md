# Version support & protocol fixes

> Maps a server's handshake protocol version to a known packet-ID table and routes packet parsing through version-specific code paths, with a "best match" fallback so newer/in-between versions still work.

## What it does

Minecraft's wire protocol changes between releases: packet IDs get renumbered and the binary
layout of fields (slots/items, chunk data, chat) changes. This feature gives the downloader a
single source of truth for "which packet ID means what" per protocol version, and a mechanism to
branch parsing logic by version.

Concretely it:

- Detects the client's protocol version from the serverbound handshake packet and stores it in `Config`.
- Looks up the matching packet-ID table (clientbound + serverbound name/ID maps) from
  `protocol-versions.json`, falling back to the closest lower known version when the exact one is missing.
- Exposes a `VersionReporter` that answers "is the captured world at least version X?" using the
  resolved data version, which the rest of the codebase uses to pick version-appropriate parsing.
- Selects a version-specific `DataTypeProvider` subclass so that format changes (1.13 slot format,
  1.14 coordinate ordering, 1.20.2 and 1.20.6 item/component changes) are read correctly.

The bundled table covers protocol `47` (1.8) through `775` (26.1 "Tiny Takeover"), with a
named `Version` enum constant for each family boundary that the code branches on.

## How it works

Flow, from connection to parsing:

1. **Handshake detection.** `ServerBoundHandshakePacketHandler` reads the handshake packet's first
   field (`provider.readVarInt()`) as the protocol version and calls `Config.setProtocolVersion(...)`.
   This is the protocol version (e.g. `772`), not the marketing game version (e.g. `1.21.8`).

2. **Protocol resolution.** `Config.setProtocolVersion` builds a new `VersionReporter(protocolVersion)`,
   which asks `ProtocolVersionHandler.getInstance().getProtocolByProtocolVersion(protocolVersion)`.
   `Config.getGameProtocol()` performs the same lookup and additionally prints
   `Using protocol of game version <ver> (<protocolVersion>)` and kicks off registry loading.

3. **Table loading.** `ProtocolVersionHandler` is a singleton deserialized from
   `protocol-versions.json` via Gson. A custom `Integer` `TypeAdapter` uses `Integer.decode`, which is
   what lets the JSON store packet IDs as hex strings (e.g. `"0x21"`). After load,
   `initialiseDataVersionMap()` builds a `dataVersion -> protocolVersion` map and calls
   `Protocol.generateInverse()` on each entry to build name->ID maps for both directions.

4. **Best-match fallback.** `getProtocolByProtocolVersion` / `getProtocolByDataVersion` call the
   private `bestMatch(values, target)`. Priority: exact match if present; otherwise the **highest known
   version strictly below the target** (it walks the sorted list keeping the last entry `< target`); if
   none is below, the **lowest** known version. Net effect: a server on an unmapped newer protocol is
   parsed with the closest older table the downloader knows.

5. **Per-direction packet name lookup.** `Protocol` holds `clientBound`/`serverBound`
   (`Integer -> String`) maps and their inverses. `get(id, isClientBound)` resolves an incoming ID to a
   packet name (`"UNKNOWN"` if absent). `serverBound(String name)` returns the ID for an outgoing
   packet, or `-1` if that name isn't defined for this version (used so injection/auto-reply code can
   skip packets a version doesn't have).

6. **Version branching for binary layout.** `VersionReporter` is the gate:
   - `isAtLeast(Version v)` compares the resolved `dataVersion` against `v.dataVersion`.
   - `select(Class<T>, Option...)` returns the supplier result of the first `Option` whose
     `Version` the current data version is at least (`Option`s are passed highest-first).
   - There's also a `static select(int dataVersion, ...)` overload that takes an explicit data version.

   The `Version` enum is the set of anchor points: each constant pairs a `protocolVersion` and a
   `dataVersion` representing the earliest release of that behavior family (e.g. `V1_13(341,1444)`,
   `V1_20_6(766,3839)`, `V1_21_5(770,4325)`, `V26_1(775,4786)`). Comments in the enum document why each
   anchor exists (e.g. 1.21.2/1.21.3 added a `worldBorderHit` boolean to serverbound Use Item On;
   1.21.5 changed chunk heightmaps from an NBT compound to a length-prefixed array).

7. **DataTypeProvider selection.** `DataTypeProvider.ofPacket(byte[])` uses
   `Config.versionReporter().select(...)` to instantiate the right reader subclass, highest version first:
   `DataTypeProvider_1_20_6` >= V1_20_6, `DataTypeProvider_1_20_2` >= V1_20_2, `DataTypeProvider_1_14`
   >= V1_14, `DataTypeProvider_1_13` >= V1_13, else the base `DataTypeProvider` (`Version.ANY`).
   Subclasses override format-sensitive readers, e.g. `DataTypeProvider_1_13.readSlot()` reads the
   1.13+ slot format and `DataTypeProvider_1_20_6.readSlot()` reads 1.20.5+ data-component item stacks.

The same `isAtLeast`/`select` pattern is reused widely across the codebase (chunk parsing, entity
metadata, equipment, chat, containers) to branch on version — `VersionReporter` is the central
version-aware decision point, not just protocol-table lookup.

### Protocol fixes baked into the readers

Several parsing correctness fixes live in the base `DataTypeProvider` and are version-relevant:

- `readVarLong` casts the 7-bit chunk to `long` before shifting so VarLongs longer than 5 bytes don't
  wrap at 32 bits.
- `readString` decodes the length-prefixed bytes as UTF-8 (not Latin-1) so Unicode names / chat /
  sign & NBT text aren't mangled.
- `readSlots` swallows `RuntimeException` (e.g. an unreadable 1.20.6+ data component) and keeps the
  slots captured so far; the packet is still forwarded to the client unchanged, so a parse miss only
  affects what's saved, never the live connection. `DataTypeProvider_1_20_6` raises
  `UnsupportedComponentException` for components it doesn't model yet, which this catch handles.

## Key files

- `src/main/resources/protocol-versions.json` — the data table: per protocol version, the game
  version string, `dataVersion`, and hex-keyed clientbound/serverbound packet name maps (47/1.8 through 775/26.1).
- `src/main/java/game/protocol/ProtocolVersionHandler.java` — loads the JSON (singleton, Gson hex
  `Integer` adapter), builds inverse maps, and implements `bestMatch` resolution by protocol or data version.
- `src/main/java/game/protocol/Protocol.java` — one version's packet tables; forward/inverse name<->ID
  lookups and `getVersion()`/`getDataVersion()`.
- `src/main/java/config/Version.java` — enum of version anchors (protocol + data version) used for
  `isAtLeast`/`select` branching; comments document why each boundary exists.
- `src/main/java/config/VersionReporter.java` — resolves a protocol version to a `Protocol`, exposes
  `getDataVersion()`, `isAtLeast(Version)`, and the `select(...)` helpers (instance + static).
- `src/main/java/config/Option.java` — `(Version, Supplier)` pair consumed by `VersionReporter.select`.
- `src/main/java/packets/DataTypeProvider.java` — base byte-stream reader; `ofPacket(...)` selects the
  version-specific subclass; contains the VarLong/UTF-8/slot-skip fixes.
- `src/main/java/packets/version/DataTypeProvider_1_13.java`, `DataTypeProvider_1_14.java`,
  `DataTypeProvider_1_20_2.java`, `DataTypeProvider_1_20_6.java` — version-specific reader overrides.
- `src/main/java/packets/handler/ServerBoundHandshakePacketHandler.java` — reads the protocol version
  from the handshake and calls `Config.setProtocolVersion`.
- `src/main/java/config/Config.java` — stores `protocolVersion`/`dataVersion`/`VersionReporter`;
  `getGameProtocol()` resolves and logs the active version; `versionReporter()` accessor.

## Configuration / flags

None. Protocol version is auto-detected from the client handshake at connect time; there is no CLI
flag or config key to pin or override it. The `protocol-versions.json` resource is the only
"configuration" surface, and it is a bundled application resource rather than a user setting. (The
default `Config.protocolVersion` is a constant placeholder until a real handshake arrives.)

## Usage

There is nothing to invoke directly. A user runs the downloader as a proxy and connects their
Minecraft client through it; the handshake the client sends carries its protocol version, which the
downloader picks up automatically. On connect, the console prints
`Using protocol of game version <version> (<protocolVersion>)` confirming which table was selected.

For developers adding a new Minecraft version:

1. Add a `"<protocolVersion>"` block to `protocol-versions.json` with `version`, `dataVersion`, and the
   clientbound/serverbound packet ID maps (hex string keys allowed).
2. If that version introduces a parsing change you branch on, add a `Version` enum constant (with its
   `protocolVersion` and `dataVersion`) and use `versionReporter().isAtLeast(...)` / `select(...)` at
   the affected parse sites; add a `DataTypeProvider_*` subclass if the byte layout changes.

## Verification

- **Unit tests.** `ProtocolVersionHandlerTest.bestMatch` asserts that a spread of protocol numbers
  (including unmapped in-between values like 340, 404, 498, 578, 754, 756, 758) resolve to the expected
  game version, exercising the best-match fallback.
- `Protocol26_1Test` asserts protocol `775` maps to `"26.1"`, that the serverbound packet IDs used by
  auto-open/auto-reply are present (`ChatMessage` == `0x08`, `UseItemOn`/`ContainerClose` present), and
  that `VersionReporter(775)` reports `isAtLeast` true for `V1_21_5`, `V1_21_3`, `V1_20_4`, and `V1_19`
  — i.e. 26.1 is wired to the same modern code paths verified on 1.21.8/1.21.11.
- `Config.setProtocolVersion` is driven by chunk tests (`ChunkTest`, `Chunk_1_8Test`) to exercise
  version-specific parsing.
- **Live/integration.** 26.1 (protocol 775) **cannot** be exercised by a live bot — mineflayer /
  minecraft-data have no 26.x protocol data (the `Protocol26_1Test` header documents this), so its
  support is verified by the wiring test above plus end-to-end coverage on 1.21.8/1.21.11 that share
  the same code paths. Other modern versions (notably 1.21.8 / 1.21.11) are covered by the project's
  live Paper + mineflayer integration harness.

## Gotchas & limitations

- **Best-match is lower-bounded, never upper.** An unknown newer protocol falls back to the highest
  known table **below** it. If a genuinely newer version renumbered packets or changed layouts, parsing
  can silently misread — there's no warning beyond `"UNKNOWN"` packet names and possible parse skips.
- **`UNKNOWN` / `-1` are silent.** `Protocol.get(...)` returns `"UNKNOWN"` for unmapped clientbound IDs
  and `serverBound(name)` returns `-1` for missing serverbound names; callers must handle these.
- **Anchor data-version mismatch.** `Version.V1_20_4` is declared `(765, 3698)` in `Version.java`, but
  `protocol-versions.json` lists protocol `765` with `dataVersion` `3700`. Since `isAtLeast` compares
  against the *resolved* data version from the JSON, the enum's `dataVersion` is only used as a
  threshold; this 3698-vs-3700 skew has not caused a known issue but is an inconsistency to be aware of.
- **26.1 packet IDs are borrowed.** Per the `Version` enum comment, protocol `775` (26.1) reuses the
  packet IDs of protocol `774` (1.21.11) because no machine-readable protocol data exists for 26.x yet;
  if 26.1 actually renumbered packets, the table would be wrong.
- **Several 1.13.2 / 1.17 entries are partial.** Some version blocks in the JSON omit packets present in
  neighboring versions (e.g. the `341`/1.13.2 block lists only a subset), so not every packet is
  name-resolvable on every version.
- **Slot parse failures are swallowed by design.** A container with an unmodeled 1.20.6+ data component
  is partially or not saved (handled gracefully), but there is no user-facing flag to surface that a
  capture was incomplete.
- **Detection is handshake-only.** The version is whatever the client advertises in the handshake;
  there is no validation against the actual server version.

## Open items

None known.
