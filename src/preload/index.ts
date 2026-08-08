import { contextBridge, ipcRenderer } from 'electron';
import type {
  AppStoreUpdateState,
  DingDingStoreApi,
  ElementKey,
  ElementOverride,
  HistoryExportFormat,
  OperationRequest,
  ScheduleConfig,
  ScheduleStatus,
  ScheduleTaskId,
  TabWorkspace,
  UserSettings,
} from '../shared/contracts.js';

const api: DingDingStoreApi = {
  catalog: {
    list: () => ipcRenderer.invoke('catalog:list'),
    refresh: () => ipcRenderer.invoke('catalog:refresh'),
  },
  operations: {
    install: (request: OperationRequest) => ipcRenderer.invoke('operations:install', request),
    build: (request: OperationRequest) => ipcRenderer.invoke('operations:build', request),
    uninstall: (request: OperationRequest) => ipcRenderer.invoke('operations:uninstall', request),
    installed: () => ipcRenderer.invoke('operations:installed'),
  },
  updates: {
    checkCatalog: () => ipcRenderer.invoke('updates:catalog'),
    checkStore: () => ipcRenderer.invoke('updates:store-check'),
    downloadStore: () => ipcRenderer.invoke('updates:store-download'),
    restartStore: () => ipcRenderer.invoke('updates:store-restart'),
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
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
};

contextBridge.exposeInMainWorld('dingDingStore', Object.freeze(api));
