import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppStoreUpdateState,
  DingDingStoreApi,
  DimSumSurprise,
  ElementKey,
  ElementOverride,
  HistoryExportFormat,
  InstallCancelRequest,
  ManagedUpdateCancelRequest,
  ManagedUpdateRequest,
  ManagedUpdateState,
  OperationRequest,
  ScheduleConfig,
  ScheduleStatus,
  ScheduleTaskId,
  SourceJobCancelRequest,
  SourceJobRequest,
  SourceTerminalEvent,
  TabWorkspace,
  UserSettings,
} from '../shared/contracts.js';

const SOURCE_STATES = new Set(['queued', 'preparing', 'running', 'repairing', 'cancelling', 'succeeded', 'failed', 'cancelled']);
const SOURCE_STREAMS = new Set(['system', 'progress', 'stdout', 'stderr']);
const SOURCE_EVENT_KEYS = new Set(['jobId', 'appId', 'sequence', 'at', 'stream', 'state', 'text', 'progress', 'final']);

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

const api: DingDingStoreApi = {
  catalog: {
    list: () => ipcRenderer.invoke('catalog:list'),
    refresh: () => ipcRenderer.invoke('catalog:refresh'),
  },
  operations: {
    install: (request: OperationRequest) => ipcRenderer.invoke('operations:install', request),
    cancelInstall: (request: InstallCancelRequest) => ipcRenderer.invoke('operations:cancel-install', request),
    build: (request: OperationRequest) => ipcRenderer.invoke('operations:build', request),
    uninstall: (request: OperationRequest) => ipcRenderer.invoke('operations:uninstall', request),
    installed: () => ipcRenderer.invoke('operations:installed'),
  },
  sourceJobs: {
    start: (request: SourceJobRequest) => ipcRenderer.invoke('source-jobs:start', request),
    cancel: (request: SourceJobCancelRequest) => ipcRenderer.invoke('source-jobs:cancel', request),
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
  },
  history: {
    list: () => ipcRenderer.invoke('history:list'),
    export: (format: HistoryExportFormat) => ipcRenderer.invoke('history:export', format),
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
  dimSum: {
    startup: (): Promise<DimSumSurprise> => ipcRenderer.invoke('dim-sum:startup'),
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
};

contextBridge.exposeInMainWorld('dingDingStore', Object.freeze(api));
