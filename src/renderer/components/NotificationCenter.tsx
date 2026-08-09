import { useEffect, useMemo, useRef, useState } from 'react';
import type { NotificationRecord, Notify } from '../notify';
import type { UserSettings } from '../../shared/contracts';
import { downloadText } from '../files';
import { Icon } from '../icons';
import { label } from '../i18n';
import { makeMatcher, useSurfaceSearch } from '../search';
import { SearchBox } from './SearchBox';
import { DestructiveConfirmDialog } from './DestructiveConfirmDialog';
import { openExportInVsCode } from '../external-editor';
import { isExternalEditorBridgeAvailable } from '../external-editor';
import { recoveryActionLabel } from './SnackbarStack';
import { serializeStructuredExport } from '../../shared/export-registry';
import { dialogCopy } from '../dialog-emoji';

type NotificationFilter = 'all' | 'unread' | 'dismissed' | 'errors';

export function exportNotificationRecords(records: readonly NotificationRecord[]): string {
  // Exports are an explicit allowlist. This makes a callback, accidental
  // renderer property, or any future private runtime field impossible to leak.
  const notifications = records.map((record) => ({
    id: record.id,
    title: record.title,
    message: record.message,
    ok: record.ok,
    category: record.category,
    createdAt: record.createdAt,
    dismissedAt: record.dismissedAt,
    recovery: record.recovery ? { kind: record.recovery.kind } : undefined,
  }));
  return serializeStructuredExport({ kind: 'ding-ding-app-store.notifications', schemaVersion: 1, exportedAt: new Date().toISOString(), notifications });
}

