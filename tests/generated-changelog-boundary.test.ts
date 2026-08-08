import { describe, expect, it } from 'vitest';
import {
  GENERATED_CHANGELOG_ENTRIES,
  GENERATED_CHANGELOG_SCHEMA_VERSION,
  GENERATED_RELEASE_MANIFEST,
} from '../src/renderer/generated-changelog';

describe('committed changelog fallback boundary', () => {
  it('keeps the exact four-field consumer rows and published-only fallback details', () => {
    expect(GENERATED_CHANGELOG_SCHEMA_VERSION).toBe(1);
    expect(GENERATED_CHANGELOG_ENTRIES.length).toBeGreaterThan(0);
    for (const entry of GENERATED_CHANGELOG_ENTRIES) {
      expect(Object.keys(entry)).toEqual(['version', 'releasedAt', 'commit', 'changes']);
      expect(entry.commit).toMatch(/^[0-9a-f]{40}$/);
      expect(entry.changes.length).toBeGreaterThan(0);
    }
    expect(GENERATED_RELEASE_MANIFEST.schemaVersion).toBe(1);
    expect(GENERATED_RELEASE_MANIFEST.entries).toHaveLength(GENERATED_CHANGELOG_ENTRIES.length);
    expect(GENERATED_RELEASE_MANIFEST.entries.every((entry) => entry.publicationState === 'published')).toBe(true);
  });
});
