---
id: source-build-security
title: Source-build security
titleYue: 原始碼建置安全
category: installation
status: limited
summary: Provides a typed, bounded source-job and repair runtime but deliberately withholds execution until an attested hard-disposable Windows broker and reviewed recipe exist.
---
# Source-build security

## Behaviour

Applications without a reviewed binary adapter can be marked `source-build` and show an Install from source action. That action opens the read-only source terminal immediately and asks the main process to start a strict typed source job. The common runtime validates consent, catalog identity, a pinned recipe, one-job capacity, isolation attestation, fixed steps, output bounds, cancellation, and cleanup before a broker can execute anything.

There is no phrase-entry dialog and no interactive terminal prompt. The renderer cannot provide commands, paths, URLs, environment values, dependencies, revisions, or OpenCode arguments. Failed or cancelled source jobs offer up to two typed automatic retries, still using the original catalog ID and reviewed recipe. This integrated revision still fails closed because the packaged recipe catalog is empty and the production hard-disposable broker is intentionally unavailable; repository scripts and blanket-approved OpenCode never run on the host.

## Configuration

Reviewed recipes can supply immutable source archives, canonical dependency bootstraps with versions/digests, direct executable vectors, working directories, expected outputs, repairable steps, and finite limits for all 24 catalog applications. Users control only persisted consent and the typed `build`, `run`, or `cancel` decision. There are no hidden host-side defaults that turn a failed attestation into execution.

## Failure modes

Unknown applications, malformed or duplicate requests, absent consent, missing or mismatched recipes, unavailable isolation, bootstrap/digest/version failure, cancellation, timeout, repair exhaustion, path or configuration escape, excessive output/diff/tree, cleanup failure, and missing expected outputs produce factual terminal failures. This is a supported safety state: it does not create an installed record or claim that dependencies were installed.

## Security considerations

Source builds execute repository code and therefore require an attested disposable boundary with pinned revisions, bounded resources, controlled network, no user secrets or host mounts, cancellable whole-guest supervision, allowlisted outputs, and disposal before cleanup. OpenCode's explicit automatic approval is confined to that guest; project config, plugins, MCP, instructions, Git metadata, sharing, snapshots, LSP, and auto-update are excluded. None of those requirements is weakened by presenting a Build button.

## Verification

Focused source-runtime tests exercise strict contracts, consent, concurrency, fake-broker cancellation and timeout, typed retry, event bounds/redaction, path/symlink escape, pinned OpenCode metadata, guest-only OpenCode bootstrap validation, bounded repair and exact rerun, cleanup ownership, and installer separation. The renderer and main process build with the new terminal route. No live guest, dependency installation, OpenCode run, source application, or packaged terminal interaction has been executed, so those runtime claims remain pending.

## Suggested articles

- [Verified installer operations](verified-installer-operations.md)
- [Automatic repair and universal adapters](automatic-repair-and-universal-adapters.md)
- [Privacy and security](../security/privacy-and-security.md)
