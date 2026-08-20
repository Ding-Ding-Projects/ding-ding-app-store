# Ported features (heads, modded colours, voice)

> Three independent map/proxy enhancements ported into this fork: player head rendering on the map, map colouring for modded (non-`minecraft:`) blocks, and a transparent UDP proxy for Simple Voice Chat / PlasmoVoice.

## What it does

This document covers three loosely-related features that share the theme of making the downloader work better against real (often modded) servers:

1. **Player heads on the map** — other players seen in the world are drawn on the GUI overview map using their actual Minecraft skin (face + hat overlay) instead of a plain coloured dot. Skins are resolved from the Mojang profile/skin API and cached in memory and on disk.
2. **Modded block colours** — blocks that are not in the bundled vanilla `block-colors.json` palette (i.e. blocks from mods, with a non-`minecraft:` namespace) get a map colour so they render on the overview map instead of staying transparent. The colour is taken from the block's texture inside the mod JAR when possible, otherwise a deterministic per-name colour.
3. **Voice chat proxy** — when the Minecraft client connects through the downloader's MITM proxy, voice mods (Simple Voice Chat, PlasmoVoice 2.x) normally cannot reach the server's voice UDP endpoint. This feature intercepts the voice plugin-channel packets, stands up a localhost UDP relay to the real voice server, and rewrites the advertised host so the client's voice mod connects through the relay.

## How it works

### Player heads

`game.data.entity.PlayerEntity` tracks a player entity and owns the skin-loading logic. Loading is kicked off eagerly in the constructor (`ensureProfileLoaded()`), so the image is usually ready before the player is drawn.

Loading strategy, fastest path first (documented in the class header):

1. **Memory cache** — `skinCache` (`Map<String, Image>` keyed by hyphenated UUID), static so it survives reconnects within one run.
2. **Disk cache** — `cache/heads/{hyphenated-uuid}.png` (a raw 64×64 skin PNG). If present and loads without error, it is put into the memory cache. If the player's name isn't already known, a name-only profile fetch is fired (`fetchProfileForName`).
3. **Full profile fetch** (`fetchFullProfile`) — async GET to `https://sessionserver.mojang.com/session/minecraft/profile/{uuid}`. The JSON `properties[]` entry named `textures` is Base64-decoded to find `textures.SKIN.url`; the skin PNG is then downloaded from the CDN (asynchronously via Unirest), written to the disk cache, and put into the memory cache.

A session-wide `knownNames` map caches resolved names. `getSkinImage()` returns the cached `Image` or `null` while loading.

`gui.GuiMap.drawOtherPlayer()` consumes this: if `getSkinImage()` is non-null it draws a white 1-px border, the face layer from skin source region `(8,8)-(15,15)`, then the hat overlay from `(40,8)-(47,15)` on top — each scaled to 16×16. While the skin is still loading it falls back to a small coloured dot. The player's name is drawn as a hover tooltip when the cursor is near and the name is known.

### Modded block colours

`game.data.chunk.palette.BlockColors.getColor(key)` is the lookup used to colour the map. After exhausting the vanilla palette and the existing derivation rules (carpet→wool, stairs/slabs→base block, walls/fences/fence gates→base material), it has a final branch:

```
if (Config.moddedBlockColors() && key.contains(":")
        && !key.startsWith("minecraft:") && !key.endsWith("air")) {
    return ModdedBlockColorExtractor.getInstance().getColor(key);
}
return SimpleColor.BLACK;
```

So only modded (namespaced, non-`minecraft:`, non-air) blocks are routed to the extractor; vanilla blocks missing from the palette stay `BLACK` (transparent, so the surface scanner sees through them).

`game.data.chunk.palette.ModdedBlockColorExtractor` is a singleton with a per-block-name colour cache (`computeIfAbsent`, resolved once per session). Resolution (`resolve`) tries two strategies in order:

1. **Texture extraction** (`tryExtractTexture`): splits `modId:name`, strips any block-state suffix like `[facing=north]`, then looks the mod's JAR up in `modJars`. It tries texture paths from most to least specific: `assets/<modId>/textures/block/<name>.png`, then `_top.png`, `_all.png`, and the older-Forge plural `assets/<modId>/textures/blocks/<name>.png` / `_top.png`. For the first one that exists it reads the PNG (`ImageIO`) and returns `averageColor` — the average RGB of all pixels with alpha > 128.
2. **Hash fallback** (`hashColor`): a deterministic mid-range pastel colour derived from `blockName.hashCode()`, each channel in the 90–217 range, so the block is always visible and never `BLACK`.

JAR discovery (`ensureJarsScanned`) is lazy and synchronized: it lists `*.jar` under `<defaultMinecraftPath>/mods` and, for each JAR, indexes every asset namespace (`assets/<id>/...`, excluding `minecraft`) → that JAR file. One JAR can map multiple mod IDs. Both texture and hash resolutions are logged to stdout with the resolved RGB.

