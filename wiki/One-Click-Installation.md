# One-click installation and adapter coverage

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

Selecting **Install** or **Reinstall** immediately submits only the catalog application identifier and the closed `install` decision. The main process selects one of 24 hand-written adapter records; the renderer cannot submit an executable, URL, path, argument, checksum, dependency, or package type. Twenty-one records currently have a reviewed Windows release route. Three are explicitly unavailable and cannot be mislabeled installable.

| Application | Reviewed route | Current public evidence or blocker |
| --- | --- | --- |
| Lowlevel Computer Use MCP | Squirrel | `lowlevel-computer-use-manual-0.1.0-win-x64.exe`; Squirrel target in `electron/package.json`. |
| Material Download Manager | Squirrel | `Setup.exe`; Squirrel x64 target in `design/package.json`. |
| Material Designer | Squirrel | `material-designer-0.16.1-win-x64-setup.exe`; release workflow builds and smoke-tests Squirrel. |
| Material BlueMap | Squirrel | `Worldlens-0.1.758-Setup.exe`; `electron-builder.config.cjs` fixes the Worldlens Squirrel identity. |
| Desktop Material | Squirrel | `GitHubDesktopSetup-x64.exe`; release also carries `RELEASES` and full packages. |
| Home Assistant AC Defender | Squirrel | `AC.Defender.Controller.Setup.0.1.0.exe`; desktop package declares `ACDefenderController`. |
| Material Email | NSIS | `Material-Email-0.105.1-Windows-x64.exe`; Electron Builder NSIS plus installed/uninstalled workflow proof. |
| OpenCodex | Squirrel | `opencodex.Setup.2.7.42.exe`; explicit Squirrel lifecycle configuration. |
| qBittorrent Material | Squirrel | `qBittorrent-Material-5.3.97-windows-x64-Setup.exe`; release workflow smoke-tests Squirrel. |
| WinSCP Material | Squirrel | `WinSCP.Material.0.1.590.Setup.exe`; Forge maker-squirrel configuration. |
| Dim Sum Atlas | Managed portable ZIP | `DimSumAtlas-v0.1.13-windows-x64.zip`; expected `DimSumAtlas.exe`. |
| Win SSH Copy ID | Unavailable | Public repository has no release. There is no immutable installer asset to verify. |
| Material Office | NSIS | `Material-Office-0.1.0-x64-Setup.exe`; Electron Builder NSIS and silent lifecycle documentation. |
| Minecraft World Downloader | NSIS | `WorldDownloaderManager-Setup.exe`; reviewed `installer.nsi` fixes identity, root, and uninstaller. |
| Codex Material | MSI | `Codex.Studio-0.1.0-x64.msi`; Electron Builder MSI x64 target. |
| LibreOffice Material | MSI | `LibreOfficeMaterial-Windows-x64.msi`; CPack/WiX workflow and companion checksum. |
| Material Mail | Mozilla NSIS | `thunderbird-155.0a1.en-US.win64.installer.exe`; `mach package` produces the Mozilla NSIS installer. |
| Bambu Studio | NSIS | `BambuStudioMD3-Setup.exe`; reviewed NSIS script has fixed owned install/uninstall identities. |
| KeePassXC | MSI | `KeePassXC-2.8.0-snapshot-x64.msi`; CPack/WiX release route. |
| JDownloader Material | jpackage EXE | `JDownloader-Material-windows-x64.exe`; workflow proves `jpackage --type exe` with bundled Java runtime. |
| Home Assistant Bambu Lab | External target required | `bambu_lab.zip` is a HACS custom component. Fresh Windows has no canonical local Home Assistant configuration target; selecting a remote instance requires host/account authorization that cannot be inferred. |
| WinForge | Managed portable ZIP | `WinForge-portable-x64-1.1.326.zip`; workflow validates `WinForge.exe` and archive paths. |
| WimForge | Managed portable ZIP | `WimForge-portable-x64-0.1.42.zip`; self-contained Qt archive with `WimForge.exe`. |
| Photo Viewer | Unavailable | Public `v0.1.0` release contains zero assets. Its source declares a future NSIS target but no published installer exists. |

Uninstall remains behind the native two-key plus full-slider confirmation because it removes user-visible state. Installation and source-repair stay separate: ordinary release installation never imports or invokes the disposable/OpenCode runtime.

## Configuration

Each adapter fixes one application ID, package family, anchored asset-name pattern, install argument vector, exact registry display-name allowlist or owned portable executable, uninstall family, and source evidence. Squirrel uses `--silent`; MSI runs the selected asset through system `msiexec.exe /i ... /qn /norestart`; reviewed NSIS uses `/S`; Mozilla NSIS uses `-ms`; the jpackage route uses its unattended `/quiet /norestart` contract; portable ZIPs extract only beneath the App Store's private managed root.

Dependencies are self-contained in the reviewed release packages. MSI uses the Windows inbox service; Squirrel, NSIS, Mozilla NSIS, and jpackage carry their application runtime; the three portable packages carry their own Electron, .NET, or Qt runtime. The user does not choose or install a compiler, SDK, package manager, Java runtime, Node runtime, or archive tool.

