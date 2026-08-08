import {
  ELEMENTS,
  SURFACE_IDS,
  TAB_IDS,
  TAB_GROUP_COLORS,
} from '../shared/contracts';
import type {
  CatalogApp,
  ElementKey,
  ElementOverride,
  ScheduleConfig,
  TabGroupColor,
  TabId,
  TabWorkspace,
  TokenId,
  UserSettings,
} from '../shared/contracts';
import type { SurfaceId } from './search';

/**
 * The command registry. Every page, command, setting, appearance control, and schedule field is one
 * row in a table here, and the same tables drive the rail, the settings page, the appearance editor,
 * and the schedule editor. A new feature is a new row, so command-palette reachability holds by
 * construction. This module stays React-free and DOM-free so tests can import it directly.
 */

export type EntryKind = 'page' | 'command' | 'setting' | 'appearance' | 'schedule' | 'app';
export type EntryGroup = 'Pages' | 'Tabs' | 'Appearance' | 'Schedule' | 'Search' | 'Settings' | 'Apps';

export type TokenValue = NonNullable<ElementOverride[keyof ElementOverride]>;

const STATIC_COMMANDS = [
  'refresh-catalog', 'clear-all-searches', 'focus-tab-search', 'new-group', 'collapse-all-groups',
  'show-overflow', 'reset-tabs', 'export-tabs', 'import-tabs', 'toggle-appearance-edit',
  'reset-appearance-all', 'export-appearance', 'import-appearance', 'open-schedule',
  'check-store-update', 'refresh-catalog-now', 'toggle-self-update-repeat', 'toggle-catalog-refresh',
  'toggle-quiet-hours', 'apply-quiet-night', 'show-next-runs', 'toggle-badges', 'toggle-color-bar',
  'toggle-pinned-icon-only', 'save-schedule', 'reset-schedule',
  'open-notifications', 'open-changelog',
] as const;

export type StaticCommandId = (typeof STATIC_COMMANDS)[number];

export type CommandId =
  | StaticCommandId
  | `open-regex:${string}`
  | `clear-search:${string}`
  | `set-option:${string}`
  | `pin:${string}`
  | `move-up:${string}`
  | `move-down:${string}`
  | `group-add:${string}`
  | `group-remove:${string}`
  | `group-rename:${string}`
  | `group-color:${string}`
  | `group-collapse:${string}`
  | `group-delete:${string}`
  | `edit-element:${string}`
  | `reset-element:${string}`
  | `open-app:${string}`
  | `rail-side:${string}`
  | `label-mode:${string}`
  | `tab-height:${string}`
  | `overflow-mode:${string}`
  | `self-interval:${string}`
  | `catalog-interval:${string}`;

export type Action =
  | { type: 'open-surface'; surface: SurfaceId }
  | { type: 'set-setting'; key: keyof UserSettings; value: UserSettings[keyof UserSettings] | null }
  | { type: 'set-appearance'; target: ElementKey; token: TokenId; value: TokenValue | null }
  | { type: 'set-schedule'; key: ScheduleFieldKey; value: number | boolean | null }
  | { type: 'command'; command: CommandId };

export interface Entry {
  id: string;
  kind: EntryKind;
  group: EntryGroup;
  icon: string;
  en: string;
  yue: string;
  keywords: string[];
  action: Action;
  enabled?: boolean;
}

export const TAB_META: Record<TabId, { icon: string; en: string; yue: string }> = {
  catalog: { icon: 'apps', en: 'Discover', yue: '搵 App' },
  installed: { icon: 'inventory_2', en: 'Installed', yue: '已安裝' },
  updates: { icon: 'system_update', en: 'Updates', yue: '更新' },
  docs: { icon: 'menu_book', en: 'Documentation', yue: '文件' },
  activity: { icon: 'history', en: 'Activity', yue: '記錄' },
  settings: { icon: 'settings', en: 'Settings', yue: '設定' },
};

