import { useEffect, useMemo, useState } from 'react';
import { COLOR_ROLES, ELEMENT_BY_KEY, ELEVATIONS, RADII } from '../../shared/contracts';
import type { ColorRole, ColorValue, ElementKey, TokenId, UserSettings } from '../../shared/contracts';
import { Icon } from '../icons';
import { label } from '../i18n';
import { downloadText, pickTextFile } from '../files';
import { isExternalEditorBridgeAvailable, openExportInVsCode } from '../external-editor';
import type { Notify } from '../notify';
import { TOKEN_META, TOKEN_SECTIONS } from '../registry';
import type { TokenSection } from '../registry';
import { makeMatcher, useSurfaceSearch } from '../search';
import type { AppearanceApi } from '../state/use-appearance';
import { SearchBox } from './SearchBox';
import { ColorTranslatorControl } from './ColorTranslatorControl';
import { SearchablePicker } from './SearchablePicker';
import { dialogCopy } from '../dialog-emoji';

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

function SettingExplanation({ settings, explanation, persisted, fallback }: { settings: UserSettings; explanation: { en: string; yue: string }; persisted: boolean; fallback: string }) {
  return (
    <details className="setting-help">
      <summary>{label(settings, 'What this controls', '呢個控制咩')}</summary>
      <p>{label(settings, explanation.en, explanation.yue)}</p>
      <p className="provenance-line">
        {persisted
          ? label(settings, 'Current value: persisted appearance override.', '目前值：已儲存嘅外觀覆蓋。')
          : label(settings, `Current value: compiled fallback (${fallback}).`, `目前值：編譯內置後備值（${fallback}）。`)}
      </p>
    </details>
  );
}

