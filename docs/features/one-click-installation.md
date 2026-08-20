# One-click installation

## Behaviour

Every catalog card that has a packaged or source route exposes one installation action. Selecting **Install**, **Reinstall**, or **Install from source** starts that operation immediately; there is no phrase-to-type dialog and no second confirmation click. The selected button reports its busy state, every other install/uninstall action is temporarily disabled to prevent duplicate work, and the final result appears as a non-blocking notification and in local activity history.

Uninstall and irreversible deletion are deliberately different. They remain behind the native two-key plus full-slider super-confirmation because they remove user-visible state. One-click installation does not weaken that destructive-action boundary.

## Configuration

The renderer sends exactly two values: the catalog `appId` and a closed user decision (`install`, `build`, or `uninstall`). It cannot send a command, executable, URL, installer argument, dependency name, or filesystem path. The main process rejects malformed requests, extra fields, and decisions that do not match the invoked operation before it selects a catalog-owned adapter.

A complete clean-Windows adapter must own the entire setup recipe: immutable release or source revision, supported architecture, required runtimes/SDKs/package managers, pinned canonical download sources and hashes, unattended arguments, expected outputs, installation ownership, bounded progress, cancellation, retry policy, and uninstall discovery. Dependencies are installed automatically only after that reviewed recipe exists; the renderer never improvises them.

## Fresh-Windows build and repair contract

The future source-install engine is a separate privileged component, not a renderer shell:

- A build/run terminal simulator exposes structured progress and bounded logs for the reviewed recipe. It is not a free-form command prompt.
- Automatic OpenCode bootstrap is allowed only when OpenCode is absent, from a pinned canonical artifact with a verified hash, inside the disposable environment.
- OpenCode may perform bounded touchless repair only in a disposable workspace containing the pinned source checkout and declared build inputs.
- Every diagnosis/repair cycle has a documented retry limit and time/resource ceiling. Exhaustion becomes an honest failed result, never an infinite loop.
- The disposable environment has no access to arbitrary user paths, user secrets, host credential stores, unrelated repositories, or broad host mounts.
- A repaired recipe must be exported for review and pinned before later installations reuse it. A one-off generated command never silently becomes trusted policy.

That engine is not implemented in this lane. Source-install requests therefore retain the existing fail-closed response until the isolated runner, dependency bootstraps, OpenCode boundary, retry controls, and per-app recipes are implemented and runtime-tested.

## Catalog adapter coverage

The current catalog has 24 records. **Not complete** below means the common one-click dispatch exists but a fully automatic, clean-machine adapter and runtime proof do not yet exist.

