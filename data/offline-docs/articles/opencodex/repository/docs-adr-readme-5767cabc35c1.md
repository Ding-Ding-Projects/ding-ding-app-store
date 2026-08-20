# Architecture Decision Records

One file per decision, numbered in the order it was taken. An ADR records *why* a shape was chosen
and what was rejected; it is not a manual. When the behaviour it describes changes, add a new ADR
that supersedes it rather than rewriting history here.

Current invariants live in `../../structure/`; user-facing behaviour lives in
`../../docs-site/`.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](app-doc://article/opencodex.repository.436646935da62e00) | GUI self-update runs through a worker job | Accepted |
| [0002](app-doc://article/opencodex.repository.d0b65c96772ec364) | Doctor separates shell proxy env from the running proxy's process env | Accepted |
| [0003](app-doc://article/opencodex.repository.e1ca7df4b601942e) | DeepSeek V4 thinking history is model-scoped metadata | Accepted |
| [0004](app-doc://article/opencodex.repository.493ffe5aa24a4f58) | GUI toggle contrast and sidebar item spacing | Accepted |
| [0005](app-doc://article/opencodex.repository.aa9ae7798c172cd5) | GUI uses role-based CSS design tokens | Accepted |
| [0006](app-doc://article/opencodex.repository.20ae1c57699e52da) | Provider output defaults and web-search replay privacy | Accepted |
| [0007](app-doc://article/opencodex.repository.ae471cdc0199e32e) | Headless CLI parity through the management control plane | Accepted |

## Adding one

Take the next unused number, keep the filename `NNNN-kebab-case-title.md`, and open with
`# ADR NNNN: <decision>` followed by `## Status`, `## Context`, `## Decision`, and the consequences.
Add the row above in the same change — an index that has to be regenerated from the directory is an
index nobody trusts.
