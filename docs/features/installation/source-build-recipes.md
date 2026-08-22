---
id: source-build-recipes
title: Reviewed source-build recipes
titleYue: 已審閱原始碼建置食譜
category: installation
status: limited
summary: Pins exactly thirteen public source revisions and archive digests, typed build/run vectors, readiness contracts, bounded repair, and explicit native-toolchain blockers.
---

# Reviewed source-build recipes

## Behaviour

`data/source-recipes.v1.json` contains exactly thirteen source-build records. Every record pins a full public source revision and the SHA-256 of the GitHub archive at that revision. Ready records carry a bounded Node.js runtime artifact, workspace-relative executable/argument vectors, working directories, step timeouts, expected outputs, a typed readiness contract, and two-or-fewer automatic repair attempts. The renderer still submits only the catalog ID plus `build` or `run`; it cannot provide a command, path, URL, environment value, or shell string.

Four records are intentionally explicit `blocked` rows. Material Encryption's pinned `package.json` combines npm-resolved `sharp`/Electron artifacts with a driver build and has no clean packaged-output proof. Material Ollama's pinned `package.json` is verification-only while the real tree spans Go, CMake, nested llama.cpp/MLX/Tow Fat inputs, and a Windows build wrapper without a complete bounded output contract. Material Sandbox exposes Qt, MSVC, driver/service, jom, and Inno Setup targets without pinned See Fut artifacts. Material VirtualBox delegates to `tools/build-windows.ps1` and `configure.py` across Python, Windows SDK, Qt, kBuild, MSVC, EFI, and Mesa inputs without a complete pinned See Fut manifest. Blocked rows use `readiness.target = not-applicable`, expose no final output, expose no executable steps, and are rejected by the main process before a guest is created.

## Configuration

Recipes use the public Node.js `v22.23.2` Windows x64 archive (`1177b4137ba5adaa56354ae40f1080c7450e8ae09cecb47da459d1c52ac99f97`) for the reviewed JavaScript applications. The source runner resolves workspace-relative tool paths inside the disposable guest and keeps the existing zero-mount, no-secret, shell-free transport policy.

The 2026-08-20 source-archive review replaced Meadowmark's unrelated incomplete product-inventory prerequisite with its passing workspace TypeScript validation. Minecraft Server Command Center is pinned to `cada16999d73e19d6461fc97c0511eab5d18eb63`, whose committed lockfile makes `npm ci` deterministic. Minecraft Server Studio is pinned to `106aca7e2da0b8d788d1f7a8343571f7fffa2a6d`, whose release-catalog generator retains the reviewed baseline when a source archive has no `.git` metadata. Sprout Hollow Valley is pinned to `f0302b43ec3d0fda9fb159ef6be7607a71967ccc`, whose root build routes share a digest-verified portable Node.js bootstrap. These source-build facts do not promote any install lifecycle row beyond `blocked-until-proof`.

## Failure modes

Invalid IDs, duplicate rows, stale or malformed revisions, incorrect archive digests, absolute paths, shell operators, Git executables, missing readiness data, missing validation/build steps, and repair IDs that do not name a step fail schema validation. A blocked row produces a factual terminal failure and never falls back to host execution. A source archive or dependency digest mismatch remains a terminal failure.

## Security considerations

The schema accepts only bounded workspace-relative executable paths and rejects Git, absolute host paths, control characters, and shell operators. Dependency URLs are HTTPS-only and carry an exact SHA-256. The renderer never sees this recipe data as an editable command surface; it can request only a typed application ID and decision.

## Verification

`tests/source-recipes.test.ts` is the hand-written thirteen-ID completeness inventory, validates every pinned revision/archive digest/readiness contract, and proves the negative regression by removing one exact row and restoring it. `tests/source-runtime.test.ts` continues to cover vector safety and plan binding. Meadowmark's pinned archive completed `npm ci`, workspace type checking, and the workspace build. Command Center's dewed source completed `npm ci`, its Java-runtime package-seam check, and the main/renderer build. Studio's dewed archive completed locked install, offline-doc validation, and unpacked packaging. Sprout's dewed archive completed locked install, type checking, and the main/renderer build. Installer execution, installed-window readiness, exact uninstall, absence, and guest disposal remain blocked until the reviewed disposable guest route is available.

## Suggested articles

- [Source-build security](source-build-security.md)
- [Automatic repair and universal adapters](automatic-repair-and-universal-adapters.md)
- [One-click installation and adapter coverage](one-click-installation.md)
