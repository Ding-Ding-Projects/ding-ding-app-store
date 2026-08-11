import { useEffect, useMemo, useRef, useState } from 'react';
import type { HistoryEntry, HistoryExportFormat, HistoryRevision, OperationKind, UserSettings } from '../../shared/contracts';
import { SearchBox } from '../components/SearchBox';
import { el } from '../el';
import { downloadBase64, downloadText } from '../files';
import { Icon } from '../icons';
import { label } from '../i18n';
import { highlight, makeMatcher, useSurfaceSearch } from '../search';
import { exportHistoryEntries } from '../history-export';
import { HISTORY_EXPORT_FORMATS, historyExportFormat } from '../../shared/export-registry';
import { isExternalEditorBridgeAvailable, openArchiveInVsCode, openExportInVsCode } from '../external-editor';
import type { Notify } from '../notify';
import { dateKey, matchesHistoryDate, presetRange, resolveHistoryDateRange } from '../history-date-filter';
import { DestructiveConfirmDialog } from '../components/DestructiveConfirmDialog';

type HistoryResult = 'all' | 'ok' | 'failed';

function historyDateError(settings: UserSettings, error: string): string {
  if (!error || settings.language === 'en') return error;
  if (error.startsWith('Start date must be before')) return '開始日期要早過結束日期；你輸入嘅內容保留返。';
  if (error.startsWith('Start date')) return '開始日期未完整或者無效；你輸入嘅內容保留返。';
  return '結束日期未完整或者無效；你輸入嘅內容保留返。';
}

