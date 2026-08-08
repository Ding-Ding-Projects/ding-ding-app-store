# The Codex Studio site

The project's GitHub Pages site. It documents Codex Studio — a Material 3 Windows desktop GUI for
the OpenAI Codex CLI — and it obeys the same rules the app does: browser-style tabs, three language
modes, two funny sliders, a full regex builder beside its search bar, a settings page that theme's
the site itself, non-blocking notifications, and the dim sum surprise.

**There is no build step.** Open `docs/site/index.html` by double-clicking it and the whole site
works, offline, exactly as it does when published.

---

## What is here

| File | Lines | What it is |
| --- | ---: | --- |
| `index.html` | ~135 | The document skeleton: top bar, tab strip, search field, the anchored regex builder, six empty tab panels, the toast region and the dim sum host. Every panel's content is rendered by `app.js`. |
| `app.css` | ~505 | All styling. Material 3 tokens, light and dark, layout, components, responsive rules, `prefers-reduced-motion`, and a print stylesheet. |
| `app.js` | ~1790 | All behaviour: preference store, i18n, colour maths, theming, the bounded regex engine, the tab model, one render function per panel, toasts and the dim sum draw. |
| `articles.js` | ~1640 | All content: the facts table, the voiced string table, 21 feature articles, the screenshot list, the dim sum catalog, the changelog transcription and the documentation index. |
| `.nojekyll` | 0 | Tells GitHub Pages to serve this directory verbatim rather than running it through Jekyll. |
| `assets/` | — | Fonts, the app icon, the 25 screenshots and the 72 dim sum photographs, staged inside the site directory so it is self-contained. |

Nothing else is required. No package manager, no bundler, no framework, no CDN, no web font
service, no analytics, no telemetry, and no outbound request of any kind at runtime. The only
absolute URLs anywhere in the site point at `github.com` — the repository, its releases, its `docs/`
tree and `CHANGELOG.md`.

---

## Publishing it

The site is self-contained inside `docs/site/`, so either Pages source works:

- **Deploy from a branch → `main` → `/docs`** — the site lands at `…/site/`.
- **Deploy from a branch → `main` → `/ (root)`** — the site lands at `…/docs/site/`.

Every asset reference is relative to `docs/site/`, so the directory can also be copied anywhere,
zipped, or opened straight off a filesystem.

`.nojekyll` must stay. Without it, Pages runs the directory through Jekyll, which ignores files and
directories beginning with an underscore and rewrites things this site does not want rewritten.

---

## Editing it

### Adding or changing an article

Articles live in the `ARTICLES` array in `articles.js`. Each one is built by the `a()` helper:

```js
a("id", "Title", "Tag", "One-line factual summary",
  { en: [/* 5 voices */], yue: [/* 5 voices */] },   // the lead paragraph, voiced
  [
    { h: "Behaviour", blocks: [ p("…"), ul(["…"]), code("…"), kv([["Key", "Value"]]) ] },
    { h: "Configuration", blocks: [ … ] },
    { h: "Failure modes", blocks: [ … ] },
    { h: "Security considerations", blocks: [ … ] },
    { h: "How to verify it", blocks: [ … ] }
  ],
  { related: ["other-id"], prereq: ["read-this-first-id"], next: "next-id" })
```

Four block types are rendered: `p` (paragraph), `ul` (list), `code` (copyable code block) and `kv`
(a two-column table). Inside any of them the inline grammar is deliberately tiny — `` `code` ``,
` ``code with a backtick`` ` and `**bold**`. Everything else is escaped, so a stray `<` in a command
renders as a `<`.

**Every article must carry all five section headings, and every id in `suggested` must exist.**
Both are asserted by the check script at the bottom of this page.

### Adding or changing a string

Voiced strings live in the `STRINGS` table in `articles.js`. Each key holds five English variants
and five Cantonese variants, indexed 0–4 by the funny slider.

> **The rule that makes the sliders safe:** put every number, version, path and command in a
> `{placeholder}`, never in the sentence. The level chooses the voice *first*; the placeholders are
> substituted *afterwards*, from a single `FACTS` object. That ordering is the entire guarantee that
> level 1 and level 5 of a string cannot name different facts — they contain no facts at all until
> the moment they are rendered.

An unknown placeholder is deliberately left visible as `{name}` rather than dropped, and a missing
key renders as the key itself. Both failures are meant to be loud.

The Settings tab renders the `voice.demo` key at all five levels with the interpolated facts
wrapped in `<mark>`, so the guarantee is visible on screen rather than merely asserted here.

### Adding a screenshot

