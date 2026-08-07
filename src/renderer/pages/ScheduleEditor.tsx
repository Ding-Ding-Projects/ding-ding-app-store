import { useEffect, useState } from 'react';
import { SCHEDULE_BOUNDS } from '../../shared/contracts';
import type { ScheduleRunRecord, ScheduleTaskId, ScheduleTaskStatus, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { clockToMinutes, formatAbsolute, formatClock, formatMinutes, formatRelative, label } from '../i18n';
import { CATALOG_INTERVAL_PRESETS, SELF_INTERVAL_PRESETS } from '../registry';
import type { ScheduleApi } from '../state/use-schedule';

const TICK_MS = 30_000;

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

export function ScheduleEditor({ settings, schedule }: { settings: UserSettings; schedule: ScheduleApi }) {
  useTick();
  const { draft, status, dirty, saving, issues } = schedule;
  const quietSpansMidnight = draft.quietHours.endMinute < draft.quietHours.startMinute;
  const issueFor = (field: string) => issues.find((issue) => issue.field.startsWith(field))?.message;

  return (
    <section className="schedule-grid">
      <div className="settings-card schedule-card" {...el('schedule-card')}>
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
        {issueFor('selfUpdate') && <p className="field-error" role="alert">{issueFor('selfUpdate')}</p>}
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
        <div className="time-range">
          <label>{label(settings, 'From', '由')}<input id="schedule-quietHours-startMinute" type="time" value={formatClock(draft.quietHours.startMinute)} onChange={(event) => schedule.set('quietHours.startMinute', clockToMinutes(event.target.value))} /></label>
          <label>{label(settings, 'To', '到')}<input id="schedule-quietHours-endMinute" type="time" value={formatClock(draft.quietHours.endMinute)} onChange={(event) => schedule.set('quietHours.endMinute', clockToMinutes(event.target.value))} /></label>
          {quietSpansMidnight && <span className="quiet-badge">{label(settings, 'Spans midnight', '跨過凌晨')}</span>}
        </div>
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
        <button className="text-button" onClick={() => schedule.resetDefaults()}><Icon>restart_alt</Icon>{label(settings, 'Reset to defaults', '還原預設')}</button>
        <button className="text-button" disabled={!dirty} onClick={() => schedule.discard()}>{label(settings, 'Discard changes', '放棄改動')}</button>
        <button className="filled-button" disabled={!dirty || saving} onClick={() => void schedule.save()}>{saving ? label(settings, 'Saving…', '儲存緊…') : label(settings, 'Save schedule', '儲存排程')}</button>
      </div>
      <p className="supporting">{label(settings, 'Saving is the only thing that re-arms the timers.', '淨係儲存先會重新啟動計時。')}</p>
    </section>
  );
}
