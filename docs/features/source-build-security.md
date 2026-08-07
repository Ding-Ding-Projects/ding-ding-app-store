# Source-build security

## Behaviour

When a project has no verified installer, the app can present a source-build route with the exact repository revision, declared build command, dependency manifest, expected outputs, and explicit trust boundary. Builds run in an isolated working directory rather than inside arbitrary user folders.

## Configuration

Select only a catalog-approved repository and revision. The build page shows the resolved toolchain requirements before starting and lets the user choose an owned output directory. Credentials are never accepted through a source-build command field.

## Failure modes

Missing toolchains, unsupported platforms, dependency-resolution errors, an untrusted revision, build failure, cancellation, or absent outputs preserve logs and state the next safe action. A failed build never becomes an installed application.

## Security considerations

Building source executes project code, so it is opt-in and visibly labelled. The operation constrains repositories, revisions, paths, environment variables, output locations, and network access according to the app’s implementation policy. It rejects shell fragments supplied by catalog descriptions and does not expose secrets in logs.

## Verification

No source build runs in this docs-only lane. The static policy is documented; isolation and process execution need targeted application tests and runtime proof.

## Suggested articles

See [verified installer operations](verified-installer-operations.md) for the preferred packaged route and [privacy and security](privacy-and-security.md) for data handling.
