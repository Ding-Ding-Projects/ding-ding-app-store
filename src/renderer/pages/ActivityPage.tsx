import { useMemo, useState } from 'react';
import type { HistoryEntry, HistoryExportFormat, OperationKind, UserSettings } from '../../shared/contracts';
import { SearchBox } from '../components/SearchBox';
import { el } from '../el';
import { downloadText } from '../files';
import { Icon } from '../icons';
import { label } from '../i18n';
import { highlight, makeMatcher, useSurfaceSearch } from '../search';

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

export function ActivityPage({ entries, loading, settings, openRegex, onRegexHandled }: {
  entries: HistoryEntry[]; loading: boolean; settings: UserSettings; openRegex: boolean; onRegexHandled(): void;
}) {
  const search = useSurfaceSearch('activity');
  const [kind, setKind] = useState<'all' | OperationKind>('all');
  const [result, setResult] = useState<HistoryResult>('all');
  const [preset, setPreset] = useState<HistoryPreset>('all');
  const [exportBusy, setExportBusy] = useState<HistoryExportFormat | null>(null);
  const [copyBusy, setCopyBusy] = useState(false);
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);

  const filtered = useMemo(() => {
    let source = entries;
    if (kind !== 'all') source = source.filter((entry) => entry.kind === kind);
    if (result !== 'all') source = source.filter((entry) => (result === 'ok' ? entry.ok : !entry.ok));
    source = source.filter((entry) => withinPreset(entry.occurredAt, preset));
    return source.filter((entry) => matcher(`${entry.displayName}\n${entry.kind}\n${entry.message}`));
  }, [entries, kind, result, preset, matcher]);

  const runExport = async (format: HistoryExportFormat) => {
    setExportBusy(format);
    try {
      const content = await window.dingDingStore.history.export(format);
      const extension = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'md';
      const mime = format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/markdown';
      downloadText(`ding-ding-app-store-history.${extension}`, content, mime);
    } finally {
      setExportBusy(null);
    }
  };

  const copyJson = async () => {
    setCopyBusy(true);
    try {
      await navigator.clipboard.writeText(await window.dingDingStore.history.export('json'));
    } finally {
      setCopyBusy(false);
    }
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
        <button className="text-button" disabled={exportBusy === 'csv'} onClick={() => void runExport('csv')}><Icon>download</Icon>CSV</button>
        <button className="text-button" disabled={exportBusy === 'markdown'} onClick={() => void runExport('markdown')}><Icon>download</Icon>Markdown</button>
      </div>
      {filtered.length ? <ul className="history-list">{filtered.map((entry) => <li key={entry.id} className={entry.ok ? 'history-row ok' : 'history-row failed'} {...el('history-row')}>
        <Icon>{entry.ok ? 'check_circle' : 'error'}</Icon>
        <div className="history-copy">
          <div className="history-heading"><strong>{highlight(search.state, entry.displayName)}</strong><span className="status-pill" {...el('status-pill')}>{entry.kind}</span><time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString()}</time></div>
          <p>{highlight(search.state, entry.message)}</p>
        </div>
      </li>)}</ul> : <div className="empty-state" {...el('empty-state')}><Icon>search_off</Icon><h2>No matching activity</h2><p>{label(settings, 'Clear the search, action, result, or date filters to see more history.', '清除搜尋、動作、結果或者日期篩選就會見到更多記錄。')}</p></div>}
    </section>
  </>;
}
