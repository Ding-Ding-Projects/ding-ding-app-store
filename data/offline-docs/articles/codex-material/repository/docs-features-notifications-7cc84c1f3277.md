# Notifications

> Anything that only *informs* is a non-blocking corner toast. A modal dialog is reserved for a
> decision that genuinely blocks the next step. Everything ever shown stays reviewable in the
> centre, so a dismissed toast is not a lost one.

**Implementation:** `app/cx-notify.js` (`window.CX_NOTIFY`, instantiated once by
`app/codex-core.js` as `CX.notify = CX_NOTIFY.create().load()`); the toast stack, the centre and
their bindings in `app/index.html` (`notifyVals`, `toast`, `notifyError`) and
`CX.notifyBackendFailure` in `app/codex-core.js`.

## The rule

| Situation | Surface |
| --- | --- |
| Something succeeded | Toast (`success`), auto-dismisses |
| Something is in progress | Toast (`progress`), persists until superseded or dismissed |
| Something informative happened | Toast (`info`), auto-dismisses |
| Something went wrong and the user need not answer now | Toast (`warning` / `error`), persists until dismissed |
| **The user must decide before anything else can continue** | **Blocking modal** |

Exactly **one** blocking modal exists in the shipped app: the bulk-close gate
(`role="dialog" aria-modal="true"`), where the user must review which tabs will close before any
of them do. Everything else — a failed run, an unreachable MCP server, a config section that would
not load, a plugin install, a WSL exec result — is a toast. See [tabs.md](app-doc://article/codex-material.repository.57f8386a7beff582) for the gate's
preview contract.

## Kinds and timeouts

`DEFAULT_TIMEOUT` in `app/cx-notify.js`:

| Kind | Icon | Timeout | Rationale |
| --- | --- | --- | --- |
| `info` | ⓘ | 5000 ms | Read it or don't; it is in the centre either way |
| `success` | ✓ | 4000 ms | Confirmation of something the user just did |
| `progress` | ◴ | **0 — never auto-dismisses** | It is still happening |
| `warning` | ⚠ | **0 — until dismissed** | A warning that vanishes after four seconds is a warning nobody read |
| `error` | ✕ | **0 — until dismissed** | Same, more so |

A caller can override with an explicit `timeout` on the push. `0` means "stay".

Convenience wrappers: `info()`, `success()`, `warn()`, `error()`, `progress()`, plus
`fromError(what, err, actions)`, which turns a rejected backend call into an error whose body is
the message the CLI actually produced.

## Anatomy

```jsonc
{ "kind": "error", "title": "…", "body": "…", "detail": "…",
  "category": "tab-close", "actions": [ { "label": "Undo", "run": fn } ], "timeout": 0 }
```

- **`title`** is styled by the funny level.
- **`body`** and **`detail`** are facts, and are not. `CX.notifyBackendFailure` interpolates the
  literal error text into `{detail}` and passes it through unchanged, so the message reads *"The
  run could not start: could not start `codex`: ENOENT"* at level 1 and level 5 alike. See
  [../experience/language-modes.md](app-doc://article/codex-material.repository.2637d041ae1cdd3c).
- **`actions`** are `{ label, run }` pairs rendered as buttons: **Undo** on a tab close and a bulk
  close, **Retry**, **Open**, **View details** wherever a caller supplies them. Running an action
  dismisses the toast.

The stack sits bottom-right, `column-reverse` so it grows downward from the corner, capped at
`MAX_VISIBLE = 4` on screen at once. It is `pointer-events: none` on the container and
`pointer-events: auto` on each card, so an idle stack never blocks a click on the app underneath.

## Dedupe by category

`category` is an optional key. When a push carries one, every live notification with the same
category is removed — timer cleared — before the new one is added:

```js
for (var i = live.length - 1; i >= 0; i--) {
  if (live[i].category === item.category) { clearTimer(live[i].id); live.splice(i, 1); }
}
```

So a progress line reporting three times becomes one toast that updates, not three stacked copies
of the same news. Closing five tabs in a row leaves one *"Closed …"* toast — the `tab-close`
category — rather than five, each with its own stale Undo.

Two things to know about the exact semantics:

- **Dedupe replaces, it does not merge.** The superseded item's actions go with it; only the newest
  toast in a category is actionable.
- **Dedupe applies to the live stack only.** Every push is appended to the history regardless, so
  the centre shows all five closes even though only one toast was on screen. That is deliberate:
  the stack is about attention, the centre is about the record.

`update(id, patch)` is the other half — it mutates a live notification in place, and re-arms the
timer if the patch changes the kind to one that auto-dismisses. That is how a running step reports
where it got to without raising a new toast per tick.

## The notification centre

`log()` returns the reviewable history, newest first, persisted to
`localStorage["codexstudio.notify.history"]` and capped at `MAX_HISTORY = 200`.

- **Live toasts are deliberately not restored on launch.** `load()` restores the history and the
  read marker only: a notification from a previous session is history, not news.
- **`unread()`** counts entries newer than `readAt`; opening the centre calls `markRead()`, which
  stamps `readAt = now` and persists it. The badge shows the count.
- **`clearHistory()` leaves the live stack alone**, because clearing the log should not make an
  error the user is still reading vanish from the screen.
- **`dismissAll()`** clears the live stack and leaves the history intact — the mirror case.
- Each row's context menu offers **Copy**, which copies `title — body`.
- The centre is a non-modal `role="dialog"` with an `aria-label` carrying the unread count. It is
  a panel, not a gate: the app behind it stays usable.

Only the display fields are persisted (`id`, `kind`, `title`, `body`, `detail`, `at`). **Actions
are not**, because a closure over a snapshot from a previous launch would be either meaningless or
dangerous to re-run.

## Accessibility

- The toast container is `aria-live="polite" aria-atomic="false"`.
- Each toast carries a per-kind role: `role="alert"` for `error` and `warning`, `role="status"` for
  everything else. So a failure interrupts, and a success toast never talks over what a screen
  reader is already reading.
- The dismiss button is a real `<button>` with an `aria-label`, 24 × 24 px.
- The entrance animation is a 0.18 s `cxin` keyframe; **it is not currently gated on
  `prefers-reduced-motion`** — see [../experience/accessibility.md](app-doc://article/codex-material.repository.89891138dfc32b4e).

## Configuration

| Knob | Where | Default |
| --- | --- | --- |
| Per-kind timeouts | `DEFAULT_TIMEOUT` in `app/cx-notify.js` | 5000 / 4000 / 0 / 0 / 0 |
| Visible at once | `MAX_VISIBLE` | 4 |
| History length | `MAX_HISTORY` | 200 |
| History storage | `localStorage["codexstudio.notify.history"]` | `[]` |
| Read marker | `localStorage["codexstudio.notify.readAt"]` | `0` |
| Icons | `ICON` in `app/cx-notify.js` | ⓘ ✓ ◴ ⚠ ✕ |

None are user-facing settings today.

## Failure modes

| Symptom | What happens | Why |
| --- | --- | --- |
| `CX_NOTIFY` missing from a build | `CX.notify` is `null`; `notifyBackendFailure` falls back to `console.error` | The app must still report failures without its notification module |
| An i18n key is missing | The raw key would show, so `notifyBackendFailure` compares and falls back to the plain `what` string | A message reading `err.wsl` helps nobody |
| A subscriber throws while repainting | The others still repaint | `emit()` wraps each callback in `try/catch` |
| `localStorage` unavailable or full | The `store` helper swallows the error; history is in-memory for the session | Losing history must not break the app |
| More than 4 live toasts | Only the newest 4 render; the rest are in the history | `MAX_VISIBLE` |
| More than 200 history rows | The oldest are dropped | `MAX_HISTORY` |
| A dismissed error is needed again | It is in the centre, with its `detail` | Dismissal is not deletion |

## Security considerations

- **Bodies are rendered as text**, never as markup. A CLI error containing `<script>` is displayed,
  not executed.
- **Backend detail is passed through verbatim**, so a message can contain a path from the user's
  machine. It is stored in `localStorage` inside the app's own profile directory and is never
  transmitted — the CSP's `connect-src 'self'` makes that structural rather than a promise.
- **Nothing is auto-run.** Actions are buttons; a notification never performs a side effect on its
  own, and never re-runs an action after a restart because actions are not persisted.
- **The one modal is the destructive one.** Reserving blocking dialogs for real decisions means a
  confirmation still carries weight when it appears.

## Verification

1. **Kinds and timeouts:** raise one of each. `info` and `success` must fade; `progress`,
   `warning` and `error` must stay until dismissed.
2. **Dedupe:** close five tabs in a row. One toast on screen, five rows in the centre.
3. **Update:** push a `progress` toast and `update()` it to `success`; it must re-arm and fade
   rather than sitting forever.
4. **Stack cap:** raise six toasts; four visible, all six in the centre.
5. **Persistence:** raise several, restart. The centre keeps them; the screen is clear.
6. **Unread:** raise three without opening the centre — badge reads 3. Open it; the badge clears.
7. **Clear semantics:** with an error toast on screen, clear the history. The toast must remain.
   Then dismiss all; the history must remain.
8. **Undo action:** close a tab, press **Undo** on the toast, confirm the tab returns.
9. **Backend failure:** rename the `codex` binary and run something. The error must name what
   failed and carry the real message, at funny level 1 and at level 5, in all three language modes.
10. **Screen reader:** an error must be announced assertively and a success politely.
11. **Screenshot:** `node tools/capture.mjs --only notifications` captures the stack and centre
    from the real app.