export const SETTINGS_SUB_TABS = [
  { id: 'settings.general', surface: 'settings.general', icon: 'settings', en: 'General', yue: '一般' },
  { id: 'settings.appearance', surface: 'settings.appearance', icon: 'palette', en: 'Appearance', yue: '外觀' },
  { id: 'settings.schedule', surface: 'settings.schedule', icon: 'schedule', en: 'Schedule', yue: '排程' },
  { id: 'settings.about', surface: 'settings.about', icon: 'info', en: 'About', yue: '關於' },
] as const;

export type SettingsSubTabId = (typeof SETTINGS_SUB_TABS)[number]['id'];

export interface SurfaceRow { surface: SurfaceId; icon: string; en: string; yue: string; keywords: string[] }

export const SURFACES: readonly SurfaceRow[] = [
  ...TAB_IDS.map((id) => ({ surface: id as SurfaceId, icon: TAB_META[id].icon, en: TAB_META[id].en, yue: TAB_META[id].yue, keywords: [id, 'page', 'tab'] })),
  { surface: 'settings.general', icon: 'settings', en: 'Settings · General', yue: '設定 · 一般', keywords: ['language', 'funny', 'voice'] },
  { surface: 'settings.appearance', icon: 'palette', en: 'Settings · Appearance', yue: '設定 · 外觀', keywords: ['theme', 'density', 'accent', 'rail', 'tabs'] },
  { surface: 'settings.schedule', icon: 'schedule', en: 'Settings · Schedule', yue: '設定 · 排程', keywords: ['update', 'interval', 'quiet'] },
  { surface: 'settings.about', icon: 'info', en: 'Settings · About', yue: '設定 · 關於', keywords: ['version', 'licence', 'unsigned', 'changelog', 'external editor', 'vscode'] },
];

export type SettingKind = 'select' | 'range' | 'color' | 'text';

export interface SettingField {
  key: keyof UserSettings;
  section: 'general' | 'appearance';
  kind: SettingKind;
  en: string;
  yue: string;
  keywords: string[];
  min?: number;
  max?: number;
  options?: ReadonlyArray<{ value: string; en: string; yue: string }>;
}

export const SETTING_FIELDS: readonly SettingField[] = [
  {
    key: 'language', section: 'general', kind: 'select', en: 'Language mode', yue: '語言模式',
    keywords: ['english', 'cantonese', 'bilingual', '粵語'],
    options: [
      { value: 'en', en: 'English', yue: 'English' },
      { value: 'yue', en: '香港粵語', yue: '香港粵語' },
      { value: 'bilingual', en: 'English + 香港粵語', yue: 'English + 香港粵語' },
    ],
  },
  { key: 'englishFunnyLevel', section: 'general', kind: 'range', min: 1, max: 5, en: 'English funny level', yue: 'English 幽默程度', keywords: ['tone', 'humour', 'voice'] },
  { key: 'cantoneseFunnyLevel', section: 'general', kind: 'range', min: 1, max: 5, en: '粵語 funny level', yue: '粵語幽默程度', keywords: ['tone', 'humour', 'voice'] },
  {
    key: 'theme', section: 'appearance', kind: 'select', en: 'Theme', yue: '主題',
    keywords: ['dark', 'light', 'system'],
    options: [
      { value: 'system', en: 'System', yue: '跟系統' },
      { value: 'light', en: 'Light', yue: '淺色' },
      { value: 'dark', en: 'Dark', yue: '深色' },
    ],
  },
  {
    key: 'density', section: 'appearance', kind: 'select', en: 'Density', yue: '密度',
    keywords: ['spacing', 'compact', 'comfortable', 'spacious'],
    options: [
      { value: 'compact', en: 'Compact', yue: '緊湊' },
      { value: 'comfortable', en: 'Comfortable', yue: '舒適' },
      { value: 'spacious', en: 'Spacious', yue: '寬鬆' },
    ],
  },
  { key: 'accent', section: 'appearance', kind: 'color', en: 'Accent colour', yue: '主色', keywords: ['seed', 'primary', 'colour'] },
  { key: 'displayName', section: 'appearance', kind: 'text', en: 'Display name', yue: '顯示名稱', keywords: ['title', 'brand'] },
];

