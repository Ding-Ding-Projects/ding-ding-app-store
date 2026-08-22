---
id: one-click-installation
title: One-click installation and adapter coverage
titleYue: 一按安裝同配接器覆蓋
category: installation
status: limited
summary: Dispatches 22 reviewed release adapters without typed confirmation and reports three current public-release blockers instead of guessing commands.
---
# One-click installation and adapter coverage

## Behaviour

Selecting **Install** or **Reinstall** immediately submits only the catalog application identifier and the closed `install` decision. The main process selects one of 25 hand-written adapter records; the renderer cannot submit an executable, URL, path, argument, checksum, dependency, or package type. Twenty-two records currently have a reviewed Windows release route. Three are explicitly unavailable and cannot be mislabeled installable. The new record is Amulet Map Editor, whose public release has an unsigned Squirrel.Windows Setup.exe but no packaged runtime/UI proof in this repository.

The App Store's own Squirrel package carries an explicit `Ding Ding App Store` product identity, a checked-in branded ICO for the installer and native window, and the same local SVG mark in the renderer title bar. The main process creates that branded shell before restore and migration work, pins the native title against renderer title changes, and reports renderer load failures to the application log instead of silently leaving an Electron fallback shell. A package is not launch proof by itself: the packaged smoke path must observe a live window with the product title and a non-default icon. The missing runtime `yazl` dependency that previously crashed the installed app has now been moved into production dependencies, and a clean local launch opens the installed executable as `Ding Ding App Store`.

The catalog now contains **forty records**, of which **thirty-five** have reviewed executable or portable release contracts. The thirteen newly reviewed public products are deliberately marked `blocked-until-proof`: a release asset, icon provenance, launch identity, or uninstall identity is not the same as clean-Windows lifecycle evidence. Their typed proof targets are ready for a later manual dispatch, but no row is promoted to verified merely because the target exists.

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
| KeePassXC | MSI | Release `v0.0.45.1` targets `9f71044fdc38dd4efc360794fb2248707e94d530`; the unsigned 73,071,506-byte MSI independently matched GitHub SHA-256 `bfa4d0a2eb7f2406a4dd894dd770974811e5e1d6f8e016768324c33e564e8ef5`. |
| JDownloader Material | jpackage EXE, blocked pending lifecycle proof | Release `v0.1.29-run.1` targets `f89003fa7a0200cd502d3e3a17298e7867265d9a`; its unsigned 84,872,704-byte EXE independently matched GitHub SHA-256 `cca4931836cd31696d077022f0e4b7db95821aa7d0d6b369fc2eac511f5c76d3`. The workflow proves `jpackage --type exe` with a bundled Java runtime, but no clean-Windows install/uninstall receipt is recorded, so privileged actions remain unavailable. |
| Home Assistant Bambu Lab | External target required | Release `v3.0.8` targets `29f1fcd4f9f573e2adb496da953da4c1a93e76cd`; its 4,174,687-byte HACS ZIP matched GitHub SHA-256 `c19f566b8c32b5d1f9b4cd5bd1a112474d4d79b2e371e591f9c64bebbfa2d6b8`. Fresh Windows has no canonical local Home Assistant configuration target; selecting any target requires explicit authorization. |
| WinForge | Managed portable ZIP | `WinForge-portable-x64-1.1.326.zip`; workflow validates `WinForge.exe` and archive paths. |
| WimForge | Managed portable ZIP | `WimForge-portable-x64-0.1.42.zip`; self-contained Qt archive with `WimForge.exe`. |
| Amulet Map Editor | Squirrel | `Setup.exe`; release `0.10.0-dev.567` records pinned Squirrel.Windows packaging and a non-green upstream test report. |
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
| Material GitLab | Unavailable | Public repository has no reviewed Windows installer asset for this catalog route. |
| Material Tax Reporting | Unavailable | Public repository has no reviewed Windows installer asset for this catalog route. |

