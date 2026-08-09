import { useMemo, useRef, useState } from 'react';
import type { ExternalEditorResult, OperationResult, UserSettings } from '../../shared/contracts';
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

type ChangelogMessageKind = 'success' | 'error';
type ExternalEditorFailureReason = Extract<ExternalEditorResult, { ok: false }>['reason'];
type UnexpectedFailureCode = 'clipboard-write-failed' | 'markdown-export-failed' | 'external-editor-bridge-failed' | 'commit-navigation-bridge-failed' | 'commit-url-copy-failed';

const CHANGELOG_TONE_PREFIXES: Record<ChangelogMessageKind, { en: readonly string[]; yue: readonly string[] }> = {
  success: {
    en: ['', 'Done: ', 'Nicely done: ', 'Release notes behaving: ', 'Tiny changelog confetti: '],
    yue: ['', '好，', '搞掂：', '靚靚咁完成：', '小小慶功鑼響起：'],
  },
  error: {
    en: ['', 'Heads up: ', 'Small snag: ', 'The changelog trolley hit a bump: ', 'The release-note gremlin tripped: '],
    yue: ['', '留意：', '有少少阻滯：', '更新記錄車仔碌到粒石：', '更新記錄小妖怪跣咗一腳：'],
  },
};

const levelIndex = (level: number): number => Math.max(1, Math.min(5, Math.round(level))) - 1;

/** Style message voice at every funny level while leaving the supplied facts untouched. */
export function changelogMessage(settings: UserSettings, kind: ChangelogMessageKind, enFact: string, yueFact: string): string {
  const prefixes = CHANGELOG_TONE_PREFIXES[kind];
  const english = `${prefixes.en[levelIndex(settings.englishFunnyLevel)]}${enFact}`;
  const cantonese = `${prefixes.yue[levelIndex(settings.cantoneseFunnyLevel)]}${yueFact}`;
  return label(settings, english, cantonese);
}

export function formatChangelogDate(settings: UserSettings, value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === 'string' ? value : '';
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return label(settings, date.toLocaleDateString('en-CA', options), date.toLocaleDateString('zh-HK', options));
}

export interface LocalizedChangelogIssue {
  fact: string | null;
  message: string;
}

/** Keep a version or row identifier singular, then localize only its validation predicate. */
export function localizeChangelogIssue(settings: UserSettings, issue: string): LocalizedChangelogIssue {
  const invalidVersion = /^Entry (\d+) has an invalid version\.$/.exec(issue);
  if (invalidVersion) return { fact: `#${invalidVersion[1]}`, message: changelogMessage(settings, 'error', 'has an invalid version.', '版本無效。') };
  const duplicated = /^Version (.+) is duplicated\.$/.exec(issue);
  if (duplicated) return { fact: duplicated[1], message: changelogMessage(settings, 'error', 'is duplicated.', '重複咗。') };
  const missingCommit = /^(.+) is missing a full commit SHA\.$/.exec(issue);
  if (missingCommit) return { fact: missingCommit[1], message: changelogMessage(settings, 'error', 'is missing a full commit SHA.', '欠缺完整 commit SHA。') };
  const invalidDate = /^(.+) has an invalid release date\.$/.exec(issue);
  if (invalidDate) return { fact: invalidDate[1], message: changelogMessage(settings, 'error', 'has an invalid release date.', '發佈日期無效。') };
  const missingChange = /^(.+) has no factual change entry\.$/.exec(issue);
  if (missingChange) return { fact: missingChange[1], message: changelogMessage(settings, 'error', 'has no factual change entry.', '冇實際改動記錄。') };
  return { fact: null, message: issue };
}

