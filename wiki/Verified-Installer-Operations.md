# Verified installer operations

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

The current installer supports only catalog records whose reviewed package type is Squirrel or MSI and whose stable release contains exactly one matching asset. The main process downloads that asset into a private per-operation staging directory, verifies the declared byte count and GitHub `sha256:` digest, runs a fixed shell-free silent argument vector, records the installed version and uninstall route after exit code 0, writes an activity result, and removes the staging directory.

At this revision the renderer still opens an install dialog and requires the exact `INSTALL <display name>` phrase before dispatch. That is a current implementation boundary, not the requested final one-click experience. The orchestrator's one-click lane may replace it after this documentation branch; this article must be refreshed against the integrated source before release.

## Configuration

Users do not enter URLs, executable paths, commands, or arguments. The catalog-owned adapter chooses the release asset and launch contract. There is no custom destination picker in the current implementation: Squirrel or MSI owns its conventional installation location. The unsigned-artifact policy remains visible and no code signature is claimed.

## Failure modes

Installation fails closed when the record is not allowlisted, the phrase is wrong, the package type lacks an adapter, no stable release exists, the asset pattern matches zero or multiple assets, the digest is absent or malformed, the asset size is outside 1 byte–1.5 GB, download redirects exceed three, bytes or hash differ, the 15-minute process limit expires, or the installer exits non-zero. A failure is recorded without adding a successful installed record.

## Security considerations

Downloads require HTTPS and a host in the reviewed GitHub asset set. Credentials embedded in URLs, arbitrary redirects, overwrite downloads, shell execution, renderer-provided paths, and renderer-provided arguments are rejected by construction. The child receives a reduced environment and runs hidden. SHA-256 proves byte integrity against GitHub metadata; it is not code signing, and releases remain explicitly unsigned.

## Verification

Focused contracts cover the typed request and main-process ownership of executable details. Source inspection proves bounded download, digest, size, redirect, timeout, staging cleanup, and fixed arguments. No real third-party installer execution is claimed by this docs lane. Universal install support is not implemented and must not be inferred from an Install button.

## Suggested articles

- [Catalog discovery](Catalog-Discovery)
- [Source-build security](Source-Build-Security)
- [Protected uninstall](Uninstall)
