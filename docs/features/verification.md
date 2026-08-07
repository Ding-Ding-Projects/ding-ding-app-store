# Verification

## Behaviour

Verification reports what was actually checked for a specific revision: static structure, focused tests, build, runtime operations, headless visual capture, release assets, and remote workflow results. It labels each independently rather than letting one passing check imply another.

## Configuration

The project’s verification harness should run focused tests first, then build and test the relevant package, use the required cheap headless route for interactive Windows evidence, and preserve exact revision, command, result count, and artifact links.

## Failure modes

A missing dependency, unavailable headless route, failed build, failed test, cancelled workflow, absent installer, or unavailable release is a recorded boundary, not a success. Captures that require an application surface are skipped only with their reason and never replaced by mockups.

## Security considerations

Evidence must not expose tokens, credentials, private paths, or user data. External workflows and release records are treated as independent state and verified against their exact commit/ref.

## Verification

The packaged Windows x64 application was launched on the sanctioned cheap hidden desktop from the unsigned `win-unpacked` artifact. The real catalog surface rendered and loaded the curated public catalog; the capture is stored at [`docs/assets/screenshots/catalog-runtime.png`](../assets/screenshots/catalog-runtime.png). The same pass found and fixed a CommonJS updater import crash, a missing bundled preload bridge, and the packaged catalog path.

The startup update checker truthfully reports HTTP 404 because this new repository has no published `RELEASES` asset yet. That is runtime proof of the failure state, not update-feed success. CI, published installer, real update download/restart, source-build execution, and full offline cross-repository documentation remain unverified.

## Suggested articles

Return to [catalog discovery](catalog-discovery.md) or [offline documentation browser](offline-documentation-browser.md) to see where feature-specific verification applies.
