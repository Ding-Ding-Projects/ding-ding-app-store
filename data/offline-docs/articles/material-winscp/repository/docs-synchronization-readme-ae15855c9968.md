# Synchronization

Synchronization compares a local directory against a remote one and produces a
list of differences — then, only if the user agrees, acts on it. The comparison
engine lives in `design/main/sync.js` and is entirely separate from the acting:
you can generate a checklist and never transfer a thing.

## Articles

| Article | Covers |
| --- | --- |
| [synchronize.md](app-doc://article/material-winscp.repository.0a1ea65f73dd97ac) | The one-shot synchronize operation: directions, modes and criteria. |
| [comparison-checklist.md](app-doc://article/material-winscp.repository.cff66120cc0dd312) | The reviewable list of differences, policy-aware selection, and per-item overrides. |
| [keep-up-to-date.md](app-doc://article/material-winscp.repository.04b191ece9141ae0) | Continuous watching, and synchronized browsing. |
| [watcher-cancellation.md](app-doc://article/material-winscp.repository.00695102e67db078) | Cancellation of comparisons that are still waiting on adapter I/O. |
| [docker-diff-smoke.md](app-doc://article/material-winscp.repository.13c5ea98a13b4b72) | The opt-in smoke against throwaway Docker SFTP and FTP servers. |

## The rule that shapes everything here

**Nothing is deleted or overwritten before the user has seen a list of what
would happen.** Synchronization is the feature most capable of destroying work
in this application, so the checklist is not an optional preview — it is the
operation, and transferring is what happens after it is accepted.

## Postman

Not applicable — this project exposes no HTTP API. See the
[documentation index](app-doc://article/material-winscp.repository.0b5ca119d2be595a).

## Suggested articles

- Transfers and the queue — where accepted checklist items go.
- [File masks](app-doc://article/material-winscp.repository.a3cb68eed237457c) — the include/exclude language the comparison honours.
- Version history — what protects the *settings*, not the files, from a mistake here.
