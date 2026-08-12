import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppStoreUpdateState,
  AuthenticatorPreviewRequest,
  AuthenticatorPreviewResult,
  AuthenticatorBulkDeleteRequest,
  AuthenticatorBulkDeleteResult,
  AuthenticatorDeleteRequest,
  AuthenticatorDeleteResult,
  AuthenticatorExportRequest,
  AuthenticatorExportResult,
  AuthenticatorSecretExportRequest,
  AuthenticatorSecretExportResult,
  AuthenticatorSecretExportAuthorizationRequest,
  AuthenticatorGroupRequest,
  AuthenticatorGroupCreateRequest,
  AuthenticatorGroupRenameRequest,
  AuthenticatorGroupReorderRequest,
  AuthenticatorGroupDeleteRequest,
  AuthenticatorGroupBulkMoveRequest,
  AuthenticatorGroupCollapseRequest,
  AuthenticatorGroupMutationResult,
  AuthenticatorRenameRequest,
  AuthenticatorReorderRequest,
  AuthenticatorListResult,
  AuthenticatorMutationResult,
  AuthenticatorRegistrationConfirmRequest,
  AuthenticatorRegistrationPreviewResult,
  AuthenticatorRegistrationRequest,
  AuthenticatorStatus,
  AuthenticatorQrImageImportResult,
  AuthenticatorCameraSessionStartResult,
  AuthenticatorCameraSessionStopRequest,
  AuthenticatorCameraSessionStopResult,
  DingDingStoreApi,
  DimSumSurprise,
  ElementKey,
  ElementOverride,
  ExternalEditorOpenRequest,
  ExternalEditorOpenArchiveRequest,
  ExternalEditorPreference,
  HistoryArchiveExport,
  HistoryArchiveRequest,
  HistoryAccessUnlockRequest,
  HistoryAccessResult,
  HistoryAccessStatus,
  HistoryExportFormat,
  HistoryMutationResult,
  HistoryRevision,
  InstallCancelRequest,
  LockCredentialRequest,
  LockSetRequest,
  LockState,
  LockTarget,
  ManagedUpdateCancelRequest,
  ManagedUpdateRequest,
  ManagedUpdateState,
  OperationProgressEvent,
  OperationRequest,
  ScheduleConfig,
  ScheduleStatus,
  ScheduleTaskId,
  SchoolModeCredentialChangeRequest,
  SchoolModeConfigureRequest,
  SchoolModeRenameRequest,
  SchoolModeSnapshot,
  SchoolModeToggleRequest,
  SchoolModeVerifyRequest,
  SourceJobCancelRequest,
  SourceJobRetryRequest,
  SourceJobRequest,
  SourceIsolationStatus,
  SourceTerminalEvent,
  SupportState,
  SupportTicketCreateRequest,
  SupportTicketBulkAdvanceRequest,
  TabWorkspace,
  SettingsProvenance,
  UserSettings,
  PersonalVocabularyImportResult,
  PersonalVocabularyStatus,
} from '../shared/contracts.js';
import {
  parseSchoolModeMutationResult,
  parseSchoolModeSnapshot,
  parseSchoolModeVerifyResult,
} from './school-mode-parser.js';
import { parseHistoryAccessResult, parseHistoryAccessStatus } from './history-access-parser.js';
import { parseLockCredentialRequest, parseLockMutationResult, parseLockSetRequest, parseLockState, parseLockTarget } from './lock-parser.js';
import { parseSupportState, parseSupportTicketBulkAdvanceRequest, parseSupportTicketBulkAdvanceResult, parseSupportTicketMutationResult } from './support-parser.js';
const SOURCE_STATES = new Set(['queued', 'preparing', 'running', 'repairing', 'cancelling', 'succeeded', 'failed', 'cancelled']);
const SOURCE_STREAMS = new Set(['system', 'progress', 'stdout', 'stderr']);
const SOURCE_EVENT_KEYS = new Set(['jobId', 'appId', 'sequence', 'at', 'stream', 'state', 'text', 'progress', 'final']);
const OPERATION_PHASES = new Set(['queued', 'resolving', 'downloading', 'extracting', 'launching', 'committing', 'installer-running', 'cancelling', 'succeeded', 'failed', 'cancelled', 'unknown']);
const OPERATION_EVENT_KEYS = new Set(['operationId', 'appId', 'kind', 'phase', 'progress', 'bytesReceived', 'bytesTotal', 'cancellable', 'locked', 'message', 'final']);
function parsePersonalVocabularyStatus(value: unknown): PersonalVocabularyStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The personal vocabulary response was invalid.');
  const result = value as Record<string, unknown>;
  const keys = new Set(['loaded', 'entryCount', 'entries', 'message', 'messageYue']);
  const validEntry = (entry: unknown): entry is { source: string; replacement: string } => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
    const record = entry as Record<string, unknown>;
    return typeof record.source === 'string' && record.source.length >= 1 && record.source.length <= 128 && typeof record.replacement === 'string' && record.replacement.length >= 1 && record.replacement.length <= 256;
  };
  if (Object.keys(result).some((key) => !keys.has(key)) || typeof result.loaded !== 'boolean' || !Number.isInteger(result.entryCount) || Number(result.entryCount) < 0 || Number(result.entryCount) > 256 || !Array.isArray(result.entries) || result.entries.length > 256 || result.entries.some((entry) => !validEntry(entry)) || typeof result.message !== 'string' || result.message.length > 512 || typeof result.messageYue !== 'string' || result.messageYue.length > 512) throw new Error('The personal vocabulary response was invalid.');
  const entries = (result.entries as unknown[]).map((entry: unknown) => { const record = entry as Record<string, unknown>; return { source: String(record.source), replacement: String(record.replacement) }; });
  return Object.freeze({ loaded: result.loaded, entryCount: Number(result.entryCount), entries, message: result.message, messageYue: result.messageYue });
}
function parsePersonalVocabularyImport(value: unknown): PersonalVocabularyImportResult {
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof (value as Record<string, unknown>).ok !== 'boolean') throw new Error('The personal vocabulary import response was invalid.');
  const raw = value as Record<string, unknown>;
  const status = parsePersonalVocabularyStatus({ loaded: raw.loaded, entryCount: raw.entryCount, entries: raw.entries, message: raw.message, messageYue: raw.messageYue });
  return Object.freeze({ ...status, ok: Boolean((value as Record<string, unknown>).ok) });
}
// Keep preload validation self-contained: this boundary must not load runtime
// values from the shared contract module into the renderer bundle.
const AUTHENTICATOR_ALGORITHM_SET = new Set<string>(['sha1', 'sha256', 'sha512']);
const AUTHENTICATOR_DIGIT_SET = new Set<number>([6, 7, 8]);
const AUTHENTICATOR_STORAGE_SET = new Set<string>(['memory-only', 'os-vault']);
const AUTHENTICATOR_MAX_ENTRIES = 256;
const AUTHENTICATOR_MAX_ISSUER_LENGTH = 128;
const AUTHENTICATOR_MAX_ACCOUNT_LENGTH = 256;
const AUTHENTICATOR_MAX_LABEL_LENGTH = 512;
const AUTHENTICATOR_MAX_GROUP_LENGTH = 64;
const AUTHENTICATOR_MAX_GROUPS = 64;
const AUTHENTICATOR_MAX_EXPORT_LENGTH = 512_000;
const AUTHENTICATOR_EXPORT_OMITTED_FIELDS = ['secret', 'uri', 'code', 'nextCode', 'remainingSeconds', 'expiresAt'] as const;

