# Verified installer operations

## Behaviour

An install starts from a catalog record that names an immutable release asset, expected version, platform, and integrity metadata. The operation downloads to a controlled staging location, validates the downloaded bytes against release metadata, shows progress in the operation surface, and reports the installed version only after the installer exits successfully.

## Configuration

Users choose a supported install location through a native folder picker or a validated path field. The app displays required disk space, elevation requirements where known, and whether the artifact is unsigned. The default is never to bypass an operating-system warning.

## Failure modes

Network interruption, missing asset, hash mismatch, blocked executable, insufficient disk space, cancellation, or a non-zero installer exit leaves an honest failed/cancelled record. Partial staging data is removed only after the app confirms it is its own staging directory; existing installations are never silently removed.

## Security considerations

Installer URLs must use HTTPS and originate from the verified project release record. The app compares the exact downloaded asset to trusted metadata and does not execute a file merely because its filename looks plausible. Unsigned artifacts are clearly labelled; the product does not pretend a hash is a code signature.

## Verification

This documentation lane establishes the operation contract only. No installer has been downloaded, executed, or captured, so runtime verification is pending.

## Suggested articles

Read [source-build security](source-build-security.md) when an installer is unavailable, and [uninstall](uninstall.md) for removal semantics.
