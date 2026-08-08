# Windows UI modernization evidence

> **Historical snapshot (2026-07-20).** This page records validation evidence from before the
> register-driven MD3 waves, the installer overhaul, and the green publish pipeline. For the
> current program state see [Home](app-doc://article/bambu-studio.wiki.355883cf07556dda), [Design System](app-doc://article/bambu-studio.wiki.3f283974edabf427), and [Releases](app-doc://article/bambu-studio.wiki.0558691a66bc6a7a); the
> in-repo [docs](https://github.com/Ding-Ding-Projects/BambuStudio/tree/master/docs),
> ROADMAP, and
> HANDOFF are
> canonical. The statements below describe the state at the snapshot date.

The fork's primary deliverable is native C++ Bambu Studio for Windows with partial UI modernization
informed by Material Design 3 roles and interactions. At the snapshot date it was not a completed
or faithful MD3 rewrite. `ui-md3` remains a design reference; it is not shipped-app evidence.

## Verified local native build — 2026-07-20

- Branch: [`codex/build-and-test-lowlevel-mcp`](https://github.com/Ding-Ding-Projects/BambuStudio/tree/codex/build-and-test-lowlevel-mcp)
- Source commit: [`3b00dc6aa`](https://github.com/Ding-Ding-Projects/BambuStudio/commit/3b00dc6aaa2da82e724e4d4d44281813e1071787)
- Renderer prerequisite: [`b4561feaa`](https://github.com/Ding-Ding-Projects/BambuStudio/commit/b4561feaa821d159ac54ef9bb166dff85f4239ae), cherry-picked as `9c4991c26`.
- Release GUI and `install` succeeded locally. Installed `BambuStudio.dll` matched the Release output SHA-256 `E2A9D5F65183B7B86A9698C1E83B938553070B4D56C97AE69B047BED569A13B6`.
- Focused CTest: `language_mode_tests`, `project_history_tests`, and `deterministic_bbs_3mf_tests` — 3/3 passed.
- DeviceWeb production lock now pins `js-yaml` 4.3.0; local `pnpm audit --audit-level high` reported no known vulnerabilities.

## Real installed-app screenshot gallery

These are visually reviewed full-display compositor captures of the installed native executable.
They are evidence of partial modernization, not proof of full Material Design 3 conformance.

| Home | Filament Manager |
| --- | --- |
| *Image omitted from the offline bundle: Native Home.* | *Image omitted from the offline bundle: Native Filament Manager.* |

| Device official plug-in boundary | App-local Git Version History |
| --- | --- |
| *Image omitted from the offline bundle: Native Device gate.* | *Image omitted from the offline bundle: Native Version History.* |

The Version History capture shows two local Git snapshots after Save As. No network plug-in was
installed and no restore/destructive operation was performed.

## CI, release, and coverage boundary

- Earlier run [29802840504](https://github.com/Ding-Ding-Projects/BambuStudio/actions/runs/29802840504) failed before C++ tests because DeviceWeb audit found the high `js-yaml` advisory.
- Repair run: [29806330072](https://github.com/Ding-Ding-Projects/BambuStudio/actions/runs/29806330072). Its final status is required before claiming hosted CI success.
- No installer/SBOM/checksum/release/attestation artifact is claimed from this validation. Authenticode is not configured.
- The focused gate is **not** full-suite coverage: aggregate `libslic3r_tests` has current API-drift compile failures and `libnest2d_tests` has known baseline runtime failures. Both are deliberately waived while maintained tests gate the branch.

## Handoff and deferred items

Project history uses a private app-local Git repository, never a `.git` next to the project and never the source repository. Shutdown is admission-only: accepted jobs drain, including bounded external-lock waits, before the worker joins.

Still deferred: repair/re-enable aggregate and libnest2d coverage, complete dark/Cantonese native smoke and human copy review, add history retention/pruning, and obtain successful hosted release-artifact evidence.

See README, ROADMAP, and HANDOFF.
