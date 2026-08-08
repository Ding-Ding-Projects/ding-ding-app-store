# Offline documentation browser

## Behaviour

The offline documentation bundle is derived from every app in `data/catalog.v1.json`. For each curated app, the importer examines only the public repository's root README Markdown, Markdown below `docs/`, and the repository wiki's Git data when a wiki exists. Repository and wiki content are pinned independently to exact Git commit SHAs.

Every catalog app receives one explicit `imported`, `empty`, or `unavailable` manifest record. Each repository and wiki source receives the same explicit status, its public source URL, its pinned SHA when one exists, its article count, and a stable reason when no article was imported. An empty or missing wiki therefore cannot make an app disappear from the bundle.

Imported articles use stable identifiers derived from the catalog app id, source kind, and original path. Relative Markdown links, same-repository GitHub blob links, reference-style links, and GitHub wiki links are rewritten to `app-doc://article/<article-id>` destinations. The in-app renderer can route those destinations without opening a browser or reading a host file.

## Generated data

Run the importer from the repository root:

```powershell
node scripts/import-offline-docs.mjs
```

After a verified partial run, retry only transiently unavailable sources while reusing already verified pinned articles:

```powershell
node scripts/import-offline-docs.mjs --resume
```

The command writes a complete replacement under `data/offline-docs/` only after the temporary bundle passes verification:

| Path | Purpose |
| --- | --- |
| `manifest.json` | Catalog digest, bounds, app/source outcomes, pinned SHAs, source URLs, article metadata, hashes, sizes, link targets, and totals |
| `search-index.json` | Local title and normalized body text for every article, ordered by stable article id |
| `articles/<app>/<source>/*.md` | Sanitized Markdown addressed by the manifest |

The manifest contains no generation timestamp, temporary directory, machine path, or network error text. The same catalog and source snapshots therefore produce byte-for-byte identical output.

## Bounds and source policy

The importer fails closed or records a source as unavailable when a source crosses a bound:

| Bound | Default |
| --- | ---: |
| Curated apps | 500 |
| Tree entries per source | 50,000 |
| Markdown files per repository or wiki | 500 |
| Bytes per Markdown file | 1,000,000 |
| Aggregate bytes per repository or wiki | 12,000,000 |
| Generated article bytes | 64,000,000 |
| Source path length | 500 characters |
| One external command | 60 seconds |
| One repository or wiki source | 300 seconds |

Source paths must be relative, normalized, free of control characters, Windows drive prefixes, backslashes, empty segments, and traversal segments, including percent-encoded traversal. Repository ingestion accepts only root README Markdown and `docs/**/*.md`; it excludes `.git`, `.github`, scripts, dependencies, vendored trees, coverage, build output, and non-Markdown files. Wiki ingestion accepts bounded Markdown regular files and ignores symbolic links.

## Security considerations

- The source provider checks repository visibility before reading content. Private or non-public repositories are recorded as unavailable and contribute no article bytes.
- Source and file URLs must use `https://github.com/` and match the exact curated organization and repository. A different owner on the same host is rejected.
- GitHub access uses the `gh` CLI. Wiki checkout also starts through `gh`; local Git is used only to read the checked-out wiki commit SHA.
- High-confidence private-key and access-token forms are redacted before output. The redaction count is recorded without recording the removed value.
- Markdown images, HTML loadable-media elements, stylesheets, CSS imports, and style attributes that can load a URL are removed. No external asset is downloaded, copied, or left executable in the offline bundle.
- Unsupported relative links and unsafe schemes are removed. HTTP, HTTPS, and mail links remain explicit external destinations for the isolated renderer to handle.
- The output writer uses generated safe paths beneath its owned output directory and rejects traversal, symbolic links, unexpected files, missing files, hash drift, and search-index drift.

Provider-authored Markdown still has to render through the application's shared isolated renderer. Import sanitization reduces the input surface; it does not grant Markdown renderer privileges.

## Completeness and build gate

The offline-doc package build is a verification gate:

```powershell
npm run build --prefix packages/offline-docs
```

It fails when any curated app lacks exactly one manifest record; a repository/wiki source lacks an explicit outcome; an imported source lacks a pinned SHA; an indexed Markdown file is missing or changed; an unindexed Markdown, script, or other unexpected file appears; an internal target is missing; totals drift; or the local search index is incomplete. The catalog SHA-256 in the manifest must also match the current catalog bytes.

The root application packaging configuration already includes `data/**/*`. Wiring the package verification command into any future root build or release workflow remains necessary when those files are next in scope; this focused lane does not modify the root package manifest or workflows.

## Failure modes

| Failure | Result |
| --- | --- |
| Public repository has no commits or documentation | Explicit `empty` source record |
| Wiki is absent | Explicit `empty` wiki record with `wiki-not-found` |
| Repository is private | Explicit `unavailable` record; no content is read into the bundle |
| GitHub metadata, tree, blob, or wiki checkout fails | Explicit `unavailable` source record with a stable reason code |
| Tree is truncated or a size/count bound is crossed | Source is unavailable; no partial source content is emitted |
| Markdown is not UTF-8, contains a NUL byte, or uses a hostile path | Source is unavailable or import fails closed before publication |
| Temporary bundle fails verification | Existing output remains untouched |
| Bundle is edited or incomplete later | Package build exits unsuccessfully |

The application should render unavailable and empty states honestly. It must not claim that a repository was imported merely because the catalog entry exists.

## Verification

The focused Node test suite covers hostile and percent-encoded paths, scripts and binary-like paths, private sources, wrong GitHub owners, oversized files, missing wikis, inline and reference-style link rewriting, wiki links, asset omission, secret redaction, Unicode content, empty repositories, deterministic output, missing content, missing catalog records, and unexpected bundle files.

Run:

```powershell
npm test --prefix packages/offline-docs
npm run typecheck --prefix packages/offline-docs
npm run build --prefix packages/offline-docs
```

The generated manifest is the authoritative source for the current app and article counts and every source SHA.

## Suggested articles

Start with [catalog discovery](catalog-discovery.md), review [privacy and security](privacy-and-security.md), or use [verification](verification.md) to distinguish source, bundle, packaged-app, and runtime evidence.
