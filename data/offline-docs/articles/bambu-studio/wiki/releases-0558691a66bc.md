# Releases

> **2026-07-24 pipeline repair:** the push trigger is now **branches-only** and the release job
> refuses tag refs — a bare `push: {}` also matched the tags the release job itself created, which
> produced an unbounded loop of mis-titled echo releases (since purged; tags preserved). The
> Windows app build now runs under **Ninja + sccache** (`SLIC3R_MSVC_PDB=OFF` on CI) for
> warm-cache speed, superseded same-branch builds are cancelled in progress, and installers ship a
> hash-pinned **Mesa llvmpipe software-GL fallback** so the app launches on machines without
> OpenGL 2.0 (see
> software-gl-fallback).
> Full details in [Discussion #2](https://github.com/Ding-Ding-Projects/BambuStudio/discussions/2).

Canonical documentation:
Windows CI and release supply chain,
the releases category index,
and the current CI state in
HANDOFF.md. This fork
publishes a **Windows installer only**; automatic WinGet and Homebrew publication is gated to the
upstream `bambulab/BambuStudio` repository.

## Release train

`.github/workflows/build_all.yml` is the acceptance and publication workflow. Every code-bearing
push to `master` (or manual dispatch) that passes the Windows acceptance gates publishes exactly
one uniquely tagged, non-draft GitHub release; tags embed the application version and the workflow
run number (`md3-windows-v02.08.01.55-rNN`), so reruns converge on the same tag instead of
duplicating releases. Markdown-only pushes and deleted refs skip build and release, which lets
documentation land without recursively minting another release. Release jobs are serialized, and
only an artifact built from the current `master` tip may become **latest** — superseded master and
non-default-ref builds are published non-latest.

Acceptance gates before the release job may start include: DeviceWeb build/type-check with pinned
Node/pnpm and a high-severity audit gate; PowerShell/JSON/JavaScript parsing and fixture tests; the
production native Release build and install; `libnest2d_tests` and `language_mode_tests` via CTest;
native launch captures (light English, dark Cantonese, light bilingual) on the disposable runner;
CycloneDX SBOM generation from the exact installed payload; the NSIS installer build with 7-Zip
archive validation; and the install/upgrade/recovery/uninstall/reparse-guard matrix.

Each published release carries exactly three assets:

- `BambuStudioMD3-Setup.exe` (unsigned; a per-user install, no admin elevation)
- `BambuStudioMD3-Setup.exe.sha256`
- `BambuStudioMD3.cdx.json` (CycloneDX 1.6 per-file inventory of the installed payload)

The release job also creates GitHub build-provenance and SBOM attestations for the installer
(`actions/attest`), binding the installer digest to the repository's Actions identity. Neither the
checksum nor the attestations are an Authenticode signature; a trusted Windows signing identity
remains external work. **Verify the SHA-256 sidecar before running the installer.**

The train shipped through this gate during the register waves: the first fully green publish run
(`29877040307`, head `ec631dfb2`) published `md3-windows-v02.08.01.55-r37`, and subsequent waves
published further releases through `r53` and beyond, with superseded master builds marked
non-latest.

## Immutable releases

The release job requires the repository immutable-release setting (the probe tolerates HTTP 403
and relies on post-publish immutability verification). Publication is draft-to-immutable: the job
creates a draft with all three assets, verifies target commit, names, sizes, and GitHub SHA-256
digests against the local candidate, resolves latest status, and only then publishes. Once
published, the tag and assets cannot be altered. On error while still a draft, the job deletes the
draft and its temporary tag; if state is ambiguous it fails safe and preserves the release for
inspection. A retry validates and reuses a same-commit immutable publication and never attempts to
mutate a published immutable release. Remote Actions are pinned to reviewed 40-character commit
SHAs.

## TOKEN_GITHUB publish path

An org-side restriction began returning HTTP 403 on release creation with the default workflow
token. The publish step now authenticates with the `TOKEN_GITHUB` owner PAT, falling back to the
workflow token where the secret is absent (`GH_TOKEN: secrets.TOKEN_GITHUB || github.token`,
commit `fc7257366`). The workflow default remains read-only repository access; only the release
job receives `contents/id-token/attestations/artifact-metadata: write`, and checkout does not
persist credentials.

## Manual r56 fallback

During the 403 incident, release
[`md3-windows-v02.08.01.55-r56`](https://github.com/Ding-Ding-Projects/BambuStudio/releases/tag/md3-windows-v02.08.01.55-r56)
was published manually from the run's build artifacts rather than by the workflow's publish job. It
is currently the **latest** release; the adjacent workflow-published `r57` is marked as a
superseded master build. Subsequent runs use the `TOKEN_GITHUB` path above.

## Verifying a download

1. Download the installer and its `.sha256` sidecar from the release page and compare digests
   (for example `Get-FileHash BambuStudioMD3-Setup.exe -Algorithm SHA256` on Windows).
2. Optionally verify the GitHub attestations with the `gh attestation verify` command against this
   repository, as described in the canonical supply-chain document.
3. Remember the installer is unsigned: SmartScreen warnings are expected, and the checksum plus
   attestations stand in for — but do not replace — Authenticode.
