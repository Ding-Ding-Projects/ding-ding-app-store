---
id: source-build-security
title: Source-build security
titleYue: 原始碼建置安全
category: installation
status: limited
summary: Provides a typed, bounded source-job and repair runtime with a truthful Windows Sandbox capability probe, but deliberately withholds execution until an attested hard-disposable guest transport and reviewed recipe exist.
---
# Source-build security

## Behaviour

Applications without a reviewed binary adapter can be marked `source-build` and show an Install from source action. That action opens the read-only source terminal immediately and asks the main process to start a strict typed source job. The common runtime validates consent, catalog identity, a pinned recipe, one-job capacity, isolation attestation, fixed steps, output bounds, cancellation, and cleanup before a broker can execute anything.

There is no phrase-entry dialog and no interactive terminal prompt. The renderer cannot provide commands, paths, URLs, environment values, dependencies, revisions, or OpenCode arguments. Failed or cancelled source jobs offer up to two typed automatic retries, still using the original catalog ID and reviewed recipe. The production adapter now probes for `WindowsSandbox.exe` without launching it, and reports whether the guest transport is connected; file presence alone is never treated as an attestation. A future broker must answer a per-job challenge with a fresh nonce, matching broker and transport identity, bounded timestamps, and a capability lease covering both `execute` and `dispose`; stale or replayed responses are rejected. Execute authority ends at the job deadline; dispose authority alone continues through a short bounded grace window, and repeated teardown calls share one in-flight operation. The packaged recipe catalog is empty, so this build still fails closed and repository scripts or blanket-approved OpenCode never run on the host.

## Configuration

Reviewed recipes can supply immutable source archives, canonical dependency bootstraps with versions/digests, direct executable vectors, working directories, expected outputs, repairable steps, and finite limits for all 25 catalog applications. Users control only persisted consent and the typed `build`, `run`, or `cancel` decision. There are no hidden host-side defaults that turn a failed attestation into execution.

## Failure modes

Unknown applications, malformed or duplicate requests, absent consent, missing or mismatched recipes, unsupported Windows Sandbox, missing `WindowsSandbox.exe`, unverified feature state, disconnected guest transport, invalid or replayed broker nonce, identity mismatch, stale attestation, expired capability lease, bootstrap/digest/version failure, cancellation, timeout, repair exhaustion, path or configuration escape, excessive output/diff/tree, cleanup failure, and missing expected outputs produce factual terminal failures. This is a supported safety state: it does not create an installed record or claim that dependencies were installed.

## Security considerations

Source builds execute repository code and therefore require an attested disposable boundary with pinned revisions, bounded resources, controlled network, no user secrets or host mounts, cancellable whole-guest supervision, allowlisted outputs, and disposal before cleanup. The broker handshake is bound to the job UUID, one challenge nonce, the expected broker/transport identity, and short freshness windows; the execution lease ends at the bounded job deadline plus a short teardown grace period and is checked for both execution and teardown capabilities. OpenCode's explicit automatic approval is confined to that guest; project config, plugins, MCP, instructions, Git metadata, sharing, snapshots, LSP, and auto-update are excluded. None of those requirements is weakened by presenting a Build button.

## Verification

Focused source-runtime tests exercise strict contracts, nonce/identity/freshness/expiry validation, capability-lease binding, consent, concurrency, fake-broker cancellation and timeout, typed retry, event bounds/redaction, path/symlink escape, pinned OpenCode metadata, guest-only OpenCode bootstrap validation, bounded repair and exact rerun, cleanup ownership, Windows Sandbox capability probing without process launch, and installer separation. The renderer, preload, and main process build with the terminal route. No live guest, dependency installation, OpenCode run, source application, or packaged terminal interaction has been executed; this host exposes `WindowsSandbox.exe` but does not provide a reviewed guest transport, so those runtime claims remain pending.

## Suggested articles

- [Verified installer operations](verified-installer-operations.md)
- [Automatic repair and universal adapters](automatic-repair-and-universal-adapters.md)
- [Privacy and security](../security/privacy-and-security.md)
