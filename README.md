# Ding Ding App Store

Material Design 3 desktop software center for discovering, documenting, installing, launching, updating, building, and uninstalling supported public applications from [Ding Ding Projects](https://github.com/Ding-Ding-Projects).

`npm install && npm start`

**Documentation site:** <https://ding-ding-projects.github.io/ding-ding-app-store/><br>
**Current state:** active development; every successful cloud workflow publishes a verified unsigned Windows release with immutable Squirrel assets. See the [releases page](https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases) for the current version, code name, timing, line-count table, and download files.

## Contents

- [Application architecture](#application-architecture)
- [Screenshot gallery](#screenshot-gallery)
- [Security and trust](#security-and-trust)
- [Development](#development)
- [Project guidance](#project-guidance)

<details id="application-architecture">
<summary><strong>Application architecture</strong></summary>

- Frameless Electron window with a React/TypeScript Material Design 3 renderer.
- Branded Ding Ding App Store identity: native title and ICO installer icon, bundled SVG title-bar mark, and startup diagnostics that surface renderer load failures instead of falling back to the Electron shell.
- Sandboxed renderer (`contextIsolation`, no Node integration) and a narrow typed preload bridge.
- Reviewed, versioned public catalog; private repositories and infrastructure never enter the product catalog.
- Stable-release comparison for every catalog entry, explicit staged per-application **Install update** controls, and a separate unsigned Squirrel self-updater with bounded RELEASES/package-hash validation, cancellable discovery/download states, immutable release-note links, rollback warning, and explicit restart-only self-update installation.
- A closed 25-ID install-adapter map: 22 reviewed Squirrel/MSI/NSIS/Mozilla-NSIS/jpackage/portable routes and three explicit public-state blockers.
- Exact registry/managed-portable discovery, including clearly labelled discovery-only upstream installs that never inherit App Store ownership, launch, update, or removal actions; reviewed installed-executable launch identities; freshly derived protected removal descriptors; append-only operation history; a local Git version browser with bounded diffs, labels, reversible restore of settings, installed records, workspace, appearance, schedules, run metadata, and external-editor preference, Activity search/date projection, range-aware version selection, and metadata-only JSON/Markdown revision export; and filtered truthful export (19 formats, including a bounded re-importable ZIP archive with UTF-8/LF manifest metadata plus a bounded 7z option surface that fails closed until an approved in-process encoder exists). Credentials, vaults, staged update paths, and user project files never enter snapshots.
- Installer and application-launch execution owned by the main process; the renderer cannot provide commands, executable paths, URLs, or arguments. Launch is available only for proof-verified, App Store-managed records with an exact reviewed executable identity; ambiguous identities remain disabled.
- Offline documentation articles with an in-app browser and full local search/regex builder, including 25 generated catalog metadata records with public source links and truthful adapter/blocker boundaries.
- Catalog, Installed, and Updates controls use the persisted English, Hong Kong Cantonese, or bilingual mode for bulk actions, status pills, loading/empty states, update actions, and accessibility names while keeping versions and identifiers factual.
- Memory synchronization documentation now has a dedicated limited-status category for the shared Status Hub and convenience-skill boundaries, with provenance, fail-closed, secret-exclusion, and no-host-authority wording mirrored into the offline browser, site, and wiki.
- A top-level Authenticator tab provides bounded local URI/Base32 TOTP registration, local clipboard and QR image-file import, in-process QR matrices, local camera scanning, pairing confirmation, safeStorage-backed metadata entries, current/next-period codes, countdowns, regex search, metadata-only rename/reorder, stable UUID-backed groups with colour/order/collapse controls, a keyboard-searchable regex move picker, two-key/full-slider group deletion, visible-range selection, destructive single/bulk entry delete, redacted JSON/CSV/Markdown export, and deliberate JSON/CSV secret export behind the native super-confirmation. Protected authenticator metadata/ciphertext history restore remains unavailable on the production host until a reviewed native handle-relative no-follow adapter exists.
- Activity and Local versions now have a separate protected-history credential gate. The verifier is encrypted with the operating-system credential vault, only a short-lived main-process session is unlocked, all history IPC routes are sender-checked and School-mode aware, and ordinary exports remain redacted. Protected authenticator metadata/ciphertext restore is deliberately unavailable on the production host until a reviewed native handle-relative no-follow adapter exists; no path-based fallback is attempted, and ordinary history restore remains available.
- Universal School mode now uses one revisioned shared record with an opaque epoch, live parent-directory observation, bounded polling reconciliation, stale-writer compare-and-swap, real PIN/password credential rotation, and explicit unreadable/unwatchable/conflict states. Already-running apps receive enabled-state, chosen-name, and credential-record revisions without restart; unknown state keeps restricted English presentation instead of being mistaken for off.
- Persistent browser-style tab rail with left/right/top/bottom docking, pinning, grouping, overflow, four independent regex-backed tab searches, reversible bulk close/reopen, and complete keyboard control whose context-menu key caps and assistive shortcut metadata come from the same live binding registry.
- Tab, group, and bounded appearance-property UX locks plus a local Support Tickets desk are available from Settings → Locks & Support and target menus. Every appearance-token row also exposes **Lock this property** or **Manage property lock** with the canonical `element:token` target, keyboard names, and explicit School-mode or unavailable-vault disabled states. Each lock can use an independently stored password or TOTP credential, with encrypted main-process vault storage, strict target validation, rate limiting, fail-closed metadata handling, and main-side appearance mutation checks. Tickets never leave this device and only open the exact app-data folder for a user-led reset. TOTP locks support local QR pairing, SHA-1/SHA-256/SHA-512, 6–8 digits, bounded periods, adjacent-period skew, and session/15-minute/60-minute unlock durations. Lock-list bulk management and protected lock-history restore remain explicitly deferred; Support Tickets bulk advance/export is shipped.
- Support Tickets also provides visible-scope checkbox/keyboard selection with Shift-range intent, select-shown/invert/clear counts, serialized **Advance selected** transitions (never delete), atomic persistence with truthful rollback/uncertain outcomes, redacted local history, and JSON/Markdown download or Visual Studio Code export.
- Per-surface search state, a full regex builder everywhere, and a command palette that reaches every page, command, setting, and appearance control.
- Per-element appearance editor with live preview, reset, and export/import, applied through CSS custom properties only.
- Every exposed export surface also offers a truthful Open in VS Code action: the main process validates PATH/install locations or a native portable selection, writes an app-owned workspace, and launches with shell-free arguments. A child-process error or missing launch event within two seconds is reported as unconfirmed rather than success, while the export remains recoverable. Activity ZIP exports are safely extracted into that workspace before opening the folder; ordinary downloads remain available when VS Code is absent, and the command palette keeps download and explicit-open commands separate.
- The External editor settings card follows the persisted English, Hong Kong Cantonese, or bilingual mode for its explanation, edition choices, availability states, tooltips, and recovery actions; validated executable labels and error facts remain unchanged.
- Main-process update schedule with a launch check that cannot be disabled, bounded repeat intervals, and quiet hours that hold notifications without delaying checks.
- In-app changelog browsing with exact release/commit records, app-language-driven dates, English/Hong Kong Cantonese/bilingual controls and five-level outcome voice, plain-text-first regex search, a month/year-jump calendar with two-click range selection and presets, localized validation and bridge failures, filtered Markdown export, truthful VS Code opening, and sender-validated full-SHA commit navigation whose fixed repository URL is constructed only in the main process.
- Optional renderer-only spoken notification narrator, off by default, with English/Hong Kong Cantonese/both delivery, serialized queueing, quiet-hours/reduced-sound suppression, and no network or privileged audio bridge.
- NotificationCenter follows the persisted English, Hong Kong Cantonese, or bilingual mode across its history heading, filters, bulk controls, export/open actions, states, accessibility names, and destructive confirmation while retaining exact record facts. Selected-record Recovery details summarize typed recovery kinds without inventing a retry because persisted history intentionally contains no callback or operation ID.
- Source execution isolation status is visible in Settings → General without a hidden search prerequisite, and the command palette provides **Open source execution isolation details**. The card remains read-only and fail-closed: it reports guest transport evidence and remediation but never starts host source or OpenCode execution.
- The static documentation site now carries its own local-only personal-vocabulary contract: a visible General-settings JSON picker with strict UTF-8/schema/size/depth/duplicate/unsafe-key validation, browser-local validated cache with replace/clear/corruption fail-closed states, technical-token-preserving canonical-article labels, and an explicit site-only restricted presentation switch. It does not claim access to the desktop app's shared School-mode record, and no private vocabulary values ship in the site or generated bundles.

</details>

<details>
<summary><strong>Packaged runtime evidence</strong></summary>

The unsigned packaged application was driven on the sanctioned hidden Windows desktop. Fresh captures from the current production build cover the catalog, install status, updates, documentation browser, activity/export history, settings, appearance controls, command palette, and tab action/search controls.

</details>

<details id="screenshot-gallery">
<summary><strong>Screenshot gallery — real packaged surfaces</strong></summary>

These captures are from the built application on the hidden Windows desktop; they are evidence of the rendered surfaces, not mockups. The gallery covers the main workspace, tab controls, command discovery, settings, appearance, and export surfaces. Install is one click; only uninstall keeps the native destructive gate.

| Surface | Runtime capture |
| --- | --- |
| Catalog discovery, bilingual navigation, search, one-click install cards, and command-palette hint | ![Catalog discovery runtime capture](docs/assets/screenshots/final-catalog-runtime.png) |
| Installed tab and empty-state detection when no App Store-managed apps are present | ![Installed-app detection runtime capture](docs/assets/screenshots/final-installed-runtime.png) |
| Updates tab with the same per-surface search and bulk controls | ![Updates runtime capture](docs/assets/screenshots/final-updates-runtime.png) |
| Offline documentation browser rendered inside the app | ![Documentation browser runtime capture](docs/assets/screenshots/final-docs-runtime.png) |
| Append-only activity history and export surface | ![Activity and export runtime capture](docs/assets/screenshots/final-activity-runtime.png) |
| Settings surface with section tabs, search, language, funny-level, and source-repair consent controls | ![Settings runtime capture](docs/assets/screenshots/final-settings-runtime.png) |
| Appearance settings with rail layout preview and customization controls | ![Appearance settings runtime capture](docs/assets/screenshots/final-appearance-runtime.png) |
| Command palette listing pages and tab commands | ![Command palette runtime capture](docs/assets/screenshots/final-command-palette-runtime.png) |
| Tab action panel with local filter, regex builder affordance, pinned-tab protection, and bulk-close previews | ![Tab actions runtime capture](docs/assets/screenshots/final-tab-actions-runtime.png) |
| Earlier catalog capture with the live public metadata state | ![Earlier catalog runtime capture](docs/assets/screenshots/catalog-runtime.png) |
| Earlier installed-app capture used to validate detection and action layout | ![Earlier installed runtime capture](docs/assets/screenshots/installed-runtime.png) |
| Earlier activity-history capture with export controls | ![Earlier activity runtime capture](docs/assets/screenshots/activity-runtime.png) |

</details>

<details id="security-and-trust">
<summary><strong>Security and trust</strong></summary>

Install and Reinstall are genuine one-click actions: the catalog button immediately submits only the application ID and a closed install decision, with no phrase-entry dialog. Installable assets still require an allowlisted application, one app-specific adapter, an HTTPS GitHub release origin, bounded declared/received size, and either GitHub SHA-256 metadata or a GitHub-digested companion checksum. Install results are recorded only after hidden shell-free execution and exact installed-app rediscovery. Uninstall re-derives its authority from the current reviewed registry/portable identity and still requires the two-key plus full-slider destructive confirmation.

The former cloud install-proof route is retired. Its typed adapter allowlist remains source-controlled, while real install, exact rediscovery, uninstall, and absence evidence now belongs to the local disposable-Windows proof lanes described in the [thirteen-product lifecycle proof](docs/features/verification/lifecycle-proof.md). Each remaining executable adapter still needs its own narrowly reviewed proof lane; the current [25-app adapter matrix](docs/features/installation/one-click-installation.md) records every missing release, archive, source-toolchain, dependency-bootstrap, disposable-runner, bounded OpenCode-repair, cancellation, and runtime-proof requirement without treating a guessed command as an adapter.

The legacy install-adapter workflow and its side-effect route are retired. The current lifecycle contract is the local, bounded [thirteen-product proof harness](docs/features/verification/lifecycle-proof.md), which writes `ding-ding-app-store.lifecycle-proof.v2` receipts for source archive/digest/build/output/run readiness, release installation, exact ownership rediscovery, process/window readiness, uninstall, absence, and guest disposal. GitHub Actions build, package, publish, and collect safe evidence only; they do not run tests, lint, type-check, or static analysis. Run focused local checks before dewing and report cloud publication separately.

The exact thirteen source recipes are catalogued in `data/source-recipes.v1.json` and mirrored by the hand-written lifecycle matrix. `scripts/source-lifecycle-proof.mjs` persists build-from-source, run-from-source, install, launch, uninstall, and disposal receipts, but only an explicitly attested Windows Sandbox driver may execute them; the integrated peer records `guest-lifecycle-agent-unavailable` for installer/inner-app evidence until a guest-side agent exists. The four native rows remain blocked until their exact toolchains and digests are reviewed. No source is ever executed directly on the host.

Code signing is intentionally prohibited. Published Windows packages are unsigned and may trigger Windows SmartScreen or an unknown-publisher warning.

</details>

<details id="development">
<summary><strong>Development and verification</strong></summary>

```powershell
npm install
npm run check
npm run build
npm run dist
# Fresh-machine, no-prompt build
build.bat /s
# Fresh-machine, unsigned Squirrel.Windows installer
build-installer.bat /s
```

The application uses Squirrel.Windows. A successful package must contain `Setup.exe`, `RELEASES`, and a full `.nupkg`, and the executable must be verified as unsigned.

`build.bat` and `build-installer.bat` install or reuse Node.js 22 in a user-scoped location, use the locked `npm ci` path, and accept `/s`, `--silent`, or `SILENT=1` for automation. The installer script writes `release/local-installer-manifest.json` with the source commit, artifact sizes, and SHA-256 digests. It never publishes a release, pushes a tag, or invokes code signing.

The tab rail is a real persisted workspace: it defaults to the left edge but can dock to any edge, keeps pinned tabs protected, gives every strip/group/group-name/master search its own regex builder state, and previews **Close tabs containing text** / **Close tabs not containing text** before a second confirmation click. Closed tabs remain recoverable from the tab-actions panel; the final open tab cannot be closed.

### Public design reference

The offline Material Design 3 reference lives in [`design/reference.html`](design/reference.html). It documents the seven application pages, five Settings subtabs, responsive 1440px/820px/360px layouts, English/Cantonese/bilingual copy, light/dark themes, and query-addressable interaction overlays. Open it directly in a browser, or use the plain sandboxed Electron viewer with `npm run design:reference`; `npm run design:compare` selects a fixed, task-owned comparison row. The fixtures are explanatory and contain no network or installer behavior.

</details>

<details id="project-guidance">
<summary><strong>Project guidance</strong></summary>

Repository-specific agent rules are in [`AGENTS.md`](AGENTS.md). The canonical feature documentation under [`docs/features/`](docs/features/), generated catalog metadata under [`docs/catalog-apps/`](docs/catalog-apps/), and the in-app documentation bundle are the behavior record; run `npm run docs:generate` after changing reviewed catalog metadata and `npm run docs:check` before committing.

</details>

## License

Apache-2.0. See [`LICENSE`](LICENSE).
