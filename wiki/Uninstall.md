# Protected uninstall

> **Status: shipped.** This wiki page is generated from the canonical categorized article.


## Behaviour

The Uninstall button appears only for a catalog app with an installed version. Its native confirmation requires two independently operated key controls and the full-range slider before the request can be dispatched. The main process re-discovers the current installed record, selects its typed uninstall route, runs a fixed Squirrel or MSI vector or removes one validated managed-portable directory, removes the record only after success, and appends the outcome to history.

## Configuration

There is no free-form uninstall command or path. Squirrel uses its recorded `Update.exe --uninstall -s`; MSI reconstructs `msiexec.exe /x <canonical-product-guid> /qn /norestart`; portable removal is restricted to a direct child of the App Store's private managed-portable root. The current UI does not offer separate application-data deletion because no reviewed adapter declares that distinction.

## Failure modes

The operation fails without deletion when the app is not allowlisted, confirmation is incomplete, discovery finds no verified route, an executable is missing, a product GUID is invalid, a portable path escapes its root, the 15-minute limit expires, or the process exits non-zero. Partial effects produced inside a third-party uninstaller are reported honestly; the App Store does not claim rollback it cannot perform.

## Security considerations

Registry uninstall strings are parsed only to extract a canonical MSI GUID. Arbitrary registry commands, quoted paths, environment expansion, shell fragments, and catalog-supplied deletion targets never execute. The slider gate stays outside appearance customization and cannot be hidden or restyled. Operation history records the result without storing secrets.

## Verification

Focused tests cover multi-record registry parsing, missing names, valid and hostile MSI strings, Squirrel path traversal, version selection, and managed portable boundaries. The source proves two keys plus a 100% slider are required. A real destructive uninstall has not been run in this docs lane.

## Suggested articles

- [Installed app discovery](Installed-App-Discovery)
- [Verified installer operations](Verified-Installer-Operations)
- [Activity history and export](Activity-History)
