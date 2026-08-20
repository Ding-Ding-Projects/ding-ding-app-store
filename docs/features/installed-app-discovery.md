# Installed app discovery and history

## Behaviour

The App Store discovers only catalogued applications. It checks reviewed Squirrel install roots below the current user’s local application-data folder, parses Windows Installer records from the standard per-user and machine uninstall registry keys, and recognizes portable apps only inside the App Store’s managed portable folder. The Installed tab shows the detected source, version, root, and supported removal route.

Every install, source build, update, uninstall, settings change, failure, and cancellation receives an append-only operation entry. Successful state changes also snapshot the installed-app and settings records into an isolated local Git repository beside the App Store’s private data, never inside a user project.

## Configuration

Discovery runs at startup and when the user refreshes the Installed tab. History exports the current filtered record set as UTF-8 JSON, JSONL, CSV, or Markdown. The local history repository is not synchronized or pushed.

## Failure modes

Missing registry access, malformed values, missing `Update.exe`, invalid MSI product identifiers, and inaccessible managed folders are treated as absent or unsupported installations. Discovery never converts an unknown uninstall string into an executable command. A history write or Git snapshot failure is reported separately and never reverses the operation the user requested.

## Security considerations

Squirrel roots must be a direct child of the expected local application-data folder and use the reviewed installer name. MSI removal accepts only a canonical product GUID and reconstructs the fixed `msiexec.exe /x … /qn /norestart` argument vector. Portable deletion is restricted to a direct child of the App Store’s managed portable root and still passes through the native two-key plus full-slider confirmation.

## Verification

Focused tests cover multi-record registry output, missing display names, valid and hostile MSI uninstall strings, Squirrel path traversal, and version selection. The combined TypeScript build and full workspace suites pass. A real destructive uninstall has not been performed; that runtime proof remains pending.

## Suggested articles

Continue with [uninstall](uninstall.md) for the destructive decision path or [privacy and security](privacy-and-security.md) for local history boundaries.

