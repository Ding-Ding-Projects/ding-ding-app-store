import { z } from "zod";

const OPAQUE_ID_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

export const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

const opaqueId = <T extends string>(name: string) =>
  z
    .string()
    .min(1)
    .max(128)
    .regex(OPAQUE_ID_PATTERN, `${name} must be an opaque lowercase identifier`)
    .brand<T>();

export const AppIdSchema = opaqueId<"AppId">("App id");
export const ArtifactIdSchema = opaqueId<"ArtifactId">("Artifact id");
export const CatalogRevisionSchema = opaqueId<"CatalogRevision">("Catalog revision");
export const InstallationIdSchema = opaqueId<"InstallationId">("Installation id");
export const JobIdSchema = opaqueId<"JobId">("Job id");
export const ResourceIdSchema = opaqueId<"ResourceId">("Resource id");

export const SemVerStringSchema = z
  .string()
  .max(128)
  .regex(SEMVER_PATTERN, "Version must be valid Semantic Versioning 2.0.0")
  .brand<"SemVerString">();

export const IsoTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .brand<"IsoTimestamp">();

export const Sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/, "SHA-256 must be 64 lowercase hexadecimal characters")
  .brand<"Sha256">();

export const DisplayTextSchema = z.string().trim().min(1).max(200);
export const SummaryTextSchema = z.string().trim().min(1).max(500);
export const DescriptionTextSchema = z.string().trim().min(1).max(20_000);

export type AppId = z.infer<typeof AppIdSchema>;
export type ArtifactId = z.infer<typeof ArtifactIdSchema>;
export type CatalogRevision = z.infer<typeof CatalogRevisionSchema>;
export type InstallationId = z.infer<typeof InstallationIdSchema>;
export type IsoTimestamp = z.infer<typeof IsoTimestampSchema>;
export type JobId = z.infer<typeof JobIdSchema>;
export type ResourceId = z.infer<typeof ResourceIdSchema>;
export type SemVerString = z.infer<typeof SemVerStringSchema>;
export type Sha256 = z.infer<typeof Sha256Schema>;
