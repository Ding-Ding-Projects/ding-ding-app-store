# Interface and appearance

The whole interface is Material Design 3 — tokens, typography, shape, elevation
and motion. No legacy chrome survives anywhere. Data-encoding colours (chart
series, status swatches, file-colour rules) are exempt, because those are data
rather than decoration.

## Articles

| Article | Covers |
| --- | --- |
| [material-3.md](app-doc://article/material-winscp.repository.1474a4afa155711f) | The token system, themes, density and the live preview. |
| [appearance-editor.md](app-doc://article/material-winscp.repository.caaac4c702e76f8b) | Per-element "Edit appearance…", Word-depth typography, presets and reset. |
| [colour-picker.md](app-doc://article/material-winscp.repository.25d2616d40d87a4c) | The infinite colour picker and the colour translator. |
| [overlays.md](app-doc://article/material-winscp.repository.4afe75df861c0d63) | Shared anchored positioning, painted surfaces and viewport scrolling. |
| [notifications.md](app-doc://article/material-winscp.repository.e5539f064fd1d9fe) | Corner toasts, persisted notification history, the notification centre, and when a modal is correct. |
| [panels.md](app-doc://article/material-winscp.repository.318c27a39f1e5801) | Commander and Explorer layouts, columns, view styles and file colours. |
| [panel-keyboard-selection.md](app-doc://article/material-winscp.repository.ec9f24c15bc14853) | Keyboard focus, Insert selection, parent-entry protection, and the last-row boundary. |
| [error-contract.md](app-doc://article/material-winscp.repository.d69567c806a2557d) | Classified failures, safe causes, retry/skip/abort decisions and IPC-safe facts. |
| [message-resources.md](app-doc://article/material-winscp.repository.6135763acd2b99f2) | Extracted WinSCP wording, positional and named formatting through IPC, and argument safety. |
| [usage-and-startup.md](app-doc://article/material-winscp.repository.32096351358e3fae) | Bounded local usage counters, startup milestones, persistence, reset and privacy boundaries. |
| [preferences.md](app-doc://article/material-winscp.repository.3a53ae038d25788e) | The preference schema, production-consumer audit, live writes, and honest unavailable rows. |
| [preferences-number-validation.md](app-doc://article/material-winscp.repository.39789100deef996e) | Numeric preference range normalization and visible-value consistency. |
| [configuration-import-export.md](app-doc://article/material-winscp.repository.c4a072bb19c95f03) | Atomic JSON backups, production-reachable WinSCP INI import/export, hierarchy mapping, and credential handling. |
| [configuration-roots.md](app-doc://article/material-winscp.repository.69169199a8299cf0) | Portable and environment-resolved WinConfiguration extension roots. |
| [winapi-boundary.md](app-doc://article/material-winscp.repository.49702ccd4bae81c3) | Cross-platform path, display, keyboard, shell, and unsupported-operation boundaries. |
| [local-drive-view.md](app-doc://article/material-winscp.repository.06107069455f71fe) | Commander local drive roots, UNC share reveal, keyboard navigation and refresh behaviour. |
| [window-geometry.md](app-doc://article/material-winscp.repository.6628e3b414bc5cc3) | Safe display metrics, minimum sizing and reachable restored window bounds. |
| [properties-rights.md](app-doc://article/material-winscp.repository.5030be57285e324b) | Defensive permission metadata parsing, editing failure semantics and accessibility. |
| [symlink-dialog-validation.md](app-doc://article/material-winscp.repository.a3d331fb5f6c2fa9) | Safe link-name validation and target/path separation. |
| [create-directory-dialog.md](app-doc://article/material-winscp.repository.d12913e1fea95966) | Async create/permission failure handling and retry behavior. |
| [cleanup-dialog.md](app-doc://article/material-winscp.repository.f3943841ade1d380) | Destructive cleanup confirmation, pending state and retryable failures. |

## The two rules that decide everything here

1. **Every rendered element is customizable**, and the editor for it opens
   anchored beside that element. A global theme alone does not satisfy this; nor
   does an editor that cannot theme its own dialog.
2. **Anything that only informs is a corner notification.** Modals are reserved
   for decisions the user must make before continuing — overwrite prompts, host
   key changes, destructive confirmations.

## Postman

Not applicable — this project exposes no HTTP API. See the
[documentation index](app-doc://article/material-winscp.repository.0b5ca119d2be595a).

## Suggested articles

- Tabs and navigation — tabs are appearance targets too.
- Accessibility and languages — the constraints every surface here obeys.
- Search and regex — every settings surface carries a search bar.