| Application | Current route | Current status and exact remaining adapter work |
| --- | --- | --- |
| Lowlevel Computer Use MCP | Squirrel release | Not complete — the reviewed Squirrel path can select, hash-check, and silently launch one stable installer asset; clean-Windows dependency, exact asset, install-root, cancellation, and uninstall runtime proof is still pending. |
| Material Download Manager | Squirrel release | Not complete — the one-click path no longer opens the phrase-entry dialog; clean-Windows exact asset, silent behavior, dependency, install-root, cancellation, and uninstall runtime proof is still pending. |
| Material Designer | `design/package.json` source recipe | Not complete — needs a pinned Node/package-manager recipe, exact lockfile/tool versions, disposable build/output contract, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| Material BlueMap | Squirrel release | Not complete — needs exact stable-asset and unattended-install verification plus dependency, install-root, cancellation, and uninstall proof on a clean Windows profile. |
| Desktop Material | Squirrel release | Not complete — needs exact stable-asset and unattended-install verification plus dependency, install-root, cancellation, and uninstall proof on a clean Windows profile. |
| Home Assistant AC Defender | Squirrel release | Not complete — needs exact stable-asset and unattended-install verification plus dependency, install-root, cancellation, and uninstall proof on a clean Windows profile. |
| Material Email | `package.json` source recipe | Not complete — needs pinned Node/package-manager inputs, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| OpenCodex | `package.json` source recipe | Not complete — needs pinned Node/package-manager inputs, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| qBittorrent Material | Squirrel release | Not complete — needs exact stable-asset and unattended-install verification plus dependency, install-root, cancellation, and uninstall proof on a clean Windows profile. |
| WinSCP Material | Squirrel release | Not complete — needs exact stable-asset and unattended-install verification plus dependency, install-root, cancellation, and uninstall proof on a clean Windows profile. |
| Dim Sum Atlas | Portable archive | Not complete — the current operation service rejects archive packages; it needs exact archive layout/hash validation, traversal-safe extraction, owned install location, launcher creation, cancellation, update, and portable-folder uninstall proof. |
| Win SSH Copy ID | `WinSshCopyId.sln` source recipe | Not complete — needs pinned MSBuild/Windows SDK workload discovery and bootstrap, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, install packaging, and clean-Windows proof. |
| Material Office | `package.json` source recipe | Not complete — needs pinned Node/package-manager inputs, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| Minecraft World Downloader | `package.json` source recipe | Not complete — needs pinned Node/package-manager inputs, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| Codex Material | `package.json` source recipe | Not complete — needs pinned Node/package-manager inputs, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| LibreOffice Material | `configure.ac` source recipe | Not complete — needs a pinned Windows Autotools/compiler/dependency environment, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| Material Mail | `package.json` source recipe | Not complete — needs its repository-specific bootstrap/build toolchain pinned from the real manifests, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| Bambu Studio | `CMakeLists.txt` source recipe | Not complete — needs pinned CMake/compiler/SDK and declared third-party dependencies, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| KeePassXC | `CMakeLists.txt` source recipe | Not complete — needs pinned CMake/compiler/SDK and declared third-party dependencies, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| JDownloader Material | `pom.xml` source recipe | Not complete — needs pinned JDK/Maven and declared dependencies, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| Home Assistant Bambu Lab | Home Assistant integration | Not complete — this is documentation-only today; it needs a reviewed Home Assistant discovery/bootstrap and integration-install contract with credential intake kept outside renderer/source commands, plus clean-Windows proof. |
| WinForge | `WinForge.sln` source recipe | Not complete — needs pinned MSBuild/Windows SDK workload discovery and bootstrap, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| WimForge | `CMakeLists.txt` source recipe | Not complete — needs pinned CMake/compiler/Windows deployment dependencies, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |
| Photo Viewer | `package.json` source recipe | Not complete — needs pinned Node/package-manager inputs, disposable build/output rules, automatic OpenCode bootstrap and bounded repair, installer packaging, and clean-Windows proof. |

## Failure modes

Invalid or mismatched decisions, duplicate starts, missing or ambiguous assets, absent SHA-256 metadata, disallowed origins, size/hash mismatch, download timeouts, non-zero installer exits, unsupported package types, and unavailable source sandboxes all return factual failed results. The app never turns an unavailable adapter into a guessed silent command. A failed install never becomes an installed record.

## Security considerations

The main process still owns allowlists, release lookup, bounded HTTPS redirects, declared-size enforcement, SHA-256 verification, staging, fixed shell-free arguments, hidden child processes, time limits, cleanup, and installed-record writes. One click changes only the amount of user ceremony before a non-destructive action; it does not move privileged choices into the renderer.

## Verification

Focused contract coverage proves that install/source-install cards bypass `ActionDialog`, the strict two-field decision contract reaches the main process, the install phrase field is absent, and uninstall retains both keys, the full slider, emergency exit, Escape behavior, and focus return. Typecheck/test/build evidence can prove source integration only. No catalog installer, dependency bootstrap, source build, OpenCode repair, cancellation path, or clean-Windows installation was executed here, so runtime proof is still pending for every application in the table.

## Suggested articles

Continue with [verified installer operations](verified-installer-operations.md), [source-build security](source-build-security.md), and [uninstall](uninstall.md).
