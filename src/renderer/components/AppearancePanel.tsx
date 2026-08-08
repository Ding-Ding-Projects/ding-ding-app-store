import { useEffect, useMemo, useState } from 'react';
import { COLOR_ROLES, ELEMENT_BY_KEY, ELEVATIONS, RADII } from '../../shared/contracts';
import type { ColorRole, ColorValue, ElementKey, TokenId, UserSettings } from '../../shared/contracts';
import { Icon } from '../icons';
import { label } from '../i18n';
import { downloadText, pickTextFile } from '../files';
import type { Notify } from '../notify';
import { TOKEN_META, TOKEN_SECTIONS } from '../registry';
import type { TokenSection } from '../registry';
import { makeMatcher, useSurfaceSearch } from '../search';
import type { AppearanceApi } from '../state/use-appearance';
import { SearchBox } from './SearchBox';

const ON_LIGHT = '#1d1b20';
const ON_DARK = '#ffffff';

/** Static approximations of the shipped role palette, used only for the advisory contrast note. */
const ROLE_HEX: Record<ColorRole, { light: string; dark: string } | 'accent' | null> = {
  surface: { light: '#fef7ff', dark: '#141218' },
  'surface-container': { light: '#f3edf7', dark: '#211f26' },
  'surface-high': { light: '#ece6f0', dark: '#2b2930' },
  primary: 'accent',
  'on-primary': { light: '#ffffff', dark: '#25144a' },
  'primary-container': null,
  outline: { light: '#79747e', dark: '#938f99' },
  error: { light: '#b3261e', dark: '#b3261e' },
  success: { light: '#216e39', dark: '#216e39' },
  inherit: null,
  transparent: null,
};

function resolveColor(value: ColorValue | undefined, settings: UserSettings, dark: boolean): string | null {
  if (!value) return null;
  if (value.kind === 'hex') return value.hex;
  const entry = ROLE_HEX[value.role];
  if (!entry) return null;
  if (entry === 'accent') return settings.accent;
  return dark ? entry.dark : entry.light;
}

const channel = (part: number) => (part <= 0.03928 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4);

function luminance(hex: string): number | null {
  const match = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  const alphaMatch = /^#[0-9a-f]{6}([0-9a-f]{2})$/i.exec(hex.trim());
  const alpha = alphaMatch ? Number.parseInt(alphaMatch[1], 16) / 255 : 1;
  const [red, green, blue] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((part) => channel((part * alpha + 255 * (1 - alpha)) / 255));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function clamp(value: number, min: number, max: number): number { return Math.min(max, Math.max(min, value)); }

function hexToRgb(hex: string): [number, number, number, number] {
  const clean = hex.replace('#', '');
  const value = Number.parseInt(clean.slice(0, 6), 16);
  const alpha = clean.length === 8 ? Number.parseInt(clean.slice(6), 16) / 255 : 1;
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255, alpha];
}

function rgbToHex(red: number, green: number, blue: number, alpha = 1): string {
  const bytes = [red, green, blue].map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'));
  const suffix = alpha < 0.999 ? clamp(Math.round(alpha * 255), 0, 255).toString(16).padStart(2, '0') : '';
  return `#${bytes.join('')}${suffix}`;
}

function hexToHsl(hex: string): [number, number, number, number] {
  const [red, green, blue, alpha] = hexToRgb(hex).map((value, index) => index === 3 ? value : value / 255) as [number, number, number, number];
  const max = Math.max(red, green, blue); const min = Math.min(red, green, blue); const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  if (hue < 0) hue += 360;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return [Math.round(hue), Math.round(saturation * 100), Math.round(lightness * 100), alpha];
}

function hslToHex(hue: number, saturation: number, lightness: number, alpha = 1): string {
  const h = ((hue % 360) + 360) % 360 / 360; const s = clamp(saturation, 0, 100) / 100; const l = clamp(lightness, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs((h * 6) % 2 - 1)); const m = l - c / 2;
  const [r, g, b] = h < 1 / 6 ? [c, x, 0] : h < 2 / 6 ? [x, c, 0] : h < 3 / 6 ? [0, c, x] : h < 4 / 6 ? [0, x, c] : h < 5 / 6 ? [x, 0, c] : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255, alpha);
}

