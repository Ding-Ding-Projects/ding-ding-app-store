# Installed app discovery

> **Status: shipped.** This wiki page is generated from the canonical categorized article.

## Behaviour

Discovery runs during startup and whenever the renderer requests the installed list. It starts with the App Store's `installed-apps.v1.json` records, then checks every catalog entry through only its declared strategy: Squirrel applications below the current user's local application-data directory, MSI records in the standard per-user, machine, and 32-bit-on-64-bit uninstall registry keys, and portable applications inside the App Store's managed portable directory. The Installed tab filters the live catalog against these discovered versions.

## Configuration

No folder scan, registry pattern, or display-name alias is user-editable. Catalog entries declare their installer name and uninstall strategy. Discovery keeps source, version, root, uninstall route, installation time when known, and detection time. Manually installed catalog apps can therefore appear even when the App Store did not perform the installation.

## Failure modes

Missing registry keys, query exit code 1, missing `Update.exe`, inaccessible version folders, malformed uninstall data, an invalid MSI product code, or a missing managed folder are treated as no supported detection for that strategy. One failed registry hive returns no entries for that hive without inventing a result. Unknown prior records remain in the local file until a successful operation removes them; the UI must not treat an unverifiable uninstall route as safe.

## Security considerations

Squirrel roots must be a direct child of the expected local application-data root. MSI discovery matches the exact catalog display name and extracts only a canonical GUID from the registry string. Portable roots are constructed from a validated app identifier beneath the App Store's own directory. Renderer code receives typed records but no ability to submit a discovery path or registry command.

## Verification

Focused tests cover registry output with multiple records, missing display names, canonical and hostile MSI strings, Squirrel traversal rejection, and latest version-folder selection. The packaged Installed capture at `docs/assets/screenshots/installed-runtime.png` proves the surface rendered at one revision; it is not a census of every Windows installation technology.

## Suggested articles

- [Protected uninstall](Uninstall)
- [Activity history and export](Activity-History)
- [Privacy and security](Privacy-and-Security)