## Failure modes

Installation fails closed for malformed or mismatched requests, duplicate starts, unsupported adapters, missing or prerelease-only releases, zero or multiple matching assets, absent integrity evidence, unverified companion checksums, disallowed HTTPS origins, more than three redirects, declared or received sizes beyond the limit, hash mismatch, download/extraction cancellation, timeout, non-zero installer exit, unsafe ZIP names, symbolic links, special files, excessive entry/expanded size, missing portable executable, or missing exact post-install registry ownership. Cancellation is refused after an external installer starts because killing its launcher cannot prove a Windows Installer or elevated child service stopped. ZIP cancellation destroys and drains the active read/write pipeline before staging cleanup. A timed-out installer is unlocked only after `taskkill /T` succeeds and the launcher closes; otherwise staging and the per-app operation lock are retained until restart. An installer exit code of zero is not success when the reviewed installed-app entry cannot be rediscovered.

The three unsupported records return their exact blocker. They do not fall through to source execution or receive guessed installer flags.

## Security considerations

Downloads accept only HTTPS GitHub release hosts, reject credentials in URLs, cap redirects and bytes, and require either the asset's GitHub `sha256:` metadata or a small companion checksum file whose own bytes have a GitHub digest. Files are created without overwrite. Processes use `shell: false`, hidden windows, fixed arguments, a reduced allowlisted environment, a 15-minute limit, and an abort controller. Portable extraction rejects absolute paths, drive paths, `..`, backslashes, NULs, symlinks, special files, duplicate overwrites, archive bombs, and a missing expected executable.

Installed ownership is captured from exactly one new or changed registry entry between complete, fail-closed pre-install and post-install snapshots of all reviewed hives. Query failure, timeout, non-zero exit, or bounded-output overflow invalidates an ownership snapshot. The stored exact key and full-entry fingerprint must match again before uninstall; display name plus a generic root is never ownership. An unchanged entry is accepted only for an idempotent reinstall whose persisted version already equals the requested release. The Installed list contains only App Store-managed records with valid ownership, so an unrelated upstream application with a shared display name is neither claimed nor offered for removal. A transient list-query failure hides the unresolved record but preserves its private ownership metadata for recovery. Catalog/update state is recomputed only from the verified list, clearing any stale installed version from an older cache. MSI product codes must parse exactly; Squirrel `Update.exe` and reviewed uninstallers must have allowlisted basenames under allowlisted roots; portable removal is restricted to the exact adapter-owned directory.

## Verification

The hand-written coverage test enumerates all 24 application IDs, asserts 24 unique adapter IDs, proves every installable row maps to a supported adapter with the same package type, rejects unsupported rows labeled installable, and exercises one current asset filename for each of the 21 supported applications. Behavioural tests create real ZIPs to cover empty files, symlinks, Windows case collisions, reserved device aliases, pre-start cancellation, and active-writer cancellation/drain; exercise partial writes; and inject portable commit, cleanup, rollback, and rollback-failure outcomes. Focused registry tests cover incomplete ownership snapshots, fingerprint mutation, exact names, MSI product codes, and safe roots/basenames. Source-contract checks cover bounded redirects/timeouts, hidden shell-free process trees, typed cancellation, exact changed-entry ownership, and separation from the repair runtime.

The dispatch-only `.github/workflows/install-adapter-proof.yml` workflow currently targets the three reviewed portable ZIP adapters (`dim-sum-atlas`, `winforge`, and `wimforge`) on a pinned GitHub-hosted `windows-2022` cloud runner. It bootstraps the locked dependencies, builds the real main process and preload, launches `scripts/prove-install-adapter.mjs` through Electron with a disposable app-data root, records bounded progress plus before/after installed detection, and cleans up through the reviewed uninstall route. The proof script prints sanitized phase milestones, emits a 30-second heartbeat, enforces an internal 20-minute deadline, and exits explicitly after writing evidence; the workflow adds a 25-minute step bound and preserves any manifest emitted by a failed run. The proof manifest contains no registry paths, credentials, installer bytes, or source/OpenCode output. A proof is green only when the selected portable install succeeds, the exact App Store-owned installed record is rediscovered, uninstall succeeds, and the record disappears; the closed target map rejects every MSI, NSIS, Squirrel, jpackage, unsupported, or malformed app ID. Manual dispatch is intentional because installing third-party software is a side effect, not a push-time check.

The adapter audit uses current public release metadata and source/release configuration as of 2026-08-07. The new workflow provides the fresh-Windows evidence path, but each application still needs its own successful cloud proof run; no adapter is claimed complete merely because the workflow exists. The three external blockers remain genuine incomplete outcomes, not test failures disguised as support.

## Suggested articles

- [Verified installer operations](Verified-Installer-Operations)
- [Source-build security](Source-Build-Security)
- [Protected uninstall](Uninstall)
