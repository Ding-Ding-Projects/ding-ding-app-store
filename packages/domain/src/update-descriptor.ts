import {
  UpdateDescriptorSchema,
  type CatalogApp,
  type CatalogArtifact,
  type CatalogRelease,
  type InstalledAppState,
  type UpdateDescriptor,
} from "@ding-ding/catalog-contract";

import { ChannelMismatchError, compareSemVer } from "./semver.js";

export class UpdateDescriptorError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "UpdateDescriptorError";
  }
}

export function createUpdateDescriptor(
  installed: InstalledAppState,
  release: CatalogRelease,
  artifact: CatalogArtifact,
): UpdateDescriptor {
  if (installed.channel !== release.channel) {
    throw new ChannelMismatchError(installed.channel, release.channel);
  }
  if (artifact.platform !== installed.platform || artifact.architecture !== installed.architecture) {
    throw new UpdateDescriptorError("Artifact target does not match the installed application");
  }
  if (!release.artifacts.some((candidate) => candidate.id === artifact.id)) {
    throw new UpdateDescriptorError("Artifact does not belong to the selected release");
  }
  if (compareSemVer(release.version, installed.version) <= 0) {
    throw new UpdateDescriptorError("Selected release is not newer than the installed version");
  }

  return UpdateDescriptorSchema.parse({
    appId: installed.appId,
    channel: installed.channel,
    fromVersion: installed.version,
    toVersion: release.version,
    platform: installed.platform,
    architecture: installed.architecture,
    artifactId: artifact.id,
    artifactSha256: artifact.sha256,
    artifactSizeBytes: artifact.sizeBytes,
    publishedAt: release.publishedAt,
  });
}

export function selectUpdateDescriptor(
  installed: InstalledAppState,
  app: CatalogApp,
): UpdateDescriptor | undefined {
  if (installed.appId !== app.id) {
    throw new UpdateDescriptorError("Catalog app does not match the installed application");
  }

  const candidates = app.releases
    .filter((release) => release.channel === installed.channel)
    .filter((release) => compareSemVer(release.version, installed.version) > 0)
    .map((release) => ({
      release,
      artifact: release.artifacts.find(
        (artifact) =>
          artifact.platform === installed.platform &&
          artifact.architecture === installed.architecture,
      ),
    }))
    .filter(
      (candidate): candidate is { release: CatalogRelease; artifact: CatalogArtifact } =>
        candidate.artifact !== undefined,
    )
    .sort((left, right) => compareSemVer(right.release.version, left.release.version));

  const best = candidates[0];
  return best === undefined
      ? undefined
      : createUpdateDescriptor(installed, best.release, best.artifact);
}