export function NotificationCenter({ records, settings, persistenceAvailable, onDismissMany, onDeleteMany, notify, onClose, openRegex, onRegexHandled }: {
  records: NotificationRecord[];
  settings: UserSettings;
  persistenceAvailable: boolean;
  onDismissMany(ids: readonly string[]): void;
  onDeleteMany(ids: readonly string[]): void;
  notify: Notify;
  onClose(): void;
  openRegex: boolean;
  onRegexHandled(): void;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const search = useSurfaceSearch('notifications');
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const lastSelected = useRef<number | null>(null);
  const shown = useMemo(() => records.filter((record) => {
    if (filter === 'unread' && record.dismissedAt !== null) return false;
    if (filter === 'dismissed' && record.dismissedAt === null) return false;
    if (filter === 'errors' && record.ok) return false;
    return matcher(`${record.title}\n${record.message}\n${record.ok ? 'success' : 'error'}`);
  }), [records, filter, matcher]);
  const selectedShown = shown.filter((record) => selected.has(record.id));

  useEffect(() => { panelRef.current?.focus(); }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !confirmDelete) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmDelete, onClose]);

  useEffect(() => {
    const ids = new Set(records.map((record) => record.id));
    setSelected((current) => new Set([...current].filter((id) => ids.has(id))));
  }, [records]);

  const activeIds = selectedShown.map((record) => record.id);
  const closeDelete = () => {
    setConfirmDelete(false);
    window.setTimeout(() => {
      if (deleteButtonRef.current && !deleteButtonRef.current.disabled) deleteButtonRef.current.focus();
      else panelRef.current?.focus();
    }, 0);
  };
  const selectionLabel = `${selectedShown.length} selected · ${shown.length} shown · ${records.length} total`;
  const selectAt = (index: number, checked: boolean, shiftKey: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      const start = shiftKey && lastSelected.current !== null ? Math.min(lastSelected.current, index) : index;
      const end = shiftKey && lastSelected.current !== null ? Math.max(lastSelected.current, index) : index;
      for (let cursor = start; cursor <= end; cursor += 1) {
        const id = shown[cursor]?.id;
        if (!id) continue;
        if (checked) next.add(id); else next.delete(id);
      }
      return next;
    });
    lastSelected.current = index;
  };
  return (
    <>
      <aside ref={panelRef} className="notification-center" role="dialog" aria-modal="false" aria-labelledby="notification-centre-title" tabIndex={-1}>
        <header><div><span className="eyebrow">HISTORY</span><h2 id="notification-centre-title">{dialogCopy(settings, label(settings, 'Notification centre', '通知中心'), '🔔')}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close notification centre"><Icon>close</Icon></button></header>
        <SearchBox surface="notifications" settings={settings} placeholder={label(settings, 'Search notification titles and messages', '搵通知標題同內容')} openBuilder={openRegex} onBuilderHandled={onRegexHandled} />
        {!persistenceAvailable && <div className="notice warning" role="alert"><Icon>error</Icon>Notification history could not be saved in this profile. Current snackbars still work, but retained history may be lost after restart.</div>}
        <div className="chip-row" role="group" aria-label="Filter notifications">{(['all', 'unread', 'dismissed', 'errors'] as const).map((value) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div>
        <div className="bulk-toolbar" aria-label="Notification bulk actions">
          <strong aria-live="polite">{selectionLabel}</strong>
          <button className="text-button" onClick={() => setSelected(new Set(shown.map((record) => record.id)))} disabled={!shown.length}>Select all shown</button>
          <button className="text-button" onClick={() => setSelected((current) => new Set(shown.filter((record) => !current.has(record.id)).map((record) => record.id)))} disabled={!shown.length}>Invert shown</button>
          <button className="text-button" onClick={() => setSelected(new Set())} disabled={!selected.size}>Clear</button>
          <button className="text-button" onClick={() => { onDismissMany(activeIds); setSelected(new Set()); }} disabled={!activeIds.length}>Dismiss selected</button>
          <button ref={deleteButtonRef} className="text-button danger" onClick={() => setConfirmDelete(true)} disabled={!activeIds.length}>Delete selected</button>
          <button className="text-button" onClick={() => { downloadText('ding-ding-app-store-notifications.json', exportNotificationRecords(selectedShown.length ? selectedShown : shown), 'application/json'); notify({ ok: true, message: `Exported ${selectedShown.length || shown.length} notification records.` }); }} disabled={!shown.length}><Icon>download</Icon>Export shown</button>
          <button className="text-button" onClick={() => void openExportInVsCode({ recordKind: 'notifications', suggestedName: 'ding-ding-app-store-notifications.json', mime: 'application/json', content: exportNotificationRecords(selectedShown.length ? selectedShown : shown) }).then((result) => notify({ ok: result.ok, message: result.ok ? `Opened ${selectedShown.length || shown.length} notification records in Visual Studio Code.` : result.message }))} disabled={!shown.length || !isExternalEditorBridgeAvailable()} title={isExternalEditorBridgeAvailable() ? undefined : 'Unavailable: this build has no reviewed Visual Studio Code adapter.'}><Icon>code</Icon>{isExternalEditorBridgeAvailable() ? 'Open in VS Code' : 'VS Code unavailable'}</button>
        </div>
        {shown.length ? <ul className="notification-list">{shown.map((record, index) => (
          <li key={record.id} className={record.dismissedAt ? 'dismissed' : ''}>
            <label className="selection-check"><input type="checkbox" checked={selected.has(record.id)} onClick={(event) => selectAt(index, event.currentTarget.checked, event.shiftKey)} onChange={() => undefined} /><span className="visually-hidden">Select {record.title}</span></label>
            <Icon>{record.ok ? 'check_circle' : 'error'}</Icon>
            <div><strong>{record.title}</strong><p>{record.message}</p><small><time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString()}</time>{record.dismissedAt ? ' · Dismissed' : ' · Unread'}</small>{record.recovery ? <small className="notification-recovery-history">{label(settings, `Recovery offered: ${recoveryActionLabel(settings, record.recovery.kind)}. Retained history cannot rerun it after restart.`, `曾經提供復原：${recoveryActionLabel(settings, record.recovery.kind)}。保留記錄喺重開後唔可以再執行。`)}</small> : !record.ok && <small className="notification-recovery-history">{label(settings, 'No safe recovery action is available for this failure.', '呢個失敗冇安全嘅復原操作。')}</small>}</div>
            {!record.dismissedAt && <button className="icon-button" onClick={() => onDismissMany([record.id])} aria-label={`Dismiss ${record.title}`}><Icon>close</Icon></button>}
          </li>
        ))}</ul> : <div className="empty-state"><Icon>notifications_off</Icon><h3>No matching notifications</h3><p>Clear the search or status filter to see more history.</p></div>}
      </aside>
      {confirmDelete && <DestructiveConfirmDialog settings={settings} title={`Delete ${activeIds.length} notification records?`} description="This permanently removes the selected notification history from this app profile. Export it first if you may need it later." actionLabel={`DELETE ${activeIds.length} RECORDS`} onClose={closeDelete} onConfirm={() => { onDeleteMany(activeIds); setSelected(new Set()); notify({ ok: true, message: `Deleted ${activeIds.length} notification records.` }); }} />}
    </>
  );
}
