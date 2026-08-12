import { useEffect, useState } from 'react';
import { SCHEDULE_BOUNDS } from '../../shared/contracts';
import type { ScheduleRunRecord, ScheduleTaskId, ScheduleTaskStatus, ScheduledSettingRule, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { clockToMinutes, formatAbsolute, formatClock, formatMinutes, formatRelative, label } from '../i18n';
import { CATALOG_INTERVAL_PRESETS, SELF_INTERVAL_PRESETS, SCHEDULE_FIELDS } from '../registry';
import type { ScheduleApi } from '../state/use-schedule';
import { ColorTranslatorControl } from '../components/ColorTranslatorControl';
import { SearchablePicker, type SearchablePickerOption } from '../components/SearchablePicker';

const TICK_MS = 30_000;

function ScheduleExplanation({ settings, keyName, source, dirty }: { settings: UserSettings; keyName: (typeof SCHEDULE_FIELDS)[number]['key']; source: 'persisted' | 'fallback'; dirty: boolean }) {
  const field = SCHEDULE_FIELDS.find((candidate) => candidate.key === keyName) ?? SCHEDULE_FIELDS[SCHEDULE_FIELDS.length - 1];
  const current = dirty
    ? label(settings, `Current value: unsaved draft; saved base was ${source === 'persisted' ? 'persisted' : `compiled fallback (${field.defaultValue})`}.`, `目前值：未儲存草稿；已儲存基礎係${source === 'persisted' ? '已儲存' : `編譯內置後備值（${field.defaultValue}）`}。`)
    : source === 'persisted'
      ? label(settings, 'Current value: persisted in the validated schedule file.', '目前值：已儲存喺驗證過嘅排程檔。')
      : label(settings, `Current value: compiled fallback (${field.defaultValue}).`, `目前值：編譯內置後備值（${field.defaultValue}）。`);
  return <details className="setting-help"><summary>{label(settings, 'What this controls', '呢個控制咩')}</summary><p>{label(settings, field.explanation.en, field.explanation.yue)}</p><p className="provenance-line">{current}</p></details>;
}

/** Re-renders the relative countdown without polling the main process. */
function useTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let handle = 0;
    const arm = () => { handle = window.setTimeout(() => { setTick((value) => value + 1); arm(); }, TICK_MS); };
    arm();
    return () => window.clearTimeout(handle);
  }, []);
  return tick;
}

function RunLine({ record, settings }: { record: ScheduleRunRecord | null; settings: UserSettings }) {
  if (!record) return <p className="supporting">{label(settings, 'No run recorded yet.', '未有執行記錄。')}</p>;
  return (
    <p className="supporting">
      <span className={`status-pill ${record.outcome === 'ok' ? 'up-to-date' : record.outcome === 'failed' ? 'failed' : ''}`} {...el('status-pill')}>{record.outcome}</span>
      <time dateTime={record.at}>{formatAbsolute(record.at)}</time> · {formatRelative(settings, record.at)} · {record.trigger}
      {record.fromPreviousSession && ` · ${label(settings, 'from previous session', '上一次開機')}`}
      <br />{record.message}
    </p>
  );
}

function TaskStatusCard({ task, settings, onRun, running }: { task: ScheduleTaskStatus; settings: UserSettings; onRun(id: ScheduleTaskId): void; running: boolean }) {
  useTick();
  const next = task.running
    ? label(settings, 'Running now', '執行緊')
    : !task.armed
      ? label(settings, 'Not scheduled', '冇排程')
      : task.nextRunAt
        ? `${formatAbsolute(task.nextRunAt)} · ${formatRelative(settings, task.nextRunAt)}${task.nextRunIsBackoff ? label(settings, ` · retrying after ${task.consecutiveFailures} failed checks`, ` · ${task.consecutiveFailures} 次失敗後重試`) : ''}`
        : label(settings, 'Not scheduled', '冇排程');
  return (
    <div className="status-grid-item">
      <h4>{task.id === 'self-update' ? label(settings, 'App Store check', '商店檢查') : label(settings, 'Catalog refresh', '目錄整理')}</h4>
      <RunLine record={task.lastRun} settings={settings} />
      <p className="supporting" aria-hidden="true">{label(settings, 'Next run', '下一次')}: {next}</p>
      <p className="visually-hidden">{label(settings, 'Next run', '下一次')}: {task.armed ? label(settings, 'scheduled', '已排程') : label(settings, 'not scheduled', '冇排程')}</p>
      <button className="tonal-button" disabled={running || task.running} onClick={() => onRun(task.id)}>
        <Icon>refresh</Icon>{task.id === 'self-update' ? label(settings, 'Check now', '而家檢查') : label(settings, 'Refresh now', '而家整理')}
      </button>
    </div>
  );
}