function parseAuthenticatorQrImageImport(value: unknown): AuthenticatorQrImageImportResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator QR image response was invalid.');
  const result = value as Record<string, unknown>;
  const keys = new Set(['ok', 'uri', 'reason', 'message', 'messageYue']);
  const reasons = new Set(['cancelled', 'read-failed', 'too-large', 'unsupported-image', 'no-qr', 'invalid-otpauth']);
  if (Object.keys(result).some((key) => !keys.has(key)) || typeof result.ok !== 'boolean' || typeof result.message !== 'string' || new TextEncoder().encode(result.message).byteLength > 2_048 || typeof result.messageYue !== 'string' || new TextEncoder().encode(result.messageYue).byteLength > 2_048 || (result.reason !== undefined && (typeof result.reason !== 'string' || !reasons.has(result.reason))) || (result.uri !== undefined && (typeof result.uri !== 'string' || new TextEncoder().encode(result.uri).byteLength < 1 || new TextEncoder().encode(result.uri).byteLength > 2_048 || !/^otpauth:\/\/totp\//i.test(result.uri)))) throw new Error('The authenticator QR image response was invalid.');
  if (result.ok !== (typeof result.uri === 'string')) throw new Error('The authenticator QR image response was invalid.');
  if (!result.ok && (typeof result.reason !== 'string' || !reasons.has(result.reason))) throw new Error('The authenticator QR image response was invalid.');
  if (result.ok && result.reason !== undefined) throw new Error('The authenticator QR image response was invalid.');
  if (!result.ok && result.uri !== undefined) throw new Error('The authenticator QR image response was invalid.');
  return Object.freeze({ ok: result.ok, uri: result.uri as string | undefined, reason: result.reason as AuthenticatorQrImageImportResult['reason'], message: result.message, messageYue: result.messageYue });
}

function parseAuthenticatorCameraSessionStart(value: unknown): AuthenticatorCameraSessionStartResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator camera-session response was invalid.');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !['ok', 'sessionId', 'expiresAt', 'reason', 'message', 'messageYue'].includes(key)) || typeof result.ok !== 'boolean' || typeof result.message !== 'string' || result.message.length > 512 || typeof result.messageYue !== 'string' || result.messageYue.length > 512) throw new Error('The authenticator camera-session response was invalid.');
  if (result.ok) {
    if (typeof result.sessionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.sessionId) || typeof result.expiresAt !== 'string' || !Number.isFinite(Date.parse(result.expiresAt)) || result.reason !== undefined) throw new Error('The authenticator camera-session response was invalid.');
    return Object.freeze({ ok: true, sessionId: result.sessionId, expiresAt: result.expiresAt, message: result.message, messageYue: result.messageYue });
  }
  if (!['restricted', 'busy', 'focus-required', 'unavailable'].includes(String(result.reason)) || result.sessionId !== undefined || result.expiresAt !== undefined) throw new Error('The authenticator camera-session response was invalid.');
  return Object.freeze({ ok: false, reason: result.reason as 'restricted' | 'busy' | 'focus-required' | 'unavailable', message: result.message, messageYue: result.messageYue });
}

function parseAuthenticatorCameraSessionStop(value: unknown): AuthenticatorCameraSessionStopResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator camera-stop response was invalid.');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !['ok', 'message', 'messageYue'].includes(key)) || typeof result.ok !== 'boolean' || typeof result.message !== 'string' || result.message.length > 512 || typeof result.messageYue !== 'string' || result.messageYue.length > 512) throw new Error('The authenticator camera-stop response was invalid.');
  return Object.freeze({ ok: result.ok, message: result.message, messageYue: result.messageYue });
}

function parseAuthenticatorStatus(value: unknown): AuthenticatorStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator status response was invalid.');
  const status = value as Record<string, unknown>;
  const statusKeys = new Set(['available', 'vault', 'entryCount', 'checkedAt', 'message', 'messageYue']);
  if (Object.keys(status).some((key) => !statusKeys.has(key))) throw new Error('The authenticator status response was invalid.');
  if (typeof status.available !== 'boolean' || (status.vault !== 'unavailable' && status.vault !== 'os-credential-vault') || !Number.isInteger(status.entryCount) || Number(status.entryCount) < 0 || Number(status.entryCount) > 10_000 || typeof status.checkedAt !== 'string' || !Number.isFinite(Date.parse(status.checkedAt)) || typeof status.message !== 'string' || status.message.length > 512 || typeof status.messageYue !== 'string' || status.messageYue.length > 512) throw new Error('The authenticator status response was invalid.');
  return Object.freeze({ available: status.available, vault: status.vault, entryCount: Number(status.entryCount), checkedAt: status.checkedAt, message: status.message, messageYue: status.messageYue });
}

function parseAuthenticatorPreviewResult(value: unknown): AuthenticatorPreviewResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator preview response was invalid.');
  const result = value as Record<string, unknown>;
  const resultKeys = new Set(['ok', 'code', 'remainingSeconds', 'expiresAt', 'algorithm', 'digits', 'periodSeconds', 'storage', 'message', 'messageYue']);
  if (Object.keys(result).some((key) => !resultKeys.has(key))) throw new Error('The authenticator preview response was invalid.');
  if (typeof result.ok !== 'boolean' || (result.storage !== 'memory-only' && result.storage !== 'os-vault') || typeof result.message !== 'string' || result.message.length > 512 || typeof result.messageYue !== 'string' || result.messageYue.length > 512) throw new Error('The authenticator preview response was invalid.');
  const previewFields = [result.code, result.remainingSeconds, result.expiresAt, result.algorithm, result.digits, result.periodSeconds];
  const previewFieldsComplete = previewFields.every((field) => field !== undefined && field !== null);
  if (result.ok ? !previewFieldsComplete : previewFields.some((field) => field !== undefined)) throw new Error('The authenticator preview response was invalid.');
  if (result.code !== undefined && (typeof result.code !== 'string' || !/^\d{6,8}$/.test(result.code))) throw new Error('The authenticator preview response was invalid.');
  if (result.remainingSeconds !== undefined && (!Number.isInteger(result.remainingSeconds) || Number(result.remainingSeconds) < 0 || Number(result.remainingSeconds) > 3_600)) throw new Error('The authenticator preview response was invalid.');
  if (result.expiresAt !== undefined && (typeof result.expiresAt !== 'string' || !Number.isFinite(Date.parse(result.expiresAt)))) throw new Error('The authenticator preview response was invalid.');
  if (result.algorithm !== undefined && (typeof result.algorithm !== 'string' || !AUTHENTICATOR_ALGORITHM_SET.has(result.algorithm))) throw new Error('The authenticator preview response was invalid.');
  if (result.digits !== undefined && (typeof result.digits !== 'number' || !AUTHENTICATOR_DIGIT_SET.has(result.digits))) throw new Error('The authenticator preview response was invalid.');
  if (result.periodSeconds !== undefined && (!Number.isInteger(result.periodSeconds) || Number(result.periodSeconds) < 1 || Number(result.periodSeconds) > 3_600)) throw new Error('The authenticator preview response was invalid.');
  return Object.freeze({ ok: result.ok, code: result.code as string | undefined, remainingSeconds: result.remainingSeconds as number | undefined, expiresAt: result.expiresAt as string | undefined, algorithm: result.algorithm as AuthenticatorPreviewResult['algorithm'], digits: result.digits as AuthenticatorPreviewResult['digits'], periodSeconds: result.periodSeconds as number | undefined, storage: result.storage, message: result.message, messageYue: result.messageYue });
}

