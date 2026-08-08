# Design-system features

- [Command palette: full-app coverage, rich controls and
  teleport](command-palette-full-coverage.md) — the Ctrl+Shift+F palette as MD3's
  full-screen search view: inline switches/boxes/steppers/selects for
  settings rows, and click/Enter teleporting to the exact control that owns
  each feature (Ctrl+Enter to run instead).
- [Command palette coverage](app-doc://article/desktop-material.repository.80b053e8b8294637) — the complete
  133-command coverage survey and shipped status, distinguishing live controls,
  teleport-only destinations, deliberate exclusions, and remaining catalog
  prerequisites.
- [Command palette rows and
  appearance](command-palette-appearance.md) — icon/keyword/group rows, the
  compact aligned Customize appearance editor, stable random-per-repository
  layouts, and discoverability entries for otherwise-buried surfaces.
- [Material ripple and theme reveal](app-doc://article/desktop-material.repository.e52776950bc06a05) —
  shared interaction feedback and bounded animated theme transitions.
- [Dialog wheel and trackpad scrolling](app-doc://article/desktop-material.repository.a82dda5755c15fa7) — route
  pointer scrolling from any descendant to the nearest usable dialog scroll
  owner while preserving nested controls and stacked-panel behavior.
- [Tone: per-language funny-level sliders](app-doc://article/desktop-material.repository.f763735cc85825c7) — independent
  English and Cantonese 1..5 sliders on Settings → Appearance beside the
  language mode, wired to every category of copy (not just the narrator), with
  a live preview, the voice-not-facts rule, and searchable level names.
- [Audio system](app-doc://article/desktop-material.repository.6a80bb276d31834c) — optional, off-by-default spoken narrator,
  synthesized sound effects, and per-repository music, with rate-limiting,
  quiet hours, reduced-sound, screen-reader coexistence, and funny-level tone.
- [Recorded narration + melody assets](app-doc://article/desktop-material.repository.60e2d5614ce76269) — plays the
  pre-generated per-event voice clips (English/Cantonese/bilingual, serialized
  in one non-overlapping queue) and melody cues in place of live speech and
  synthesized effects, with automatic fallback and a persisted toggle.
- [Distinct sound-effect event mapping](app-doc://article/desktop-material.repository.320fbc439e3a0c02) — pure event →
  category → motif mapping that gives push/fetch/pull and every Build & Run
  phase their own cue in four motif families, with per-category cooldowns and a
  per-cue audition grid in Settings → Sound.
- [The dim sum surprise](app-doc://article/desktop-material.repository.7866b4fb2a20d1ac) — one launch in ten shows a
  bundled photograph of a Hong Kong dim sum dish, named in both languages, as a
  self-clearing corner card that never gates startup, never takes focus, and
  has no off switch.
- [Repository-themed music](app-doc://article/desktop-material.repository.f4222f80b74a75ea) — a deterministic,
  synthesized looping theme per repository (no bundled files) seeded from its
  identity, with per-repo custom-track/mute overrides persisted in a Git-backed
  dedicated setting and a one-time migration from localStorage.
- [The Material Design 3 site](app-doc://article/desktop-material.repository.9219842db3c6ca86) — the published site
  as one Design Component: six pages in a browser-style tab strip, React and
  four content-subsetted font families vendored so nothing loads from another
  host, real URLs for a single-page site, and the contract test that proves it
  all shipped.

This category has no HTTP API. Postman collections are not applicable.