function parseRgb(value: string, alpha: number): string | null {
  const match = /^\s*rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(value);
  if (!match) return null;
  const parsedAlpha = match[4] ? (match[4].endsWith('%') ? Number.parseFloat(match[4]) / 100 : Number.parseFloat(match[4])) : alpha;
  return rgbToHex(Number(match[1]), Number(match[2]), Number(match[3]), parsedAlpha);
}

function parseHsl(value: string, alpha: number): string | null {
  const match = /^\s*hsla?\(\s*([\d.]+)(?:deg)?[,\s]+([\d.]+)%[,\s]+([\d.]+)%(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(value);
  if (!match) return null;
  const parsedAlpha = match[4] ? (match[4].endsWith('%') ? Number.parseFloat(match[4]) / 100 : Number.parseFloat(match[4])) : alpha;
  return hslToHex(Number(match[1]), Number(match[2]), Number(match[3]), parsedAlpha);
}

export function contrastRatio(foreground: string, background: string): number | null {
  const first = luminance(foreground);
  const second = luminance(background);
  if (first === null || second === null) return null;
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function ancestorTrail(key: ElementKey): ElementKey[] {
  const node = window.document.querySelector(`[data-el="${key}"]`);
  if (!node) return [key];
  const trail: ElementKey[] = [];
  let cursor: Element | null = node;
  while (cursor) {
    const value = cursor.getAttribute('data-el');
    if (value && ELEMENT_BY_KEY.has(value)) trail.unshift(value as ElementKey);
    cursor = cursor.parentElement;
  }
  return trail.length ? trail : [key];
}

function ColorField({ token, value, settings, onChange }: { token: TokenId; value: ColorValue | undefined; settings: UserSettings; onChange(next: ColorValue | undefined): void }) {
  const hex = value?.kind === 'hex' ? value.hex : '#6750a4';
  const [hexText, setHexText] = useState(hex);
  const [rgbText, setRgbText] = useState('');
  const [hslText, setHslText] = useState('');
  const [hue, saturation, lightness, alpha] = hexToHsl(hex);
  const alphaPercent = Math.round(alpha * 100);
  useEffect(() => {
    const [red, green, blue] = hexToRgb(hex);
    setHexText(hex);
    setRgbText(alpha < 1 ? `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(2)})` : `rgb(${red}, ${green}, ${blue})`);
    setHslText(alpha < 1 ? `hsla(${hue} ${saturation}% ${lightness}% / ${alpha.toFixed(2)})` : `hsl(${hue} ${saturation}% ${lightness}%)`);
  }, [hex, hue, saturation, lightness, alpha]);
  const emitHex = (next: string) => { if (/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(next)) onChange({ kind: 'hex', hex: next.toLowerCase() }); };
  return (
    <div className="appearance-token-row">
      <span className="token-name">{label(settings, TOKEN_META[token].en, TOKEN_META[token].yue)}</span>
      <label>
        {label(settings, 'Role', '角色')}
        <select
          value={value ? (value.kind === 'role' ? value.role : 'custom') : 'default'}
          onChange={(event) => {
            const next = event.target.value;
            if (next === 'default') onChange(undefined);
            else if (next === 'custom') onChange({ kind: 'hex', hex });
            else onChange({ kind: 'role', role: next as ColorRole });
          }}
        >
          <option value="default">{label(settings, 'Theme default', '主題預設')}</option>
          {COLOR_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
          <option value="custom">{label(settings, 'Fixed colour', '固定顏色')}</option>
        </select>
      </label>
      {value?.kind === 'hex' && (
        <>
          <label>{label(settings, 'Continuous colour field', '連續色彩場')}<input type="color" value={hex.slice(0, 7)} aria-label={label(settings, 'Continuous colour field', '連續色彩場')} onChange={(event) => emitHex(`${event.target.value}${alpha < 1 ? Math.round(alpha * 255).toString(16).padStart(2, '0') : ''}`)} /></label>
          <div className="color-spectrum" style={{ background: `linear-gradient(90deg, hsl(${hue} 100% 50%), hsl(${hue} 0% 50%))` }} aria-label={label(settings, 'Saturation and lightness field', '飽和度同亮度色場')}>
            <label>{label(settings, 'Hue', '色相')}<input type="range" min="0" max="360" value={hue} onChange={(event) => emitHex(hslToHex(Number(event.target.value), saturation, lightness, alpha))} /></label>
            <label>{label(settings, 'Saturation', '飽和度')}<input type="range" min="0" max="100" value={saturation} onChange={(event) => emitHex(hslToHex(hue, Number(event.target.value), lightness, alpha))} /></label>
            <label>{label(settings, 'Lightness', '亮度')}<input type="range" min="0" max="100" value={lightness} onChange={(event) => emitHex(hslToHex(hue, saturation, Number(event.target.value), alpha))} /></label>
          </div>
          <label>{label(settings, 'Alpha', '透明度')}<input type="range" min="0" max="100" value={alphaPercent} aria-valuetext={`${alphaPercent}%`} onChange={(event) => emitHex(hslToHex(hue, saturation, lightness, Number(event.target.value) / 100))} /><span>{alphaPercent}%</span></label>
          <label>{label(settings, 'HEX / HEX8', 'HEX / HEX8')}<input value={hexText} maxLength={9} onChange={(event) => { setHexText(event.target.value); emitHex(event.target.value); }} /></label>
          <label>{label(settings, 'RGB / RGBA', 'RGB / RGBA')}<input value={rgbText} onChange={(event) => { setRgbText(event.target.value); const parsed = parseRgb(event.target.value, alpha); if (parsed) emitHex(parsed); }} /></label>
          <label>{label(settings, 'HSL / HSLA', 'HSL / HSLA')}<input value={hslText} onChange={(event) => { setHslText(event.target.value); const parsed = parseHsl(event.target.value, alpha); if (parsed) emitHex(parsed); }} /></label>
          <p className="supporting">{label(settings, 'The picker persists HEX/HEX8, RGB/A, and HSL/A. HSV/HSB, HWB, Lab/LCH, OKLab/OKLCH, and CMYK are shown as unsupported and are not silently converted.', '色板會儲存 HEX/HEX8、RGB/A 同 HSL/A。HSV/HSB、HWB、Lab/LCH、OKLab/OKLCH 同 CMYK 目前標示未支援，唔會靜默轉換。')}</p>
          <p className="supporting">{label(settings, 'A fixed colour will not follow the dark theme.', '固定顏色唔會跟深色主題變。')}</p>
        </>
      )}
    </div>
  );
}

const FONT_FAMILIES = [
  'Segoe UI Variable', 'Segoe UI', 'Arial', 'Calibri', 'Consolas', 'Cascadia Mono', 'Tahoma',
  'Verdana', 'Georgia', 'Times New Roman', 'Noto Sans', 'Noto Sans CJK TC', 'Microsoft JhengHei',
] as const;

function FontFamilyField({ token, value, settings, onChange }: { token: TokenId; value: string | undefined; settings: UserSettings; onChange(next: string | undefined): void }) {
  const [query, setQuery] = useState(value ?? '');
  const choices = FONT_FAMILIES.filter((family) => !query.trim() || family.toLowerCase().includes(query.trim().toLowerCase()));
  useEffect(() => setQuery(value ?? ''), [value]);
  return (
    <div className="appearance-token-row">
      <span className="token-name">{label(settings, TOKEN_META[token].en, TOKEN_META[token].yue)}</span>
      <label>{label(settings, 'Search installed and bundled fonts', '搜尋已安裝同內置字型')}
        <input value={query} list="appearance-font-families" onChange={(event) => { const next = event.target.value; setQuery(next); if (FONT_FAMILIES.includes(next as (typeof FONT_FAMILIES)[number])) onChange(next); }} />
      </label>
      <datalist id="appearance-font-families">{choices.map((family) => <option key={family} value={family}>{family}</option>)}</datalist>
      <div className="font-choice-row" role="listbox" aria-label={label(settings, 'Font families', '字型家族')}>
        {choices.map((family) => <button key={family} type="button" role="option" aria-selected={value === family} style={{ fontFamily: family }} onClick={() => { setQuery(family); onChange(family); }}>{family}</button>)}
      </div>
      <button className="text-button" type="button" onClick={() => { setQuery(''); onChange(undefined); }}>{label(settings, 'Use default font', '用預設字型')}</button>
    </div>
  );
}

function NumberField({ token, value, min, max, step, unit, settings, onChange }: { token: TokenId; value: number | undefined; min: number; max: number; step: number; unit: string; settings: UserSettings; onChange(next: number | undefined): void }) {
  const current = value ?? (token === 'lineHeight' ? 140 : 0);
  return (
    <div className="appearance-token-row">
      <span className="token-name">{label(settings, TOKEN_META[token].en, TOKEN_META[token].yue)}</span>
      <label><input type="range" min={min} max={max} step={step} value={current} aria-valuetext={`${current}${unit}`} onChange={(event) => onChange(Number(event.target.value))} /><span>{current}{unit}</span></label>
      <button className="text-button" type="button" onClick={() => onChange(undefined)}>{label(settings, 'Use default', '用預設')}</button>
    </div>
  );
}

function ChipField<T extends string>({ token, options, value, settings, onChange, render }: {
  token: TokenId; options: readonly T[]; value: T | undefined; settings: UserSettings; onChange(next: T | undefined): void; render?(option: T): string;
}) {
  return (
    <div className="appearance-token-row">
      <span className="token-name">{label(settings, TOKEN_META[token].en, TOKEN_META[token].yue)}</span>
      <div className="chip-row" role="group" aria-label={label(settings, TOKEN_META[token].en, TOKEN_META[token].yue)}>
        <button aria-pressed={value === undefined} onClick={() => onChange(undefined)}>{label(settings, 'Default', '預設')}</button>
        {options.map((option) => <button key={option} aria-pressed={value === option} onClick={() => onChange(option)}>{render ? render(option) : option}</button>)}
      </div>
    </div>
  );
}

function ScaleField({ token, value, min, max, settings, onChange, onCommit }: {
  token: TokenId; value: number | undefined; min: number; max: number; settings: UserSettings; onChange(next: number | undefined): void; onCommit(): void;
}) {
  const current = value ?? 100;
  return (
    <div className="appearance-token-row">
      <span className="token-name">{label(settings, TOKEN_META[token].en, TOKEN_META[token].yue)}</span>
      <label>
        <input
          type="range"
          min={min}
          max={max}
          step={5}
          value={current}
          aria-valuetext={`${current}%`}
          onChange={(event) => onChange(Number(event.target.value))}
          onBlur={onCommit}
        />
        <span>{current}%</span>
      </label>
      <button className="text-button" onClick={() => onChange(undefined)}>{label(settings, 'Use default', '用預設')}</button>
    </div>
  );
}

export function AppearancePanel({ appearance, settings, notify, onClose }: {
  appearance: AppearanceApi; settings: UserSettings; notify: Notify; onClose(): void;
}) {
  const search = useSurfaceSearch('appearance.elements');
  const [section, setSection] = useState<TokenSection>('colour');
  const [trail, setTrail] = useState<ElementKey[]>([]);
  const selected = appearance.selectedKey;

  useEffect(() => { setTrail(selected ? ancestorTrail(selected) : []); }, [selected, appearance.elements]);

  const definition = selected ? ELEMENT_BY_KEY.get(selected) : undefined;
  const override = selected ? appearance.overrideOf(selected) : {};
  const matcher = useMemo(() => makeMatcher(search.state), [search.state]);
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const onScreen = Boolean(selected && window.document.querySelector(`[data-el="${selected}"]`));

  const foreground = resolveColor(override.foreground, settings, dark);
  const background = resolveColor(override.background, settings, dark);
  const ratio = foreground && background ? contrastRatio(foreground, background) : null;
  const threshold = selected === 'page-title' || selected === 'app-card-title' ? 3 : 4.5;

  if (!selected || !definition) {
    return (
      <aside className="appearance-panel" role="dialog" aria-label={label(settings, 'Appearance editor', '外觀編輯器')}>
        <header><strong>{label(settings, 'Appearance editor', '外觀編輯器')}</strong><button className="icon-button" onClick={onClose} aria-label="Close appearance panel"><Icon>close</Icon></button></header>
        <p className="supporting">{label(settings, 'Turn on edit mode, then choose any element on screen. Keyboard users can Tab to an element and it is selected automatically.', '開編輯模式，然後撳畫面上任何一個元素。用鍵盤 Tab 過去都會自動選中。')}</p>
      </aside>
    );
  }

  const tokens = definition.tokens.filter((token) => TOKEN_META[token].section === section && matcher(`${definition.en}\n${definition.yue}\n${token}\n${TOKEN_META[token].en}\n${TOKEN_META[token].yue}`));

  return (
    <aside className="appearance-panel" role="dialog" aria-label={label(settings, 'Appearance editor', '外觀編輯器')}>
      <header>
        <div>
          <nav className="appearance-breadcrumb" aria-label={label(settings, 'Element ancestors', '上層元素')}>
            {trail.map((key, index) => (
              <button key={key} className="text-button" onClick={() => appearance.select(key)}>
                {index > 0 ? '› ' : ''}{ELEMENT_BY_KEY.get(key)?.en ?? key}
              </button>
            ))}
          </nav>
          <strong>{label(settings, definition.en, definition.yue)}</strong>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close appearance panel"><Icon>close</Icon></button>
      </header>
      {!onScreen && <p className="notice" role="status"><Icon>info</Icon>{label(settings, 'This element is not currently on screen. You can still edit it.', '呢個元素而家唔喺畫面度，一樣改得。')}</p>}
      <SearchBox surface="appearance.elements" placeholder={label(settings, 'Search appearance controls', '搵外觀設定')} />
      <div className="sub-tab-row" role="tablist" aria-label={label(settings, 'Appearance sections', '外觀分類')}>
        {TOKEN_SECTIONS.map((row) => (
          <button
            key={row.id}
            role="tab"
            aria-selected={section === row.id}
            tabIndex={section === row.id ? 0 : -1}
            onClick={() => setSection(row.id)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
              event.preventDefault();
              const index = TOKEN_SECTIONS.findIndex((item) => item.id === section);
              const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + TOKEN_SECTIONS.length) % TOKEN_SECTIONS.length;
              setSection(TOKEN_SECTIONS[next].id);
            }}
          >
            {label(settings, row.en, row.yue)}
          </button>
        ))}
      </div>
      <div className="appearance-tokens">
        {tokens.length ? tokens.map((token) => {
          if (token === 'background' || token === 'foreground') {
            return <ColorField key={token} token={token} settings={settings} value={override[token]} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          }
          if (token === 'radius') return <ChipField key={token} token={token} settings={settings} options={RADII} value={override.radius} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          if (token === 'elevation') return <ChipField key={token} token={token} settings={settings} options={ELEVATIONS} value={override.elevation} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          if (token === 'fontWeight') {
            return <ChipField key={token} token={token} settings={settings} options={['400', '500', '600', '700', '800'] as const} value={override.fontWeight ? String(override.fontWeight) as '400' : undefined} onChange={(next) => { appearance.setToken(token, next ? Number(next) as 400 : undefined); appearance.commit(); }} />;
          }
          if (token === 'fontFamily') {
            return <FontFamilyField key={token} token={token} settings={settings} value={override.fontFamily} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          }
          if (token === 'fontStyle') {
            return <ChipField key={token} token={token} settings={settings} options={['normal', 'italic', 'oblique'] as const} value={override.fontStyle} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          }
          if (token === 'textDecoration') {
            return <ChipField key={token} token={token} settings={settings} options={['none', 'underline', 'line-through', 'underline line-through'] as const} value={override.textDecoration} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          }
          if (token === 'letterSpacing') {
            return <NumberField key={token} token={token} settings={settings} value={override.letterSpacing} min={-4} max={16} step={1} unit="/10em" onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          }
          if (token === 'lineHeight') {
            return <NumberField key={token} token={token} settings={settings} value={override.lineHeight} min={80} max={240} step={5} unit="%" onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          }
          if (token === 'borderWidth') {
            return <ChipField key={token} token={token} settings={settings} options={['0', '1', '2', '3'] as const} value={override.borderWidth === undefined ? undefined : String(override.borderWidth) as '0'} onChange={(next) => { appearance.setToken(token, next === undefined ? undefined : Number(next)); appearance.commit(); }} render={(option) => `${option}px`} />;
          }
          const bounds = token === 'fontScale' ? { min: 75, max: 150 } : { min: 50, max: 200 };
          return <ScaleField key={token} token={token} settings={settings} value={token === 'fontScale' ? override.fontScale : override.paddingScale} min={bounds.min} max={bounds.max} onChange={(next) => appearance.setToken(token, next)} onCommit={appearance.commit} />;
        }) : <p className="supporting">{label(settings, 'No control in this section matches the search.', '呢個分類冇設定配到搜尋。')}</p>}
      </div>
      {section === 'type' && <p className="supporting capability-note" role="note">{label(settings, 'Advanced typography such as variation axes, underline colour/style, overline, capitalization, small caps, baseline, direction, alignment, and text effects is not supported by this editor yet; these values are shown here as a capability note and are never silently persisted.', '字型變體軸、底線顏色／樣式、上劃線、大小寫、小型大寫、基線、方向、對齊同文字效果等進階字體功能，呢個編輯器暫時未支援；呢段係能力提示，唔會靜默儲存。')}</p>}
      {ratio !== null && <p className={ratio < threshold ? 'notice warning' : 'supporting'} role="status">
        <Icon>contrast</Icon>
        {label(settings, `Contrast readout: ${ratio.toFixed(2)}:1${ratio < threshold ? ` (below ${threshold}:1 guideline)` : ''}.`, `對比度讀數：${ratio.toFixed(2)}:1${ratio < threshold ? `（低過 ${threshold}:1 建議值）` : ''}。`)}
        {ratio < threshold && <button className="text-button" onClick={() => { appearance.setToken('foreground', { kind: 'hex', hex: (contrastRatio(ON_DARK, background ?? '#ffffff') ?? 0) >= (contrastRatio(ON_LIGHT, background ?? '#ffffff') ?? 0) ? ON_DARK : ON_LIGHT }); appearance.commit(); }}>
          {label(settings, 'Fix contrast', '修正對比')}
        </button>}
      </p>}
      <footer>
        <button className="text-button" onClick={() => appearance.resetElement(selected)}>{label(settings, 'Reset element', '重設元素')}</button>
        <button className="text-button danger" onClick={() => appearance.resetAll()}>{label(settings, 'Reset all…', '全部重設…')}</button>
        <button className="text-button" onClick={() => void appearance.exportDocument().then((content) => downloadText('ding-ding-app-store-appearance.json', content, 'application/json'))}><Icon>download</Icon>{label(settings, 'Export', '匯出')}</button>
        <button className="text-button" onClick={() => void pickTextFile().then((picked) => {
          if (!picked) return;
          if (!picked.ok) { notify({ ok: false, message: picked.message.slice(0, 200) }); return; }
          void appearance.importDocument(picked.text);
        })}><Icon>upload</Icon>{label(settings, 'Import…', '匯入…')}</button>
      </footer>
    </aside>
  );
}
