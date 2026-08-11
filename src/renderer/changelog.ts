import { GENERATED_CHANGELOG_ENTRIES } from './generated-changelog';
import { schoolModeDocumentText } from '../shared/school-mode';

export interface ChangelogEntry {
  version: string;
  releasedAt: string;
  commit: string;
  changes: readonly string[];
}

/** Build-time data boundary. Release automation may replace the generated module before Vite runs. */
export const CHANGELOG_ENTRIES: readonly ChangelogEntry[] = Object.freeze(GENERATED_CHANGELOG_ENTRIES.map((entry) => Object.freeze({ ...entry, changes: Object.freeze([...entry.changes]) })));

/**
 * Project release notes at the renderer boundary while the shared mode is
 * restricted. Version, date, and commit facts remain intact; only hidden
 * capability lines are omitted and the current chosen mode name is applied.
 * The same projected records feed search, rendering, copy, and export.
 */
export function projectChangelogEntries(
  entries: readonly ChangelogEntry[],
  restricted: boolean,
  displayName: string,
): readonly ChangelogEntry[] {
  if (!restricted) return entries;
  return entries.flatMap((entry) => {
    const changes = entry.changes
      .filter((change) => !/\b(?:language(?: mode)?|funny(?: level)?|voice|narrator)\b|粵語|幽默|旁白|dim[ -]?sum|personal[ -]?vocab/i.test(change))
      .map((change) => schoolModeDocumentText(change, displayName).trim())
      .filter(Boolean);
    return changes.length ? [{ ...entry, changes: Object.freeze(changes) }] : [];
  });
}

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
