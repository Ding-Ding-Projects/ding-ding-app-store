import { useMemo, useState } from 'react';
import type { UserSettings } from '../../shared/contracts';
import { CHANGELOG_ENTRIES, changelogMarkdown, validateChangelog } from '../changelog';
import { SearchBox } from '../components/SearchBox';
import { downloadText } from '../files';
import { Icon } from '../icons';
import { label } from '../i18n';
import type { Notify } from '../notify';
import { highlight, makeMatcher, useSurfaceSearch } from '../search';
import { openExportInVsCode } from '../external-editor';

function parseDate(value: string, endOfDay = false): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}` : trimmed;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function ChangelogViewer({ settings, notify }: { settings: UserSettings; notify: Notify }) {
  const search = useSurfaceSearch('changelog');
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const startTime = parseDate(start);
  const endTime = parseDate(end, true);
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
  };

  const copy = async () => {
    await navigator.clipboard.writeText(changelogMarkdown(exportEntries));
    notify({ ok: true, message: `Copied ${exportEntries.length} changelog entries.` });
  };

  return (
    <section className="changelog-viewer" aria-labelledby="changelog-title">
      <header><div><span className="eyebrow">EVERY RELEASE</span><h2 id="changelog-title">{label(settings, 'Changelog', '更新記錄')}</h2></div><span className="status-pill">{filtered.length} shown</span></header>
      <SearchBox surface="changelog" placeholder={label(settings, 'Search versions, changes, and commit SHAs', '搵版本、改動同 commit SHA')} />
      <div className="date-range" aria-label="Changelog date range">
        <label>Start date<input value={start} placeholder="YYYY-MM-DD or locale date" onChange={(event) => setStart(event.target.value)} /></label>
        <label className="calendar-field">Start calendar<input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(start) ? start : ''} onChange={(event) => setStart(event.target.value)} /></label>
        <label>End date<input value={end} placeholder="YYYY-MM-DD or locale date" onChange={(event) => setEnd(event.target.value)} /></label>
        <label className="calendar-field">End calendar<input type="date" value={/^\d{4}-\d{2}-\d{2}$/.test(end) ? end : ''} onChange={(event) => setEnd(event.target.value)} /></label>
      </div>
      <div className="chip-row" role="group" aria-label="Date presets"><button onClick={() => setPreset(null)}>All releases</button><button onClick={() => setPreset(7)}>Latest 7 days</button><button onClick={() => setPreset(30)}>Latest 30 days</button></div>
      {dateError && <p className="field-error" role="alert">{dateError} Your typed value was kept.</p>}
      {dataIssues.length > 0 && <div className="notice warning" role="alert"><Icon>error</Icon><div><strong>Changelog validation failed</strong><p>{dataIssues.join(' ')}</p></div></div>}
      <div className="bulk-toolbar" aria-label="Changelog bulk actions">
        <strong aria-live="polite">{selectedEntries.length} selected · {filtered.length} shown</strong>
        <button className="text-button" onClick={() => setSelected(new Set(filtered.map((entry) => entry.version)))} disabled={!filtered.length}>Select all shown</button>
        <button className="text-button" onClick={() => setSelected((current) => new Set(filtered.filter((entry) => !current.has(entry.version)).map((entry) => entry.version)))} disabled={!filtered.length}>Invert shown</button>
        <button className="text-button" onClick={() => setSelected(new Set())} disabled={!selected.size}>Clear</button>
        <button className="text-button" onClick={() => void copy()} disabled={!exportEntries.length}><Icon>content_copy</Icon>Copy</button>
        <button className="text-button" onClick={() => { downloadText('ding-ding-app-store-changelog.md', changelogMarkdown(exportEntries), 'text/markdown'); notify({ ok: true, message: `Exported ${exportEntries.length} changelog entries.` }); }} disabled={!exportEntries.length}><Icon>download</Icon>Export Markdown</button>
        <button className="text-button" onClick={() => void openExportInVsCode({ recordKind: 'changelog', suggestedName: 'ding-ding-app-store-changelog.md', mime: 'text/markdown', content: changelogMarkdown(exportEntries) }).then((result) => notify({ ok: result.ok, message: result.ok ? `Opened ${exportEntries.length} changelog entries in Visual Studio Code.` : result.message }))} disabled={!exportEntries.length}><Icon>code</Icon>Open in VS Code</button>
      </div>
      {!dateError && !dataIssues.length && (filtered.length ? <ol className="changelog-list">{filtered.map((entry) => <li key={entry.version}>
        <label className="selection-check"><input type="checkbox" checked={selected.has(entry.version)} onChange={() => setSelected((current) => { const next = new Set(current); if (next.has(entry.version)) next.delete(entry.version); else next.add(entry.version); return next; })} /><span className="visually-hidden">Select {entry.version}</span></label>
        <div><h3>{highlight(search.state, entry.version)}</h3><time dateTime={entry.releasedAt}>{new Date(entry.releasedAt).toLocaleDateString()}</time>{entry.changes.map((change) => <p key={change}>{highlight(search.state, change)}</p>)}<a href={`https://github.com/Ding-Ding-Projects/ding-ding-app-store/commit/${entry.commit}`} target="_blank" rel="noreferrer" aria-label={`Open commit ${entry.commit}`}>{entry.commit.slice(0, 12)} <Icon>open_in_new</Icon></a></div>
      </li>)}</ol> : <div className="empty-state"><Icon>search_off</Icon><h3>No matching releases</h3><p>Clear the search or date range to see more changelog entries.</p></div>)}
    </section>
  );
}