function parseAuthenticatorEntryMetadata(value: unknown): AuthenticatorListResult['entries'][number] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator entry response was invalid.');
  const entry = value as Record<string, unknown>;
  const metadataKeys = new Set(['id', 'issuer', 'account', 'label', 'algorithm', 'digits', 'periodSeconds', 'createdAt', 'updatedAt', 'order', 'group', 'groupId', 'code', 'nextCode', 'remainingSeconds', 'expiresAt']);
  if (Object.keys(entry).some((key) => !metadataKeys.has(key))) throw new Error('The authenticator entry response was invalid.');
  const transientValues = [entry.code, entry.nextCode, entry.remainingSeconds, entry.expiresAt];
  const transientAbsent = transientValues.every((value) => value === null);
  const transientComplete = transientValues.every((value) => value !== null && value !== undefined);
  if (!transientAbsent && !transientComplete) throw new Error('The authenticator entry response was invalid.');
  if (typeof entry.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.id)
    || typeof entry.issuer !== 'string' || entry.issuer.length > AUTHENTICATOR_MAX_ISSUER_LENGTH
    || typeof entry.account !== 'string' || entry.account.length < 1 || entry.account.length > AUTHENTICATOR_MAX_ACCOUNT_LENGTH
    || typeof entry.label !== 'string' || entry.label.length < 1 || entry.label.length > AUTHENTICATOR_MAX_LABEL_LENGTH
    || (entry.group !== undefined && entry.group !== null && (typeof entry.group !== 'string' || entry.group.length < 1 || entry.group.length > AUTHENTICATOR_MAX_GROUP_LENGTH || entry.group.trim() !== entry.group || /[\u0000-\u001f\u007f]/.test(entry.group)))
    || (entry.groupId !== undefined && entry.groupId !== null && (typeof entry.groupId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.groupId)))
    || typeof entry.algorithm !== 'string' || !AUTHENTICATOR_ALGORITHM_SET.has(entry.algorithm)
    || typeof entry.digits !== 'number' || !AUTHENTICATOR_DIGIT_SET.has(entry.digits)
    || !Number.isInteger(entry.periodSeconds) || Number(entry.periodSeconds) < 1 || Number(entry.periodSeconds) > 3_600
    || typeof entry.createdAt !== 'string' || !Number.isFinite(Date.parse(entry.createdAt))
    || typeof entry.updatedAt !== 'string' || !Number.isFinite(Date.parse(entry.updatedAt))
    || !Number.isInteger(entry.order) || Number(entry.order) < 0 || Number(entry.order) >= AUTHENTICATOR_MAX_ENTRIES
    || (entry.code !== null && (typeof entry.code !== 'string' || !new RegExp(`^\\d{${entry.digits}}$`).test(entry.code)))
    || (entry.nextCode !== null && (typeof entry.nextCode !== 'string' || !new RegExp(`^\\d{${entry.digits}}$`).test(entry.nextCode)))
    || (entry.remainingSeconds !== null && (!Number.isInteger(entry.remainingSeconds) || Number(entry.remainingSeconds) < 0 || Number(entry.remainingSeconds) > 3_600))
    || (entry.expiresAt !== null && (typeof entry.expiresAt !== 'string' || !Number.isFinite(Date.parse(entry.expiresAt))))) throw new Error('The authenticator entry response was invalid.');
  return Object.freeze({
    id: entry.id,
    issuer: entry.issuer,
    account: entry.account,
    label: entry.label,
    algorithm: entry.algorithm as AuthenticatorListResult['entries'][number]['algorithm'],
    digits: entry.digits as AuthenticatorListResult['entries'][number]['digits'],
    periodSeconds: Number(entry.periodSeconds),
    createdAt: entry.createdAt,
     updatedAt: entry.updatedAt,
     order: Number(entry.order),
    group: entry.group === undefined || entry.group === null ? null : String(entry.group),
    groupId: entry.groupId === undefined || entry.groupId === null ? null : String(entry.groupId),
    code: entry.code as string | null,
    nextCode: entry.nextCode as string | null,
    remainingSeconds: entry.remainingSeconds as number | null,
    expiresAt: entry.expiresAt as string | null,
  });
}

function parseAuthenticatorMetadata(value: unknown): AuthenticatorRegistrationPreviewResult['metadata'] {
  const parsed = parseAuthenticatorEntryMetadata({ ...(value as Record<string, unknown>), code: null, nextCode: null, remainingSeconds: null, expiresAt: null });
  const { code: _code, nextCode: _nextCode, remainingSeconds: _remainingSeconds, expiresAt: _expiresAt, ...metadata } = parsed;
  return Object.freeze(metadata) as AuthenticatorRegistrationPreviewResult['metadata'];
}

function parseAuthenticatorQr(value: unknown): NonNullable<AuthenticatorRegistrationPreviewResult['qr']> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator QR response was invalid.');
  const qr = value as Record<string, unknown>;
  const keys = new Set(['schemaVersion', 'size', 'modules', 'errorCorrectionLevel']);
  if (Object.keys(qr).some((key) => !keys.has(key)) || qr.schemaVersion !== 1 || qr.errorCorrectionLevel !== 'M' || !Number.isInteger(qr.size) || Number(qr.size) < 21 || Number(qr.size) > 177 || !Array.isArray(qr.modules) || qr.modules.length !== Number(qr.size) || qr.modules.some((row) => typeof row !== 'string' || row.length !== Number(qr.size) || !/^[01]+$/.test(row))) throw new Error('The authenticator QR response was invalid.');
  return Object.freeze({ schemaVersion: 1, size: Number(qr.size), modules: [...qr.modules] as string[], errorCorrectionLevel: 'M' as const });
}

