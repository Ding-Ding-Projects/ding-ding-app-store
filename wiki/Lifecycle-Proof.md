# Thirteen-product lifecycle proof

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

`lifecycle-proof.v2` is a bounded, Windows-only evidence harness for exactly thirteen reviewed products. The hand-written matrix is in `scripts/lifecycle-proof-matrix.mjs`; it is intentionally separate from the catalog and installer adapter registries so adding a catalog row cannot silently authorize a disposable run.

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

## Failure modes

The harness fails closed when the disposable guest/source runner or a required driver method is not integrated. It never guesses adapter arguments, ownership paths, process names, window handles, source commands, or release URLs. Paths, URLs, commands, arguments, environment values, credentials, and secret-looking fields are redacted from receipts; SHA-256 digests, bounded bytes, versions, and typed readiness booleans remain available for audit.

Timeouts reject pending work and bounded retries never continue indefinitely. Guest disposal runs in a `finally` path whenever guest creation succeeds. A failed or blocked stage cannot be promoted by a later stage, and a partial receipt is retained for diagnosis without claiming a lifecycle result.

## Security considerations

The default driver performs no source execution, installer launch, process discovery, registry query, or guest mutation. A future integration must supply those capabilities through the typed driver boundary and keep secrets outside the guest. Receipts are redacted before they are written and do not contain paths, URLs, commands, arguments, environment values, or credentials.

## Verification

`tests/lifecycle-proof.test.ts` proves the exact thirteen-row matrix, fresh-guest contract, stage ordering, redaction, retry/timeout boundary, injected-driver lifecycle, unavailable-driver fail-closed result, and strict v2 receipt aggregation. The proof is deliberately local: run `npm run proof:lifecycle` or provide a reviewed driver module from a disposable Windows guest, write one receipt per matrix row, then run `npm run proof:lifecycle:aggregate -- --input-dir <receipts> --output lifecycle-proof.v2.json`. GitHub Actions does not run lifecycle proof or any other test gate; its workflows build, package, publish, and collect safe evidence only.

The current isolated lane supplies the harness contract and tests only. The real disposable guest, source-build, process/window, install, uninstall, and absence evidence remain blocked until the sibling source-runner and catalog/adapter lanes provide their reviewed integration modules. No runtime lifecycle success is claimed from these source-level checks.

## Suggested articles

- [Source-build security](Source-Build-Security)
- [Verified installer operations](Verified-Installer-Operations)
- [Uninstall](Uninstall)
- [Verification and evidence](Verification)
