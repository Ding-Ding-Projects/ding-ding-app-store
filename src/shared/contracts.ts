import { z } from 'zod';

export type LanguageMode = 'en' | 'yue' | 'bilingual';
export type ThemeMode = 'system' | 'light' | 'dark';
export type PackageType = 'squirrel' | 'msi' | 'nsis' | 'inno' | 'jpackage' | 'archive' | 'source' | 'unsupported';
export type Availability = 'installable' | 'source-build' | 'documentation-only' | 'unsupported';

export interface CatalogApp {
  id: string;
  name: string;
  repository: string;
  description: string;
  homepageUrl: string | null;
  repositoryUrl: string;
  defaultBranch: string;
  topics: string[];
  stars: number;
  updatedAt: string;
  latestVersion: string | null;
  latestReleaseUrl: string | null;
  availability: Availability;
  packageType: PackageType;
  installedVersion: string | null;
  updateState: 'unknown' | 'up-to-date' | 'available' | 'unsupported' | 'failed';
  docsAvailable: boolean;
}

/**
 * Public release facts attached to a reviewed catalog adapter.  These facts
 * are immutable validation evidence, never renderer-provided installer input.
 */
export interface CatalogReleaseAssetEvidence {
  readonly name: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly role: 'installer' | 'update-index' | 'package';
}

export interface CatalogReleaseEvidence {
  readonly appId: string;
  readonly repository: string;
  readonly tag: string;
  readonly targetCommit: string;
  readonly sourceManifest: string;
  readonly sourceEvidence: readonly string[];
  readonly workflow: {
    readonly started: string;
    readonly completed: string;
    readonly duration: string;
  };
  readonly assets: readonly CatalogReleaseAssetEvidence[];
  readonly tests: {
    readonly status: 'passed' | 'failed' | 'unknown';
    readonly summary: string;
    readonly disclosure: string;
  };
}

export interface CatalogSnapshot {
  apps: CatalogApp[];
  fetchedAt: string;
  source: 'network' | 'cache';
  warning: string | null;
}

export interface OperationRequest {
  appId: string;
  decision: OperationKind;
}

export interface InstallCancelRequest {
  appId: string;
  decision: 'cancel-install';
}

export interface OperationResult {
  ok: boolean;
  appId: string;
  message: string;
  messageYue?: string;
  operationId?: string;
}

/**
 * Progress emitted by the main-process installer boundary.  The renderer
 * receives facts about the reviewed operation only; it never receives an
 * executable, URL, path, argument vector, or process handle.
 */
export const OPERATION_PROGRESS_PHASES = [
  'queued', 'resolving', 'downloading', 'extracting', 'launching', 'committing', 'installer-running',
  'cancelling', 'succeeded', 'failed', 'cancelled', 'unknown',
] as const;
export type OperationProgressPhase = (typeof OPERATION_PROGRESS_PHASES)[number];

export interface OperationProgressEvent {
  operationId: string;
  appId: string;
  kind: 'install' | 'uninstall';
  phase: OperationProgressPhase;
  progress: number | null;
  bytesReceived: number;
  bytesTotal: number | null;
  cancellable: boolean;
  locked: boolean;
  message: string;
  final: boolean;
}

export const operationProgressEventSchema = z.strictObject({
  operationId: z.uuid(),
  appId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
  kind: z.enum(['install', 'uninstall']),
  phase: z.enum(OPERATION_PROGRESS_PHASES),
  progress: z.number().int().min(0).max(100).nullable(),
  bytesReceived: z.number().int().min(0).max(1_500_000_000),
  bytesTotal: z.number().int().min(0).max(1_500_000_000).nullable(),
  cancellable: z.boolean(),
  locked: z.boolean(),
  message: z.string().max(512),
  final: z.boolean(),
});

export const SOURCE_JOB_DECISIONS = ['build', 'run'] as const;
export type SourceJobDecision = (typeof SOURCE_JOB_DECISIONS)[number];
export type SourceJobState = 'queued' | 'preparing' | 'running' | 'repairing' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled';
export type SourceTerminalStream = 'system' | 'progress' | 'stdout' | 'stderr';

export const SOURCE_ISOLATION_REASONS = [
  'unsupported-platform',
  'sandbox-executable-missing',
  'sandbox-feature-unverified',
  'guest-transport-not-connected',
] as const;
export type SourceIsolationReason = (typeof SOURCE_ISOLATION_REASONS)[number];
export const sourceIsolationStatusSchema = z.strictObject({
  available: z.boolean(),
  provider: z.literal('windows-sandbox'),
  reason: z.enum(SOURCE_ISOLATION_REASONS),
  checkedAt: z.iso.datetime(),
  evidence: z.array(z.string().max(240)).max(8),
  remediation: z.string().max(600),
});
export type SourceIsolationStatus = z.infer<typeof sourceIsolationStatusSchema>;

export const sourceJobRequestSchema = z.strictObject({
  appId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
  decision: z.enum(SOURCE_JOB_DECISIONS),
});

export const sourceJobCancelRequestSchema = z.strictObject({
  jobId: z.uuid(),
  decision: z.literal('cancel'),
});

export const sourceJobRetryRequestSchema = z.strictObject({
  jobId: z.uuid(),
  decision: z.literal('retry'),
});

export const sourceTerminalEventSchema = z.strictObject({
  jobId: z.uuid(),
  appId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,127}$/),
  sequence: z.number().int().min(0).max(10_000),
  at: z.iso.datetime(),
  stream: z.enum(['system', 'progress', 'stdout', 'stderr']),
  state: z.enum(['queued', 'preparing', 'running', 'repairing', 'cancelling', 'succeeded', 'failed', 'cancelled']),
  text: z.string().max(2_048),
  progress: z.number().int().min(0).max(100).nullable(),
  final: z.boolean(),
});

export type SourceJobRequest = z.infer<typeof sourceJobRequestSchema>;
export type SourceJobCancelRequest = z.infer<typeof sourceJobCancelRequestSchema>;
export type SourceJobRetryRequest = z.infer<typeof sourceJobRetryRequestSchema>;
export type SourceTerminalEvent = z.infer<typeof sourceTerminalEventSchema>;

export interface SourceJobStartResult {
  ok: boolean;
  appId: string;
  jobId?: string;
  state: SourceJobState;
  message: string;
}

export type UninstallDescriptor =
  | { kind: 'squirrel'; executable: string; arguments: ['--uninstall', '-s'] }
  | { kind: 'msi'; executable: 'msiexec.exe'; arguments: ['/x', string, '/qn', '/norestart'] }
  | { kind: 'reviewed-executable'; executable: string; arguments: string[]; adapterId: string }
  | { kind: 'portable'; executable: null; arguments: [] };

export type InstallOwnership =
  | { kind: 'registry'; adapterId: string; registryKey: string; fingerprint: string }
  | { kind: 'portable'; adapterId: string; installRoot: string };

export type InstalledAppSource = 'store' | 'squirrel-discovery' | 'msi-registry' | 'reviewed-registry' | 'portable-managed';
export type InstallationManagementState = 'not-installed' | 'store-managed' | 'discovery-only';

export interface InstalledAppRecord {
  appId: string;
  displayName: string;
  version: string;
  packageType: PackageType;
  source: InstalledAppSource;
  installRoot: string | null;
  uninstall: UninstallDescriptor | null;
  ownership: InstallOwnership | null;
  installedAt: string | null;
  detectedAt: string;
}

export function installationManagementState(record: InstalledAppRecord | undefined): InstallationManagementState {
  if (!record) return 'not-installed';
  return record.ownership && record.uninstall ? 'store-managed' : 'discovery-only';
}

export type OperationKind = 'install' | 'build' | 'uninstall' | 'update' | 'settings';
export type HistoryExportFormat = 'json' | 'jsonl' | 'yaml' | 'toml' | 'xml' | 'csv' | 'tsv' | 'markdown' | 'html' | 'sql' | 'typescript' | 'javascript' | 'python' | 'go' | 'rust' | 'json-schema' | 'protobuf' | 'zip' | '7z';

export const HISTORY_ARCHIVE_MAX_ENTRIES = 10_000;
export const historyArchiveRequestSchema = z.strictObject({
  entryIds: z.array(z.string().uuid()).min(1).max(HISTORY_ARCHIVE_MAX_ENTRIES),
}).superRefine((value, context) => {
  if (new Set(value.entryIds).size !== value.entryIds.length) context.addIssue({ code: 'custom', path: ['entryIds'], message: 'History archive entry IDs must be unique.' });
});
export type HistoryArchiveRequest = z.infer<typeof historyArchiveRequestSchema>;

export const HISTORY_7Z_METHODS = ['LZMA2', 'LZMA', 'PPMd', 'BZip2', 'Deflate'] as const;
export type History7zMethod = (typeof HISTORY_7Z_METHODS)[number];
export const HISTORY_7Z_LEVELS = ['store', 'fastest', 'fast', 'normal', 'maximum', 'ultra'] as const;
export type History7zLevel = (typeof HISTORY_7Z_LEVELS)[number];
export const HISTORY_7Z_MIN_DICTIONARY_BYTES = 4 * 1024;
export const HISTORY_7Z_MAX_DICTIONARY_BYTES = 8 * 1024 * 1024;
export const HISTORY_7Z_MIN_WORD_BYTES = 8;
export const HISTORY_7Z_MAX_WORD_BYTES = 273;
export const HISTORY_7Z_MAX_THREADS = 16;
export const HISTORY_7Z_MIN_SPLIT_BYTES = 1 * 1024 * 1024;
export const HISTORY_7Z_MAX_SPLIT_BYTES = 16 * 1024 * 1024;
export const history7zOptionsSchema = z.strictObject({
  method: z.enum(HISTORY_7Z_METHODS),
  level: z.enum(HISTORY_7Z_LEVELS),
  dictionaryBytes: z.number().int().min(HISTORY_7Z_MIN_DICTIONARY_BYTES).max(HISTORY_7Z_MAX_DICTIONARY_BYTES),
  wordBytes: z.number().int().min(HISTORY_7Z_MIN_WORD_BYTES).max(HISTORY_7Z_MAX_WORD_BYTES),
  solid: z.boolean(),
  threads: z.number().int().min(1).max(HISTORY_7Z_MAX_THREADS),
  splitBytes: z.number().int().min(HISTORY_7Z_MIN_SPLIT_BYTES).max(HISTORY_7Z_MAX_SPLIT_BYTES).nullable(),
  encryptContent: z.boolean(),
  encryptHeaders: z.boolean(),
}).superRefine((value, context) => {
  if (value.encryptHeaders && !value.encryptContent) context.addIssue({ code: 'custom', path: ['encryptHeaders'], message: 'Encrypted headers require AES-256 content encryption.' });
});
export type History7zOptions = z.infer<typeof history7zOptionsSchema>;
export const history7zRequestSchema = z.strictObject({
  entryIds: z.array(z.string().uuid()).min(1).max(HISTORY_ARCHIVE_MAX_ENTRIES),
  options: history7zOptionsSchema,
}).superRefine((value, context) => {
  if (new Set(value.entryIds).size !== value.entryIds.length) context.addIssue({ code: 'custom', path: ['entryIds'], message: 'History archive entry IDs must be unique.' });
});
export type History7zRequest = z.infer<typeof history7zRequestSchema>;

