---
id: one-click-installation
title: One-click installation and adapter coverage
titleYue: 一按安裝同配接器覆蓋
category: installation
status: limited
summary: Dispatches 36 reviewed release adapters without typed confirmation and reports four current public-release blockers instead of guessing commands.
---
# One-click installation and adapter coverage

## Behaviour

Selecting **Install** or **Reinstall** immediately submits only the catalog application identifier and the closed `install` decision. The main process selects one of 40 hand-written adapter records; the renderer cannot submit an executable, URL, path, argument, checksum, dependency, or package type. Thirty-six records currently have a reviewed Windows release route. Four are explicitly unavailable and cannot be mislabeled installable. The two records audited on 2026-08-20 are Amulet Map Editor, whose current public release has an unsigned Squirrel.Windows `Setup.exe`, and Material Tax Reporting, whose current public release has a product-specific unsigned Squirrel.Windows setup plus the required update index and full package.

The App Store's own Squirrel package carries an explicit `Ding Ding App Store` product identity, a checked-in branded ICO for the installer and native window, and the same local SVG mark in the renderer title bar. The main process creates that branded shell before restore and migration work, pins the native title against renderer title changes, and reports renderer load failures to the application log instead of silently leaving an Electron fallback shell. A package is not launch proof by itself: the packaged smoke path must observe a live window with the product title and a non-default icon. The missing runtime `yazl` dependency that previously crashed the installed app has now been moved into production dependencies, and a clean local launch opens the installed executable as `Ding Ding App Store`.

The catalog now contains **forty records**, of which **thirty-six** have reviewed executable or portable release contracts. The thirteen expansion products remain deliberately marked `blocked-until-proof`: a release asset, icon provenance, launch identity, or uninstall identity is not the same as clean-Windows lifecycle evidence. Their typed proof targets are ready for a later manual dispatch, but no row is promoted to verified merely because the target exists.

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
| Amulet Map Editor | Squirrel | `Setup.exe`; release `0.11.0-dev.25` at commit `60eb2e3e0d07bb3aa0ec8e493b40790faa3522c4` records the unsigned Electron Squirrel package. The workflow ran no tests. |
| Sprout Hollow | Squirrel | `Sprout.Hollow-Setup-1.4.3.exe`; first-party farm capture and exact Squirrel identity; blocked until clean-Windows proof. |
| Material Cookie Clicker | Squirrel | `MaterialCookieClicker-Setup.exe`; first-party ICO and exact Squirrel identity; blocked until clean-Windows proof. |
| Material Encryption | Squirrel | `MaterialEncryption-Setup-0.1.10.exe`; first-party logo and exact Squirrel identity; blocked until clean-Windows proof. |
| Material Ollama | Inno Setup | `OllamaSetup.exe`; strict Inno switches and bundled Ollama payload; blocked until clean-Windows proof. |
| Material Sandbox | Inno Setup | `Sandboxie-Plus-x64-v1.18.2.exe`; `Sandboxie-Plus.iss` fixes AppId, `SandMan.exe`, and `unins000.exe`; blocked until clean-Windows proof. |
| Material Tools | Squirrel | `MaterialTools-Setup-0.1.0.exe`; first-party overview evidence and exact Squirrel identity; blocked until clean-Windows proof. |
| Material VirtualBox | NSIS | `VirtualBox-7.2.97-Setup.exe`; exact VirtualBox registry and launch identities; blocked until clean-Windows proof. |
| Material WinForge | Squirrel | `WinForge-Material-3-Preview-Setup-1.0.21.exe`; first-party `app-icon.svg`; blocked until clean-Windows proof. |
| Material System Utility | Squirrel | `MaterialSystemUtility-Setup.exe`; first-party `build/icon.ico`; blocked until clean-Windows proof. |
| Meadowmark | Squirrel | `Meadowmark-Setup-0.1.52.exe`; first-party ICO and exact Squirrel identity; blocked until clean-Windows proof. |
| Minecraft Server Command Center | Squirrel | `Setup.exe`; first-party `app-mark.ico`; blocked until clean-Windows proof. |
| Minecraft Server Studio | Squirrel | `Minecraft.Server.Studio-0.120.1-x64-Setup.exe`; first-party ICO and exact Squirrel identity; blocked until clean-Windows proof. |
| Sprout Hollow Valley | Squirrel | `Sprout-Hollow-Valley-Setup-1.2.12.exe`; first-party ICO and exact Squirrel identity; blocked until clean-Windows proof. |
| Photo Viewer | Unavailable | Public `v0.1.0` release contains zero assets. Its source declares a future NSIS target but no published installer exists. |
| Material GitLab | Unavailable | The public repository has no product release. Its root installer script emits a source ZIP, and its Windows workflow publishes two separately identified tools rather than a Material GitLab product installer. |
| Material Tax Reporting | Squirrel | `MaterialTaxReporting-0.1.36001-Setup.exe`; release `v0.1.36001` also publishes `RELEASES` and a full package from the exact root `build.bat` and `build-installer.bat` route. |

