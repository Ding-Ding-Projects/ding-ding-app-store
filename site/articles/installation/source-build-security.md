---
id: source-build-security
title: Source-build security
titleYue: 原始碼建置安全
category: installation
status: limited
summary: Provides a typed, bounded source-job and repair runtime with a zero-host-mount Windows Sandbox transport, fixed guest bootstrap, output manifests, disposal receipts, and a fail-closed status when the live protocol is not connected.
---
# Source-build security

## Behaviour

Applications without a reviewed binary adapter can be marked `source-build` and show an Install from source action. That action opens the read-only source terminal immediately and asks the main process to start a strict typed source job. The common runtime validates consent, catalog identity, a pinned recipe, one-job capacity, isolation attestation, fixed steps, output bounds, cancellation, and cleanup before a broker can execute anything.

There is no phrase-entry dialog and no interactive terminal prompt. The renderer cannot provide commands, paths, URLs, environment values, dependencies, revisions, or OpenCode arguments. Failed or cancelled source jobs offer up to two typed automatic retries, still using the original catalog ID and reviewed recipe. The production transport emits a Windows Sandbox document with an empty mapped-folder list, disabled clipboard/audio/video channels, and ProtectedClient enabled. Its fixed guest bootstrap downloads the pinned archive inside the guest, validates its digest, executes only reviewed vectors, transfers bounded output metadata, and posts a nonce-bound completion. The main process accepts a peer only after a per-job challenge with a fresh nonce, matching broker/transport identity, bounded timestamps, a plan digest, and a capability lease covering both `execute` and `dispose`; stale, replayed, cross-plan, and cross-transport responses are rejected. Teardown requires a disposal receipt proving process-tree stop, guest deletion, zero host mounts, and no credential/secret injection. Orphan `.wsb` records and app-owned workspaces are retried through a bounded recovery pass. The packaged recipe catalog contains thirteen rows: nine ready Node recipes and four explicit blocked native/verification rows. The production peer is wired into the main process with an ephemeral host listener, per-job token, nonce-bound routes, broker-mediated archive/output transfer, and explicit process-tree disposal; blocked rows still fail closed before a guest is created.

## Configuration

Reviewed recipes can supply immutable source archives, canonical dependency bootstraps with versions/digests, direct executable vectors, working directories, expected outputs, repairable steps, and finite limits for all 25 catalog applications. Users control only persisted consent and the typed `build`, `run`, or `cancel` decision. Successful guests return a manifest of relative output paths, bytes, and SHA-256 values; the terminal can list that manifest and export a JSON record or ZIP containing only transferred output bytes. There are no hidden host-side defaults that turn a failed attestation into execution.

## Failure modes

Unknown applications, malformed or duplicate requests, absent consent, missing or mismatched recipes, unsupported Windows Sandbox, missing `WindowsSandbox.exe`, unverified feature state, disconnected guest transport, invalid or replayed broker nonce, identity mismatch, stale attestation, expired capability lease, bootstrap/digest/version failure, cancellation, timeout, repair exhaustion, path or configuration escape, excessive output/diff/tree, cleanup failure, and missing expected outputs produce factual terminal failures. This is a supported safety state: it does not create an installed record or claim that dependencies were installed.

## Security considerations

Source builds execute repository code and therefore require an attested disposable boundary with pinned revisions, bounded resources, controlled network, no user secrets or host mounts, cancellable whole-guest supervision, allowlisted outputs, and disposal before cleanup. The broker handshake is bound to the job UUID, one challenge nonce, the expected broker/transport identity, and short freshness windows; the execution lease ends at the bounded job deadline plus a short teardown grace period and is checked for both execution and teardown capabilities. OpenCode's explicit automatic approval is confined to that guest; project config, plugins, MCP, instructions, Git metadata, sharing, snapshots, LSP, and auto-update are excluded. None of those requirements is weakened by presenting a Build button.

## Verification

Focused source-runtime tests exercise strict contracts, nonce/identity/freshness/expiry validation, plan/policy/guest binding, zero-mount `.wsb` rendering, consent, concurrency, a real loopback protocol handshake, broker-mediated archive/output transfer, fake-broker cancellation and timeout, typed retry, event bounds/redaction, path/symlink escape, pinned OpenCode metadata, guest-only OpenCode bootstrap validation, bounded repair and exact rerun, output manifest/export bounds, orphan recovery, cleanup ownership, Windows Sandbox capability probing, and installer separation. The renderer, preload, and main process build with the output-list/export route. No live guest, dependency installation, OpenCode run, source application, or packaged terminal interaction has been executed on this host; the live Windows Sandbox smoke remains blocked until the feature and guest executable are available, so no live guest execution or process-tree receipt is claimed.

## Suggested articles

- [Verified installer operations](verified-installer-operations.md)
- [Automatic repair and universal adapters](automatic-repair-and-universal-adapters.md)
- [Privacy and security](../security/privacy-and-security.md)
