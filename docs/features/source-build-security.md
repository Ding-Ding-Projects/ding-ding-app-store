# Source-build security

## Behaviour

When a project has no verified installer, its **Install from source** action dispatches immediately but remains fail-closed until a reviewed per-app recipe and disposable runner exist. That recipe fixes the repository revision, dependency manifests, toolchain/bootstrap plan, build steps, expected outputs, retry limits, and installation ownership. Builds run only in a disposable workspace rather than inside arbitrary user folders.

## Configuration

The future runner provides a structured build/run terminal simulator, not a free-form shell. It may perform automatic OpenCode bootstrap when OpenCode is absent only from a pinned canonical artifact with a verified hash. OpenCode repair is touchless but bounded by explicit retry/time/resource limits and by the disposable checkout; it cannot access arbitrary user paths, user secrets, host credentials, or unrelated repositories. Credentials are never accepted through a source-build command field.

## Failure modes

Missing toolchains, unsupported platforms, dependency-resolution errors, an untrusted revision, build failure, cancellation, or absent outputs preserve logs and state the next safe action. A failed build never becomes an installed application.

## Security considerations

Building source executes project code, so it is opt-in and visibly labelled. The operation constrains repositories, revisions, paths, environment variables, output locations, and network access according to the app’s implementation policy. It rejects shell fragments supplied by catalog descriptions and does not expose secrets in logs.

## Verification

No source build or OpenCode repair runs in this lane. The static policy is documented; isolation, dependency bootstrap, retry exhaustion, cleanup, and process execution need targeted application tests and clean-Windows runtime proof.

## Suggested articles

See [verified installer operations](verified-installer-operations.md) for the preferred packaged route and [privacy and security](privacy-and-security.md) for data handling.
