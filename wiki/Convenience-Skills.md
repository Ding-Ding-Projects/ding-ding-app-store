# Shared convenience skills

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

Shared convenience skills are reusable instructions and workflows distributed with provenance metadata. A synchronization record identifies the approved source snapshot, validates the owner and path, imports only the documented skill file, and reports whether the record is available, imported, skipped, or blocked. The App Store's offline documentation browser can explain a skill without executing its commands or silently changing another tool's installation.

## Configuration

Each skill record is bounded by an owner, repository, immutable commit, permitted path, schema version, and size limit. The mirror stores the source revision and a sanitized public article; it does not copy private vocabulary, credentials, staging files, executable payloads, or arbitrary repository trees. A local cache may retain the last verified record so offline readers can distinguish old verified content from a refresh that has not completed.

## Failure modes

Private or unavailable source, moved commit, redirect, malformed front matter, path traversal, oversized file, digest mismatch, unknown skill type, or provider outage fails closed as a typed blocked or unavailable result. The synchronizer preserves the last verified article when safe and states what could not be refreshed. It never guesses a replacement path, runs a downloaded script, or presents a partial bundle as complete.

## Security considerations

Skill text is untrusted provider-authored content and is rendered in the isolated documentation surface without shell, filesystem, network, or privileged adapter access. The renderer receives typed metadata only; it cannot turn a skill name into a command or executable path. Secrets never enter generated TypeScript, site files, wiki mirrors, exports, notifications, screenshots, or Git history, and a skill article does not authorize source execution or automatic repair.

## Verification

`npm run docs:check` validates the canonical skill article, memory-sync category index, internal links, static-site mirror, wiki page, and offline bundle together. Focused tests assert the skill inventory, provenance wording, blocked outcomes, and secret-assignment exclusion. A green documentation check is not live synchronization or host-runtime evidence; those require a separately authenticated and observed run.

## Suggested articles

- [Shared Status Hub](Status-Hub)
- [Privacy and security](Privacy-and-Security)
- [Source-build security](Source-Build-Security)
- [Verification and evidence](Verification)
