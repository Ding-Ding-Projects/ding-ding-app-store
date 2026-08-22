---
id: automatic-repair-and-universal-adapters
title: Automatic repair and universal adapters
titleYue: 自動修復同通用安裝配接器
category: installation
status: limited
summary: Keeps the typed terminal, pinned OpenCode, bounded repair, zero-host-mount Windows Sandbox transport, output receipts, and truthful fallback separate from the 49 reviewed release-adapter records.
---
# Automatic repair and universal adapters

## Behaviour

The common automatic-repair runtime now has strict `start`/`cancel`/`retry` IPC contracts that accept only a catalog application ID, a typed `build` or `run` decision, or a prior job UUID. Starting a source action opens a non-interactive Material Design terminal panel with bounded structured progress, stdout, stderr, cancellation, final states, screen-reader log semantics, reduced-motion support, and no command prompt. A failed or cancelled job exposes up to two bounded automatic retries through the same reviewed recipe; it never accepts a renderer command, path, URL, or shell string. Main-process events are schema-validated, sanitized, byte/event bounded, and frozen by preload before the renderer sees them.

Before any future broker can execute, the main process issues a per-job challenge containing a cryptographically random nonce, job UUID, expected broker/transport identity, and bounded challenge/lease expiry. The broker response must echo that nonce and identity, satisfy the hard-disposable requirements, and carry a lease with distinct `execute` and `dispose` capabilities. Stale, replayed, cross-job, cross-transport, incomplete, or expired responses are rejected. A teardown lease includes only a short bounded grace window after the execution deadline, and the service coalesces cancellation and final cleanup into one teardown operation. The production adapter remains fail-closed and does not manufacture an identity or lease.

The source runtime defines reviewed pinned revisions, canonical dependency archives and SHA-256 digests, fixed executable/argument vectors, expected outputs, global and per-step limits, one-job capacity, finite repair attempts, exact-step reruns, diff/file/tree bounds, cancellation, and ownership-marked cleanup. It pins OpenCode `1.18.15`: official Windows x64 archive SHA-256 `a80785874978ccbb93b7bfe4345f5aed41696f5ae76c109cd6dbbb934dbe795d` and extracted executable SHA-256 `fd254474def7ee35f07416cf4674c361f07e7bcd9c7ffb284af21bb011066ee3`. The `ensurePinnedOpenCode` helper can reuse or download that exact archive only inside an attested guest-owned child directory, validates both hashes/version, rejects symlinks, and removes the temporary archive after extraction; it never searches the host PATH or overwrites an invalid binary.

The release-installer lane now has a hand-written adapter record for every one of the 49 catalog IDs: 44 supported release routes and five explicit public-state blockers. That work does not weaken or replace this source runtime. The source lane now packages a concrete zero-host-mount Windows Sandbox transport and fixed guest bootstrap. The `.wsb` has no mapped folders, disables clipboard/audio/video channels, enables ProtectedClient, and starts only the embedded bootstrap. The bootstrap and host protocol bind job UUID, challenge nonce, guest identity, plan digest, protocol version, and policy; output transfer is manifest-first and disposal requires a receipt proving process-tree stop and guest deletion. The production peer is wired into the main process, while the shipped source recipe catalog contains nine ready Node recipes and four explicit blocked native/verification rows, so blocked products still fail closed and no unreviewed repository, dependency, source build, application run, or OpenCode repair executes on the host.

The Settings surface and the read-only terminal simulator now call the typed isolation-status bridge directly. The Settings → General card is visible without a search prerequisite, and the command palette offers **Open source execution isolation details** to focus it. Both surfaces show the provider, exact fail-closed reason, bounded evidence, remediation, and the last check time, with a retry-status action. This makes the missing guest transport visible before a source job is attempted; it does not add a shell prompt, accept commands, or enable host execution.

## Configuration

The source recipe schema remains catalog-owned: app identifier, full 40-character revision, source archive digest, dependency inventory, tool versions and canonical HTTPS digests, fixed executable/argument vectors, expected outputs, repairable step IDs, retry ceiling, and time/resource limits. It is distinct from `src/main/install-adapters.ts`, whose release adapters contain no build or OpenCode command. Windows command shims and Git execution are excluded; recipes use direct executables such as `node.exe` plus a pinned CLI entry point.

Users persist an explicit automatic-repair consent in Settings after reading that OpenCode receives `permission: "allow"` and `opencode run --auto` only inside an attested disposable guest. The generated OpenCode config disables sharing, plugins, MCP servers, instructions, snapshots, LSP, and auto-update. Project-local `.opencode`, `opencode.json`, `opencode.jsonc`, Git metadata, and instruction files are excluded from the separate repair copy. If consent is absent or isolation does not attest zero host mounts, no profile, no credentials/secrets, fixed network scope, shell-string refusal, and cleanup-on-exit, the job stops before plan execution.

## Failure modes

Invalid or extra IPC fields, absent consent, duplicate jobs, missing recipes, unavailable or invalid isolation, nonce replay, identity mismatch, stale challenge/attestation, expired or incomplete capability lease, untrusted revisions, dependency or OpenCode hash mismatch, invalid existing OpenCode version, bootstrap failure, path/symlink/config escape, excessive tree/diff/output, retry exhaustion, repair exhaustion, cancellation, timeout, cleanup failure, or missing outputs stop with one factual final terminal event. A failed repair never becomes an installed record and never falls back to host-side arbitrary script execution. Ordinary release-asset installation has no import or call into the repair runtime.

## Security considerations

Blanket OpenCode approval is an inner-guest convenience, not the security boundary. The mandatory outer boundary is a disposable VM or equivalent with no host mounts, profile, credentials, secrets, Git metadata, arbitrary network, or host fallback; a fixed source archive and dependency allowlist; bounded process-tree supervision; and complete guest disposal before owned host metadata is removed. The production adapter probes the Windows Sandbox binary but refuses execution until the feature state, guest bootstrap, transport, process-tree disposal, and cleanup are supplied by a reviewed adapter. Renderer output remains display-only, and installer checks are unchanged.

## Verification

Focused tests cover strict request rejection, challenge nonce and identity binding, freshness and expiry, capability lease validation, duplicate concurrent starts, persisted-consent refusal, isolation attestation, automatic-approval confinement, terminal validation/redaction/bounds, cancellation, global timeout, path and symbolic-link escape, OpenCode archive/executable pin separation, finite repair, exact rerun, real-tree diff bounds, ownership-marked cleanup, the typed isolation-status renderer bridge, and proof that ordinary installer code never references repair. TypeScript and renderer builds exercise the integrated contracts, status card, and terminal panel.

Still pending: live Windows Sandbox feature-state and guest availability on a clean host, live OpenCode bootstrap inside that guest, clean-Windows dependency/build/run/output proof for the four blocked rows, packaged terminal interaction and accessibility capture, and end-to-end cancellation/process-tree disposal. The release-adapter coverage tests additionally prove ordinary installation never imports or calls this runtime. Static, capability-probe, loopback protocol, and ready-recipe checks do not claim live source execution.

## Suggested articles

- [Verified installer operations](verified-installer-operations.md)
- [Source-build security](source-build-security.md)
- [Verification and evidence](../verification/verification.md)
