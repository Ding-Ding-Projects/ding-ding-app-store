# Historical Notes

This folder contains investigations and diagnostic notes. It is not the primary user manual and it
is not the maintainer source of truth for current invariants.

- Public user workflows live in `../docs-site/`.
- Current maintainer invariants live in `../structure/`.
- Keep files here when the detail is useful for archaeology, debugging, or source research.

A feature that is still true today does not belong here alone. Write it where it can be found — a
`docs-site/` page for anything a user does, a `structure/NN_topic.md` entry for an invariant a
maintainer must not break — and leave a note here only for the investigation behind it.

## Categories

| Category | What it holds |
| --- | --- |
| [`adr/`](app-doc://article/opencodex.repository.5767cabc35c1548f) | Architecture Decision Records: why a shape was chosen, and what was rejected. |
| [`design-system/`](app-doc://article/opencodex.repository.4b973df0fcd23c38) | The GUI design system's usage contract, plus the Material 3 port handoff. |
| [`superpowers/`](app-doc://article/opencodex.repository.e6606506cea73524) | Dated design specs and the implementation plans executed from them. |

## Loose investigations

| Note | Subject |
| --- | --- |
| [`codex-app-model-catalog.md`](app-doc://article/opencodex.repository.0913b4e79a6faaa3) | How Codex App reads the shared model catalog (2026-06-20). |
| [`codex-path-investigation.md`](app-doc://article/opencodex.repository.2211a634ca8ebe3b) | Where Codex resolves its home and binaries from (2026-06-19). |
| [`github-copilot-app.md`](app-doc://article/opencodex.repository.c67ad1c573d49bd1) | Using opencodex as an OpenAI-compatible provider for the Copilot desktop app. |
| [`shadow-call-intercept.md`](app-doc://article/opencodex.repository.b05d52e2cc5dd23e) | What shadow calls are and how they are intercepted. |
