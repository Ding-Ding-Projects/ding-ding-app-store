# API

## Codex Studio exposes no HTTP API

There is no web server, no REST or GraphQL endpoint, no gRPC service and no socket. Nothing in
this repository binds a port, and nothing in it accepts a request from another process.

**Therefore no Postman collection applies to this project**, and none is maintained. That is not
an omission to be filled in later — a Postman collection for a desktop app with no network surface
would be a fabricated artifact, and inventing one would be worse than having none.

## Where the real interface is documented

Codex Studio's only programmatic boundary is Electron IPC between the renderer and the main
process. All 55 commands — their arguments, return shapes, error strings, the `codex://stdout`
streaming channel and the security properties of each — are documented in:

### → [../architecture/ipc-bridge.md](app-doc://article/codex-material.repository.fbf656065cd7f1d8)

That is the file to read, to keep current, and to point a reviewer at when they ask "what is the
API surface?".

## How to be sure this is still true

```bash
# No HTTP server, no listener, no socket in the main process — expect no output
grep -rniE "express|fastify|koa|http\.createServer|net\.createServer|createServer|\.listen\(" electron/

# Every network-shaped call in the frontend — expect only same-origin ones
grep -rnE "fetch\(|XMLHttpRequest|WebSocket|EventSource" app/*.js app/index.html
```

The first must produce nothing. The second is **not** empty, and every hit is same-origin by
construction:

- `app/index.html` — `fetch("./CHANGELOG.md")` in `loadChangelog()`, a relative path resolved
  against the app's own `file://` origin, used only in browser-preview mode. Inside the shell the
  same method prefers the `codex_read_text` IPC command, because a `fetch()` under `file://` is
  refused before it reaches the disk.
- `app/support.js` — three hits, all in the generic `dc-runtime`: `fetch(location.href)` re-reads
  the app's **own** page to recover the unparsed template, plus a module loader and a
  sibling-component loader. The shipped app imports no external module and has no sibling
  components, so those last two paths are unused here.

Neither can reach another host: `connect-src 'self'` admits only the app's own origin, so an
absolute URL would be blocked by the browser regardless of what the code asked for. A review of a
new `fetch` should confirm the URL is relative, not that `fetch` is absent.

The whole runtime dependency list of the app is **`smol-toml`** (`package.json`); `electron` and
`electron-builder` are devDependencies. There is no HTTP framework and no HTTP client among them.

The frontend is held to the same standard by the Content Security Policy, which lives in a
`<meta http-equiv="Content-Security-Policy">` tag in `app/index.html`:

```
default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self';
img-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval';
connect-src 'self'; media-src 'self' data:; object-src 'none';
base-uri 'none'; form-action 'none'
```

A `fetch()` to any external host fails at the browser level, regardless of what the code intends.
React 18.3.1, Roboto, Roboto Mono, the dim sum photographs and every other asset are bundled under
`app/` for exactly this reason. (`'unsafe-eval'` is required by the template runtime, which
compiles the page's own logic script with `new Function` — see
[../architecture/frontend-runtime.md](app-doc://article/codex-material.repository.db80f8cc60983e2d#why-unsafe-eval-is-in-the-csp).)

`electron/main.js` closes the other direction: every `window.open` is denied and every
`will-navigate` to a non-`file://` URL is cancelled, with `http(s)` URLs handed to
`shell.openExternal` so a link opens in the user's real browser instead of inside the app.

## What this means for a contributor

- **Do not add an HTTP client** to reach an external service. If a feature needs data from
  outside, it comes from the `codex` CLI, which already owns authentication, proxying and the
  user's consent to talk to a network.
- **Do not add a local server** to bridge the renderer and the main process. `CODEX_BRIDGE.invoke`
  already exists, is allow-listed, and is not reachable from another process on the machine.
- **If an HTTP surface is ever genuinely added**, this page stops being accurate. At that point
  create `docs/api/<name>.md` describing it, add a real Postman collection exported from a working
  request set, and link it from this index and from the master
  [documentation index](app-doc://article/codex-material.repository.0b5ca119d2be595a).

## Related

| Page | Why |
| --- | --- |
| [../architecture/ipc-bridge.md](app-doc://article/codex-material.repository.fbf656065cd7f1d8) | The complete IPC command surface |
| [../architecture/overview.md](app-doc://article/codex-material.repository.e5a5102f18de6b16) | Why every capability is a real CLI invocation rather than a service call |
| ../build/packaging.md | What the installer actually contains |