function parseAuthenticatorRegistrationPreview(value: unknown): AuthenticatorRegistrationPreviewResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator registration response was invalid.');
  const result = value as Record<string, unknown>;
  const keys = new Set(['ok', 'registrationId', 'metadata', 'qr', 'storage', 'message', 'messageYue']);
  if (Object.keys(result).some((key) => !keys.has(key)) || typeof result.ok !== 'boolean' || !AUTHENTICATOR_STORAGE_SET.has(String(result.storage)) || typeof result.message !== 'string' || result.message.length > 512 || typeof result.messageYue !== 'string' || result.messageYue.length > 512) throw new Error('The authenticator registration response was invalid.');
  if (!result.ok && ['registrationId', 'metadata', 'qr'].some((key) => Object.prototype.hasOwnProperty.call(result, key))) throw new Error('The authenticator registration response was invalid.');
  if (result.registrationId !== undefined && (typeof result.registrationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.registrationId))) throw new Error('The authenticator registration response was invalid.');
  const metadata = result.metadata === undefined ? undefined : parseAuthenticatorMetadata(result.metadata);
  const qr = result.qr === undefined ? undefined : parseAuthenticatorQr(result.qr);
  if (result.ok && (typeof result.registrationId !== 'string' || result.metadata === undefined || result.qr === undefined)) throw new Error('The authenticator registration response was invalid.');
  return Object.freeze({ ok: result.ok, registrationId: result.registrationId as string | undefined, metadata, qr, storage: result.storage as AuthenticatorRegistrationPreviewResult['storage'], message: result.message, messageYue: result.messageYue });
}

function parseAuthenticatorMutation(value: unknown): AuthenticatorMutationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator mutation response was invalid.');
  const result = value as Record<string, unknown>;
  const keys = new Set(['ok', 'entry', 'uncertain', 'message', 'messageYue']);
  if (Object.keys(result).some((key) => !keys.has(key)) || typeof result.ok !== 'boolean' || (result.uncertain !== undefined && typeof result.uncertain !== 'boolean') || (result.uncertain === true && result.ok) || typeof result.message !== 'string' || result.message.length > 512 || typeof result.messageYue !== 'string' || result.messageYue.length > 512) throw new Error('The authenticator mutation response was invalid.');
  if (result.ok && result.entry === undefined) throw new Error('The authenticator mutation response was invalid.');
  return Object.freeze({ ok: result.ok, entry: result.entry === undefined ? undefined : parseAuthenticatorMetadata(result.entry), uncertain: result.uncertain === true, message: result.message, messageYue: result.messageYue });
}

function parseAuthenticatorGroupMutation(value: unknown): AuthenticatorGroupMutationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator group mutation response was invalid.');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !['ok', 'group', 'message', 'messageYue'].includes(key)) || typeof result.ok !== 'boolean' || typeof result.message !== 'string' || typeof result.messageYue !== 'string') throw new Error('The authenticator group mutation response was invalid.');
  if (result.ok) {
    const group = result.group as Record<string, unknown> | undefined;
    if (!group || typeof group.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(group.id) || typeof group.name !== 'string' || group.name.length < 1 || group.name.length > AUTHENTICATOR_MAX_GROUP_LENGTH || group.name.trim() !== group.name || /[\u0000-\u001f\u007f]/.test(group.name) || typeof group.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(group.color) || typeof group.order !== 'number' || !Number.isInteger(group.order) || group.order < 0 || group.order >= AUTHENTICATOR_MAX_GROUPS || typeof group.collapsed !== 'boolean') throw new Error('The authenticator group mutation response was invalid.');
    return Object.freeze({ ok: true, group: Object.freeze({ id: group.id, name: group.name, color: group.color, order: group.order, collapsed: group.collapsed }), message: result.message, messageYue: result.messageYue });
  }
  if (result.group !== undefined) throw new Error('The authenticator group mutation response was invalid.');
  return Object.freeze({ ok: false, message: result.message, messageYue: result.messageYue });
}

function parseAuthenticatorDelete(value: unknown): AuthenticatorDeleteResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator delete response was invalid.');
  const result = value as Record<string, unknown>;
  const keys = new Set(['ok', 'deletedId', 'uncertain', 'message', 'messageYue']);
  if (Object.keys(result).some((key) => !keys.has(key)) || typeof result.ok !== 'boolean' || (result.uncertain !== undefined && typeof result.uncertain !== 'boolean') || typeof result.message !== 'string' || result.message.length > 512 || typeof result.messageYue !== 'string' || result.messageYue.length > 512) throw new Error('The authenticator delete response was invalid.');
  if (result.deletedId !== undefined && (typeof result.deletedId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.deletedId))) throw new Error('The authenticator delete response was invalid.');
  if ((result.ok && result.deletedId === undefined) || (result.uncertain && (result.ok || result.deletedId === undefined))) throw new Error('The authenticator delete response was invalid.');
  return Object.freeze({ ok: result.ok, deletedId: result.deletedId as string | undefined, uncertain: result.uncertain === true, message: result.message, messageYue: result.messageYue });
}

function parseAuthenticatorBulkDelete(value: unknown): AuthenticatorBulkDeleteResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator bulk-delete response was invalid.');
  const result = value as Record<string, unknown>;
  const keys = new Set(['ok', 'deletedIds', 'skippedIds', 'uncertainIds', 'message', 'messageYue']);
  const uuid = (entry: unknown) => typeof entry === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry);
  const deletedIds = result.deletedIds as string[];
  const skippedIds = result.skippedIds as string[];
  const uncertainIds = result.uncertainIds as string[];
  if (Object.keys(result).some((key) => !keys.has(key)) || typeof result.ok !== 'boolean' || !Array.isArray(result.deletedIds) || !Array.isArray(result.skippedIds) || !Array.isArray(result.uncertainIds) || deletedIds.length > AUTHENTICATOR_MAX_ENTRIES || skippedIds.length > AUTHENTICATOR_MAX_ENTRIES || uncertainIds.length > AUTHENTICATOR_MAX_ENTRIES || deletedIds.some((id) => !uuid(id)) || skippedIds.some((id) => !uuid(id)) || uncertainIds.some((id) => !uuid(id)) || new Set([...deletedIds, ...skippedIds]).size !== deletedIds.length + skippedIds.length || new Set(uncertainIds).size !== uncertainIds.length || uncertainIds.some((id) => !deletedIds.includes(id)) || skippedIds.some((id) => uncertainIds.includes(id)) || (result.ok && (skippedIds.length !== 0 || uncertainIds.length !== 0)) || typeof result.message !== 'string' || result.message.length > 512 || typeof result.messageYue !== 'string' || result.messageYue.length > 512) throw new Error('The authenticator bulk-delete response was invalid.');
  return Object.freeze({ ok: result.ok, deletedIds: [...result.deletedIds] as string[], skippedIds: [...result.skippedIds] as string[], uncertainIds: [...result.uncertainIds] as string[], message: result.message, messageYue: result.messageYue });
}