export type History7zUnavailableReason = 'dependency-unavailable' | 'secret-entry-required';
export interface History7zExportUnavailable {
  ok: false;
  format: '7z';
  filename: 'ding-ding-app-store-history.7z';
  mime: 'application/x-7z-compressed';
  reason: History7zUnavailableReason;
  message: string;
  messageYue: string;
}
export type History7zExportResult = History7zExportUnavailable;

export interface HistoryArchiveExport {
  filename: 'ding-ding-app-store-history.zip';
  mime: 'application/zip';
  encoding: 'UTF-8';
  lineEndings: 'LF';
  schema: 'ding-ding-app-store.history-archive.v1';
  recordCount: number;
  /** Base64 keeps the binary result inside Electron's structured-clone bridge. */
  base64: string;
}

export type ExternalEditorId = 'vscode';
export type ExportRecordKind = 'catalog' | 'installed' | 'activity' | 'history-revisions' | 'notifications' | 'changelog' | 'docs' | 'settings' | 'appearance' | 'tabs' | 'authenticator' | 'support-tickets';
export type ExternalEditorEdition = 'stable' | 'insiders' | 'portable' | 'unknown';

export interface ExternalEditorPreference {
  editor: ExternalEditorId;
  edition: ExternalEditorEdition;
}

export interface ExternalEditorCandidate {
  id: ExternalEditorId;
  label: string;
  available: boolean;
  edition: ExternalEditorEdition;
}

export interface ExternalEditorOpenRequest {
  editor: ExternalEditorId;
  recordKind: ExportRecordKind;
  suggestedName: string;
  mime: string;
  content: string;
}

export interface ExternalEditorOpenArchiveRequest {
  editor: ExternalEditorId;
  recordKind: 'activity';
  suggestedName: string;
  mime: 'application/zip';
  base64: string;
}

export const externalEditorPreferenceSchema = z.strictObject({
  editor: z.literal('vscode'),
  edition: z.enum(['stable', 'insiders', 'portable', 'unknown']),
});

export const externalEditorOpenRequestSchema = z.strictObject({
  editor: z.literal('vscode'),
  recordKind: z.enum(['catalog', 'installed', 'activity', 'history-revisions', 'notifications', 'changelog', 'docs', 'settings', 'appearance', 'tabs', 'authenticator', 'support-tickets']),
  suggestedName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,96}$/).refine((value) => !value.includes('..'), 'Suggested filename cannot contain repeated dots.'),
  mime: z.enum(['application/json', 'application/x-ndjson', 'application/yaml', 'application/toml', 'application/xml', 'text/csv', 'text/tab-separated-values', 'text/markdown', 'text/html', 'application/sql', 'text/x-typescript', 'text/javascript', 'text/x-python', 'text/x-go', 'text/x-rustsrc', 'application/schema+json', 'text/x-protobuf', 'text/plain']),
  content: z.string().max(256_000),
});

export const externalEditorOpenArchiveRequestSchema = z.strictObject({
  editor: z.literal('vscode'),
  recordKind: z.literal('activity'),
  suggestedName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,96}\.zip$/).refine((value) => !value.includes('..'), 'Suggested filename cannot contain repeated dots.'),
  mime: z.literal('application/zip'),
  base64: z.string().min(4).max(23_000_000).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, 'Archive content must be base64.'),
});

export type ExternalEditorOpenRequestInput = z.infer<typeof externalEditorOpenRequestSchema>;
export type ExternalEditorOpenArchiveRequestInput = z.infer<typeof externalEditorOpenArchiveRequestSchema>;

export type ExternalEditorResult =
  | { ok: true; editor: ExternalEditorId }
  | { ok: false; reason: 'bridge-unavailable' | 'not-installed' | 'write-failed' | 'launch-failed' | 'launch-timeout'; message: string };

export interface HistoryEntry {
  id: string;
  appId: string;
  displayName: string;
  kind: OperationKind;
  ok: boolean;
  message: string;
  /** Optional Cantonese projection; legacy records remain English-only. */
  messageYue?: string;
  occurredAt: string;
}

/** A bounded, local-Git revision of the App Store's own state snapshots. */
export interface HistoryRevision {
  id: string;
  occurredAt: string;
  subject: string;
  label: string;
  changedFiles: string[];
  restorable: boolean;
}

export interface HistoryMutationResult {
  ok: boolean;
  message: string;
}

export interface HistoryAccessStatus {
  available: boolean;
  configured: boolean;
  unlocked: boolean;
  reason: 'unavailable' | 'not-configured' | 'locked' | 'ready';
}

export interface HistoryAccessUnlockRequest {
  credential: string;
  create?: boolean;
}

export interface HistoryAccessResult {
  ok: boolean;
  status: HistoryAccessStatus;
  message: string;
}

export interface UpdatePackageMetadata {
  /** The exact Squirrel full-package filename named by RELEASES. */
  fileName: string;
  /** Squirrel's SHA-1 package digest; it is a transport/package-integrity value, not a signature. */
  sha1: string;
  /** The byte count declared by RELEASES and bounded before download. */
  bytes: number;
}
/**
 * Per-application update state.  This is deliberately separate from the
 * App Store self-updater state: discovering a release never starts an
 * installer, and an app update is only launched after the user chooses the
 * explicit restart action.
 */
export type ManagedUpdateState =
  | { appId: string; status: 'idle' | 'up-to-date'; installedVersion: string | null; checkedAt?: string }
  | { appId: string; status: 'available'; installedVersion: string; version: string; releaseNotesUrl: string; unsigned: true }
  | { appId: string; status: 'downloading'; installedVersion: string; version: string; releaseNotesUrl: string; progress: number; bytesDownloaded: number; bytesTotal: number; unsigned: true }
  | { appId: string; status: 'ready'; installedVersion: string; version: string; releaseNotesUrl: string; progress: 100; bytesDownloaded: number; bytesTotal: number; unsigned: true }
  | { appId: string; status: 'installing'; installedVersion: string; version: string; releaseNotesUrl: string; unsigned: true }
  | { appId: string; status: 'cancelled' | 'failed' | 'offline'; installedVersion: string | null; version?: string; releaseNotesUrl?: string; message: string; checkedAt: string; unsigned?: true };

export interface ManagedUpdateRequest {
  appId: string;
  decision: 'download-update' | 'restart-to-install';
}

export interface ManagedUpdateCancelRequest {
  appId: string;
  decision: 'cancel-update';
}

export type AppStoreUpdateState =
  | { status: 'idle' | 'checking' | 'up-to-date'; checkedAt?: string }
  | { status: 'available' | 'downloading'; version: string; releaseNotesUrl: string; package: UpdatePackageMetadata }
  | { status: 'ready'; version: string; releaseNotesUrl: string; package: UpdatePackageMetadata; unsigned: true }
  | { status: 'failed'; message: string; checkedAt: string; recoverable: boolean; rollbackAvailable: boolean };

export interface UserSettings {
  language: LanguageMode;
  englishFunnyLevel: number;
  cantoneseFunnyLevel: number;
  theme: ThemeMode;
  density: 'comfortable' | 'compact' | 'spacious';
  accent: string;
  displayName: string;
  /** Decorates dialog/message title and body copy only; never control labels or accessible names. */
  showEmojisInDialogs: boolean;
  automaticRepairConsent: boolean;
  /** Optional renderer-only speech; it never authorizes a privileged media bridge. */
  narratorEnabled: boolean;
  narratorLanguage: 'en' | 'yue' | 'both';
  narratorReducedSound: boolean;
}

/**
 * Shared local School mode state.  The renderer receives only this public
 * projection; the verifier salt and digest remain in the main process.
 */
export type SchoolUnlockKind = 'pin' | 'password' | 'passkey';
export type SchoolSupportedUnlockKind = Exclude<SchoolUnlockKind, 'passkey'>;
export interface SchoolModeState {
  schemaVersion: 2;
  recordId: string | null;
  revision: number;
  enabled: boolean;
  displayName: string;
  unlockKind: SchoolUnlockKind | null;
}
export type SchoolModeUnavailableReason = 'read-failed' | 'parse-failed' | 'watch-failed' | 'write-failed' | 'conflict' | 'service-closed' | 'bridge-failed';
export type SchoolModeSyncStatus =
  | { status: 'ready'; watching: boolean }
  | { status: 'unavailable'; watching: boolean; reason: SchoolModeUnavailableReason };