function ColorField({ token, value, settings, onChange }: { token: TokenId; value: ColorValue | undefined; settings: UserSettings; onChange(next: ColorValue | undefined): void }) {
  const hex = value?.kind === 'hex' ? value.hex : '#6750a4';
  return (
    <div className="appearance-token-row">
      <span className="token-name">{label(settings, TOKEN_META[token].en, TOKEN_META[token].yue)}</span>
      <SettingExplanation settings={settings} explanation={TOKEN_META[token].explanation} persisted={value !== undefined} fallback={TOKEN_META[token].defaultValue} />
      <SearchablePicker
        labelText={label(settings, 'Role', '角色')}
        settings={settings}
        value={value ? (value.kind === 'role' ? value.role : 'custom') : 'default'}
        options={[{ value: 'default', en: 'Theme default', yue: '主題預設' }, ...COLOR_ROLES.map((role) => ({ value: role, en: role, yue: role })), { value: 'custom', en: 'Fixed colour', yue: '固定顏色' }]}
        onChange={(next) => {
            if (next === 'default') onChange(undefined);
            else if (next === 'custom') onChange({ kind: 'hex', hex });
            else onChange({ kind: 'role', role: next as ColorRole });
          }}
      />
      {value?.kind === 'hex' && <ColorTranslatorControl settings={settings} value={hex} labelText={label(settings, TOKEN_META[token].en, TOKEN_META[token].yue)} onChange={(next) => onChange({ kind: 'hex', hex: next })} />}
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
      <SettingExplanation settings={settings} explanation={TOKEN_META[token].explanation} persisted={value !== undefined} fallback={TOKEN_META[token].defaultValue} />
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
      <SettingExplanation settings={settings} explanation={TOKEN_META[token].explanation} persisted={value !== undefined} fallback={TOKEN_META[token].defaultValue} />
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
      <SettingExplanation settings={settings} explanation={TOKEN_META[token].explanation} persisted={value !== undefined} fallback={TOKEN_META[token].defaultValue} />
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
      <SettingExplanation settings={settings} explanation={TOKEN_META[token].explanation} persisted={value !== undefined} fallback={TOKEN_META[token].defaultValue} />
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

function VariationAxesField({ value, settings, onChange }: { value: Record<string, number> | undefined; settings: UserSettings; onChange(next: Record<string, number> | undefined): void }) {
  const [text, setText] = useState(Object.entries(value ?? {}).map(([axis, amount]) => `${axis}=${amount}`).join(', '));
  const [invalid, setInvalid] = useState(false);
  useEffect(() => setText(Object.entries(value ?? {}).map(([axis, amount]) => `${axis}=${amount}`).join(', ')), [value]);
  const apply = (next: string) => {
    setText(next);
    if (!next.trim()) { setInvalid(false); onChange(undefined); return; }
    const axes: Record<string, number> = {};
    for (const part of next.split(',')) {
      const [axis, raw] = part.trim().split('=');
      if (!/^[A-Za-z0-9]{4}$/.test(axis ?? '')) { setInvalid(true); return; }
      const amount = Number(raw);
      if (!Number.isFinite(amount) || amount < -1000 || amount > 2000) { setInvalid(true); return; }
      axes[axis] = amount;
    }
    if (Object.keys(axes).length <= 8) { setInvalid(false); onChange(axes); } else setInvalid(true);
  };
  return <div className="appearance-token-row"><span className="token-name">{label(settings, TOKEN_META.fontVariationAxes.en, TOKEN_META.fontVariationAxes.yue)}</span><SettingExplanation settings={settings} explanation={TOKEN_META.fontVariationAxes.explanation} persisted={value !== undefined} fallback={TOKEN_META.fontVariationAxes.defaultValue} /><label>{label(settings, 'Axes (four letters=value)', '變體軸（四個字母=數值）')}<input value={text} maxLength={96} placeholder="wght=650,wdth=90" aria-invalid={invalid} aria-describedby="appearance-axes-error" onChange={(event) => apply(event.target.value)} /></label>{invalid && <p id="appearance-axes-error" className="notice warning" role="alert">{label(settings, 'Use up to eight four-letter axes with values from -1000 to 2000.', '最多八個四字母變體軸，數值由 -1000 至 2000。')}</p>}<p className="supporting">{label(settings, 'Up to eight axes; values are bounded before CSS output.', '最多八個軸；輸出 CSS 前會限制數值。')}</p></div>;
}

function TextShadowField({ value, settings, onChange }: { value: { x: number; y: number; blur: number; color: ColorValue } | undefined; settings: UserSettings; onChange(next: { x: number; y: number; blur: number; color: ColorValue } | undefined): void }) {
  const current = value ?? { x: 0, y: 0, blur: 0, color: { kind: 'hex' as const, hex: '#00000080' } };
  const shadowHex = current.color.kind === 'hex' ? current.color.hex : '#000000';
  return <div className="appearance-token-row"><span className="token-name">{label(settings, TOKEN_META.textShadow.en, TOKEN_META.textShadow.yue)}</span><SettingExplanation settings={settings} explanation={TOKEN_META.textShadow.explanation} persisted={value !== undefined} fallback={TOKEN_META.textShadow.defaultValue} /><div className="chip-row"><label>{label(settings, 'X', 'X')}<input type="number" min={-20} max={20} value={current.x} onChange={(event) => onChange({ ...current, x: Number(event.target.value) })} /></label><label>{label(settings, 'Y', 'Y')}<input type="number" min={-20} max={20} value={current.y} onChange={(event) => onChange({ ...current, y: Number(event.target.value) })} /></label><label>{label(settings, 'Blur', '模糊')}<input type="number" min={0} max={40} value={current.blur} onChange={(event) => onChange({ ...current, blur: Number(event.target.value) })} /></label></div><ColorTranslatorControl settings={settings} value={shadowHex} labelText={label(settings, 'Shadow colour', '陰影顏色')} onChange={(next) => onChange({ ...current, color: { kind: 'hex', hex: next } })} /><button className="text-button" type="button" onClick={() => onChange(undefined)}>{label(settings, 'Use default', '用預設')}</button></div>;
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
        <header><strong>{dialogCopy(settings, label(settings, 'Appearance editor', '外觀編輯器'), '🎨')}</strong><button className="icon-button" onClick={onClose} aria-label="Close appearance panel"><Icon>close</Icon></button></header>
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
          <strong>{dialogCopy(settings, label(settings, definition.en, definition.yue), '🎨')}</strong>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close appearance panel"><Icon>close</Icon></button>
      </header>
      {!onScreen && <p className="notice" role="status"><Icon>info</Icon>{label(settings, 'This element is not currently on screen. You can still edit it.', '呢個元素而家唔喺畫面度，一樣改得。')}</p>}
      <SearchBox surface="appearance.elements" settings={settings} placeholder={label(settings, 'Search appearance controls', '搵外觀設定')} />
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
            return <ChipField key={token} token={token} settings={settings} options={['none', 'underline', 'overline', 'line-through', 'underline overline', 'underline line-through', 'overline line-through', 'underline overline line-through'] as const} value={override.textDecoration} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          }
          if (token === 'underlineColor') return <ColorField key={token} token={token} settings={settings} value={override.underlineColor} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          if (token === 'fontVariationAxes') return <VariationAxesField key={token} settings={settings} value={override.fontVariationAxes} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          if (token === 'underlineStyle') return <ChipField key={token} token={token} settings={settings} options={['solid', 'double', 'dotted', 'dashed', 'wavy'] as const} value={override.underlineStyle} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          if (token === 'textTransform') return <ChipField key={token} token={token} settings={settings} options={['none', 'uppercase', 'lowercase', 'capitalize'] as const} value={override.textTransform} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          if (token === 'fontVariantCaps') return <ChipField key={token} token={token} settings={settings} options={['normal', 'small-caps', 'all-small-caps', 'petite-caps', 'all-petite-caps', 'unicase', 'titling-caps'] as const} value={override.fontVariantCaps} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          if (token === 'textDirection') return <ChipField key={token} token={token} settings={settings} options={['auto', 'ltr', 'rtl'] as const} value={override.textDirection} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          if (token === 'textAlign') return <ChipField key={token} token={token} settings={settings} options={['start', 'center', 'end', 'justify'] as const} value={override.textAlign} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          if (token === 'textShadow') return <TextShadowField key={token} settings={settings} value={override.textShadow} onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          if (token === 'underlineThickness') return <NumberField key={token} token={token} settings={settings} value={override.underlineThickness} min={0} max={10} step={1} unit="px" onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
          if (token === 'baselineOffset') return <NumberField key={token} token={token} settings={settings} value={override.baselineOffset} min={-200} max={200} step={5} unit="%em" onChange={(next) => { appearance.setToken(token, next); appearance.commit(); }} />;
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
        <button className="text-button" disabled={!isExternalEditorBridgeAvailable()} title={isExternalEditorBridgeAvailable() ? undefined : 'Unavailable: no validated Visual Studio Code adapter.'} onClick={() => void appearance.exportDocument().then((content) => openExportInVsCode({ recordKind: 'appearance', suggestedName: 'ding-ding-app-store-appearance.json', mime: 'application/json', content })).then((result) => notify({ ok: result.ok, message: result.ok ? 'Appearance export opened in Visual Studio Code.' : result.message }))}><Icon>code</Icon>{label(settings, 'Open in VS Code', '喺 VS Code 開')}</button>
        <button className="text-button" onClick={() => void pickTextFile().then((picked) => {
          if (!picked) return;
          if (!picked.ok) { notify({ ok: false, message: picked.message.slice(0, 200) }); return; }
          void appearance.importDocument(picked.text);
        })}><Icon>upload</Icon>{label(settings, 'Import…', '匯入…')}</button>
      </footer>
    </aside>
  );
}
