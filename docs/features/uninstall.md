# Uninstall

## Behaviour

The uninstall action identifies the exact installed application, version, installation folder, and registry/package ownership before any removal begins. It offers application-data handling as a separately explained choice and records the result in local operation history.

## Configuration

The user may keep or remove data only when the selected application’s uninstall contract supports that distinction. Any destructive option requires the app’s native super-confirmation flow; cancelling returns focus to the initiating action.

## Failure modes

Missing uninstallers, locked files, insufficient permissions, partial removal, cancellation, and unknown ownership are reported without claiming completion. The app does not delete a directory it cannot prove belongs to the selected installation.

## Security considerations

Paths are canonicalized and checked against the installation record before removal. The operation never expands arbitrary environment variables or follows an unvalidated catalog path into unrelated data. Destructive actions remain auditable through local history.

## Verification

The implementation now reconstructs only fixed Squirrel and MSI removal argument vectors, validates managed portable paths, and records results through append-only history. Registry parsing, MSI product-code validation, Squirrel traversal rejection, and installed-version selection have focused tests. No real destructive removal has been run yet.

## Suggested articles

Review [verified installer operations](verified-installer-operations.md) to understand installation ownership and [privacy and security](privacy-and-security.md) for retained-data choices.
