import { z } from 'zod';

export type LanguageMode = 'en' | 'yue' | 'bilingual';
export type ThemeMode = 'system' | 'light' | 'dark';
export type PackageType = 'squirrel' | 'msi' | 'nsis' | 'jpackage' | 'archive' | 'source' | 'unsupported';
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
  operationId?: string;
}

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

export interface InstalledAppRecord {
  appId: string;
  displayName: string;
  version: string;
  packageType: PackageType;
  source: 'store' | 'squirrel-discovery' | 'msi-registry' | 'reviewed-registry' | 'portable-managed';
  installRoot: string | null;
  uninstall: UninstallDescriptor | null;
  ownership: InstallOwnership | null;
  installedAt: string | null;
  detectedAt: string;
}

export type OperationKind = 'install' | 'build' | 'uninstall' | 'update';
export type HistoryExportFormat = 'json' | 'jsonl' | 'csv' | 'markdown';

export type ExternalEditorId = 'vscode';
export type ExportRecordKind = 'catalog' | 'installed' | 'activity' | 'notifications' | 'changelog' | 'docs' | 'settings' | 'appearance' | 'tabs';
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

export const externalEditorPreferenceSchema = z.strictObject({
  editor: z.literal('vscode'),
  edition: z.enum(['stable', 'insiders', 'portable', 'unknown']),
});

export const externalEditorOpenRequestSchema = z.strictObject({
  editor: z.literal('vscode'),
  recordKind: z.enum(['catalog', 'installed', 'activity', 'notifications', 'changelog', 'docs', 'settings', 'appearance', 'tabs']),
  suggestedName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,96}$/).refine((value) => !value.includes('..'), 'Suggested filename cannot contain repeated dots.'),
  mime: z.enum(['application/json', 'application/x-ndjson', 'text/csv', 'text/markdown', 'text/plain', 'text/html', 'application/yaml', 'application/xml', 'application/sql']),
  content: z.string().max(256_000),
});

export type ExternalEditorOpenRequestInput = z.infer<typeof externalEditorOpenRequestSchema>;

export type ExternalEditorResult =
  | { ok: true; editor: ExternalEditorId }
  | { ok: false; reason: 'bridge-unavailable' | 'not-installed' | 'write-failed' | 'launch-failed'; message: string };

export interface HistoryEntry {
  id: string;
  appId: string;
  displayName: string;
  kind: OperationKind;
  ok: boolean;
  message: string;
  occurredAt: string;
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
  automaticRepairConsent: boolean;
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
  automaticRepairConsent: false,
};

export type SettingsValueSource = 'persisted' | 'fallback';
export interface SettingsProvenance {
  source: SettingsValueSource;
  /** The exact compiled fallback shown when source is fallback. */
  fallback: UserSettings;
}

export const TAB_IDS = ['catalog', 'installed', 'updates', 'docs', 'activity', 'settings'] as const;
export type TabId = (typeof TAB_IDS)[number];
export const tabIdSchema = z.enum(TAB_IDS);

export const SURFACE_IDS = [
  ...TAB_IDS,
  'settings.general',
  'settings.appearance',
  'settings.schedule',
  'settings.about',
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
  'borderWidth', 'elevation',
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
const TEXT: readonly TokenId[] = ['foreground', 'fontScale', 'fontWeight', 'fontFamily', 'fontStyle', 'textDecoration', 'letterSpacing', 'lineHeight'];
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
  { key: 'schedule-card', en: 'Schedule card', yue: '排程卡片', group: 'content', tokens: BOX_RAISED },
  { key: 'dialog', en: 'Dialog', yue: '對話框', group: 'feedback', tokens: BOX_RAISED },
  { key: 'command-palette', en: 'Command palette', yue: '指令面板', group: 'feedback', tokens: BOX_RAISED },
  { key: 'snackbar', en: 'Snackbar', yue: '訊息條', group: 'feedback', tokens: ['background', 'foreground', 'radius', 'paddingScale', 'fontScale', 'fontWeight', 'borderWidth', 'elevation'] },
] as const satisfies readonly ElementDefinition[];