### Amulet Map Editor release evidence

The reviewed Amulet record is pinned to public release `0.10.0-dev.567` at source commit `0173704db6bb37f8cdeae75b98bf2e6a25537e46`. Its source-manifest evidence is `pyproject.toml`, `.github/workflows/build-windows.yml`, `installer/build-squirrel.ps1`, and `installer/PACKAGING.md`; the catalog's source-manifest marker remains metadata only and never becomes a renderer-supplied build recipe.

| Release asset | Bytes | SHA-256 | Role |
| --- | ---: | --- | --- |
| `Setup.exe` | 70,412,800 | `bfd30c6ad64cd4c8f6efbd03ffac44e032b334d163074bd089cf52bc0fe6fce1` | Squirrel installer |
| `RELEASES` | 79 | `039bcef7f8f87f5ea0a4ae010022231bdf389bb94d58dc9070320c9aaf0166c7` | Squirrel update index |
| `Amulet-0.10.100567-full.nupkg` | 70,259,367 | `5b427ae6fe6285333ace91385199cb29a2bae51f0cb7579b7194dbced9c6c606` | Full Squirrel package |

The source workflow reports `2026-08-11T05:59:50Z` to `2026-08-11T06:08:38Z` (`00:08:48`). Its latest release test result is **failed**, with `1256 passed, 8 skipped, 1 warning, 24 errors, 332 subtests passed in 221.33s`. The installable classification is based only on the immutable Squirrel asset contract; this record does not claim green tests, a clean-machine installation, or packaged UI evidence. The current branch now also has direct local launch proof for the installed `Ding Ding App Store` executable after moving the missing `yazl` runtime dependency into production dependencies.

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

The hand-written coverage test enumerates all 25 application IDs, asserts 25 unique adapter IDs, proves every installable row maps to a supported adapter with the same package type, rejects unsupported rows labeled installable, and exercises one current asset filename for each of the 22 supported applications. Behavioural tests create real ZIPs to cover empty files, symlinks, Windows case collisions, reserved device aliases, pre-start cancellation, and active-writer cancellation/drain; exercise partial writes; and inject portable commit, cleanup, rollback, and rollback-failure outcomes. Focused registry tests cover incomplete ownership snapshots, fingerprint mutation, exact names, MSI product codes, and safe roots/basenames. Source-contract checks cover bounded redirects/timeouts, hidden shell-free process trees, typed cancellation, exact changed-entry ownership, and separation from the repair runtime.

The retired install-adapter proof workflow no longer runs in GitHub Actions. Its typed adapter contract remains source-controlled, while real install, exact rediscovery, uninstall, and absence evidence belongs to the local disposable-Windows proof lanes described in [Thirteen-product lifecycle proof](../verification/lifecycle-proof.md). Adding a catalog record still does not silently authorize cloud execution, and GitHub Actions remains build/package/publication-only.

The Squirrel lane has stricter clean-guest rules. It requires the selected public installer to carry a direct GitHub `sha256:` digest, refuses to install when the target is already detected, and therefore never adopts or uninstalls a pre-existing application. A standard uninstall hive that does not exist yet is treated as empty only for the exact documented `reg.exe` key-not-found result; access errors, timeouts, overflow, non-zero results with any other message, and localized or unfamiliar output still fail closed. Success requires a newly App Store-owned registry record with the exact adapter ID, `store` source, reviewed uninstall descriptor, successful uninstall, no rediscovered target after cleanup, and no retained ownership record. The local proof receipt contains bounded progress and sanitized evidence, but never registry paths, credentials, installer bytes, download URLs, or source output. A lifecycle result is runtime evidence only when the exact commit's local disposable-guest receipt is verified.

