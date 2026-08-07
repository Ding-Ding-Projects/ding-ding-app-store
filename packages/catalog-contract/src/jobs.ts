import { z } from "zod";

import {
  AppIdSchema,
  ArtifactIdSchema,
  IsoTimestampSchema,
  JobIdSchema,
  SemVerStringSchema,
} from "./primitives.js";
import { InstalledAppStateSchema } from "./installed-app.js";

export const JobFailureCodeSchema = z.enum([
  "catalog-unavailable",
  "artifact-unavailable",
  "network-unavailable",
  "integrity-check-failed",
  "insufficient-space",
  "permission-denied",
  "installer-failed",
  "uninstaller-failed",
  "internal-error",
]);

export const JobCancellationReasonSchema = z.enum([
  "user-requested",
  "superseded",
  "application-shutdown",
]);

const baseShape = {
  jobId: JobIdSchema,
  appId: AppIdSchema,
  createdAt: IsoTimestampSchema,
  updatedAt: IsoTimestampSchema,
} as const;

const transferBaseShape = {
  ...baseShape,
  targetVersion: SemVerStringSchema,
} as const;

const downloadShape = {
  artifactId: ArtifactIdSchema,
  bytesReceived: z.number().int().nonnegative().safe(),
  bytesTotal: z.number().int().positive().safe(),
} as const;

const downloadState = <T extends "install" | "update">(operation: T) =>
  z
    .object({
      ...transferBaseShape,
      operation: z.literal(operation),
      status: z.literal("downloading"),
      ...downloadShape,
    })
    .strict()
    .refine((value) => value.bytesReceived <= value.bytesTotal, {
      message: "bytesReceived cannot exceed bytesTotal",
      path: ["bytesReceived"],
    })
    .readonly();

const failedState = <T extends "install" | "update" | "uninstall">(operation: T) =>
  z
    .object({
      ...baseShape,
      operation: z.literal(operation),
      status: z.literal("failed"),
      code: JobFailureCodeSchema,
      retryable: z.boolean(),
    })
    .strict()
    .readonly();

const cancelledState = <T extends "install" | "update" | "uninstall">(operation: T) =>
  z
    .object({
      ...baseShape,
      operation: z.literal(operation),
      status: z.literal("cancelled"),
      reason: JobCancellationReasonSchema,
    })
    .strict()
    .readonly();

const simpleState = <
  TOperation extends "install" | "update" | "uninstall",
  TStatus extends string,
>(
  operation: TOperation,
  status: TStatus,
) =>
  z
    .object({ ...baseShape, operation: z.literal(operation), status: z.literal(status) })
    .strict()
    .readonly();

const transferState = <
  TOperation extends "install" | "update",
  TStatus extends string,
>(
  operation: TOperation,
  status: TStatus,
) =>
  z
    .object({
      ...transferBaseShape,
      operation: z.literal(operation),
      status: z.literal(status),
    })
    .strict()
    .readonly();

const artifactTransferState = <
  TOperation extends "install" | "update",
  TStatus extends string,
>(
  operation: TOperation,
  status: TStatus,
) =>
  z
    .object({
      ...transferBaseShape,
      operation: z.literal(operation),
      status: z.literal(status),
      artifactId: ArtifactIdSchema,
    })
    .strict()
    .readonly();

export const InstallJobSchema = z.discriminatedUnion("status", [
  z
    .object({
      ...transferBaseShape,
      operation: z.literal("install"),
      status: z.literal("queued"),
    })
    .strict()
    .readonly(),
  transferState("install", "resolving"),
  downloadState("install"),
  artifactTransferState("install", "verifying"),
  artifactTransferState("install", "installing"),
  z
    .object({
      ...transferBaseShape,
      operation: z.literal("install"),
      status: z.literal("completed"),
      artifactId: ArtifactIdSchema,
      installedApp: InstalledAppStateSchema,
    })
    .strict()
    .superRefine((value, context) => {
      if (
        value.installedApp.appId !== value.appId ||
        value.installedApp.version !== value.targetVersion ||
        value.installedApp.artifactId !== value.artifactId
      ) {
        context.addIssue({
          code: "custom",
          path: ["installedApp"],
          message: "Completed installed-app identity must match the install job target",
        });
      }
    })
    .readonly(),
  failedState("install"),
  cancelledState("install"),
]);

export const UpdateJobSchema = z.discriminatedUnion("status", [
  z
    .object({
      ...transferBaseShape,
      operation: z.literal("update"),
      status: z.literal("queued"),
    })
    .strict()
    .readonly(),
  transferState("update", "resolving"),
  downloadState("update"),
  artifactTransferState("update", "verifying"),
  artifactTransferState("update", "staging"),
  artifactTransferState("update", "awaiting-restart"),
  artifactTransferState("update", "applying"),
  z
    .object({
      ...transferBaseShape,
      operation: z.literal("update"),
      status: z.literal("completed"),
      artifactId: ArtifactIdSchema,
      installedApp: InstalledAppStateSchema,
    })
    .strict()
    .superRefine((value, context) => {
      if (
        value.installedApp.appId !== value.appId ||
        value.installedApp.version !== value.targetVersion ||
        value.installedApp.artifactId !== value.artifactId
      ) {
        context.addIssue({
          code: "custom",
          path: ["installedApp"],
          message: "Completed installed-app identity must match the update job target",
        });
      }
    })
    .readonly(),
  failedState("update"),
  cancelledState("update"),
]);

export const UninstallJobSchema = z.discriminatedUnion("status", [
  simpleState("uninstall", "queued"),
  simpleState("uninstall", "preparing"),
  simpleState("uninstall", "removing"),
  z
    .object({
      ...baseShape,
      operation: z.literal("uninstall"),
      status: z.literal("completed"),
      removedAt: IsoTimestampSchema,
    })
    .strict()
    .readonly(),
  failedState("uninstall"),
  cancelledState("uninstall"),
]);

export const AppJobSchema = z.union([InstallJobSchema, UpdateJobSchema, UninstallJobSchema]);

export type AppJob = z.infer<typeof AppJobSchema>;
export type InstallJob = z.infer<typeof InstallJobSchema>;
export type JobCancellationReason = z.infer<typeof JobCancellationReasonSchema>;
export type JobFailureCode = z.infer<typeof JobFailureCodeSchema>;
export type UninstallJob = z.infer<typeof UninstallJobSchema>;
export type UpdateJob = z.infer<typeof UpdateJobSchema>;
