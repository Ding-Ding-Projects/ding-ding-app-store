import { z } from "zod";

import {
  AppIdSchema,
  ArtifactIdSchema,
  IsoTimestampSchema,
  SemVerStringSchema,
  Sha256Schema,
} from "./primitives.js";
import { ArchitectureSchema, PlatformSchema, ReleaseChannelSchema } from "./catalog.js";

export const UpdateDescriptorSchema = z
  .object({
    appId: AppIdSchema,
    channel: ReleaseChannelSchema,
    fromVersion: SemVerStringSchema,
    toVersion: SemVerStringSchema,
    platform: PlatformSchema,
    architecture: ArchitectureSchema,
    artifactId: ArtifactIdSchema,
    artifactSha256: Sha256Schema,
    artifactSizeBytes: z.number().int().positive().safe(),
    publishedAt: IsoTimestampSchema,
  })
  .strict()
  .readonly();

export type UpdateDescriptor = z.infer<typeof UpdateDescriptorSchema>;
