import { contextBridge, ipcRenderer } from 'electron';
import type { AppStoreUpdateState, DingDingStoreApi, HistoryExportFormat, OperationRequest, UserSettings } from '../shared/contracts.js';

const api: DingDingStoreApi = {
  catalog: {
    list: () => ipcRenderer.invoke('catalog:list'),
    refresh: () => ipcRenderer.invoke('catalog:refresh'),
  },
  operations: {
    install: (request: OperationRequest) => ipcRenderer.invoke('operations:install', request),
    build: (request: OperationRequest) => ipcRenderer.invoke('operations:build', request),
    uninstall: (request: OperationRequest) => ipcRenderer.invoke('operations:uninstall', request),
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
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
  },
};

contextBridge.exposeInMainWorld('dingDingStore', Object.freeze(api));
