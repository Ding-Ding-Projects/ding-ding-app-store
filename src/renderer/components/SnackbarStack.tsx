import { useEffect } from 'react';
import type { ActiveNotice } from '../notify';
import { el } from '../el';
import { Icon } from '../icons';

function Snackbar({ notice, onDismiss }: { notice: ActiveNotice; onDismiss(id: string): void }) {
  useEffect(() => {
    if (!notice.ok) return;
    const timer = window.setTimeout(() => onDismiss(notice.id), 5_000);
    return () => window.clearTimeout(timer);
  }, [notice.id, notice.ok, onDismiss]);
  return (
    <div className={`snackbar ${notice.ok ? 'success' : 'error'}`} role={notice.ok ? 'status' : 'alert'} {...el('snackbar')}>
      <Icon>{notice.ok ? 'check_circle' : 'error'}</Icon>
      <span><strong>{notice.title}</strong><small>{notice.message}</small></span>
      {notice.undo && <button className="text-button" onClick={() => { notice.undo?.run(); onDismiss(notice.id); }}>{notice.undo.label}</button>}
      <button className="icon-button" {...el('icon-button')} onClick={() => onDismiss(notice.id)} aria-label="Dismiss notification"><Icon>close</Icon></button>
    </div>
  );
}

export function SnackbarStack({ notices, onDismiss }: { notices: ActiveNotice[]; onDismiss(id: string): void }) {
  return <div className="snackbar-stack" aria-label="Notifications">{notices.map((notice) => <Snackbar key={notice.id} notice={notice} onDismiss={onDismiss} />)}</div>;
}
