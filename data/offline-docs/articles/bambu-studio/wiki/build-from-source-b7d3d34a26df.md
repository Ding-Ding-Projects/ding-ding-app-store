# Build from source (Windows installer)

Distilled from the canonical in-repo document
[windows-build-from-source.md](app-doc://article/bambu-studio.repository.8132b41cb4bb04d6);
shared ownership/uninstall semantics are in
[windows-native-installer.md](app-doc://article/bambu-studio.repository.3480a21e157dfff4).
Where this page and those documents differ, the repo documents win.

## Overview

The Windows installer offers an optional, interactive **Build from source** install source
alongside the default prebuilt install. When chosen, the installer bootstraps a developer
toolchain, clones the repository at the release tag, compiles the application on the user's
machine, stages the built payload, and feeds it into the **same** ownership, recovery, and
uninstall flow as the prebuilt path. It exists for advanced users who want to build locally rather
than trust the prebuilt binary.

It is deliberately restricted to interactive setup: never reachable under `/S`, and never executed
in CI. The chosen source is recorded in the registry as `InstallSource`
(`prebuilt` | `from-source`), and the uninstaller branches on that value.

## End-to-end flow

The build runs in a per-run session directory under
`%LOCALAPPDATA%\codingmachineedge\BambuStudioMD3-FromSource\<timestamp>` — user-writable and
entirely outside the fixed install directory. A PowerShell orchestrator is launched asynchronously
(no console window) and the installer polls it roughly every 500 ms. Pipeline:

1. **Pre-flight** — session directory writable, ~40 GB free disk, TCP reachability of
   `github.com:443`.
2. **Toolchain bootstrap** — install Git, Node.js LTS, the Visual Studio 2022 C++ Build Tools
   (with the Windows 11 SDK `10.0.22000` and VC CMake component), and CMake — each probed first
   and installed only if missing, preferring `winget` with pinned official vendor installers as
   silent fallbacks. `PATH` is refreshed from the registry after each install.
3. **Clone + checkout** — `git clone` of the product source repository, then checkout of the
   release tag.
4. **opencode install + config** — `npm install -g opencode-ai`, then a project-local
   `opencode.json` written into the clone (see below).
5. **Build with a bounded repair loop** — the documented Windows build path (`build_win.bat` for
   deps and app, then the CMake `install` target staging the payload), each phase wrapped by the
   repair loop.
6. **Stage verification + manifest** — confirm the staged `bambu-studio.exe` exists and write the
   owned-files manifest.

On success the staged payload is copied into the fixed install directory and the manifest becomes
`.md3-owned-manifest.txt`; ownership marker, recovery uninstaller, registry registration
(`InstallSource=from-source`), and reparse guards are the shared, unchanged flow.

## Exit-code contract

| Code | Meaning | Installer action |
|---|---|---|
| 0 | payload staged, manifest written | proceed to the shared ownership install |
| 10 | toolchain bootstrap failed | fatal error page, quit, no payload |
| 11 | clone or checkout failed | fatal error page |
| 12 | opencode install failed | fatal error page |
| 20 | build failed after max repair cycles, or staged payload incomplete | offer prebuilt fallback or leave window closable |
| 30 | pre-flight (network/disk/writable) failed | fatal error page |
| 40 | unexpected orchestrator error or launch failure | fatal error page |

Every failure dialog reports the `build.log` path. On the bounded failure (20), a bilingual dialog
offers to install the prebuilt version instead.

## The opencode repair loop

opencode is the automated repair assistant. On a failing build phase the orchestrator captures the
step name and recent log tail, asks opencode to diagnose and fix the cause by editing repository
files (explicitly not to run the build itself), runs one non-interactive session in the clone, and
re-runs the failed phase. The budget is a cumulative cap of **5 repair-rebuild cycles across the
whole build**, surfaced in the UI as "Repair N/5".

The project-local `opencode.json` grants action classes (`edit`, `bash`, `webfetch`, plus any
future action class from the live schema) `allow`, and keeps `question` and `external_directory`
at `deny`. Because the config is project-local and `external_directory` is denied, the blanket
allow is scoped strictly to the cloned source directory. Residual risk is deliberate and
documented: within the clone, opencode can modify files and execute commands unattended during a
repair cycle — the trade that keeps the build fully headless.

## Non-closable build window

While the build runs, the progress page is non-closable (Cancel hidden, Back/Next disabled,
titlebar close removed, Alt+F4 blocked): closing mid-build would leave a partially installed
toolchain and a half-finished build with no clean recovery. Close is restored at exactly the three
terminal states — success, bounded failure, fatal error.

## Uninstall of a source build

A source build's file set can drift from the prebuilt list, so the uninstaller for
`InstallSource=from-source` is driven by the owned manifest: each file entry passes a
safe-relative-path check and the reparse guard before deletion; directories are removed
deepest-first best-effort so unknown paths keep their parents; the manifest itself is removed
last. A missing manifest aborts fail-closed with no files removed. The prebuilt branch keeps the
existing compiled uninstall macros unchanged.

## Failure modes and security notes

- Toolchain installs are machine-visible and are **not rolled back** on failure or on uninstall of
  the app; later runs reuse whatever is present.
- The session directory (clone, deps, build output, logs) is retained for diagnosis, can be large,
  and may be removed manually.
- Bootstrap downloads come from pinned official vendor sources plus the npm registry and the
  product source repository; the path runs at user level (individual vendor installers may prompt
  for their own elevation).
- In CI the feature degrades to compile-and-static-check only (the `.nsi` compiles; helpers are
  parse-checked; silent installs record `InstallSource=prebuilt`, proving from-source stays off in
  silent mode). This is intended, not a gap.

## Verification status

The from-source path compiles and is reviewed, but its first complete interactive run on a real
machine (toolchain bootstrap through installed payload) has not happened yet, and
`PRODUCT_SOURCE_REPO_URL` defaults to a placeholder the owner should confirm. See
ROADMAP.md for the
open item.