export type ElementKey = (typeof ELEMENT_LIST)[number]['key'];
export const ELEMENTS: readonly ElementDefinition[] = Object.freeze(ELEMENT_LIST.map((element) => Object.freeze({ ...element })));
export const ELEMENT_KEYS = ELEMENT_LIST.map((element) => element.key) as unknown as [ElementKey, ...ElementKey[]];
export const ELEMENT_BY_KEY: ReadonlyMap<string, ElementDefinition> = new Map(ELEMENTS.map((element) => [element.key, element]));

export const MAX_TOKENS_PER_ELEMENT = 16;
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
  textDecoration: z.enum(['none', 'underline', 'line-through', 'underline line-through']).optional(),
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

function tokenValue(token: TokenId, override: ElementOverride): string | null {
  switch (token) {
    case 'background':
    case 'foreground': {
      const color = override[token];
      if (!color) return null;
      if (color.kind === 'role') return COLOR_ROLE_VAR[color.role] ?? null;
      return SAFE_HEX.test(color.hex) ? color.hex : null;
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
} as const;

const scheduleDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use an ISO date (YYYY-MM-DD).');
const scheduleTimeZoneSchema = z.string().trim().min(1).max(SCHEDULE_BOUNDS.ruleTimeZoneLength).regex(/^[A-Za-z0-9_+./-]+$/);
const scheduledSettingsValuesSchema = z.object({
  language: z.enum(['en', 'yue', 'bilingual']).optional(),
  englishFunnyLevel: z.number().int().min(1).max(5).optional(),
  cantoneseFunnyLevel: z.number().int().min(1).max(5).optional(),
  theme: z.enum(['system', 'light', 'dark']).optional(),
  density: z.enum(['comfortable', 'compact', 'spacious']).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  displayName: z.string().trim().min(1).max(64).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, 'Choose at least one setting to schedule.');

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
}).strict().superRefine((rule, ctx) => {
  if (rule.startDate && rule.endDate && rule.startDate > rule.endDate) ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date must be on or after start date.' });
  if (rule.startMinute === rule.endMinute) ctx.addIssue({ code: 'custom', path: ['endMinute'], message: 'A scheduled window must not start and end at the same minute.' });
  if (new Set(rule.weekdays).size !== rule.weekdays.length) ctx.addIssue({ code: 'custom', path: ['weekdays'], message: 'Choose each weekday at most once.' });
});

export type ScheduledSettingRule = z.infer<typeof scheduledSettingRuleSchema>;

export const scheduleSchema = z
  .object({
    schemaVersion: z.literal(2),
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
  schemaVersion: 2,
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

export type ScheduleSaveResult =
  | { ok: true; status: ScheduleStatus }
  | { ok: false; message: string; issues: Array<{ field: string; message: string }> };

export interface DingDingStoreApi {
  /** Optional until the privileged adapter validates a 40-hex SHA and constructs the fixed commit URL. */
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
  };
  catalog: {
    list(): Promise<CatalogSnapshot>;
    refresh(): Promise<CatalogSnapshot>;
  };
  operations: {
    install(request: OperationRequest): Promise<OperationResult>;
    cancelInstall(request: InstallCancelRequest): Promise<OperationResult>;
    build(request: OperationRequest): Promise<OperationResult>;
    uninstall(request: OperationRequest): Promise<OperationResult>;
    installed(): Promise<InstalledAppRecord[]>;
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
  history: {
    list(): Promise<HistoryEntry[]>;
    export(format: HistoryExportFormat): Promise<string>;
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
  dimSum: {
    startup(): Promise<DimSumSurprise>;
  };
  window: {
    minimize(): void;
    toggleMaximize(): void;
    close(): void;
  };
}