export const SCHEDULE_FIELDS = [
  { key: 'selfUpdate.repeatEnabled', kind: 'switch', en: 'Repeat checks while running', yue: '執行期間重複檢查', keywords: ['self', 'update', 'repeat'] },
  { key: 'selfUpdate.intervalMinutes', kind: 'minutes', en: 'App Store check interval', yue: '商店檢查間隔', keywords: ['self', 'update', 'interval'] },
  { key: 'catalogRefresh.enabled', kind: 'switch', en: 'Scheduled catalog refresh', yue: '定時重新整理目錄', keywords: ['catalog', 'refresh'] },
  { key: 'catalogRefresh.intervalMinutes', kind: 'minutes', en: 'Catalog refresh interval', yue: '目錄重新整理間隔', keywords: ['catalog', 'interval'] },
  { key: 'quietHours.enabled', kind: 'switch', en: 'Quiet hours', yue: '靜音時間', keywords: ['quiet', 'notification'] },
  { key: 'quietHours.startMinute', kind: 'time', en: 'Quiet hours start', yue: '靜音開始', keywords: ['quiet', 'start'] },
  { key: 'quietHours.endMinute', kind: 'time', en: 'Quiet hours end', yue: '靜音結束', keywords: ['quiet', 'end'] },
] as const;

export type ScheduleFieldKey = (typeof SCHEDULE_FIELDS)[number]['key'];

export function readScheduleField(config: ScheduleConfig, key: ScheduleFieldKey): number | boolean {
  switch (key) {
    case 'selfUpdate.repeatEnabled': return config.selfUpdate.repeatEnabled;
    case 'selfUpdate.intervalMinutes': return config.selfUpdate.intervalMinutes;
    case 'catalogRefresh.enabled': return config.catalogRefresh.enabled;
    case 'catalogRefresh.intervalMinutes': return config.catalogRefresh.intervalMinutes;
    case 'quietHours.enabled': return config.quietHours.enabled;
    case 'quietHours.startMinute': return config.quietHours.startMinute;
    default: return config.quietHours.endMinute;
  }
}

export function writeScheduleField(config: ScheduleConfig, key: ScheduleFieldKey, value: number | boolean): ScheduleConfig {
  switch (key) {
    case 'selfUpdate.repeatEnabled': return { ...config, selfUpdate: { ...config.selfUpdate, repeatEnabled: Boolean(value) } };
    case 'selfUpdate.intervalMinutes': return { ...config, selfUpdate: { ...config.selfUpdate, intervalMinutes: Number(value) } };
    case 'catalogRefresh.enabled': return { ...config, catalogRefresh: { ...config.catalogRefresh, enabled: Boolean(value) } };
    case 'catalogRefresh.intervalMinutes': return { ...config, catalogRefresh: { ...config.catalogRefresh, intervalMinutes: Number(value) } };
    case 'quietHours.enabled': return { ...config, quietHours: { ...config.quietHours, enabled: Boolean(value) } };
    case 'quietHours.startMinute': return { ...config, quietHours: { ...config.quietHours, startMinute: Number(value) } };
    default: return { ...config, quietHours: { ...config.quietHours, endMinute: Number(value) } };
  }
}

export type TokenSection = 'colour' | 'shape' | 'type' | 'layout';

export const TOKEN_META: Record<TokenId, { en: string; yue: string; section: TokenSection }> = {
  background: { en: 'Background', yue: '背景', section: 'colour' },
  foreground: { en: 'Text colour', yue: '文字顏色', section: 'colour' },
  radius: { en: 'Corner radius', yue: '圓角', section: 'shape' },
  borderWidth: { en: 'Border width', yue: '邊框粗幼', section: 'shape' },
  elevation: { en: 'Elevation', yue: '陰影層級', section: 'shape' },
  fontScale: { en: 'Text size', yue: '字型大細', section: 'type' },
  fontWeight: { en: 'Text weight', yue: '字重', section: 'type' },
  paddingScale: { en: 'Padding', yue: '內距', section: 'layout' },
};

