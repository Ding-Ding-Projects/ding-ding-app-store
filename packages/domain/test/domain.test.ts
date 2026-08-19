import { describe, expect, it } from "vitest";

import {
  AppIdSchema,
  ArtifactIdSchema,
  CatalogAppSchema,
  InstalledAppStateSchema,
  IsoTimestampSchema,
  JobCancellationReasonSchema,
  JobFailureCodeSchema,
  JobIdSchema,
  SemVerStringSchema,
} from "@ding-ding/catalog-contract";

import {
  ChannelMismatchError,
  InvalidJobTransitionError,
  JobInvariantError,
  UpdateDescriptorError,
  compareChannelVersion,
  compareSemVer,
  createInstallJob,
  createUpdateDescriptor,
  createUninstallJob,
  createUpdateJob,
  selectUpdateDescriptor,
  transitionInstallJob,
  transitionUninstallJob,
  transitionUpdateJob,
} from "../src/index.js";

const at = IsoTimestampSchema.parse("2026-08-07T12:00:00.000Z");
const later = IsoTimestampSchema.parse("2026-08-07T12:01:00.000Z");
const appId = AppIdSchema.parse("har-gow");
const jobId = JobIdSchema.parse("job.har-gow");
const artifactId = ArtifactIdSchema.parse("har-gow.1-1-0.windows-x64");
const installedArtifactId = ArtifactIdSchema.parse("har-gow.1-0-0.windows-x64");
const version = SemVerStringSchema.parse("1.0.0");
const sha = "b".repeat(64);

const installed = InstalledAppStateSchema.parse({
  installationId: "installation.har-gow",
  appId,
  version,
  channel: "stable",
  platform: "windows",
  architecture: "x64",
  artifactId: installedArtifactId,
  artifactSha256: "a".repeat(64),
  installedAt: at,
  updatedAt: at,
  updatePolicy: "notify",
});

const updatedInstalled = InstalledAppStateSchema.parse({
  ...installed,
  version: "1.1.0",
  artifactId,
  artifactSha256: sha,
  updatedAt: later,
});

describe("semantic version ordering", () => {
  it.each([
    ["1.0.0-alpha", "1.0.0-alpha.1"],
    ["1.0.0-alpha.1", "1.0.0-alpha.beta"],
    ["1.0.0-alpha.beta", "1.0.0-beta"],
    ["1.0.0-beta", "1.0.0-beta.2"],
    ["1.0.0-beta.2", "1.0.0-beta.11"],
    ["1.0.0-beta.11", "1.0.0-rc.1"],
    ["1.0.0-rc.1", "1.0.0"],
  ])("orders %s before %s", (left, right) => {
    expect(compareSemVer(left, right)).toBeLessThan(0);
    expect(compareSemVer(right, left)).toBeGreaterThan(0);
  });

  it("ignores build metadata for precedence", () => {
    expect(compareSemVer("1.2.3+build.1", "1.2.3+build.99")).toBe(0);
  });

  it("orders numeric identifiers without losing precision", () => {
    expect(
      compareSemVer(
        "999999999999999999999999999999.0.0",
        "1000000000000000000000000000000.0.0",
      ),
    ).toBeLessThan(0);
    expect(
      compareSemVer(
        "1.0.0-alpha.999999999999999999999999999999",
        "1.0.0-alpha.1000000000000000000000000000000",
      ),
    ).toBeLessThan(0);
  });

  it("uses SemVer ASCII ordering for nonnumeric prerelease identifiers", () => {
    expect(compareSemVer("1.0.0-BETA", "1.0.0-alpha")).toBeLessThan(0);
  });

  it("refuses to compare versions from different release channels", () => {
    expect(() =>
      compareChannelVersion(
        { channel: "stable", version: SemVerStringSchema.parse("2.0.0") },
        { channel: "beta", version: SemVerStringSchema.parse("3.0.0-beta.1") },
      ),
    ).toThrow(ChannelMismatchError);
  });
});