### Amulet Map Editor release evidence

The reviewed Amulet record is pinned to public release `0.11.0-dev.25` at source commit `60eb2e3e0d07bb3aa0ec8e493b40790faa3522c4`. Its source-manifest evidence is `pyproject.toml`, `package.json`, `electron/electron-builder.yml`, and `.github/workflows/build-electron-windows.yml`; the catalog's source-manifest marker remains metadata only and never becomes a renderer-supplied build recipe.

| Release asset | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `Setup.exe` | 128,645,120 | `45a7e3ca3cca7b584b7aa4a0df77a6b68896090aced2a38773fc73ab7541c780` | Squirrel installer |
| `RELEASES` | 106 | `084f33bd7bcb7b988e3a0d48395d2671d252214e16d93afa51df1d2d24451933` | Squirrel update index |
| `material-minecraft-map-editor-0.11.100025-full.nupkg` | 127,785,869 | `a383ba08fb4f3786ed6231949176ecc02d93ef8dca6e44be61a75a151d976e4a` | Full Squirrel package |

The source workflow reports `2026-08-13T16:51:21Z` to `2026-08-13T16:53:38Z` (`00:02:17`). It built and published without running tests. The installable classification is based only on the immutable Squirrel asset contract; this record does not claim green tests, a clean-machine installation, or packaged UI evidence. Lifecycle execution was not attempted during the 2026-08-20 audit because an existing Amulet installation was detected and the proof route refuses to adopt or uninstall pre-existing software.

### Material Tax Reporting release evidence

The reviewed Material Tax Reporting record is pinned to public release `v0.1.36001` at source commit `7f509f9713dec6e98abc43ac3ea3b1c13260e495`. Its release route is defined by the root `build.bat` and `build-installer.bat` entry points, `apps/desktop/electron-builder.yml`, `scripts/release/invoke-build.ps1`, and `.github/workflows/release.yml`.

| Release asset | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `MaterialTaxReporting-0.1.36001-Setup.exe` | 205,370,880 | `5d6a5a701a00696da8870d6127888bcc5231d8754a50f21fb1d03f2e51b56f5f` | Squirrel installer |
| `RELEASES` | 95 | `9b5384ccba33e472373a185676fac89e7cde1146da22eb1db1f0d1382ce915e0` | Squirrel update index |
| `MaterialTaxReporting-0.1.36001-full.nupkg` | 204,607,728 | `6c7eacd7180877fc3436c6545e4d950890711f85710168d8114ab70b5f51f5e5` | Full Squirrel package |

The release publication interval is `2026-08-15T22:37:41Z` to `2026-08-15T22:43:26Z` (`00:05:45`). The workflow intentionally ran no tests, lint, type checks, security scans, accessibility checks, or screenshots. Those omissions remain explicit and are not reclassified as passing evidence.

An isolated local lifecycle proof completed on App Store commit `f3ec9c5b814ff1a61b9a724f3e64a80cf37b8339`. It began with no detected Material Tax Reporting record, selected only `MaterialTaxReporting-0.1.36001-Setup.exe`, downloaded all `205,370,880` bytes, verified SHA-256 `5d6a5a701a00696da8870d6127888bcc5231d8754a50f21fb1d03f2e51b56f5f`, rediscovered one App Store-owned Squirrel record for adapter `material-tax-reporting-squirrel`, invoked its reviewed uninstall descriptor, and finished with zero detected and zero persisted records. The bounded JSON receipt has SHA-256 `d32e40f7ffe71a3ec273e0bd6ddaf8731eb7ef3779475efcb19eb865af6004ed`. This proves the exact install and uninstall lifecycle only; it does not prove application launch, packaged UI interaction, or any checks omitted by the upstream workflow.

Uninstall remains behind the native two-key plus full-slider confirmation because it removes user-visible state. Installation and source-repair stay separate: ordinary release installation never imports or invokes the disposable/OpenCode runtime.

## Configuration

