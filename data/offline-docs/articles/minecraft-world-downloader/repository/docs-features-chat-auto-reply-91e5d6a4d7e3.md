# Chat auto-reply

> Experimental, opt-in feature that watches incoming server chat for a configured coloured trigger and automatically echoes a different coloured part of the same message back to the server as a real chat message.

## What it does

When enabled with `--auto-reply`, the downloader inspects every clientbound chat message coming from the server. Within each message it concatenates the text runs of two configurable colours:

- the **trigger colour** (default `yellow`) — text that must exactly match `--auto-reply-trigger`, and
- the **reply colour** (default `red`) — text that is sent back to the server if the trigger matches.

If a message's trigger-coloured text matches the configured trigger (ignoring surrounding whitespace and double-quotes), the reply-coloured text from that same message is sanitized and sent back to the server as a normal, unsigned chat message.

The motivating case is a server line such as `You have been warned by Console for "<some phrase>"`, where the label is yellow and the phrase is red. With `--auto-reply-trigger "You have been warned by Console for"` the downloader will say the red phrase in chat automatically.

This is a real chat message visible to everyone on the server. It is rate-limited and de-duplicated to avoid spam and anti-cheat kicks.

## How it works

Architecture and flow:

1. **Packet interception** — `ClientBoundGamePacketHandler` registers operators for the chat packets. When `Config.autoReply()` is true:
   - `SystemChat` (1.19+ server/console messages): the content is read as NBT for 1.20.4+ (`provider.readNbtTag()` → `onComponentNbt`), otherwise as a JSON string (`provider.readString()` → `onComponentJson`). The version gate is `Config.versionReporter().isAtLeast(Version.V1_20_4)`.
   - `Chat` (legacy pre-1.19 packet for both system and player chat): the first field is read as a JSON string and passed to `onComponentJson`.
   - In both cases the operator only **reads** the content for matching and always returns `true`, so the original packet is still forwarded to the client unchanged. All parsing is wrapped in a try/catch that swallows exceptions so chat parsing can never break the packet stream or the client's chat display.

2. **Component flattening** — `AutoChatReply` flattens the chat component into an ordered list of `Run(color, text)` records:
   - `flattenNbt` handles `StringTag`, `ListTag`, and `CompoundTag` (reading `text`, `color`, and recursing into `extra`).
   - `flattenJson` is the JSON-string counterpart (primitives, arrays, and objects with `text`/`color`/`extra`).
   - Both inherit the parent's colour when a child component does not set its own `color`, mirroring how the vanilla client renders nested components.

3. **Matching (`computeReply`)** — pure, side-effect-free matching (visible for testing):
   - Iterates the runs; runs whose colour equals `--auto-reply-trigger-color` are concatenated into the trigger text, runs whose colour equals `--auto-reply-color` into the reply text (colour comparison is case-insensitive; runs with no colour are skipped).
   - Returns `null` if the trigger is null/blank, if there is no reply-coloured text, or if the trigger text does not match.
   - `matches` compares via `normalize`, which trims whitespace and strips surrounding double-quotes from both sides, then compares case-insensitively.
   - On a match, the reply text is passed through `sanitize` (drops control characters and the section sign `§`, converts newlines to spaces, trims, and clamps to 256 chars — the Minecraft chat limit). A reply that sanitizes to empty yields `null`.

4. **Sending (`trySend` → `sendChat`)** — guarded sending:
   - **Rate limit**: skips if less than `Config.autoReplyDelayMs()` has elapsed since the last send.
   - **De-dupe**: skips an identical reply that recurs within a fixed `DEDUPE_WINDOW_MS` (5000 ms) loop/repeat guard.
   - `sendChat` resolves the serverbound `ChatMessage` packet id via `Config.versionReporter().getProtocol().serverBound("ChatMessage")`. If the id is `< 0` or `Config.getServerBoundInjector()` is null, it prints a one-time "not supported for this game version" warning and returns false.
   - **Version branching for the packet body**: before 1.19 the packet is just the message string. From `Version.V1_19` it additionally writes a timestamp, salt `0`, a `false` signature flag (the message is sent **unsigned**), a varint `0` for acknowledged-messages, and a fixed 3-byte acknowledged bitset. From `Version.V1_21_5` it also writes a single acknowledgement checksum byte.
   - The built `PacketBuilder` is injected toward the server via `Config.getServerBoundInjector().enqueuePacket(packet)`. On success it records the timestamp/last reply and, if `Config.sendInfoMessages()` is true, prints `[auto-reply] sent: <reply>`.

The single `AutoChatReply` instance is lazily created and held by `WorldManager` (`getAutoChatReply()`); its `trySend` is `synchronized`. The serverbound injector used to originate packets toward the server is registered in `ConnectionManager` via `Config.registerServerBoundInjector(...)`.

## Key files