describe("immutable update selection", () => {
  it("selects the highest compatible same-channel artifact", () => {
    const app = CatalogAppSchema.parse({
      id: appId,
      displayName: "Har Gow",
      publisher: "Ding Ding Projects",
      summary: "A useful application.",
      description: "A longer description.",
      iconResourceId: "icons.har-gow",
      categories: ["Utilities"],
      proofStatus: "verified",
      proofTargetId: null,
      releases: [
        {
          version: "2.0.0-beta.1",
          channel: "beta",
          publishedAt: later,
          releaseNotes: "Beta build.",
          artifacts: [
            {
              id: "har-gow.2-0-0-beta-1.windows-x64",
              platform: "windows",
              architecture: "x64",
              kind: "squirrel-windows",
              sha256: sha,
              sizeBytes: 9000,
            },
          ],
        },
        {
          version: "1.1.0",
          channel: "stable",
          publishedAt: later,
          releaseNotes: "Stable update.",
          artifacts: [
            {
              id: artifactId,
              platform: "windows",
              architecture: "x64",
              kind: "squirrel-windows",
              sha256: sha,
              sizeBytes: 8000,
            },
          ],
        },
      ],
    });

    const descriptor = selectUpdateDescriptor(installed, app);
    expect(descriptor?.toVersion).toBe("1.1.0");
    expect(descriptor?.channel).toBe("stable");
    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(Object.keys(descriptor ?? {})).not.toContain("url");
    expect(Object.keys(descriptor ?? {})).not.toContain("command");

    expect(() =>
      createUpdateDescriptor(
        installed,
        CatalogAppSchema.parse({ ...app, id: "other-app" }),
        { version: SemVerStringSchema.parse("1.1.0"), artifactId },
      ),
    ).toThrow(UpdateDescriptorError);
  });
});