export interface SchoolModeSnapshot {
  schemaVersion: 1;
  observationSequence: number;
  state: SchoolModeState | null;
  configured: boolean;
  sync: SchoolModeSyncStatus;
}
export interface SchoolModeConfigureRequest {
  expectedRecordId: string | null;
  expectedRevision: number;
  displayName: string;
  unlockKind: SchoolSupportedUnlockKind;
  credential: string;
}
export interface SchoolModeRenameRequest {
  expectedRecordId: string | null;
  expectedRevision: number;
  displayName: string;
  credential?: string;
}
export interface SchoolModeToggleRequest {
  expectedRecordId: string | null;
  expectedRevision: number;
  enabled: boolean;
  credential?: string;
}
export interface SchoolModeVerifyRequest {
  credential: string;
}
export interface SchoolModeCredentialChangeRequest {
  expectedRecordId: string | null;
  expectedRevision: number;
  currentCredential: string;
  nextCredential: string;
  unlockKind: SchoolSupportedUnlockKind;
}
export const SCHOOL_MODE_MUTATION_CODES = [
  'invalid-configure',
  'invalid-name',
  'invalid-toggle',
  'invalid-credential-change',
  'invalid-pin',
  'invalid-password',
  'already-configured',
  'configured',
  'credential-rejected',
  'name-unchanged',
  'name-saved',
  'not-configured',
  'passkey-unsupported',
  'already-enabled',
  'already-disabled',
  'enabled',
  'disabled',
  'credential-changed-pin',
  'credential-changed-password',
  'read-failed',
  'parse-failed',
  'write-failed',
  'conflict',
  'service-closed',
  'revision-exhausted',
  'state-unavailable',
  'bridge-failed',
] as const;
export type SchoolModeMutationCode = typeof SCHOOL_MODE_MUTATION_CODES[number];
export interface SchoolModeMutationResult {
  ok: boolean;
  snapshot: SchoolModeSnapshot;
  code: SchoolModeMutationCode;
}

/**
 * A lock is a local UX speed bump, not encryption or a security boundary.
 * The credential verifier stays in the main process; the renderer receives
 * only this projection and never receives a password, salt, or verifier.
 */
export type LockTargetKind = 'tab' | 'group' | 'appearance-property';
export const LOCK_TOTP_ALGORITHMS = ['sha1', 'sha256', 'sha512'] as const;
export type LockTotpAlgorithm = (typeof LOCK_TOTP_ALGORITHMS)[number];
export const LOCK_TOTP_DIGITS = [6, 7, 8] as const;
export type LockTotpDigits = (typeof LOCK_TOTP_DIGITS)[number];
/** Lock TOTP periods are deliberately bounded to keep pairing and skew predictable. */
export const LOCK_TOTP_PERIOD_MIN_SECONDS = 15;
export const LOCK_TOTP_PERIOD_MAX_SECONDS = 3_600;
/** How long an individual UX lock stays unlocked after a credential match. */
export type LockUnlockDuration = 'session' | '15m' | '60m';
export interface LockTarget {
  targetKind: LockTargetKind;
  targetId: string;
}
export interface LockRecord extends LockTarget {
  /** The credential method is metadata only; the credential itself never crosses this boundary. */
  credentialKind: 'password' | 'totp';
  /** TOTP parameters are metadata only; the secret remains in the main-process vault. */
  totpAlgorithm?: LockTotpAlgorithm;
  totpDigits?: LockTotpDigits;
  totpPeriodSeconds?: number;
  unlockDuration: LockUnlockDuration;
  locked: boolean;
  /** Null means unlocked until this app process closes; timed values are ISO timestamps. */
  unlockedUntil: string | null;
  createdAt: string;
  updatedAt: string;
}
export interface LockState {
  schemaVersion: 1;
  vaultAvailable: boolean;
  unavailableReason: 'credential-store-unavailable' | 'credential-store-read-failed' | null;
  records: LockRecord[];
  recoveryPath: string;
}
export interface LockSetRequest extends LockTarget {
  /** Legacy callers may omit this and keep the password path. */
  credentialKind?: 'password' | 'totp';
  totpAlgorithm?: LockTotpAlgorithm;
  totpDigits?: LockTotpDigits;
  totpPeriodSeconds?: number;
  credential: string;
  currentCredential?: string;
  /** Required only for a new TOTP lock: one current code confirms pairing. */
  confirmationCode?: string;
  /** Stored as the default lifetime and used for the next unlock. */
  unlockDuration?: LockUnlockDuration;
}
export interface LockCredentialRequest extends LockTarget {
  credential: string;
  /** Optional one-off lifetime override; the configured lock lifetime is used when omitted. */
  unlockDuration?: LockUnlockDuration;
}
export interface LockMutationResult {
  ok: boolean;
  state: LockState;
  message: string;
  reason?: 'credential-store-unavailable' | 'credential-store-read-failed' | 'credential-mismatch' | 'invalid-otp' | 'rate-limited' | 'not-found' | 'appearance-locked' | 'invalid';
}

export type SupportTicketCategory = 'unlock' | 'lock' | 'other';
export type SupportTicketSeverity = 'low' | 'normal' | 'high';
export type SupportTicketStatus = 'created' | 'reviewed' | 'resolved';
export interface SupportTicket {
  id: string;
  number: string;
  category: SupportTicketCategory;
  description: string;
  severity: SupportTicketSeverity;
  status: SupportTicketStatus;
  firstResponse: string;
  createdAt: string;
  updatedAt: string;
}
export interface SupportState {
  schemaVersion: 1;
  tickets: SupportTicket[];
  recoveryPath: string;
  disclosure: string;
}
export interface SupportTicketCreateRequest {
  category: SupportTicketCategory;
  description: string;
  severity: SupportTicketSeverity;
}
export interface SupportTicketMutationResult {
  ok: boolean;
  state: SupportState;
  message: string;
  reason?: 'invalid' | 'storage-failed' | 'not-found';
}
export interface SupportTicketBulkAdvanceRequest { ticketIds: string[]; }
export interface SupportTicketBulkAdvanceResult {
  ok: boolean;
  state: SupportState;
  message: string;
  committed: string[];
  skipped: string[];
  uncertain: string[];
  reason?: 'invalid' | 'storage-failed' | 'busy';
}
export interface SupportOpenRecoveryResult {
  ok: boolean;
  path: string;
  message: string;
}

/** The compiled-in settings are a public contract: every settings explanation names these values. */
export const DEFAULT_USER_SETTINGS: UserSettings = {
  language: 'bilingual',
  englishFunnyLevel: 2,
  cantoneseFunnyLevel: 4,
  theme: 'system',
  density: 'comfortable',
  accent: '#6750A4',
  displayName: 'Ding Ding App Store',
  showEmojisInDialogs: true,
  automaticRepairConsent: false,
  narratorEnabled: false,
  narratorLanguage: 'both',
  narratorReducedSound: false,
};

export type SettingsValueSource = 'persisted' | 'fallback';
export interface SettingsProvenance {
  source: SettingsValueSource;
  /** The exact compiled fallback shown when source is fallback. */
  fallback: UserSettings;
}

export interface PersonalVocabularyStatus {
  loaded: boolean;
  entryCount: number;
  entries: Array<{ source: string; replacement: string }>;
  message: string;
  messageYue: string;
}

export interface PersonalVocabularyImportResult extends PersonalVocabularyStatus {
  ok: boolean;
}

export const TAB_IDS = ['catalog', 'installed', 'updates', 'authenticator', 'docs', 'activity', 'settings'] as const;
export type TabId = (typeof TAB_IDS)[number];
export const tabIdSchema = z.enum(TAB_IDS);

export const SURFACE_IDS = [
  ...TAB_IDS,
  'settings.general',
  'settings.appearance',
  'settings.schedule',
  'settings.about',
  'settings.support',
] as const;
export type PersistedSurfaceId = (typeof SURFACE_IDS)[number];

export const TAB_GROUP_COLORS = ['grey', 'blue', 'green', 'yellow', 'red', 'purple', 'teal'] as const;
export type TabGroupColor = (typeof TAB_GROUP_COLORS)[number];

export const MAX_TAB_GROUPS = 8;
export const MAX_DOCUMENT_BYTES = 64_000;

export const tabGroupColorSchema = z.enum(TAB_GROUP_COLORS);

export const tabGroupSchema = z
  .object({
    id: z.string().regex(/^grp_[a-z0-9]{8}$/),
    name: z.string().trim().min(1).max(32),
    color: tabGroupColorSchema,
    collapsed: z.boolean(),
  })
  .strict();

export const tabStateSchema = z
  .object({
    id: tabIdSchema,
    /** Closed tabs remain in the persisted workspace so they can be reopened without losing order/group metadata. */
    open: z.boolean().default(true),
    pinned: z.boolean(),
    groupId: z.string().nullable(),
    previousGroupId: z.string().nullable(),
    order: z.number().int().min(0).max(63),
  })
  .strict();

export const railSchema = z
  .object({
    side: z.enum(['left', 'right', 'top', 'bottom']),
    labelMode: z.enum(['full', 'compact', 'icon']),
    tabHeight: z.enum(['compact', 'comfortable', 'tall']),
    overflowMode: z.enum(['menu', 'scroll']),
    showBadges: z.boolean(),
    showGroupColorBar: z.boolean(),
    pinnedIconOnly: z.boolean(),
    width: z.number().int().min(64).max(420),
  })
  .strict();

