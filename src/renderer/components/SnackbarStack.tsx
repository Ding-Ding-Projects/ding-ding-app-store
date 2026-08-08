import { useEffect, useState } from 'react';
import type { ActiveNotice, RecoveryActionKind } from '../notify';
import type { UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';

export function recoveryActionLabel(settings: UserSettings, kind: RecoveryActionKind): string {
  const labels: Record<RecoveryActionKind, readonly [string, string]> = {
    'retry-catalog-refresh': ['Retry catalog refresh', '再試更新目錄'],
    'retry-installer': ['Retry install', '再試安裝'],
    'retry-managed-update': ['Retry app update', '再試 App 更新'],
    'retry-store-update-check': ['Retry update check', '再試檢查更新'],
    'retry-scheduled-check': ['Run check again', '再行一次檢查'],
    'retry-source-job': ['Retry source job', '再試 source 工作'],
    'open-source-details': ['Open source details', '開 source 詳情'],
  };
  const [en, yue] = labels[kind];
  return label(settings, en, yue);
}

function Snackbar({ notice, settings, onDismiss }: { notice: ActiveNotice; settings: UserSettings; onDismiss(id: string): void }) {
  const [recoveryRunning, setRecoveryRunning] = useState(false);
  useEffect(() => {
    if (!notice.ok) return;
    const timer = window.setTimeout(() => onDismiss(notice.id), 5_000);
    return () => window.clearTimeout(timer);
  }, [notice.id, notice.ok, onDismiss]);
  const runRecovery = async () => {
    if (!notice.recovery || recoveryRunning) return;
    setRecoveryRunning(true);
    try {
      await notice.recovery.run();
    } finally {
      // The action is deliberately one-shot. A producer may notify a fresh
      // outcome, but this stale failure can no longer re-enter the operation.
      onDismiss(notice.id);
    }
  };
  return (
    <div className={`snackbar ${notice.ok ? 'success' : 'error'}`} role={notice.ok ? 'status' : 'alert'} {...el('snackbar')}>
      <Icon>{notice.ok ? 'check_circle' : 'error'}</Icon>
      <span><strong>{notice.title}</strong><small>{notice.message}</small></span>
      {notice.undo && <button className="text-button" onClick={() => { notice.undo?.run(); onDismiss(notice.id); }}>{notice.undo.label}</button>}
      {notice.recovery && <button className="text-button" disabled={recoveryRunning} onClick={() => void runRecovery()} aria-label={recoveryActionLabel(settings, notice.recovery.kind)}><Icon>refresh</Icon>{recoveryRunning ? label(settings, 'Working…', '處理緊…') : recoveryActionLabel(settings, notice.recovery.kind)}</button>}
      <button className="icon-button" {...el('icon-button')} onClick={() => onDismiss(notice.id)} aria-label="Dismiss notification"><Icon>close</Icon></button>
    </div>
  );
}

export function SnackbarStack({ notices, settings, onDismiss }: { notices: ActiveNotice[]; settings: UserSettings; onDismiss(id: string): void }) {
  return <div className="snackbar-stack" aria-label="Notifications">{notices.map((notice) => <Snackbar key={notice.id} notice={notice} settings={settings} onDismiss={onDismiss} />)}</div>;
}