export function ActivityPage({ entries, revisions, loading, settings, openRegex, onRegexHandled, notify, onHistoryChanged }: {
  entries: HistoryEntry[]; revisions: HistoryRevision[]; loading: boolean; settings: UserSettings; openRegex: boolean; onRegexHandled(): void; notify: Notify; onHistoryChanged(): Promise<void>;
}) {
  const search = useSurfaceSearch('activity');
  const [kinds, setKinds] = useState<Set<OperationKind>>(() => new Set());
  const [result, setResult] = useState<HistoryResult>('all');
  const [preset, setPreset] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(() => dateKey(new Date()).slice(0, 7));
  const [exportBusy, setExportBusy] = useState<HistoryExportFormat | null>(null);
  const [exportFormat, setExportFormat] = useState<HistoryExportFormat>('json');
  const [copyBusy, setCopyBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [revisionDiffs, setRevisionDiffs] = useState<Record<string, string>>({});
  const [revisionBusy, setRevisionBusy] = useState<string | null>(null);
  const [restoreRevision, setRestoreRevision] = useState<HistoryRevision | null>(null);
  const [labelRevision, setLabelRevision] = useState<HistoryRevision | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const lastSelected = useRef<number | null>(null);
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const dateRange = useMemo(() => resolveHistoryDateRange(dateStart, dateEnd, settings.language === 'yue' ? 'yue' : 'en'), [dateStart, dateEnd, settings.language]);
  const calendarDays = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const start = new Date(year, month - 1, 1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
  }, [calendarMonth]);

  const actionKinds = useMemo(() => Array.from(new Set(entries.map((entry) => entry.kind))).sort(), [entries]);
  const actionCounts = useMemo(() => new Map(actionKinds.map((action) => [action, entries.filter((entry) => entry.kind === action).length])), [actionKinds, entries]);
  useEffect(() => {
    setKinds((current) => {
      const next = new Set([...current].filter((action) => actionKinds.includes(action)));
      return next.size === current.size ? current : next;
    });
  }, [actionKinds]);
  const toggleKind = (action: OperationKind) => setKinds((current) => {
    const next = new Set(current);
    if (next.has(action)) next.delete(action); else next.add(action);
    return next;
  });
  const actionLabel = (action: OperationKind) => ({
    install: label(settings, 'Install', '安裝'),
    build: label(settings, 'Build', '建置'),
    uninstall: label(settings, 'Uninstall', '解除安裝'),
    update: label(settings, 'Update', '更新'),
    settings: label(settings, 'Settings', '設定'),
  })[action];
  const filtered = useMemo(() => {
    let source = entries;
    if (kinds.size) source = source.filter((entry) => kinds.has(entry.kind));
    if (result !== 'all') source = source.filter((entry) => (result === 'ok' ? entry.ok : !entry.ok));
    source = source.filter((entry) => matchesHistoryDate(entry.occurredAt, dateRange, settings.language === 'yue' ? 'yue' : 'en'));
    return source.filter((entry) => matcher(`${entry.displayName}\n${entry.kind}\n${entry.message}`));
  }, [entries, kinds, result, dateRange, matcher, settings.language]);
  useEffect(() => {
    const ids = new Set(entries.map((entry) => entry.id));
    setSelected((current) => new Set([...current].filter((id) => ids.has(id))));
  }, [entries]);
  const selectedEntries = filtered.filter((entry) => selected.has(entry.id));
  const exportEntries = selectedEntries.length ? selectedEntries : filtered;

  const runExport = async () => {
    const definition = historyExportFormat(exportFormat);
    setExportBusy(exportFormat);
    try {
      if (exportFormat === 'zip') {
        const archive = await window.dingDingStore.history.archive({ entryIds: exportEntries.map((entry) => entry.id) });
        downloadBase64(archive.filename, archive.base64, archive.mime);
        notify({ ok: true, message: `Exported ${archive.recordCount} filtered activity records as a re-importable ZIP archive.` });
        return;
      }
      downloadText(`ding-ding-app-store-history.${definition.extension}`, exportHistoryEntries(exportEntries, exportFormat), definition.mime);
      notify({ ok: true, message: `Exported ${exportEntries.length} filtered activity records as ${definition.label}.` });
    } catch (error) {
      notify({ ok: false, message: (error as Error).message || 'The Activity export could not be written.' });
    } finally {
      setExportBusy(null);
    }
  };

  const copyJson = async () => {
    setCopyBusy(true);
    try {
      await navigator.clipboard.writeText(exportHistoryEntries(exportEntries, 'json'));
      notify({ ok: true, message: `Copied ${exportEntries.length} filtered activity records.` });
    } finally {
      setCopyBusy(false);
    }
  };
  const openInCode = async () => {
    if (exportFormat === 'zip') {
      try {
        const archive = await window.dingDingStore.history.archive({ entryIds: exportEntries.map((entry) => entry.id) });
        const result = await openArchiveInVsCode({ recordKind: 'activity', suggestedName: archive.filename, mime: archive.mime, base64: archive.base64 });
        notify({ ok: result.ok, message: result.ok ? `Opened ${archive.recordCount} activity records as a re-importable ZIP workspace in Visual Studio Code.` : result.message });
      } catch (error) {
        notify({ ok: false, message: (error as Error).message || 'The ZIP archive could not be opened in Visual Studio Code.' });
      }
      return;
    }
    const definition = historyExportFormat(exportFormat);
    const result = await openExportInVsCode({ recordKind: 'activity', suggestedName: `ding-ding-app-store-history.${definition.extension}`, mime: definition.mime, content: exportHistoryEntries(exportEntries, exportFormat) });
    notify({ ok: result.ok, message: result.ok ? `Opened ${exportEntries.length} activity records in Visual Studio Code.` : result.message });
  };
  const selectAt = (index: number, checked: boolean, shiftKey: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      const start = shiftKey && lastSelected.current !== null ? Math.min(lastSelected.current, index) : index;
      const end = shiftKey && lastSelected.current !== null ? Math.max(lastSelected.current, index) : index;
      for (let cursor = start; cursor <= end; cursor += 1) {
        const id = filtered[cursor]?.id;
        if (!id) continue;
        if (checked) next.add(id); else next.delete(id);
      }
      return next;
    });
    lastSelected.current = index;
  };

  const showDiff = async (revision: HistoryRevision) => {
    if (revisionDiffs[revision.id] !== undefined) {
      setRevisionDiffs((current) => { const next = { ...current }; delete next[revision.id]; return next; });
      return;
    }
    setRevisionBusy(revision.id);
    try {
      const value = await window.dingDingStore.history.diff(revision.id);
      setRevisionDiffs((current) => ({ ...current, [revision.id]: value || 'No textual state changes in this revision.' }));
    } catch (error) { notify({ ok: false, message: (error as Error).message }); }
    finally { setRevisionBusy(null); }
  };

  const saveRevisionLabel = async () => {
    if (!labelRevision) return;
    setRevisionBusy(labelRevision.id);
    try {
      const result = await window.dingDingStore.history.label(labelRevision.id, labelDraft);
      notify(result);
      if (result.ok) { setLabelRevision(null); setLabelDraft(''); await onHistoryChanged(); }
    } catch (error) { notify({ ok: false, message: (error as Error).message }); }
    finally { setRevisionBusy(null); }
  };

  const restoreSelectedRevision = async () => {
    if (!restoreRevision) return;
    setRevisionBusy(restoreRevision.id);
    try {
      const result = await window.dingDingStore.history.restore(restoreRevision.id);
      notify(result);
      if (result.ok) await onHistoryChanged();
    } catch (error) { notify({ ok: false, message: (error as Error).message }); }
    finally { setRevisionBusy(null); setRestoreRevision(null); }
  };

  if (loading) return <div className="loading-grid" aria-label={label(settings, 'Loading activity', '讀緊操作記錄')}><div className="skeleton" /><div className="skeleton" /></div>;
  if (!entries.length && !revisions.length) {
    return <div className="empty-state" {...el('empty-state')}><Icon>history</Icon><h2>{label(settings, 'No operations yet', '仲未有操作')}</h2><p>{label(settings, 'Installs, builds, updates, uninstalls, failures, and recoveries will appear here with exact results and export controls.', '安裝、建置、更新、解除安裝、失敗同復原會連同準確結果同匯出控制喺呢度出現。')}</p></div>;
  }

  const setPresetAndRange = (next: 'all' | 'today' | '7d' | '30d') => {
    setPreset(next);
    const range = presetRange(next);
    setDateStart(range.start); setDateEnd(range.end);
    if (range.start) setCalendarMonth(range.start.slice(0, 7));
  };
  const setManualDate = (setter: (value: string) => void) => (value: string) => { setPreset('all'); setter(value); if (/^\d{4}-\d{2}-\d{2}$/.test(value)) setCalendarMonth(value.slice(0, 7)); };
  const chooseCalendarDay = (day: Date) => {
    const value = dateKey(day);
    if (!dateStart || (dateStart && dateEnd)) setManualDate(setDateStart)(value);
    else setManualDate(setDateEnd)(value);
  };

  return <>
    <SearchBox surface="activity" settings={settings} placeholder={label(settings, 'Search activity by app, action, or message', '按 app、動作或者訊息搵操作記錄')} openBuilder={openRegex} onBuilderHandled={onRegexHandled} />
    <section className="history-panel">
        <div className="chip-row" role="group" aria-label={label(settings, 'Filter by action; choose one or more', '按動作篩選；可以揀一個或多個')}>
          <button aria-pressed={!kinds.size} onClick={() => setKinds(new Set())}>{label(settings, 'All actions', '全部動作')} ({entries.length})</button>
          {actionKinds.map((action) => <button key={action} aria-pressed={kinds.has(action)} onClick={() => toggleKind(action)}>{actionLabel(action)} ({actionCounts.get(action) ?? 0})</button>)}
        </div>
      <div className="chip-row" role="group" aria-label={label(settings, 'Filter by result', '按結果篩選')}>{(['all', 'ok', 'failed'] as const).map((value) => <button key={value} aria-pressed={result === value} onClick={() => setResult(value)}>{value === 'all' ? label(settings, 'Any result', '任何結果') : value === 'ok' ? label(settings, 'Succeeded', '成功') : label(settings, 'Failed', '失敗')}</button>)}</div>
      <details className="history-date-filter" open={Boolean(dateStart || dateEnd || dateRange.error)}>
        <summary>{label(settings, 'Advanced date range', '進階日期範圍')}</summary>
        <div className="date-range" aria-label={label(settings, 'Activity date range', '操作記錄日期範圍')}>
          <label>{label(settings, 'Start date', '開始日期')}<input value={dateStart} placeholder={label(settings, 'YYYY-MM-DD or locale date', 'YYYY-MM-DD 或本地日期')} aria-invalid={Boolean(dateRange.error && dateStart)} onChange={(event) => setManualDate(setDateStart)(event.target.value)} /></label>
          <label className="calendar-field">{label(settings, 'Start calendar', '開始日曆')}<input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(dateStart) ? dateStart : ''} onChange={(event) => setManualDate(setDateStart)(event.target.value)} /></label>
          <label>{label(settings, 'End date', '結束日期')}<input value={dateEnd} placeholder={label(settings, 'YYYY-MM-DD or locale date', 'YYYY-MM-DD 或本地日期')} aria-invalid={Boolean(dateRange.error && dateEnd)} onChange={(event) => setManualDate(setDateEnd)(event.target.value)} /></label>
          <label className="calendar-field">{label(settings, 'End calendar', '結束日曆')}<input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(dateEnd) ? dateEnd : ''} onChange={(event) => setManualDate(setDateEnd)(event.target.value)} /></label>
        </div>
        <div className="calendar-jump"><label>{label(settings, 'Calendar month and year', '日曆月份同年份')}<input type="month" value={calendarMonth} onChange={(event) => setCalendarMonth(event.target.value)} /></label><button className="text-button" onClick={() => { setDateStart(''); setDateEnd(''); setPreset('all'); }}>{label(settings, 'Clear dates', '清除日期')}</button></div>
        <div className="calendar-grid" role="grid" aria-label={label(settings, `Calendar for ${calendarMonth}`, `日曆：${calendarMonth}`)}>
          {calendarDays.map((day) => {
            const value = dateKey(day);
            const selectedDay = value === dateStart || value === dateEnd;
            return <div key={day.toISOString()} role="gridcell" aria-selected={selectedDay} aria-label={day.toLocaleDateString()}>
              <button type="button" className={day.getMonth() === Number(calendarMonth.slice(5, 7)) - 1 ? '' : 'outside-month'} aria-current={value === dateKey(new Date()) ? 'date' : undefined} aria-pressed={selectedDay} aria-label={day.toLocaleDateString()} onClick={() => chooseCalendarDay(day)}>{day.getDate()}</button>
            </div>;
          })}
        </div>
        {dateRange.error && <p className="field-error" role="alert">{historyDateError(settings, dateRange.error)}</p>}
      </details>
      <div className="chip-row" role="group" aria-label={label(settings, 'Filter by date', '按日期篩選')}>{(['all', 'today', '7d', '30d'] as const).map((value) => <button key={value} aria-pressed={preset === value} onClick={() => setPresetAndRange(value)}>{value === 'all' ? label(settings, 'All time', '全部時間') : value === 'today' ? label(settings, 'Today', '今日') : value === '7d' ? label(settings, '7 days', '七日') : label(settings, '30 days', '三十日')}</button>)}</div>
      <details className="history-revisions" open={revisions.length > 0}>
        <summary>{label(settings, 'Local versions', '本機版本')} ({revisions.length})</summary>
        <p className="supporting">{label(settings, 'These versions contain App Store-owned settings, installed records, workspace tabs, appearance, schedules, run metadata, and external-editor preference. Credentials, secrets, staged update paths, and user project files are excluded. Restore creates a new revision; it never rewrites local history.', '呢啲版本包括 App Store 自己嘅設定、已安裝記錄、工作區分頁、外觀、排程、執行資料同外部編輯器偏好。憑證、秘密、更新暫存路徑同你嘅專案檔案唔會包括。還原會新增版本，唔會改寫本機歷史。')}</p>
        {revisions.length ? <ol className="revision-list">{revisions.map((revision) => <li key={revision.id} className="revision-row">
          <div className="revision-copy"><strong>{revision.label}</strong><span>{new Date(revision.occurredAt).toLocaleString()} · <code>{revision.id.slice(0, 12)}</code></span><small>{revision.changedFiles.length ? revision.changedFiles.join(', ') : label(settings, 'No tracked file delta', '冇追蹤檔案變更')}</small></div>
          <div className="revision-actions"><button className="text-button" aria-label={label(settings, `${revisionDiffs[revision.id] === undefined ? 'View' : 'Hide'} diff for ${revision.label}`, `${revisionDiffs[revision.id] === undefined ? '查看' : '隱藏'}「${revision.label}」嘅差異`)} disabled={revisionBusy === revision.id} onClick={() => void showDiff(revision)}>{revisionDiffs[revision.id] === undefined ? label(settings, 'View diff', '查看差異') : label(settings, 'Hide diff', '隱藏差異')}</button><button className="text-button" aria-label={label(settings, `Label revision ${revision.label}`, `標籤版本「${revision.label}」`)} disabled={!revision.restorable || revisionBusy === revision.id} onClick={() => { setLabelRevision(revision); setLabelDraft(revision.label); }}>{label(settings, 'Label', '標籤')}</button><button className="text-button" aria-label={label(settings, `Restore revision ${revision.label}`, `還原版本「${revision.label}」`)} disabled={!revision.restorable || revisionBusy === revision.id} onClick={() => setRestoreRevision(revision)}>{label(settings, 'Restore', '還原')}</button></div>
          {revisionDiffs[revision.id] !== undefined && <pre className="revision-diff" aria-label={label(settings, `Diff for ${revision.label}`, `「${revision.label}」嘅差異`)}>{revisionDiffs[revision.id]}</pre>}
          {labelRevision?.id === revision.id && <form className="revision-label-form" onSubmit={(event) => { event.preventDefault(); void saveRevisionLabel(); }}><label>{label(settings, 'Revision label', '版本標籤')}<input autoFocus maxLength={80} value={labelDraft} onChange={(event) => setLabelDraft(event.target.value)} /></label><button className="filled-button" disabled={revisionBusy === revision.id || !labelDraft.trim()} type="submit">{label(settings, 'Save label', '儲存標籤')}</button><button className="text-button" type="button" onClick={() => setLabelRevision(null)}>{label(settings, 'Cancel', '取消')}</button></form>}
        </li>)}</ol> : <p className="empty-state compact">{label(settings, 'No local snapshots yet. A successful App Store operation creates the first version.', '仲未有本機快照。App Store 操作成功後會建立第一個版本。')}</p>}
      </details>
      <div className="card-actions">
        <button className="text-button" disabled={copyBusy} onClick={() => void copyJson()}><Icon>content_copy</Icon>{copyBusy ? label(settings, 'Copying…', '複製緊…') : label(settings, 'Copy JSON', '複製 JSON')}</button>
        <label>{label(settings, 'Export format', '匯出格式')}<select aria-label={label(settings, 'Export format', '匯出格式')} value={exportFormat} onChange={(event) => setExportFormat(event.target.value as HistoryExportFormat)}>{HISTORY_EXPORT_FORMATS.map((format) => <option key={format.id} value={format.id}>{format.label}</option>)}</select></label>
        <span className="supporting" aria-live="polite">UTF-8 · LF · {historyExportFormat(exportFormat).schema}</span>
        <button className="text-button" disabled={exportBusy !== null || !exportEntries.length} onClick={() => void runExport()}><Icon>download</Icon>{label(settings, 'Export', '匯出')}</button>
        <button className="text-button" disabled={!exportEntries.length || !isExternalEditorBridgeAvailable()} title={isExternalEditorBridgeAvailable() ? undefined : label(settings, 'Unavailable: this build has no reviewed Visual Studio Code adapter.', '未能使用：呢個版本冇已審核嘅 Visual Studio Code adapter。')} onClick={() => void openInCode()}><Icon>code</Icon>{isExternalEditorBridgeAvailable() ? label(settings, 'Open in VS Code', '喺 VS Code 開') : label(settings, 'VS Code unavailable', 'VS Code 未能使用')}</button>
      </div>
      <div className="bulk-toolbar" aria-label={label(settings, 'Activity bulk actions', '操作記錄批量操作')}><strong aria-live="polite">{label(settings, `${selectedEntries.length} selected · ${filtered.length} shown · ${entries.length} total`, `揀咗 ${selectedEntries.length} · 顯示 ${filtered.length} · 總共 ${entries.length}`)}</strong><button className="text-button" disabled={!filtered.length} onClick={() => setSelected(new Set(filtered.map((entry) => entry.id)))}>{label(settings, 'Select all shown', '揀晒目前顯示')}</button><button className="text-button" disabled={!filtered.length} onClick={() => setSelected((current) => new Set(filtered.filter((entry) => !current.has(entry.id)).map((entry) => entry.id)))}>{label(settings, 'Invert shown', '反轉目前顯示')}</button><button className="text-button" disabled={!selected.size} onClick={() => setSelected(new Set())}>{label(settings, 'Clear', '清除')}</button><button className="text-button" disabled title={label(settings, 'Operation history is append-only and cannot be deleted.', '操作記錄只可追加，唔可以刪除。')}>{label(settings, 'Delete unavailable', '刪除未能使用')}</button></div>
      {filtered.length ? <ul className="history-list">{filtered.map((entry, index) => <li key={entry.id} className={entry.ok ? 'history-row ok' : 'history-row failed'} {...el('history-row')}>
        <label className="selection-check"><input type="checkbox" checked={selected.has(entry.id)} onClick={(event) => selectAt(index, event.currentTarget.checked, event.shiftKey)} onChange={() => undefined} /><span className="visually-hidden">{label(settings, `Select ${entry.displayName} ${entry.kind}`, `揀選 ${entry.displayName} ${entry.kind}`)}</span></label>
        <Icon>{entry.ok ? 'check_circle' : 'error'}</Icon>
        <div className="history-copy">
          <div className="history-heading"><strong>{highlight(search.state, entry.displayName)}</strong><span className="status-pill" {...el('status-pill')}>{actionLabel(entry.kind)}</span><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString()}</time></div>
          <p>{highlight(search.state, entry.message)}</p>
        </div>
      </li>)}</ul> : <div className="empty-state" {...el('empty-state')}><Icon>search_off</Icon><h2>{label(settings, 'No matching activity', '冇配到嘅操作記錄')}</h2><p>{label(settings, 'Clear the search, action, result, or date filters to see more history.', '清除搜尋、動作、結果或者日期篩選就會見到更多記錄。')}</p></div>}
    </section>
    {restoreRevision && <DestructiveConfirmDialog settings={settings} title={label(settings, `Restore “${restoreRevision.label}”?`, `還原「${restoreRevision.label}」？`)} description={label(settings, "This replaces the App Store's own settings, installed records, workspace, appearance, and schedule state with the selected local snapshot. Credentials, staged update paths, and user project files are never touched. A before-restore revision and a new restore revision are recorded.", '呢個操作會用所揀本機快照取代 App Store 自己嘅設定、已安裝記錄、工作區、外觀同排程狀態。憑證、更新暫存路徑同你嘅專案檔案完全唔會掂；還原前同還原後都會新增版本。')} actionLabel={label(settings, 'RESTORE LOCAL VERSION', '還原本機版本')} onClose={() => setRestoreRevision(null)} onConfirm={() => void restoreSelectedRevision()} />}
  </>;
}
