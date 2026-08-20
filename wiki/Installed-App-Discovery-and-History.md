# Installed app discovery and history

The App Store detects only reviewed catalog applications through validated Squirrel roots, canonical MSI registry records, or its own managed portable folder. It never executes an arbitrary uninstall string.

Operations and settings changes are append-only history events. Successful state changes also receive a local Git snapshot beside the App Store’s private data. History exports as UTF-8 JSON, JSONL, CSV, or Markdown.

Failure to write history never fails the requested operation. Real destructive-uninstall runtime proof remains pending.

See [Uninstall](Uninstall.md) and [Privacy and Security](Privacy-and-Security.md).
