# Offline documentation browser

The desktop app bundles feature articles at build time, uses one isolated Markdown renderer, keeps article links in-app, and provides plain-first search with an adjacent regex builder.

- Configuration: build-time index, persisted language/funny-level/search preferences, command-palette access.
- Failure: omitted article, invalid regex, missing index, and no results are explicit; completeness should fail builds.
- Security: isolate untrusted text and bound regex evaluation.
- Verification: package/bundle runtime proof is pending.

Detailed source: `docs/features/offline-documentation-browser.md`.