const RULE_KEYS = ['language', 'englishFunnyLevel', 'cantoneseFunnyLevel', 'theme', 'density', 'accent', 'displayName'] as const;
type RuleKey = (typeof RULE_KEYS)[number];
const RESTRICTED_RULE_KEYS = new Set<RuleKey>(['language', 'englishFunnyLevel', 'cantoneseFunnyLevel']);
const WEEKDAYS = [
  ['1', 'Mon', '一'], ['2', 'Tue', '二'], ['3', 'Wed', '三'], ['4', 'Thu', '四'], ['5', 'Fri', '五'], ['6', 'Sat', '六'], ['7', 'Sun', '日'],
] as const;

function newRule(): ScheduledSettingRule {
  const suffix = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(-8).padStart(8, '0');
  return { id: `rule_${suffix}`, label: 'Scheduled appearance', enabled: true, startDate: null, endDate: null, startMinute: 540, endMinute: 1020, weekdays: [1, 2, 3, 4, 5, 6, 7], timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'local', priority: 50, values: { theme: 'dark' }, source: { kind: 'local' } };
}

function ruleValue(rule: ScheduledSettingRule, key: RuleKey): string {
  const value = rule.values[key];
  return value === undefined ? '' : String(value);
}

function scheduleOptions(key: RuleKey): SearchablePickerOption[] {
  if (key === 'language') return [{ value: 'en', en: 'English', yue: '英文' }, { value: 'yue', en: 'Hong Kong Cantonese', yue: '香港粵語' }, { value: 'bilingual', en: 'English + Hong Kong Cantonese', yue: '英文 + 香港粵語' }];
  if (key === 'theme') return [{ value: 'system', en: 'System', yue: '跟隨系統' }, { value: 'light', en: 'Light', yue: '明亮' }, { value: 'dark', en: 'Dark', yue: '深色' }];
  return [{ value: 'comfortable', en: 'Comfortable', yue: '舒適' }, { value: 'compact', en: 'Compact', yue: '緊湊' }, { value: 'spacious', en: 'Spacious', yue: '寬鬆' }];
}

