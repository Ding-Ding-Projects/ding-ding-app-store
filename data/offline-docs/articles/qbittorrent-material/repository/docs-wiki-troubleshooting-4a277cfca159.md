# Troubleshooting

## The Windows helper cannot find a compiler

Install Visual Studio 2022 Build Tools with the Desktop development with C++ workload, then reopen the terminal so discovery can see the installation.

## The first configure step is slow

CMake invokes vcpkg during configure. A cold run may compile native dependencies for tens of minutes; later runs use the binary cache.

## The installed application reports a Qt platform error

Confirm that `plugins/platforms/qwindows.dll` exists beside the installed `bin` directory. Always test the packaged install tree rather than only the development executable.

## The documentation search reports an invalid pattern

Open the regex builder and inspect the validation message. Unbalanced groups, invalid character ranges, and unsupported flags are the most common causes. Disable Regex to search for the literal text.

## Imported pages disappeared

Imports are local to the current browser profile. Export a wiki JSON bundle before clearing site data or moving to another browser.

## Workspace changes remain pending

Press `Ctrl+S` while the Workspace view is active or choose **Workspace > Save &
Commit Workspace**. If the status still reports that local Git needs attention,
open the managed repository and confirm that the current user can write to its
parent application-data directory and that the disk has free space. A separate
Git installation is not required because the application uses bundled libgit2.

## A workspace import is rejected

Select a local `.json` file produced by **Export workspace JSON**, or select the
root of a repository produced by **Export complete Git repository**. Repository
imports require `.git`, `workspace.json`, and the referenced `tabs/*.md` files.
Symbolic-link and reparse-point paths are rejected. Current limits are 100 tabs,
4 MB per page, 32 MB per JSON snapshot, and 256 MB per repository transfer.

A portable JSON snapshot must embed a string `content` value for every tab. The
metadata-only `workspace.json` inside a complete repository deliberately omits
that text because page bodies live in `tabs/*.md`; importing that metadata file
as a snapshot is rejected instead of replacing pages with empty content.

Documentation-site wiki/search bundles and application Workspace snapshots are
different formats and cannot be imported into each other.

## A complete repository import activated different history

That is expected: the selected repository becomes the active workspace and Git
history. Before switching, pending edits are committed. After a successful
switch, the previous complete repository is retained in a hidden sibling folder
named `.workspace-backup-<timestamp>-<id>`; the success message includes its
path. Keep it until the imported pages and history have been verified. JSON
import is the appropriate choice when changes should become commits in the
existing active history.

## The app reports a recovered or interrupted workspace

Open the managed repository, move up to its parent directory, and enable hidden
items. Depending on the event, that parent may contain:

- `.workspace-recovery-*` — invalid state found at startup and moved aside
  before a fresh Welcome workspace was created;
- `.workspace-backup-*` — the complete previous repository retained during an
  import;
- `.workspace-import-*` — an incoming staged copy preserved when an interrupted
  activation could not be recovered automatically;
- `.workspace-failed-import-*` — an activated incoming copy that later failed
  validation and was moved aside.

If the normal repository is missing after an interrupted import, the next
launch attempts to restore the newest valid `.workspace-backup-*` automatically.
If automatic restoration cannot complete, workspace writes remain blocked and
all available copies are preserved. Do not delete or rename them while the app
is running. Copy any important recovery directory somewhere safe before manual
repair, and keep the reported paths with a bug report.

If invalid startup state could not be moved aside, the original files remain
untouched and the Welcome page is in memory only. Resolve the file-system issue
or recover the original repository before expecting Workspace saves to resume.

## Renaming the application did not rename its files

Workspace renaming changes the user-facing display name in the window,
Workspace header, and tray tooltip. It intentionally leaves the executable,
installer entry, application data location, and managed repository path stable.

## GitHub Pages shows an old page

Wait for the Pages deployment to finish, force-refresh once, and check that `content.generated.js` was regenerated after documentation changes.
