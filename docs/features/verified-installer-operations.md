# Verified installer operations

## Behaviour

Selecting **Install** or **Reinstall** starts the catalog-owned operation immediately; there is no typed-phrase confirmation because installation is non-destructive. The renderer sends only the selected catalog ID and the `install` decision. The main process then resolves a stable release, requires exactly one reviewed asset, downloads it to a controlled staging location, validates its declared size and SHA-256 digest, uses fixed shell-free unattended arguments, and reports the installed version only after the hidden installer exits successfully.

## Configuration

The current packaged adapter owns its staging and install arguments; the renderer cannot provide a location, URL, executable, command, dependency, or argument. A complete per-app adapter must declare required disk space, elevation, dependency bootstrap, installed location, cancellation, and uninstall ownership. Those clean-machine adapter details remain incomplete where listed in [one-click installation and adapter coverage](one-click-installation.md). The app never bypasses an operating-system warning.

## Failure modes

Network interruption, missing asset, hash mismatch, blocked executable, insufficient disk space, cancellation, or a non-zero installer exit leaves an honest failed/cancelled record. Partial staging data is removed only after the app confirms it is its own staging directory; existing installations are never silently removed.

## Security considerations

Installer URLs must use HTTPS and originate from the verified project release record. The app compares the exact downloaded asset to trusted metadata and does not execute a file merely because its filename looks plausible. Unsigned artifacts are clearly labelled; the product does not pretend a hash is a code signature.

## Verification

Focused source checks cover direct one-click dispatch and the retained main-process boundaries. No catalog installer has been downloaded, executed, or captured in this lane, so runtime verification is pending.

## Suggested articles

Read [one-click installation and adapter coverage](one-click-installation.md) for the 24-app gap matrix, [source-build security](source-build-security.md) when an installer is unavailable, and [uninstall](uninstall.md) for removal semantics.
