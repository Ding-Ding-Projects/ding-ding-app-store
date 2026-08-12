import { describe, expect, it } from 'vitest';
import { latestReleaseFromReleases, parseReleases, updateInternals } from '../src/main/update-service';

const full = 'a'.repeat(40);
const delta = 'b'.repeat(40);
const releases = [
  `${full} DingDingAppStore-0.1.0-full.nupkg 1200`,
  `${delta} DingDingAppStore-0.1.0-delta.nupkg 800`,
  `${'c'.repeat(40)} DingDingAppStore-0.2.0-full.nupkg 1400`,
].join('\n');

describe('self-updater RELEASES contract', () => {
  it('validates all rows and chooses the newest full package', () => {
    const rows = parseReleases(releases);
    expect(rows).toHaveLength(3);
    expect(latestReleaseFromReleases(releases)).toMatchObject({
      version: '0.2.0',
      fileName: 'DingDingAppStore-0.2.0-full.nupkg',
      kind: 'full',
      bytes: 1400,
    });
    expect(updateInternals.latestVersionFromReleases(releases)).toBe('0.2.0');
  });

  it('rejects malformed hashes, filenames, sizes, and metadata with no full package', () => {
    expect(() => parseReleases(`not-a-hash DingDingAppStore-0.2.0-full.nupkg 1`)).toThrow(/invalid package hash/i);
    expect(() => parseReleases(`${full} DingDingAppStore-0.2.0.zip 1`)).toThrow(/unsupported package/i);
    expect(() => parseReleases(`${full} DingDingAppStore-0.2.0-full.nupkg 0`)).toThrow(/invalid package size/i);
    expect(() => parseReleases(`${delta} DingDingAppStore-0.2.0-delta.nupkg 1`)).toThrow(/no full package/i);
  });

  it('rejects conflicting duplicate rows instead of guessing which hash wins', () => {
    expect(() => parseReleases([
      `${full} DingDingAppStore-0.2.0-full.nupkg 1`,
      `${'d'.repeat(40)} DingDingAppStore-0.2.0-full.nupkg 2`,
    ].join('\n'))).toThrow(/conflicting integrity/i);
  });

  it('constructs immutable release-note URLs from the validated version', () => {
    expect(updateInternals.releaseNotesUrl('0.2.0')).toBe('https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v0.2.0');
    expect(updateInternals.releaseNotesUrl('0.2.42')).toBe('https://github.com/Ding-Ding-Projects/ding-ding-app-store/releases/tag/v0.2.42');
  });
});
