import { useEffect, useRef, useState } from 'react';
import { Icon } from '../icons';
import { SuperConfirm } from './SuperConfirm';
import type { UserSettings } from '../../shared/contracts';
import { dialogCopy } from '../dialog-emoji';

export function DestructiveConfirmDialog({ title, description, actionLabel, settings, onConfirm, onClose, credentialFields = [] }: {
  title: string;
  description: string;
  actionLabel: string;
  settings: UserSettings;
  onConfirm(): void | Promise<void>;
  onClose(): void;
  credentialFields?: Array<{ id: string; label: string; value: string; onChange(value: string): void }>;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [firstKey, setFirstKey] = useState(false);
  const [secondKey, setSecondKey] = useState(false);
  const [slider, setSlider] = useState(0);
  const [busy, setBusy] = useState(false);
  const ready = firstKey && secondKey && slider === 100;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); if (!busy) onClose(); return; }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])') ?? []);
      if (!focusable.length) return;
      const current = focusable.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey ? (current <= 0 ? focusable.length - 1 : current - 1) : (current === focusable.length - 1 ? 0 : current + 1);
      event.preventDefault();
      focusable[next].focus();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [busy, onClose]);

  return (
    <div className="scrim" role="presentation">
      <section ref={dialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="destructive-title" aria-describedby="destructive-description">
        <header><div><span className="eyebrow">DESTRUCTIVE ACTION</span><h2 id="destructive-title">{dialogCopy(settings, title, '⚠️')}</h2></div><button className="icon-button" onClick={onClose} aria-label="Emergency exit"><Icon>close</Icon></button></header>
        <p id="destructive-description">{dialogCopy(settings, description, '⚠️')}</p>
        {credentialFields.map((field) => <label key={field.id} htmlFor={field.id}>{field.label}<input id={field.id} type="password" value={field.value} onChange={(event) => field.onChange(event.target.value)} maxLength={512} /></label>)}
        <SuperConfirm firstKey={firstKey} secondKey={secondKey} slider={slider} onFirstKey={setFirstKey} onSecondKey={setSecondKey} onSlider={setSlider} />
        <footer><button className="text-button" disabled={busy} onClick={onClose}>Emergency exit · 緊急離開</button><button className="filled-button danger-fill" disabled={!ready || busy} onClick={() => { setBusy(true); const result = onConfirm(); if (result && typeof (result as Promise<void>).then === 'function') void (result as Promise<void>).then(() => { setBusy(false); onClose(); }, () => setBusy(false)); else { setBusy(false); onClose(); } }}>{busy ? 'Working…' : actionLabel}</button></footer>
      </section>
    </div>
  );
}