describe("job state machines", () => {
  it("completes the install happy path and freezes every state", () => {
    let job = createInstallJob({ jobId, appId, targetVersion: version, at });
    job = transitionInstallJob(job, { type: "START_RESOLUTION", at: later });
    job = transitionInstallJob(job, {
      type: "DOWNLOAD_STARTED",
      artifactId: installedArtifactId,
      bytesTotal: 8000,
      at: later,
    });
    job = transitionInstallJob(job, { type: "DOWNLOAD_PROGRESS", bytesReceived: 8000, at: later });
    job = transitionInstallJob(job, { type: "DOWNLOAD_FINISHED", at: later });
    job = transitionInstallJob(job, { type: "VERIFIED", at: later });
    job = transitionInstallJob(job, { type: "INSTALLED", installedApp: installed, at: later });

    expect(job.status).toBe("completed");
    expect(Object.isFrozen(job)).toBe(true);
  });

  it("runs update through staged restart and completion", () => {
    let job = createUpdateJob({
      jobId,
      appId,
      targetVersion: SemVerStringSchema.parse("1.1.0"),
      at,
    });
    job = transitionUpdateJob(job, { type: "START_RESOLUTION", at: later });
    job = transitionUpdateJob(job, { type: "DOWNLOAD_STARTED", artifactId, bytesTotal: 8000, at: later });
    job = transitionUpdateJob(job, { type: "DOWNLOAD_PROGRESS", bytesReceived: 8000, at: later });
    job = transitionUpdateJob(job, { type: "DOWNLOAD_FINISHED", at: later });
    job = transitionUpdateJob(job, { type: "VERIFIED", at: later });
    job = transitionUpdateJob(job, { type: "STAGED", at: later });
    expect(job.status).toBe("awaiting-restart");
    job = transitionUpdateJob(job, { type: "APPLY", at: later });
    job = transitionUpdateJob(job, { type: "UPDATED", installedApp: updatedInstalled, at: later });
    expect(job.status).toBe("completed");
  });

  it("makes uninstall irreversible after removal begins", () => {
    let job = createUninstallJob({ jobId, appId, at });
    job = transitionUninstallJob(job, { type: "PREPARE", at: later });
    job = transitionUninstallJob(job, { type: "BEGIN_REMOVE", at: later });

    expect(() =>
      transitionUninstallJob(job, {
        type: "CANCEL",
        reason: JobCancellationReasonSchema.parse("user-requested"),
        at: later,
      }),
    ).toThrow(InvalidJobTransitionError);

    job = transitionUninstallJob(job, { type: "REMOVED", at: later });
    expect(job.status).toBe("completed");
  });

  it("reports a bounded failure even after an irreversible phase begins", () => {
    let job = createUninstallJob({ jobId, appId, at });
    job = transitionUninstallJob(job, { type: "PREPARE", at: later });
    job = transitionUninstallJob(job, { type: "BEGIN_REMOVE", at: later });
    job = transitionUninstallJob(job, {
      type: "FAIL",
      code: JobFailureCodeSchema.parse("uninstaller-failed"),
      retryable: false,
      at: later,
    });

    expect(job).toMatchObject({ status: "failed", code: "uninstaller-failed", retryable: false });
  });

  it("blocks download completion until every byte is received", () => {
    let job = createInstallJob({ jobId, appId, targetVersion: version, at });
    job = transitionInstallJob(job, { type: "START_RESOLUTION", at: later });
    job = transitionInstallJob(job, {
      type: "DOWNLOAD_STARTED",
      artifactId: installedArtifactId,
      bytesTotal: 8000,
      at: later,
    });
    job = transitionInstallJob(job, {
      type: "DOWNLOAD_PROGRESS",
      bytesReceived: 7999,
      at: later,
    });

    expect(() => transitionInstallJob(job, { type: "DOWNLOAD_FINISHED", at: later })).toThrow(
      JobInvariantError,
    );
  });

  it("blocks regressing progress and timestamps", () => {
    let job = createInstallJob({ jobId, appId, targetVersion: version, at });
    job = transitionInstallJob(job, { type: "START_RESOLUTION", at: later });
    job = transitionInstallJob(job, {
      type: "DOWNLOAD_STARTED",
      artifactId: installedArtifactId,
      bytesTotal: 8000,
      at: later,
    });
    job = transitionInstallJob(job, {
      type: "DOWNLOAD_PROGRESS",
      bytesReceived: 4000,
      at: later,
    });

    expect(() =>
      transitionInstallJob(job, {
        type: "DOWNLOAD_PROGRESS",
        bytesReceived: 3999,
        at: later,
      }),
    ).toThrow(JobInvariantError);
    expect(() =>
      transitionInstallJob(job, {
        type: "DOWNLOAD_PROGRESS",
        bytesReceived: 4001,
        at,
      }),
    ).toThrow(JobInvariantError);
  });

  it("blocks completion with installed state from the wrong target", () => {
    let job = createInstallJob({ jobId, appId, targetVersion: version, at });
    job = transitionInstallJob(job, { type: "START_RESOLUTION", at: later });
    job = transitionInstallJob(job, {
      type: "DOWNLOAD_STARTED",
      artifactId: installedArtifactId,
      bytesTotal: 8000,
      at: later,
    });
    job = transitionInstallJob(job, {
      type: "DOWNLOAD_PROGRESS",
      bytesReceived: 8000,
      at: later,
    });
    job = transitionInstallJob(job, { type: "DOWNLOAD_FINISHED", at: later });
    job = transitionInstallJob(job, { type: "VERIFIED", at: later });
    const wrongApp = InstalledAppStateSchema.parse({ ...installed, appId: "char-siu-bao" });

    expect(() =>
      transitionInstallJob(job, { type: "INSTALLED", installedApp: wrongApp, at: later }),
    ).toThrow(JobInvariantError);
  });

  it("exposes bounded failure codes instead of raw commands or URLs", () => {
    const job = createInstallJob({ jobId, appId, targetVersion: version, at });
    const failed = transitionInstallJob(job, {
      type: "FAIL",
      code: JobFailureCodeSchema.parse("network-unavailable"),
      retryable: true,
      at: later,
    });

    expect(failed).toMatchObject({ status: "failed", code: "network-unavailable", retryable: true });
    expect(Object.keys(failed)).not.toContain("message");
    expect(Object.keys(failed)).not.toContain("url");
    expect(Object.keys(failed)).not.toContain("command");
  });
});
