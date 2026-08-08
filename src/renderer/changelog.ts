export interface ChangelogEntry {
  version: string;
  releasedAt: string;
  commit: string;
  changes: readonly string[];
}

/**
 * Existing published release tags at the 2026-08-07 renderer baseline. Entries intentionally
 * preserve tag gaps and duplicate target commits because those are facts of the release history.
 */
export const CHANGELOG_ENTRIES: readonly ChangelogEntry[] = Object.freeze([
  { version: 'v0.1.0-13', releasedAt: '2026-08-07T18:05:30Z', commit: 'b4a94f3e64ee30d9b72d0c440267d765ebd8b6ee', changes: ['Repaired the documentation-site stylesheet after a corrupted publication.'] },
  { version: 'v0.1.0-9', releasedAt: '2026-08-07T18:05:30Z', commit: 'b4a94f3e64ee30d9b72d0c440267d765ebd8b6ee', changes: ['Repaired the documentation-site stylesheet after a corrupted publication.'] },
  { version: 'v0.1.0-8', releasedAt: '2026-08-07T17:36:15Z', commit: '4b140cdc6397b716ad76f1c7219061855e8dd96f', changes: ['Aligned documentation-site select and range controls with Material Design 3.'] },
  { version: 'v0.1.0-7', releasedAt: '2026-08-07T17:36:15Z', commit: '4b140cdc6397b716ad76f1c7219061855e8dd96f', changes: ['Aligned documentation-site select and range controls with Material Design 3.'] },
  { version: 'v0.1.0-6', releasedAt: '2026-08-07T17:19:01Z', commit: '183ce737b6661d92cc4caae42a123c0e8cebb396', changes: ['Prevented command-palette hints and settings labels from clipping on narrow screens.'] },
  { version: 'v0.1.0-4', releasedAt: '2026-08-07T17:19:01Z', commit: '183ce737b6661d92cc4caae42a123c0e8cebb396', changes: ['Prevented command-palette hints and settings labels from clipping on narrow screens.'] },
  { version: 'v0.1.0-3', releasedAt: '2026-08-07T16:41:47Z', commit: '459f3b9f850c42dd9aca932aef06be5af1aa917a', changes: ['Recorded verified continuous-integration, release, and Pages evidence.'] },
  { version: 'v0.1.0-2', releasedAt: '2026-08-07T16:37:20Z', commit: '468566de96d8fdee150cfaf24b860724ff6526a9', changes: ['Enabled the Pages deployment configuration required by the static site.'] },
  { version: 'v0.1.0-1', releasedAt: '2026-08-07T16:32:11Z', commit: '4ad8430385cf4950b3c386fb35f97f45649fffaa', changes: ['Added local operation history, continuous integration, unsigned Squirrel release packaging, and GitHub Pages.'] },
]);

export function validateChangelog(entries: readonly ChangelogEntry[]): string[] {
  const issues: string[] = [];
  const versions = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (!/^v\d+\.\d+\.\d+-\d+$/.test(entry.version)) issues.push(`Entry ${index + 1} has an invalid version.`);
    if (versions.has(entry.version)) issues.push(`Version ${entry.version} is duplicated.`);
    versions.add(entry.version);
    if (!/^[0-9a-f]{40}$/.test(entry.commit)) issues.push(`${entry.version} is missing a full commit SHA.`);
    if (!Number.isFinite(Date.parse(entry.releasedAt))) issues.push(`${entry.version} has an invalid release date.`);
    if (!entry.changes.length || entry.changes.some((change) => !change.trim())) issues.push(`${entry.version} has no factual change entry.`);
  }
  return issues;
}

export function changelogMarkdown(entries: readonly ChangelogEntry[]): string {
  return [
    '# Ding Ding App Store changelog',
    '',
    ...entries.flatMap((entry) => [
      `## ${entry.version} — ${entry.releasedAt.slice(0, 10)}`,
      '',
      ...entry.changes.map((change) => `- ${change}`),
      `- Commit: ${entry.commit}`,
      '',
    ]),
  ].join('\n');
}
