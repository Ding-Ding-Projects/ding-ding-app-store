# Catalog discovery

The catalog exposes Ding Ding Projects applications through searchable, filterable records with version, platform, source, and installer availability. Plain search is default; an adjacent regex builder supports validated, bounded regex when opted in. Unavailable or malformed records show honest states and never invent an installer.

- Configuration: approved catalog, platform/category filters, persisted view preferences.
- Failure: invalid regex, no matches, bad record, or unavailable catalog is explicit and recoverable.
- Security: allowlisted data, safe URL schemes, untrusted descriptions, bounded regex evaluation.
- Verification: static docs/site coverage only; app runtime and visual proof are pending.

See the detailed source article: `docs/features/catalog-discovery.md`.