To avoid stalling chunk rendering, `Config.loadVersionRegistries` calls `ModdedBlockColorExtractor.getInstance().preloadAsync()` (a daemon thread that pre-scans the mods directory) when `moddedBlockColors()` is enabled.

### Voice chat proxy

Server→client `CustomPayload` packets are dispatched through `packets.handler.plugins.PluginChannelHandler`, which is version-selected: `PluginChannelHandler1_12` for ≤1.12 (handles only the Forge `FML|HS` handshake channel and always forwards), and `DefaultPluginChannelHandler` for everything else (1.13+ namespaced channels).

`DefaultPluginChannelHandler.handleCustomPayload` reads the channel string and delegates to `VoiceProxyManager.getInstance().handleChannel(channel, provider)`. The boolean return propagates up through `ClientBoundGamePacketHandler`'s `CustomPayload` operation: `true` forwards the original packet to the client, `false` drops it (because a rewritten replacement was injected).

`proxy.voicechat.VoiceProxyManager` (singleton):

- Returns `true` immediately (forward unchanged) if `Config.enableVoiceProxy()` is false.
- Routes `voicechat:*` channels to `handleSimpleVoiceChat` and `plasmo:voice*` to `handlePlasmoVoice`.

**Simple Voice Chat** (`voicechat:player_state`): parses `secret` (2 longs), `host` (String), `port` (int), and copies the remaining bytes verbatim. It starts a UDP proxy to the resolved remote host (empty/localhost host → real server host from `Config.getConnectionDetails().getHost()`, otherwise the advertised host) on `port`. If the advertised host is non-empty and not localhost, it rebuilds the `CustomPayload` with the host string blanked (`""`, i.e. "use the Minecraft server address"), enqueues it via `Config.getPacketInjector().enqueuePacket(...)`, and returns `false` to drop the original.

**PlasmoVoice 2.x** (`plasmo:voice/v2`): reads a leading VarInt type id and only handles the server-connection packet (`typeId == 0x01`); other types are forwarded. It parses `secret` (2 longs), 1 unknown byte, `host` (String, where `"0.0.0.0"` means "use server address"), `port` (int), and verbatim tail. It starts the UDP proxy (`useServerAddr` → `Config.getConnectionDetails().getHost()`, else the host). If the host was a real non-localhost address, it rewrites the host to `"0.0.0.0"`, re-injects, and returns `false`.

`startProxy(remoteHost, port)` lazily creates one `UdpProxy(remoteHost, port, port)` per port (`proxies` map keyed by port; `computeIfAbsent`). Note the **local and remote ports are identical** — the relay listens on `0.0.0.0:<port>` and forwards to `remoteHost:<port>`.

`proxy.voicechat.UdpProxy` is a bidirectional relay: a daemon listener thread on `0.0.0.0:localPort` forwards each client datagram to `remoteHost:remotePort`, creating one outbound socket per distinct client `SocketAddress` and spawning a daemon relay thread per session to send server responses back. Sessions time out after 60 s of server silence (`SESSION_TIMEOUT_MS`) and are cleaned up.

On connection reset, `proxy.ConnectionManager.reset()` calls `VoiceProxyManager.getInstance().reset()` (stops all UDP proxies and clears the map) and `PluginChannelHandler.reset()` (so the version-specific handler is re-selected on reconnect).

## Key files

- `src/main/java/game/data/entity/PlayerEntity.java` — player entity; skin/head loading (memory → disk `cache/heads/{uuid}.png` → Mojang profile + skin CDN), name cache, profile JSON parsing.
- `src/main/java/gui/GuiMap.java` — `drawOtherPlayer()` renders the skin face + hat overlay (or a fallback dot) and the name-on-hover tooltip.
- `src/main/java/game/data/chunk/palette/BlockColors.java` — vanilla palette lookup and derivation rules; routes modded (non-`minecraft:`) blocks to the extractor when enabled.
- `src/main/java/game/data/chunk/palette/ModdedBlockColorExtractor.java` — singleton that resolves modded block colours via mod-JAR texture averaging, with a hashed-name fallback; lazy JAR indexing and async preload.
- `src/main/java/proxy/voicechat/VoiceProxyManager.java` — intercepts SVC / PlasmoVoice plugin-channel packets, starts the relay, rewrites the advertised host, re-injects.
- `src/main/java/proxy/voicechat/UdpProxy.java` — bidirectional per-client UDP relay (localhost → real voice server) with idle session cleanup.
- `src/main/java/packets/handler/plugins/PluginChannelHandler.java` — version-selected `CustomPayload` dispatch; `DefaultPluginChannelHandler` delegates to `VoiceProxyManager`.
- `src/main/java/packets/handler/plugins/PluginChannelHandler1_12.java` — ≤1.12 handler (Forge `FML|HS` only; always forwards, no voice handling).
- `src/main/java/packets/handler/ClientBoundGamePacketHandler.java` — registers the `CustomPayload` operation; forwards/drops based on the handler's boolean return.
- `src/main/java/config/Config.java` — flags, accessors, and the `preloadAsync()` hook; `getDefaultMinecraftPath()` (mods directory base).
- `src/main/java/proxy/ConnectionManager.java` — resets the voice proxy and plugin-channel handler on disconnect.

