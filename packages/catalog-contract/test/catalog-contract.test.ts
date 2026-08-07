import { describe, expect, it } from "vitest";

import {
  AppJobSchema,
  InstalledAppStateSchema,
  PublicCatalogSchema,
  SemVerStringSchema,
  UpdateDescriptorSchema,
} from "../src/index.js";

const sha = "a".repeat(64);
const now = "2026-08-07T12:00:00.000Z";

const installed = {
  installationId: "installation.har-gow",
  appId: "har-gow",
  version: "1.2.3",
  channel: "stable",
  platform: "windows",
  architecture: "x64",
  artifactId: "har-gow.1-2-3.windows-x64",
  artifactSha256: sha,
  installedAt: now,
  updatedAt: now,
  updatePolicy: "notify",
} as const;

describe("public catalog contract", () => {
  it("parses a renderer-safe catalog and freezes parsed records", () => {
    const catalog = PublicCatalogSchema.parse({
      schemaVersion: 1,
      revision: "catalog.2026-08-07",
      generatedAt: now,
      apps: [
        {
          id: "har-gow",
          displayName: "Har Gow",
          publisher: "Ding Ding Projects",
          summary: "A useful application.",
          description: "A longer factual description.",
          iconResourceId: "icons.har-gow",
          categories: ["Utilities"],
          releases: [
            {
              version: "1.2.3",
              channel: "stable",
              publishedAt: now,
              releaseNotes: "Initial public build.",
              artifacts: [
                {
                  id: "har-gow.1-2-3.windows-x64",
                  platform: "windows",
                  architecture: "x64",
                  kind: "squirrel-windows",
                  sha256: sha,
                  sizeBytes: 4096,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(Object.isFrozen(catalog)).toBe(true);
    expect(catalog.apps[0]?.id).toBe("har-gow");
  });

  it("rejects unknown fields so commands and URLs cannot hitchhike into renderer data", () => {
    const parsed = PublicCatalogSchema.safeParse({
      schemaVersion: 1,
      revision: "catalog.2026-08-07",
      generatedAt: now,
      apps: [],
      downloadUrl: "https://example.invalid/payload",
      installCommand: "run-anything --please",
    });

    expect(parsed.success).toBe(false);
  });

  it.each(["1.2", "01.2.3", "1.2.3-01", "v1.2.3", "1.2.3.4"])(
    "rejects invalid semantic version %s",
    (version) => {
      expect(SemVerStringSchema.safeParse(version).success).toBe(false);
    },
  );
});

describe("installed and job contracts", () => {
  it("rejects unrecognized installed-app properties", () => {
    expect(
      InstalledAppStateSchema.safeParse({
        ...installed,
        launchCommand: "totally-not-renderer-safe",
      }).success,
    ).toBe(false);
  });

  it("validates bounded download progress", () => {
    expect(
      AppJobSchema.safeParse({
        jobId: "job.install-har-gow",
        appId: "har-gow",
        operation: "install",
        status: "downloading",
        createdAt: now,
        updatedAt: now,
        artifactId: "har-gow.1-2-3.windows-x64",
        bytesReceived: 5000,
        bytesTotal: 4096,
      }).success,
    ).toBe(false);
  });

  it("rejects a deserialized completed job whose installed identity does not match", () => {
    expect(
      AppJobSchema.safeParse({
        jobId: "job.install-har-gow",
        appId: "har-gow",
        operation: "install",
        status: "completed",
        targetVersion: "1.2.3",
        artifactId: "har-gow.1-2-3.windows-x64",
        createdAt: now,
        updatedAt: now,
        installedApp: {
          ...installed,
          appId: "char-siu-bao",
        },
      }).success,
    ).toBe(false);
  });

  it("accepts immutable update descriptors containing only opaque artifact identity", () => {
    const descriptor = UpdateDescriptorSchema.parse({
      appId: "har-gow",
      channel: "stable",
      fromVersion: "1.2.3",
      toVersion: "1.3.0",
      platform: "windows",
      architecture: "x64",
      artifactId: "har-gow.1-3-0.windows-x64",
      artifactSha256: sha,
      artifactSizeBytes: 8192,
      publishedAt: now,
    });

    expect(Object.isFrozen(descriptor)).toBe(true);
    expect(Object.keys(descriptor)).not.toContain("url");
    expect(Object.keys(descriptor)).not.toContain("command");
  });
});
