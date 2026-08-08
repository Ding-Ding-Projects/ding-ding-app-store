export function SuperConfirm({ firstKey, secondKey, slider, onFirstKey, onSecondKey, onSlider }: {
  firstKey: boolean; secondKey: boolean; slider: number;
  onFirstKey(value: boolean): void; onSecondKey(value: boolean): void; onSlider(value: number): void;
}) {
  return (
    <div className="super-confirm">
      <div className="key-row">
        <button autoFocus className={firstKey ? 'key active' : 'key'} onClick={() => onFirstKey(!firstKey)} aria-pressed={firstKey}>Turn key A</button>
        <button className={secondKey ? 'key active' : 'key'} onClick={() => onSecondKey(!secondKey)} aria-pressed={secondKey}>Turn key B</button>
      </div>
      <label>Slide to authorize · 拉盡先授權<input type="range" min="0" max="100" value={slider} disabled={!firstKey || !secondKey} onChange={(event) => onSlider(Number(event.target.value))} /><span>{slider}%</span></label>
    </div>
  );
}