export const tabWorkspaceSchema = z
  .object({
    schemaVersion: z.literal(1),
    activeTabId: tabIdSchema,
    tabs: z.array(tabStateSchema).length(TAB_IDS.length),
    groups: z.array(tabGroupSchema).max(MAX_TAB_GROUPS),
    rail: railSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    const ids = value.tabs.map((tab) => tab.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', path: ['tabs'], message: 'Tab ids must be unique.' });
    for (const id of TAB_IDS) {
      if (!ids.includes(id)) ctx.addIssue({ code: 'custom', path: ['tabs'], message: `Missing tab id: ${id}` });
    }
    const groupIds = value.groups.map((group) => group.id);
    if (new Set(groupIds).size !== groupIds.length) ctx.addIssue({ code: 'custom', path: ['groups'], message: 'Group ids must be unique.' });
    value.tabs.forEach((tab, index) => {
      if (tab.groupId !== null && !groupIds.includes(tab.groupId)) {
        ctx.addIssue({ code: 'custom', path: ['tabs', index, 'groupId'], message: 'groupId does not match any group.' });
      }
      if (tab.previousGroupId !== null && !groupIds.includes(tab.previousGroupId)) {
        ctx.addIssue({ code: 'custom', path: ['tabs', index, 'previousGroupId'], message: 'previousGroupId does not match any group.' });
      }
      if (tab.pinned && tab.groupId !== null) {
        ctx.addIssue({ code: 'custom', path: ['tabs', index, 'groupId'], message: 'A pinned tab cannot belong to a group.' });
      }
    });
  });

export type TabGroup = z.infer<typeof tabGroupSchema>;
export type TabState = z.infer<typeof tabStateSchema>;
export type TabRailLayout = z.infer<typeof railSchema>;
export type TabWorkspace = z.infer<typeof tabWorkspaceSchema>;

export const DEFAULT_TAB_WORKSPACE: TabWorkspace = {
  schemaVersion: 1,
  activeTabId: 'catalog',
  tabs: TAB_IDS.map((id, index) => ({ id, open: true, pinned: false, groupId: null, previousGroupId: null, order: index })),
  groups: [],
  rail: {
    side: 'left',
    labelMode: 'full',
    tabHeight: 'comfortable',
    overflowMode: 'menu',
    showBadges: true,
    showGroupColorBar: true,
    pinnedIconOnly: true,
    width: 260,
  },
};

export const TOKEN_IDS = [
  'background', 'foreground', 'radius', 'paddingScale', 'fontScale', 'fontWeight',
  'fontFamily', 'fontStyle', 'textDecoration', 'letterSpacing', 'lineHeight',
  'borderWidth', 'elevation', 'fontVariationAxes', 'underlineStyle', 'underlineColor',
  'underlineThickness', 'textTransform', 'fontVariantCaps', 'baselineOffset',
  'textDirection', 'textAlign', 'textShadow',
] as const;
export type TokenId = (typeof TOKEN_IDS)[number];

export const COLOR_ROLES = [
  'surface',
  'surface-container',
  'surface-high',
  'primary',
  'on-primary',
  'primary-container',
  'outline',
  'error',
  'success',
  'inherit',
  'transparent',
] as const;
export type ColorRole = (typeof COLOR_ROLES)[number];

export const COLOR_ROLE_VAR: Readonly<Record<ColorRole, string>> = Object.freeze({
  surface: 'var(--surface)',
  'surface-container': 'var(--surface-container)',
  'surface-high': 'var(--surface-high)',
  primary: 'var(--primary)',
  'on-primary': 'var(--on-primary)',
  'primary-container': 'var(--primary-container)',
  outline: 'var(--outline)',
  error: 'var(--error)',
  success: 'var(--success)',
  inherit: 'inherit',
  transparent: 'transparent',
});

export const RADII = ['none', 'xs', 'sm', 'md', 'lg', 'xl', 'full'] as const;
export type RadiusToken = (typeof RADII)[number];
export const RADIUS_PX: Readonly<Record<RadiusToken, number>> = Object.freeze({ none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, full: 999 });

export const ELEVATIONS = ['none', '1', '2', '3'] as const;
export type ElevationToken = (typeof ELEVATIONS)[number];
export const ELEVATION_SHADOW: Readonly<Record<ElevationToken, string>> = Object.freeze({
  none: 'none',
  '1': '0 1px 2px rgba(0, 0, 0, 0.16)',
  '2': '0 2px 6px rgba(0, 0, 0, 0.18)',
  '3': '0 6px 16px rgba(0, 0, 0, 0.22)',
});

export const CSS_SUFFIX: Readonly<Record<TokenId, string>> = Object.freeze({
  background: 'background',
  foreground: 'foreground',
  radius: 'radius',
  paddingScale: 'pad-scale',
  fontScale: 'font-scale',
  fontWeight: 'font-weight',
  fontFamily: 'font-family',
  fontStyle: 'font-style',
  textDecoration: 'text-decoration',
  fontVariationAxes: 'font-variation-settings',
  underlineStyle: 'text-decoration-style',
  underlineColor: 'text-decoration-color',
  underlineThickness: 'text-decoration-thickness',
  textTransform: 'text-transform',
  fontVariantCaps: 'font-variant-caps',
  baselineOffset: 'vertical-align',
  textDirection: 'direction',
  textAlign: 'text-align',
  textShadow: 'text-shadow',
  letterSpacing: 'letter-spacing',
  lineHeight: 'line-height',
  borderWidth: 'border-width',
  elevation: 'elevation',
});

export type ElementGroup = 'chrome' | 'navigation' | 'content' | 'controls' | 'feedback';

export interface ElementDefinition {
  readonly key: string;
  readonly en: string;
  readonly yue: string;
  readonly group: ElementGroup;
  readonly tokens: readonly TokenId[];
}

const ALL: readonly TokenId[] = TOKEN_IDS;
const TEXT: readonly TokenId[] = ['foreground', 'fontScale', 'fontWeight', 'fontFamily', 'fontStyle', 'textDecoration', 'letterSpacing', 'lineHeight', 'fontVariationAxes', 'underlineStyle', 'underlineColor', 'underlineThickness', 'textTransform', 'fontVariantCaps', 'baselineOffset', 'textDirection', 'textAlign', 'textShadow'];
const BOX: readonly TokenId[] = ['background', 'foreground', 'radius', 'paddingScale', 'fontScale', 'borderWidth'];
const BOX_RAISED: readonly TokenId[] = [...BOX, 'elevation'];
const PILL: readonly TokenId[] = ['background', 'foreground', 'radius', 'paddingScale', 'fontScale', 'fontWeight', 'borderWidth'];

const ELEMENT_LIST = [
  { key: 'app-shell', en: 'Application shell', yue: '應用外殼', group: 'chrome', tokens: ['background', 'foreground', 'fontScale'] },
  { key: 'titlebar', en: 'Title bar', yue: '標題列', group: 'chrome', tokens: ['background', 'foreground', 'paddingScale', 'fontScale', 'borderWidth', 'elevation'] },
  { key: 'titlebar-brand', en: 'Title bar brand', yue: '標題列品牌', group: 'chrome', tokens: TEXT },
  { key: 'titlebar-badge', en: 'Title bar badge', yue: '標題列徽章', group: 'chrome', tokens: PILL },
  { key: 'nav-rail', en: 'Navigation rail', yue: '導覽列', group: 'navigation', tokens: ['background', 'foreground', 'radius', 'paddingScale', 'borderWidth', 'elevation'] },
  { key: 'nav-title', en: 'Navigation title', yue: '導覽標題', group: 'navigation', tokens: TEXT },
  { key: 'nav-tab', en: 'Tab', yue: '分頁', group: 'navigation', tokens: PILL },
  { key: 'nav-tab-selected', en: 'Selected tab', yue: '選中分頁', group: 'navigation', tokens: ALL },
  { key: 'tab-group-header', en: 'Tab group header', yue: '分頁組標題', group: 'navigation', tokens: ['background', 'foreground', 'radius', 'paddingScale', 'fontScale', 'fontWeight'] },
  { key: 'palette-hint', en: 'Command palette hint', yue: '指令面板提示', group: 'navigation', tokens: BOX },
  { key: 'content-surface', en: 'Content surface', yue: '內容表面', group: 'content', tokens: ['background', 'foreground', 'radius', 'paddingScale', 'fontScale'] },
  { key: 'page-heading', en: 'Page heading bar', yue: '頁面標題列', group: 'content', tokens: ['background', 'foreground', 'paddingScale', 'fontScale', 'borderWidth'] },
  { key: 'page-title', en: 'Page title', yue: '頁面標題', group: 'content', tokens: TEXT },
  { key: 'search-field', en: 'Search field', yue: '搜尋欄', group: 'controls', tokens: BOX_RAISED },
  { key: 'regex-builder', en: 'Regex builder', yue: '正則產生器', group: 'controls', tokens: BOX_RAISED },
  { key: 'app-card', en: 'Application card', yue: '應用卡片', group: 'content', tokens: BOX_RAISED },
  { key: 'app-card-title', en: 'Application card title', yue: '應用卡片標題', group: 'content', tokens: TEXT },
  { key: 'app-card-description', en: 'Application card description', yue: '應用卡片描述', group: 'content', tokens: TEXT },
  { key: 'status-pill', en: 'Status pill', yue: '狀態標籤', group: 'feedback', tokens: PILL },
  { key: 'button-filled', en: 'Filled button', yue: '實心按鈕', group: 'controls', tokens: ['background', 'foreground', 'radius', 'paddingScale', 'fontScale', 'fontWeight', 'elevation'] },
  { key: 'button-tonal', en: 'Tonal button', yue: '色調按鈕', group: 'controls', tokens: ['background', 'foreground', 'radius', 'paddingScale', 'fontScale', 'fontWeight', 'elevation'] },
  { key: 'button-text', en: 'Text button', yue: '文字按鈕', group: 'controls', tokens: ['foreground', 'radius', 'paddingScale', 'fontScale', 'fontWeight'] },
  { key: 'icon-button', en: 'Icon button', yue: '圖示按鈕', group: 'controls', tokens: ['background', 'foreground', 'radius', 'paddingScale', 'borderWidth'] },
  { key: 'chip', en: 'Chip', yue: '晶片', group: 'controls', tokens: PILL },
  { key: 'update-banner', en: 'Update banner', yue: '更新橫幅', group: 'feedback', tokens: BOX_RAISED },
  { key: 'notice', en: 'Corner notification', yue: '角落通知', group: 'feedback', tokens: BOX_RAISED },
  { key: 'empty-state', en: 'Empty state', yue: '空白狀態', group: 'feedback', tokens: BOX },
  { key: 'history-row', en: 'Activity row', yue: '活動列', group: 'content', tokens: BOX },
  { key: 'docs-article', en: 'Documentation article', yue: '說明文章', group: 'content', tokens: BOX },
  { key: 'settings-card', en: 'Settings card', yue: '設定卡片', group: 'content', tokens: BOX_RAISED },
  { key: 'authenticator-entry', en: 'Authenticator entry', yue: 'Authenticator 項目', group: 'content', tokens: BOX_RAISED },
  { key: 'authenticator-entry-management', en: 'Authenticator entry management', yue: 'Authenticator 項目管理', group: 'controls', tokens: BOX_RAISED },
  { key: 'authenticator-entry-select', en: 'Authenticator entry selection', yue: 'Authenticator 項目揀選', group: 'controls', tokens: PILL },
  { key: 'authenticator-code', en: 'Authenticator code', yue: 'Authenticator 驗證碼', group: 'content', tokens: TEXT },
  { key: 'authenticator-next-code', en: 'Authenticator next code', yue: 'Authenticator 下一個驗證碼', group: 'content', tokens: TEXT },
  { key: 'schedule-card', en: 'Schedule card', yue: '排程卡片', group: 'content', tokens: BOX_RAISED },
  { key: 'dialog', en: 'Dialog', yue: '對話框', group: 'feedback', tokens: BOX_RAISED },
  { key: 'command-palette', en: 'Command palette', yue: '指令面板', group: 'feedback', tokens: BOX_RAISED },
  { key: 'snackbar', en: 'Snackbar', yue: '訊息條', group: 'feedback', tokens: ['background', 'foreground', 'radius', 'paddingScale', 'fontScale', 'fontWeight', 'borderWidth', 'elevation'] },
] as const satisfies readonly ElementDefinition[];

export type ElementKey = (typeof ELEMENT_LIST)[number]['key'];
export const ELEMENTS: readonly ElementDefinition[] = Object.freeze(ELEMENT_LIST.map((element) => Object.freeze({ ...element })));
export const ELEMENT_KEYS = ELEMENT_LIST.map((element) => element.key) as unknown as [ElementKey, ...ElementKey[]];
export const ELEMENT_BY_KEY: ReadonlyMap<string, ElementDefinition> = new Map(ELEMENTS.map((element) => [element.key, element]));

export const MAX_TOKENS_PER_ELEMENT = 32;
export const MAX_IMPORT_BYTES = 64_000;

export const colorValueSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('role'), role: z.enum(COLOR_ROLES) }),
  z.strictObject({ kind: z.literal('hex'), hex: z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/).transform((value) => value.toLowerCase()) }),
]);

