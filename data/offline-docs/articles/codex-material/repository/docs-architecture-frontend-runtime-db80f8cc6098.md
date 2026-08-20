# The frontend runtime

> How `app/index.html` — one `<x-dc>` template plus one `DCLogic` subclass — becomes a rendered
> React tree, and what it takes to add a panel.

## The two halves of `index.html`

```html
<head>
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; …">
  <script src="./vendor/react.production.min.js"></script>
  <script src="./vendor/react-dom.production.min.js"></script>
  <script src="./support.js"></script>
</head>

<x-dc>
  <helmet>
    <style>/* M3 tokens, @font-face, keyframes */</style>
    <script src="codex-data.js"></script>
    <script src="cx-i18n.js"></script>
    …
    <script src="codex-core.js"></script>
  </helmet>

  <div>… markup with {{ bindings }}, sc-for, sc-if …</div>
</x-dc>

<script type="text/x-dc" data-dc-script>
  class Component extends DCLogic {
    state = { … };
    componentDidMount() { … }
    renderVals() { return { /* everything the template reads */ }; }
  }
</script>
```

`app/support.js` (the generated `dc-runtime`) finds the `<x-dc>` element and the
`script[data-dc-script]`, compiles the template once into React element builders, evaluates the
script and mounts the resulting class.

The script **must** define `class Component extends DCLogic`. If it does not, the runtime reports
`` must define `class Component extends DCLogic` `` and renders nothing.

`<helmet>` content is hoisted into the document head, which is why the CSS custom properties and
the `cx-*.js` modules are in place before the component mounts.

## React is vendored, and loaded first

`app/vendor/` holds the React **18.3.1** production UMD builds and `LICENSE.react`. `support.js`
reads `window.React` and `window.ReactDOM` and throws
`dc-runtime: window.React is not available yet` when either is missing, so the two `<script>` tags
must stay ahead of it in `<head>`. Nothing is fetched from a CDN: the CSP would refuse it, and the
app makes no network request at runtime at all.

Rendering is ordinary React — `React.createElement` for every compiled node, `ReactDOM` to mount.
The `dc` layer is a compiler in front of it, not a replacement for it.

## Why `'unsafe-eval'` is in the CSP

The policy is a `<meta http-equiv="Content-Security-Policy">` tag in `app/index.html`:

```
default-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self';
img-src 'self' data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval';
connect-src 'self'; media-src 'self' data:; object-src 'none';
base-uri 'none'; form-action 'none'
```

`'unsafe-eval'` is there for exactly one reason: `evalDcLogic()` in `app/support.js` compiles the
page's own `<script data-dc-script>` block with `new Function("DCLogic", "StreamableLogic",
"React", src)`. That source is a first-party file bundled into the installer — never fetched,
never user-supplied, never CLI output. Without the exemption the app refuses to run its own
bundled code and the window renders blank, which is exactly what happened before it was added
(see the *Fixed* section of `CHANGELOG.md`).

`connect-src 'self'` and `default-src 'self'` are what keep the exemption survivable: there is no
origin the page could load code from even if a future change tried. Do not add a code path that
evaluates text from disk, from the CLI's output or from a config file.

## `DCLogic`

`DCLogic` (internally `StreamableLogic`) is a small base class — **not** `React.Component`:

| Member | Behaviour |
| --- | --- |
| `this.props` | Props passed to the mount, merged **under** `renderVals()`. |
| `this.state` | A plain object. Declare it as a class field. |
| `this.setState(patch, cb)` | Forwards to the host React component; same shallow-merge semantics as React. |
| `this.forceUpdate()` | Re-render without a state change. |
| `componentDidMount()` / `componentDidUpdate(prevProps)` / `componentWillUnmount()` | Called by the host. |
| `renderVals()` | **The whole contract.** Returns a flat object; the template renders against `{ ...props, ...renderVals() }`. |

Everything the template shows — strings, colours, arrays of rows, and the event handlers
themselves — comes out of `renderVals()`. Handlers are plain functions placed on that object and
bound in the template as `onClick="{{ someHandler }}"`.

`app/index.html` splits the object across sub-methods and merges them at the end, so a feature
area owns its own bindings:

```js
renderVals() {
  const v = { /* shell, nav, panels, console, config, cost, health, history, appearance … */ };
  Object.assign(v, this.tabVals(), this.notifyVals(), this.changelogVals(),
                   this.studioVals(), this.dimSumVals());
  return v;
}
```

Each `*Vals()` method returns its own flat slice and degrades on its own — `tabVals()` returns an
empty strip when `CX.tabs` is absent rather than throwing.

## Template syntax

Compiled by `app/support.js`; this is the complete list of what it understands.

### Interpolation `{{ … }}`

Works in text nodes and in any attribute value, either as the whole value
(`value="{{ query }}"`, which preserves the value's type) or interleaved
(`style="color:{{ fg }}"`, which stringifies).

The expression language is deliberately tiny — **it is not JavaScript** (`resolve()` in
`support.js`):

| Form | Example |
| --- | --- |
| Property path | `{{ user.name }}`, `{{ rows.0.title }}` |
| Index by another value | `{{ map[key] }}` |
| Literals | `{{ true }}`, `{{ false }}`, `{{ null }}`, `{{ undefined }}`, `{{ 42 }}`, `{{ 'text' }}` |
| Negation | `{{ !isOpen }}` |
| Equality | `{{ a === b }}`, `{{ a !== b }}`, `{{ a == b }}`, `{{ a != b }}` |
| Parenthesised | `{{ (a === b) }}` |

There are **no function calls, no arithmetic, no ternaries and no member calls**. If you need one,
compute it in `renderVals()` and expose the result. An unresolved hole renders as empty and logs
`{{ … }} never resolved — rendered as empty`.

### `sc-for`

```html
<sc-for list="{{ navRows }}" as="n" hint-placeholder-count="7">
  <button onClick="{{ n.go }}">{{ n.label }}</button>