function parseAuthenticatorExport(value: unknown): AuthenticatorExportResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator export response was invalid.');
  const result = value as Record<string, unknown>;
  const keys = new Set(['ok', 'format', 'filename', 'content', 'omittedFields', 'message', 'messageYue']);
  if (Object.keys(result).some((key) => !keys.has(key)) || typeof result.ok !== 'boolean' || !Array.isArray(result.omittedFields) || result.omittedFields.length !== AUTHENTICATOR_EXPORT_OMITTED_FIELDS.length || result.omittedFields.some((field, index) => field !== AUTHENTICATOR_EXPORT_OMITTED_FIELDS[index]) || typeof result.message !== 'string' || result.message.length > 512 || typeof result.messageYue !== 'string' || result.messageYue.length > 512) throw new Error('The authenticator export response was invalid.');
  if (result.format !== undefined && result.format !== 'json' && result.format !== 'csv' && result.format !== 'markdown') throw new Error('The authenticator export response was invalid.');
  if (result.filename !== undefined && (typeof result.filename !== 'string' || !/^authenticator-metadata\.(json|csv|md)$/.test(result.filename))) throw new Error('The authenticator export response was invalid.');
  if (result.content !== undefined && (typeof result.content !== 'string' || new TextEncoder().encode(result.content).byteLength > AUTHENTICATOR_MAX_EXPORT_LENGTH)) throw new Error('The authenticator export response was invalid.');
  if (result.ok && (typeof result.format !== 'string' || typeof result.filename !== 'string' || typeof result.content !== 'string')) throw new Error('The authenticator export response was invalid.');
  return Object.freeze({ ok: result.ok, format: result.format as AuthenticatorExportResult['format'], filename: result.filename as string | undefined, content: result.content as string | undefined, omittedFields: [...AUTHENTICATOR_EXPORT_OMITTED_FIELDS], message: result.message, messageYue: result.messageYue });
}

function parseAuthenticatorSecretExport(value: unknown): AuthenticatorSecretExportResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator secret export response was invalid.');
  const result = value as Record<string, unknown>;
  const keys = new Set(['ok', 'reason', 'filename', 'entryCount', 'message', 'messageYue']);
  const reasons = new Set(['cancelled', 'invalid', 'restricted', 'unavailable', 'write-failed', 'too-large', 'busy']);
  if (Object.keys(result).some((key) => !keys.has(key)) || typeof result.ok !== 'boolean' || (result.reason !== undefined && (typeof result.reason !== 'string' || !reasons.has(result.reason))) || (result.filename !== undefined && (typeof result.filename !== 'string' || !/^authenticator-secrets\.(json|csv)$/.test(result.filename))) || typeof result.entryCount !== 'number' || !Number.isInteger(result.entryCount) || result.entryCount < 0 || result.entryCount > AUTHENTICATOR_MAX_ENTRIES || typeof result.message !== 'string' || result.message.length > 512 || typeof result.messageYue !== 'string' || result.messageYue.length > 512 || (result.ok && (typeof result.filename !== 'string' || result.reason !== undefined))) throw new Error('The authenticator secret export response was invalid.');
  return Object.freeze({ ok: result.ok, reason: result.reason as AuthenticatorSecretExportResult['reason'], filename: result.filename as string | undefined, entryCount: result.entryCount, message: result.message, messageYue: result.messageYue });
}
function parseAuthenticatorSecretExportAuthorization(value: unknown): { ok: boolean; authorizationToken?: string; message: string; messageYue: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator secret export authorization response was invalid.');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some((key) => !['ok', 'authorizationToken', 'message', 'messageYue'].includes(key)) || typeof result.ok !== 'boolean' || (result.authorizationToken !== undefined && (typeof result.authorizationToken !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result.authorizationToken))) || typeof result.message !== 'string' || typeof result.messageYue !== 'string') throw new Error('The authenticator secret export authorization response was invalid.');
  return Object.freeze({ ok: result.ok, authorizationToken: result.authorizationToken as string | undefined, message: result.message, messageYue: result.messageYue });
}

function parseAuthenticatorList(value: unknown): AuthenticatorListResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The authenticator list response was invalid.');
  const result = value as Record<string, unknown>;
  const keys = new Set(['entries', 'groups', 'storage', 'message', 'messageYue']);
  if (Object.keys(result).some((key) => !keys.has(key)) || !Array.isArray(result.entries) || result.entries.length > AUTHENTICATOR_MAX_ENTRIES || !AUTHENTICATOR_STORAGE_SET.has(String(result.storage)) || typeof result.message !== 'string' || result.message.length > 512 || typeof result.messageYue !== 'string' || result.messageYue.length > 512) throw new Error('The authenticator list response was invalid.');
  const entries = result.entries.map(parseAuthenticatorEntryMetadata);
  if (result.groups !== undefined && !Array.isArray(result.groups) || Array.isArray(result.groups) && result.groups.length > AUTHENTICATOR_MAX_GROUPS) throw new Error('The authenticator group response was invalid.');
  const groups = (Array.isArray(result.groups) ? result.groups : []).map((group) => {
    if (!group || typeof group !== 'object' || Array.isArray(group)) throw new Error('The authenticator group response was invalid.');
    const value = group as Record<string, unknown>;
    if (Object.keys(value).some((key) => !['id', 'name', 'color', 'order', 'collapsed'].includes(key)) || typeof value.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id) || typeof value.name !== 'string' || value.name.length < 1 || value.name.length > AUTHENTICATOR_MAX_GROUP_LENGTH || value.name.trim() !== value.name || /[\u0000-\u001f\u007f]/.test(value.name) || typeof value.color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(value.color) || typeof value.order !== 'number' || !Number.isInteger(value.order) || value.order < 0 || value.order >= AUTHENTICATOR_MAX_GROUPS || typeof value.collapsed !== 'boolean') throw new Error('The authenticator group response was invalid.');
    return Object.freeze({ id: value.id, name: value.name, color: value.color, order: Number(value.order), collapsed: value.collapsed });
  });
  if (new Set(entries.map((entry) => entry.id)).size !== entries.length || new Set(entries.map((entry) => entry.order)).size !== entries.length || entries.some((entry, index) => entry.order !== index)) throw new Error('The authenticator list response was invalid.');
  const groupIds = new Set(groups.map((group) => group.id));
  if (groupIds.size !== groups.length || new Set(groups.map((group) => group.name)).size !== groups.length || new Set(groups.map((group) => group.order)).size !== groups.length || groups.some((group, index) => group.order !== index) || entries.some((entry) => typeof entry.groupId === 'string' && !groupIds.has(entry.groupId))) throw new Error('The authenticator list response was invalid.');
  return Object.freeze({ entries, groups, storage: result.storage as AuthenticatorListResult['storage'], message: result.message, messageYue: result.messageYue });
}
function parseSourceIsolationStatus(value: unknown): SourceIsolationStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The source isolation status response was invalid.');
  const status = value as Record<string, unknown>;
  if (typeof status.available !== 'boolean' || status.provider !== 'windows-sandbox' || typeof status.reason !== 'string' || (status.reason !== 'unsupported-platform' && status.reason !== 'guest-transport-not-connected' && !status.reason.startsWith('sandbox-'))) throw new Error('The source isolation status response was invalid.');
  if (typeof status.checkedAt !== 'string' || !Number.isFinite(Date.parse(status.checkedAt))) throw new Error('The source isolation status response was invalid.');
  if (!Array.isArray(status.evidence) || status.evidence.length > 8 || status.evidence.some((entry) => typeof entry !== 'string' || entry.length > 240)) throw new Error('The source isolation status response was invalid.');
  if (typeof status.remediation !== 'string' || status.remediation.length > 600) throw new Error('The source isolation status response was invalid.');
  return Object.freeze({ available: status.available, provider: 'windows-sandbox', reason: status.reason as SourceIsolationStatus['reason'], checkedAt: status.checkedAt, evidence: [...status.evidence] as string[], remediation: status.remediation });
}