export const elementOverrideSchema = z.strictObject({
  background: colorValueSchema.optional(),
  foreground: colorValueSchema.optional(),
  radius: z.enum(RADII).optional(),
  paddingScale: z.number().int().min(50).max(200).optional(),
  fontScale: z.number().int().min(75).max(150).optional(),
  fontWeight: z.union([z.literal(400), z.literal(500), z.literal(600), z.literal(700), z.literal(800)]).optional(),
  fontFamily: z.string().trim().min(1).max(96).regex(/^[A-Za-z0-9 _-]+$/, 'Use an installed font family name.').optional(),
  fontStyle: z.enum(['normal', 'italic', 'oblique']).optional(),
  textDecoration: z.enum(['none', 'underline', 'overline', 'line-through', 'underline overline', 'underline line-through', 'overline line-through', 'underline overline line-through']).optional(),
  fontVariationAxes: z.record(z.string().regex(/^[A-Za-z0-9]{4}$/), z.number().min(-1000).max(2000)).superRefine((value, ctx) => {
    if (Object.keys(value).length > 8) ctx.addIssue({ code: 'custom', message: 'At most eight font variation axes are supported.' });
  }).optional(),
  underlineStyle: z.enum(['solid', 'double', 'dotted', 'dashed', 'wavy']).optional(),
  underlineColor: colorValueSchema.optional(),
  underlineThickness: z.number().int().min(0).max(10).optional(),
  textTransform: z.enum(['none', 'uppercase', 'lowercase', 'capitalize']).optional(),
  fontVariantCaps: z.enum(['normal', 'small-caps', 'all-small-caps', 'petite-caps', 'all-petite-caps', 'unicase', 'titling-caps']).optional(),
  baselineOffset: z.number().int().min(-200).max(200).optional(),
  textDirection: z.enum(['ltr', 'rtl', 'auto']).optional(),
  textAlign: z.enum(['start', 'center', 'end', 'justify']).optional(),
  textShadow: z.strictObject({ x: z.number().int().min(-20).max(20), y: z.number().int().min(-20).max(20), blur: z.number().int().min(0).max(40), color: colorValueSchema }).optional(),
  letterSpacing: z.number().int().min(-4).max(16).optional(),
  lineHeight: z.number().int().min(80).max(240).optional(),
  borderWidth: z.number().int().min(0).max(3).optional(),
  elevation: z.enum(ELEVATIONS).optional(),
});

export type ColorValue = z.infer<typeof colorValueSchema>;
export type ElementOverride = z.infer<typeof elementOverrideSchema>;

const FORBIDDEN_RECORD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export const appearanceElementsSchema = z
  .unknown()
  .superRefine((value, ctx) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    for (const key of Object.getOwnPropertyNames(value)) {
      if (FORBIDDEN_RECORD_KEYS.has(key)) ctx.addIssue({ code: 'custom', path: [key], message: 'Reserved key is not allowed.' });
    }
  })
  .pipe(
    z.partialRecord(z.enum(ELEMENT_KEYS), elementOverrideSchema).superRefine((value, ctx) => {
      for (const [key, override] of Object.entries(value)) {
        if (!override) continue;
        const definition = ELEMENT_BY_KEY.get(key);
        if (!definition) continue;
        const tokens = Object.keys(override) as TokenId[];
        if (tokens.length > MAX_TOKENS_PER_ELEMENT) {
          ctx.addIssue({ code: 'custom', path: [key], message: `At most ${MAX_TOKENS_PER_ELEMENT} tokens per element.` });
        }
        for (const token of tokens) {
          if (!definition.tokens.includes(token)) {
            ctx.addIssue({ code: 'custom', path: [key, token], message: `Token ${token} is not editable on ${key}.` });
          }
        }
      }
    }),
  );

export type AppearanceElements = Partial<Record<ElementKey, ElementOverride>>;

export const appearanceDocumentSchema = z.strictObject({
  schemaVersion: z.literal(1),
  elements: appearanceElementsSchema,
});

export const appearanceExportSchema = z.strictObject({
  kind: z.literal('ding-ding-app-store.appearance'),
  schemaVersion: z.literal(1),
  exportedAt: z.iso.datetime(),
  appVersion: z.string().max(32).optional(),
  elements: appearanceElementsSchema,
});

export interface AppearanceDocument {
  schemaVersion: 1;
  elements: AppearanceElements;
  /** Set only when the stored document could not be read; never persisted. */
  warning?: string;
}

export interface AppearanceExport extends AppearanceDocument {
  kind: 'ding-ding-app-store.appearance';
  exportedAt: string;
  appVersion?: string;
}

export type AppearanceImportResult =
  | { ok: true; document: AppearanceDocument; applied: number }
  | { ok: false; message: string; issues: string[] };

const UNSAFE_VALUE = /[;{}<>\n\r]|url\(|@import|expression\(|\/\*/i;
const SAFE_HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;
const SAFE_FONT = /^[A-Za-z0-9 _-]{1,96}$/;

function safeColorCss(color: ColorValue | undefined): string | null {
  if (!color) return null;
  if (color.kind === 'role') return COLOR_ROLE_VAR[color.role] ?? null;
  return SAFE_HEX.test(color.hex) ? color.hex : null;
}

function tokenValue(token: TokenId, override: ElementOverride): string | null {
  switch (token) {
    case 'background':
    case 'foreground': {
      return safeColorCss(override[token]);
    }
    case 'radius':
      return override.radius ? `${RADIUS_PX[override.radius]}px` : null;
    case 'paddingScale':
      return typeof override.paddingScale === 'number' ? (override.paddingScale / 100).toFixed(2) : null;
    case 'fontScale':
      return typeof override.fontScale === 'number' ? (override.fontScale / 100).toFixed(2) : null;
    case 'fontWeight':
      return typeof override.fontWeight === 'number' ? String(override.fontWeight) : null;
    case 'fontFamily':
      return typeof override.fontFamily === 'string' && SAFE_FONT.test(override.fontFamily) ? override.fontFamily : null;
    case 'fontStyle':
      return override.fontStyle ?? null;
    case 'textDecoration':
      return override.textDecoration ?? null;
    case 'fontVariationAxes': {
      const axes = override.fontVariationAxes;
      if (!axes) return null;
      const pairs = Object.entries(axes).filter(([axis, value]) => /^[A-Za-z0-9]{4}$/.test(axis) && Number.isFinite(value) && value >= -1000 && value <= 2000);
      return pairs.length ? pairs.map(([axis, value]) => `"${axis}" ${value}`).join(', ') : null;
    }
    case 'underlineStyle':
      return override.underlineStyle ?? null;
    case 'underlineColor':
      return safeColorCss(override.underlineColor);
    case 'underlineThickness':
      return typeof override.underlineThickness === 'number' ? `${override.underlineThickness}px` : null;
    case 'textTransform':
      return override.textTransform ?? null;
    case 'fontVariantCaps':
      return override.fontVariantCaps ?? null;
    case 'baselineOffset':
      return typeof override.baselineOffset === 'number' ? `${override.baselineOffset / 100}em` : null;
    case 'textDirection':
      return override.textDirection ?? null;
    case 'textAlign':
      return override.textAlign ?? null;
    case 'textShadow': {
      const shadow = override.textShadow;
      const color = safeColorCss(shadow?.color);
      return shadow && color ? `${shadow.x / 10}em ${shadow.y / 10}em ${shadow.blur / 10}em ${color}` : null;
    }
    case 'letterSpacing':
      return typeof override.letterSpacing === 'number' ? `${override.letterSpacing / 10}em` : null;
    case 'lineHeight':
      return typeof override.lineHeight === 'number' ? `${override.lineHeight / 100}` : null;
    case 'borderWidth':
      return typeof override.borderWidth === 'number' ? `${override.borderWidth}px` : null;
    case 'elevation':
      return override.elevation ? ELEVATION_SHADOW[override.elevation] : null;
    default:
      return null;
  }
}

export function toCssVariables(elements: AppearanceElements): Array<[string, string]> {
  const pairs: Array<[string, string]> = [];
  for (const definition of ELEMENTS) {
    const override = elements[definition.key as ElementKey];
    if (!override) continue;
    for (const token of definition.tokens) {
      const value = tokenValue(token, override);
      if (value === null || UNSAFE_VALUE.test(value)) continue;
      pairs.push([`--elx-${definition.key}-${CSS_SUFFIX[token]}`, value]);
    }
  }
  return pairs;
}

export const SCHEDULE_BOUNDS = {
  selfUpdateMinutes: { min: 60, max: 10_080, step: 5 },
  catalogMinutes: { min: 30, max: 10_080, step: 5 },
  quietMinuteOfDay: { min: 0, max: 1_439 },
  quietMinSpanMinutes: 15,
  ruleCount: { min: 0, max: 32 },
  ruleLabelLength: { min: 1, max: 64 },
  ruleDateLength: 10,
  ruleTimeZoneLength: 64,
  externalUrlLength: 2_048,
  externalEntityLength: 128,
} as const;

const scheduleDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date (YYYY-MM-DD).');
const scheduleTimeZoneSchema = z.string().trim().min(1).max(SCHEDULE_BOUNDS.ruleTimeZoneLength).regex(/^[A-Za-z0-9_+./-]+$/);
function ipv4Parts(hostname: string): number[] | null {
  const ipv4 = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ipv4) return null;
  const parts = ipv4.slice(1).map(Number);
  return parts.some((part) => part > 255) ? null : parts;
}

function privateOrLoopbackIpv4(parts: readonly number[]): boolean {
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function ipv6Parts(hostname: string): number[] | null {
  const halves = hostname.split('::');
  if (halves.length > 2) return null;
  const parse = (half: string): number[] | null => {
    if (!half) return [];
    const parts = half.split(':');
    if (parts.some((part) => !/^[0-9a-f]{1,4}$/i.test(part))) return null;
    return parts.map((part) => Number.parseInt(part, 16));
  };
  const left = parse(halves[0]);
  const right = parse(halves[1] ?? '');
  if (!left || !right) return null;
  if (halves.length === 1) return left.length === 8 ? left : null;
  if (left.length + right.length >= 8) return null;
  return [...left, ...Array(8 - left.length - right.length).fill(0), ...right];
}

export function privateOrLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  const ipv4 = ipv4Parts(host);
  if (ipv4) return privateOrLoopbackIpv4(ipv4);
  const ipv6 = ipv6Parts(host);
  if (!ipv6) return false;
  const [first] = ipv6;
  if (ipv6.every((part) => part === 0) || (ipv6.slice(0, 7).every((part) => part === 0) && ipv6[7] === 1)) return true;
  if ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80) return true;
  if (ipv6.slice(0, 5).every((part) => part === 0) && ipv6[5] === 0xffff) return true;
  const compatibleIpv4 = ipv6.slice(0, 6).every((part) => part === 0)
    ? [ipv6[6] >> 8, ipv6[6] & 0xff, ipv6[7] >> 8, ipv6[7] & 0xff]
    : null;
  return compatibleIpv4 !== null && privateOrLoopbackIpv4(compatibleIpv4);
}
const scheduledSettingsValuesSchema = z.object({
  language: z.enum(['en', 'yue', 'bilingual']).optional(),
  englishFunnyLevel: z.number().int().min(1).max(5).optional(),
  cantoneseFunnyLevel: z.number().int().min(1).max(5).optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  density: z.enum(['comfortable', 'compact', 'spacious']).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/).optional(),
  displayName: z.string().trim().min(1).max(64).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Choose at least one setting to schedule.');

export const scheduledSettingsOverrideSchema = scheduledSettingsValuesSchema;

const httpsExternalUrlSchema = z.string().trim().max(SCHEDULE_BOUNDS.externalUrlLength).url().refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.hash && !privateOrLoopbackHost(url.hostname);
  } catch { return false; }
}, 'Use an HTTPS URL without embedded credentials.');

