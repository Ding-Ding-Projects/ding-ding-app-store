---
id: automatic-repair-and-universal-adapters
title: Automatic repair and universal adapters
titleYue: 自動修復同通用安裝配接器
category: installation
status: pending
summary: Records the requested touchless terminal, dependency bootstrap, OpenCode repair, and fresh-Windows adapter goal without presenting it as shipped.
---
# Automatic repair and universal adapters

## Behaviour

**Pending — not implemented in this branch.** The requested end state is a one-click route for every catalog app on a freshly installed supported Windows computer: detect or install declared dependencies, display an in-app terminal simulator with real bounded progress, install a pinned OpenCode build only when absent, use it to diagnose a failed reviewed build, apply validated fixes in a disposable workspace, retry within a finite budget, and launch or register the successfully built app without further typing.

The current source has none of that repair engine. Binary installation covers reviewed Squirrel/MSI adapters only; source execution is deliberately withheld. This page exists to prevent a UI label or catalog entry from being mistaken for universal support.

## Configuration

The future contract must remain catalog-owned and versioned: app identifier, pinned repository revision, dependency inventory, toolchain versions, allowed commands, expected outputs, retry ceiling, time and resource limits, and cancellation. Users may see and cancel progress, but the renderer must never inject raw commands, paths, environment values, or secrets. OpenCode installation must use a pinned, integrity-checked official distribution and must not replace an existing compatible installation silently.

## Failure modes

Missing platform support, unavailable dependency source, reboot requirement, insufficient disk, unavailable sandbox, untrusted revision, OpenCode bootstrap failure, repair exhaustion, cancellation, timeout, or missing outputs must stop with an exact terminal event and activity record. A retry ceiling prevents an endless loop. A failed repair never becomes an installed record and never falls back to host-side arbitrary script execution.

## Security considerations

Automatic repair would execute generated changes and project code, so it needs a disposable VM or equivalent, no user secrets, no host mounts, bounded network and process trees, reviewed output promotion, audit logs with redaction, and a strict separation between display-only terminal events and privileged commands. The OpenCode process must receive only the failing disposable workspace and bounded diagnostics. This pending design grants no permission to weaken existing installer checks.

## Verification

No implementation or runtime proof exists at base commit `ab56355cba953c350aeb6b349b28f1dce85d2fb3`. Completion requires contract tests that reject renderer commands and paths, clean-Windows dependency bootstrap proof, deterministic terminal-event tests, pinned OpenCode install verification, bounded repair success and exhaustion cases, cancellation, sandbox escape tests, and genuine packaged-artifact runtime capture.

## Suggested articles

- [Verified installer operations](verified-installer-operations.md)
- [Source-build security](source-build-security.md)
- [Verification and evidence](../verification/verification.md)