function isSourceTerminalEvent(value: unknown): value is SourceTerminalEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  const keys = Object.keys(event);
  return keys.length === SOURCE_EVENT_KEYS.size
    && keys.every((key) => SOURCE_EVENT_KEYS.has(key))
    && typeof event.jobId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.jobId)
    && typeof event.appId === 'string' && /^[a-z0-9][a-z0-9-]{0,127}$/.test(event.appId)
    && Number.isInteger(event.sequence) && Number(event.sequence) >= 0 && Number(event.sequence) <= 10_000
    && typeof event.at === 'string' && Number.isFinite(Date.parse(event.at))
    && typeof event.stream === 'string' && SOURCE_STREAMS.has(event.stream)
    && typeof event.state === 'string' && SOURCE_STATES.has(event.state)
    && typeof event.text === 'string' && event.text.length <= 2_048
    && (event.progress === null || (Number.isInteger(event.progress) && Number(event.progress) >= 0 && Number(event.progress) <= 100))
    && typeof event.final === 'boolean';
}

function isOperationProgressEvent(value: unknown): value is OperationProgressEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const event = value as Record<string, unknown>;
  const keys = Object.keys(event);
  return keys.length === OPERATION_EVENT_KEYS.size
    && keys.every((key) => OPERATION_EVENT_KEYS.has(key))
    && typeof event.operationId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(event.operationId)
    && typeof event.appId === 'string' && /^[a-z0-9][a-z0-9-]{0,127}$/.test(event.appId)
    && (event.kind === 'install' || event.kind === 'uninstall')
    && typeof event.phase === 'string' && OPERATION_PHASES.has(event.phase)
    && (event.progress === null || (Number.isInteger(event.progress) && Number(event.progress) >= 0 && Number(event.progress) <= 100))
    && Number.isInteger(event.bytesReceived) && Number(event.bytesReceived) >= 0 && Number(event.bytesReceived) <= 1_500_000_000
    && (event.bytesTotal === null || (Number.isInteger(event.bytesTotal) && Number(event.bytesTotal) >= 0 && Number(event.bytesTotal) <= 1_500_000_000))
    && typeof event.cancellable === 'boolean'
    && typeof event.locked === 'boolean'
    && typeof event.message === 'string' && event.message.length <= 512
    && typeof event.final === 'boolean';
}