1. Capture it in the repository root: `npm run capture -- --only <id>`.
2. Copy the new PNG into `docs/site/assets/screenshots/`.
3. Add an entry to `SHOTS` in `articles.js` with the manifest's own `note` as the caption and a
   **new, specific** `alt` — the caption and the alt text have different jobs, and reusing one for
   the other leaves screen-reader users with a label instead of a description.

### Updating the changelog

`CHANGELOG.md` at the repository root is the source of truth. The site carries a transcription in
the `CHANGELOG` array in `articles.js` so the page opens from the filesystem with no fetch. **When
the root changelog changes, update that array in the same commit.** Nothing enforces this
automatically; the app's own mirror is enforced by `node tools/sync-changelog.mjs --check`, but that
tool mirrors into `app/`, not here.

### Assets

`docs/site/assets/` holds copies of files that also live elsewhere in the repository:

| Path | Source |
| --- | --- |
| `assets/fonts/` | `app/fonts/` — the same Roboto and Roboto Mono woff2 the desktop app bundles |
| `assets/screenshots/` | `assets/screenshots/` — the 16 PNGs written by `npm run capture` |
| `assets/dimsum/` | `app/dimsum/` — the 72 bundled dish photographs |
| `assets/icon.png`, `assets/icon-source.png` | `assets/` — the app icon |

They are staged here so the published site stands on its own and does not depend on where Pages is
rooted. When a source file changes, re-copy it.

---

## How the site works

### Tabs

Six tabs — Overview, Features, Documentation, Screenshots, Changelog, Settings — with a real
`tablist` / `tab` / `tabpanel` structure and roving `tabindex`. ← →
Home End move between them.

- **Pinning.** P on a focused tab, or its context menu (right-click, or the
  Menu key). Pinned tabs sit in a stable region ahead of the others and are never hidden
  by the overflow.
- **Reordering.** Ctrl+Shift+←/→ on a focused tab, or
  *Move left* / *Move right* in its menu. A tab moves within its own region only — a pinned tab
  cannot be shuffled in among the loose ones and back out again, which is the point of pinning.
- **Groups.** Create one from a tab's menu, then name it, colour it with any notation the
  translator reads, collapse it, or dissolve it. Dissolving keeps every tab in it: the tabs are
  this site's sections and there is nothing to close. A collapsed group hides its members from the
  strip but never from the searches — that is what makes collapsing safe — and the active tab is
  never hidden.
- **Four tab-discovery searches**, reached from **Find tabs**: this strip, inside one group, groups
  by name, and every tab everywhere. Each keeps its own query, pattern, flags and mode, and each
  has its own regex builder that writes back into the field that opened it. One shared search would
  silently apply the last query you typed to whichever surface you opened next. Every result says
  where it lives — which group, whether pinned, whether that group is collapsed — because a result
  you cannot locate is a result you cannot act on.
- **Overflow.** When the tabs do not fit, the ones that do not fit move into a **More (n)** menu.
  Pinned tabs and the active tab are never overflowed — an overflow that can swallow the tab you
  are reading is worse than no overflow at all.
- **Persistence.** The active tab, the pin list, the manual order, and every group with its name,
  colour, collapsed state and membership are stored in `localStorage`. The active tab is also
  mirrored into the URL hash so a tab can be linked to. A group that forgets it was collapsed the
  moment you reload is a decoration rather than a feature.

### Search and the regex builder

The search field covers every article, every documentation page and the changelog. Plain text is
the default; regex is an explicit opt-in behind the `.*` toggle. The builder opens **anchored to the
field**, not as a page-level dialog, and offers guided constructs, the eight JavaScript flags, a raw
pattern editor, a sample box, live match rows with capture groups, and copy.

Evaluation is bounded, using the same limits as the desktop app:

| Bound | Value |
| --- | --- |
| Pattern length | 2000 characters |
| Sample length | 20 000 characters |
| Matches returned | 500, then reported as truncated |
| Wall-clock budget | 300 ms, checked every 200 matches |
| Zero-width match | `lastIndex` advanced by one |

And one refusal that matters more than all the bounds put together: a pattern that repeats a group
which already repeats — `(a+)+`, and just as badly `(a+){1,20}` — is **refused before it runs**,
quoting the offending fragment. A single `RegExp.exec` call cannot be interrupted from JavaScript,
so the millisecond budget only helps *between* matches; against that shape it is useless and the tab
would simply stop answering. Try `(a+)+b` in the builder to see the refusal.

### Language modes and funny levels