</sc-for>
```

Iterates an array, exposing each element under the `as` name (default `item`) and the position as
`$index`. `hint-placeholder-count` only affects streaming placeholders during design-time
rendering; it has no effect in the shipped app. A non-array value renders nothing and warns
`sc-for list="…" is not an array (<type>)`.

The runtime keys each iteration by its **array index**, not by any `key` field on the row, so an
element's React identity follows its position in the list.

### `sc-if`

```html
<sc-if value="{{ isConsole }}" hint-placeholder-val="{{ false }}"> … </sc-if>
```

A truthiness test. The runtime recognises `sc-else` as control flow, but nothing in
`app/index.html` uses it — render the alternative in a second `sc-if` with the negated flag, or
pick the content in `renderVals()`.

### Attributes

| Attribute | Meaning |
| --- | --- |
| `onClick`, `onInput`, `onContextMenu`, … | Mapped to the React handler of the same name (`EVENT_MAP` in `support.js`). Bind a function from `renderVals()`. |
| `style="…"` | A CSS string, parsed into a React style object. Interpolation inside it is fine. |
| `style-hover="…"`, `style-focus="…"` | Compiled into a generated CSS class for that pseudo-class and appended to `className`. **Evaluated at compile time — `{{ }}` inside a `style-*` value does not bind.** |
| `class` / `for` | Rewritten to `className` / `htmlFor`. |
| `-webkit-app-region:drag` in `style` | Makes the custom title bar draggable. Anything interactive inside it needs `data-nodrag` (or to be a `button`/`input`, which the stylesheet already opts out) or the strip swallows the click. |
| `data-appear="<name>"` | Marks the element as an appearance-editor target. See [../features/appearance.md](app-doc://article/codex-material.repository.76c14a1ab0254ae4). |
| `data-anchor="<target>"` | Marks a search field so the regex builder can anchor its popover to it. See [../features/regex-builder.md](app-doc://article/codex-material.repository.7ced8600c459bff3). |

## Render cycle

1. React renders the host component.
2. The host calls `logic.renderVals()` and merges the result over `props`.
3. Each compiled builder resolves its `{{ … }}` holes against that flat object and produces React
   elements.
4. `componentDidUpdate()` runs — `app/index.html` uses it to re-apply per-element appearance
   overrides to the live DOM through `document.querySelectorAll("[data-appear]")`.

`renderVals()` is called on **every** render, so it must stay cheap and must not have side
effects. Anything expensive (filtering a large catalog, evaluating a regex) is computed once at the
top of the method and reused.

If `renderVals()` throws, the runtime catches it, logs it, and paints a
`Component.renderVals(): …` error strip inside the host rather than blanking the app.

## Adding a panel

A panel is a nav destination with its own body. Five edits, all in `app/index.html`.

1. **Add the nav entry.** In the `NAV` array at the top of the logic script:
   ```js
   { id: "audit", icon: "◎", label: "Audit", hint: "What the last run actually did" }
   ```
   The rail renders from `navRows`, which is derived from `NAV`, so the button itself needs no
   template change.

2. **Add any state it owns.** In the `state` class field — a query string, the selected row, a
   result cache. Persist only what should survive a restart, through `CX.store.set` (which
   namespaces every key under `codexstudio.`).

3. **Add the body to the template.** Beside the other panels, inside the scrolling content area:
   ```html
   <sc-if value="{{ isAudit }}" hint-placeholder-val="{{ false }}">
     <div style="padding:20px 24px;max-width:940px;margin:0 auto">
       <div data-appear="Audit header" style="…">{{ auditTitle }}</div>
       <sc-for list="{{ auditRows }}" as="a" hint-placeholder-count="4">
         <div onContextMenu="{{ a.context }}" data-appear="Audit row" style="…">{{ a.text }}</div>
       </sc-for>
     </div>
   </sc-if>
   ```
   Give every distinct visual element a `data-appear` name — that is what makes it customisable.

4. **Expose the values.** Either inline in `renderVals()` or, for anything sizeable, in a new
   `auditVals()` merged by the `Object.assign` at the end of `renderVals()`:
   ```js
   auditVals() {
     const st = this.state;
     return {
       isAudit: st.nav === "audit",
       auditTitle: CX.i18n.t("audit.title"),
       auditRows: rows.map((r) => ({
         key: r.id,
         text: r.text,
         context: (e) => this.menuAt(e, r.text, [this.copyItem(r.text), this.appearItem(e)])
       }))
     };
   }
   ```
   Give every row a `key` — the runtime does not read it (it keys `sc-for` children by index), but
   every list in this file carries one and the app's own bookkeeping relies on it. Every context
   menu should end with `this.appearItem(e)` so the element is reachable from
   **Edit appearance…**.

5. **Wire the sidebar list and its search.** `listConfig()` returns `{ title, placeholder,
   actionLabel, rows }` for the sidebar in the current nav mode; add a branch for the new id. If
   the panel has its own search field, give its container `data-anchor="<target>"`, keep
   `<target>Query` and `<target>Regex` in state, add a case to `sampleFor(target)` so the builder
   opens with a real sample, and filter with `this.matcher(query, spec)` — that is what gives the
   field the anchored regex builder for free.

Then check the cross-cutting rules before calling it done:

- Copy goes through `CX.i18n.t()` so all three language modes and both funny sliders apply.
- Informational results become notifications (`CX.notify.*`), not modal dialogs.
- A change the user could regret gets a `CX.vcs.commit(message, kind)` so it lands in History.
- Anything long-running streams through `codex_run` rather than blocking on `codex_capture`.
- Add a shot to `tools/capture-main.cjs` so the panel is screenshot-able from the real build.

## Browser preview mode

`CX.bridge.mode` is `"electron"` when `window.CODEX_BRIDGE` exists and `"browser"` otherwise. In
browser mode `invoke()` falls through to `sim()` in `app/codex-core.js`, which returns plausible
fixtures after a short artificial delay. That is why `app/index.html` can be opened directly in a
browser as a design preview.

What it is and is not:

- **The simulation answers 27 names**: 26 of the 50 registered commands, plus one
  (`codex_plugin_toggle`) the main process does not register at all. The other 24 —
  `codex_capture`, `codex_editors`,
  `codex_fonts`, the five `codex_history_*`, `codex_hook_list`, `codex_login_status`,
  `codex_marketplace_list`, `codex_mcp_list`, `codex_plugin_catalog`, `codex_plugin_list`,
  `codex_read_config_text`, `codex_read_text`, `codex_open_external`, `codex_reveal`,
  `codex_session_list`, `codex_set_config`, `codex_skill_list`, and the three `window_*` —
  reject with ``unknown command <name>``. Call sites that end in `.catch(…)` simply show nothing.
- **The simulation and the shell are not the same surface.** `codex_plugin_toggle` works in the
  preview and fails in the app; the fixtures are richer than what the CLI actually reports, which
  is why `CX.live.hydrate` fills the display-only fields rather than blanking a panel.
- **A screenshot taken in browser mode proves nothing about the real backend.** The title bar
  shows `Browser preview` rather than `Electron IPC` (`bridgeLabel` in `renderVals()`). Use
  `tools/capture.mjs`, which drives the real shell.
- Two paths deliberately branch on the mode: `loadChangelog()` prefers `codex_read_text` whenever
  a shell is present, because a `fetch()` under `file://` is refused before it reaches the disk,
  and falls back to `fetch("./CHANGELOG.md")` in the preview.

