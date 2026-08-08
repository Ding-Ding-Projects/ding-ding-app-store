# Language modes and funny levels

> Three language modes, two independent playfulness sliders, and one rule that outranks both: the
> level changes the **voice**, never the **facts**.

**Implementation:** `CX.i18n` in `app/codex-core.js`; the full string table in `app/cx-i18n.js`
(`window.CX_I18N`); the controls in the **Studio** panel of `app/index.html` (`studioRows`), plus
the language button in the title bar.

## The three modes

| Mode | Value | Renders |
| --- | --- | --- |
| English | `"en"` | English only |
| 廣東話 | `"yue"` | Playful written Hong Kong Cantonese only |
| Bilingual | `"bi"` | English, then Cantonese, joined by `  ·  ` — collapsed to one when both strings are identical |

Selectable from the title-bar language button and from **Studio ▸ Language ▸ Language mode**.
Persisted to `localStorage["codexstudio.lang"]`, applied immediately with no restart.

The Cantonese must be **natural written Hong Kong Cantonese, not 書面語**: 唔係, 咩, 睇, 撳, 嘅, 咗
where they belong. A string that reads like Mandarin prose transliterated into Traditional
characters is a bug, not a translation.

Cantonese glyphs are rendered through the `--cx-cjk` stack declared in `app/index.html`
(`Microsoft JhengHei UI`, `Microsoft JhengHei`, `Noto Sans HK`, `PingFang HK`, `Noto Sans TC`,
`Microsoft YaHei UI`), so no CJK webfont is shipped and no network request is made.

## The two funny sliders

**Two independent sliders, one per language**, both 1–5:

| Level | Voice |
| --- | --- |
| 1 | Fully professional. Nothing playful at all. |
| 2 | Plain, with a light touch. |
| 3 | Conversational — the English default. |
| 4 | Clearly playful — the Cantonese default. |
| 5 | Maximum playfulness. |

Defaults: `{ en: 3, yue: 4 }`. Persisted to `localStorage["codexstudio.funny"]`. Adjusted at
**Studio ▸ Language ▸ Funny level — English** and **Funny level — 廣東話**, each with its own
slider and its own live value label. Changing one never moves the other — a user can run
professional English beside playful Cantonese, which is a common Hong Kong office register and a
deliberate design point.

### How a string carries five levels

A table entry is `[english, cantonese]`, and either side may be a **five-element array** — one
string per funny level:

```js
"app.tag": [
  "Every Codex command, setting and flag — with a real GUI on top.",
  ["Codex 嘅所有指令同設定，全部有介面。",
   "Codex 全部指令同設定，一個介面搞掂。",
   "成個 Codex 嘅嘢，一個介面搞掂晒。",
   "Codex 咩都有，唔使再背 flag。",
   "唔使再背 flag，撳兩下就得，勁過睇 --help。"]
]
```

`pick(value, lang)` selects `value[clamp(funny[lang] − 1, 0, 4)]`; a plain string is used as-is at
every level, which is the right answer for a label like `Copy` that has no playful register.

Every level of the same entry carries **the same placeholders**, which is what makes
voice-not-facts mechanically enforceable rather than a matter of care:

```js
"tab.bulkSummary": [
  ["{count} of {total} tabs match ({mode}).",
   "{count} of {total} tabs match ({mode}).",
   "{count} of {total} match — {mode} mode.",
   "{count} out of {total} are in the firing line ({mode}).",
   "{count} of {total} tabs are for the chop — {mode} mode, no takebacks after you press it."]
]
```

At level 1 and at level 5 the reader still learns the count, the total and the match mode. A
level-5 string that dropped `{count}` would be a broken string.

## Voice, never facts — with no exempt categories

The funny level applies to **every** message: informational, success, progress, warning, error,
destructive confirmation, security and accessibility copy. Nothing is carved out.

What must survive at every level, in every language:

| Must always be present | Example |
| --- | --- |
| What happened / will happen | *"12 tabs closed"*, *"config.toml written"* |
| What is affected, by name or count | the file path, the profile name, the tab titles, the number |
| Whether it is reversible | *"Undo it again from History"* vs *"cannot be undone"* |
| The user's options | the action buttons, the alternative route |
| The literal technical detail, unstyled | `CX.notify` carries the backend's message verbatim in `detail`; the funny level styles only the title |

Cantonese is playful and locally natural at every level, and **respectful at every level**:
humour never mocks the user, their data loss, their money or their disability.

## Formatting API

```js
CX.i18n.mode                      // "en" | "yue" | "bi"
CX.i18n.funny                     // { en: 1..5, yue: 1..5 }
CX.i18n.t("act.send")             // resolved for the current mode and levels
CX.i18n.t("tab.bulkSummary", { count: 3, total: 12, mode: "plain text" });
CX.i18n.keys()                    // every key in the table — used by the settings search
CX.i18n.setMode("yue");           // persists
CX.i18n.setFunny("en", 5);        // clamped to 1..5, persists
```

`t()` prefers the full table in `window.CX_I18N` (`STRINGS`, `resolve(key, mode, funny)`,
`format(key, mode, funny, vars)`) and falls back to a small built-in table in `codex-core.js` if
`cx-i18n.js` is missing from a build — the app stays legible rather than rendering raw keys
everywhere. An unknown key returns the key itself, which is deliberately ugly so it is caught in
review.

Placeholders are `{name}` and are substituted after level selection, so a `vars` value never
depends on which level was picked.

## Disclosure

Users are told what the setting does before they rely on it. The Studio panel's Language section
states it plainly:

> Three modes and two independent funny sliders. The level changes the voice only — every message
> still names the file, the count and what is irreversible, at level 1 and at level 5 alike. This
> includes errors, warnings and destructive confirmations; no category is exempt.

Both sliders sit directly under that sentence, so the disclosure and the control are never
separated, and either can be changed or reset at any time.

> **Status:** an install-time or first-run disclosure is **not implemented**. The in-setting
> disclosure above is what ships today. A user who never opens the Studio panel is not yet told
> that error copy is styled — closing that gap is outstanding work.

## The spoken narrator

Optional, **off by default**, enabled only by the user (`CX.settings.narrator`, and
`CX.narrator.enabled`).

| Property | Behaviour |
| --- | --- |
| Language | English, 廣東話 or Both. Both speaks English then Cantonese, strictly serialised. |
| Voice | Platform TTS via `speechSynthesis`; `zh-HK` for the Cantonese track, `en-US` otherwise |
| Queueing | One utterance at a time through a serialised queue (`pump()`); a superseded line in the same category **replaces** the queued one rather than stacking |
| Rate limiting | 6-second debounce/cooldown between utterances unless `force` is passed |
| Tone | Follows the per-language funny level, in every category including errors |
| Content | A spoken error still names the actual failure and what to do about it, and is never suppressed by the rate limit — pass `force` for it |
| Coexistence | Must yield to or duck under an active screen reader, and respect reduced-sound / quiet-hours settings |

Settings live at **Studio ▸ Spoken narrator**: an on/off toggle and a narrated-language picker.

> **Status:** the queue, the cooldown, the language selection and the `zh-HK` voice hint are
> implemented in `CX.narrator`. Screen-reader ducking and quiet-hours handling are **not** —
> `speechSynthesis` has no ambient-audio awareness, so that behaviour must be built on top of an
> explicit setting. Do not claim it works today.

## Configuration summary

| Setting | Storage key | Default |
| --- | --- | --- |
| Language mode | `codexstudio.lang` | `"en"` |
| Funny levels | `codexstudio.funny` | `{ en: 3, yue: 4 }` |
| Narrator on/off | `codexstudio.settings.narrator` (and `codexstudio.tts`) | `false` |
| Narrated language | `codexstudio.settings.narratorLang` (and `codexstudio.ttsLang`) | `"en"` |