export function changelogEditorResultMessage(settings: UserSettings, result: ExternalEditorResult, count: number): string {
  if (result.ok) return changelogMessage(settings, 'success', `Opened ${count} changelog entries in Visual Studio Code.`, `已喺 Visual Studio Code 開啟 ${count} 條更新記錄。`);
  const failures: Record<ExternalEditorFailureReason, [string, string]> = {
    'bridge-unavailable': ['Opening changelog exports in Visual Studio Code is unavailable in this build. Markdown download remains available.', '呢個版本未能喺 Visual Studio Code 開啟更新記錄；仍然可以下載 Markdown。'],
    'not-installed': ['Visual Studio Code is not installed or no validated executable is available. Markdown download remains available.', '未安裝 Visual Studio Code，或者冇已驗證嘅執行檔；仍然可以下載 Markdown。'],
    'write-failed': ['The changelog export was rejected or could not be written to the app-owned workspace. Markdown download remains available.', '更新記錄匯出被拒絕，或者未能寫入 app 專用工作區；仍然可以下載 Markdown。'],
    'launch-failed': ['Visual Studio Code was found, but Windows did not start it. Markdown download remains available.', '搵到 Visual Studio Code，但 Windows 冇啟動佢；仍然可以下載 Markdown。'],
    'launch-timeout': ['Visual Studio Code launch was not confirmed within 2 seconds. Markdown download remains available.', '兩秒內未能確認 Visual Studio Code 已啟動；仍然可以下載 Markdown。'],
  };
  const [en, yue] = failures[result.reason];
  return changelogMessage(settings, 'error', en, yue);
}

export function changelogCommitResultMessage(settings: UserSettings, result: OperationResult): string {
  if (result.ok) return changelogMessage(settings, 'success', 'Commit link opened.', '已開啟 commit 連結。');
  return changelogMessage(settings, 'error', result.message, result.messageYue ?? '未能開啟 commit 連結。');
}

