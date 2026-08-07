export type LanguageMode = 'en' | 'yue' | 'bilingual';
export type ThemeMode = 'system' | 'light' | 'dark';
export type PackageType = 'squirrel' | 'msi' | 'nsis' | 'archive' | 'source' | 'unsupported';
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

export interface CatalogSnapshot {
  apps: CatalogApp[];
  fetchedAt: string;
  source: 'network' | 'cache';
  warning: string | null;
}

export interface OperationRequest {
  appId: string;
  confirmation: string;
}

export interface OperationResult {
  ok: boolean;
  appId: string;
  message: string;
  operationId?: string;
}

export type UninstallDescriptor =
  | { kind: 'squirrel'; executable: string; arguments: ['--uninstall', '-s'] }
  | { kind: 'msi'; executable: 'msiexec.exe'; arguments: ['/x', string, '/qn', '/norestart'] }
  | { kind: 'portable'; executable: null; arguments: [] };

export interface InstalledAppRecord {
  appId: string;
  displayName: string;
  version: string;
  packageType: PackageType;
  source: 'store' | 'squirrel-discovery' | 'msi-registry' | 'portable-managed';
  installRoot: string | null;
  uninstall: UninstallDescriptor | null;
  installedAt: string | null;
  detectedAt: string;
}

export interface OperationHistoryEntry {
  id: string;
  appId: string;
  action: 'install' | 'build' | 'update' | 'uninstall' | 'discovery' | 'restore' | 'settings';
  status: 'started' | 'succeeded' | 'failed' | 'cancelled';
  startedAt: string;
  finishedAt: string | null;
  message: string;
  version: string | null;
}

export type HistoryExportFormat = 'json' | 'jsonl' | 'csv' | 'markdown';

export interface HistoryExport {
  format: HistoryExportFormat;
  fileName: string;
  mediaType: string;
  content: string;
}

export type AppStoreUpdateState =
  | { status: 'idle' | 'checking' | 'up-to-date'; checkedAt?: string }
  | { status: 'available' | 'downloading'; version: string; releaseNotesUrl: string }
  | { status: 'ready'; version: string; releaseNotesUrl: string; unsigned: true }
  | { status: 'failed'; message: string; checkedAt: string };

export interface UserSettings {
  language: LanguageMode;
  englishFunnyLevel: number;
  cantoneseFunnyLevel: number;
  theme: ThemeMode;
  density: 'comfortable' | 'compact' | 'spacious';
  accent: string;
  displayName: string;
}

export interface DingDingStoreApi {
  catalog: {
    list(): Promise<CatalogSnapshot>;
    refresh(): Promise<CatalogSnapshot>;
  };
  operations: {
    install(request: OperationRequest): Promise<OperationResult>;
    build(request: OperationRequest): Promise<OperationResult>;
    uninstall(request: OperationRequest): Promise<OperationResult>;
    installed(): Promise<InstalledAppRecord[]>;
    history(): Promise<OperationHistoryEntry[]>;
    exportHistory(format: HistoryExportFormat, entryIds?: string[]): Promise<HistoryExport>;
  };
  updates: {
    checkCatalog(): Promise<CatalogSnapshot>;
    checkStore(): Promise<AppStoreUpdateState>;
    downloadStore(): Promise<AppStoreUpdateState>;
    restartStore(): Promise<OperationResult>;
    subscribe(listener: (state: AppStoreUpdateState) => void): () => void;
  };
  settings: {
    load(): Promise<UserSettings>;
    save(settings: UserSettings): Promise<UserSettings>;
  };
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
  };
}