export function allowedHomeAssistantBaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const literalLoopbackHttp = /^http:\/\/127\.0\.0\.1(?::\d+)?(?:[/?]|$)/i.test(value);
    return !url.username && !url.password && !url.hash
      && ((url.protocol === 'https:' && !privateOrLoopbackHost(url.hostname))
        || (url.protocol === 'http:' && url.hostname === '127.0.0.1' && literalLoopbackHttp));
  } catch { return false; }
}

const homeAssistantUrlSchema = z.string().trim().max(SCHEDULE_BOUNDS.externalUrlLength).url().refine(allowedHomeAssistantBaseUrl, 'Use public HTTPS, or an explicit http://127.0.0.1 development URL, without embedded credentials.');

export const scheduledSettingSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local') }).strict(),
  z.object({ kind: z.literal('api'), url: httpsExternalUrlSchema }).strict(),
  z.object({
    kind: z.literal('home-assistant'),
    baseUrl: homeAssistantUrlSchema,
    entityId: z.string().trim().min(1).max(SCHEDULE_BOUNDS.externalEntityLength).regex(/^(?:input_boolean|binary_sensor)\.[a-z0-9_]+$/),
  }).strict(),
]);

export type ScheduledSettingSource = z.infer<typeof scheduledSettingSourceSchema>;

