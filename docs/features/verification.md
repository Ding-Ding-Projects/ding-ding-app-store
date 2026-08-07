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

For this lane, static source/documentation checks are the only intended evidence. Desktop runtime, installer, updater, offline bundle, visual capture, CI, and release verification are pending until implementation exists.

## Suggested articles

Return to [catalog discovery](catalog-discovery.md) or [offline documentation browser](offline-documentation-browser.md) to see where feature-specific verification applies.