Each adapter fixes one application ID, package family, anchored asset-name pattern, install argument vector, exact registry display-name allowlist or owned portable executable, uninstall family, and source evidence. Squirrel uses `--silent`; MSI runs the selected asset through system `msiexec.exe /i ... /qn /norestart`; reviewed NSIS uses `/S`; Mozilla NSIS uses `-ms`; the jpackage route uses its unattended `/quiet /norestart` contract; portable ZIPs extract only beneath the App Store's private managed root.

Dependencies are self-contained in the reviewed release packages. MSI uses the Windows inbox service; Squirrel, NSIS, Mozilla NSIS, and jpackage carry their application runtime; the three portable packages carry their own Electron, .NET, or Qt runtime. The user does not choose or install a compiler, SDK, package manager, Java runtime, Node runtime, or archive tool.

## Failure modes

Installation fails closed for malformed or mismatched requests, duplicate starts, unsupported adapters, missing or prerelease-only releases, zero or multiple matching assets, absent integrity evidence, unverified companion checksums, disallowed HTTPS origins, more than three redirects, declared or received sizes beyond the limit, hash mismatch, download/extraction cancellation, timeout, non-zero installer exit, unsafe ZIP names, symbolic links, special files, excessive entry/expanded size, missing portable executable, or missing exact post-install registry ownership. Cancellation is refused after an external installer starts because killing its launcher cannot prove a Windows Installer or elevated child service stopped. ZIP cancellation destroys and drains the active read/write pipeline before staging cleanup. A timed-out installer is unlocked only after `taskkill /T` succeeds and the launcher closes; otherwise staging and the per-app operation lock are retained until restart. An installer exit code of zero is not success when the reviewed installed-app entry cannot be rediscovered.

The four unsupported records return their exact blocker. They do not fall through to source execution or receive guessed installer flags.

## Security considerations

Downloads accept only HTTPS GitHub release hosts, reject credentials in URLs, cap redirects and bytes, and require either the asset's GitHub `sha256:` metadata or a small companion checksum file whose own bytes have a GitHub digest. Files are created without overwrite. Processes use `shell: false`, hidden windows, fixed arguments, a reduced allowlisted environment, a 15-minute limit, and an abort controller. Portable extraction rejects absolute paths, drive paths, `..`, backslashes, NULs, symlinks, special files, duplicate overwrites, archive bombs, and a missing expected executable.

Installed ownership is captured from exactly one new or changed registry entry between complete, fail-closed pre-install and post-install snapshots of all reviewed hives. Query failure, timeout, non-zero exit, or bounded-output overflow invalidates an ownership snapshot. The stored exact key and full-entry fingerprint must match again before uninstall; display name plus a generic root is never ownership. An unchanged entry is accepted only for an idempotent reinstall whose persisted version already equals the requested release. The Installed list contains only App Store-managed records with valid ownership, so an unrelated upstream application with a shared display name is neither claimed nor offered for removal. A transient list-query failure hides the unresolved record but preserves its private ownership metadata for recovery. Catalog/update state is recomputed only from the verified list, clearing any stale installed version from an older cache. MSI product codes must parse exactly; Squirrel `Update.exe` and reviewed uninstallers must have allowlisted basenames under allowlisted roots; portable removal is restricted to the exact adapter-owned directory.

## Verification

The hand-written coverage test enumerates all 40 application IDs, asserts 40 unique adapter IDs, proves every installable row maps to a supported adapter with the same package type, rejects unsupported rows labeled installable, and exercises one current asset filename for each of the 36 supported applications. Behavioural tests create real ZIPs to cover empty files, symlinks, Windows case collisions, reserved device aliases, pre-start cancellation, and active-writer cancellation/drain; exercise partial writes; and inject portable commit, cleanup, rollback, and rollback-failure outcomes. Focused registry tests cover incomplete ownership snapshots, fingerprint mutation, exact names, MSI product codes, and safe roots/basenames. Source-contract checks cover bounded redirects/timeouts, hidden shell-free process trees, typed cancellation, exact changed-entry ownership, and separation from the repair runtime.

The retired install-adapter proof workflow no longer runs in GitHub Actions. Its typed adapter contract remains source-controlled, while real install, exact rediscovery, uninstall, and absence evidence belongs to the local disposable-Windows proof lanes described in [Thirteen-product lifecycle proof](../verification/lifecycle-proof.md). Adding a catalog record still does not silently authorize cloud execution, and GitHub Actions remains build/package/publication-only.