export const TOKEN_SECTIONS: ReadonlyArray<{ id: TokenSection; en: string; yue: string }> = [
  { id: 'colour', en: 'Colour', yue: '顏色' },
  { id: 'shape', en: 'Shape', yue: '形狀' },
  { id: 'type', en: 'Type', yue: '字體' },
  { id: 'layout', en: 'Layout', yue: '版面' },
];

export const RAIL_COMMANDS = [
  { command: 'rail-side:left' as CommandId, en: 'Move tabs to the left rail', yue: '分頁擺左邊' },
  { command: 'rail-side:top' as CommandId, en: 'Move tabs to the top rail', yue: '分頁擺上面' },
  { command: 'label-mode:full' as CommandId, en: 'Show full tab labels', yue: '顯示完整分頁標籤' },
  { command: 'label-mode:compact' as CommandId, en: 'Show compact tab labels', yue: '顯示精簡分頁標籤' },
  { command: 'label-mode:icon' as CommandId, en: 'Show icon-only tabs', yue: '淨係顯示圖示' },
  { command: 'tab-height:compact' as CommandId, en: 'Set compact tab height', yue: '分頁高度：緊湊' },
  { command: 'tab-height:comfortable' as CommandId, en: 'Set comfortable tab height', yue: '分頁高度：舒適' },
  { command: 'tab-height:tall' as CommandId, en: 'Set tall tab height', yue: '分頁高度：高' },
  { command: 'overflow-mode:menu' as CommandId, en: 'Overflow tabs into a menu', yue: '多出嘅分頁收入選單' },
  { command: 'overflow-mode:scroll' as CommandId, en: 'Scroll overflowing tabs', yue: '多出嘅分頁用捲動' },
] as const;

export const SELF_INTERVAL_PRESETS = [60, 360, 720, 1440, 4320, 10_080] as const;
export const CATALOG_INTERVAL_PRESETS = [30, 120, 360, 1440] as const;

export const GROUP_COLOR_LABELS: Record<TabGroupColor, { en: string; yue: string }> = {
  grey: { en: 'Grey', yue: '灰' }, blue: { en: 'Blue', yue: '藍' }, green: { en: 'Green', yue: '綠' },
  yellow: { en: 'Yellow', yue: '黃' }, red: { en: 'Red', yue: '紅' }, purple: { en: 'Purple', yue: '紫' },
  teal: { en: 'Teal', yue: '青' },
};

export interface RegistryContext {
  settings: UserSettings;
  workspace: TabWorkspace;
  appearance: Partial<Record<ElementKey, ElementOverride>>;
  schedule: ScheduleConfig;
  apps: CatalogApp[];
}

const command = (id: CommandId, en: string, yue: string, icon: string, keywords: string[], group: EntryGroup): Entry => ({
  id: `cmd:${id}`, kind: 'command', group, icon, en, yue, keywords, action: { type: 'command', command: id },
});

