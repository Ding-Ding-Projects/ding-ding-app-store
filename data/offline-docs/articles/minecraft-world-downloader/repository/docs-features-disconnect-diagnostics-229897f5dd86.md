# Disconnect diagnostics

> Human-readable, `[disconnect]`-tagged console logging that explains *why* a proxied connection dropped — at the socket layer, during login, during encryption/auth, and during in-game play.

## What it does

When you play through the world-downloader proxy, a dropped connection used to be hard to diagnose: the client would simply return to the server list, often with no useful message, while the proxy printed either nothing or a bare stack trace. This feature adds targeted, plain-English logging at every place a connection can die, so the console tells you which side closed, at what stage, and (where available) the server's stated reason.

All of these messages share a `[disconnect]` prefix so they are easy to spot and grep. The categories covered:

- **Socket-level closes** (client or server side) — distinguishing a clean/normal close from a real error, and suppressing noisy stack traces for benign closes (e.g. the routine server-list ping resetting the socket on Windows).
- **Login rejection** — the server refusing the login outright (`LoginDisconnect`), which is the usual cause of an "instantly disconnected" join (wrong version, not whitelisted, anti-bot plugin, etc.). Both readable and raw reasons are printed.
- **Encryption / authentication failures** — the proxy must authenticate your Minecraft session with an online-mode server; if that fails the connection is closed here with an explanation pointing at sign-in / `--token`.
- **In-game (PLAY-phase) kicks** — the server kicking you *after* a successful login (`Disconnect`), printed with the kick reason.

It is purely diagnostic: it never changes packet routing. Where a disconnect-related packet is observed, it is still forwarded to the client so the vanilla disconnect screen behaves normally.

## How it works

### Socket layer — `ProxyServer`

`ProxyServer.run()` runs the accept loop and spawns two pumps over the bidirectional proxy:

- A **client listener thread** (`"Proxy Client Listener"`) reading `streamFromClient` and forwarding to `onServerBoundPacket`.
- The **main thread** reading `streamFromServer` and forwarding to `onClientBoundPacket`.

Each pump distinguishes three outcomes:

1. **Clean EOF** (`read()` returns `-1`): the peer closed its stream normally. Logged as `[disconnect] client closed the connection...` / `[disconnect] server closed the connection...`. The server-side EOF note also mentions this often happens right after a kick/Disconnect.
2. **Benign abrupt close**: a `Throwable` whose message matches `isBenignClose(...)`. Logged as a one-liner with the message, **no stack trace**.
3. **Real error**: any other `Throwable`. Logged as a `... connection error: ...` line **plus** a stack trace, then `connectionManager.reset()` is called.

`isBenignClose(Throwable)` lowercases the exception message and returns `true` for any of: `connection reset`, `socket closed`, `socket is closed`, `broken pipe`, `connection abort`, `an existing connection was forcibly closed`, `connection was aborted`. The accompanying comment notes this is largely a Windows concern, where a peer close (including the routine server-list ping) surfaces as a `SocketException "Connection reset"` rather than a clean EOF.

Robustness details that support diagnostics:
- The pump `catch` blocks catch `Throwable` (not just `Exception`) specifically so an `Error` thrown while handling a packet cannot unwind `run()` and silently kill the proxy thread — which would otherwise leave the client to time out with no log. The comment in the accept-loop `try` makes this explicit.
- After the client pump ends it closes `streamToServer`; after the server pump ends it closes `streamToClient`, so a close on one side tears down the other.
- On a real error, `connectionManager.reset()` resets encryption, compression, both data readers, network mode, world/voice/plugin-channel state so the next connection starts clean.

### Login phase — `ClientBoundLoginPacketHandler`

The `LoginDisconnect` operator reads the refusal reason (a chat-component string) and prints two lines:

- `[disconnect] server rejected the login: <readable text>`
- `[disconnect] raw reason: <raw json>`

Readable text is produced by the private `chatText(String json)` helper, a best-effort extractor that regex-matches all `"text":"..."` fields in the component JSON, concatenates them, collapses `\n` to spaces, and falls back to the raw string if nothing is extracted or parsing throws. The operator returns `true` (packet forwarded), so the client still shows the rejection.

### Encryption / auth phase — `EncryptionManager`

`disconnectOnError(String what, IExceptionHandler r)` wraps an auth/encryption step. On exception it prints:

```
[disconnect] <what> failed: <exception> — online-mode servers require you to be signed in to a valid Minecraft account (see Authentication / sign in via the web console or --token). Closing the connection.
```

then prints the stack trace, closes both `streamToServer` and `streamToClient`, and returns `false`. Callers check the return and bail out early. It is used to guard:

- `clientAuthenticator.makeRequest(...)` — *"authenticating your account with the server"* (in `sendReplacementEncryptionConfirmation` and the 1.19 profile-key path).
- `new ServerAuthenticator(username).makeRequest(...)` — *"verifying the connecting client"* (same two paths).

This is the diagnostic for the common "instantly disconnected against an online-mode server because you weren't signed in" case. Note: this guarded handling is distinct from the unrelated private `attempt(...)` helper in the same class, which on failure prints `Encryption failure! Terminating.` and calls `System.exit(1)`.

### In-game (PLAY) phase — `ClientBoundGamePacketHandler`