[Windows proof `31268659194`](https://github.com/Ding-Ding-Projects/ding-ding-app-store/actions/runs/31268659194) is the first successful non-portable lifecycle result. On exact commit `702501675210dd767953cfa7208e8f21e40c4f0a`, the clean runner selected qBittorrent Material `v5.3.97`, downloaded the 91,589,632-byte installer, verified SHA-256 `f0e29a3a28f340680e158aa6236ad3164e24df9cb6c994e34deab2f0138cfcfd`, rediscovered one `store` record owned by `qbittorrent-material-squirrel` with a Squirrel uninstall descriptor, uninstalled it successfully, and found zero detected plus zero persisted records afterward. The bounded manifest recorded 106 progress events, `sourceRuntimeInvoked:false`, and `verdict:true`. This proves the install lifecycle only; it does not prove a packaged UI interaction or application launch.

The typed proof allowlist contains MSI targets for KeePassXC and Codex Material and a jpackage target for JDownloader Material. They reuse the same direct-SHA, clean-start, exact registry-ownership, bounded-manifest, and cleanup requirements; MSI and jpackage ownership must also yield an MSI product-code uninstall descriptor. [Windows proof `31269200281`](https://github.com/Ding-Ding-Projects/ding-ding-app-store/actions/runs/31269200281) succeeded for KeePassXC on exact App Store commit `ce44857f49fc4c34e96189138db9a7652cda88ef`: the clean runner selected release `v0.0.44.1`, downloaded the 73,071,506-byte `KeePassXC-2.8.0-snapshot-x64.msi`, verified SHA-256 `f7280651a278b57949e9a447f21bf642554a196251eeed06c09ea9f48b461a8d`, rediscovered one `store` record owned by `keepassxc-msi` with an MSI uninstall descriptor, uninstalled it, and found zero detected plus zero persisted records afterward. The bounded manifest recorded 105 progress events with none dropped, `sourceRuntimeInvoked:false`, and `verdict:true`; artifact `install-adapter-proof-keepassxc-31269200281` has digest `sha256:fdb9ff75056442ac20a10ce254c5fbf1faa4b95d7a4392b966f3abb44c753f51`. The latest KeePassXC release asset is separately pinned above; that immutable-byte check does not pretend to be a new lifecycle run. JDownloader Material stays `blocked-until-proof` until its own disposable receipt verifies install, exact registry ownership, MSI product-code uninstall, and post-uninstall absence.

The Codex Material lane selects only `codex-material-msi`. [Windows proof `31270172555`](https://github.com/Ding-Ding-Projects/ding-ding-app-store/actions/runs/31270172555) succeeded on exact commit `9cad7164e89cde7ce33f4d56f4242b68d070f418`: the clean runner selected release `v0.1.0+build.646`, downloaded the 237,932,544-byte `Codex.Studio-0.1.0-x64.msi`, verified SHA-256 `3aae77b70d7efecbd58a1f477e4c5b0b854c4b26490e8f10859e36f644ddf235`, rediscovered one `store` record owned by `codex-material-msi` with an MSI uninstall descriptor, uninstalled it, and found zero detected plus zero persisted records afterward. The sibling EXE did not match the MSI adapter's anchored asset pattern. The bounded manifest recorded 106 progress events with none dropped, `timedOut:false`, `sourceRuntimeInvoked:false`, and `verdict:true`; artifact `install-adapter-proof-codex-material-31270172555` has digest `sha256:418a14afb26500244dd246fbe7a794c80a0804103bfaf24f330a8b3b60b182db`. This proves the install lifecycle only; it does not prove application launch or UI interaction.

The adapter audit uses current public release metadata and source/release configuration as of 2026-08-07. The new workflow provides the fresh-Windows evidence path, but each application still needs its own successful cloud proof run; no adapter is claimed complete merely because the workflow exists. The three external blockers remain genuine incomplete outcomes, not test failures disguised as support.

## Suggested articles

- [Verified installer operations](verified-installer-operations.md)
- [Source-build security](source-build-security.md)
- [Protected uninstall](uninstall.md)
