import { z } from "zod";

import {
  AppIdSchema,
  ArtifactIdSchema,
  InstallationIdSchema,
  IsoTimestampSchema,
  SemVerStringSchema,
  Sha256Schema,
} from "./primitives.js";
import { ArchitectureSchema, PlatformSchema, ReleaseChannelSchema } from "./catalog.js";

export const UpdatePolicySchema = z.enum(["automatic", "notify", "manual"]);

export const InstalledAppStateSchema = z
  .object({
    installationId: InstallationIdSchema,
    appId: AppIdSchema,
    version: SemVerStringSchema,
    channel: ReleaseChannelSchema,
    platform: PlatformSchema,
    architecture: ArchitectureSchema,
    artifactId: ArtifactIdSchema,
    artifactSha256: Sha256Schema,
    installedAt: IsoTimestampSchema,
    updatedAt: IsoTimestampSchema,
    updatePolicy: UpdatePolicySchema,
  })
  .strict()
  .readonly();

export type InstalledAppState = z.infer<typeof InstalledAppStateSchema>;
export type UpdatePolicy = z.infer<typeof UpdatePolicySchema>;