The `Disconnect` operator handles a kick received after login. It reads the reason and prints `[disconnect] server kicked you in-game: <reason>`. If the reason cannot be read it prints `[disconnect] server sent an in-game Disconnect (reason could not be read)`. The operator always returns `true` so the packet is forwarded and the client shows its disconnect screen.

### Version branching

- **Login `LoginDisconnect` reason** is read as a plain string across versions; `chatText` then parses the embedded component JSON.
- **PLAY `Disconnect` reason** format depends on version: `Config.versionReporter().isAtLeast(Version.V1_20_4)` reads it as an NBT tag (`provider.readNbtTag()` → `String.valueOf(...)`), otherwise as a JSON string (`provider.readString()`).
- **Encryption request `Hello`**: for `>= V1_20_6` an extra `shouldAuthenticate` boolean is read and passed through; the replacement encryption request mirrors that boolean. When `shouldAuthenticate` is false the auth steps in `sendReplacementEncryptionConfirmation` are skipped (so no auth-failure diagnostic fires for that connection).
- The benign-close classification and socket-level logging in `ProxyServer` are version-independent.

## Key files

- `src/main/java/proxy/ProxyServer.java` — socket-layer disconnect logging; clean-EOF vs benign-close vs real-error classification; `isBenignClose(...)`; `Throwable`-catching pumps that keep the proxy alive.
- `src/main/java/packets/handler/ClientBoundLoginPacketHandler.java` — `LoginDisconnect` logging (readable + raw); `chatText(...)` component-text extractor.
- `src/main/java/proxy/EncryptionManager.java` — `disconnectOnError(...)` auth/encryption failure logging and connection teardown; wraps client/server authenticator calls.
- `src/main/java/packets/handler/ClientBoundGamePacketHandler.java` — PLAY-phase `Disconnect` (in-game kick) logging with version-dependent NBT/JSON reason parsing.
- `src/main/java/proxy/ConnectionManager.java` — `reset()` invoked after a real connection error to clean state for the next connection.

## Configuration / flags

None specific to this feature. It is always-on diagnostic logging; there is no flag to enable, disable, or change its verbosity.

The auth-failure message references the existing `--token` option (`-t`, `Config.accessToken`, defined in `src/main/java/config/Config.java`) as one way to supply credentials, but that flag is part of authentication, not of the diagnostics feature itself.

## Usage

There is nothing to invoke. Run the proxy as usual and connect your client to `localhost:<local-port>` instead of the real server. When a connection drops, watch standard output for `[disconnect]`-tagged lines. Filtering the console for `[disconnect]` surfaces every disconnect-related event:

- `[disconnect] server rejected the login: ...` / `raw reason: ...` — refused at login (version/whitelist/auth/anti-bot).
- `[disconnect] ... failed: ... online-mode servers require you to be signed in ...` — authentication/encryption failure; sign in (web console) or pass `--token`.
- `[disconnect] server kicked you in-game: ...` — kicked after joining.
- `[disconnect] client/server closed the connection ...` — normal or abrupt socket close (benign closes are one-liners; real errors include a stack trace).

## Verification

- The repository builds with the project's JDK 21 toolchain (see the build-environment memory note).
- The disconnect messaging is straightforward, branch-light logging added at existing packet operators and socket read loops; it does not alter packet routing (all relevant operators return `true` to keep forwarding, or close streams on hard auth failure).
- A live integration harness exists (Paper + mineflayer, per the integration-test-harness memory note) capable of exercising real connect/disconnect flows, but this doc does not assert that each individual `[disconnect]` branch has a dedicated automated test. Treat socket-level benign-close classification and the version-specific reason parsing as compile-and-reason verified unless confirmed against a live run.

## Gotchas & limitations

- **Diagnostic only.** No retry, reconnect, or recovery — it explains the drop, it does not prevent it.
- **Benign-close detection is message-string based.** `isBenignClose` matches on lowercased exception text. A localized JVM or an unanticipated phrasing of "connection reset" could be misclassified as a real error (extra stack trace) rather than benign. It is deliberately tuned for Windows wording.
- **`chatText` is best-effort.** It only extracts `"text"` fields via regex; reasons expressed solely through `translate` keys, `extra` arrays without `text`, or other component shapes fall back to printing the raw JSON. The raw reason is always printed alongside, so no information is lost.
- **PLAY `Disconnect` reason parsing is version-gated** on `V1_20_4`; if a server sends an unexpected encoding the handler degrades to the generic "reason could not be read" line rather than failing.
- **Auth-failure path vs. fatal encryption path differ.** `disconnectOnError` logs and gracefully closes the connection; the separate `attempt(...)` helper in `EncryptionManager` still calls `System.exit(1)` on a true encryption fault, which terminates the whole process rather than just the connection.
- **Logs go to stdout/stderr only.** There is no structured log file or in-UI surface for these messages.

## Open items

- **1.12.2 online-mode disconnect (server-side; tracked in `../../handoff.md`).** Investigated against
  the author's upstream: the proxy's 1.12.2 handshake/login/encryption path is equivalent to upstream and
  **offline 1.12.2 works end-to-end**, so the instant disconnect on a specific online-mode server is a
  server-side event (likely a version mismatch, ViaVersion, or a BungeeCord/Velocity layer resetting the
  connection) — not a downloader bug. The decision was to **fix the real cause and keep all features** (no
  revert to upstream). These diagnostics exist precisely to capture the cause; the next step is reading
  the on-join `[disconnect]` line / client disconnect screen and confirming the server version + any
  fronting proxy / Via setup.
