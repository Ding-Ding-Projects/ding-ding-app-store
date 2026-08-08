# Local history and version restore

> **Status: limited.** This wiki page is generated from the canonical categorized article.

## Behaviour

The Activity page includes a **Local versions** browser backed by the App Store's isolated local Git repository. It lists at most the newest 200 snapshot commits, showing each commit's timestamp, subject, label, revision identifier, and tracked state files. **View diff** loads a bounded local diff for that revision. **Label** writes a separate append-only metadata commit, so naming a version never rewrites history.

Restore is explicit and uses the same native two-key plus full-slider confirmation as other consequential state changes. The selected revision is checked for a full pair of valid JSON snapshots before any write. The current state is snapshotted first, only the App Store-owned installed-app and settings files are replaced, and a forced new restore commit records the result. The renderer then reloads live settings and history through typed bridges before announcing success, so restored theme/language/display-name values are visible immediately. A later restore can therefore undo an earlier restore. User project folders, credentials, network remotes, and arbitrary paths are never touched.

## Configuration

Snapshots live below the main-process application-data directory in an isolated Git repository. The renderer receives typed revision identifiers and bounded diff text only; it never receives the repository path or a Git command. Labels are one-line UTF-8 values from 1 to 80 characters. The version list, diff, label, and restore actions are exposed through dedicated preload IPC methods. `settings.reload()` is the explicit in-memory refresh boundary after restore; a failed reload falls back to the documented defaults and shows a notification rather than silently keeping stale values.

## Failure modes

An absent or unreadable local repository yields an honest empty version list. Unknown, malformed, unreachable, incomplete, oversized, or invalid-JSON revisions fail closed and leave state unchanged. If Git cannot preserve the current state or commit the restore, the app reports the failure; it never claims a restore that was not recorded. Label failures likewise leave the prior label and commits intact.

## Security considerations

Revision identifiers accept only full 40-hex Git commit IDs and are resolved with `shell: false` against the fixed local repository. Git reads are bounded, network access is disabled by `GIT_CONFIG_NOSYSTEM`, and only two fixed state files can be restored. Labels are length- and newline-bounded before being written to a JSON metadata file. The renderer cannot submit paths, refs, commands, or remote URLs.

## Verification

Focused contract tests assert the typed revision bridge, bounded revision/diff limits, fixed snapshot-file allowlist, full-ID validation, append-only label commits, before-and-after restore snapshots, the live settings reload callback, and the Activity page's date/action/search filters plus diff/label/restore controls. The current packaged Activity screenshot predates this version browser, so it is not claimed as visual proof for the new controls until a fresh sanctioned hidden-desktop capture is available.

## Suggested articles

- [Activity history and export](Activity-History)
- [Installed app discovery](Installed-App-Discovery)
- [Privacy and security](Privacy-and-Security)
