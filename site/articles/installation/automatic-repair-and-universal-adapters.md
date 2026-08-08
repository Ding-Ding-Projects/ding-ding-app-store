---
id: automatic-repair-and-universal-adapters
title: Automatic repair and universal adapters
titleYue: 自動修復同通用安裝配接器
category: installation
status: limited
summary: Keeps the typed terminal, pinned OpenCode, bounded repair, consent, and hard-isolation refusal separate from the 24 reviewed release-adapter records.
---
# Automatic repair and universal adapters

## Behaviour

The common automatic-repair runtime now has a strict `start`/`cancel` IPC contract that accepts only a catalog application ID and `build` or `run` decision. Starting a source action opens a non-interactive Material Design terminal panel with bounded structured progress, stdout, stderr, cancellation, final states, screen-reader log semantics, reduced-motion support, and no command prompt. Main-process events are schema-validated, sanitized, byte/event bounded, and frozen by preload before the renderer sees them.

The source runtime defines reviewed pinned revisions, canonical dependency archives and SHA-256 digests, fixed executable/argument vectors, expected outputs, global and per-step limits, one-job capacity, finite repair attempts, exact-step reruns, diff/file/tree bounds, cancellation, and ownership-marked cleanup. It pins OpenCode `1.18.15`: official Windows x64 archive SHA-256 `a80785874978ccbb93b7bfe4345f5aed41696f5ae76c109cd6dbbb934dbe795d` and extracted executable SHA-256 `fd254474def7ee35f07416cf4674c361f07e7bcd9c7ffb284af21bb011066ee3`.

The release-installer lane now has a hand-written adapter record for every one of the 24 catalog IDs: 21 supported release routes and three explicit public-state blockers. That work does not weaken or replace this source runtime. The shipped source recipe catalog remains empty and production still uses a fail-closed unavailable isolation broker. Therefore no repository, dependency, source build, application run, or OpenCode repair executes in the current package.

## Configuration

The source recipe schema remains catalog-owned: app identifier, full 40-character revision, source archive digest, dependency inventory, tool versions and canonical HTTPS digests, fixed executable/argument vectors, expected outputs, repairable step IDs, retry ceiling, and time/resource limits. It is distinct from `src/main/install-adapters.ts`, whose release adapters contain no build or OpenCode command. Windows command shims and Git execution are excluded; recipes use direct executables such as `node.exe` plus a pinned CLI entry point.

Users persist an explicit automatic-repair consent in Settings after reading that OpenCode receives `permission: "allow"` and `opencode run --auto` only inside an attested disposable guest. The generated OpenCode config disables sharing, plugins, MCP servers, instructions, snapshots, LSP, and auto-update. Project-local `.opencode`, `opencode.json`, `opencode.jsonc`, Git metadata, and instruction files are excluded from the separate repair copy. If consent is absent or isolation does not attest zero host mounts, no profile, no credentials/secrets, fixed network scope, shell-string refusal, and cleanup-on-exit, the job stops before plan execution.

## Failure modes

Invalid or extra IPC fields, absent consent, duplicate jobs, missing recipes, unavailable or invalid isolation, untrusted revisions, dependency or OpenCode hash mismatch, invalid existing OpenCode version, bootstrap failure, path/symlink/config escape, excessive tree/diff/output, repair exhaustion, cancellation, timeout, cleanup failure, or missing outputs stop with one factual final terminal event. A failed repair never becomes an installed record and never falls back to host-side arbitrary script execution. Ordinary release-asset installation has no import or call into the repair runtime.

## Security considerations

Blanket OpenCode approval is an inner-guest convenience, not the security boundary. The mandatory outer boundary is a disposable VM or equivalent with no host mounts, profile, credentials, secrets, Git metadata, arbitrary network, or host fallback; a fixed source archive and dependency allowlist; bounded process-tree supervision; and complete guest disposal before owned host metadata is removed. The production broker currently refuses execution because that boundary has not yet been connected. Renderer output remains display-only, and installer checks are unchanged.

## Verification

Focused tests cover strict request rejection, duplicate concurrent starts, persisted-consent refusal, isolation attestation, automatic-approval confinement, terminal validation/redaction/bounds, cancellation, global timeout, path and symbolic-link escape, OpenCode archive/executable pin separation, finite repair, exact rerun, real-tree diff bounds, ownership-marked cleanup, and proof that ordinary installer code never references repair. TypeScript and renderer builds exercise the integrated contracts and terminal panel.

Still pending: a real hard-disposable broker, live OpenCode bootstrap inside that guest, any reviewed source recipe, clean-Windows dependency/build/run/output proof, packaged terminal interaction and accessibility capture, and end-to-end cancellation/process-tree disposal. The release-adapter coverage tests additionally prove ordinary installation never imports or calls this runtime. Static and fake-broker tests do not claim source execution.

## Suggested articles

- [Verified installer operations](verified-installer-operations.md)
- [Source-build security](source-build-security.md)
- [Verification and evidence](../verification/verification.md)
