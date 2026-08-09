import { useEffect, useRef, useState } from 'react';
import type { CatalogApp, OperationResult, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import { SuperConfirm } from './SuperConfirm';
import { dialogCopy } from '../dialog-emoji';

export type ActionKind = 'install' | 'build' | 'uninstall';
export type ImmediateActionKind = Exclude<ActionKind, 'uninstall'>;

/**
 * The native two-key plus full-slider super-confirmation. It is never appearance-targetable and
 * never hideable: no element inside carries data-el.
 */
export function ActionDialog({ action, settings, onClose, onResult }: { action: { kind: 'uninstall'; apps: CatalogApp[] }; settings: UserSettings; onClose: () => void; onResult: (result: OperationResult) => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const [firstKey, setFirstKey] = useState(false);
  const [secondKey, setSecondKey] = useState(false);
  const [slider, setSlider] = useState(0);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const destructiveReady = firstKey && secondKey && slider === 100;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
        if (focusable.length === 0) return;
        const current = focusable.indexOf(document.activeElement as HTMLElement);
        const next = event.shiftKey
          ? (current <= 0 ? focusable.length - 1 : current - 1)
          : (current === focusable.length - 1 ? 0 : current + 1);
        event.preventDefault();
        focusable[next].focus();
        return;
      }
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      if (!busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [busy, onClose]);

  const submit = async () => {
    if (!destructiveReady || busy) return;
    setBusy(true);
    let allOk = true;
    try {
      for (const [index, app] of action.apps.entries()) {
        setProgress(index);
        try {
          const result = await window.dingDingStore.operations.uninstall({ appId: app.id, decision: 'uninstall' });
          onResult(result);
          if (!result.ok) allOk = false;
        } catch (error) {
          allOk = false;
          onResult({ ok: false, appId: app.id, message: (error as Error).message });
        }
        setProgress(index + 1);
      }
      if (allOk) onClose();
    } catch (error) {
      onResult({ ok: false, appId: action.apps[progress]?.id ?? 'bulk-uninstall', message: (error as Error).message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="action-title" aria-describedby="action-description" {...el('dialog')}>
        <header><div><span className="eyebrow">UNINSTALL</span><h2 id="action-title">{dialogCopy(settings, action.apps.length === 1 ? action.apps[0].name : `${action.apps.length} selected applications`, '⚠️')}</h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Emergency exit"><Icon>close</Icon></button></header>
        <p id="action-description">{dialogCopy(settings, label(settings, `This removes ${action.apps.length === 1 ? action.apps[0].name : `${action.apps.length} recorded installations`}. The local action history keeps every result.`, `會移除${action.apps.length === 1 ? action.apps[0].name : `${action.apps.length} 個記錄中嘅安裝`}；本機 action history 會留低每個結果。`), '⚠️')}</p>
        {busy && <div className="operation-progress" role="status" aria-live="polite"><progress max={action.apps.length} value={progress} /><span>{progress} of {action.apps.length} finished</span></div>}
        <SuperConfirm firstKey={firstKey} secondKey={secondKey} slider={slider} onFirstKey={setFirstKey} onSecondKey={setSecondKey} onSlider={setSlider} />
        <footer><button className="text-button" onClick={onClose} disabled={busy}>Emergency exit · 緊急離開</button><button className="filled-button danger-fill" onClick={submit} disabled={!destructiveReady || busy}>{busy ? 'Working…' : `UNINSTALL ${action.apps.length}`}</button></footer>
      </section>
    </div>
  );
}
