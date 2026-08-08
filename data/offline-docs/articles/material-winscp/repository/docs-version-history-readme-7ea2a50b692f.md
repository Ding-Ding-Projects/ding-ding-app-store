# Version history

Every user-managed record this application owns is snapshotted into a local
git repository, so any create, edit or delete can be undone — and the undo can
itself be undone.

## Articles

| Article | Covers |
| --- | --- |
| [snapshots.md](app-doc://article/material-winscp.repository.9b849c9c664a138d) | What is snapshotted, when, and how the repository is laid out. |
| [restore.md](app-doc://article/material-winscp.repository.ebb74e50dc63fd26) | Restoring, the append-only rule, and the AAD trap that makes naive restores unrecoverable. |
| [history-panel.md](app-doc://article/material-winscp.repository.20297aa033513700) | Browsing, diffing, labelling, and the date and action filters. |
| [document-discard.md](app-doc://article/material-winscp.repository.f275249e48539695) | The auditable history action and recovery copy for discarded unsaved edits. |

## The four rules

1. **Everything the user manages is covered** — sites, folders, workspaces,
   transfer presets, custom commands, extensions, themes, file-colour rules,
   host-key trust decisions, **and settings**. A history that covers documents
   but loses a mistakenly deleted account has satisfied the letter of the rule
   and none of its point.
2. **History is append-only.** Restoring an old revision writes a *new* revision.
   Nothing is ever rewritten or discarded, so experimenting is safe.
3. **It lives beside the app's data, never inside a user folder.** A `.git`
   appearing inside someone's Documents would be both surprising and dangerous.
4. **A failed history write never fails the operation the user asked for.** It is
   logged and the work proceeds.

## Postman

Not applicable — this project exposes no HTTP API. See the
[documentation index](app-doc://article/material-winscp.repository.0b5ca119d2be595a).

## Suggested articles

- [The site manager](app-doc://article/material-winscp.repository.3daf06486972e947) — the most-edited records.
- [Credential storage](app-doc://article/material-winscp.repository.9d2325dcc3bf8dd4) — why snapshots hold ciphertext.
- Search and regex — the history panel's own search bar.
