# Privacy and security

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

The frameless Electron window runs with context isolation, renderer sandboxing, Node integration disabled, web security enabled, insecure content disabled, permissions denied, external windows denied, and navigation blocked. A narrow frozen preload bridge exposes typed catalog, operation, update, settings, history, workspace, appearance, schedule, and window actions. The renderer sends app identifiers and user decisions; privileged services own URLs, paths, commands, arguments, persistence locations, and process creation.

Local data includes settings, tab workspace, appearance, schedule configuration/run records, catalog cache, installed records, operation JSONL, and local Git snapshots. No analytics or third-party site assets are included.

## Configuration

Users can export history, tab layout, and appearance documents. Sensitive credentials are not part of any current feature or schema. Display-name, language, theme, density, accent, funny levels, schedule, and appearance affect presentation without moving product identity or privileged locations.

## Failure modes

Invalid persisted documents fall back, quarantine, or reject according to their service. Network timeouts, origin violations, metadata limits, hash mismatch, missing adapters, unsupported uninstall ownership, and withheld source execution produce explicit failures. History and snapshot failure never rolls back the primary user operation. Some errors do not yet have a dedicated recovery action or notification history; those UX gaps do not expand authority.

## Security considerations

Catalog and updater traffic is HTTPS-only and host-allowlisted. Downloads require byte count and SHA-256 digest. Child processes use `shell: false`, hidden windows, fixed arguments, timeouts, and reduced environments. Registry strings never execute. JSON inputs are schema-validated and bounded. Appearance generates only closed CSS custom properties. Releases remain unsigned and never claim publisher authentication.

## Verification

Contract tests assert renderer isolation, preload shape, typed requests, appearance injection defenses, workspace/schedule bounds, and installer/uninstall rules. Source inspection and the production build support the stated boundary. A full threat-model review, sandbox escape testing, credential-vault path, and destructive runtime matrix are not claimed.

## Suggested articles

- [Verified installer operations](Verified-Installer-Operations)
- [Source-build security](Source-Build-Security)
- [Verification and evidence](Verification)