English, playful Hong Kong Cantonese, or bilingual (both, joined by a middle dot, collapsing to one
when the two languages resolved to the same string). Two independent 1–5 sliders, one per language.
All four preferences persist.

The level styles every category of copy on the site, errors and warnings included. It changes voice
and never facts — see the rule above, and the live demonstration on the Settings tab.

### Settings

Theme (system / light / dark, with the explicit choice overriding the system setting in both
directions), accent colour, interface font, font size, density, language mode, both funny sliders,
the dim sum switch, the regex default, named presets, and a reset.

The accent picker is **continuous**: a 2-D saturation/value field plus a hue slider, with one text
field that reads every notation the translator writes — in both the legacy comma form and the
modern space-with-slash-alpha form. It is keyboard-operable: arrow keys move the field,
Shift takes bigger steps.

Beside it, a **twelve-space translator**: HEX, HEX8, RGB, RGBA, HSL, HSV, HWB, LAB, LCH, OKLab,
OKLCH and CMYK, plus the named colours when one matches, with a WCAG contrast ratio against the
page surface and an AA/AAA verdict. Alpha travels rather than being dropped — a lost alpha is
indistinguishable from a colour that never had one. Every row is a button, so all twelve can be
copied from the keyboard, and each is named for its own space rather than announcing twelve
identical "Copy" controls.

**Named presets** save the current look under a name and export to a real file. A preset holds
theme, accent, font, font scale and density — the look, not which page you happen to be reading.
Import never silently drops a value it cannot represent: every rejection is named with its reason,
because a theme that quietly loses half its settings is worse than one that refuses outright.
Deleting a preset offers an undo rather than a confirmation dialog.

### Per-element appearance

Right-click any named surface for **Edit appearance…**, or Shift+right-click to skip the
menu. Typeface, slant, capitalization, underline, size, weight, letter spacing, text colour and
highlight — applied live, kept per element, and persisted. Colours accept any notation the
twelve-space translator reads.

The sheet the editor lives in is itself a named target, so the appearance system can restyle its
own chrome. A theming feature that cannot theme its own dialog is incomplete.

A tab keeps its own context menu: tab management matters more there, and pressing
Shift+right-click on one opens the editor directly instead.

Two rules carried over from the app, both learned the hard way:

- **Only properties this system set on the previous pass are cleared.** Writing `""` for every
  property it knows about erases the stylesheet's own values — the app did exactly that once, and
  its UI audit went from 23 findings to 251 while every other test stayed green.
- **A cleared control removes its property rather than storing `""`,** so an element restyled back
  to plain does not carry a page of empty values into an exported preset.
### Searching the settings

The settings surface carries its own search bar, wired to its own regex builder — separate from the
article search at the top of the page, with its own query, flags and mode. It matches each row's
label, its description **and its current value**, so typing `cosy` finds the density row by what it
is set to rather than by what it is called. A card whose every row is hidden is hidden too, so
nobody scrolls past empty headings hunting for a match. Nothing matching says so and points at the
app's Studio panel, which has settings this site does not.

### History

Every preference this page owns is versioned, newest first, kept locally. It is recorded at the
single funnel every write passes through, so a future call site cannot forget to; an unchanged
write records nothing, so the list stays a set of real events; and each row says what changed
rather than that something did — *Theme set to dark*, not *Changed the theme*.

**Restoring writes a new revision rather than rewinding.** An undo can itself be undone, and that
undone in turn. A restore that discards the branch it replaced is the one shape that makes a
history panel unsafe to open.

Filter by a date range, by text, or by action. The actions are derived from the log with a count
beside each rather than hard-coded — a fixed list offers choices the log does not contain and
misses the ones it does. The end date covers the whole of that day, because a filter that hides
what happened on the day you asked for is a filter nobody trusts twice.
### Notifications

Copying, clearing a filter, saving a preference, pinning a tab and every input error raise a corner
toast. Info and success auto-dismiss; warnings and errors stay until dismissed, because a failure
that vanishes after four seconds is a failure nobody read. Nothing on this site calls `alert()`,
`confirm()` or `prompt()`.

Dismissed notifications stay reviewable. The bell in the top bar opens the history: everything the
page has said since it loaded, newest first, with its kind and time. A toast auto-dismisses after
four seconds and used to leave no trace, so a reader who happened to be looking elsewhere lost the
message entirely — and for an error, that reader is the one it existed for.

The badge counts errors and warnings only. A badge reading 17 after seventeen "Copied" toasts is
noise wearing the shape of a signal.