function RuleCard({ rule, sourceStatus, settings, availableKeys, onChange, onRemove }: { rule: ScheduledSettingRule; sourceStatus?: { state: string; message: string | null }; settings: UserSettings; availableKeys: readonly RuleKey[]; onChange(rule: ScheduledSettingRule): void; onRemove(): void }) {
  const selectedKey = (availableKeys.find((key) => rule.values[key] !== undefined) ?? 'theme') as RuleKey;
  const homeAssistantSource = rule.source.kind === 'home-assistant' ? rule.source : null;
  const setValue = (key: RuleKey, value: string) => {
    const values = { ...rule.values } as ScheduledSettingRule['values'];
    for (const candidate of RULE_KEYS) delete values[candidate];
    if (key === 'englishFunnyLevel' || key === 'cantoneseFunnyLevel') values[key] = Math.max(1, Math.min(5, Number(value) || 1));
    else if (key === 'language') values[key] = value as ScheduledSettingRule['values']['language'];
    else if (key === 'theme') values[key] = value as ScheduledSettingRule['values']['theme'];
    else if (key === 'density') values[key] = value as ScheduledSettingRule['values']['density'];
    else if (key === 'accent') values[key] = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value) ? value : '#6750A4';
    else values[key] = value.trim().slice(0, 64) || 'Ding Ding App Store';
    onChange({ ...rule, values });
  };
  const toggleDay = (day: number) => onChange({ ...rule, weekdays: rule.weekdays.includes(day) ? rule.weekdays.filter((value) => value !== day) : [...rule.weekdays, day].sort((a, b) => a - b) });
  return (
    <div className="scheduled-rule" {...el('schedule-card')}>
      <div className="scheduled-rule-heading"><input aria-label={label(settings, 'Enable rule', '啟用規則')} type="checkbox" checked={rule.enabled} onChange={(event) => onChange({ ...rule, enabled: event.target.checked })} /><input aria-label={label(settings, 'Rule label', '規則名稱')} value={rule.label} maxLength={64} onChange={(event) => onChange({ ...rule, label: event.target.value })} /><button className="text-button" onClick={onRemove}><Icon>delete</Icon>{label(settings, 'Remove', '移除')}</button></div>
      <details className="setting-help"><summary>{label(settings, 'What this rule controls', '呢條規則控制咩')}</summary><p>{label(settings, 'This rule temporarily changes one supported setting inside its date, time, weekday, and time-zone window. Lower priority numbers win ties; the saved base value returns when no rule matches.', '呢條規則喺指定日期、時間、星期同時區時段暫時改一個支援設定；優先次序數字越細越先，冇規則配到就返去已儲存基礎值。')}</p><p className="provenance-line">{label(settings, 'Current rule value: unsaved draft until you save this schedule.', '目前規則值：儲存排程之前都係未儲存草稿。')}</p></details>
      <div className="scheduled-rule-grid">
        <SearchablePicker labelText={label(settings, 'Setting to override', '要覆蓋嘅設定')} settings={settings} value={selectedKey} onChange={(next) => setValue(next as RuleKey, ruleValue(rule, next as RuleKey))} options={availableKeys.map((key) => ({ value: key, en: key, yue: key }))} />
        <div className="scheduled-value-field"><span className="searchable-picker-label">{label(settings, 'Scheduled value', '排程值')}</span>{selectedKey === 'language' || selectedKey === 'theme' || selectedKey === 'density' ? <SearchablePicker labelText={label(settings, 'Choose value', '揀值')} settings={settings} value={ruleValue(rule, selectedKey)} onChange={(next) => setValue(selectedKey, next)} options={scheduleOptions(selectedKey)} /> : selectedKey === 'accent' ? <ColorTranslatorControl settings={settings} value={ruleValue(rule, selectedKey) || '#6750A4'} labelText={label(settings, 'Scheduled accent', '排程主色')} onChange={(next) => setValue(selectedKey, next)} /> : <input type={selectedKey.includes('FunnyLevel') ? 'number' : 'text'} min={1} max={5} value={ruleValue(rule, selectedKey)} onChange={(event) => setValue(selectedKey, event.target.value)} />}</div>
        <label>{label(settings, 'Start date (optional)', '開始日期（可留空）')}<input type="date" value={rule.startDate ?? ''} onChange={(event) => onChange({ ...rule, startDate: event.target.value || null })} /></label>
        <label>{label(settings, 'End date (optional)', '結束日期（可留空）')}<input type="date" value={rule.endDate ?? ''} onChange={(event) => onChange({ ...rule, endDate: event.target.value || null })} /></label>
        <label>{label(settings, 'From', '由')}<input type="time" value={formatClock(rule.startMinute)} onChange={(event) => onChange({ ...rule, startMinute: clockToMinutes(event.target.value) })} /></label>
        <label>{label(settings, 'To', '到')}<input type="time" value={formatClock(rule.endMinute)} onChange={(event) => onChange({ ...rule, endMinute: clockToMinutes(event.target.value) })} /></label>
        <label>{label(settings, 'Time zone', '時區')}<input value={rule.timeZone} maxLength={64} onChange={(event) => onChange({ ...rule, timeZone: event.target.value || 'local' })} /><small>{label(settings, 'Times use this zone; daylight-saving changes are honoured.', '時間用呢個時區，會跟夏令時間變。')}</small></label>
        <label>{label(settings, 'Priority (lower wins)', '優先次序（數字越細越先）')}<input type="number" min={0} max={100} value={rule.priority} onChange={(event) => onChange({ ...rule, priority: Math.max(0, Math.min(100, Number(event.target.value) || 0)) })} /></label>
        <SearchablePicker labelText={label(settings, 'Value source', '設定來源')} settings={settings} value={rule.source.kind} onChange={(kind) => {
          if (kind === 'api') onChange({ ...rule, source: { kind: 'api', url: 'https://example.invalid/scheduled-settings.json' } });
          else if (kind === 'home-assistant') onChange({ ...rule, source: { kind: 'home-assistant', baseUrl: 'https://homeassistant.local', entityId: 'input_boolean.scheduled_settings' } });
          else onChange({ ...rule, source: { kind: 'local' } });
        }} options={[{ value: 'local', en: 'Local scheduled value', yue: '本機排程值' }, { value: 'api', en: 'Versioned HTTPS API', yue: '版本化 HTTPS API' }, { value: 'home-assistant', en: 'Home Assistant boolean', yue: 'Home Assistant 布林值' }]} />
        {rule.source.kind === 'api' && <label>{label(settings, 'HTTPS API URL', 'HTTPS API 網址')}<input type="url" value={rule.source.url} maxLength={2048} onChange={(event) => onChange({ ...rule, source: { kind: 'api', url: event.target.value } })} /><small>{label(settings, 'The API must return version 1 and only supported setting fields. The local scheduled value is retained if validation fails.', 'API 必須回傳版本 1 同支援嘅設定欄位；驗證失敗會保留本機排程值。')}</small></label>}
        {homeAssistantSource && <><label>{label(settings, 'Home Assistant URL', 'Home Assistant 網址')}<input type="url" value={homeAssistantSource.baseUrl} maxLength={2048} onChange={(event) => onChange({ ...rule, source: { kind: 'home-assistant', baseUrl: event.target.value, entityId: homeAssistantSource.entityId } })} /></label><label>{label(settings, 'Boolean entity', 'Boolean entity')}<input value={homeAssistantSource.entityId} maxLength={128} onChange={(event) => onChange({ ...rule, source: { kind: 'home-assistant', baseUrl: homeAssistantSource.baseUrl, entityId: event.target.value } })} /><small>{label(settings, 'Use input_boolean or binary_sensor. Its token stays only in the operating system credential vault and is never stored in this schedule.', '用 input_boolean 或 binary_sensor。Token 只會留喺作業系統憑證庫，唔會儲喺排程。')}</small></label></>}
      </div>
      <div className="chip-row" role="group" aria-label={label(settings, 'Weekdays', '星期')}><span className="supporting">{label(settings, 'Days', '日子')}:</span>{WEEKDAYS.map(([value, en, yue]) => { const day = Number(value); return <button key={value} aria-pressed={rule.weekdays.includes(day)} onClick={() => toggleDay(day)}>{label(settings, en, yue)}</button>; })}</div>
      {rule.startMinute > rule.endMinute && <p className="quiet-badge">{label(settings, 'Cross-midnight window', '跨過凌晨時段')}</p>}
      {sourceStatus && <p className={`source-status source-${sourceStatus.state}`} role="status">{label(settings, `External source: ${sourceStatus.state}${sourceStatus.message ? ` — ${sourceStatus.message}` : ''}`, `外部來源：${sourceStatus.state}${sourceStatus.message ? ` — ${sourceStatus.message}` : ''}`)}</p>}
    </div>
  );
}

