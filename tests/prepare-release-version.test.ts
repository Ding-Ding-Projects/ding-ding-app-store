import { describe, expect, it } from 'vitest';
import semver from 'semver';
import { releaseVersion } from '../scripts/prepare-release-version.mjs';

describe('release package-version contract', () => {
  it('derives a unique, newer stable semver that Squirrel and the RELEASES parser share', () => {
    const version = releaseVersion('0.1.0', '42', '1');
    expect(version).toBe('0.1.42');
    expect(semver.gt(version, '0.1.0')).toBe(true);
  });

  it('rejects pre-release bases and non-positive GitHub counters', () => {
    expect(() => releaseVersion('0.1.0-beta.1', '42', '1')).toThrow(/stable semantic/i);
    expect(() => releaseVersion('0.1.0', '0', '1')).toThrow(/positive integers/i);
  });

  it('keeps reruns idempotent and later workflow runs semver-monotonic', () => {
    expect(releaseVersion('0.1.0', '42', '1001')).toBe(releaseVersion('0.1.0', '42', '1'));
    expect(semver.gt(releaseVersion('0.1.0', '43', '1'), releaseVersion('0.1.0', '42', '1001'))).toBe(true);
  });
});
