---
id: catalog-discovery
title: Catalog discovery
titleYue: 目錄探索
category: discovery
status: shipped
summary: Loads a reviewed public-app allowlist, enriches it with live repository and stable-release metadata, and falls back honestly to a bounded cache.
---
# Catalog discovery

## Behaviour

The catalog starts from [`data/catalog.v1.json`](../../../data/catalog.v1.json), a reviewed allowlist of public Ding Ding Projects repositories. Each entry fixes its public identifier, repository, display name, availability class, package type, source manifest, one closed adapter ID, and an explicit `proofStatus`. `verified` is the only status that can expose install, source-build, or managed-update actions; `blocked-until-proof` also names its proof target and remains unavailable until that target is verified. `not-required` is reserved for rows that have no install route. Asset patterns, arguments, registry identities, uninstall semantics, and blockers live in the typed hand-written adapter map rather than editable catalog JSON. The documentation generator produces one separately labelled offline metadata record for each allowlisted ID; it reports only reviewed catalog and adapter state, not provider README/release text or executable details. The main process then queries public GitHub repository and latest stable-release metadata and returns cards containing the real description, version, source link, stars, package type, proof status, installed version, and update comparison. Private and archived repositories are excluded.

The Discover page provides its own plain-text-first search over names, descriptions, and repository names. The adjacent full regex builder applies the same pattern and flags to that field. A refresh command bypasses the 30-minute cache and replaces the visible snapshot only with parsed catalog data.

Discover, Installed, and Updates collections support checkbox and Shift-range selection, visible-scope select-all, inversion, clear, filtered JSON export, and review counts that distinguish selected, shown, and total records. Bulk install and source-build actions run serially through the same typed one-click route. Bulk uninstall includes only selected installed applications and reuses the native destructive super-confirmation.

## Configuration

The allowlist is source-controlled; the renderer cannot add a repository or change an adapter. The page search is session-only so reopening the app never silently hides results behind a restored filter. Catalog refresh is also available from the command palette and the scheduled catalog task.

## Failure modes

If live metadata fails and a cache exists, the app returns the cached snapshot with a warning. A scheduled refresh that uses this fallback is recorded as failed, not successful. With no cache, the request error is shown as a non-blocking notification. Missing public repositories appear as unsupported cards instead of being silently removed. Missing stable releases show `No stable release`; they are never treated as installers. Missing or unknown proof status is normalized to blocked in an old cache, and a blocked row shows its proof target and truthful reason while hiding install, build, and update controls. The renderer guard is duplicated in the main-process operation and IPC dispatch paths, so a crafted request cannot bypass the unavailable state.

## Security considerations

Requests are restricted to `https://api.github.com`, use a 15-second timeout, reject redirects, and cap each parsed response at 2 MB. Zod schemas allowlist every catalog, repository, release, and asset field. Catalog text remains data: it never supplies a command, local path, environment value, or installer arguments to the renderer or process launcher.

## Verification

The catalog schema, proof-status normalization, origin restriction, cache fallback, renderer boundary, and public-only filtering are directly implemented in `src/main/catalog-service.ts`. Generated-documentation tests independently preserve the hand-written 49-ID inventory, exact generated article IDs, catalogue/adapter alignment, command-palette reachability, and fail-closed unknown IDs. Focused proof-status regressions cover blocked/verified card rendering, operation guards, IPC dispatch guards, explicit target requirements, and a deliberate source-marker removal that turns the check red. The packaged runtime capture in `docs/assets/screenshots/catalog-runtime.png` proves the built catalog surface rendered against the public organization at the captured revision. It does not prove that every listed application has a working adapter or clean-Windows lifecycle proof.

## Suggested articles

- [Verified installer operations](../installation/verified-installer-operations.md)
- [Per-app update checker](../updates/per-app-update-checker.md)
- [Privacy and security](../security/privacy-and-security.md)
