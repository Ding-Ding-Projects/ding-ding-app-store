import { useEffect, useMemo, useState } from 'react';
import type { UserSettings } from '../../shared/contracts';
import { label } from '../i18n';
import { COLOR_SPACES, parseColor, toHex, translate, type ColorSpace } from '../color-translator';

export function ColorTranslatorControl({ settings, value, labelText, id, onChange }: {
  settings: UserSettings;
  value: string;
  labelText: string;
  id?: string;
  onChange(next: string): void;
}) {
  const [text, setText] = useState(value);
  const [invalid, setInvalid] = useState<ColorSpace | null>(null);
  const [clipped, setClipped] = useState(false);
  const current = parseColor(value, 'hex') ?? { r: 0.4, g: 0.31, b: 0.64, a: 1 };
  const hsl = translate(current, 'hsl').text.match(/hsl\(([-\d.]+) ([-\d.]+)% ([-\d.]+)%/);
  const hue = Number(hsl?.[1] ?? 0);
  const saturation = Number(hsl?.[2] ?? 0);
  const lightness = Number(hsl?.[3] ?? 0);
  const values = useMemo(
    () => Object.fromEntries(COLOR_SPACES.map((space) => [space, translate(current, space).text])) as Record<ColorSpace, string>,
    [current.r, current.g, current.b, current.a],
  );

  useEffect(() => setText(value), [value]);

  const emit = (space: ColorSpace, raw: string) => {
    const parsed = parseColor(raw, space);
    if (!parsed) { setInvalid(space); return; }
    setInvalid(null);
    const wasClipped = parsed.r < 0 || parsed.r > 1 || parsed.g < 0 || parsed.g > 1 || parsed.b < 0 || parsed.b > 1;
    setClipped(wasClipped);
    onChange(toHex({ r: Math.min(1, Math.max(0, parsed.r)), g: Math.min(1, Math.max(0, parsed.g)), b: Math.min(1, Math.max(0, parsed.b)), a: parsed.a }));
  };

  const copy = (raw: string) => void navigator.clipboard?.writeText(raw);
  const emitHsl = (nextHue = hue, nextSaturation = saturation, nextLightness = lightness, alpha = Math.round(current.a * 100)) => emit('hsl', `hsl(${nextHue} ${nextSaturation}% ${nextLightness}% / ${alpha}%)`);

  return (
    <div className="color-translator-control" role="group" aria-label={labelText}>
      <label>{labelText}<input id={id} type="color" value={value.slice(0, 7)} aria-label={`${labelText} continuous colour field`} onChange={(event) => emit('hex', `${event.target.value}${value.length === 9 ? value.slice(7) : ''}`)} /></label>
      <div className="color-spectrum" role="group" aria-label={label(settings, 'Continuous colour controls', '連續色彩控制')}>
        <label>{label(settings, 'Hue', '色相')}<input type="range" min="0" max="360" value={hue} aria-label={`${labelText} hue`} onChange={(event) => emitHsl(Number(event.target.value))} /></label>
        <label>{label(settings, 'Saturation', '飽和度')}<input type="range" min="0" max="100" value={saturation} aria-label={`${labelText} saturation`} onChange={(event) => emitHsl(hue, Number(event.target.value))} /></label>
        <label>{label(settings, 'Lightness', '亮度')}<input type="range" min="0" max="100" value={lightness} aria-label={`${labelText} lightness`} onChange={(event) => emitHsl(hue, saturation, Number(event.target.value))} /></label>
        <label>{label(settings, 'Alpha', '透明度')}<input type="range" min="0" max="100" value={Math.round(current.a * 100)} aria-label={`${labelText} alpha`} onChange={(event) => emitHsl(hue, saturation, lightness, Number(event.target.value))} /></label>
      </div>
      <label>{label(settings, 'HEX / HEX8', 'HEX / HEX8')}<input value={text} maxLength={9} aria-invalid={invalid === 'hex'} onChange={(event) => { setText(event.target.value); emit('hex', event.target.value); }} /><button type="button" className="text-button" onClick={() => copy(text)}>{label(settings, 'Copy', '複製')}</button></label>
      <div className="color-translator-values">
        {COLOR_SPACES.filter((space) => space !== 'hex').map((space) => <label key={space}>{space.toUpperCase()}<input value={values[space]} aria-invalid={invalid === space} onChange={(event) => emit(space, event.target.value)} /><button type="button" className="text-button" aria-label={label(settings, `Copy ${space} value`, `複製 ${space} 數值`)} onClick={() => copy(values[space])}>{label(settings, 'Copy', '複製')}</button></label>)}
      </div>
      {invalid && <p className="notice warning" role="alert">{label(settings, `Invalid ${invalid} colour; enter a bounded value.`, `${invalid} 顏色無效；請輸入有限制嘅值。`)}</p>}
      {clipped && <p className="notice warning" role="status">{label(settings, 'The colour was outside the sRGB gamut and was clipped before saving.', '顏色超出 sRGB 色域，儲存前已裁切。')}</p>}
      <p className="supporting">{label(settings, 'All representations preserve alpha and round-trip through canonical HEX/HEX8. Unsupported spaces remain visible with a bounded parser error.', '所有表示保留透明度，並會雙向轉換成標準 HEX/HEX8。唔支援嘅色彩空間仍然顯示，輸入錯誤會有限制地提示。')}</p>
    </div>
  );
}
