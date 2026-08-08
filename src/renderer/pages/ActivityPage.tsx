import { useEffect, useMemo, useRef, useState } from 'react';
import type { HistoryEntry, HistoryExportFormat, OperationKind, UserSettings } from '../../shared/contracts';
import { SearchBox } from '../components/SearchBox';
import { el } from '../el';
import { downloadText } from '../files';
import { Icon } from '../icons';
import { label } from '../i18n';
import { highlight, makeMatcher, useSurfaceSearch } from '../search';
import { exportHistoryEntries } from '../history-export';
import { isExternalEditorBridgeAvailable, openExportInVsCode } from '../external-editor';
import type { Notify } from '../notify';

type HistoryPreset = 'all' | 'today' | '7d' | '30d';
type HistoryResult = 'all' | 'ok' | 'failed';

const historyPresetSpans: Record<Exclude<HistoryPreset, 'all'>, number> = {
  today: 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

function withinPreset(occurredAt: string, preset: HistoryPreset): boolean {
  if (preset === 'all') return true;
  return Date.now() - new Date(occurredAt).getTime() <= historyPresetSpans[preset];
}

export function ActivityPage({ entries, loading, settings, openRegex, onRegexHandled, notify }: {
  entries: HistoryEntry[]; loading: boolean; settings: UserSettings; openRegex: boolean; onRegexHandled(): void; notify: Notify;
}) {
  const search = useSurfaceSearch('activity');
  const [kind, setKind] = useState<'all' | OperationKind>('all');
  const [result, setResult] = useState<HistoryResult>('all');
  const [preset, setPreset] = useState<HistoryPreset>('all');
  const [exportBusy, setExportBusy] = useState<HistoryExportFormat | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const lastSelected = useRef<number | null>(null);
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);

  const filtered = useMemo(() => {
    let source = entries;
    if (kind !== 'all') source = source.filter((entry) => entry.kind === kind);
    if (result !== 'all') source = source.filter((entry) => (result === 'ok' ? entry.ok : !entry.ok));
    source = source.filter((entry) => withinPreset(entry.occurredAt, preset));
    return source.filter((entry) => matcher(`${entry.displayName}\n${entry.kind}\n${entry.message}`));
  }, [entries, kind, result, preset, matcher]);
  useEffect(() => {
    const ids = new Set(entries.map((entry) => entry.id));
    setSelected((current) => new Set([...current].filter((id) => ids.has(id))));
  }, [entries]);
  const selectedEntries = filtered.filter((entry) => selected.has(entry.id));
  const exportEntries = selectedEntries.length ? selectedEntries : filtered;

  const runExport = async (format: HistoryExportFormat) => {
    setExportBusy(format);
    try {
      const content = exportHistoryEntries(exportEntries, format);
      const extension = format === 'json' ? 'json' : format === 'jsonl' ? 'jsonl' : format === 'csv' ? 'csv' : 'md';
      const mime = format === 'json' ? 'application/json' : format === 'jsonl' ? 'application/x-ndjson' : format === 'csv' ? 'text/csv' : 'text/markdown';
      downloadText(`ding-ding-app-store-history.${extension}`, content, mime);
      notify({ ok: true, message: `Exported ${exportEntries.length} filtered activity records as ${format.toUpperCase()}.` });
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
    const result = await openExportInVsCode({ recordKind: 'activity', suggestedName: 'ding-ding-app-store-history.json', mime: 'application/json', content: exportHistoryEntries(exportEntries, 'json') });
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

  if (loading) return <div className="loading-grid" aria-label="Loading activity"><div className="skeleton" /><div className="skeleton" /></div>;
  if (!entries.length) {
    return <div className="empty-state" {...el('empty-state')}><Icon>history</Icon><h2>No operations yet · 仲未有操作</h2><p>Installs, builds, updates, uninstalls, failures, and recoveries will appear here with exact results and export controls.</p></div>;
  }

  return <>
    <SearchBox surface="activity" placeholder="Search activity by app, action, or message" openBuilder={openRegex} onBuilderHandled={onRegexHandled} />
    <section className="history-panel">
      <div className="chip-row" role="group" aria-label="Filter by action">{(['all', 'install', 'build', 'uninstall'] as const).map((value) => <button key={value} aria-pressed={kind === value} onClick={() => setKind(value)}>{value === 'all' ? 'All actions' : value}</button>)}</div>
      <div className="chip-row" role="group" aria-label="Filter by result">{(['all', 'ok', 'failed'] as const).map((value) => <button key={value} aria-pressed={result === value} onClick={() => setResult(value)}>{value === 'all' ? 'Any result' : value === 'ok' ? 'Succeeded' : 'Failed'}</button>)}</div>
      <div className="chip-row" role="group" aria-label="Filter by date">{(['all', 'today', '7d', '30d'] as const).map((value) => <button key={value} aria-pressed={preset === value} onClick={() => setPreset(value)}>{value === 'all' ? 'All time' : value === 'today' ? 'Today' : value === '7d' ? '7 days' : '30 days'}</button>)}</div>
      <div className="card-actions">
        <button className="text-button" disabled={copyBusy} onClick={() => void copyJson()}><Icon>content_copy</Icon>{copyBusy ? 'Copying…' : 'Copy JSON'}</button>
        <button className="text-button" disabled={exportBusy === 'json'} onClick={() => void runExport('json')}><Icon>download</Icon>JSON</button>
        <button className="text-button" disabled={exportBusy === 'jsonl'} onClick={() => void runExport('jsonl')}><Icon>download</Icon>JSONL</button>
        <button className="text-button" disabled={exportBusy === 'csv'} onClick={() => void runExport('csv')}><Icon>download</Icon>CSV</button>
        <button className="text-button" disabled={exportBusy === 'markdown'} onClick={() => void runExport('markdown')}><Icon>download</Icon>Markdown</button>
        <button className="text-button" disabled={!exportEntries.length || !isExternalEditorBridgeAvailable()} title={isExternalEditorBridgeAvailable() ? undefined : 'Unavailable: this build has no reviewed Visual Studio Code adapter.'} onClick={() => void openInCode()}><Icon>code</Icon>{isExternalEditorBridgeAvailable() ? 'Open in VS Code' : 'VS Code unavailable'}</button>
      </div>
      <div className="bulk-toolbar" aria-label="Activity bulk actions"><strong aria-live="polite">{selectedEntries.length} selected · {filtered.length} shown · {entries.length} total</strong><button className="text-button" disabled={!filtered.length} onClick={() => setSelected(new Set(filtered.map((entry) => entry.id)))}>Select all shown</button><button className="text-button" disabled={!filtered.length} onClick={() => setSelected((current) => new Set(filtered.filter((entry) => !current.has(entry.id)).map((entry) => entry.id)))}>Invert shown</button><button className="text-button" disabled={!selected.size} onClick={() => setSelected(new Set())}>Clear</button><button className="text-button" disabled title="Operation history is append-only and cannot be deleted.">Delete unavailable</button></div>
      {filtered.length ? <ul className="history-list">{filtered.map((entry, index) => <li key={entry.id} className={entry.ok ? 'history-row ok' : 'history-row failed'} {...el('history-row')}>
        <label className="selection-check"><input type="checkbox" checked={selected.has(entry.id)} onClick={(event) => selectAt(index, event.currentTarget.checked, event.shiftKey)} onChange={() => undefined} /><span className="visually-hidden">Select {entry.displayName} {entry.kind}</span></label>
        <Icon>{entry.ok ? 'check_circle' : 'error'}</Icon>
        <div className="history-copy">
          <div className="history-heading"><strong>{highlight(search.state, entry.displayName)}</strong><span className="status-pill" {...el('status-pill')}>{entry.kind}</span><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString()}</time></div>
          <p>{highlight(search.state, entry.message)}</p>
        </div>
      </li>)}</ul> : <div className="empty-state" {...el('empty-state')}><Icon>search_off</Icon><h2>No matching activity</h2><p>{label(settings, 'Clear the search, action, result, or date filters to see more history.', '清除搜尋、動作、結果或者日期篩選就會見到更多記錄。')}</p></div>}
    </section>
  </>;
}
