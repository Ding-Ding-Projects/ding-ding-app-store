import {
  InstallJobSchema,
  UninstallJobSchema,
  UpdateJobSchema,
  type AppId,
  type ArtifactId,
  type InstallJob,
  type InstalledAppState,
  type IsoTimestamp,
  type JobCancellationReason,
  type JobFailureCode,
  type JobId,
  type SemVerString,
  type UninstallJob,
  type UpdateJob,
} from "@ding-ding/catalog-contract";

export class InvalidJobTransitionError extends Error {
  public constructor(
    operation: "install" | "update" | "uninstall",
    status: string,
    event: string,
  ) {
    super(`Cannot apply ${event} to ${operation} job in ${status} state`);
    this.name = "InvalidJobTransitionError";
  }
}

interface EventAt {
  readonly at: IsoTimestamp;
}

interface DownloadStarted extends EventAt {
  readonly type: "DOWNLOAD_STARTED";
  readonly artifactId: ArtifactId;
  readonly bytesTotal: number;
}

interface DownloadProgressed extends EventAt {
  readonly type: "DOWNLOAD_PROGRESS";
  readonly bytesReceived: number;
}

interface Failed extends EventAt {
  readonly type: "FAIL";
  readonly code: JobFailureCode;
  readonly retryable: boolean;
}

interface Cancelled extends EventAt {
  readonly type: "CANCEL";
  readonly reason: JobCancellationReason;
}

export type InstallJobEvent =
  | (EventAt & { readonly type: "START_RESOLUTION" })
  | DownloadStarted
  | DownloadProgressed
  | (EventAt & { readonly type: "DOWNLOAD_FINISHED" })
  | (EventAt & { readonly type: "VERIFIED" })
  | (EventAt & { readonly type: "INSTALLED"; readonly installedApp: InstalledAppState })
  | Failed
  | Cancelled;

export type UpdateJobEvent =
  | (EventAt & { readonly type: "START_RESOLUTION" })
  | DownloadStarted
  | DownloadProgressed
  | (EventAt & { readonly type: "DOWNLOAD_FINISHED" })
  | (EventAt & { readonly type: "VERIFIED" })
  | (EventAt & { readonly type: "STAGED" })
  | (EventAt & { readonly type: "APPLY" })
  | (EventAt & { readonly type: "UPDATED"; readonly installedApp: InstalledAppState })
  | Failed
  | Cancelled;

export type UninstallJobEvent =
  | (EventAt & { readonly type: "PREPARE" })
  | (EventAt & { readonly type: "BEGIN_REMOVE" })
  | (EventAt & { readonly type: "REMOVED" })
  | Failed
  | Cancelled;

export function createInstallJob(input: Readonly<{
  jobId: JobId;
  appId: AppId;
  targetVersion: SemVerString;
  at: IsoTimestamp;
}>): InstallJob {
  return InstallJobSchema.parse({
    jobId: input.jobId,
    appId: input.appId,
    operation: "install",
    status: "queued",
    targetVersion: input.targetVersion,
    createdAt: input.at,
    updatedAt: input.at,
  });
}

export function createUpdateJob(input: Readonly<{
  jobId: JobId;
  appId: AppId;
  targetVersion: SemVerString;
  at: IsoTimestamp;
}>): UpdateJob {
  return UpdateJobSchema.parse({
    jobId: input.jobId,
    appId: input.appId,
    operation: "update",
    status: "queued",
    targetVersion: input.targetVersion,
    createdAt: input.at,
    updatedAt: input.at,
  });
}

export function createUninstallJob(input: Readonly<{
  jobId: JobId;
  appId: AppId;
  at: IsoTimestamp;
}>): UninstallJob {
  return UninstallJobSchema.parse({
    jobId: input.jobId,
    appId: input.appId,
    operation: "uninstall",
    status: "queued",
    createdAt: input.at,
    updatedAt: input.at,
  });
}

function base(job: InstallJob | UpdateJob | UninstallJob, at: IsoTimestamp) {
  return {
    jobId: job.jobId,
    appId: job.appId,
    operation: job.operation,
    createdAt: job.createdAt,
    updatedAt: at,
  } as const;
}

function terminal(job: InstallJob | UpdateJob | UninstallJob): boolean {
  return job.status === "completed" || job.status === "failed" || job.status === "cancelled";
}

function failureOrCancellation(
  job: InstallJob | UpdateJob | UninstallJob,
  event: Failed | Cancelled,
): unknown {
  if (terminal(job)) return undefined;
  if (event.type === "FAIL") {
    return { ...base(job, event.at), status: "failed", code: event.code, retryable: event.retryable };
  }
  return { ...base(job, event.at), status: "cancelled", reason: event.reason };
}

