---
id: verified-installer-operations
title: Verified installer operations
titleYue: 已驗證安裝操作
category: installation
status: limited
summary: Downloads one app-specific Squirrel, MSI, NSIS, jpackage, or portable-ZIP asset, verifies its bytes, and applies only a fixed reviewed adapter.
---
# Verified installer operations

## Behaviour

The main process resolves the catalog application's closed adapter, fetches its latest stable release, selects exactly one anchored asset name, verifies the bytes, and runs the adapter without further typed confirmation. Supported families are Squirrel, MSI, reviewed NSIS, Mozilla NSIS, jpackage EXE, and managed portable ZIP. Successful executable installation is recorded only when exactly one matching registry entry is new or changed after installer exit; its exact key and full-entry fingerprint become the removal ownership token. Portable installation is transactional: the new archive is extracted and validated before an existing managed version is moved aside, and the prior directory is restored if replacement fails. After the metadata commit, old-backup cleanup failure is a warning and never rolls back the new bytes beneath new metadata.

The main process exposes a strict `{ appId, decision: "cancel-install" }` cancellation request for the download and portable-extraction phases. It aborts the network/ZIP work, drains the active archive pipeline, and keeps the operation locked until cleanup finishes. Once a reviewed installer has launched, the request is refused: Windows Installer or an elevated child service can outlive a launcher process, so the App Store does not claim safe user cancellation after that boundary. A 15-minute timeout requests Windows process-tree termination and waits for both a successful tree-kill result and launcher close. If either proof is absent, the operation stays locked and its staging directory stays intact until application restart; the result is an explicit unknown termination state, never a cancellation claim. The current renderer does not yet expose this typed pre-launch cancellation route; adding that accessible control is a separate renderer-lane follow-up.

## Configuration

All privileged values live in `src/main/install-adapters.ts`. Each of the 24 IDs has one unique adapter ID; supported records include an anchored asset pattern, fixed family/arguments, exact detection identity, and source evidence. Unsupported records contain a structured blocker code and explanation. `data/catalog.v1.json` names the adapter but cannot override its executable, arguments, checksum, or paths.

Portable ZIP extraction uses the bundled `yauzl` library, so a fresh Windows profile does not need PowerShell, 7-Zip, or another archive program. Runtime dependencies belong to the selected upstream release package; no build toolchain is installed by this release-asset path.

## Failure modes

Requests fail for an unknown or extra field, a mismatched decision, a duplicate per-app install/uninstall operation, an unsupported adapter, an unavailable stable release, an ambiguous asset, missing trustworthy digest, checksum ambiguity, unsafe redirect, size/hash mismatch, cancellation, timeout, non-zero exit, archive-policy violation, absent expected executable, ownership-record failure, or staging cleanup failure. Cleanup trouble is appended to the primary outcome instead of replacing it. Registry ownership requires complete bounded before/after queries; an incomplete hive is never converted to an empty ownership snapshot. A zero installer exit followed by failed ownership discovery reports a partial/uncertain install and forbids automatic retry. Only an already-recorded same-version install may reuse an unchanged exact registry identity. If process-tree termination cannot be proven, the shared per-app lock is retained for either install or uninstall until restart.

## Security considerations

The renderer supplies no executable data. GitHub asset metadata or a separately GitHub-digested companion file provides SHA-256; the target filename in a companion file must match exactly. Download origins, redirects, sizes, staging paths, entry names, expanded size, executable locations, child environment, and time are bounded. Installer and uninstaller processes are hidden and shell-free. Uninstall always re-runs safe discovery, so a modified local JSON record cannot smuggle a command or path.

## Verification

Focused automated coverage exercises all 24 adapter identities and 21 current supported asset names, the three explicit blockers, digest companion parsing, real ZIP extraction/collision/symlink/pre-start and mid-stream cancellation cases, partial-write completion, portable commit/rollback failures, incomplete registry snapshots, registry fingerprint mutation, exact display names, and safe executable roots. Static contracts cover fixed process controls, post-close size/hash verification, exact changed-entry ownership, and the typed cancellation channel. The full repository check and build compile the main process, preload, shared contracts, renderer, workspaces, and documentation mirrors together.

No clean-Windows installer was executed by this implementation lane. The adapter contracts are source- and release-audited; fresh-VM completion, UAC behavior where a package requires elevation, real cancellation, and installed application launch remain runtime evidence rather than inferred success.

## Suggested articles

- [Catalog discovery](../discovery/catalog-discovery.md)
- [One-click installation and adapter coverage](one-click-installation.md)
- [Source-build security](source-build-security.md)
- [Protected uninstall](uninstall.md)