Under Electron, `CX.live.hydrate(cwd)` calls `codex_state` once and **replaces the simulated state
object in place**, so every panel that reads `CX.sim.mcp` keeps working and starts showing real
data; `adoptReal()` then rebuilds the profile and session lists from it.

## Failure modes

| Symptom | Cause |
| --- | --- |
| A value renders as blank and the console logs `never resolved` | The key is missing from `renderVals()`, or the path is misspelled |
| `dc-runtime: window.React is not available yet` | Script order changed — the vendored React files must load before `support.js` |
| A `Component.renderVals(): …` strip appears in the corner | `renderVals()` threw; the message is the original error |
| The whole app is blank, and the console shows a CSP `unsafe-eval` refusal | The CSP `<meta>` in `app/index.html` lost `'unsafe-eval'` — the runtime cannot compile the page's own logic script |
| The whole app is blank with no CSP error | The logic script did not define `class Component extends DCLogic`, or it threw while evaluating |
| `sc-for … is not an array` warning | The bound value is `undefined` or an object; guard it in `renderVals()` |
| A `style-hover` colour never changes | `{{ }}` does not bind in `style-*`; use a literal or add a class |
| Re-ordering a list leaves focus or input state on the wrong row | `sc-for` keys its children by array index, so identity follows position; sort the data before it reaches the template rather than swapping rows under a live element |
| The title bar cannot be dragged, or a button in it does nothing | `-webkit-app-region` — the strip is `drag`, interactive children must be `no-drag` |

