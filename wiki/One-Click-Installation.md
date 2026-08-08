# One-click installation and adapter coverage

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

Selecting **Install**, **Reinstall**, or **Install from source** starts the requested operation immediately. There is no phrase-entry dialog and no second confirmation click. The renderer sends only the catalog application identifier and a closed decision; the main process rejects malformed requests, extra fields, and mismatched decisions before selecting a catalog-owned adapter.

Uninstall remains behind the native two-key plus full-slider confirmation because it removes user-visible state. One-click installation does not weaken that destructive boundary.

The catalog currently contains 24 records. The shared one-click dispatch is shipped, but fully automatic clean-Windows adapters and runtime proof are still incomplete. Each row states the remaining application-specific boundary instead of treating a button as proof.

| Application | Current route | Remaining adapter and evidence work |
| --- | --- | --- |
| Lowlevel Computer Use MCP | Squirrel release | Prove the exact asset, silent install, dependency bootstrap, cancellation, install root, and recorded uninstall on clean Windows. |
| Material Download Manager | Squirrel release | Prove the exact asset, silent install, dependency bootstrap, cancellation, install root, and recorded uninstall on clean Windows. |
| Material Designer | Node source | Pin the lockfile and toolchain, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| Material BlueMap | Squirrel release | Prove the exact asset, silent install, dependency bootstrap, cancellation, install root, and recorded uninstall on clean Windows. |
| Desktop Material | Squirrel release | Prove the exact asset, silent install, dependency bootstrap, cancellation, install root, and recorded uninstall on clean Windows. |
| Home Assistant AC Defender | Squirrel release | Prove the exact asset, silent install, dependency bootstrap, cancellation, install root, and recorded uninstall on clean Windows. |
| Material Email | Node source | Pin the lockfile and toolchain, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| OpenCodex | Node source | Pin the lockfile and toolchain, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| qBittorrent Material | Squirrel release | Prove the exact asset, silent install, dependency bootstrap, cancellation, install root, and recorded uninstall on clean Windows. |
| WinSCP Material | Squirrel release | Prove the exact asset, silent install, dependency bootstrap, cancellation, install root, and recorded uninstall on clean Windows. |
| Dim Sum Atlas | Portable archive | Verify the archive and layout, prevent traversal, extract to an owned location, create a launcher, support cancellation, and prove owned removal. |
| Win SSH Copy ID | Visual Studio source | Pin MSBuild and the Windows SDK workloads, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| Material Office | Node source | Pin the lockfile and toolchain, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| Minecraft World Downloader | Node source | Pin the lockfile and toolchain, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| Codex Material | Node source | Pin the lockfile and toolchain, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| LibreOffice Material | Autotools source | Pin the compiler, SDK, and declared dependencies, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| Material Mail | Node source | Pin the repository's real lockfile and toolchain, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| Bambu Studio | CMake source | Pin CMake, compiler, SDK, and third-party dependencies, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| KeePassXC | CMake source | Pin CMake, compiler, SDK, and third-party dependencies, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| JDownloader Material | Maven source | Pin the JDK, Maven, and declared dependencies, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| Home Assistant Bambu Lab | Home Assistant integration | Implement reviewed discovery and credential-safe integration installation, then prove the complete route on a fresh Windows profile. |
| WinForge | Visual Studio source | Pin MSBuild and the Windows SDK workloads, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| WimForge | CMake source | Pin CMake, compiler, SDK, and Windows deployment dependencies, isolate the build, package its output, bound repair, and prove installation on clean Windows. |
| Photo Viewer | Node source | Pin the lockfile and toolchain, isolate the build, package its output, bound repair, and prove installation on clean Windows. |

## Configuration

A reviewed adapter owns the immutable release or source revision, architecture, runtimes, SDKs, package managers, canonical download sources and hashes, unattended arguments, expected outputs, installed location, ownership, progress, cancellation, retry policy, and uninstall discovery. Users do not type commands, URLs, dependency names, or executable paths.

The source runner exposes a structured build/run terminal simulator rather than a free-form host shell. The automatic OpenCode bootstrap installs a pinned canonical package when OpenCode is absent. OpenCode then performs bounded touchless repair with a finite retry limit only inside a disposable workspace with no arbitrary user paths, user secrets, credential stores, unrelated repositories, or broad host mounts. If that isolation is unavailable, execution fails closed.

## Failure modes

Invalid or mismatched decisions, duplicate starts, missing or ambiguous assets, absent SHA-256 metadata, disallowed origins, size or hash mismatch, timeouts, non-zero installer exits, unsupported package types, unavailable isolation, retry exhaustion, cancellation, and missing outputs produce factual failed or cancelled results. Missing adapters never become guessed commands, and failed operations never create successful installed records.

## Security considerations

The main process owns release lookup, allowlists, bounded HTTPS redirects, size enforcement, SHA-256 verification, staging, fixed shell-free arguments, hidden child processes, time limits, cleanup, and installed-record writes. Source and repair code executes only in the disposable boundary. One click removes ceremony; it does not move privileged choices into the renderer or bypass operating-system warnings.

## Verification

Focused contracts prove that install and source-install cards bypass the destructive dialog, strict two-field requests reach the main process, duplicate starts are blocked, and uninstall retains both keys, the full slider, emergency exit, keyboard containment, and focus return. **Not complete:** static tests do not prove that every catalog adapter works on a fresh Windows computer, and runtime proof is still pending for each application until its packaged clean-machine evidence exists.

## Suggested articles

- [Verified installer operations](Verified-Installer-Operations)
- [Source-build security](Source-Build-Security)
- [Protected uninstall](Uninstall)