export function buildRegistry(context: RegistryContext): Entry[] {
  const { workspace, appearance, schedule, apps } = context;
  const entries: Entry[] = [];

  for (const surface of SURFACES) {
    entries.push({
      id: `page:${surface.surface}`, kind: 'page', group: 'Pages', icon: surface.icon,
      en: `Open ${surface.en}`, yue: `開 ${surface.yue}`, keywords: surface.keywords,
      action: { type: 'open-surface', surface: surface.surface },
    });
  }

  for (const field of SETTING_FIELDS) {
    entries.push({
      id: `set:${field.key}`, kind: 'setting', group: 'Settings', icon: 'settings',
      en: `Setting: ${field.en}`, yue: `設定：${field.yue}`, keywords: [field.key, ...field.keywords],
      action: { type: 'set-setting', key: field.key, value: null },
    });
    for (const option of field.options ?? []) {
      entries.push(command(
        `set-option:${field.key}:${option.value}` as CommandId,
        `Set ${field.en} to ${option.en}`, `${field.yue}設做 ${option.yue}`, 'settings',
        [field.key, option.value], 'Settings',
      ));
    }
  }

  for (const definition of ELEMENTS) {
    const key = definition.key as ElementKey;
    const overridden = Object.keys(appearance[key] ?? {}).length;
    entries.push(command(`edit-element:${key}`, `Edit appearance of ${definition.en}`, `編輯${definition.yue}外觀`, 'palette', [key, definition.yue, 'appearance', 'style'], 'Appearance'));
    entries.push(command(`reset-element:${key}`, `Reset appearance of ${definition.en}`, `重設${definition.yue}外觀`, 'restart_alt', [key, definition.yue, 'reset'], 'Appearance'));
    for (const token of definition.tokens) {
      entries.push({
        id: `appear:${key}:${token}`, kind: 'appearance', group: 'Appearance', icon: 'palette',
        en: `${definition.en} · ${TOKEN_META[token].en}`, yue: `${definition.yue} · ${TOKEN_META[token].yue}`,
        keywords: [key, token, definition.yue, TOKEN_META[token].section, overridden ? 'overridden' : 'default'],
        action: { type: 'set-appearance', target: key, token, value: null },
      });
    }
  }

  for (const field of SCHEDULE_FIELDS) {
    entries.push({
      id: `sched:${field.key}`, kind: 'schedule', group: 'Schedule', icon: 'schedule',
      en: `Schedule: ${field.en}`, yue: `排程：${field.yue}`, keywords: [field.key, ...field.keywords],
      action: { type: 'set-schedule', key: field.key, value: null },
    });
  }

  entries.push(
    command('refresh-catalog', 'Refresh catalog', '重新整理目錄', 'refresh', ['reload', 'apps'], 'Pages'),
    command('open-notifications', 'Open notification centre', '開通知中心', 'notifications', ['history', 'snackbar', 'messages'], 'Pages'),
    command('open-changelog', 'Open the changelog viewer', '開更新記錄', 'history', ['release', 'version', 'commit'], 'Pages'),
    command('clear-all-searches', 'Clear all searches', '清除所有搜尋', 'search_off', ['reset', 'filter'], 'Search'),
    command('focus-tab-search', 'Focus tab search', '跳去分頁搜尋', 'search', ['tabs', 'filter', 'ctrl shift k'], 'Search'),
  );

  for (const surface of SURFACES) {
    entries.push(command(`open-regex:${surface.surface}`, `Open regex builder for ${surface.en}`, `開 ${surface.yue} 嘅 regex 建造器`, 'regular_expression', ['regex', surface.surface], 'Search'));
    entries.push(command(`clear-search:${surface.surface}`, `Clear search in ${surface.en}`, `清除 ${surface.yue} 嘅搜尋`, 'search_off', ['clear', surface.surface], 'Search'));
  }
  entries.push(command('open-regex:tabs', 'Open regex builder for tab search', '開分頁搜尋嘅 regex 建造器', 'regular_expression', ['regex', 'tabs'], 'Search'));
  entries.push(command('open-regex:palette', 'Open regex builder for the command palette', '開指令面板嘅 regex 建造器', 'regular_expression', ['regex', 'palette'], 'Search'));
  entries.push(command('open-regex:appearance.elements', 'Open regex builder for appearance controls', '開外觀控制嘅 regex 建造器', 'regular_expression', ['regex', 'appearance'], 'Search'));
  entries.push(command('open-regex:notifications', 'Open regex builder for notifications', '開通知搜尋嘅 regex 建造器', 'regular_expression', ['regex', 'notifications'], 'Search'));
  entries.push(command('open-regex:changelog', 'Open regex builder for the changelog', '開更新記錄嘅 regex 建造器', 'regular_expression', ['regex', 'changelog'], 'Search'));

  for (const tab of workspace.tabs) {
    const meta = TAB_META[tab.id];
    entries.push(command(`pin:${tab.id}`, tab.pinned ? `Unpin ${meta.en}` : `Pin ${meta.en}`, tab.pinned ? `取消釘住 ${meta.yue}` : `釘住 ${meta.yue}`, 'push_pin', [tab.id, 'pin'], 'Tabs'));
    entries.push(command(`move-up:${tab.id}`, `Move ${meta.en} up`, `${meta.yue} 上移`, 'expand_more', [tab.id, 'order'], 'Tabs'));
    entries.push(command(`move-down:${tab.id}`, `Move ${meta.en} down`, `${meta.yue} 下移`, 'expand_more', [tab.id, 'order'], 'Tabs'));
    if (tab.groupId) entries.push(command(`group-remove:${tab.id}`, `Remove ${meta.en} from its group`, `${meta.yue} 離開分組`, 'folder', [tab.id, 'group'], 'Tabs'));
    for (const group of workspace.groups) {
      if (tab.groupId === group.id || tab.pinned) continue;
      entries.push(command(`group-add:${tab.id}:${group.id}` as CommandId, `Add ${meta.en} to ${group.name}`, `${meta.yue} 加入 ${group.name}`, 'folder', [tab.id, group.name, 'group'], 'Tabs'));
    }
  }

  for (const group of workspace.groups) {
    entries.push(command(`group-rename:${group.id}`, `Rename group ${group.name}`, `改名分組 ${group.name}`, 'folder', [group.name, 'rename'], 'Tabs'));
    entries.push(command(`group-collapse:${group.id}`, group.collapsed ? `Expand group ${group.name}` : `Collapse group ${group.name}`, group.collapsed ? `展開分組 ${group.name}` : `收埋分組 ${group.name}`, 'chevron_right', [group.name, 'collapse'], 'Tabs'));
    entries.push(command(`group-delete:${group.id}`, `Delete group ${group.name}`, `刪除分組 ${group.name}`, 'delete', [group.name, 'delete'], 'Tabs'));
    for (const color of TAB_GROUP_COLORS) {
      entries.push(command(`group-color:${group.id}:${color}` as CommandId, `Recolour ${group.name} to ${GROUP_COLOR_LABELS[color].en}`, `${group.name} 轉做${GROUP_COLOR_LABELS[color].yue}色`, 'palette', [group.name, color], 'Tabs'));
    }
  }

  entries.push(
    command('new-group', 'New tab group', '開新分頁組', 'folder', ['group', 'create'], 'Tabs'),
    command('collapse-all-groups', 'Collapse all groups', '收埋所有分組', 'chevron_right', ['group'], 'Tabs'),
    command('show-overflow', 'Show the tab overflow menu', '顯示分頁溢出選單', 'more_horiz', ['overflow'], 'Tabs'),
    command('reset-tabs', 'Reset tab layout', '重設分頁版面', 'restart_alt', ['reset', 'tabs'], 'Tabs'),
    command('export-tabs', 'Export tab layout', '匯出分頁版面', 'download', ['export', 'tabs'], 'Tabs'),
    command('import-tabs', 'Import tab layout', '匯入分頁版面', 'upload', ['import', 'tabs'], 'Tabs'),
    command('toggle-badges', workspace.rail.showBadges ? 'Hide tab badges' : 'Show tab badges', workspace.rail.showBadges ? '收起分頁徽章' : '顯示分頁徽章', 'tab', ['badge'], 'Tabs'),
    command('toggle-color-bar', workspace.rail.showGroupColorBar ? 'Hide group colour bar' : 'Show group colour bar', workspace.rail.showGroupColorBar ? '收起分組色條' : '顯示分組色條', 'palette', ['group', 'colour'], 'Tabs'),
    command('toggle-pinned-icon-only', workspace.rail.pinnedIconOnly ? 'Show labels on pinned tabs' : 'Show pinned tabs as icons only', workspace.rail.pinnedIconOnly ? '釘住分頁顯示文字' : '釘住分頁淨係顯示圖示', 'push_pin', ['pin'], 'Tabs'),
  );
  for (const row of RAIL_COMMANDS) entries.push(command(row.command, row.en, row.yue, 'tab', ['rail', 'layout'], 'Tabs'));

  entries.push(
    command('toggle-appearance-edit', 'Toggle appearance edit mode', '切換外觀編輯模式', 'edit', ['appearance', 'edit', 'ctrl shift e'], 'Appearance'),
    command('reset-appearance-all', 'Reset all appearance overrides', '重設所有外觀設定', 'restart_alt', ['appearance', 'reset'], 'Appearance'),
    command('export-appearance', 'Export appearance', '匯出外觀', 'download', ['appearance', 'export'], 'Appearance'),
    command('import-appearance', 'Import appearance', '匯入外觀', 'upload', ['appearance', 'import'], 'Appearance'),
  );

  entries.push(
    command('open-schedule', 'Open the update schedule editor', '開更新排程編輯器', 'schedule', ['schedule'], 'Schedule'),
    command('check-store-update', 'Check for App Store update now', '而家檢查商店更新', 'system_update', ['update', 'now'], 'Schedule'),
    command('refresh-catalog-now', 'Refresh catalog now', '而家重新整理目錄', 'refresh', ['catalog', 'now'], 'Schedule'),
    command('toggle-self-update-repeat', schedule.selfUpdate.repeatEnabled ? 'Turn off repeat App Store checks' : 'Turn on repeat App Store checks', schedule.selfUpdate.repeatEnabled ? '關閉重複商店檢查' : '開啟重複商店檢查', 'schedule', ['repeat'], 'Schedule'),
    command('toggle-catalog-refresh', schedule.catalogRefresh.enabled ? 'Turn off scheduled catalog refresh' : 'Turn on scheduled catalog refresh', schedule.catalogRefresh.enabled ? '關閉定時目錄整理' : '開啟定時目錄整理', 'refresh', ['catalog'], 'Schedule'),
    command('toggle-quiet-hours', schedule.quietHours.enabled ? 'Turn off quiet hours' : 'Turn on quiet hours', schedule.quietHours.enabled ? '關閉靜音時間' : '開啟靜音時間', 'schedule', ['quiet'], 'Schedule'),
    command('apply-quiet-night', 'Apply quiet hours 22:00–07:00', '套用靜音時間 22:00–07:00', 'schedule', ['quiet', 'night'], 'Schedule'),
    command('show-next-runs', 'Show next scheduled run times', '睇下一次排程時間', 'schedule', ['next', 'run'], 'Schedule'),
    command('save-schedule', 'Save schedule', '儲存排程', 'schedule', ['save'], 'Schedule'),
    command('reset-schedule', 'Reset schedule to defaults', '排程還原預設', 'restart_alt', ['reset'], 'Schedule'),
  );
  for (const minutes of SELF_INTERVAL_PRESETS) {
    entries.push(command(`self-interval:${minutes}` as CommandId, `Set App Store check interval to ${minutes} minutes`, `商店檢查間隔設做 ${minutes} 分鐘`, 'schedule', ['interval', String(minutes)], 'Schedule'));
  }
  for (const minutes of CATALOG_INTERVAL_PRESETS) {
    entries.push(command(`catalog-interval:${minutes}` as CommandId, `Set catalog refresh interval to ${minutes} minutes`, `目錄整理間隔設做 ${minutes} 分鐘`, 'refresh', ['interval', String(minutes)], 'Schedule'));
  }

  for (const app of apps) {
    entries.push({
      id: `app:${app.id}`, kind: 'app', group: 'Apps', icon: 'deployed_code',
      en: app.name, yue: app.name, keywords: [app.repository, app.packageType, app.updateState],
      action: { type: 'command', command: `open-app:${app.id}` },
    });
  }

  return entries;
}

export const ALL_SURFACE_IDS: readonly SurfaceId[] = SURFACE_IDS;