- `src/main/java/game/data/chat/AutoChatReply.java` — the feature itself: component flattening (NBT + JSON), colour-run matching, sanitization, rate-limit/de-dupe, and version-aware serverbound `ChatMessage` packet construction.
- `src/main/java/packets/handler/ClientBoundGamePacketHandler.java` — registers the `SystemChat` and `Chat` operators that feed incoming chat into `AutoChatReply` (gated on `Config.autoReply()`), choosing NBT vs JSON by version, and forwarding the original packet unchanged.
- `src/main/java/config/Config.java` — defines the `--auto-reply*` CLI options and their accessors (`autoReply()`, `autoReplyTrigger()`, `autoReplyDelayMs()`, `autoReplyTriggerColor()`, `autoReplyColor()`), plus the serverbound injector registry.
- `src/main/java/game/data/WorldManager.java` — lazily creates and holds the singleton `AutoChatReply` instance (`getAutoChatReply()`).
- `src/main/java/proxy/ConnectionManager.java` — registers the serverbound packet injector that `AutoChatReply` uses to send chat to the server.
- `src/test/java/game/data/chat/AutoChatReplyTest.java` — unit tests for the matching/normalization logic.

## Configuration / flags

All options are also configurable in the **jar GUI** (JavaFX settings → **Extras** tab, bound in
`gui/GuiSettings.java`) and the web console, not just the CLI.

All flags are defined in `Config.java`:

- `--auto-reply` (boolean, default `false`) — master opt-in switch. EXPERIMENTAL. When an incoming chat message's trigger-coloured text matches `--auto-reply-trigger`, send that message's reply-coloured text back to the server. Sends real chat; servers enforcing secure chat may reject it.
- `--auto-reply-trigger` (string, default `""`) — the exact trigger-coloured text that triggers an auto-reply (surrounding spaces/quotes ignored). Required for `--auto-reply` to do anything; a blank trigger never matches.
- `--auto-reply-delay` (int ms, default `1500`) — minimum milliseconds between auto-replies. The accessor `autoReplyDelayMs()` enforces a floor of `250` ms (`Math.max(250, ...)`).
- `--auto-reply-trigger-color` (string, default `yellow`) — colour of the text that must match `--auto-reply-trigger`. Can be any Minecraft colour name. Falls back to `yellow` if null/blank.
- `--auto-reply-color` (string, default `red`) — colour of the text that is sent back as the reply. Falls back to `red` if null/blank.

Non-configurable internal constants in `AutoChatReply.java`: `DEDUPE_WINDOW_MS = 5000` (identical-reply suppression window) and `MAX_MESSAGE_LENGTH = 256` (chat length clamp).

## Usage

Run the downloader with the feature enabled and a trigger string. For the motivating warn-format case:

```
--auto-reply --auto-reply-trigger "You have been warned by Console for"
```

With that configuration, when the server sends a message whose yellow text is `You have been warned by Console for` (with or without a trailing quote/spaces) and whose red text is some phrase, the downloader automatically sends that red phrase back to the server in chat.

To match differently-coloured messages, override the colours, e.g.:

```
--auto-reply --auto-reply-trigger "Echo this:" --auto-reply-trigger-color gold --auto-reply-color white
```

Optionally tune the rate limit with `--auto-reply-delay <ms>` (minimum effective value 250).

Note that flags can also be persisted via the config file (`cache/config.json`); these are standard args4j options like the rest of the app's settings.

## Verification

- **Unit tested** (`AutoChatReplyTest.java`): the matching/normalization logic is covered via `computeReplyFromJson`, including: the warn-format yellow+red case, normalization that ignores surrounding quotes/spaces (with and without quotes in the trigger), colour inheritance from a parent component, no reply when the yellow text does not match, no reply when there is no red text, no reply when the trigger is blank/null, and plain (uncoloured) string components not matching.
- These tests exercise the pure JSON path and matching logic only. The NBT flattening path (`flattenNbt`/`onComponentNbt`), the actual send path (`trySend`/`sendChat`, including rate-limit/de-dupe and version-specific packet bytes), and end-to-end packet interception are **not** covered by these unit tests — they are effectively compile-only / runtime-exercised rather than verified by automated tests in this file.

## Gotchas & limitations

- **Sends a real, public chat message.** The reply is visible to everyone on the server. Use only where permitted.
- **Messages are sent UNSIGNED.** Servers that enforce secure chat (vanilla `enforce-secure-profile=true`) may reject the message and disconnect you. Most plugin/offline servers accept unsigned chat.
- **Exact match only.** The trigger must match the concatenated trigger-coloured text exactly (case-insensitive, after trimming whitespace and stripping surrounding double-quotes). Partial/substring/regex matching is not supported.
- **Colour-dependent.** Matching relies entirely on the configured trigger and reply colours appearing as the component `color`. If the server's message does not use those colours (or uses inherited colours that don't resolve to them), nothing matches. Runs with no colour are ignored.
- **Sanitization alters the reply.** The section sign `§` and control characters are stripped, newlines become spaces, and the message is clamped to 256 characters, so the sent text may differ from the original red text.
- **Version support for sending.** If the serverbound `ChatMessage` packet id is unknown for the running protocol version (or no serverbound injector is registered), sending is silently skipped after a single warning. The packet body is version-branched at 1.19 and again at 1.21.5.
- **Single shared instance with cross-message state.** The rate-limit timestamp and last-reply de-dupe are stored on one shared `AutoChatReply` instance, so they apply globally across all incoming chat, not per trigger or per message source.

## Open items

None known.