## Security considerations

- The logic script is evaluated with `new Function`. It is a **trusted, first-party file bundled
  into the installer**. Never add a path that evaluates text from disk, from CLI output or from a
  config file — see [Why `'unsafe-eval'` is in the CSP](#why-unsafe-eval-is-in-the-csp).
- Template interpolation escapes automatically (values become React text nodes), so CLI output
  rendered through `{{ }}` cannot inject markup. Never route CLI output through
  `dangerouslySetInnerHTML`.
- User-supplied regular expressions are evaluated only through `CX.evaluate`, which is bounded —
  see [../features/regex-builder.md](app-doc://article/codex-material.repository.7ced8600c459bff3).
- The renderer has no Node and no network. Everything it can do to the machine is on the command
  list in [ipc-bridge.md](app-doc://article/codex-material.repository.fbf656065cd7f1d8); argv it composes is spawned through a shell on Windows,
  so read that page's security section before adding a call site that puts user text into `args`.
- `app/support.js` is generated. Patching it by hand means the next regeneration silently drops
  the patch; fix the template or the logic class instead.

## Verification

1. **The structural invariants hold.**
   ```bash
   grep -c '<x-dc>' app/index.html                            # 1
   grep -c 'class Component extends DCLogic' app/index.html   # 1
   grep -n '<script src=' app/index.html                      # vendored React before support.js
   grep -c 'unsafe-eval' app/index.html                       # 1 — in the CSP meta tag
   ```
2. **Every `{{ hole }}` in the template has a producer.** Extract the identifiers and check them
   against `renderVals()` and the `*Vals()` methods:
   ```bash
   grep -o '{{ *[a-zA-Z_][a-zA-Z0-9_]* *}}' app/index.html | tr -d '{} ' | sort -u
   ```
   Names that appear only inside an `sc-for` body come from the `as` alias, not from `renderVals()`.
3. **The modules still pass.** `node tools/test-frontend.mjs` — 23 tests.
4. **Open the page in a browser** (`app/index.html` directly). The title bar must read
   `Browser preview` and the console must be free of `[dc-runtime]` warnings. This checks the
   template only — see [Browser preview mode](#browser-preview-mode) for what it cannot prove.
5. **Open it in the shell** (`npm start`) and confirm the same panels render with real data and
   the title bar reads `Electron IPC`.
6. **Resize to the configured minimum** (960 × 640, from `electron/main.js`) and check at
   100 / 125 / 150 / 200 % display scale in all three language modes that nothing clips.
