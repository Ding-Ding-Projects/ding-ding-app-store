# Ding Ding App Store documentation

These articles describe the current application at the exact boundary implemented in source. **Limited** and **pending** labels are intentional: a catalog record is not proof that its installer works, a check is not a download, and a static test is not runtime evidence.

- [Complete categorized feature index](features/README.md)
- [Static documentation site](../site/README.md)
- [Verification and evidence](features/verification/verification.md)

## Feature inventory

- **Discovery and catalog:** Catalog discovery (shipped)
- **Installation and removal:** Verified installer operations (limited), Source-build security (limited), Protected uninstall (shipped), Automatic repair and universal adapters (pending)
- **Installed apps and history:** Installed app discovery (shipped), Activity history and export (shipped)
- **Updates and schedules:** Per-app update checker (limited), App Store self-updater (limited), Update schedule (shipped)
- **Workspace and customization:** Tab workspace (shipped), Search and regex builder (shipped), Command palette (shipped), Settings, language, and display name (shipped), Appearance editor (limited), Notifications and operation status (limited)
- **Documentation:** Offline documentation browser (shipped)
- **Security and privacy:** Privacy and security (shipped)
- **Verification:** Verification and evidence (shipped)

## Documentation contract

Every feature article covers behaviour, configuration, failure modes, security considerations, verification, and suggested articles. The generator validates that the canonical articles, category indexes, wiki pages, static-site bundle, and offline in-app bundle remain synchronized. Run `npm run docs:generate` after editing an article and `npm run docs:check` before committing.