Changing the language mode is recorded in the local history
(`CX.vcs.commit("Language mode set to …", "settings")`), so it can be undone like any other
setting.

## Failure modes

| Symptom | Cause / behaviour |
| --- | --- |
| A raw key such as `tab.bulkSummary` appears in the UI | The key is missing from both tables. Add it — never hard-code a literal string at the call site |
| A string does not change with the slider | The entry is a plain string rather than a five-element array. Correct when the label has no playful register; a bug when it does |
| A placeholder renders literally as `{count}` | `vars` was not passed, or the key was spelled differently at the call site |
| Bilingual mode shows one language only | `en === yue` for that entry, and the join is deliberately collapsed |
| Cantonese renders as boxes | The `--cx-cjk` stack found no installed CJK face — rare on Windows; the fallback chain needs another entry |
| Bilingual labels clip | The longest strings in the app. Test at 960 px width and 200 % scale in `bi` mode at level 5 |
| The narrator says nothing | Off by default; also silently returns when `speechSynthesis` is unavailable |
| The narrator repeats a superseded line | The call site did not pass a `category`, so replacement could not apply |

## Security considerations

- **Localisation is data, not code.** Strings are looked up from a static table and substituted
  with `String.replace`; nothing is evaluated. Never build a translation by concatenating a
  template with a value and passing it anywhere that interprets it.
- **The funny level must not obscure a security decision.** A destructive confirmation at level 5
  still names the target and the irreversibility. This is a security property: a user who cannot
  tell what a button does cannot consent to it.
- **Backend detail is never styled.** `CX.notify` keeps the literal message in `detail`, so a
  rendered failure always contains the real, unedited text.
- **Nothing is translated at runtime over the network.** No translation service, no telemetry on
  language choice.
- **The narrator speaks aloud.** Error copy can carry file paths and project names, which is a
  disclosure risk in a shared space. It stays off by default for that reason as much as for
  annoyance.

## Verification

Run each of these in **all three modes**, at funny level **1** and level **5** for both languages:

1. Every visible label renders in the expected language(s), with no raw keys and no leftover
   `{placeholder}`.
2. A success message, an error message and a destructive confirmation each still name the affected
   object, the count and whether the action is reversible.
3. The two sliders move independently: English at 1 with Cantonese at 5 renders professional
   English beside playful Cantonese in bilingual mode.
4. Both sliders and the mode survive a restart.
5. Bilingual mode at level 5 — the longest possible copy — does not clip at 960 × 640 or at
   200 % display scale.
6. The Studio panel's disclosure sentence is visible directly above the sliders.
7. Turn the narrator on: one utterance at a time, no overlap, the cooldown holds, an error is
   still spoken and still names the failure. Turn it off and confirm silence.
8. Set the narrated language to Both and confirm English finishes before Cantonese starts.
9. Search the Studio panel for `funny` (plain text) and `funn.` (regex, via the anchored builder)
   and confirm both find the sliders.
10. Check for user-facing strings that bypass `CX.i18n.t()`. This is a test now, not a grep —
    `app/index.html — no user-visible string bypasses CX.i18n` in `tools/test-frontend.mjs` sweeps
    `label`, `hint`, `title`, `desc`, `subtitle` and `placeholder` against a named allow-list, and
    also verifies that every key the frontend asks for is actually defined:
    ```bash
    node tools/test-frontend.mjs
    ```
    The allow-list holds seven entries, each with its reason in the test: three CLI command names
    (`codex login`, `codex logout`, `codex cloud`), two typeface names (Georgia, Helvetica Neue),
    `廣東話` — a language's name in its own language — and the empty sentinel the dropdown clears
    itself with. Anything else is a bug.

    > [!NOTE]
    > The grep this replaced only looked at `label: "…"`, so it never saw the settings rows (their
    > text is a positional argument to `pick()`/`toggle()`/`slider()`/`action()`), the palette
    > (`group` and `hint`), or any label inside a ternary. That is why the count in an earlier
    > handoff read 92 when the real figure was over 200.
