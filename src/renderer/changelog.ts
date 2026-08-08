import { GENERATED_CHANGELOG_ENTRIES } from './generated-changelog';

export interface ChangelogEntry {
  version: string;
  releasedAt: string;
  commit: string;
  changes: readonly string[];
}

/** Build-time data boundary. Release automation may replace the generated module before Vite runs. */
export const CHANGELOG_ENTRIES: readonly ChangelogEntry[] = Object.freeze(GENERATED_CHANGELOG_ENTRIES.map((entry) => Object.freeze({ ...entry, changes: Object.freeze([...entry.changes]) })));

export function validateChangelog(entries: readonly ChangelogEntry[]): string[] {
  const issues: string[] = [];
  const versions = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    if (!/^v\d+\.\d+\.\d+(?:-\d+)+$/.test(entry.version)) issues.push(`Entry ${index + 1} has an invalid version.`);
    if (versions.has(entry.version)) issues.push(`Version ${entry.version} is duplicated.`);
    versions.add(entry.version);
    if (!/^[0-9a-f]{40}$/.test(entry.commit)) issues.push(`${entry.version} is missing a full commit SHA.`);
    if (!Number.isFinite(Date.parse(entry.releasedAt))) issues.push(`${entry.version} has an invalid release date.`);
    if (!entry.changes.length || entry.changes.some((change) => !change.trim())) issues.push(`${entry.version} has no factual change entry.`);
  }
  return issues;
}

/** Render an export with the current display name without changing product identity. */
export function changelogMarkdown(entries: readonly ChangelogEntry[], displayName = 'Ding Ding App Store'): string {
  return [
    `# ${displayName} changelog`,
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
