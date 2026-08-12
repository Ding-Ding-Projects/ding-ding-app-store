# Local personal vocabulary on the documentation site

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

Settings → General always exposes a semantic local JSON file picker, status, **Replace vocabulary**, and **Clear vocabulary** actions. The site parses a user-selected file in the browser and caches only the validated neutral document in this browser's `localStorage`. It does not send the file, source path, metadata, or private values over the network. A valid replacement becomes active immediately; an invalid file leaves the last valid cache active. Corrupt or unavailable browser storage fails closed to original shipped wording. Clear removes the validated cache and restores original wording.

The versioned contract is `{ "schemaVersion": 1, "entries": [{ "source": "…", "replacement": "…" }] }`. UTF-8 decoding is fatal. The parser rejects malformed JSON, duplicate keys, unknown fields, unsafe object keys, unsupported versions, excessive depth, control characters, empty strings, oversized strings, more than 256 entries, and payloads above 64,000 bytes. The source filename and path are never persisted.

Replacements apply only to site-owned labels and canonical feature article presentation. Provider-authored/generated catalog metadata, URLs, file paths, code spans, command flags, identifiers, hashes, and other technical tokens remain verbatim. The site uses one strict HTML-escaping renderer for both replacement-enabled and replacement-disabled article paths.

## Configuration

The site-only **Restricted presentation** switch is the explicit boundary for a static site. It is persisted in this browser, forces effective English, hides Cantonese/bilingual/funny-level and personal-vocabulary controls, and restores the user's prior base choices when switched off. It is not the desktop app's shared School mode, is not a security boundary, and cannot observe or mutate the desktop application-data record. The site states this distinction beside the switch.

Settings search indexes the picker, status, replace/clear actions, and restricted switch. The command palette reaches each of these controls and focuses the exact originating control.

## Failure modes

Missing storage, a blocked storage getter, quota errors, corrupt cached JSON, invalid UTF-8, malformed JSON, duplicate keys, unknown fields, unsafe keys, unsupported schema, size/depth/entry/string violations, no selected file, and file-read failures all remain local and fail closed. A rejected replacement never partially applies. If browser storage cannot be changed, the site reports the limitation and retains original or previously loaded in-memory wording without pretending persistence succeeded.

## Security considerations

No network request is involved in parsing, caching, replacement, clear, restricted mode, or article rendering. The cache contains only the validated user-provided entries. Private vocabulary values are excluded from exports, generated article bundles, provider-authored metadata, URLs, identifiers, diagnostics, and public records. The static site has no operating-system credential vault or shared application-data access; it therefore exposes the site-only restricted boundary rather than claiming parity with the desktop School-mode record.

## Verification

`tests/site-personal-vocabulary.test.ts` covers strict schema rejection, fatal UTF-8, duplicate/unknown/unsafe/depth/size/control bounds, local cache reload/replace/clear, corrupt and unavailable storage, technical-token preservation, restricted suppression, and static parity markers for the visible picker, search, palette, and runtime module. `node --check` covers both site modules; `npm run docs:generate` regenerates the canonical article mirrors, offline bundle, site article bundle, and wiki page, while `npm run docs:check` verifies parity. This lane does not claim packaged desktop runtime, screen-reader drive, or browser visual evidence.

## Suggested articles

- [Settings, language, and display name](Settings-Language-and-Display-Name)
- [Universal School mode](School-Mode)
- [Search and regex builder](Search-and-Regex-Builder)
- [Privacy and security](Privacy-and-Security)
