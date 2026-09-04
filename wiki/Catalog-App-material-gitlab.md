# Material GitLab catalog record

> **Status: limited.** This wiki page is generated from reviewed local catalog metadata.

> **Generated catalog metadata.** This article is assembled from the reviewed local catalog and adapter inventory. It is not provider-authored documentation and does not scrape repository text, copy external assets, or expose installer commands.

## Behaviour

This record describes the reviewed catalog entry `material-gitlab`. Its public source repository is [material-gitlab](https://github.com/Ding-Ding-Projects/material-gitlab). The current availability is **Unavailable through this catalog** and the declared package type is **unsupported**. The closed adapter identifier is `material-gitlab-no-reviewed-installer`.

The current adapter state is: Blocked. The public repository publishes no release for the Material GitLab catalog product. Its root build-installer.bat produces a source ZIP, while the Windows release workflow packages two separately identified tools, so there is no immutable product installer to verify or run.

The icon is first-party reviewed from repository asset `app/assets/images/logo.svg`; if that asset is unavailable, the UI uses the declared generated-monogram fallback rather than a remote or guessed image.

## Configuration

The catalog record is source-controlled. The renderer may request this application by its typed identifier and a user decision, but it cannot alter the repository, source manifest, package type, adapter, download, command, argument, or local destination. The source manifest marker is `package.json`; it is metadata only and is not a source-build recipe.

## Failure modes

Catalog metadata does not prove that a public repository, release, asset, installer, update, or source build is currently usable. A missing release, ambiguous asset, digest failure, network failure, unsupported adapter, or unavailable source-build boundary fails closed and reports its typed outcome. This record remains unavailable until a reviewed public route exists; the application does not guess a target or fallback command.

## Security considerations

This generated record contains only reviewed identifiers and public repository links. It intentionally excludes provider README content, release-body text, external images, download URLs, executable paths, command lines, installer arguments, credentials, and private infrastructure. Privileged install, update, uninstall, and source-build decisions remain in the main-process adapters.

## Verification

The documentation generator checks this article against the hand-written catalog and adapter metadata inventories, then includes it in the offline TypeScript bundle, static-site article bundle, wiki mirror, documentation search, and command palette. That proves generated metadata coverage only. It does not claim a clean-Windows installation, update, source build, application launch, or published release verification for this application.

## Suggested articles

- [Catalog discovery](Catalog-Discovery)
- [Verified installer operations](Verified-Installer-Operations)
- [Per-app update checker](Per-App-Update-Checker)
- [Source-build security](Source-Build-Security)
- [Privacy and security](Privacy-and-Security)
- [Verification and evidence](Verification)
