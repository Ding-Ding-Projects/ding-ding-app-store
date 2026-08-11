---
id: history-versioning
title: Local history and version restore
titleYue: 本機歷史同版本還原
category: installed
status: limited
summary: Browses bounded local-Git snapshots with diff, labels, and an explicit reversible restore path.
---
# Local history and version restore

## Behaviour

The Activity page includes a **Local versions** browser backed by the App Store's isolated local Git repository. It lists at most the newest 200 snapshot commits, showing each commit's timestamp, subject, label, revision identifier, and tracked state files. **View diff** loads a bounded local diff for that revision. **Label** writes a separate append-only metadata commit, so naming a version never rewrites history.

Restore is explicit and uses the same native two-key plus full-slider confirmation as other consequential state changes. The selected revision is checked for a complete set of valid JSON snapshots before any write; older two-file revisions remain restorable with documented empty fallbacks for the newer files. The current state is snapshotted first, then App Store-owned settings, installed records, workspace tabs, appearance, schedules, schedule-run metadata, and external-editor preference are replaced together. A forced new restore commit records the result. On a write or commit failure the service attempts to restore every prior file, reports whether that rollback completed, and never claims success when recovery is incomplete. The renderer then reloads history, settings, installed records, workspace tabs, appearance, schedules, and the external-editor settings surface through typed bridges before announcing success, so all restored live state is visible immediately and stale autosave drafts are fenced out. A later restore can therefore undo an earlier restore. User project folders, credentials, Home Assistant vault material, staged update paths, network remotes, and arbitrary paths are never touched.

## Configuration

Snapshots live below the main-process application-data directory in an isolated Git repository. The renderer receives typed revision identifiers and bounded diff text only; it never receives the repository path or a Git command. Labels are one-line UTF-8 values from 1 to 80 characters. The version list, diff, label, and restore actions are exposed through dedicated preload IPC methods. `settings.reload()`, `workspace.reload()`, `appearance.reload()`, and `schedule.reload()` are the explicit in-memory refresh boundaries after restore; installed records reload through the operations bridge and the settings surface remounts so its external-editor preference is read again. A failed reload falls back to the documented defaults or last-good state and shows a notification rather than silently keeping stale values. Snapshot files use fixed names and bounded JSON content; credential vaults, update staging, and managed-update metadata are deliberately outside the snapshot allowlist.

## Failure modes

An absent or unreadable local repository yields an honest empty version list. Malformed or truncated Activity log lines are ignored individually so one damaged append cannot hide the remaining records; an oversized log still fails closed with a bounded error. Unknown, malformed, unreachable, incomplete, oversized, or invalid-JSON revisions fail closed and leave state unchanged. If Git cannot preserve the current state or commit the restore, the app reports the failure; it never claims a restore that was not recorded. Label failures likewise leave the prior label and commits intact, and later snapshots retain existing label metadata.

## Security considerations

Revision identifiers accept only full 40-hex Git commit IDs and are resolved with `shell: false` against the fixed local repository. Git reads and mutations are bounded, network access is disabled by `GIT_CONFIG_NOSYSTEM`/`GIT_CONFIG_NOGLOBAL`, and user/system hooks are disabled for the history repository. Only the seven fixed non-secret state files can be staged or restored; the separate labels metadata is retained for revision display and is never restored as live application state. Labels are length- and newline-bounded before being written to a JSON metadata file. The renderer cannot submit paths, refs, commands, or remote URLs.

## Verification

Focused contract tests assert the typed revision bridge, bounded revision/diff limits, complete non-secret snapshot-file allowlist, credential/staging exclusions, full-ID validation, append-only label commits, before-and-after restore snapshots, coordinated reload callbacks for every restored live surface, and the Activity page's date/action/search filters plus diff/label/restore controls. The current packaged Activity screenshot predates this version browser, so it is not claimed as visual proof for the new controls until a fresh sanctioned hidden-desktop capture is available.

## Suggested articles

- [Activity history and export](activity-history.md)
- [Installed app discovery](installed-app-discovery.md)
- [Privacy and security](../security/privacy-and-security.md)