The log lives for the page load rather than being persisted: these describe what just happened
here, and a stale one restored after a reload would read as current. Clearing it leaves any toast
still on screen alone — a message the reader is in the middle of reading should not vanish because
they tidied.

### Dim sum

A 1% draw per page load from the 72 bundled photographs, named in English and Cantonese, shown in a
non-blocking corner card with `role="status"` that auto-dismisses after nine seconds and can be
closed at any time. It never fires on a first visit, never twice in one load, and never fetches
anything. Settings ▸ *Show the dim sum surprise* turns it off permanently, and *Show one now* draws
at rate 1 for a look.

---

## Accessibility

- Correct `tablist` / `tab` / `tabpanel` roles, roving `tabindex`, arrow-key navigation.
- A skip link, visible `:focus-visible` rings on everything, and no focus trap anywhere.
- Every control reachable and operable by keyboard, including the colour field and the tab context
  menus.
- Every image carries meaningful alt text; decorative marks are `aria-hidden`.
- Live regions on the search summary, the builder status, the contrast readout and the toasts.
- `prefers-reduced-motion: reduce` disables every animation and transition.
- Contrast comes from the app's own Material 3 palette, and the settings page will tell you the
  exact ratio of any accent you choose.

## Responsive

No horizontal page scroll at 360 px — verified at that width, where `scrollWidth` equals
`clientWidth`. Wide content scrolls inside its own container: tables are wrapped in an
`overflow-x: auto` box and code blocks scroll individually.

---

## Checking it

There is no test runner here. These three commands are the check, and they are the same ones used
before this site was committed:

```bash
# 1. Everything parses.
node --check docs/site/app.js
node --check docs/site/articles.js

# 2. Every referenced asset resolves, every article is complete, every suggested link
#    points at a real article, and no voiced string drifts between its five variants.
node -e "
global.window={};require('./docs/site/articles.js');
const fs=require('fs'),D=window.CXS_DATA,base='docs/site/';
let bad=[];
D.SHOTS.forEach(s=>{if(!fs.existsSync(base+'assets/screenshots/'+s.file))bad.push(s.file)});
D.DISHES.forEach(d=>{if(!fs.existsSync(base+'assets/dimsum/'+d.slug+'.png'))bad.push(d.slug)});
const ids=D.ARTICLES.map(a=>a.id);
D.ARTICLES.forEach(a=>{
  ['Behaviour','Configuration','Failure modes','Security considerations','How to verify it']
    .forEach(h=>{if(!a.sections.some(s=>s.h===h))bad.push(a.id+' missing '+h)});
  ['related','prereq'].forEach(k=>(a.suggested[k]||[]).forEach(x=>{if(!ids.includes(x))bad.push(a.id+'->'+x)}));
  if(a.suggested.next&&!ids.includes(a.suggested.next))bad.push(a.id+'->next '+a.suggested.next);
});
Object.keys(D.STRINGS).forEach(k=>['en','yue'].forEach(l=>{
  const arr=D.STRINGS[k][l];
  if(arr.length!==5)bad.push(k+'.'+l+' has '+arr.length+' variants');
  const sets=new Set(arr.map(v=>(v.match(/\{\w+\}/g)||[]).sort().join(',')));
  if(sets.size>1)bad.push(k+'.'+l+' placeholder drift');
}));
console.log(bad.length?'FAIL\n'+bad.join('\n'):'OK — assets, articles, links and voices all check out');
"

# 3. Nothing points at a CDN, a font host or an analytics service.
#    Only github.com links are expected in the output.
grep -o "https\?://[^\"' )<>]*" docs/site/index.html docs/site/app.css docs/site/app.js docs/site/articles.js | sort -u
```

Then open `docs/site/index.html` and check the things a script cannot:

- Every tab renders, and the active tab survives a reload.
- Pin a tab with P, reload, and it is still pinned and still first.
- Narrow the window until the **More** button appears, and confirm the pinned and active tabs stay.
- Type `(a+)+b` with regex enabled and read the refusal.
- Drag either funny slider on Settings and confirm the version number in the demonstration does not
  move while the sentence around it does.
- Tab through the page with the keyboard alone and confirm you never lose the focus ring.

---

## Accuracy

Every factual claim on this site was read out of this repository — `package.json`, `electron/`,
`app/`, `tools/`, `.github/workflows/ci.yml`, `CHANGELOG.md` and
`assets/screenshots/manifest.json`. Where something is not implemented, the site says so; where the
repository's own `docs/` pages are out of date relative to the current tree, the Documentation tab
says that too rather than quietly papering over it.

If a statement here disagrees with the code, the code is right and this site is a bug.
