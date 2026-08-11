# Ding Ding App Store documentation

These articles describe the current application at the exact boundary implemented in source. **Limited** and **pending** labels are intentional: a catalog record is not proof that its installer works, a check is not a download, and a static test is not runtime evidence.

- [Complete categorized feature index](features/README.md)
- [Static documentation site](../site/README.md)
- [Verification and evidence](features/verification/verification.md)

## Feature inventory

- **Discovery and catalog:** Catalog discovery (shipped), Lowlevel Computer Use MCP catalog record (limited), Material Download Manager catalog record (limited), Material Designer catalog record (limited), Material BlueMap catalog record (limited), Desktop Material catalog record (limited), Home Assistant AC Defender catalog record (limited), Material Email catalog record (limited), OpenCodex catalog record (limited), qBittorrent Material catalog record (limited), WinSCP Material catalog record (limited), Dim Sum Atlas catalog record (limited), Win SSH Copy ID catalog record (limited), Material Office catalog record (limited), Minecraft World Downloader catalog record (limited), Codex Material catalog record (limited), LibreOffice Material catalog record (limited), Material Mail catalog record (limited), Bambu Studio catalog record (limited), KeePassXC catalog record (limited), JDownloader Material catalog record (limited), Home Assistant Bambu Lab catalog record (limited), WinForge catalog record (limited), WimForge catalog record (limited), Photo Viewer catalog record (limited), Amulet Map Editor catalog record (limited)
- **Installation and removal:** Verified installer operations (limited), One-click installation and adapter coverage (limited), Source-build security (limited), Protected uninstall (shipped), Automatic repair and universal adapters (limited)
- **Installed apps and history:** Installed app discovery (shipped), Activity history and export (shipped), Local history and version restore (limited)
- **Updates and schedules:** Per-app update checker (limited), App Store self-updater (limited), Update schedule (shipped)
- **Workspace and customization:** Tab workspace (shipped), Tab and group UX locks with local Support Tickets (limited), Search and regex builder (shipped), Command palette (shipped), Settings, language, and display name (shipped), Universal School mode (shipped), Optional spoken narrator (shipped), External editor exports (shipped), Appearance editor (limited), Notifications and operation status (limited), Dim-sum startup surprise (shipped), Changelog viewer (shipped), Catalog language coverage (shipped)
- **Documentation:** Offline documentation browser (shipped)
- **Memory synchronization:** Shared Status Hub (limited), Shared convenience skills (limited), Local authenticator registration and entries (limited), Secret and display-name mutation history (limited)
- **Security and privacy:** Privacy and security (shipped)
- **Verification:** Verification and evidence (shipped)

## Documentation contract

Every feature article covers behaviour, configuration, failure modes, security considerations, verification, and suggested articles. The generator validates that the canonical articles, category indexes, wiki pages, static-site bundle, and offline in-app bundle remain synchronized. Run `npm run docs:generate` after editing an article and `npm run docs:check` before committing.
