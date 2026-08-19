import { z } from "zod";

import {
  AppIdSchema,
  ArtifactIdSchema,
  CatalogRevisionSchema,
  DescriptionTextSchema,
  DisplayTextSchema,
  IsoTimestampSchema,
  ResourceIdSchema,
  SemVerStringSchema,
  Sha256Schema,
  SummaryTextSchema,
} from "./primitives.js";

export const ReleaseChannelSchema = z.enum(["stable", "beta", "nightly"]);
export const PlatformSchema = z.enum(["windows", "macos", "linux"]);
export const ArchitectureSchema = z.enum(["x64", "arm64"]);
export const ArtifactKindSchema = z.enum([
  "squirrel-windows",
  "dmg",
  "pkg",
  "appimage",
  "deb",
  "rpm",
]);

export const CatalogArtifactSchema = z
  .object({
    id: ArtifactIdSchema,
    platform: PlatformSchema,
    architecture: ArchitectureSchema,
    kind: ArtifactKindSchema,
    sha256: Sha256Schema,
    sizeBytes: z.number().int().positive().safe(),
  })
  .strict()
  .readonly();

export const CatalogReleaseSchema = z
  .object({
    version: SemVerStringSchema,
    channel: ReleaseChannelSchema,
    publishedAt: IsoTimestampSchema,
    releaseNotes: DescriptionTextSchema,
    artifacts: z.array(CatalogArtifactSchema).min(1).readonly(),
  })
  .strict()
  .readonly();

export const CatalogProofStatusSchema = z.enum(["not-required", "blocked-until-proof", "verified"]);

export const CatalogAppSchema = z
  .object({
    id: AppIdSchema,
    displayName: DisplayTextSchema,
    publisher: DisplayTextSchema,
    summary: SummaryTextSchema,
    description: DescriptionTextSchema,
    iconResourceId: ResourceIdSchema,
    categories: z.array(DisplayTextSchema).min(1).max(20).readonly(),
    proofStatus: CatalogProofStatusSchema,
    proofTargetId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,127}$/).nullable(),
    releases: z.array(CatalogReleaseSchema).min(1).readonly(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.proofStatus === "blocked-until-proof" && value.proofTargetId === null) {
      context.addIssue({ code: "custom", path: ["proofTargetId"], message: "Blocked catalog apps must name their proof target." });
    }
    if (value.proofStatus !== "blocked-until-proof" && value.proofTargetId !== null) {
      context.addIssue({ code: "custom", path: ["proofTargetId"], message: "Only blocked catalog apps may name a proof target." });
    }
  })
  .readonly();

export const PublicCatalogSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: CatalogRevisionSchema,
    generatedAt: IsoTimestampSchema,
    apps: z.array(CatalogAppSchema).readonly(),
  })
  .strict()
  .readonly();

export type Architecture = z.infer<typeof ArchitectureSchema>;
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;
export type CatalogApp = z.infer<typeof CatalogAppSchema>;
export type CatalogArtifact = z.infer<typeof CatalogArtifactSchema>;
export type CatalogRelease = z.infer<typeof CatalogReleaseSchema>;
export type CatalogProofStatus = z.infer<typeof CatalogProofStatusSchema>;
export type Platform = z.infer<typeof PlatformSchema>;
export type PublicCatalog = z.infer<typeof PublicCatalogSchema>;
export type ReleaseChannel = z.infer<typeof ReleaseChannelSchema>;
