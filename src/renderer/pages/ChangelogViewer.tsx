import { useMemo, useRef, useState } from 'react';
import type { UserSettings } from '../../shared/contracts';
import { CHANGELOG_ENTRIES, changelogMarkdown, validateChangelog } from '../changelog';
import { SearchBox } from '../components/SearchBox';
import { downloadText } from '../files';
import { Icon } from '../icons';
import { label } from '../i18n';
import type { Notify } from '../notify';
import { highlight, makeMatcher, useSurfaceSearch } from '../search';
import { isExternalEditorBridgeAvailable, openExportInVsCode } from '../external-editor';
import { commitUrl, isCommitNavigationAvailable, openCommit } from '../external-navigation';

export function parseChangelogDate(value: string, endOfDay = false): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const calendar = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (calendar) {
    const year = Number(calendar[1]);
    const month = Number(calendar[2]);
    const day = Number(calendar[3]);
    const candidate = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
    if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return Number.NaN;
    return candidate.getTime();
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function changelogCalendarDays(month: string): Date[] {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return [];
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return [];
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function chooseChangelogDate(start: string, end: string, picked: string): { start: string; end: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(picked)) return { start, end };
  if (!start || end) return { start: picked, end: '' };
  return picked < start ? { start: picked, end: start } : { start, end: picked };
}

function shiftMonth(month: string, amount: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return month;
  const value = new Date(Number(match[1]), Number(match[2]) - 1 + amount, 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
}

export function ChangelogViewer({ settings, notify, openRegex, onRegexHandled }: { settings: UserSettings; notify: Notify; openRegex: boolean; onRegexHandled(): void }) {
  const search = useSurfaceSearch('changelog');
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const newestReleaseDate = useMemo(() => new Date(Math.max(...CHANGELOG_ENTRIES.map((entry) => Date.parse(entry.releasedAt)))), []);
  const [calendarMonth, setCalendarMonth] = useState(() => dateKey(new Date()).slice(0, 7));
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const lastSelected = useRef<number | null>(null);
  const startTime = parseChangelogDate(start);
  const endTime = parseChangelogDate(end, true);
  const dateError = Number.isNaN(startTime) ? 'Start date is incomplete or invalid.' : Number.isNaN(endTime) ? 'End date is incomplete or invalid.' : startTime !== null && endTime !== null && startTime > endTime ? 'Start date must be before the end date.' : '';
  const dataIssues = validateChangelog(CHANGELOG_ENTRIES);
  const filtered = useMemo(() => CHANGELOG_ENTRIES.filter((entry) => {
    const timestamp = Date.parse(entry.releasedAt);
    if (dateError) return false;
    if (startTime !== null && timestamp < startTime) return false;
    if (endTime !== null && timestamp > endTime) return false;
    return matcher(`${entry.version}\n${entry.commit}\n${entry.changes.join('\n')}`);
  }), [dateError, startTime, endTime, matcher]);
  const selectedEntries = filtered.filter((entry) => selected.has(entry.version));
  const exportEntries = selectedEntries.length ? selectedEntries : filtered;
  const setPreset = (days: number | null) => {
    if (days === null) { setStart(''); setEnd(''); return; }
    const newest = new Date(Math.max(...CHANGELOG_ENTRIES.map((entry) => Date.parse(entry.releasedAt))));
    const oldest = new Date(newest.getTime() - days * 86_400_000);
    setStart(dateKey(oldest)); setEnd(dateKey(newest));
    setCalendarMonth(dateKey(newest).slice(0, 7));
  };
  const calendarDays = useMemo(() => changelogCalendarDays(calendarMonth), [calendarMonth]);
  const chooseCalendarDay = (day: Date) => {
    const picked = dateKey(day);
    const next = chooseChangelogDate(start, end, picked);
    setStart(next.start);
    setEnd(next.end);
    setCalendarMonth(picked.slice(0, 7));
  };
  const selectAt = (index: number, checked: boolean, shiftKey: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      const from = shiftKey && lastSelected.current !== null ? Math.min(lastSelected.current, index) : index;
      const to = shiftKey && lastSelected.current !== null ? Math.max(lastSelected.current, index) : index;
      for (let cursor = from; cursor <= to; cursor += 1) {
        const version = filtered[cursor]?.version;
        if (!version) continue;
        if (checked) next.add(version); else next.delete(version);
      }
      return next;
    });
    lastSelected.current = index;
  };

  const copy = async () => {
    await navigator.clipboard.writeText(changelogMarkdown(exportEntries, settings.displayName));
    notify({ ok: true, message: `Copied ${exportEntries.length} changelog entries.` });
  };

  return (
    <section className="changelog-viewer" aria-labelledby="changelog-title">
      <header><div><span className="eyebrow">EVERY RELEASE</span><h2 id="changelog-title">{label(settings, 'Changelog', '更新記錄')}</h2></div><span className="status-pill">{filtered.length} shown</span></header>
      <SearchBox surface="changelog" settings={settings} placeholder={label(settings, 'Search versions, changes, and commit SHAs', '搵版本、改動同 commit SHA')} openBuilder={openRegex} onBuilderHandled={onRegexHandled} />
      <details className="changelog-date-filter" open={Boolean(start || end || dateError)}>
        <summary>{label(settings, 'Advanced date range', '進階日期範圍')}</summary>
        <div className="date-range" aria-label={label(settings, 'Changelog date range', '更新記錄日期範圍')}>
          <label>{label(settings, 'Start date', '開始日期')}<input value={start} placeholder="YYYY-MM-DD or locale date" onChange={(event) => setStart(event.target.value)} /></label>
          <label className="calendar-field">{label(settings, 'Start calendar', '開始日曆')}<input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(start) ? start : ''} onChange={(event) => setStart(event.target.value)} /></label>
          <label>{label(settings, 'End date', '結束日期')}<input value={end} placeholder="YYYY-MM-DD or locale date" onChange={(event) => setEnd(event.target.value)} /></label>
          <label className="calendar-field">{label(settings, 'End calendar', '結束日曆')}<input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(end) ? end : ''} onChange={(event) => setEnd(event.target.value)} /></label>
        </div>
        <div className="calendar-jump">
          <button type="button" className="text-button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, -1))} aria-label={label(settings, 'Previous month', '上一個月')}><Icon>chevron_left</Icon></button>
          <label>{label(settings, 'Calendar month and year', '日曆月份同年份')}<input type="month" value={calendarMonth} onChange={(event) => setCalendarMonth(event.target.value)} /></label>
          <button type="button" className="text-button" onClick={() => setCalendarMonth(shiftMonth(calendarMonth, 1))} aria-label={label(settings, 'Next month', '下一個月')}><Icon>chevron_right</Icon></button>
          <button type="button" className="text-button" onClick={() => { setStart(''); setEnd(''); setCalendarMonth(dateKey(newestReleaseDate).slice(0, 7)); }}>{label(settings, 'Clear dates', '清除日期')}</button>
        </div>
        <div className="calendar-grid" role="grid" aria-label={label(settings, `Calendar for ${calendarMonth}`, `日曆：${calendarMonth}`)}>
          {calendarDays.map((day) => {
            const value = dateKey(day);
            const selected = value === start || value === end;
            const inRange = Boolean(start && end && value >= start && value <= end);
            return <div key={value} role="gridcell" aria-selected={selected || inRange}><button type="button" className={day.getMonth() === Number(calendarMonth.slice(5, 7)) - 1 ? '' : 'outside-month'} aria-pressed={selected} aria-current={value === dateKey(new Date()) ? 'date' : undefined} aria-label={day.toLocaleDateString()} onClick={() => chooseCalendarDay(day)}>{day.getDate()}</button></div>;
          })}
        </div>
        <div className="chip-row" role="group" aria-label={label(settings, 'Date presets', '日期預設')}><button onClick={() => setPreset(null)}>{label(settings, 'All releases', '全部版本')}</button><button onClick={() => setPreset(7)}>{label(settings, 'Latest 7 days', '最近七日')}</button><button onClick={() => setPreset(30)}>{label(settings, 'Latest 30 days', '最近三十日')}</button></div>
        {dateError && <p className="field-error" role="alert">{dateError} {label(settings, 'Your typed value was kept.', '你輸入嘅內容保留返。')}</p>}
      </details>
      {dataIssues.length > 0 && <div className="notice warning" role="alert"><Icon>error</Icon><div><strong>Changelog validation failed</strong><p>{dataIssues.join(' ')}</p></div></div>}
      <div className="bulk-toolbar" aria-label="Changelog bulk actions">
        <strong aria-live="polite">{selectedEntries.length} selected · {filtered.length} shown</strong>
        <button className="text-button" onClick={() => setSelected(new Set(filtered.map((entry) => entry.version)))} disabled={!filtered.length}>Select all shown</button>
        <button className="text-button" onClick={() => setSelected((current) => new Set(filtered.filter((entry) => !current.has(entry.version)).map((entry) => entry.version)))} disabled={!filtered.length}>Invert shown</button>
        <button className="text-button" onClick={() => setSelected(new Set())} disabled={!selected.size}>Clear</button>
        <button className="text-button" onClick={() => void copy()} disabled={!exportEntries.length}><Icon>content_copy</Icon>Copy</button>
        <button className="text-button" onClick={() => { downloadText('ding-ding-app-store-changelog.md', changelogMarkdown(exportEntries, settings.displayName), 'text/markdown'); notify({ ok: true, message: `Exported ${exportEntries.length} changelog entries.` }); }} disabled={!exportEntries.length}><Icon>download</Icon>Export Markdown</button>
        <button className="text-button" onClick={() => void openExportInVsCode({ recordKind: 'changelog', suggestedName: 'ding-ding-app-store-changelog.md', mime: 'text/markdown', content: changelogMarkdown(exportEntries, settings.displayName) }).then((result) => notify({ ok: result.ok, message: result.ok ? `Opened ${exportEntries.length} changelog entries in Visual Studio Code.` : result.message }))} disabled={!exportEntries.length || !isExternalEditorBridgeAvailable()} title={isExternalEditorBridgeAvailable() ? undefined : 'Unavailable: this build has no reviewed Visual Studio Code adapter.'}><Icon>code</Icon>{isExternalEditorBridgeAvailable() ? 'Open in VS Code' : 'VS Code unavailable'}</button>
      </div>
      {!dateError && !dataIssues.length && (filtered.length ? <ol className="changelog-list">{filtered.map((entry, index) => <li key={entry.version}>
        <label className="selection-check"><input type="checkbox" checked={selected.has(entry.version)} onClick={(event) => selectAt(index, event.currentTarget.checked, event.shiftKey)} onChange={() => undefined} /><span className="visually-hidden">Select {entry.version}</span></label>
        <div><h3>{highlight(search.state, entry.version)}</h3><time dateTime={entry.releasedAt}>{new Date(entry.releasedAt).toLocaleDateString()}</time>{entry.changes.map((change) => <p key={change}>{highlight(search.state, change)}</p>)}<div className="commit-actions"><code>{entry.commit}</code><button className="text-button" disabled={!isCommitNavigationAvailable()} title={isCommitNavigationAvailable() ? undefined : 'Unavailable: this build has no reviewed external-navigation adapter.'} onClick={() => void openCommit(entry.commit).then((result) => notify({ ok: result.ok, message: result.message }))}><Icon>open_in_new</Icon>{isCommitNavigationAvailable() ? 'Open commit' : 'Open unavailable'}</button><button className="text-button" onClick={() => void navigator.clipboard.writeText(commitUrl(entry.commit)).then(() => notify({ ok: true, message: `Copied the ${entry.commit.slice(0, 12)} commit URL.` }), (error: unknown) => notify({ ok: false, message: (error as Error).message }))}><Icon>content_copy</Icon>Copy commit link</button></div></div>
      </li>)}</ol> : <div className="empty-state"><Icon>search_off</Icon><h3>No matching releases</h3><p>Clear the search or date range to see more changelog entries.</p></div>)}
    </section>
  );
}
