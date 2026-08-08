# Standards

The requirements Material Designer holds itself to, and an honest account of how
far each one has got.

> [!IMPORTANT]
> **Almost nothing here is implemented in the application.** The vendored
> upstream product satisfies a few of these requirements incidentally; the
> Material Design 3 token layer and the Windows title bar have landed; release
> machinery exists and has published releases. The rest are not started.
>
> **No standard has been audited in a running interface.** The application
> builds, installs, launches and passes an automated health check, and its unit
> suites pass — but nobody has sat in front of it and checked a single
> requirement below. Every status here is assessed by reading source, scripts and
> the design mockup. Where a file says "verified", it names the command that
> produced the result.
>
> Every file in this category states the requirement, **why the requirement
> exists**, its status, and how conformance will be verified. Where the answer is
> "not started", it says so.

## Files in this category

### The sixteen numbered standards

| File | Standard |
| --- | --- |
| [language-modes.md](app-doc://article/material-designer.repository.c18f6d2993c4fe48) | English, playful Hong Kong Cantonese, and a bilingual mode; two independent 1–5 tone sliders that restyle voice without changing facts. |
| [material-design-3.md](app-doc://article/material-designer.repository.e990d57fb20c3354) | Full Material Design 3 conformance — tokens, typography, shape, elevation, motion, component anatomy and window chrome. |
| [appearance-customization.md](app-doc://article/material-designer.repository.196dde047df77cc4) | An appearance editor on every rendered element, an infinite colour picker with a colour translator, word-processor-depth typography, named presets and resets. |
| [regex-builder.md](app-doc://article/material-designer.repository.7aa5840720857fb1) | A pattern builder anchored beside every search field, with plain text as the default. |
| [tabs.md](app-doc://article/material-designer.repository.da568c16710f2748) | Browser-style tabs everywhere: overflow, reordering, pinning, grouping, four discovery searches, bulk close, persistence. |
| [notifications.md](app-doc://article/material-designer.repository.87255b4d3b9bddcb) | Non-blocking notifications anchored in a corner, a notification centre, and no nagging. |
| [super-confirmation.md](app-doc://article/material-designer.repository.dac5d80fce58e4d7) | The gate every destructive action passes: two independent keys, a full-range slider, and an always-available emergency exit. |
| [command-palette.md](app-doc://article/material-designer.repository.1b5ac777c3383f4f) | One shortcut over every command, setting and destination, with live inline controls and a teleport to where each thing lives. |
| [changelog-viewer.md](app-doc://article/material-designer.repository.e8f383ed5774d457) | Every released version readable in-app, with a commit link per entry, a date filter, a search, and export. |
| [version-history.md](app-doc://article/material-designer.repository.6b9631cd4cb081da) | A local Git-backed history of documents, records **and** settings, where restoring is a new revision and never a rewrite. |
| [export-and-bulk-actions.md](app-doc://article/material-designer.repository.0cca043e3ec95f27) | Everything exportable in every format that can faithfully represent it, saying what would be lost before it runs; multi-select and the full action set in bulk on every list. |
| [dim-sum-surprise.md](app-doc://article/material-designer.repository.3548ed3bf945f48d) | One launch in ten shows a dish, in both languages, from a bundled catalogue — non-blocking, and with no off switch. |
| [releases.md](app-doc://article/material-designer.repository.b66a6fa7a6c7680b) | What every release must carry: an installer, a code name, a line-count table, and honest continuous-integration evidence. |
| [accessibility.md](app-doc://article/material-designer.repository.a93f9b3fba5c5315) | Keyboard reachability, visible focus, roles and names, contrast, reduced motion, and no clipping at any scale — as completion blockers, not polish. |
| [local-assets.md](app-doc://article/material-designer.repository.4be713d73b6329d4) | No script, stylesheet, font or image fetched from a third-party origin, and no tracking — on every surface individually. |
| [documentation-currency.md](app-doc://article/material-designer.repository.ea9390193415c242) | Documentation, changelog and roadmap brought current in the same task that changes the project. |

### Interface-quality rules with their own file

These are not numbered standards. They are rules that apply to every surface, and
each has its own article because each guards a distinct failure.

| File | Rule |
| --- | --- |
| [overlays.md](app-doc://article/material-designer.repository.a9331041c56b8fe1) | Every popover, menu and anchored panel paints its own surface, is bounded by the viewport, and scrolls rather than hiding what does not fit. |
| [context-menu-shortcuts.md](app-doc://article/material-designer.repository.1760391787c55268) | Every context-menu item shows the shortcut that actually works in that context, derived from the binding registry — and every context menu carries its own search. |
| [long-operations.md](app-doc://article/material-designer.repository.1f93446cc5a920fb) | A long operation reports real progress in the surface that started it, guards against re-entry in the handler, and offers its recovery route where the failure appeared. |
| [external-editor.md](app-doc://article/material-designer.repository.da5812c708caa3d1) | Detect installed editors, persist the choice, degrade clearly — and open every export in one action, as a workspace root. |
| [typography-and-icons.md](app-doc://article/material-designer.repository.17d09285e6ab2598) | The three Material Design 3 faces and the icon font: which files ship, from where, under which licence, which variable axes are live, and the CJK fallback the twenty locales depend on. |

[accessibility.md](app-doc://article/material-designer.repository.a93f9b3fba5c5315) summarises the first three of these
alongside the accessibility matrix, because they are checked at the same time.
The dedicated files own the detail.

## Status at a glance

**Read at commit `dea6b0a`, on 2026-08-03.** A status table is a point-in-time
observation, so it carries the commit it was taken at — see
[documentation-currency.md](app-doc://article/material-designer.repository.ea9390193415c242) for why. For the current
state of any row, read that row's own file and re-run the checks its verification
section names.

| # | Standard | Status | File |
| --- | --- | --- | --- |
| 1 | Language modes + two tone sliders | **Not started in the application.** 19 locales ship; Cantonese is not one of them, and no tone slider exists. Implemented on the documentation site. | [language-modes.md](app-doc://article/material-designer.repository.c18f6d2993c4fe48) |
| 2 | Material Design 3 conformance | **Partial.** The token sheet and its mapping layer landed at `dea6b0a`, as did the Windows frameless window and custom title bar. Component anatomy is not started. | [material-design-3.md](app-doc://article/material-designer.repository.e990d57fb20c3354) |
| 3 | Runtime appearance customization | **Not started in the application.** No per-element editor, no continuous picker, no presets. The site implements theme, density, seed and scale, plus a partial colour translator. | [appearance-customization.md](app-doc://article/material-designer.repository.196dde047df77cc4) |
| 4 | Regex builder on every search bar | **Partial.** The command palette and settings-tab overflow menu have independent builders; the overflow builder's focus scope and viewport repair are committed at `ec2c76d7`; other required fields do not. | [regex-builder.md](app-doc://article/material-designer.repository.7aa5840720857fb1) |
| 5 | Browser-style tabs everywhere | **Partial in code.** The settings dialog has a 17-section tab strip, viewport-bounded overflow, local regex search and a portalled focus route; workspace pinning, grouping and the four discovery searches remain open. | [tabs.md](app-doc://article/material-designer.repository.da568c16710f2748) |
| 6 | Non-blocking notifications + centre | **Designed, not built** in the application. Implemented on the site. | [notifications.md](app-doc://article/material-designer.repository.87255b4d3b9bddcb) |
| 7 | Super confirmation for destructive actions | **Not started, and not yet designed.** Absent from the mockup entirely — the largest undesigned gap in the set. | [super-confirmation.md](app-doc://article/material-designer.repository.dac5d80fce58e4d7) |
| 8 | Command palette | **Not started in the application.** Designed in the mockup, including inline live controls. Implemented on the site. | [command-palette.md](app-doc://article/material-designer.repository.1b5ac777c3383f4f) |
| 9 | Changelog viewer | **Not started in the application.** Designed in the mockup, commit links included. Releases now exist, so the viewer would have content on its first run. | [changelog-viewer.md](app-doc://article/material-designer.repository.e8f383ed5774d457) |
| 10 | Local version history | **Partial upstream, and narrower than the requirement.** Project files are versioned and a restore is recorded as a new version; it is not Git-backed, and records and settings are not covered. | [version-history.md](app-doc://article/material-designer.repository.6b9631cd4cb081da) |
| 11 | Export everything, bulk actions everywhere | **Partial upstream.** The product exports several formats already; the full matrix, the archive options, the say-what-will-be-lost rule and universal bulk actions are not done. | [export-and-bulk-actions.md](app-doc://article/material-designer.repository.0cca043e3ec95f27) |
| 12 | Startup dim sum surprise | **Not present in the application.** The bundled catalogue is complete and verified — 24 dishes, 24 images. The mockup draws the surprise with a forbidden off switch. | [dim-sum-surprise.md](app-doc://article/material-designer.repository.3548ed3bf945f48d) |
| 13 | Release code name + line count | **Machinery built, and releases have been published.** The release workflow now runs the counter with attribution enabled. Whether a published release's notes carried the resulting table has not been checked here. | [releases.md](app-doc://article/material-designer.repository.b66a6fa7a6c7680b) |
| 14 | Accessibility and sizing | **Not started.** Stated as an intent in the mockup; never measured, because no interface has been audited. | [accessibility.md](app-doc://article/material-designer.repository.a93f9b3fba5c5315) |
| 15 | All assets bundled locally | **Fonts met; the preview runtime is not.** Every typeface now ships locally — Cairo at `45ff210`, then Roboto Flex, Roboto Mono and Material Symbols Rounded, with the publish-time self-contained check extended to the packed application. The preview runtime still fetches a framework and a compiler. Met on the documentation site. | [local-assets.md](app-doc://article/material-designer.repository.4be713d73b6329d4) |
| 16 | Docs, changelog and roadmap current each task | **In force.** This documentation tree is the first instance. | [documentation-currency.md](app-doc://article/material-designer.repository.ea9390193415c242) |

| Rule | Status | File |
| --- | --- | --- |
| Overlays paint their own surface | **Designed correctly, not audited in code.** | [overlays.md](app-doc://article/material-designer.repository.a9331041c56b8fe1) |
| Context-menu shortcuts and menu search | **Shortcut labels designed and not built; the per-menu search is neither.** | [context-menu-shortcuts.md](app-doc://article/material-designer.repository.1760391787c55268) |
| Long operations report progress | **Designed, not built.** | [long-operations.md](app-doc://article/material-designer.repository.1f93446cc5a920fb) |
| External editor integration | **Partial upstream.** Editors are detected and a project opens in one; exports have no hand-off. | [external-editor.md](app-doc://article/material-designer.repository.da5812c708caa3d1) |
| The three M3 faces, bundled | **Bundled and wired; never seen rendered.** Roboto Flex, Roboto Mono and Material Symbols Rounded now ship as local assets with a CJK-safe fallback, and 94 of 95 icon call sites moved to the symbol font. No glyph has been photographed. | [typography-and-icons.md](app-doc://article/material-designer.repository.17d09285e6ab2598) |

> [!NOTE]
> **Some sibling files carry status text written before commit `dea6b0a`**, which
> landed the token sheet and the Windows title bar, and before the first releases
> were published. Where a per-file status table disagrees with the table above,
> the table above is the more recent reading — and bringing the older files
> current is exactly what [documentation-currency.md](app-doc://article/material-designer.repository.ea9390193415c242)
> requires of the next task that touches them.

## How to read a status

| Status | Means |
| --- | --- |
| **Not started** | No code, and possibly no design. |
| **Not yet designed** | Not even specified by the mockup. These carry the most risk, because the shape of the work is unknown. |
| **Designed, not built** | The mockup specifies it completely enough to implement. Nothing runs. |
| **Partial** | Something exists that covers part of the requirement. The gap is named in the file. |
| **Met** | Implemented, and verified by something a reader can re-run. **Nothing is at this status yet.** |

Nothing may be promoted to **Met** on the strength of code existing. Promotion
requires the verification described in that standard's own file to have actually
been run, with its result recorded.

**"Implemented on the site" is not the same as "Met".** Every rule applies to
every surface individually, so a requirement satisfied on the documentation site
and absent from the application is a requirement that is half done — and the
site's own implementation has not been audited against its checklist either.

## The two constraints every standard is implemented under

**1. The interface source is a verbatim copy.** Every file that would need to
change lives under `design/`, which the port verifier holds byte-identical to the
pinned upstream tree. Each edit requires an entry in `MODIFICATIONS.md` naming
the reason and listing the paths. This is not an obstacle to route around — it is
what makes the delta from upstream reviewable, and what keeps the licence notice
accurate. See [../porting/verification.md](app-doc://article/material-designer.repository.f5f04f6f9306bda7).

**2. Every rule applies to every surface, individually.** The application, the
landing page, the documentation site, each settings tab, each nested panel and
each dialog. "It is small", "it is only documentation" and "nobody customizes
that one" are not exemptions. Where a rule genuinely cannot apply to a surface,
the standard's own file names the rule and the reason — leaving a silent gap
reads as an oversight to the next person and as a decision to nobody.

## The design source of truth

`mockups/open-design-m3/` holds a single-page mockup specifying the intended
interface: ten screens, the full colour-role set in light and dark across four
palette seeds, the shape and motion scales, the window chrome, and most of the
standards above rendered as working markup. It is a specification, not a build —
nothing in it is wired into the application.

Where a standard is met by the mockup but not by code, its file says **designed,
not built** and points at the specific part of the mockup that specifies it.
Where the mockup itself falls short of the standard, the file says that too —
and where the mockup does something the standard forbids, the file says that
loudest, because a faithful port carries the violation in with the design.

Three such traps are recorded in this category and are worth knowing before
porting anything: the surprise's off switch
([dim-sum-surprise.md](app-doc://article/material-designer.repository.3548ed3bf945f48d)), the third-party font links
([local-assets.md](app-doc://article/material-designer.repository.4be713d73b6329d4)), and hard-coded context-menu shortcut labels
([context-menu-shortcuts.md](app-doc://article/material-designer.repository.1760391787c55268)).

## Suggested reading

- [../README.md](app-doc://article/material-designer.repository.0b5ca119d2be595a) — the house convention every article in this tree follows
- [../porting/verification.md](app-doc://article/material-designer.repository.f5f04f6f9306bda7) — the verifier that constrains how any of this gets implemented
- ../build/from-source.md — how to build the application these standards apply to
- ../site/ — the documentation site, which is held to every standard here in its own right
- `ROADMAP.md` — the phased plan, with a tracked work item behind each status above
