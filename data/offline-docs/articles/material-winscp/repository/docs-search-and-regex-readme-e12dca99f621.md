# Search and regex

Every search bar in this application — without exception — has the full regex
builder anchored beside it. Plain text is always the default; regex is always an
explicit opt-in.

## Articles

| Article | Covers |
| --- | --- |
| [regex-builder.md](app-doc://article/material-winscp.repository.e00a792e9bc916e2) | The builder itself: guided construction, the raw editor, live matches, and the engine it targets. |
| [search-surfaces.md](app-doc://article/material-winscp.repository.2488b0d37db25ff3) | Every search bar in the app, and the rule that settings surfaces have one too. |
| [file-search.md](app-doc://article/material-winscp.repository.b8b9943c99132621) | Recursive remote and local file search. |

## The rule

> Every search bar must provide direct access to the full-featured builder and
> support the resulting pattern and flags in its search operation.

And its corollary, which is the part usually missed:

> Every settings, preferences, properties or adjustment surface carries its own
> search bar wired to that same builder — the global preferences, every tab
> within them, every properties panel, and the appearance editor itself.

## Postman

Not applicable — this project exposes no HTTP API. See the
[documentation index](app-doc://article/material-winscp.repository.0b5ca119d2be595a).

## Suggested articles

- [File masks](app-doc://article/material-winscp.repository.a3cb68eed237457c) — the other pattern language, and how it converts.
- [Tab search](app-doc://article/material-winscp.repository.fddab57862530c8d) — four searches, four builders.
- Version history — whose history panel has one too.
