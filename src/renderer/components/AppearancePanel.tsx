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
  const match = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  const [red, green, blue] = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((part) => channel(part / 255));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
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
  const [text, setText] = useState(hex);
  useEffect(() => setText(hex), [hex]);
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
          <label>{label(settings, 'Picker', '色板')}<input type="color" value={hex} onChange={(event) => onChange({ kind: 'hex', hex: event.target.value })} /></label>
          <label>{label(settings, 'Hex', '十六進位')}<input value={text} maxLength={7} onChange={(event) => { const next = event.target.value; setText(next); if (/^#[0-9a-fA-F]{6}$/.test(next)) onChange({ kind: 'hex', hex: next.toLowerCase() }); }} /></label>
          <p className="supporting">{label(settings, 'A fixed colour will not follow the dark theme.', '固定顏色唔會跟深色主題變。')}</p>
        </>
      )}
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
          if (token === 'borderWidth') {
            return <ChipField key={token} token={token} settings={settings} options={['0', '1', '2', '3'] as const} value={override.borderWidth === undefined ? undefined : String(override.borderWidth) as '0'} onChange={(next) => { appearance.setToken(token, next === undefined ? undefined : Number(next)); appearance.commit(); }} render={(option) => `${option}px`} />;
          }
          const bounds = token === 'fontScale' ? { min: 75, max: 150 } : { min: 50, max: 200 };
          return <ScaleField key={token} token={token} settings={settings} value={token === 'fontScale' ? override.fontScale : override.paddingScale} min={bounds.min} max={bounds.max} onChange={(next) => appearance.setToken(token, next)} onCommit={appearance.commit} />;
        }) : <p className="supporting">{label(settings, 'No control in this section matches the search.', '呢個分類冇設定配到搜尋。')}</p>}
      </div>
      {ratio !== null && ratio < threshold && (
        <p className="notice warning" role="status">
          <Icon>contrast</Icon>
          {label(settings, `Contrast is ${ratio.toFixed(2)}:1, below the ${threshold}:1 guideline.`, `對比度 ${ratio.toFixed(2)}:1，低過 ${threshold}:1 建議值。`)}
          <button className="text-button" onClick={() => { appearance.setToken('foreground', { kind: 'hex', hex: (contrastRatio(ON_DARK, background ?? '#ffffff') ?? 0) >= (contrastRatio(ON_LIGHT, background ?? '#ffffff') ?? 0) ? ON_DARK : ON_LIGHT }); appearance.commit(); }}>
            {label(settings, 'Fix contrast', '修正對比')}
          </button>
        </p>
      )}
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