export function ScheduleEditor({ settings, schedule, restricted = false }: { settings: UserSettings; schedule: ScheduleApi; restricted?: boolean }) {
  useTick();
  const { draft, status, dirty, saving, issues } = schedule;
  const quietSpansMidnight = draft.quietHours.endMinute < draft.quietHours.startMinute;
  const source = status?.configSource ?? 'fallback';
  const issueFor = (field: string) => issues.find((issue) => issue.field.startsWith(field))?.message;
  const availableRuleKeys = restricted ? RULE_KEYS.filter((key) => !RESTRICTED_RULE_KEYS.has(key)) : [...RULE_KEYS];
  const visibleRules = restricted
    ? draft.rules.filter((rule) => !RULE_KEYS.some((key) => RESTRICTED_RULE_KEYS.has(key) && rule.values[key] !== undefined))
    : draft.rules;

  return (
    <section className="schedule-grid">
      <div id="schedule-rules" className="settings-card schedule-card" {...el('schedule-card')}>
        <h2>{label(settings, 'App Store self-update', '商店自我更新')}</h2>
        <p className="supporting" id="schedule-startup-note">
          {label(settings, 'A check runs once at every launch and cannot be turned off. This switch only controls repeat checks while the app stays open.', '每次開機都會檢查一次，關唔到。呢個掣淨係控制開住嗰陣嘅重複檢查。')}
        </p>
        <div className="switch-row">
          <label>
            <input id="schedule-selfUpdate-repeatEnabled" type="checkbox" checked={draft.selfUpdate.repeatEnabled} aria-describedby="schedule-startup-note" onChange={(event) => schedule.set('selfUpdate.repeatEnabled', event.target.checked)} />
            {label(settings, 'Repeat checks while running', '執行期間重複檢查')}
          </label>
        </div>
        <ScheduleExplanation settings={settings} keyName="selfUpdate.repeatEnabled" source={source} dirty={schedule.dirty} />
        <div className="chip-row" role="group" aria-label={label(settings, 'Check interval presets', '檢查間隔預設')}>
          {SELF_INTERVAL_PRESETS.map((minutes) => (
            <button key={minutes} aria-pressed={draft.selfUpdate.intervalMinutes === minutes} onClick={() => schedule.set('selfUpdate.intervalMinutes', minutes)}>{formatMinutes(settings, minutes)}</button>
          ))}
        </div>
        <label>
          {label(settings, 'Custom interval in minutes', '自訂間隔（分鐘）')}
          <input
            id="schedule-selfUpdate-intervalMinutes"
            type="number"
            min={SCHEDULE_BOUNDS.selfUpdateMinutes.min}
            max={SCHEDULE_BOUNDS.selfUpdateMinutes.max}
            step={SCHEDULE_BOUNDS.selfUpdateMinutes.step}
            value={draft.selfUpdate.intervalMinutes}
            onChange={(event) => schedule.set('selfUpdate.intervalMinutes', Number(event.target.value))}
          />
        </label>
        <p className="supporting">= {formatMinutes(settings, draft.selfUpdate.intervalMinutes)}</p>
        <ScheduleExplanation settings={settings} keyName="selfUpdate.intervalMinutes" source={source} dirty={schedule.dirty} />
        {issueFor('selfUpdate') && <p className="field-error" role="alert">{issueFor('selfUpdate')}</p>}
      </div>

      <div className="settings-card schedule-card" {...el('schedule-card')}>
        <h2>{label(settings, 'Scheduled settings', '排程設定')}</h2>
        <p className="supporting">{restricted
          ? 'Temporarily override the available appearance settings during a local date/time window. Saved restricted choices remain stored and return when restricted presentation ends.'
          : label(settings, 'Temporarily override language, funny levels, theme, density, accent, or display name during a local date/time window. Rules are evaluated in their saved time zone; lower priority numbers win ties. Your base settings remain recoverable when a window ends.', '喺指定本地日期／時間暫時覆蓋語言、幽默程度、主題、密度、主色或者顯示名稱。規則用儲存嘅時區判斷；優先次序數字越細越先。時段完咗之後會返去原本設定。')}</p>
        <p className="supporting">{label(settings, 'External sources are read only by the main process. A missing Home Assistant vault token appears as a source failure and never creates a schedule field for a secret.', '外部來源只會由主程序讀取。Home Assistant 憑證庫冇 token 會顯示來源失敗，唔會喺排程整一個秘密欄位。')}</p>
        {visibleRules.map((rule) => <RuleCard key={rule.id} rule={rule} sourceStatus={status?.externalSources.find((item) => item.ruleId === rule.id)} settings={settings} availableKeys={availableRuleKeys} onChange={(next) => schedule.setRules(draft.rules.map((item) => item.id === next.id ? next : item))} onRemove={() => schedule.setRules(draft.rules.filter((item) => item.id !== rule.id))} />)}
        <button className="tonal-button" onClick={() => schedule.setRules([...draft.rules, newRule()])}><Icon>add</Icon>{label(settings, 'Add scheduled setting', '加排程設定')}</button>
        {!restricted && <ScheduleExplanation settings={settings} keyName="rules" source={source} dirty={schedule.dirty} />}
        {!restricted && issueFor('rules') && <p className="field-error" role="alert">{issueFor('rules')}</p>}
      </div>

      <div className="settings-card schedule-card" {...el('schedule-card')}>
        <h2>{label(settings, 'Catalog refresh', '目錄整理')}</h2>
        <p className="supporting">
          {label(settings, `The floor is ${SCHEDULE_BOUNDS.catalogMinutes.min} minutes because that is the catalog cache lifetime. Any successful refresh, including a manual one, restarts the countdown.`, `最短 ${SCHEDULE_BOUNDS.catalogMinutes.min} 分鐘，因為目錄 cache 就係咁耐。任何一次成功整理（連手動）都會重新計時。`)}
        </p>
        <div className="switch-row">
          <label>
            <input id="schedule-catalogRefresh-enabled" type="checkbox" checked={draft.catalogRefresh.enabled} onChange={(event) => schedule.set('catalogRefresh.enabled', event.target.checked)} />
            {label(settings, 'Scheduled catalog refresh', '定時重新整理目錄')}
          </label>
        </div>
        <ScheduleExplanation settings={settings} keyName="catalogRefresh.enabled" source={source} dirty={schedule.dirty} />
        <div className="chip-row" role="group" aria-label={label(settings, 'Refresh interval presets', '整理間隔預設')}>
          {CATALOG_INTERVAL_PRESETS.map((minutes) => (
            <button key={minutes} aria-pressed={draft.catalogRefresh.intervalMinutes === minutes} onClick={() => schedule.set('catalogRefresh.intervalMinutes', minutes)}>{formatMinutes(settings, minutes)}</button>
          ))}
        </div>
        <label>
          {label(settings, 'Custom interval in minutes', '自訂間隔（分鐘）')}
          <input
            id="schedule-catalogRefresh-intervalMinutes"
            type="number"
            min={SCHEDULE_BOUNDS.catalogMinutes.min}
            max={SCHEDULE_BOUNDS.catalogMinutes.max}
            step={SCHEDULE_BOUNDS.catalogMinutes.step}
            value={draft.catalogRefresh.intervalMinutes}
            onChange={(event) => schedule.set('catalogRefresh.intervalMinutes', Number(event.target.value))}
          />
        </label>
        <p className="supporting">= {formatMinutes(settings, draft.catalogRefresh.intervalMinutes)}</p>
        <ScheduleExplanation settings={settings} keyName="catalogRefresh.intervalMinutes" source={source} dirty={schedule.dirty} />
        {issueFor('catalogRefresh') && <p className="field-error" role="alert">{issueFor('catalogRefresh')}</p>}
      </div>

      <div className="settings-card schedule-card" {...el('schedule-card')}>
        <h2>{label(settings, 'Quiet hours', '靜音時間')}</h2>
        <div className="switch-row">
          <label>
            <input id="schedule-quietHours-enabled" type="checkbox" checked={draft.quietHours.enabled} onChange={(event) => schedule.set('quietHours.enabled', event.target.checked)} />
            {label(settings, 'Hold corner notifications during quiet hours', '靜音期間唔彈角落通知')}
          </label>
        </div>
        <ScheduleExplanation settings={settings} keyName="quietHours.enabled" source={source} dirty={schedule.dirty} />
        <div className="time-range">
          <label>{label(settings, 'From', '由')}<input id="schedule-quietHours-startMinute" type="time" value={formatClock(draft.quietHours.startMinute)} onChange={(event) => schedule.set('quietHours.startMinute', clockToMinutes(event.target.value))} /></label>
          <label>{label(settings, 'To', '到')}<input id="schedule-quietHours-endMinute" type="time" value={formatClock(draft.quietHours.endMinute)} onChange={(event) => schedule.set('quietHours.endMinute', clockToMinutes(event.target.value))} /></label>
          {quietSpansMidnight && <span className="quiet-badge">{label(settings, 'Spans midnight', '跨過凌晨')}</span>}
        </div>
        <ScheduleExplanation settings={settings} keyName="quietHours.startMinute" source={source} dirty={schedule.dirty} />
        <ScheduleExplanation settings={settings} keyName="quietHours.endMinute" source={source} dirty={schedule.dirty} />
        <div className="chip-row" role="group" aria-label={label(settings, 'Quiet hour presets', '靜音預設')}>
          <button onClick={() => { schedule.set('quietHours.startMinute', 1320); schedule.set('quietHours.endMinute', 420); }}>22:00 – 07:00</button>
          <button onClick={() => { schedule.set('quietHours.startMinute', 540); schedule.set('quietHours.endMinute', 1020); }}>09:00 – 17:00</button>
        </div>
        {status?.quietHours.active && <p className="quiet-badge" role="status">{label(settings, `Quiet now until ${formatClock(draft.quietHours.endMinute)}`, `而家靜音，去到 ${formatClock(draft.quietHours.endMinute)}`)}</p>}
        <p className="supporting">
          {label(settings, `Times use ${status?.quietHours.timeZone ?? 'this computer'} local time and follow daylight saving changes.`, `時間用 ${status?.quietHours.timeZone ?? '呢部電腦'} 嘅本地時間，會跟夏令時間變。`)}
        </p>
        <p className="supporting">
          {label(settings, 'Checks still run during quiet hours. Only corner notifications are held, the update banner stays live, and held notices are summarised once the window closes.', '靜音期間一樣會檢查。淨係唔彈角落通知，更新橫幅照樣顯示，收埋咗嘅通知會喺靜音完之後一次過講返。')}
        </p>
        {issueFor('quietHours') && <p className="field-error" role="alert">{issueFor('quietHours')}</p>}
      </div>

      <div className="settings-card schedule-card status-grid" {...el('schedule-card')}>
        <h2>{label(settings, 'Last and next runs', '上次同下次執行')}</h2>
        {status
          ? <>
            {(['self-update', 'catalog-refresh'] as const).map((id) => (
              <TaskStatusCard key={id} task={status.tasks[id]} settings={settings} onRun={(task) => void schedule.runNow(task)} running={schedule.running !== null} />
            ))}
            <div className="status-grid-item">
              <h4>{label(settings, 'Startup check', '開機檢查')}</h4>
              <RunLine record={status.startupCheck} settings={settings} />
              {!status.packagedBuild && <p className="supporting">{label(settings, 'Development build: no update feed request was made.', '開發版本：冇向更新來源發送請求。')}</p>}
            </div>
          </>
          : <p className="supporting">{label(settings, 'Reading the schedule…', '讀緊排程…')}</p>}
      </div>

      <div className="settings-actions">
        {!restricted && <button className="text-button" onClick={() => schedule.resetDefaults()}><Icon>restart_alt</Icon>{label(settings, 'Reset to defaults', '還原預設')}</button>}
        <button className="text-button" disabled={!dirty} onClick={() => schedule.discard()}>{label(settings, 'Discard changes', '放棄改動')}</button>
        <button className="filled-button" disabled={!dirty || saving} onClick={() => void schedule.save()}>{saving ? label(settings, 'Saving…', '儲存緊…') : label(settings, 'Save schedule', '儲存排程')}</button>
      </div>
      <p className="supporting">{label(settings, 'Saving is the only thing that re-arms the timers.', '淨係儲存先會重新啟動計時。')}</p>
    </section>
  );
}
