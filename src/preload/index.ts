import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppStoreUpdateState,
  AuthenticatorPreviewRequest,
  AuthenticatorPreviewResult,
  AuthenticatorStatus,
  DingDingStoreApi,
  DimSumSurprise,
  ElementKey,
  ElementOverride,
  ExternalEditorOpenRequest,
  ExternalEditorOpenArchiveRequest,
  ExternalEditorPreference,
  HistoryArchiveExport,
  HistoryArchiveRequest,
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
  SchoolModeConfigureRequest,
  SchoolModeRenameRequest,
  SchoolModeToggleRequest,
  SchoolModeVerifyRequest,
  SourceJobCancelRequest,
  SourceJobRetryRequest,
  SourceJobRequest,
  SourceIsolationStatus,
  SourceTerminalEvent,
  SupportState,
  SupportTicketCreateRequest,
  TabWorkspace,
  SettingsProvenance,
  UserSettings,
} from '../shared/contracts.js';
const SOURCE_STATES = new Set(['queued', 'preparing', 'running', 'repairing', 'cancelling', 'succeeded', 'failed', 'cancelled']);
const SOURCE_STREAMS = new Set(['system', 'progress', 'stdout', 'stderr']);
const SOURCE_EVENT_KEYS = new Set(['jobId', 'appId', 'sequence', 'at', 'stream', 'state', 'text', 'progress', 'final']);
const OPERATION_PHASES = new Set(['queued', 'resolving', 'downloading', 'extracting', 'launching', 'committing', 'installer-running', 'cancelling', 'succeeded', 'failed', 'cancelled', 'unknown']);
const OPERATION_EVENT_KEYS = new Set(['operationId', 'appId', 'kind', 'phase', 'progress', 'bytesReceived', 'bytesTotal', 'cancellable', 'locked', 'message', 'final']);
// Keep preload validation self-contained: this boundary must not load runtime
// values from the shared contract module into the renderer bundle.
const AUTHENTICATOR_ALGORITHM_SET = new Set<string>(['sha1', 'sha256', 'sha512']);
const AUTHENTICATOR_DIGIT_SET = new Set<number>([6, 7, 8]);

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
  if (result.code !== undefined && (typeof result.code !== 'string' || !/^\d{6,8}$/.test(result.code))) throw new Error('The authenticator preview response was invalid.');
  if (result.remainingSeconds !== undefined && (!Number.isInteger(result.remainingSeconds) || Number(result.remainingSeconds) < 0 || Number(result.remainingSeconds) > 3_600)) throw new Error('The authenticator preview response was invalid.');
  if (result.expiresAt !== undefined && (typeof result.expiresAt !== 'string' || !Number.isFinite(Date.parse(result.expiresAt)))) throw new Error('The authenticator preview response was invalid.');
  if (result.algorithm !== undefined && (typeof result.algorithm !== 'string' || !AUTHENTICATOR_ALGORITHM_SET.has(result.algorithm))) throw new Error('The authenticator preview response was invalid.');
  if (result.digits !== undefined && (typeof result.digits !== 'number' || !AUTHENTICATOR_DIGIT_SET.has(result.digits))) throw new Error('The authenticator preview response was invalid.');
  if (result.periodSeconds !== undefined && (!Number.isInteger(result.periodSeconds) || Number(result.periodSeconds) < 1 || Number(result.periodSeconds) > 3_600)) throw new Error('The authenticator preview response was invalid.');
  return Object.freeze({ ok: result.ok, code: result.code as string | undefined, remainingSeconds: result.remainingSeconds as number | undefined, expiresAt: result.expiresAt as string | undefined, algorithm: result.algorithm as AuthenticatorPreviewResult['algorithm'], digits: result.digits as AuthenticatorPreviewResult['digits'], periodSeconds: result.periodSeconds as number | undefined, storage: result.storage, message: result.message, messageYue: result.messageYue });
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
    installed: () => ipcRenderer.invoke('operations:installed'),
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
  schoolMode: {
    load: () => ipcRenderer.invoke('school-mode:load'),
    configure: (request: SchoolModeConfigureRequest) => ipcRenderer.invoke('school-mode:configure', request),
    rename: (request: SchoolModeRenameRequest) => ipcRenderer.invoke('school-mode:rename', request),
    setEnabled: (request: SchoolModeToggleRequest) => ipcRenderer.invoke('school-mode:set-enabled', request),
    verify: (request: SchoolModeVerifyRequest) => ipcRenderer.invoke('school-mode:verify', request),
  },
  locks: {
    load: () => ipcRenderer.invoke('locks:load') as Promise<LockState>,
    set: (request: LockSetRequest) => ipcRenderer.invoke('locks:set', request),
    unlock: (request: LockCredentialRequest) => ipcRenderer.invoke('locks:unlock', request),
    lockAgain: (target: LockTarget) => ipcRenderer.invoke('locks:lock-again', target),
    remove: (request: LockCredentialRequest) => ipcRenderer.invoke('locks:remove', request),
  },
  support: {
    load: () => ipcRenderer.invoke('support:load') as Promise<SupportState>,
    create: (request: SupportTicketCreateRequest) => ipcRenderer.invoke('support:create', request),
    advance: (ticketId: string) => ipcRenderer.invoke('support:advance', ticketId),
    openRecoveryFolder: () => ipcRenderer.invoke('support:open-recovery-folder'),
  },
  history: {
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
    status: async () => parseAuthenticatorStatus(await ipcRenderer.invoke('authenticator:status')),
    preview: async (request: AuthenticatorPreviewRequest) => parseAuthenticatorPreviewResult(await ipcRenderer.invoke('authenticator:preview', request)),
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
