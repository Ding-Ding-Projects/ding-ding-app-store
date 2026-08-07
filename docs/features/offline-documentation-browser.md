# Offline documentation browser

## Behaviour

The desktop app bundles every feature article into an offline documentation browser. Articles render through one shared, isolated Markdown renderer, and internal links resolve inside the app. The browser has plain-text search by default and an adjacent full regex builder for the same query, flags, sample text, validation, matches, and captures.

## Configuration

Documentation is packaged at build time and indexed by title and body. Search preferences, language mode, and independent English/Cantonese funny-level settings persist locally. A command-palette result can take the user directly to a feature article.

## Failure modes

A missing article, missing bundle index, invalid regex, or no result produces an explicit, accessible empty/error state. The build must fail if an article on disk is omitted from the bundle rather than silently releasing incomplete offline help.

## Security considerations

Remote-authored or catalog-authored text is rendered in an isolated surface without application privileges. Link handling identifies external destinations, and regex evaluation is bounded to protect the host.

## Verification

This lane supplies the source documentation and static-site foundation. The packaged browser and its completeness guard need application build verification.

## Suggested articles

Start with [catalog discovery](catalog-discovery.md) or see [verification](verification.md) for the distinction between static coverage and runtime proof.