The Squirrel lane has stricter clean-guest rules. It requires the selected public installer to carry a direct GitHub `sha256:` digest, refuses to install when the target is already detected, and therefore never adopts or uninstalls a pre-existing application. A standard uninstall hive that does not exist yet is treated as empty only for the exact documented `reg.exe` key-not-found result; access errors, timeouts, overflow, non-zero results with any other message, and localized or unfamiliar output still fail closed. Success requires a newly App Store-owned registry record with the exact adapter ID, `store` source, reviewed uninstall descriptor, successful uninstall, no rediscovered target after cleanup, and no retained ownership record. The local proof receipt contains bounded progress and sanitized evidence, but never registry paths, credentials, installer bytes, download URLs, or source output. A lifecycle result is runtime evidence only when the exact commit's local disposable-guest receipt is verified.

[Windows proof `31268659194`](https://github.com/Ding-Ding-Projects/ding-ding-app-store/actions/runs/31268659194) is the first successful non-portable lifecycle result. On exact commit `702501675210dd767953cfa7208e8f21e40c4f0a`, the clean runner selected qBittorrent Material `v5.3.97`, downloaded the 91,589,632-byte installer, verified SHA-256 `f0e29a3a28f340680e158aa6236ad3164e24df9cb6c994e34deab2f0138cfcfd`, rediscovered one `store` record owned by `qbittorrent-material-squirrel` with a Squirrel uninstall descriptor, uninstalled it successfully, and found zero detected plus zero persisted records afterward. The bounded manifest recorded 106 progress events, `sourceRuntimeInvoked:false`, and `verdict:true`. This proves the install lifecycle only; it does not prove a packaged UI interaction or application launch.

The typed proof allowlist also contains two MSI targets, KeePassXC and Codex Material. Both reuse the same direct-SHA, clean-start, exact registry-ownership, bounded-manifest, and cleanup requirements, while additionally requiring an `msi` family result and an MSI product-code uninstall descriptor. [Windows proof `31269200281`](https://github.com/Ding-Ding-Projects/ding-ding-app-store/actions/runs/31269200281) succeeded for KeePassXC on exact commit `ce44857f49fc4c34e96189138db9a7652cda88ef`: the clean runner selected release `v0.0.44.1`, downloaded the 73,071,506-byte `KeePassXC-2.8.0-snapshot-x64.msi`, verified SHA-256 `f7280651a278b57949e9a447f21bf642554a196251eeed06c09ea9f48b461a8d`, rediscovered one `store` record owned by `keepassxc-msi` with an MSI uninstall descriptor, uninstalled it, and found zero detected plus zero persisted records afterward. The bounded manifest recorded 105 progress events with none dropped, `sourceRuntimeInvoked:false`, and `verdict:true`; artifact `install-adapter-proof-keepassxc-31269200281` has digest `sha256:fdb9ff75056442ac20a10ce254c5fbf1faa4b95d7a4392b966f3abb44c753f51`.

The Codex Material lane selects only `codex-material-msi`. [Windows proof `31270172555`](https://github.com/Ding-Ding-Projects/ding-ding-app-store/actions/runs/31270172555) succeeded on exact commit `9cad7164e89cde7ce33f4d56f4242b68d070f418`: the clean runner selected release `v0.1.0+build.646`, downloaded the 237,932,544-byte `Codex.Studio-0.1.0-x64.msi`, verified SHA-256 `3aae77b70d7efecbd58a1f477e4c5b0b854c4b26490e8f10859e36f644ddf235`, rediscovered one `store` record owned by `codex-material-msi` with an MSI uninstall descriptor, uninstalled it, and found zero detected plus zero persisted records afterward. The sibling EXE did not match the MSI adapter's anchored asset pattern. The bounded manifest recorded 106 progress events with none dropped, `timedOut:false`, `sourceRuntimeInvoked:false`, and `verdict:true`; artifact `install-adapter-proof-codex-material-31270172555` has digest `sha256:418a14afb26500244dd246fbe7a794c80a0804103bfaf24f330a8b3b60b182db`. This proves the install lifecycle only; it does not prove application launch or UI interaction.

The adapter audit uses current public release metadata and source/release configuration as of 2026-08-20. The local proof harness provides the clean-start evidence path, but each application still needs its own successful exact-release proof; no adapter is claimed complete merely because a proof target exists. The four external blockers remain genuine incomplete outcomes, not test failures disguised as support.

## Suggested articles

- [Verified installer operations](verified-installer-operations.md)
- [Source-build security](source-build-security.md)
- [Protected uninstall](uninstall.md)