export function unexpectedFailureMessage(settings: UserSettings, code: UnexpectedFailureCode, enFallback: string, yueFallback: string): string {
  return `${changelogMessage(settings, 'error', enFallback, yueFallback)} [${code}]`;
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
  const dateError = Number.isNaN(startTime) ? changelogMessage(settings, 'error', 'Start date is incomplete or invalid.', '開始日期未完整或者無效。') : Number.isNaN(endTime) ? changelogMessage(settings, 'error', 'End date is incomplete or invalid.', '結束日期未完整或者無效。') : startTime !== null && endTime !== null && startTime > endTime ? changelogMessage(settings, 'error', 'Start date must be before the end date.', '開始日期要早過結束日期。') : '';
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
    try {
      await navigator.clipboard.writeText(changelogMarkdown(exportEntries, settings.displayName));
      notify({ ok: true, message: changelogMessage(settings, 'success', `Copied ${exportEntries.length} changelog entries.`, `已複製 ${exportEntries.length} 條更新記錄。`) });
    } catch {
      notify({ ok: false, message: unexpectedFailureMessage(settings, 'clipboard-write-failed', 'The changelog could not be copied.', '未能複製更新記錄。') });
    }
  };

  const exportMarkdown = () => {
    try {
      downloadText('ding-ding-app-store-changelog.md', changelogMarkdown(exportEntries, settings.displayName), 'text/markdown');
      notify({ ok: true, message: changelogMessage(settings, 'success', `Exported ${exportEntries.length} changelog entries.`, `已匯出 ${exportEntries.length} 條更新記錄。`) });
    } catch {
      notify({ ok: false, message: unexpectedFailureMessage(settings, 'markdown-export-failed', 'The changelog export could not be written.', '未能寫入更新記錄匯出檔。') });
    }
  };

  const openInCode = async () => {
    try {
      const result = await openExportInVsCode({ recordKind: 'changelog', suggestedName: 'ding-ding-app-store-changelog.md', mime: 'text/markdown', content: changelogMarkdown(exportEntries, settings.displayName) });
      notify({ ok: result.ok, message: changelogEditorResultMessage(settings, result, exportEntries.length) });
    } catch {
      notify({ ok: false, message: unexpectedFailureMessage(settings, 'external-editor-bridge-failed', 'The changelog export could not be opened in Visual Studio Code.', '未能喺 Visual Studio Code 開啟更新記錄匯出。') });
    }
  };

  const openCommitLink = async (commit: string) => {
    try {
      const result = await openCommit(commit);
      notify({ ok: result.ok, message: changelogCommitResultMessage(settings, result) });
    } catch {
      notify({ ok: false, message: unexpectedFailureMessage(settings, 'commit-navigation-bridge-failed', 'The commit link could not be opened.', '未能開啟 commit 連結。') });
    }
  };

  const copyCommitLink = async (commit: string) => {
    try {
      await navigator.clipboard.writeText(commitUrl(commit));
      notify({ ok: true, message: changelogMessage(settings, 'success', 'Copied commit URL.', '已複製 commit URL。') });
    } catch {
      notify({ ok: false, message: unexpectedFailureMessage(settings, 'commit-url-copy-failed', 'The commit URL could not be copied.', '未能複製 commit URL。') });
    }
  };

  return (
    <section className="changelog-viewer" aria-labelledby="changelog-title">
      <header><div><span className="eyebrow">{label(settings, 'EVERY RELEASE', '每個版本')}</span><h2 id="changelog-title">{label(settings, 'Changelog', '更新記錄')}</h2></div><span className="status-pill">{label(settings, `${filtered.length} shown`, `顯示 ${filtered.length}`)}</span></header>
      <SearchBox surface="changelog" settings={settings} placeholder={label(settings, 'Search versions, changes, and commit SHAs', '搵版本、改動同 commit SHA')} openBuilder={openRegex} onBuilderHandled={onRegexHandled} />
      <details className="changelog-date-filter" open={Boolean(start || end || dateError)}>
        <summary>{label(settings, 'Advanced date range', '進階日期範圍')}</summary>
        <div className="date-range" aria-label={label(settings, 'Changelog date range', '更新記錄日期範圍')}>
          <label>{label(settings, 'Start date', '開始日期')}<input value={start} aria-invalid={Boolean(dateError && Number.isNaN(startTime))} placeholder={label(settings, 'YYYY-MM-DD or locale date', 'YYYY-MM-DD 或本地日期')} onChange={(event) => setStart(event.target.value)} /></label>
          <label className="calendar-field">{label(settings, 'Start calendar', '開始日曆')}<input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(start) ? start : ''} onChange={(event) => setStart(event.target.value)} /></label>
          <label>{label(settings, 'End date', '結束日期')}<input value={end} aria-invalid={Boolean(dateError && (Number.isNaN(endTime) || (startTime !== null && endTime !== null && startTime > endTime)))} placeholder={label(settings, 'YYYY-MM-DD or locale date', 'YYYY-MM-DD 或本地日期')} onChange={(event) => setEnd(event.target.value)} /></label>
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
            return <div key={value} role="gridcell" aria-selected={selected || inRange}><button type="button" className={day.getMonth() === Number(calendarMonth.slice(5, 7)) - 1 ? '' : 'outside-month'} aria-pressed={selected} aria-current={value === dateKey(new Date()) ? 'date' : undefined} aria-label={formatChangelogDate(settings, day)} onClick={() => chooseCalendarDay(day)}>{day.getDate()}</button></div>;
          })}
        </div>
        <div className="chip-row" role="group" aria-label={label(settings, 'Date presets', '日期預設')}><button onClick={() => setPreset(null)}>{label(settings, 'All releases', '全部版本')}</button><button onClick={() => setPreset(7)}>{label(settings, 'Latest 7 days', '最近七日')}</button><button onClick={() => setPreset(30)}>{label(settings, 'Latest 30 days', '最近三十日')}</button></div>
        {dateError && <p className="field-error" role="alert">{dateError} {label(settings, 'Your typed value was kept.', '你輸入嘅內容保留返。')}</p>}
      </details>
      {dataIssues.length > 0 && <div className="notice warning" role="alert"><Icon>error</Icon><div><strong>{label(settings, 'Changelog validation failed', '更新記錄驗證失敗')}</strong><ul>{dataIssues.map((issue, index) => {
        const localized = localizeChangelogIssue(settings, issue);
        return <li key={`${issue}-${index}`}>{localized.fact && <><code>{localized.fact}</code>{' '}</>}{localized.message}</li>;
      })}</ul></div></div>}
      <div className="bulk-toolbar" aria-label={label(settings, 'Changelog bulk actions', '更新記錄批量操作')}>
        <strong aria-live="polite">{label(settings, `${selectedEntries.length} selected · ${filtered.length} shown`, `揀咗 ${selectedEntries.length} · 顯示 ${filtered.length}`)}</strong>
        <button className="text-button" onClick={() => setSelected(new Set(filtered.map((entry) => entry.version)))} disabled={!filtered.length}>{label(settings, 'Select all shown', '揀晒目前顯示')}</button>
        <button className="text-button" onClick={() => setSelected((current) => new Set(filtered.filter((entry) => !current.has(entry.version)).map((entry) => entry.version)))} disabled={!filtered.length}>{label(settings, 'Invert shown', '反轉目前顯示')}</button>
        <button className="text-button" onClick={() => setSelected(new Set())} disabled={!selected.size}>{label(settings, 'Clear', '清除')}</button>
        <button className="text-button" onClick={() => void copy()} disabled={!exportEntries.length}><Icon>content_copy</Icon>{label(settings, 'Copy', '複製')}</button>
        <button className="text-button" onClick={exportMarkdown} disabled={!exportEntries.length}><Icon>download</Icon>{label(settings, 'Export Markdown', '匯出 Markdown')}</button>
        <button className="text-button" onClick={() => void openInCode()} disabled={!exportEntries.length || !isExternalEditorBridgeAvailable()} title={isExternalEditorBridgeAvailable() ? undefined : label(settings, 'Unavailable: this build has no reviewed Visual Studio Code adapter.', '未能使用：呢個版本冇已審核嘅 Visual Studio Code 適配器。')}><Icon>code</Icon>{isExternalEditorBridgeAvailable() ? label(settings, 'Open in VS Code', '喺 VS Code 開') : label(settings, 'VS Code unavailable', 'VS Code 未能使用')}</button>
      </div>
      {!dateError && !dataIssues.length && (filtered.length ? <ol className="changelog-list">{filtered.map((entry, index) => <li key={entry.version}>
        <label className="selection-check"><input type="checkbox" checked={selected.has(entry.version)} onClick={(event) => selectAt(index, event.currentTarget.checked, event.shiftKey)} onChange={() => undefined} /><span className="visually-hidden">{label(settings, 'Select release', '揀選版本')} {entry.version}</span></label>
        <div><h3>{highlight(search.state, entry.version)}</h3><time dateTime={entry.releasedAt}>{formatChangelogDate(settings, entry.releasedAt)}</time>{entry.changes.map((change) => <p key={change}>{highlight(search.state, change)}</p>)}<div className="commit-actions"><code>{entry.commit}</code><button className="text-button" disabled={!isCommitNavigationAvailable()} title={isCommitNavigationAvailable() ? undefined : label(settings, 'Unavailable: this build has no reviewed external-navigation adapter.', '未能使用：呢個版本冇已審核嘅外部導覽適配器。')} onClick={() => void openCommitLink(entry.commit)}><Icon>open_in_new</Icon>{isCommitNavigationAvailable() ? label(settings, 'Open commit', '開啟 commit') : label(settings, 'Open unavailable', '開啟未能使用')}</button><button className="text-button" onClick={() => void copyCommitLink(entry.commit)}><Icon>content_copy</Icon>{label(settings, 'Copy commit link', '複製 commit 連結')}</button></div></div>
      </li>)}</ol> : <div className="empty-state"><Icon>search_off</Icon><h3>{label(settings, 'No matching releases', '冇符合嘅版本')}</h3><p>{label(settings, 'Clear the search or date range to see more changelog entries.', '清除搜尋或者日期範圍，就會見到更多更新記錄。')}</p></div>)}
    </section>
  );
}
