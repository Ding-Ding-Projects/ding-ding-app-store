import {
  ELEMENTS,
  ELEVATIONS,
  RADII,
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
import { GENERATED_DOCS } from './generated-docs';
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

/**
 * A palette row may expose the same bounded control as its owning surface.
 * Keeping this metadata declarative means the palette cannot accidentally invent
 * a second setting implementation (or accept an untyped command string).
 */
export type EntryControl =
  | { kind: 'select'; value: string; options: ReadonlyArray<{ value: string; en: string; yue: string }> }
  | { kind: 'range'; value: number; min: number; max: number; step?: number }
  | { kind: 'color'; value: string }
  | { kind: 'switch'; value: boolean }
  | { kind: 'text'; value: string; maxLength: number };

export interface EntryTarget {
  surface?: SurfaceId;
  focusId?: string;
  articleId?: string;
  tabId?: TabId;
  groupId?: string;
  element?: ElementKey;
}

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
  | `open-doc:${string}`
  | `rail-side:${string}`
  | `label-mode:${string}`
  | `tab-height:${string}`
  | `overflow-mode:${string}`
  | `self-interval:${string}`
  | `catalog-interval:${string}`;

export type Action =
  | { type: 'open-surface'; surface: SurfaceId; target?: EntryTarget }
  | { type: 'set-setting'; key: keyof UserSettings; value: UserSettings[keyof UserSettings] | null; target?: EntryTarget }
  | { type: 'set-appearance'; target: ElementKey; token: TokenId; value: TokenValue | null; destination?: EntryTarget }
  | { type: 'set-schedule'; key: ScheduleFieldKey; value: number | boolean | null; target?: EntryTarget }
  | { type: 'command'; command: CommandId; target?: EntryTarget };

export interface Entry {
  id: string;
  kind: EntryKind;
  group: EntryGroup;
  icon: string;
  en: string;
  yue: string;
  keywords: string[];
  action: Action;
  control?: EntryControl;
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

export type SettingKind = 'select' | 'range' | 'color' | 'text' | 'switch';

export interface SettingField {
  key: keyof UserSettings;
  section: 'general' | 'appearance';
  kind: SettingKind;
  en: string;
  yue: string;
  keywords: string[];
  explanation: { en: string; yue: string };
  /** Exact compiled fallback shown when no validated settings file is available. */
  defaultValue: string;
  min?: number;
  max?: number;
  options?: ReadonlyArray<{ value: string; en: string; yue: string }>;
}

export const SETTING_FIELDS: readonly SettingField[] = [
  {
    key: 'language', section: 'general', kind: 'select', en: 'Language mode', yue: '語言模式',
    keywords: ['english', 'cantonese', 'bilingual', '粵語'],
    explanation: { en: 'Chooses whether every user-facing label is English, playful Hong Kong Cantonese, or both. Facts and identifiers stay unchanged.', yue: '揀所有介面文字用英文、玩味香港粵語，定係兩樣一齊顯示；事實同識別資料唔會改。' }, defaultValue: 'bilingual',
    options: [
      { value: 'en', en: 'English', yue: 'English' },
      { value: 'yue', en: '香港粵語', yue: '香港粵語' },
      { value: 'bilingual', en: 'English + 香港粵語', yue: 'English + 香港粵語' },
    ],
  },
  { key: 'englishFunnyLevel', section: 'general', kind: 'range', min: 1, max: 5, en: 'English funny level', yue: 'English 幽默程度', keywords: ['tone', 'humour', 'voice'], explanation: { en: 'Styles English copy from serious (1) to maximum playful (5), including warnings and errors without changing their facts.', yue: '調校英文語氣，由嚴肅（1）到最玩味（5），連警告同錯誤都包括，但事實唔變。' }, defaultValue: '2' },
  { key: 'cantoneseFunnyLevel', section: 'general', kind: 'range', min: 1, max: 5, en: '粵語 funny level', yue: '粵語幽默程度', keywords: ['tone', 'humour', 'voice'], explanation: { en: 'Styles Cantonese copy from serious (1) to maximum playful (5), including warnings and errors without changing their facts.', yue: '調校粵語語氣，由嚴肅（1）到最玩味（5），連警告同錯誤都包括，但事實唔變。' }, defaultValue: '4' },
  { key: 'automaticRepairConsent', section: 'general', kind: 'switch', en: 'Allow isolated automatic source repair', yue: '允許隔離自動 source 修正', keywords: ['source', 'repair', 'opencode', 'consent', 'isolation'], explanation: { en: 'Allows OpenCode to repair a reviewed source build only inside an attested disposable guest; normal installs never use it and the app fails closed without isolation.', yue: '只容許 OpenCode 喺驗證過、一次性隔離環境修正已審核 source build；普通安裝唔會用，冇隔離就安全停低。' }, defaultValue: 'false' },
  {
    key: 'theme', section: 'appearance', kind: 'select', en: 'Theme', yue: '主題',
    keywords: ['dark', 'light', 'system'],
    explanation: { en: 'Chooses the live Material 3 light, dark, or operating-system theme without moving app identity or data.', yue: '揀即時 Material 3 淺色、深色或者跟作業系統主題，唔會搬走 app 身份或者資料。' }, defaultValue: 'system',
    options: [
      { value: 'system', en: 'System', yue: '跟系統' },
      { value: 'light', en: 'Light', yue: '淺色' },
      { value: 'dark', en: 'Dark', yue: '深色' },
    ],
  },
  {
    key: 'density', section: 'appearance', kind: 'select', en: 'Density', yue: '密度',
    keywords: ['spacing', 'compact', 'comfortable', 'spacious'],
    explanation: { en: 'Changes spacing and control breathing room across the UI; it does not change stored values or validation bounds.', yue: '改全個介面嘅間距同控制項呼吸位，唔會改儲存值或者驗證範圍。' }, defaultValue: 'comfortable',
    options: [
      { value: 'compact', en: 'Compact', yue: '緊湊' },
      { value: 'comfortable', en: 'Comfortable', yue: '舒適' },
      { value: 'spacious', en: 'Spacious', yue: '寬鬆' },
    ],
  },
  { key: 'accent', section: 'appearance', kind: 'color', en: 'Accent colour', yue: '主色', keywords: ['seed', 'primary', 'colour'], explanation: { en: 'Sets the Material seed colour used to derive interactive accents. It accepts one six-digit hexadecimal colour.', yue: '設定 Material 種子主色，用嚟衍生互動色；只接受六位十六進制顏色。' }, defaultValue: '#6750A4' },
  { key: 'displayName', section: 'appearance', kind: 'text', en: 'Display name', yue: '顯示名稱', keywords: ['title', 'brand'], explanation: { en: 'Renames visible labels only. Package identity, update feed, application-data location, and diagnostic identity remain the shipped product values.', yue: '淨係改畫面見到嘅名稱；套件身份、更新來源、資料位置同診斷身份仍然用出廠值。' }, defaultValue: 'Ding Ding App Store' },
];

/** Hand-written completeness list: adding a setting requires its explanation and fallback contract. */
export const SETTINGS_EXPLANATION_KEYS = [
  'language', 'englishFunnyLevel', 'cantoneseFunnyLevel', 'automaticRepairConsent',
  'theme', 'density', 'accent', 'displayName',
] as const satisfies readonly (keyof UserSettings)[];

export const SCHEDULE_FIELDS = [
  { key: 'selfUpdate.repeatEnabled', kind: 'switch', en: 'Repeat checks while running', yue: '執行期間重複檢查', keywords: ['self', 'update', 'repeat'], explanation: { en: 'Controls repeat self-update checks after the unavoidable startup check; turning it off does not suppress startup discovery.', yue: '控制開機必做檢查之後要唔要重複檢查；關咗都唔會跳過開機檢查。' }, defaultValue: 'true' },
  { key: 'selfUpdate.intervalMinutes', kind: 'minutes', en: 'App Store check interval', yue: '商店檢查間隔', keywords: ['self', 'update', 'interval'], explanation: { en: 'Sets the bounded repeat interval for the store updater. It is measured in local minutes and validated before timers re-arm.', yue: '設定商店更新器重複間隔，按本地分鐘計，驗證成功先會重新啟動計時器。' }, defaultValue: '360 minutes' },
  { key: 'catalogRefresh.enabled', kind: 'switch', en: 'Scheduled catalog refresh', yue: '定時重新整理目錄', keywords: ['catalog', 'refresh'], explanation: { en: 'Allows catalog metadata refresh on its own schedule; a manual refresh remains available when disabled.', yue: '容許目錄 metadata 按排程更新；關咗仍然可以手動更新。' }, defaultValue: 'true' },
  { key: 'catalogRefresh.intervalMinutes', kind: 'minutes', en: 'Catalog refresh interval', yue: '目錄重新整理間隔', keywords: ['catalog', 'interval'], explanation: { en: 'Sets the catalog refresh interval. The lower bound is the cache lifetime, so shorter values are rejected.', yue: '設定目錄更新間隔；最短值係 cache 壽命，太短會拒絕。' }, defaultValue: '360 minutes' },
  { key: 'quietHours.enabled', kind: 'switch', en: 'Quiet hours', yue: '靜音時間', keywords: ['quiet', 'notification'], explanation: { en: 'Holds corner notifications during the chosen window while checks and the persistent update banner continue.', yue: '指定時段收埋角落通知，但檢查同持續更新橫幅照樣運作。' }, defaultValue: 'false' },
  { key: 'quietHours.startMinute', kind: 'time', en: 'Quiet hours start', yue: '靜音開始', keywords: ['quiet', 'start'], explanation: { en: 'The local start time for holding notifications. Cross-midnight windows are evaluated as one continuous span.', yue: '收埋通知嘅本地開始時間；跨凌晨時段會當一段連續時間計。' }, defaultValue: '22:00' },
  { key: 'quietHours.endMinute', kind: 'time', en: 'Quiet hours end', yue: '靜音結束', keywords: ['quiet', 'end'], explanation: { en: 'The local end time for quiet hours. Equal start and end values are invalid rather than silently guessed.', yue: '靜音時間嘅本地結束時間；同開始一樣會視為無效，唔會亂估。' }, defaultValue: '07:00' },
  { key: 'rules', kind: 'rules', en: 'Scheduled settings rules', yue: '排程設定規則', keywords: ['date', 'time', 'timezone', 'weekday', 'theme', 'density', 'accent', 'language', 'cross-midnight'], explanation: { en: 'Temporarily overrides supported settings from local, validated date/time rules. Base settings stay recoverable and lower priority numbers win ties.', yue: '按本地、驗證過嘅日期／時間規則暫時覆蓋支援設定；基本設定可還原，優先次序數字越細越先。' }, defaultValue: '0 rules' },
] as const;

/** Hand-written completeness list for every schedule control exposed by ScheduleEditor. */
export const SCHEDULE_EXPLANATION_KEYS = [
  'selfUpdate.repeatEnabled', 'selfUpdate.intervalMinutes', 'catalogRefresh.enabled',
  'catalogRefresh.intervalMinutes', 'quietHours.enabled', 'quietHours.startMinute',
  'quietHours.endMinute', 'rules',
] as const;

/** Hand-written completeness list for every appearance token row. */
export const APPEARANCE_EXPLANATION_KEYS = [
  'background', 'foreground', 'radius', 'borderWidth', 'elevation', 'fontScale', 'fontWeight',
  'fontFamily', 'fontStyle', 'textDecoration', 'letterSpacing', 'lineHeight', 'paddingScale',
  'fontVariationAxes', 'underlineStyle', 'underlineColor', 'underlineThickness', 'textTransform',
  'fontVariantCaps', 'baselineOffset', 'textDirection', 'textAlign', 'textShadow',
] as const satisfies readonly TokenId[];

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

export const TOKEN_META: Record<TokenId, { en: string; yue: string; section: TokenSection; explanation: { en: string; yue: string }; defaultValue: string }> = {
  background: { en: 'Background', yue: '背景', section: 'colour', explanation: { en: 'Overrides this element’s surface colour while preserving the Material state and contrast checks.', yue: '覆蓋呢個元素嘅表面色，但保留 Material 狀態同對比度檢查。' }, defaultValue: 'inherited Material surface' },
  foreground: { en: 'Text colour', yue: '文字顏色', section: 'colour', explanation: { en: 'Overrides the element’s foreground colour. The editor reports contrast against its resolved background.', yue: '覆蓋元素前景色；編輯器會報告相對已解析背景嘅對比度。' }, defaultValue: 'inherited text colour' },
  radius: { en: 'Corner radius', yue: '圓角', section: 'shape', explanation: { en: 'Chooses the element’s bounded corner shape without changing its hit target.', yue: '揀元素有限範圍嘅圓角形狀，唔會改點擊範圍。' }, defaultValue: 'md' },
  borderWidth: { en: 'Border width', yue: '邊框粗幼', section: 'shape', explanation: { en: 'Sets the visible outline width in pixels; zero means no custom outline.', yue: '設定可見輪廓嘅像素粗幼；零即係唔加自訂輪廓。' }, defaultValue: '0px' },
  elevation: { en: 'Elevation', yue: '陰影層級', section: 'shape', explanation: { en: 'Chooses the Material elevation treatment for this element.', yue: '揀呢個元素嘅 Material 陰影層級。' }, defaultValue: 'none' },
  fontScale: { en: 'Text size', yue: '字型大細', section: 'type', explanation: { en: 'Scales text for this element from 75% to 150%; it does not change the app-wide density.', yue: '將呢個元素文字縮放 75% 至 150%，唔會改全 app 密度。' }, defaultValue: '100%' },
  fontWeight: { en: 'Text weight', yue: '字重', section: 'type', explanation: { en: 'Selects the supported font weight used by this element.', yue: '揀呢個元素支援嘅字重。' }, defaultValue: '400' },
  fontFamily: { en: 'Font family', yue: '字型家族', section: 'type', explanation: { en: 'Selects an installed or bundled family; unsupported names are rejected rather than silently saved.', yue: '揀已安裝或者內置字型；唔支援嘅名稱會拒絕，唔會靜默儲存。' }, defaultValue: 'system-ui' },
  fontStyle: { en: 'Font style', yue: '字型樣式', section: 'type', explanation: { en: 'Chooses normal, italic, or oblique style for this element.', yue: '揀呢個元素用正常、斜體或者傾斜樣式。' }, defaultValue: 'normal' },
  textDecoration: { en: 'Decoration lines', yue: '裝飾線', section: 'type', explanation: { en: 'Chooses underline, overline, and line-through combinations without changing text content.', yue: '揀底線、上劃線同刪除線組合，唔會改文字內容。' }, defaultValue: 'none' },
  fontVariationAxes: { en: 'Font variation axes', yue: '字型變體軸', section: 'type', explanation: { en: 'Stores bounded four-character OpenType axis values such as wght or wdth; unsupported axes remain harmless.', yue: '儲存有限制嘅四字 OpenType 軸值，例如 wght 或 wdth；唔支援嘅軸都唔會造成危險。' }, defaultValue: 'none' },
  underlineStyle: { en: 'Underline style', yue: '底線樣式', section: 'type', explanation: { en: 'Selects the underline stroke style, including wavy.', yue: '揀底線筆劃樣式，包括波浪線。' }, defaultValue: 'solid' },
  underlineColor: { en: 'Underline colour', yue: '底線顏色', section: 'type', explanation: { en: 'Sets a separate validated colour for decoration lines.', yue: '為裝飾線設定另一個已驗證顏色。' }, defaultValue: 'current text colour' },
  underlineThickness: { en: 'Underline thickness', yue: '底線粗幼', section: 'type', explanation: { en: 'Sets a bounded decoration thickness in pixels.', yue: '以有限制嘅像素設定裝飾線粗幼。' }, defaultValue: 'auto' },
  textTransform: { en: 'Capitalization', yue: '大小寫', section: 'type', explanation: { en: 'Changes presentation capitalization only; the stored text remains unchanged.', yue: '只改顯示大小寫，儲存嘅文字保持不變。' }, defaultValue: 'none' },
  fontVariantCaps: { en: 'Small caps', yue: '小型大寫', section: 'type', explanation: { en: 'Chooses OpenType capitalization variants supported by the selected font.', yue: '揀所選字型支援嘅 OpenType 大小寫變體。' }, defaultValue: 'normal' },
  baselineOffset: { en: 'Baseline offset', yue: '基線偏移', section: 'type', explanation: { en: 'Moves the visual baseline within a bounded range without changing layout boxes.', yue: '喺有限範圍移動視覺基線，唔會改版面盒。' }, defaultValue: '0em' },
  textDirection: { en: 'Text direction', yue: '文字方向', section: 'type', explanation: { en: 'Sets left-to-right, right-to-left, or automatic direction for this element.', yue: '為元素設定左至右、右至左或者自動方向。' }, defaultValue: 'inherit' },
  textAlign: { en: 'Text alignment', yue: '文字對齊', section: 'type', explanation: { en: 'Aligns text within the element without changing its content.', yue: '對齊元素入面嘅文字，唔會改內容。' }, defaultValue: 'inherit' },
  textShadow: { en: 'Text shadow', yue: '文字陰影', section: 'type', explanation: { en: 'Adds one bounded shadow with validated offsets, blur, and colour.', yue: '加一層有限制陰影，偏移、模糊同顏色全部驗證。' }, defaultValue: 'none' },
  letterSpacing: { en: 'Letter spacing', yue: '字距', section: 'type', explanation: { en: 'Adjusts tracking in tenths of an em, bounded to keep layouts readable.', yue: '以十分之一 em 調整字距，有限制避免版面失控。' }, defaultValue: '0/10em' },
  lineHeight: { en: 'Line height', yue: '行高', section: 'type', explanation: { en: 'Sets line height from 80% to 240% for this element’s text.', yue: '設定呢個元素文字行高 80% 至 240%。' }, defaultValue: '140%' },
  paddingScale: { en: 'Padding', yue: '內距', section: 'layout', explanation: { en: 'Scales the element’s internal spacing from 50% to 200% while retaining its content.', yue: '將元素內距縮放 50% 至 200%，保留入面內容。' }, defaultValue: '100%' },
};

export const TOKEN_SECTIONS: ReadonlyArray<{ id: TokenSection; en: string; yue: string }> = [
  { id: 'colour', en: 'Colour', yue: '顏色' },
  { id: 'shape', en: 'Shape', yue: '形狀' },
  { id: 'type', en: 'Type', yue: '字體' },
  { id: 'layout', en: 'Layout', yue: '版面' },
];

export const RAIL_COMMANDS = [
  { command: 'rail-side:left' as CommandId, en: 'Move tabs to the left rail', yue: '分頁擺左邊' },
  { command: 'rail-side:right' as CommandId, en: 'Move tabs to the right rail', yue: '分頁擺右邊' },
  { command: 'rail-side:top' as CommandId, en: 'Move tabs to the top rail', yue: '分頁擺上面' },
  { command: 'rail-side:bottom' as CommandId, en: 'Move tabs to the bottom rail', yue: '分頁擺下面' },
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

const command = (id: CommandId, en: string, yue: string, icon: string, keywords: string[], group: EntryGroup, target?: EntryTarget): Entry => ({
  id: `cmd:${id}`, kind: 'command', group, icon, en, yue, keywords, action: { type: 'command', command: id, target },
});

const settingTarget = (field: SettingField): EntryTarget => ({
  surface: field.section === 'general' ? 'settings.general' : 'settings.appearance',
  focusId: `setting-${String(field.key)}`,
});

const settingControl = (field: SettingField, value: UserSettings[typeof field.key]): EntryControl => {
  if (field.kind === 'select') return { kind: 'select', value: String(value), options: field.options ?? [] };
  if (field.kind === 'range') return { kind: 'range', value: Number(value), min: field.min ?? 1, max: field.max ?? 5, step: 1 };
  if (field.kind === 'color') return { kind: 'color', value: String(value) };
  if (field.kind === 'switch') return { kind: 'switch', value: Boolean(value) };
  return { kind: 'text', value: String(value), maxLength: 64 };
};

const scheduleTarget = (key: ScheduleFieldKey): EntryTarget => ({
  surface: 'settings.schedule',
  focusId: `schedule-${key.replace('.', '-')}`,
});

const scheduleControl = (field: (typeof SCHEDULE_FIELDS)[number], schedule: ScheduleConfig): EntryControl | undefined => {
  if (field.kind === 'switch') return { kind: 'switch', value: Boolean(readScheduleField(schedule, field.key)) };
  if (field.kind === 'minutes') {
    const options = field.key === 'selfUpdate.intervalMinutes'
      ? SELF_INTERVAL_PRESETS
      : CATALOG_INTERVAL_PRESETS;
    return {
      kind: 'select',
      value: String(readScheduleField(schedule, field.key)),
      options: options.map((value) => ({ value: String(value), en: `${value} minutes`, yue: `${value} 分鐘` })),
    };
  }
  if (field.kind === 'time') return { kind: 'range', value: Number(readScheduleField(schedule, field.key)), min: 0, max: 1_439, step: 15 };
  return undefined;
};

const appearanceControl = (token: TokenId, override: ElementOverride | undefined): EntryControl | undefined => {
  if (token === 'background' || token === 'foreground') {
    const color = override?.[token];
    return { kind: 'color', value: color?.kind === 'hex' ? color.hex : '#6750a4' };
  }
  if (token === 'paddingScale') return { kind: 'range', value: Number(override?.paddingScale ?? 100), min: 50, max: 200, step: 5 };
  if (token === 'fontScale') return { kind: 'range', value: Number(override?.fontScale ?? 100), min: 75, max: 150, step: 5 };
  if (token === 'fontWeight') return { kind: 'range', value: Number(override?.fontWeight ?? 400), min: 400, max: 800, step: 100 };
  if (token === 'fontFamily') {
    const current = typeof override?.fontFamily === 'string' ? override.fontFamily : 'system-ui';
    const families = ['system-ui', 'Segoe UI', 'Arial', 'Tahoma', 'Consolas', 'Microsoft JhengHei'];
    const options = Array.from(new Set([current, ...families])).map((value) => ({ value, en: value, yue: value }));
    return { kind: 'select', value: current, options };
  }
  if (token === 'fontStyle') {
    const value = override?.fontStyle ?? 'normal';
    return { kind: 'select', value, options: ['normal', 'italic', 'oblique'].map((item) => ({ value: item, en: item, yue: item })) };
  }
  if (token === 'textDecoration') {
    const value = override?.textDecoration ?? 'none';
    return { kind: 'select', value, options: ['none', 'underline', 'overline', 'line-through', 'underline overline', 'underline line-through', 'overline line-through', 'underline overline line-through'].map((item) => ({ value: item, en: item, yue: item })) };
  }
  if (token === 'fontVariationAxes') return { kind: 'text', value: Object.entries(override?.fontVariationAxes ?? {}).map(([axis, value]) => `${axis}=${value}`).join(', '), maxLength: 96 };
  if (token === 'underlineColor') {
    const color = override?.underlineColor;
    return { kind: 'color', value: color?.kind === 'hex' ? color.hex : '#6750a4' };
  }
  if (token === 'underlineStyle') return { kind: 'select', value: override?.underlineStyle ?? 'solid', options: ['solid', 'double', 'dotted', 'dashed', 'wavy'].map((item) => ({ value: item, en: item, yue: item })) };
  if (token === 'underlineThickness') return { kind: 'range', value: Number(override?.underlineThickness ?? 0), min: 0, max: 10, step: 1 };
  if (token === 'textTransform') return { kind: 'select', value: override?.textTransform ?? 'none', options: ['none', 'uppercase', 'lowercase', 'capitalize'].map((item) => ({ value: item, en: item, yue: item })) };
  if (token === 'fontVariantCaps') return { kind: 'select', value: override?.fontVariantCaps ?? 'normal', options: ['normal', 'small-caps', 'all-small-caps', 'petite-caps', 'all-petite-caps', 'unicase', 'titling-caps'].map((item) => ({ value: item, en: item, yue: item })) };
  if (token === 'baselineOffset') return { kind: 'range', value: Number(override?.baselineOffset ?? 0), min: -200, max: 200, step: 5 };
  if (token === 'textDirection') return { kind: 'select', value: override?.textDirection ?? 'auto', options: ['auto', 'ltr', 'rtl'].map((item) => ({ value: item, en: item, yue: item })) };
  if (token === 'textAlign') return { kind: 'select', value: override?.textAlign ?? 'start', options: ['start', 'center', 'end', 'justify'].map((item) => ({ value: item, en: item, yue: item })) };
  if (token === 'textShadow') return { kind: 'text', value: override?.textShadow ? `${override.textShadow.x},${override.textShadow.y},${override.textShadow.blur}` : '', maxLength: 32 };
  if (token === 'letterSpacing') return { kind: 'range', value: Number(override?.letterSpacing ?? 0), min: -4, max: 16, step: 1 };
  if (token === 'lineHeight') return { kind: 'range', value: Number(override?.lineHeight ?? 140), min: 80, max: 240, step: 5 };
  if (token === 'borderWidth') return { kind: 'range', value: Number(override?.borderWidth ?? 0), min: 0, max: 3, step: 1 };
  if (token === 'radius') return {
    kind: 'select', value: String(override?.radius ?? 'md'), options: RADII.map((value) => ({ value, en: value, yue: value })),
  };
  if (token === 'elevation') return {
    kind: 'select', value: String(override?.elevation ?? 'none'), options: ELEVATIONS.map((value) => ({ value, en: value, yue: value })),
  };
  return undefined;
};

export function buildRegistry(context: RegistryContext): Entry[] {
  const { settings, workspace, appearance, schedule, apps } = context;
  const entries: Entry[] = [];

  for (const surface of SURFACES) {
    entries.push({
      id: `page:${surface.surface}`, kind: 'page', group: 'Pages', icon: surface.icon,
      en: `Open ${surface.en}`, yue: `開 ${surface.yue}`, keywords: surface.keywords,
      action: { type: 'open-surface', surface: surface.surface, target: { surface: surface.surface } },
    });
  }

  for (const article of GENERATED_DOCS) {
    entries.push(command(
      `open-doc:${article.id}`,
      `Open article: ${article.title}`,
      `開文章：${article.titleYue}`,
      'menu_book',
      [article.id, article.category, article.status, ...article.related],
      'Pages',
      { surface: 'docs', articleId: article.id, focusId: `docs-tab-${article.id}` },
    ));
  }

  for (const field of SETTING_FIELDS) {
    entries.push({
      id: `set:${field.key}`, kind: 'setting', group: 'Settings', icon: 'settings',
      en: `Setting: ${field.en}`, yue: `設定：${field.yue}`, keywords: [field.key, ...field.keywords],
      action: { type: 'set-setting', key: field.key, value: null, target: settingTarget(field) },
      control: settingControl(field, settings[field.key]),
    });
    for (const option of field.options ?? []) {
      entries.push(command(
        `set-option:${field.key}:${option.value}` as CommandId,
        `Set ${field.en} to ${option.en}`, `${field.yue}設做 ${option.yue}`, 'settings',
        [field.key, option.value], 'Settings', settingTarget(field),
      ));
    }
  }

  for (const definition of ELEMENTS) {
    const key = definition.key as ElementKey;
    const overridden = Object.keys(appearance[key] ?? {}).length;
    entries.push(command(`edit-element:${key}`, `Edit appearance of ${definition.en}`, `編輯${definition.yue}外觀`, 'palette', [key, definition.yue, 'appearance', 'style'], 'Appearance', { surface: 'settings.appearance', element: key }));
    entries.push(command(`reset-element:${key}`, `Reset appearance of ${definition.en}`, `重設${definition.yue}外觀`, 'restart_alt', [key, definition.yue, 'reset'], 'Appearance', { surface: 'settings.appearance', element: key }));
    for (const token of definition.tokens) {
      entries.push({
        id: `appear:${key}:${token}`, kind: 'appearance', group: 'Appearance', icon: 'palette',
        en: `${definition.en} · ${TOKEN_META[token].en}`, yue: `${definition.yue} · ${TOKEN_META[token].yue}`,
        keywords: [key, token, definition.yue, TOKEN_META[token].section, overridden ? 'overridden' : 'default'],
        action: { type: 'set-appearance', target: key, token, value: null, destination: { surface: 'settings.appearance', element: key } },
        control: appearanceControl(token, appearance[key]),
      });
    }
  }

  for (const field of SCHEDULE_FIELDS) {
    entries.push({
      id: `sched:${field.key}`, kind: 'schedule', group: 'Schedule', icon: 'schedule',
      en: `Schedule: ${field.en}`, yue: `排程：${field.yue}`, keywords: [field.key, ...field.keywords],
      action: { type: 'set-schedule', key: field.key, value: null, target: scheduleTarget(field.key) },
      control: scheduleControl(field, schedule),
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
    const tabTarget: EntryTarget = { tabId: tab.id, focusId: `tab-${tab.id}` };
    entries.push(command(`pin:${tab.id}`, tab.pinned ? `Unpin ${meta.en}` : `Pin ${meta.en}`, tab.pinned ? `取消釘住 ${meta.yue}` : `釘住 ${meta.yue}`, 'push_pin', [tab.id, 'pin'], 'Tabs', tabTarget));
    entries.push(command(`move-up:${tab.id}`, `Move ${meta.en} up`, `${meta.yue} 上移`, 'expand_more', [tab.id, 'order'], 'Tabs', tabTarget));
    entries.push(command(`move-down:${tab.id}`, `Move ${meta.en} down`, `${meta.yue} 下移`, 'expand_more', [tab.id, 'order'], 'Tabs', tabTarget));
    if (tab.groupId) entries.push(command(`group-remove:${tab.id}`, `Remove ${meta.en} from its group`, `${meta.yue} 離開分組`, 'folder', [tab.id, 'group'], 'Tabs', tabTarget));
    for (const group of workspace.groups) {
      if (tab.groupId === group.id || tab.pinned) continue;
      entries.push(command(`group-add:${tab.id}:${group.id}` as CommandId, `Add ${meta.en} to ${group.name}`, `${meta.yue} 加入 ${group.name}`, 'folder', [tab.id, group.name, 'group'], 'Tabs', { tabId: tab.id, groupId: group.id, focusId: `tab-group-header-${group.id}` }));
    }
  }

  for (const group of workspace.groups) {
    const groupTarget: EntryTarget = { groupId: group.id, focusId: `tab-group-header-${group.id}` };
    entries.push(command(`group-rename:${group.id}`, `Rename group ${group.name}`, `改名分組 ${group.name}`, 'folder', [group.name, 'rename'], 'Tabs', groupTarget));
    entries.push(command(`group-collapse:${group.id}`, group.collapsed ? `Expand group ${group.name}` : `Collapse group ${group.name}`, group.collapsed ? `展開分組 ${group.name}` : `收埋分組 ${group.name}`, 'chevron_right', [group.name, 'collapse'], 'Tabs', groupTarget));
    entries.push(command(`group-delete:${group.id}`, `Delete group ${group.name}`, `刪除分組 ${group.name}`, 'delete', [group.name, 'delete'], 'Tabs', groupTarget));
    for (const color of TAB_GROUP_COLORS) {
      entries.push(command(`group-color:${group.id}:${color}` as CommandId, `Recolour ${group.name} to ${GROUP_COLOR_LABELS[color].en}`, `${group.name} 轉做${GROUP_COLOR_LABELS[color].yue}色`, 'palette', [group.name, color], 'Tabs', groupTarget));
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
      action: { type: 'command', command: `open-app:${app.id}`, target: { surface: 'catalog', focusId: 'search-catalog' } },
    });
  }

  return entries;
}

export const ALL_SURFACE_IDS: readonly SurfaceId[] = SURFACE_IDS;
