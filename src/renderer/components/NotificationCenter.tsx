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

function notificationFilterLabel(settings: UserSettings, value: NotificationFilter): string {
  const copy: Record<NotificationFilter, [string, string]> = {
    all: ['All', '全部'],
    unread: ['Unread', '未讀'],
    dismissed: ['Dismissed', '已清除'],
    errors: ['Errors', '錯誤'],
  };
  const [en, yue] = copy[value];
  return label(settings, en, yue);
}

export function exportNotificationRecords(records: readonly NotificationRecord[]): string {
  // Exports are an explicit allowlist. This makes a callback, accidental
  // renderer property, or any future private runtime field impossible to leak.
  const notifications = records.map((record) => ({
    id: record.id,
    title: record.title,
    message: record.message,
    ok: record.ok,
    category: record.category,
    operationId: record.operationId,
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
  const [copyBusy, setCopyBusy] = useState(false);
  const [recoveryDetailsOpen, setRecoveryDetailsOpen] = useState(false);
  const lastSelected = useRef<number | null>(null);
  const shown = useMemo(() => records.filter((record) => {
    if (filter === 'unread' && record.dismissedAt !== null) return false;
    if (filter === 'dismissed' && record.dismissedAt === null) return false;
    if (filter === 'errors' && record.ok) return false;
    return matcher(`${record.title}\n${record.message}\n${record.operationId ?? ''}\n${record.ok ? 'success' : 'error'}`);
  }), [records, filter, matcher]);
  const selectedShown = shown.filter((record) => selected.has(record.id));
  const scopedOperationIds = (selectedShown.length ? selectedShown : shown).flatMap((record) => record.operationId ? [record.operationId] : []);
  const operationIdClipboard = scopedOperationIds.join('\n');
  const selectedRecovery = selectedShown.filter((record) => record.recovery);
  const recoveryKinds = Array.from(new Set(selectedRecovery.map((record) => record.recovery?.kind).filter((kind): kind is NonNullable<NotificationRecord['recovery']>['kind'] => Boolean(kind))));

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
  const selectionLabel = label(settings, `${selectedShown.length} selected · ${shown.length} shown · ${records.length} total`, `揀選 ${selectedShown.length} · 顯示 ${shown.length} · 總數 ${records.length}`);
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
        <header><div><span className="eyebrow">{label(settings, 'HISTORY', '歷史')}</span><h2 id="notification-centre-title">{dialogCopy(settings, label(settings, 'Notification centre', '通知中心'), '🔔')}</h2></div><button className="icon-button" onClick={onClose} aria-label={label(settings, 'Close notification centre', '關閉通知中心')}><Icon>close</Icon></button></header>
        <SearchBox surface="notifications" settings={settings} placeholder={label(settings, 'Search notification titles and messages', '搵通知標題同內容')} openBuilder={openRegex} onBuilderHandled={onRegexHandled} />
        {!persistenceAvailable && <div className="notice warning" role="alert"><Icon>error</Icon>{label(settings, 'Notification history could not be saved in this profile. Current snackbars still work, but retained history may be lost after restart.', '呢個設定檔未能儲存通知歷史。即時提示仍然運作，但重開後可能搵唔返保留嘅記錄。')}</div>}
        <div className="chip-row" role="group" aria-label={label(settings, 'Filter notifications', '篩選通知')}>{(['all', 'unread', 'dismissed', 'errors'] as const).map((value) => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{notificationFilterLabel(settings, value)}</button>)}</div>
        <div className="bulk-toolbar" aria-label={label(settings, 'Notification bulk actions', '通知批量操作')}>
          <strong aria-live="polite">{selectionLabel}</strong>
          <button className="text-button" onClick={() => setSelected(new Set(shown.map((record) => record.id)))} disabled={!shown.length}>{label(settings, 'Select all shown', '揀選全部顯示項目')}</button>
          <button className="text-button" onClick={() => setSelected((current) => new Set(shown.filter((record) => !current.has(record.id)).map((record) => record.id)))} disabled={!shown.length}>{label(settings, 'Invert shown', '反轉顯示項目')}</button>
          <button className="text-button" onClick={() => setSelected(new Set())} disabled={!selected.size}>{label(settings, 'Clear', '清除')}</button>
          <button className="text-button" onClick={() => { setCopyBusy(true); void navigator.clipboard.writeText(operationIdClipboard).then(() => notify({ ok: true, message: label(settings, `Copied ${scopedOperationIds.length} operation IDs.`, `已複製 ${scopedOperationIds.length} 個操作 ID。`) })).catch((error) => notify({ ok: false, message: (error as Error).message || label(settings, 'The operation IDs could not be copied.', '未能複製操作 ID。') })).finally(() => setCopyBusy(false)); }} disabled={!scopedOperationIds.length || copyBusy}>{label(settings, 'Copy operation IDs', '複製操作 ID')}</button>
          <button className="text-button" onClick={() => { onDismissMany(activeIds); setSelected(new Set()); }} disabled={!activeIds.length}>{label(settings, 'Dismiss selected', '清除已揀選')}</button>
          <button className="text-button" onClick={() => setRecoveryDetailsOpen(true)} disabled={!selectedShown.length}>{label(settings, 'Recovery details', '復原詳情')}</button>
          <button ref={deleteButtonRef} className="text-button danger" onClick={() => setConfirmDelete(true)} disabled={!activeIds.length}>{label(settings, 'Delete selected', '刪除已揀選')}</button>
          <button className="text-button" onClick={() => { downloadText('ding-ding-app-store-notifications.json', exportNotificationRecords(selectedShown.length ? selectedShown : shown), 'application/json'); notify({ ok: true, message: label(settings, `Exported ${selectedShown.length || shown.length} notification records.`, `已匯出 ${selectedShown.length || shown.length} 條通知記錄。`) }); }} disabled={!shown.length}><Icon>download</Icon>{label(settings, 'Export shown', '匯出顯示項目')}</button>
          <button className="text-button" onClick={() => void openExportInVsCode({ recordKind: 'notifications', suggestedName: 'ding-ding-app-store-notifications.json', mime: 'application/json', content: exportNotificationRecords(selectedShown.length ? selectedShown : shown) }).then((result) => notify({ ok: result.ok, message: result.ok ? label(settings, `Opened ${selectedShown.length || shown.length} notification records in Visual Studio Code.`, `已喺 Visual Studio Code 開啟 ${selectedShown.length || shown.length} 條通知記錄。`) : result.message }))} disabled={!shown.length || !isExternalEditorBridgeAvailable()} title={isExternalEditorBridgeAvailable() ? undefined : label(settings, 'Unavailable: this build has no reviewed Visual Studio Code adapter.', '未能使用：呢個版本冇已審核嘅 Visual Studio Code 適配器。')}><Icon>code</Icon>{isExternalEditorBridgeAvailable() ? label(settings, 'Open in VS Code', '喺 VS Code 開啟') : label(settings, 'VS Code unavailable', 'VS Code 未能使用')}</button>
        </div>
        {recoveryDetailsOpen && <section className="notification-recovery-details" role="status" aria-labelledby="notification-recovery-details-title">
          <header><h3 id="notification-recovery-details-title">{label(settings, 'Recovery details', '復原詳情')}</h3><button className="text-button" onClick={() => setRecoveryDetailsOpen(false)}>{label(settings, 'Close', '關閉')}</button></header>
          {selectedRecovery.length ? <>
            <p>{label(settings, `${selectedRecovery.length} selected notification${selectedRecovery.length === 1 ? '' : 's'} record a typed recovery kind:`, `揀選咗 ${selectedRecovery.length} 條通知，記錄咗有型別嘅復原種類：`)}</p>
            <ul>{recoveryKinds.map((kind) => <li key={kind}>{recoveryActionLabel(settings, kind)}</li>)}</ul>
            <p className="supporting">{label(settings, 'Retained history stores the recovery kind only. It has no callback or operation ID, so this panel will not invent a bulk retry after restart. Reopen the originating surface to run a newly validated action.', '保留歷史淨係儲存復原種類，冇 callback 或 operation ID，所以呢個面板唔會喺重開後亂整批量重試。請返去原本頁面，先可以執行新驗證過嘅操作。')}</p>
          </> : <p>{label(settings, 'The selected notifications have no safe recovery action.', '揀選嘅通知冇安全嘅復原操作。')}</p>}
        </section>}
        {shown.length ? <ul className="notification-list">{shown.map((record, index) => (
          <li key={record.id} className={record.dismissedAt ? 'dismissed' : ''}>
            <label className="selection-check"><input type="checkbox" checked={selected.has(record.id)} onClick={(event) => selectAt(index, event.currentTarget.checked, event.shiftKey)} onChange={() => undefined} /><span className="visually-hidden">{label(settings, `Select ${record.title}`, `揀選 ${record.title}`)}</span></label>
            <Icon>{record.ok ? 'check_circle' : 'error'}</Icon>
            <div><strong>{record.title}</strong><p>{record.message}</p><small><time dateTime={record.createdAt}>{new Date(record.createdAt).toLocaleString()}</time>{record.dismissedAt ? label(settings, ' · Dismissed', ' · 已清除') : label(settings, ' · Unread', ' · 未讀')}</small>{record.operationId && <small className="notification-recovery-history">{label(settings, `Operation ID: ${record.operationId}`, `操作 ID：${record.operationId}`)}</small>}{record.recovery ? <small className="notification-recovery-history">{label(settings, `Recovery offered: ${recoveryActionLabel(settings, record.recovery.kind)}. Retained history cannot rerun it after restart.`, `曾經提供復原：${recoveryActionLabel(settings, record.recovery.kind)}。保留記錄喺重開後唔可以再執行。`)}</small> : !record.ok && <small className="notification-recovery-history">{label(settings, 'No safe recovery action is available for this failure.', '呢個失敗冇安全嘅復原操作。')}</small>}</div>
            {!record.dismissedAt && <button className="icon-button" onClick={() => onDismissMany([record.id])} aria-label={label(settings, `Dismiss ${record.title}`, `清除 ${record.title}`)}><Icon>close</Icon></button>}
          </li>
        ))}</ul> : <div className="empty-state"><Icon>notifications_off</Icon><h3>{label(settings, 'No matching notifications', '冇符合嘅通知')}</h3><p>{label(settings, 'Clear the search or status filter to see more history.', '清除搜尋或狀態篩選，就可以睇到更多歷史。')}</p></div>}
      </aside>
      {confirmDelete && <DestructiveConfirmDialog settings={settings} title={label(settings, `Delete ${activeIds.length} notification records?`, `刪除 ${activeIds.length} 條通知記錄？`)} description={label(settings, 'This permanently removes the selected notification history from this app profile. Export it first if you may need it later.', '呢個操作會永久刪除呢個設定檔入面揀選嘅通知歷史。如果遲啲可能要用，請先匯出。')} actionLabel={label(settings, `DELETE ${activeIds.length} RECORDS`, `刪除 ${activeIds.length} 條記錄`)} onClose={closeDelete} onConfirm={() => { onDeleteMany(activeIds); setSelected(new Set()); notify({ ok: true, message: label(settings, `Deleted ${activeIds.length} notification records.`, `已刪除 ${activeIds.length} 條通知記錄。`) }); }} />}
    </>
  );
}