## Configuration / flags

Player heads: **none** — there is no flag; head rendering is always on in the GUI map. (The on-disk cache lives at `cache/heads/`.)

Modded block colours:
- `--modded-block-colors` — render modded (non-`minecraft:`) blocks by extracting texture colours from JARs in `.minecraft/mods`, falling back to a deterministic per-name colour. Backing field `moddedBlockColors` defaults to **true** (on by default).
- `--disable-modded-block-colors` — turn the feature off; modded blocks then stay transparent. Backing field `disableModdedBlockColors` defaults to false.
- Effective state: `Config.moddedBlockColors()` returns `moddedBlockColors && !disableModdedBlockColors`.

Voice proxy:
- `--enable-voice-proxy` — transparently proxy Simple Voice Chat / PlasmoVoice UDP traffic through localhost. Backing field `enableVoiceProxy` defaults to **false** (opt-in). Accessor `Config.enableVoiceProxy()`. The voice port is auto-detected from the plugin-channel packets; there is no port flag.

## Usage

- **Player heads**: launch the downloader and open the GUI map; other players in range are drawn with their skin head automatically. First appearance may briefly show the fallback dot until the skin downloads; subsequent sessions are fast thanks to the `cache/heads/` PNG cache. Requires outbound access to Mojang's session server and the skin CDN.
- **Modded block colours**: on by default. The downloader reads mod JARs from the Minecraft `mods` directory under the platform default path (`%APPDATA%/.minecraft/mods` on Windows, `~/.minecraft/mods` on Linux, the macOS equivalent). Make sure the relevant mod JARs are present there so textures (not just hashed colours) are used. Pass `--disable-modded-block-colors` to keep modded blocks transparent.
- **Voice proxy**: start the downloader with `--enable-voice-proxy` and connect your Minecraft client (with Simple Voice Chat or PlasmoVoice installed) through the downloader proxy as usual. When the server sends the voice info packet, the relay is set up automatically and the client's voice mod connects to the server's voice channel via localhost.

## Verification

- No dedicated JUnit tests exist for these three features (grep of `src/test/java` for `VoiceProxy`, `ModdedBlockColor`, `PlayerEntity`, `getSkinImage`, `moddedBlockColors`, `enableVoiceProxy` finds none). Verification is therefore via the live integration test harness (Paper + mineflayer) and manual play, not unit tests.
- Behaviour documented here is read directly from the source and is at least compile-checked as part of the normal build.
- The voice and modded-colour paths emit `System.out` diagnostics (`[VoiceProxy] ...`, `[ModdedColors] ...`) that can be used to confirm at runtime that the relay started / the texture vs. hash branch was taken.

## Gotchas & limitations

- **Player heads** require network access to Mojang APIs; offline/cracked-UUID players or API failures simply leave the fallback dot (failures are swallowed silently in the async callbacks). There is no cache eviction or invalidation — a skin change won't be picked up while a cached PNG exists. The feature is GUI-only and has no flag to disable it.
- **Modded colours**: texture extraction only works if the mod JAR is actually present in the local `mods` directory under the default Minecraft path; servers that distribute resources differently (resource packs, data-only mods, non-standard texture paths) fall through to the hashed colour. Only the listed texture-path candidates are tried (`textures/block[s]/<name>[.png|_top.png|_all.png]`), so blocks whose model texture has a different basename get a hashed colour. The hash fallback is intentionally never `BLACK`, so a modded block is always treated as solid/visible even if its colour is arbitrary. Per-name colour and JAR index are cached for the whole session — newly added mods aren't picked up mid-run.
- **Voice proxy**: the relay binds local port == remote port, so it cannot work if that UDP port is already in use locally or differs between client and server expectations. PlasmoVoice handling is specific to 2.x and only `typeId == 0x01`; other PlasmoVoice versions/packets aren't rewritten. The host-rewrite only fires when the server advertised a real non-localhost host; servers already advertising an empty/localhost/`0.0.0.0` host are forwarded unchanged (the relay still starts, pointing at the connection host). Parse failures fall back to forwarding the original packet.

## Open items

None known.
