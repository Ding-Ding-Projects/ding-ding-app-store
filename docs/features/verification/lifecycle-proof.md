---
id: lifecycle-proof
title: Thirteen-product lifecycle proof
titleYue: 十三產品生命週期驗證
category: verification
status: limited
summary: Bounded source-build, install, launch-readiness, uninstall, absence, and guest-disposal receipts for exactly thirteen reviewed products.
---
# Thirteen-product lifecycle proof

## Behaviour

`lifecycle-proof.v2` is a bounded, Windows-only evidence harness for exactly thirteen reviewed source recipes. The hand-written matrix is in `scripts/lifecycle-proof-matrix.mjs`; it carries pinned revision/archive metadata, adapter identity, recipe status, and proof target for the exact recipe/catalog set. A negative regression keeps the matrix, source-recipe catalog, and `blocked-until-proof` catalog rows set-equal, so adding a catalog row cannot silently authorize a disposable run. The recipe-owned companion `scripts/source-lifecycle-proof.mjs` carries those same thirteen recipes through build-from-source, run-from-source, install, launch, uninstall, and disposal receipt slots without changing catalog `proofStatus`.

Each product receives a fresh disposable guest with no host mounts and no user secrets. The receipt records these stages in order:

1. source archive
2. source digest
3. source build
4. source output
5. source-run readiness
6. release install
7. exact App Store ownership rediscovery
8. installed process readiness
9. installed window readiness
10. exact uninstall
11. absence after uninstall
12. guest disposal

The receipt also records guest creation as a setup stage, making thirteen stage records per product. A stage can be `verified`, `failed`, `blocked`, or `skipped`; a product is verified only when every stage and guest disposal are verified. The aggregate verdict is verified only when all thirteen product receipts are present, unique, and verified.

## Configuration

Run the renderer-less harness locally with Node:

```text
node scripts/lifecycle-proof.mjs --output lifecycle-proof.v2.json
```

The default driver is deliberately unavailable and fails closed. A reviewed integration supplies an explicit `--driver-module` object implementing `createGuest`, `sourceArchive`, `sourceDigest`, `sourceBuild`, `sourceOutput`, `sourceRunReadiness`, `releaseInstall`, `rediscoverOwnership`, `installedProcessReadiness`, `installedWindowReadiness`, `exactUninstall`, `absence`, and `disposeGuest`. Driver methods receive only the typed matrix row, an opaque guest handle, a bounded timeout, and an attempt number. They do not receive renderer input, arbitrary commands, installer paths, or credentials. Each method must return `{ status: 'verified' | 'failed' | 'blocked' | 'skipped', details?: object }`.

`--timeout-ms` is bounded to 1,000–1,800,000 milliseconds and `--retries` is bounded to one through three attempts. `scripts/aggregate-lifecycle-proof.mjs` combines per-product receipts and rejects missing or duplicate matrix rows.

The live Squirrel lifecycle attempt is `scripts/prove-guest-lifecycle.mjs`. It imports the compiled main-process runtime, validates the PE `Setup.exe`, extracts the actual `.nupkg` through the bounded ZIP reader, reads the package id/version, hashes the packaged application executable, selects an explicit non-loopback host IPv4, and invokes `WindowsSandboxGuestTransport.executeLifecycle` through `WindowsSandboxProtocolPeer`. Its receipt records both independently validated values: `guestFinal.childProcessesStopped` is guest evidence, while `SourceDisposalReceipt.processTreeStopped` and `guestDeleted` are host evidence. The transfer bearer is used only for bootstrap/archive/installer routes; the peer creates a one-time receipt bearer after hello, and the helper keeps it in PowerShell memory while starting the installer with no receipt token in its command line or environment.

## Failure modes

The harness fails closed when the disposable guest/source runner or a required driver method is not integrated. It never guesses adapter arguments, ownership paths, process names, window handles, source commands, or release URLs. Paths, URLs, commands, arguments, environment values, credentials, and secret-looking fields are redacted from receipts; SHA-256 digests, bounded bytes, versions, and typed readiness booleans remain available for audit.

Timeouts reject pending work and bounded retries never continue indefinitely. The final lifecycle wait uses the full lease/job budget rather than the short per-request HTTP timeout. Guest disposal runs in a `finally` path whenever guest creation succeeds; when process-tree stop or config-root deletion is not proven, the guest, `.wsb` recovery handle, and orphan record are retained and the failure is surfaced. A failed or blocked stage cannot be promoted by a later stage, and a partial receipt is retained for diagnosis without claiming a lifecycle result. Guest install paths are separator-aware and canonicalized below guest `LOCALAPPDATA`; every existing component is checked for reparse points, including the executable and `Update.exe`, and sibling-prefix paths are rejected.

## Security considerations

The default driver performs no source execution, installer launch, process discovery, registry query, or guest mutation. A future integration must supply those capabilities through the typed driver boundary and keep secrets outside the guest. Receipts are redacted before they are written and do not contain paths, URLs, commands, arguments, environment values, or credentials.

## Verification

`tests/lifecycle-proof.test.ts` proves the exact thirteen-row matrix, fresh-guest contract, stage ordering, redaction, retry/timeout boundary, injected-driver lifecycle, unavailable-driver fail-closed result, and strict v2 receipt aggregation. `tests/source-runtime.test.ts` and `tests/guest-lifecycle-protocol.test.ts` additionally prove asynchronous endpoint resolution, non-loopback readiness, receipt-token separation, full-budget lifecycle waiting, abort recovery-handle retention, host-only disposal evidence, canonical path/reparse checks, and the `$windowPid` helper binding. The proof is deliberately local: run `npm run proof:lifecycle` or provide a reviewed driver module from a disposable Windows guest, write one receipt per matrix row, then run `npm run proof:lifecycle:aggregate -- --input-dir <receipts> --output lifecycle-proof.v2.json`. For a real packaged attempt, run `npm run build:main` first and then `node scripts/prove-guest-lifecycle.mjs --setup <Setup.exe> --nupkg <package.nupkg> --output <receipt.json>`; a Sandbox/network refusal is recorded as `blocked`, never upgraded. GitHub Actions does not run lifecycle proof or any other test gate; its workflows build, package, publish, and collect safe evidence only.

The current isolated lane supplies the harness contract, recipe receipt persistence, and attested-driver seam. The integrated protocol peer can transfer source archives/outputs and can run the fixed guest lifecycle agent for installer execution, inner-app launch, process/window inspection, uninstall, and host disposal when a live non-loopback endpoint is reachable. A wrapper HWND is never inner-app evidence, and host install paths are forbidden. No runtime lifecycle success is claimed from source-level checks or from a driver that is not explicitly marked `windows-sandbox-attested`.

## Suggested articles

- [Source-build security](../installation/source-build-security.md)
- [Verified installer operations](../installation/verified-installer-operations.md)
- [Uninstall](../installation/uninstall.md)
- [Verification and evidence](./verification.md)
