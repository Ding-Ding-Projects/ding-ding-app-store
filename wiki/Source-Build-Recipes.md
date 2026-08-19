# Reviewed source-build recipes

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

`data/source-recipes.v1.json` contains exactly thirteen source-build records. Every record pins a full public source revision and the SHA-256 of the GitHub archive at that revision. Ready records carry a bounded Node.js runtime artifact, workspace-relative executable/argument vectors, working directories, step timeouts, expected outputs, a typed readiness contract, and two-or-fewer automatic repair attempts. The renderer still submits only the catalog ID plus `build` or `run`; it cannot provide a command, path, URL, environment value, or shell string.

Four records are intentionally explicit `blocked` rows. Material Encryption's pinned `package.json` combines npm-resolved `sharp`/Electron artifacts with a driver build and has no clean packaged-output proof. Material Ollama's pinned `package.json` is verification-only while the real tree spans Go, CMake, nested llama.cpp/MLX/Tow Fat inputs, and a Windows build wrapper without a complete bounded output contract. Material Sandbox exposes Qt, MSVC, driver/service, jom, and Inno Setup targets without pinned See Fut artifacts. Material VirtualBox delegates to `tools/build-windows.ps1` and `configure.py` across Python, Windows SDK, Qt, kBuild, MSVC, EFI, and Mesa inputs without a complete pinned See Fut manifest. Blocked rows use `readiness.target = not-applicable`, expose no final output, expose no executable steps, and are rejected by the main process before a guest is created.

## Configuration

Recipes use the public Node.js `v22.23.2` Windows x64 archive (`1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97`) for the reviewed JavaScript applications. The source runner resolves workspace-relative tool paths inside the disposable guest and keeps the existing zero-mount, no-secret, shell-free transport policy.

## Failure modes

Invalid IDs, duplicate rows, stale or malformed revisions, incorrect archive digests, absolute paths, shell operators, Git executables, missing readiness data, missing validation/build steps, and repair IDs that do not name a step fail schema validation. A blocked row produces a factual terminal failure and never falls back to host execution. A source archive or dependency digest mismatch remains a terminal failure.

## Security considerations

The schema accepts only bounded workspace-relative executable paths and rejects Git, absolute host paths, control characters, and shell operators. Dependency URLs are HTTPS-only and carry an exact SHA-256. The renderer never sees this recipe data as an editable command surface; it can request only a typed application ID and decision.

## Verification

`tests/source-recipes.test.ts` is the hand-written thirteen-ID completeness inventory, validates every pinned revision/archive digest/readiness contract, and proves the negative regression by removing one exact row and restoring it. `tests/source-runtime.test.ts` continues to cover vector safety and plan binding. The recipes are catalog evidence; clean Windows build, packaged output, and runtime window proof remain pending for any row whose recipe is blocked.

## Suggested articles

- [Source-build security](Source-Build-Security)
- [Automatic repair and universal adapters](Automatic-Repair-and-Universal-Adapters)
- [One-click installation and adapter coverage](One-Click-Installation)