export const scheduledSettingRuleSchema = z.object({
  id: z.string().regex(/^rule_[a-z0-9]{8}$/),
  label: z.string().trim().min(SCHEDULE_BOUNDS.ruleLabelLength.min).max(SCHEDULE_BOUNDS.ruleLabelLength.max),
  enabled: z.boolean(),
  startDate: scheduleDateSchema.nullable(),
  endDate: scheduleDateSchema.nullable(),
  startMinute: z.number().int().min(SCHEDULE_BOUNDS.quietMinuteOfDay.min).max(SCHEDULE_BOUNDS.quietMinuteOfDay.max),
  endMinute: z.number().int().min(SCHEDULE_BOUNDS.quietMinuteOfDay.min).max(SCHEDULE_BOUNDS.quietMinuteOfDay.max),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  timeZone: scheduleTimeZoneSchema,
  priority: z.number().int().min(0).max(100),
  values: scheduledSettingsValuesSchema,
  source: scheduledSettingSourceSchema.default({ kind: 'local' }),
}).strict().superRefine((rule, ctx) => {
  if (rule.startDate && rule.endDate && rule.startDate > rule.endDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after start date.' });
  if (rule.startMinute === rule.endMinute) ctx.addIssue({ code: 'custom', path: ['endMinute'], message: 'A scheduled window must not start and end at the same minute.' });
  if (new Set(rule.weekdays).size !== rule.weekdays.length) ctx.addIssue({ code: 'custom', path: ['weekdays'], message: 'Choose each weekday at most once.' });
});

export type ScheduledSettingRule = z.infer<typeof scheduledSettingRuleSchema>;

export const scheduleSchema = z
  .object({
    schemaVersion: z.literal(3),
    selfUpdate: z
      .object({
        repeatEnabled: z.boolean(),
        intervalMinutes: z.number().int().min(SCHEDULE_BOUNDS.selfUpdateMinutes.min).max(SCHEDULE_BOUNDS.selfUpdateMinutes.max),
      })
      .strict(),
    catalogRefresh: z
      .object({
        enabled: z.boolean(),
        intervalMinutes: z.number().int().min(SCHEDULE_BOUNDS.catalogMinutes.min).max(SCHEDULE_BOUNDS.catalogMinutes.max),
      })
      .strict(),
    quietHours: z
      .object({
        enabled: z.boolean(),
        startMinute: z.number().int().min(SCHEDULE_BOUNDS.quietMinuteOfDay.min).max(SCHEDULE_BOUNDS.quietMinuteOfDay.max),
        endMinute: z.number().int().min(SCHEDULE_BOUNDS.quietMinuteOfDay.min).max(SCHEDULE_BOUNDS.quietMinuteOfDay.max),
      })
      .strict()
      .refine((quiet) => !quiet.enabled || quiet.startMinute !== quiet.endMinute, {
        path: ['endMinute'],
        message: 'Quiet hours must not start and end at the same minute.',
      })
      .refine(
        (quiet) => !quiet.enabled || ((quiet.endMinute - quiet.startMinute + 1440) % 1440) >= SCHEDULE_BOUNDS.quietMinSpanMinutes,
        { path: ['endMinute'], message: `Quiet hours must span at least ${SCHEDULE_BOUNDS.quietMinSpanMinutes} minutes.` },
      ),
    rules: z.array(scheduledSettingRuleSchema).max(SCHEDULE_BOUNDS.ruleCount.max),
  })
  .strict();

export type ScheduleConfig = z.infer<typeof scheduleSchema>;

export const DEFAULT_SCHEDULE: ScheduleConfig = {
  schemaVersion: 3,
  selfUpdate: { repeatEnabled: true, intervalMinutes: 360 },
  catalogRefresh: { enabled: true, intervalMinutes: 360 },
  quietHours: { enabled: false, startMinute: 1320, endMinute: 420 },
  rules: [],
};

export type ScheduleTaskId = 'self-update' | 'catalog-refresh';
export type ScheduleOutcome = 'ok' | 'failed' | 'skipped';
export type ScheduleTrigger = 'startup' | 'schedule' | 'catch-up' | 'manual';

export interface ScheduleTaskResult {
  outcome: ScheduleOutcome;
  message: string;
}

export interface ScheduleRunRecord {
  at: string;
  outcome: ScheduleOutcome;
  message: string;
  trigger: ScheduleTrigger;
  durationMs: number;
  fromPreviousSession: boolean;
}

export interface ScheduleTaskStatus {
  id: ScheduleTaskId;
  armed: boolean;
  running: boolean;
  intervalMinutes: number;
  nextRunAt: string | null;
  nextRunIsBackoff: boolean;
  consecutiveFailures: number;
  lastRun: ScheduleRunRecord | null;
}

export interface ScheduleNotice {
  id: string;
  level: 'info' | 'error';
  en: string;
  yue: string;
  silent: boolean;
}

export interface ExternalScheduleSourceStatus {
  ruleId: string;
  kind: ScheduledSettingSource['kind'];
  state: 'idle' | 'active' | 'off' | 'failed';
  checkedAt: string | null;
  message: string | null;
  /** Only validated, allowlisted settings are exposed; URLs and credentials are never echoed here. */
  values: Partial<Pick<UserSettings, 'language' | 'englishFunnyLevel' | 'cantoneseFunnyLevel' | 'theme' | 'density' | 'accent' | 'displayName'>> | null;
}

export interface ScheduleStatus {
  config: ScheduleConfig;
  /** Whether the active configuration came from a validated file or DEFAULT_SCHEDULE. */
  configSource: SettingsValueSource;
  tasks: Record<ScheduleTaskId, ScheduleTaskStatus>;
  startupCheck: ScheduleRunRecord | null;
  quietHours: { active: boolean; timeZone: string; nextChangeAt: string | null; heldSinceQuietStart: number };
  packagedBuild: boolean;
  now: string;
  notice: ScheduleNotice | null;
  externalSources: ExternalScheduleSourceStatus[];
}

export interface DimSumSurprise {
  available: boolean;
  id?: string;
  nameEn?: string;
  nameZhHant?: string;
  photoUrl?: string;
  alt?: string;
  reason?: string;
}

/**
 * Local-only authenticator contracts. A secret crosses the typed preview
 * request boundary only for one calculation; it is never part of a response,
 * settings document, history entry, export, notification, or log.
 */
export const AUTHENTICATOR_ALGORITHMS = ['sha1', 'sha256', 'sha512'] as const;
export type AuthenticatorAlgorithm = (typeof AUTHENTICATOR_ALGORITHMS)[number];
export const AUTHENTICATOR_DIGITS = [6, 7, 8] as const;
export type AuthenticatorDigits = (typeof AUTHENTICATOR_DIGITS)[number];
export const AUTHENTICATOR_MAX_SECRET_LENGTH = 256;
export const AUTHENTICATOR_MAX_ENTRIES = 256;
export const AUTHENTICATOR_MAX_ISSUER_LENGTH = 128;
export const AUTHENTICATOR_MAX_ACCOUNT_LENGTH = 256;
export const AUTHENTICATOR_MAX_URI_LENGTH = 2_048;
export const AUTHENTICATOR_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const AUTHENTICATOR_MAX_IMAGE_DIMENSION = 4_096;
export const AUTHENTICATOR_MAX_IMAGE_PIXELS = 16_777_216;
export const AUTHENTICATOR_MAX_LABEL_LENGTH = 512;
export const AUTHENTICATOR_MAX_GROUP_LENGTH = 64;
export const AUTHENTICATOR_MAX_GROUPS = 64;
export const AUTHENTICATOR_MAX_EXPORT_LENGTH = 512_000;
export const AUTHENTICATOR_MAX_SECRET_EXPORT_LENGTH = 512_000;

export interface AuthenticatorEntryMetadata {
  id: string;
  issuer: string;
  account: string;
  label: string;
  algorithm: AuthenticatorAlgorithm;
  digits: AuthenticatorDigits;
  periodSeconds: number;
  createdAt: string;
  updatedAt: string;
  order: number;
  /** User-managed group membership; null means ungrouped. */
  group: string | null;
  /** Stable group entity membership. Legacy v1/v2 records may omit this during read migration. */
  groupId?: string | null;
}

export interface AuthenticatorGroup {
  id: string;
  name: string;
  color: string;
  order: number;
  collapsed: boolean;
}

export interface AuthenticatorEntry extends AuthenticatorEntryMetadata {
  /** Current code is calculated in the main process and is never a secret. */
  code: string | null;
  /** The next period code is calculated in the main process for rollover planning. */
  nextCode: string | null;
  remainingSeconds: number | null;
  expiresAt: string | null;
}

export interface AuthenticatorQrMatrix {
  schemaVersion: 1;
  size: number;
  /** One bounded row per module; values are only `0` and `1`. */
  modules: string[];
  errorCorrectionLevel: 'M';
}

export type AuthenticatorRegistrationRequest =
  | { source: 'otpauth-uri'; uri: string; attemptId?: string }
  | {
      source: 'manual';
      /** Renderer-owned one-shot id used only to cancel a lost prepare response. */
      attemptId?: string;
      secret: string;
      issuer: string;
      account: string;
      algorithm: AuthenticatorAlgorithm;
      digits: AuthenticatorDigits;
      periodSeconds: number;
    };

export interface AuthenticatorRegistrationPreviewResult {
  ok: boolean;
  registrationId?: string;
  metadata?: AuthenticatorEntryMetadata;
  qr?: AuthenticatorQrMatrix;
  storage: 'memory-only' | 'os-vault';
  message: string;
  messageYue: string;
}

export interface AuthenticatorRegistrationConfirmRequest {
  registrationId: string;
  code: string;
}

export type AuthenticatorQrImageImportReason = 'cancelled' | 'read-failed' | 'too-large' | 'unsupported-image' | 'no-qr' | 'invalid-otpauth';

/** A one-shot local image import result. The URI is never persisted by this route. */
export interface AuthenticatorQrImageImportResult {
  ok: boolean;
  uri?: string;
  reason?: AuthenticatorQrImageImportReason;
  message: string;
  messageYue: string;
}

export const AUTHENTICATOR_CAMERA_SESSION_MS = 45_000;
export const AUTHENTICATOR_CAMERA_SCAN_MS = 30_000;
export const AUTHENTICATOR_CAMERA_MAX_DIMENSION = 1_024;
export const AUTHENTICATOR_CAMERA_MAX_PIXELS = 1_048_576;

export type AuthenticatorCameraSessionFailureReason = 'restricted' | 'busy' | 'focus-required' | 'unavailable';

/** A short-lived video-permission lease; camera frames and decoded values never use this bridge. */
export type AuthenticatorCameraSessionStartResult =
  | { ok: true; sessionId: string; expiresAt: string; message: string; messageYue: string }
  | { ok: false; reason: AuthenticatorCameraSessionFailureReason; message: string; messageYue: string };

export interface AuthenticatorCameraSessionStopRequest { sessionId: string; }
export interface AuthenticatorCameraSessionStopResult { ok: boolean; message: string; messageYue: string; }

export interface AuthenticatorEntryIdRequest {
  entryId: string;
}

export interface AuthenticatorRenameRequest extends AuthenticatorEntryIdRequest {
  label: string;
}

export interface AuthenticatorGroupRequest extends AuthenticatorEntryIdRequest {
  /** Stable group id; null removes membership. */
  groupId?: string | null;
  /** Legacy label input is accepted only as a migration bridge and is converted to an entity. */
  group?: string | null;
}

export interface AuthenticatorGroupCreateRequest { name: string; color?: string; }
export interface AuthenticatorGroupIdRequest { groupId: string; }
export interface AuthenticatorGroupRenameRequest extends AuthenticatorGroupIdRequest { name: string; }
export interface AuthenticatorGroupReorderRequest extends AuthenticatorGroupIdRequest { order: number; }
export interface AuthenticatorGroupCollapseRequest extends AuthenticatorGroupIdRequest { collapsed: boolean; }
export interface AuthenticatorGroupDeleteRequest extends AuthenticatorGroupIdRequest { confirmed: true; }
export interface AuthenticatorGroupBulkMoveRequest { entryIds: string[]; groupId: string | null; }

export interface AuthenticatorGroupMutationResult {
  ok: boolean;
  group?: AuthenticatorGroup;
  message: string;
  messageYue: string;
}
export interface AuthenticatorGroupListResult {
  groups: AuthenticatorGroup[];
  message: string;
  messageYue: string;
}
export interface AuthenticatorGroupBulkMoveResult {
  ok: boolean;
  movedIds: string[];
  skippedIds: string[];
  message: string;
  messageYue: string;
}

export interface AuthenticatorReorderRequest extends AuthenticatorEntryIdRequest {
  order: number;
}

export interface AuthenticatorDeleteRequest extends AuthenticatorEntryIdRequest {
  /** Set only after the renderer's native super-confirmation completes. */
  confirmed: true;
}

export interface AuthenticatorBulkDeleteRequest {
  entryIds: string[];
  /** Set only after the renderer's native super-confirmation completes. */
  confirmed: true;
}

export type AuthenticatorExportFormat = 'json' | 'csv' | 'markdown';

export interface AuthenticatorExportRequest {
  entryIds: string[];
  format: AuthenticatorExportFormat;
}

export interface AuthenticatorMutationResult {
  ok: boolean;
  entry?: AuthenticatorEntryMetadata;
  /** The pairing may have been published while rollback/visibility was uncertain; do not retry it. */
  uncertain?: boolean;
  message: string;
  messageYue: string;
}

export interface AuthenticatorDeleteResult {
  ok: boolean;
  deletedId?: string;
  /** The vault may have committed while rollback/visibility was uncertain; keep the item under review. */
  uncertain?: boolean;
  message: string;
  messageYue: string;
}

export interface AuthenticatorBulkDeleteResult {
  ok: boolean;
  deletedIds: string[];
  skippedIds: string[];
  /** Entries whose deletion was committed but whose rollback/visibility could not be verified; always a subset of deletedIds. */
  uncertainIds: string[];
  message: string;
  messageYue: string;
}

export interface AuthenticatorExportResult {
  ok: boolean;
  format?: AuthenticatorExportFormat;
  filename?: string;
  content?: string;
  omittedFields: AuthenticatorExportOmittedField[];
  message: string;
  messageYue: string;
}

/** Deliberate, user-authorized export of credential-vault secrets. The
 * response contains status only; secret bytes never cross the main/preload
 * boundary. */
export type AuthenticatorSecretExportFormat = 'json' | 'csv';
export interface AuthenticatorSecretExportRequest {
  entryIds: string[];
  format: AuthenticatorSecretExportFormat;
  /** Main-process-issued, single-use authorization bound to this selection and format. */
  authorizationToken: string;
}
export interface AuthenticatorSecretExportAuthorizationRequest {
  entryIds: string[];
  format: AuthenticatorSecretExportFormat;
}
export type AuthenticatorSecretExportReason = 'cancelled' | 'invalid' | 'restricted' | 'unavailable' | 'write-failed' | 'too-large' | 'busy';
export interface AuthenticatorSecretExportResult {
  ok: boolean;
  reason?: AuthenticatorSecretExportReason;
  filename?: string;
  entryCount: number;
  message: string;
  messageYue: string;
}

export type AuthenticatorExportOmittedField = 'secret' | 'uri' | 'code' | 'nextCode' | 'remainingSeconds' | 'expiresAt';

export interface AuthenticatorListResult {
  entries: AuthenticatorEntry[];
  groups: AuthenticatorGroup[];
  storage: 'memory-only' | 'os-vault';
  message: string;
  messageYue: string;
}

export interface AuthenticatorStatus {
  available: boolean;
  vault: 'unavailable' | 'os-credential-vault';
  entryCount: number;
  checkedAt: string;
  message: string;
  messageYue: string;
}

export interface AuthenticatorPreviewRequest {
  secret: string;
  algorithm: AuthenticatorAlgorithm;
  digits: AuthenticatorDigits;
  periodSeconds: number;
  /** Optional deterministic timestamp for tests; the UI omits it. */
  atMs?: number;
}

export interface AuthenticatorPreviewResult {
  ok: boolean;
  code?: string;
  remainingSeconds?: number;
  expiresAt?: string;
  algorithm?: AuthenticatorAlgorithm;
  digits?: AuthenticatorDigits;
  periodSeconds?: number;
  storage: 'memory-only' | 'os-vault';
  message: string;
  messageYue: string;
}

export type ScheduleSaveResult =
  | { ok: true; status: ScheduleStatus }
  | { ok: false; message: string; issues: Array<{ field: string; message: string }> };

export interface DingDingStoreApi {
  /** Privileged adapter accepts only a 40-hex SHA and constructs the fixed repository commit URL. */
  externalNavigation?: {
    openCommit(commit: string): Promise<OperationResult>;
  };
  /** Optional until the privileged detection/write/open adapter is implemented and reviewed. */
  externalEditor?: {
    detect(): Promise<ExternalEditorCandidate[]>;
    preference(): Promise<ExternalEditorPreference>;
    setPreference(preference: ExternalEditorPreference): Promise<ExternalEditorPreference>;
    addValidated(): Promise<ExternalEditorCandidate | null>;
    openExport(request: ExternalEditorOpenRequest): Promise<ExternalEditorResult>;
    openArchive(request: ExternalEditorOpenArchiveRequest): Promise<ExternalEditorResult>;
  };
  catalog: {
    list(): Promise<CatalogSnapshot>;
    refresh(): Promise<CatalogSnapshot>;
  };
  operations: {
    install(request: OperationRequest): Promise<OperationResult>;
    cancelInstall(request: InstallCancelRequest): Promise<OperationResult>;
    status(): Promise<OperationProgressEvent[]>;
    subscribe(listener: (event: Readonly<OperationProgressEvent>) => void): () => void;
    build(request: OperationRequest): Promise<OperationResult>;
    uninstall(request: OperationRequest): Promise<OperationResult>;
    installed(discover?: boolean): Promise<InstalledAppRecord[]>;
  };
  sourceJobs: {
    start(request: SourceJobRequest): Promise<SourceJobStartResult>;
    cancel(request: SourceJobCancelRequest): Promise<SourceJobStartResult>;
    retry(request: SourceJobRetryRequest): Promise<SourceJobStartResult>;
    status(): Promise<SourceIsolationStatus>;
    subscribe(listener: (event: Readonly<SourceTerminalEvent>) => void): () => void;
  };
  updates: {
    checkCatalog(): Promise<CatalogSnapshot>;
    checkStore(): Promise<AppStoreUpdateState>;
    downloadStore(): Promise<AppStoreUpdateState>;
    restartStore(): Promise<OperationResult>;
    cancelStoreDownload(): Promise<AppStoreUpdateState>;
    openReleaseNotes(url: string): Promise<OperationResult>;
    checkApp(appId: string): Promise<ManagedUpdateState>;
    downloadApp(request: ManagedUpdateRequest): Promise<ManagedUpdateState>;
    cancelApp(request: ManagedUpdateCancelRequest): Promise<ManagedUpdateState>;
    restartApp(request: ManagedUpdateRequest): Promise<OperationResult>;
    subscribeApp(listener: (state: ManagedUpdateState) => void): () => void;
    subscribe(listener: (state: AppStoreUpdateState) => void): () => void;
  };
  settings: {
    load(): Promise<UserSettings>;
    save(settings: UserSettings): Promise<UserSettings>;
    provenance(): Promise<SettingsProvenance>;
  };
  personalVocabulary: {
    status(): Promise<PersonalVocabularyStatus>;
    importFromFile(): Promise<PersonalVocabularyImportResult>;
    clear(): Promise<PersonalVocabularyStatus>;
  };
  schoolMode: {
    load(): Promise<SchoolModeSnapshot>;
    configure(request: SchoolModeConfigureRequest): Promise<SchoolModeMutationResult>;
    rename(request: SchoolModeRenameRequest): Promise<SchoolModeMutationResult>;
    setEnabled(request: SchoolModeToggleRequest): Promise<SchoolModeMutationResult>;
    changeCredential(request: SchoolModeCredentialChangeRequest): Promise<SchoolModeMutationResult>;
    verify(request: SchoolModeVerifyRequest): Promise<boolean>;
    subscribe(listener: (snapshot: SchoolModeSnapshot) => void, onUnavailable?: () => void): () => void;
  };
  locks: {
    load(): Promise<LockState>;
    set(request: LockSetRequest): Promise<LockMutationResult>;
    unlock(request: LockCredentialRequest): Promise<LockMutationResult>;
    lockAgain(target: LockTarget): Promise<LockMutationResult>;
    remove(request: LockCredentialRequest): Promise<LockMutationResult>;
  };
  support: {
    load(): Promise<SupportState>;
    create(request: SupportTicketCreateRequest): Promise<SupportTicketMutationResult>;
    advance(ticketId: string): Promise<SupportTicketMutationResult>;
    bulkAdvance(request: SupportTicketBulkAdvanceRequest): Promise<SupportTicketBulkAdvanceResult>;
    openRecoveryFolder(): Promise<SupportOpenRecoveryResult>;
  };
  history: {
    protectedStatus(): Promise<HistoryAccessStatus>;
    protectedUnlock(request: HistoryAccessUnlockRequest): Promise<HistoryAccessResult>;
    protectedLockAgain(): Promise<HistoryAccessResult>;
    list(): Promise<HistoryEntry[]>;
    export(format: HistoryExportFormat): Promise<string>;
  archive(request: HistoryArchiveRequest): Promise<HistoryArchiveExport>;
    archive7z(request: History7zRequest): Promise<History7zExportResult>;
    revisions(): Promise<HistoryRevision[]>;
    diff(revisionId: string): Promise<string>;
    label(revisionId: string, label: string): Promise<HistoryMutationResult>;
    restore(revisionId: string): Promise<HistoryMutationResult>;
  };
  workspace: {
    load(): Promise<TabWorkspace>;
    save(value: TabWorkspace): Promise<TabWorkspace>;
    reset(): Promise<TabWorkspace>;
    export(): Promise<string>;
    import(document: string): Promise<TabWorkspace>;
  };
  appearance: {
    load(): Promise<AppearanceDocument>;
    setElement(key: ElementKey, override: ElementOverride): Promise<AppearanceDocument>;
    resetElement(key: ElementKey): Promise<AppearanceDocument>;
    resetAll(): Promise<AppearanceDocument>;
    export(): Promise<string>;
    import(payload: string): Promise<AppearanceImportResult>;
  };
  schedule: {
    load(): Promise<ScheduleStatus>;
    save(config: ScheduleConfig): Promise<ScheduleSaveResult>;
    runNow(task: ScheduleTaskId): Promise<ScheduleStatus>;
    subscribe(listener: (status: ScheduleStatus) => void): () => void;
  };
  authenticator: {
    prepareFromClipboard(attemptId?: string): Promise<AuthenticatorRegistrationPreviewResult>;
    importQrImage(): Promise<AuthenticatorQrImageImportResult>;
    startCameraSession(): Promise<AuthenticatorCameraSessionStartResult>;
    stopCameraSession(request: AuthenticatorCameraSessionStopRequest): Promise<AuthenticatorCameraSessionStopResult>;
    status(): Promise<AuthenticatorStatus>;
    preview(request: AuthenticatorPreviewRequest): Promise<AuthenticatorPreviewResult>;
    prepare(request: AuthenticatorRegistrationRequest): Promise<AuthenticatorRegistrationPreviewResult>;
    cancelAttempt(attemptId: string): Promise<void>;
    confirm(request: AuthenticatorRegistrationConfirmRequest): Promise<AuthenticatorMutationResult>;
    cancel(registrationId: string): Promise<void>;
    list(): Promise<AuthenticatorListResult>;
    createGroup(request: AuthenticatorGroupCreateRequest): Promise<AuthenticatorGroupMutationResult>;
    renameGroup(request: AuthenticatorGroupRenameRequest): Promise<AuthenticatorGroupMutationResult>;
    reorderGroup(request: AuthenticatorGroupReorderRequest): Promise<AuthenticatorGroupMutationResult>;
    collapseGroup(request: AuthenticatorGroupCollapseRequest): Promise<AuthenticatorGroupMutationResult>;
    deleteGroup(request: AuthenticatorGroupDeleteRequest): Promise<AuthenticatorGroupMutationResult>;
    moveToGroup(request: AuthenticatorGroupBulkMoveRequest): Promise<AuthenticatorGroupBulkMoveResult>;
    rename(request: AuthenticatorRenameRequest): Promise<AuthenticatorMutationResult>;
    setGroup(request: AuthenticatorGroupRequest): Promise<AuthenticatorMutationResult>;
    reorder(request: AuthenticatorReorderRequest): Promise<AuthenticatorMutationResult>;
    remove(request: AuthenticatorDeleteRequest): Promise<AuthenticatorDeleteResult>;
    bulkRemove(request: AuthenticatorBulkDeleteRequest): Promise<AuthenticatorBulkDeleteResult>;
    export(request: AuthenticatorExportRequest): Promise<AuthenticatorExportResult>;
    secretExport(request: AuthenticatorSecretExportRequest): Promise<AuthenticatorSecretExportResult>;
    authorizeSecretExport(request: AuthenticatorSecretExportAuthorizationRequest): Promise<{ ok: boolean; authorizationToken?: string; message: string; messageYue: string }>;
  };
  dimSum: {
    startup(): Promise<DimSumSurprise>;
  };
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
  };
}
