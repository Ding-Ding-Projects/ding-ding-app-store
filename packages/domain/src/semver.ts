import {
  SEMVER_PATTERN,
  SemVerStringSchema,
  type ReleaseChannel,
  type SemVerString,
} from "@ding-ding/catalog-contract";

export interface ParsedSemVer {
  readonly major: bigint;
  readonly minor: bigint;
  readonly patch: bigint;
  readonly prerelease: readonly string[];
  readonly build: readonly string[];
}

export class ChannelMismatchError extends Error {
  public constructor(
    public readonly left: ReleaseChannel,
    public readonly right: ReleaseChannel,
  ) {
    super(`Cannot compare release channels ${left} and ${right}`);
    this.name = "ChannelMismatchError";
  }
}

export function parseSemVer(version: SemVerString | string): ParsedSemVer {
  const validated = SemVerStringSchema.parse(version);
  const match = SEMVER_PATTERN.exec(validated);
  if (!match) {
    throw new TypeError(`Invalid semantic version: ${version}`);
  }

  const major = match[1];
  const minor = match[2];
  const patch = match[3];
  if (major === undefined || minor === undefined || patch === undefined) {
    throw new TypeError(`Semantic version parser invariant failed: ${version}`);
  }

  const parsed: ParsedSemVer = {
    major: BigInt(major),
    minor: BigInt(minor),
    patch: BigInt(patch),
    prerelease: Object.freeze(match[4]?.split(".") ?? []),
    build: Object.freeze(match[5]?.split(".") ?? []),
  };

  return Object.freeze(parsed);
}

function compareIdentifier(left: string, right: string): number {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) {
    if (left.length !== right.length) return left.length < right.length ? -1 : 1;
    return left === right ? 0 : left < right ? -1 : 1;
  }
  if (leftNumeric !== rightNumeric) {
    return leftNumeric ? -1 : 1;
  }
  return left === right ? 0 : left < right ? -1 : 1;
}

export function compareSemVer(left: SemVerString | string, right: SemVerString | string): number {
  const a = parseSemVer(left);
  const b = parseSemVer(right);

  for (const key of ["major", "minor", "patch"] as const) {
    if (a[key] !== b[key]) {
      return a[key] < b[key] ? -1 : 1;
    }
  }

  if (a.prerelease.length === 0 || b.prerelease.length === 0) {
    if (a.prerelease.length === b.prerelease.length) return 0;
    return a.prerelease.length === 0 ? 1 : -1;
  }

  const count = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < count; index += 1) {
    const aPart = a.prerelease[index];
    const bPart = b.prerelease[index];
    if (aPart === undefined || bPart === undefined) {
      return aPart === undefined ? -1 : 1;
    }
    const comparison = compareIdentifier(aPart, bPart);
    if (comparison !== 0) return comparison;
  }

  return 0;
}

export function compareChannelVersion(
  left: Readonly<{ channel: ReleaseChannel; version: SemVerString }>,
  right: Readonly<{ channel: ReleaseChannel; version: SemVerString }>,
): number {
  if (left.channel !== right.channel) {
    throw new ChannelMismatchError(left.channel, right.channel);
  }
  return compareSemVer(left.version, right.version);
}
