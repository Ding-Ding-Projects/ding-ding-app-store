---
id: catalog-language
title: Catalog language coverage
titleYue: 目錄語言覆蓋
category: experience
status: shipped
summary: Keeps Discover, Installed, and Updates controls, status facts, loading states, and recovery actions aligned with the persisted language mode.
---
# Catalog language coverage

## Behaviour

Discover, Installed, and Updates use the persisted English, Hong Kong Cantonese, or bilingual mode for their visible controls and status copy. This includes selection labels, bulk-action counts, export and Visual Studio Code actions, update buttons, loading and empty states, package status pills, and installation facts. Repository names, package types, versions, operation identifiers, and provider-authored descriptions remain factual data rather than being rewritten.

## Configuration

Change the language mode in Settings. The catalog surface reads the same setting as the rest of the application; no catalog-specific preference is created. Search remains plain-text-first and keeps its existing regex-builder route.

## Failure modes

If a catalog record has no stable release, the surface says so instead of inventing a version. Unsupported and failed update states remain explicit. Missing Visual Studio Code support stays disabled with an explanation; changing language does not make an unavailable adapter appear available.

## Security considerations

Localization changes only renderer copy. They do not alter catalog identifiers, installer adapters, source paths, executable arguments, ownership records, or privileged IPC requests. Provider-authored descriptions are still displayed as data and are never treated as commands.

## Verification

`tests/apps-page-discovery.test.tsx` verifies that discovery-only records keep install, update, and uninstall controls unavailable and that the Cantonese mode renders the reviewed update and detection facts without English fallback. The change is covered by the repository's renderer typecheck, full test suite, documentation generator, and production build. No packaged hidden-desktop capture is claimed by this article.

## Suggested articles

- [Catalog discovery](../discovery/catalog-discovery.md)
- [Settings, language, and display name](./settings-language-and-display-name.md)
- [Verified installer operations](../installation/verified-installer-operations.md)
- [Search and regex builder](./search-and-regex-builder.md)
