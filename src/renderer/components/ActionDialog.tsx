import { useState } from 'react';
import type { CatalogApp, OperationResult, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';

export type ActionKind = 'install' | 'build' | 'uninstall';

/**
 * The native two-key plus full-slider super-confirmation. It is never appearance-targetable and
 * never hideable: no element inside carries data-el.
 */
export function SuperConfirm({ firstKey, secondKey, slider, onFirstKey, onSecondKey, onSlider }: {
  firstKey: boolean; secondKey: boolean; slider: number;
  onFirstKey(value: boolean): void; onSecondKey(value: boolean): void; onSlider(value: number): void;
}) {
  return (
    <div className="super-confirm">
      <div className="key-row">
        <button className={firstKey ? 'key active' : 'key'} onClick={() => onFirstKey(!firstKey)} aria-pressed={firstKey}>Turn key A</button>
        <button className={secondKey ? 'key active' : 'key'} onClick={() => onSecondKey(!secondKey)} aria-pressed={secondKey}>Turn key B</button>
      </div>
      <label>Slide to authorize · 拉盡先授權<input type="range" min="0" max="100" value={slider} disabled={!firstKey || !secondKey} onChange={(event) => onSlider(Number(event.target.value))} /><span>{slider}%</span></label>
    </div>
  );
}

export function ActionDialog({ action, settings, onClose, onResult }: { action: { kind: ActionKind; app: CatalogApp }; settings: UserSettings; onClose: () => void; onResult: (result: OperationResult) => void }) {
  const [confirmation, setConfirmation] = useState('');
  const [firstKey, setFirstKey] = useState(false);
  const [secondKey, setSecondKey] = useState(false);
  const [slider, setSlider] = useState(0);
  const [busy, setBusy] = useState(false);
  const prefix = action.kind.toUpperCase();
  const expected = `${prefix} ${action.app.name}`;
  const destructiveReady = action.kind !== 'uninstall' || (firstKey && secondKey && slider === 100);
  const typedReady = action.kind === 'uninstall' ? destructiveReady : confirmation === expected;
  const submit = async () => {
    if (!typedReady || busy) return;
    setBusy(true);
    const request = { appId: action.app.id, confirmation: action.kind === 'uninstall' ? expected : confirmation };
    const result = await window.dingDingStore.operations[action.kind](request);
    onResult(result);
    setBusy(false);
    if (result.ok) onClose();
  };
  return (
    <div className="scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="action-title" {...el('dialog')}>
        <header><div><span className="eyebrow">{prefix}</span><h2 id="action-title">{action.app.name}</h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="Emergency exit"><Icon>close</Icon></button></header>
        <p>{action.kind === 'install' && label(settings, 'A verified release will download and run silently. No restart is automatic.', '會下載驗證過嘅 release 再靜默安裝，唔會自動重開機。')}{action.kind === 'build' && label(settings, 'The reviewed source recipe runs only inside the disposable build runner.', '只會喺即棄 build runner 跑審核過嘅 source recipe。')}{action.kind === 'uninstall' && label(settings, 'This removes the recorded installation. The local action history keeps the result.', '會移除記錄中嘅安裝；本機 action history 會留低結果。')}</p>
        {action.kind === 'uninstall'
          ? <SuperConfirm firstKey={firstKey} secondKey={secondKey} slider={slider} onFirstKey={setFirstKey} onSecondKey={setSecondKey} onSlider={setSlider} />
          : <label>Type <strong>{expected}</strong><input autoFocus value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>}
        <footer><button className="text-button" onClick={onClose} disabled={busy}>Emergency exit · 緊急離開</button><button className={action.kind === 'uninstall' ? 'filled-button danger-fill' : 'filled-button'} onClick={submit} disabled={!typedReady || busy}>{busy ? 'Working…' : `${prefix} ${action.app.name}`}</button></footer>
      </section>
    </div>
  );
}