export function transitionInstallJob(job: InstallJob, event: InstallJobEvent): InstallJob {
  if (event.type === "FAIL" || event.type === "CANCEL") {
    const next = failureOrCancellation(job, event);
    if (next !== undefined && (event.type === "FAIL" || job.status !== "installing")) {
      return InstallJobSchema.parse(next);
    }
  } else if (job.status === "queued" && event.type === "START_RESOLUTION") {
    return InstallJobSchema.parse({ ...base(job, event.at), status: "resolving" });
  } else if (job.status === "resolving" && event.type === "DOWNLOAD_STARTED") {
    return InstallJobSchema.parse({
      ...base(job, event.at),
      status: "downloading",
      artifactId: event.artifactId,
      bytesReceived: 0,
      bytesTotal: event.bytesTotal,
    });
  } else if (job.status === "downloading" && event.type === "DOWNLOAD_PROGRESS") {
    return InstallJobSchema.parse({ ...job, updatedAt: event.at, bytesReceived: event.bytesReceived });
  } else if (job.status === "downloading" && event.type === "DOWNLOAD_FINISHED") {
    return InstallJobSchema.parse({ ...base(job, event.at), status: "verifying" });
  } else if (job.status === "verifying" && event.type === "VERIFIED") {
    return InstallJobSchema.parse({ ...base(job, event.at), status: "installing" });
  } else if (job.status === "installing" && event.type === "INSTALLED") {
    return InstallJobSchema.parse({
      ...base(job, event.at),
      status: "completed",
      installedApp: event.installedApp,
    });
  }
  throw new InvalidJobTransitionError("install", job.status, event.type);
}

export function transitionUpdateJob(job: UpdateJob, event: UpdateJobEvent): UpdateJob {
  if (event.type === "FAIL" || event.type === "CANCEL") {
    const next = failureOrCancellation(job, event);
    if (next !== undefined && (event.type === "FAIL" || job.status !== "applying")) {
      return UpdateJobSchema.parse(next);
    }
  } else if (job.status === "queued" && event.type === "START_RESOLUTION") {
    return UpdateJobSchema.parse({ ...base(job, event.at), status: "resolving" });
  } else if (job.status === "resolving" && event.type === "DOWNLOAD_STARTED") {
    return UpdateJobSchema.parse({
      ...base(job, event.at),
      status: "downloading",
      artifactId: event.artifactId,
      bytesReceived: 0,
      bytesTotal: event.bytesTotal,
    });
  } else if (job.status === "downloading" && event.type === "DOWNLOAD_PROGRESS") {
    return UpdateJobSchema.parse({ ...job, updatedAt: event.at, bytesReceived: event.bytesReceived });
  } else if (job.status === "downloading" && event.type === "DOWNLOAD_FINISHED") {
    return UpdateJobSchema.parse({ ...base(job, event.at), status: "verifying" });
  } else if (job.status === "verifying" && event.type === "VERIFIED") {
    return UpdateJobSchema.parse({ ...base(job, event.at), status: "staging" });
  } else if (job.status === "staging" && event.type === "STAGED") {
    return UpdateJobSchema.parse({ ...base(job, event.at), status: "awaiting-restart" });
  } else if (job.status === "awaiting-restart" && event.type === "APPLY") {
    return UpdateJobSchema.parse({ ...base(job, event.at), status: "applying" });
  } else if (job.status === "applying" && event.type === "UPDATED") {
    return UpdateJobSchema.parse({
      ...base(job, event.at),
      status: "completed",
      installedApp: event.installedApp,
    });
  }
  throw new InvalidJobTransitionError("update", job.status, event.type);
}

export function transitionUninstallJob(
  job: UninstallJob,
  event: UninstallJobEvent,
): UninstallJob {
  if (event.type === "FAIL" || event.type === "CANCEL") {
    const next = failureOrCancellation(job, event);
    if (next !== undefined && (event.type === "FAIL" || job.status !== "removing")) {
      return UninstallJobSchema.parse(next);
    }
  } else if (job.status === "queued" && event.type === "PREPARE") {
    return UninstallJobSchema.parse({ ...base(job, event.at), status: "preparing" });
  } else if (job.status === "preparing" && event.type === "BEGIN_REMOVE") {
    return UninstallJobSchema.parse({ ...base(job, event.at), status: "removing" });
  } else if (job.status === "removing" && event.type === "REMOVED") {
    return UninstallJobSchema.parse({
      ...base(job, event.at),
      status: "completed",
      removedAt: event.at,
    });
  }
  throw new InvalidJobTransitionError("uninstall", job.status, event.type);
}