const api: DingDingStoreApi = {
  externalNavigation: {
    openCommit: (commit: string) => ipcRenderer.invoke('external-navigation:open-commit', commit),
  },
  catalog: {
    list: () => ipcRenderer.invoke('catalog:list'),
    refresh: () => ipcRenderer.invoke('catalog:refresh'),
  },
  operations: {
    install: (request: OperationRequest) => ipcRenderer.invoke('operations:install', request),
    cancelInstall: (request: InstallCancelRequest) => ipcRenderer.invoke('operations:cancel-install', request),
    status: async (): Promise<OperationProgressEvent[]> => {
      const value = await ipcRenderer.invoke('operations:status');
      if (!Array.isArray(value) || value.some((event) => !isOperationProgressEvent(event))) throw new Error('The operation status response was invalid.');
      return value.map((event) => Object.freeze({ ...event }));
    },
    subscribe: (listener: (event: Readonly<OperationProgressEvent>) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, value: unknown) => {
        if (isOperationProgressEvent(value)) listener(Object.freeze({ ...value }));
      };
      ipcRenderer.on('operations:progress', handler);
      return () => ipcRenderer.removeListener('operations:progress', handler);
    },
    build: (request: OperationRequest) => ipcRenderer.invoke('operations:build', request),
    uninstall: (request: OperationRequest) => ipcRenderer.invoke('operations:uninstall', request),
    installed: (discover = true) => ipcRenderer.invoke('operations:installed', discover),
  },
  sourceJobs: {
    start: (request: SourceJobRequest) => ipcRenderer.invoke('source-jobs:start', request),
    cancel: (request: SourceJobCancelRequest) => ipcRenderer.invoke('source-jobs:cancel', request),
    retry: (request: SourceJobRetryRequest) => ipcRenderer.invoke('source-jobs:retry', request),
    status: async (): Promise<SourceIsolationStatus> => {
      return parseSourceIsolationStatus(await ipcRenderer.invoke('source-jobs:status'));
    },
    subscribe: (listener: (event: Readonly<SourceTerminalEvent>) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, value: unknown) => {
        if (isSourceTerminalEvent(value)) listener(Object.freeze({ ...value }));
      };
      ipcRenderer.on('source-jobs:event', handler);
      return () => ipcRenderer.removeListener('source-jobs:event', handler);
    },
  },
  updates: {
    checkCatalog: () => ipcRenderer.invoke('updates:catalog'),
    checkStore: () => ipcRenderer.invoke('updates:store-check'),
    downloadStore: () => ipcRenderer.invoke('updates:store-download'),
    restartStore: () => ipcRenderer.invoke('updates:store-restart'),
    cancelStoreDownload: () => ipcRenderer.invoke('updates:store-cancel-download'),
    openReleaseNotes: (url: string) => ipcRenderer.invoke('updates:open-release-notes', url),
    checkApp: (appId: string) => ipcRenderer.invoke('updates:app-check', appId),
    downloadApp: (request: ManagedUpdateRequest) => ipcRenderer.invoke('updates:app-download', request),
    cancelApp: (request: ManagedUpdateCancelRequest) => ipcRenderer.invoke('updates:app-cancel', request),
    restartApp: (request: ManagedUpdateRequest) => ipcRenderer.invoke('updates:app-restart', request),
    subscribeApp: (listener: (state: ManagedUpdateState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: ManagedUpdateState) => listener(state);
      ipcRenderer.on('updates:app-state', handler);
      return () => ipcRenderer.removeListener('updates:app-state', handler);
    },
    subscribe: (listener: (state: AppStoreUpdateState) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: AppStoreUpdateState) => listener(state);
      ipcRenderer.on('updates:state', handler);
      return () => ipcRenderer.removeListener('updates:state', handler);
    },
  },
  settings: {
    load: () => ipcRenderer.invoke('settings:load'),
    save: (settings: UserSettings) => ipcRenderer.invoke('settings:save', settings),
    provenance: () => ipcRenderer.invoke('settings:provenance') as Promise<SettingsProvenance>,
  },
  personalVocabulary: {
    status: async () => parsePersonalVocabularyStatus(await ipcRenderer.invoke('personal-vocabulary:status')),
    importFromFile: async () => parsePersonalVocabularyImport(await ipcRenderer.invoke('personal-vocabulary:import')),
    clear: async () => parsePersonalVocabularyStatus(await ipcRenderer.invoke('personal-vocabulary:clear')),
  },
  schoolMode: {
    load: async () => parseSchoolModeSnapshot(await ipcRenderer.invoke('school-mode:load')),
    configure: async (request: SchoolModeConfigureRequest) => parseSchoolModeMutationResult(await ipcRenderer.invoke('school-mode:configure', request)),
    rename: async (request: SchoolModeRenameRequest) => parseSchoolModeMutationResult(await ipcRenderer.invoke('school-mode:rename', request)),
    setEnabled: async (request: SchoolModeToggleRequest) => parseSchoolModeMutationResult(await ipcRenderer.invoke('school-mode:set-enabled', request)),
    changeCredential: async (request: SchoolModeCredentialChangeRequest) => parseSchoolModeMutationResult(await ipcRenderer.invoke('school-mode:change-credential', request)),
    verify: async (request: SchoolModeVerifyRequest) => parseSchoolModeVerifyResult(await ipcRenderer.invoke('school-mode:verify', request)),
    subscribe: (listener: (snapshot: SchoolModeSnapshot) => void, onUnavailable?: () => void) => {
      const handler = (_event: Electron.IpcRendererEvent, value: unknown) => {
        try { listener(parseSchoolModeSnapshot(value)); }
        catch { onUnavailable?.(); /* Invalid or overprivileged snapshots never cross the preload boundary. */ }
      };
      ipcRenderer.on('school-mode:changed', handler);
      return () => ipcRenderer.removeListener('school-mode:changed', handler);
    },
  },
  locks: {
    load: async () => parseLockState(await ipcRenderer.invoke('locks:load')),
    set: async (request: LockSetRequest) => parseLockMutationResult(await ipcRenderer.invoke('locks:set', parseLockSetRequest(request))),
    unlock: async (request: LockCredentialRequest) => parseLockMutationResult(await ipcRenderer.invoke('locks:unlock', parseLockCredentialRequest(request))),
    lockAgain: async (target: LockTarget) => parseLockMutationResult(await ipcRenderer.invoke('locks:lock-again', parseLockTarget(target))),
    remove: async (request: LockCredentialRequest) => parseLockMutationResult(await ipcRenderer.invoke('locks:remove', parseLockCredentialRequest(request))),
  },
  support: {
    load: async () => parseSupportState(await ipcRenderer.invoke('support:load')),
    create: async (request: SupportTicketCreateRequest) => parseSupportTicketMutationResult(await ipcRenderer.invoke('support:create', request)),
    advance: async (ticketId: string) => parseSupportTicketMutationResult(await ipcRenderer.invoke('support:advance', ticketId)),
    bulkAdvance: async (request: SupportTicketBulkAdvanceRequest) => parseSupportTicketBulkAdvanceResult(await ipcRenderer.invoke('support:bulk-advance', parseSupportTicketBulkAdvanceRequest(request))),
    openRecoveryFolder: () => ipcRenderer.invoke('support:open-recovery-folder'),
  },
  history: {
    protectedStatus: async () => parseHistoryAccessStatus(await ipcRenderer.invoke('history:protected-status')),
    protectedUnlock: async (request: HistoryAccessUnlockRequest) => parseHistoryAccessResult(await ipcRenderer.invoke('history:protected-unlock', request)),
    protectedLockAgain: async () => parseHistoryAccessResult(await ipcRenderer.invoke('history:protected-lock-again')),
    list: () => ipcRenderer.invoke('history:list'),
    export: (format: HistoryExportFormat) => ipcRenderer.invoke('history:export', format),
    archive: (request: HistoryArchiveRequest) => ipcRenderer.invoke('history:archive', request) as Promise<HistoryArchiveExport>,
    revisions: () => ipcRenderer.invoke('history:revisions') as Promise<HistoryRevision[]>,
    diff: (revisionId: string) => ipcRenderer.invoke('history:diff', revisionId) as Promise<string>,
    label: (revisionId: string, label: string) => ipcRenderer.invoke('history:label', revisionId, label) as Promise<HistoryMutationResult>,
    restore: (revisionId: string) => ipcRenderer.invoke('history:restore', revisionId) as Promise<HistoryMutationResult>,
  },
  workspace: {
    load: () => ipcRenderer.invoke('workspace:load'),
    save: (value: TabWorkspace) => ipcRenderer.invoke('workspace:save', value),
    reset: () => ipcRenderer.invoke('workspace:reset'),
    export: () => ipcRenderer.invoke('workspace:export'),
    import: (document: string) => ipcRenderer.invoke('workspace:import', document),
  },
  appearance: {
    load: () => ipcRenderer.invoke('appearance:load'),
    setElement: (key: ElementKey, override: ElementOverride) => ipcRenderer.invoke('appearance:set-element', key, override),
    resetElement: (key: ElementKey) => ipcRenderer.invoke('appearance:reset-element', key),
    resetAll: () => ipcRenderer.invoke('appearance:reset-all'),
    export: () => ipcRenderer.invoke('appearance:export'),
    import: (payload: string) => ipcRenderer.invoke('appearance:import', payload),
  },
  schedule: {
    load: () => ipcRenderer.invoke('schedule:load'),
    save: (config: ScheduleConfig) => ipcRenderer.invoke('schedule:save', config),
    runNow: (task: ScheduleTaskId) => ipcRenderer.invoke('schedule:run-now', task),
    subscribe: (listener: (status: ScheduleStatus) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, status: ScheduleStatus) => listener(status);
      ipcRenderer.on('schedule:status', handler);
      return () => ipcRenderer.removeListener('schedule:status', handler);
    },
  },
  authenticator: {
    prepareFromClipboard: async (attemptId?: string) => {
      if (attemptId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)) throw new Error('The authenticator prepare attempt identifier was invalid.');
      return parseAuthenticatorRegistrationPreview(await ipcRenderer.invoke('authenticator:clipboard-prepare', attemptId));
    },
    importQrImage: async () => parseAuthenticatorQrImageImport(await ipcRenderer.invoke('authenticator:qr-image-import')),
    startCameraSession: async () => parseAuthenticatorCameraSessionStart(await ipcRenderer.invoke('authenticator:camera-start')),
    stopCameraSession: async (request: AuthenticatorCameraSessionStopRequest) => {
      if (!request || typeof request !== 'object' || Object.keys(request).some((key) => key !== 'sessionId') || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.sessionId)) throw new Error('The authenticator camera-session identifier was invalid.');
      return parseAuthenticatorCameraSessionStop(await ipcRenderer.invoke('authenticator:camera-stop', request));
    },
    status: async () => parseAuthenticatorStatus(await ipcRenderer.invoke('authenticator:status')),
    preview: async (request: AuthenticatorPreviewRequest) => parseAuthenticatorPreviewResult(await ipcRenderer.invoke('authenticator:preview', request)),
    prepare: async (request: AuthenticatorRegistrationRequest) => parseAuthenticatorRegistrationPreview(await ipcRenderer.invoke('authenticator:prepare', request)),
    cancelAttempt: async (attemptId: string) => {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(attemptId)) throw new Error('The authenticator prepare attempt identifier was invalid.');
      await ipcRenderer.invoke('authenticator:cancel-attempt', attemptId);
    },
    confirm: async (request: AuthenticatorRegistrationConfirmRequest) => parseAuthenticatorMutation(await ipcRenderer.invoke('authenticator:confirm', request)),
    cancel: async (registrationId: string) => {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(registrationId)) throw new Error('The authenticator registration identifier was invalid.');
      await ipcRenderer.invoke('authenticator:cancel', registrationId);
    },
    list: async () => parseAuthenticatorList(await ipcRenderer.invoke('authenticator:list')),
    createGroup: async (request: AuthenticatorGroupCreateRequest) => parseAuthenticatorGroupMutation(await ipcRenderer.invoke('authenticator:create-group', request)),
    renameGroup: async (request: AuthenticatorGroupRenameRequest) => parseAuthenticatorGroupMutation(await ipcRenderer.invoke('authenticator:rename-group', request)),
    reorderGroup: async (request: AuthenticatorGroupReorderRequest) => parseAuthenticatorGroupMutation(await ipcRenderer.invoke('authenticator:reorder-group', request)),
    collapseGroup: async (request: AuthenticatorGroupCollapseRequest) => parseAuthenticatorGroupMutation(await ipcRenderer.invoke('authenticator:collapse-group', request)),
    deleteGroup: async (request: AuthenticatorGroupDeleteRequest) => parseAuthenticatorGroupMutation(await ipcRenderer.invoke('authenticator:delete-group', request)),
    moveToGroup: async (request: AuthenticatorGroupBulkMoveRequest) => {
      const value = await ipcRenderer.invoke('authenticator:move-to-group', request);
      const uuid = (id: unknown) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
      if (!value || typeof value !== 'object' || Object.keys(value).some((key) => !['ok', 'movedIds', 'skippedIds', 'message', 'messageYue'].includes(key)) || !Array.isArray(value.movedIds) || !Array.isArray(value.skippedIds) || value.movedIds.length > AUTHENTICATOR_MAX_ENTRIES || value.skippedIds.length > AUTHENTICATOR_MAX_ENTRIES || value.movedIds.some((id: unknown) => !uuid(id)) || value.skippedIds.some((id: unknown) => !uuid(id)) || new Set([...value.movedIds, ...value.skippedIds]).size !== value.movedIds.length + value.skippedIds.length || typeof value.ok !== 'boolean' || (value.ok && value.skippedIds.length !== 0) || typeof value.message !== 'string' || value.message.length > 512 || typeof value.messageYue !== 'string' || value.messageYue.length > 512) throw new Error('The authenticator group move response was invalid.');
      return Object.freeze({ ok: value.ok, movedIds: [...value.movedIds] as string[], skippedIds: [...value.skippedIds] as string[], message: value.message, messageYue: value.messageYue });
    },
    rename: async (request: AuthenticatorRenameRequest) => parseAuthenticatorMutation(await ipcRenderer.invoke('authenticator:rename', request)),
    setGroup: async (request: AuthenticatorGroupRequest) => parseAuthenticatorMutation(await ipcRenderer.invoke('authenticator:set-group', request)),
    reorder: async (request: AuthenticatorReorderRequest) => parseAuthenticatorMutation(await ipcRenderer.invoke('authenticator:reorder', request)),
    remove: async (request: AuthenticatorDeleteRequest) => parseAuthenticatorDelete(await ipcRenderer.invoke('authenticator:delete', request)),
    bulkRemove: async (request: AuthenticatorBulkDeleteRequest) => parseAuthenticatorBulkDelete(await ipcRenderer.invoke('authenticator:bulk-delete', request)),
    export: async (request: AuthenticatorExportRequest) => parseAuthenticatorExport(await ipcRenderer.invoke('authenticator:export', request)),
    secretExport: async (request: AuthenticatorSecretExportRequest) => parseAuthenticatorSecretExport(await ipcRenderer.invoke('authenticator:secret-export', request)),
    authorizeSecretExport: async (request: AuthenticatorSecretExportAuthorizationRequest) => parseAuthenticatorSecretExportAuthorization(await ipcRenderer.invoke('authenticator:secret-export-authorize', request)),
  },
  dimSum: {
    startup: (): Promise<DimSumSurprise> => ipcRenderer.invoke('dim-sum:startup'),
  },
  externalEditor: {
    detect: () => ipcRenderer.invoke('external-editor:detect'),
    preference: () => ipcRenderer.invoke('external-editor:preference'),
    setPreference: (preference: ExternalEditorPreference) => ipcRenderer.invoke('external-editor:set-preference', preference),
    addValidated: () => ipcRenderer.invoke('external-editor:add-validated'),
    openExport: (request: ExternalEditorOpenRequest) => ipcRenderer.invoke('external-editor:open-export', request),
    openArchive: (request: ExternalEditorOpenArchiveRequest) => ipcRenderer.invoke('external-editor:open-archive', request),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
};

contextBridge.exposeInMainWorld('dingDingStore', Object.freeze(api));

// Exported only for the pure preload contract tests; the renderer receives
// the frozen bridge above and cannot import this module directly.
export {
  parseAuthenticatorEntryMetadata,
  parseAuthenticatorQrImageImport,
  parseAuthenticatorList,
  parseAuthenticatorMutation,
  parseAuthenticatorPreviewResult,
  parseAuthenticatorQr,
  parseAuthenticatorRegistrationPreview,
  parseAuthenticatorStatus,
  parseAuthenticatorDelete,
  parseAuthenticatorBulkDelete,
  parseAuthenticatorExport,
  parseAuthenticatorSecretExport,
  parseAuthenticatorSecretExportAuthorization,
  parseAuthenticatorGroupMutation,
};
