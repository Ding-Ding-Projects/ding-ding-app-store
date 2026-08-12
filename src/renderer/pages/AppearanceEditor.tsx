import { ELEMENT_BY_KEY } from '../../shared/contracts';
import type { ElementKey, LockTarget, TabRailLayout, TokenId, UserSettings } from '../../shared/contracts';
import { el } from '../el';
import { downloadText, pickTextFile } from '../files';
import { isExternalEditorBridgeAvailable, openExportInVsCode } from '../external-editor';
import { Icon } from '../icons';
import { label } from '../i18n';
import type { Notify } from '../notify';
import { TAB_META, TOKEN_META } from '../registry';
import type { AppearanceApi } from '../state/use-appearance';
import type { LocksApi } from '../state/use-locks';
import type { WorkspaceApi } from '../state/use-workspace';
import { SearchablePicker } from '../components/SearchablePicker';

interface RailRow { key: keyof TabRailLayout; en: string; yue: string; keywords: string }

/**
 * Keep the rail choices in one ordered list so the visible picker and its
 * search vocabulary cannot drift apart. Left is the shipped default; the
 * other three edges are equally real persisted layouts.
 */
export const RAIL_SIDE_OPTIONS = [
  { value: 'left', en: 'Left', yue: '左邊' },
  { value: 'right', en: 'Right', yue: '右邊' },
  { value: 'top', en: 'Top', yue: '上面' },
  { value: 'bottom', en: 'Bottom', yue: '下面' },
] as const satisfies ReadonlyArray<{ value: TabRailLayout['side']; en: string; yue: string }>;

const RAIL_ROWS: readonly RailRow[] = [
  { key: 'side', en: 'Rail side', yue: '導覽位置', keywords: 'left right top bottom rail side edge dock' },
  { key: 'labelMode', en: 'Label mode', yue: '標籤模式', keywords: 'full compact icon label' },
  { key: 'tabHeight', en: 'Tab height', yue: '分頁高度', keywords: 'compact comfortable tall height' },
  { key: 'overflowMode', en: 'Overflow mode', yue: '溢出模式', keywords: 'menu scroll overflow' },
  { key: 'showBadges', en: 'Show badges', yue: '顯示徽章', keywords: 'badge dot updates' },
  { key: 'showGroupColorBar', en: 'Show group colour bar', yue: '顯示分組色條', keywords: 'group colour bar' },
  { key: 'pinnedIconOnly', en: 'Pinned tabs show icons only', yue: '釘住分頁淨係圖示', keywords: 'pin icon only' },
  { key: 'width', en: 'Rail width', yue: '導覽闊度', keywords: 'width size rail' },
];

export function AppearanceEditor({ settings, workspace, appearance, notify, matcher, locks, schoolModeEnabled = false, onManageLock }: {
  settings: UserSettings;
  workspace: WorkspaceApi;
  appearance: AppearanceApi;
  notify: Notify;
  matcher(haystack: string): boolean;
  locks?: LocksApi;
  schoolModeEnabled?: boolean;
  onManageLock?(target: LockTarget, returnFocus: HTMLElement | null): void;
}) {
  const rail = workspace.workspace.rail;
  const rows = RAIL_ROWS.filter((row) => matcher(`${row.en}\n${row.yue}\n${row.keywords}`));
  const overridden = (Object.keys(appearance.document.elements) as ElementKey[])
    .map((key) => ({ key, tokens: Object.keys(appearance.document.elements[key] ?? {}) }))
    .filter((entry) => entry.tokens.length);

  const set = <K extends keyof TabRailLayout>(key: K, value: TabRailLayout[K]) => workspace.dispatch({ type: 'rail', patch: { [key]: value } as Partial<TabRailLayout> });
  const openLayoutInCode = async () => {
    const content = await workspace.exportLayout();
    const result = await openExportInVsCode({ recordKind: 'tabs', suggestedName: 'ding-ding-app-store-tabs.json', mime: 'application/json', content });
    notify({ ok: result.ok, message: result.ok ? 'Tab layout opened in Visual Studio Code.' : result.message });
  };
  const openAppearanceInCode = async () => {
    const content = await appearance.exportDocument();
    const result = await openExportInVsCode({ recordKind: 'appearance', suggestedName: 'ding-ding-app-store-appearance.json', mime: 'application/json', content });
    notify({ ok: result.ok, message: result.ok ? 'Appearance export opened in Visual Studio Code.' : result.message });
  };

  return (
    <section className="settings-grid">
      <div className="settings-card" {...el('settings-card')}>
        <h2>{label(settings, 'Tab rail layout', '分頁列版面')}</h2>
        {rows.map((row) => {
          if (row.key === 'side') return <SearchablePicker key={row.key} id="rail-side" labelText={label(settings, row.en, row.yue)} settings={settings} value={rail.side} onChange={(next) => set('side', next as TabRailLayout['side'])} options={RAIL_SIDE_OPTIONS.map((option) => ({ value: option.value, en: option.en, yue: option.yue }))} />;
          if (row.key === 'labelMode') return <SearchablePicker key={row.key} id="rail-labelMode" labelText={label(settings, row.en, row.yue)} settings={settings} value={rail.labelMode} onChange={(next) => set('labelMode', next as TabRailLayout['labelMode'])} options={[{ value: 'full', en: 'Full', yue: '完整' }, { value: 'compact', en: 'Compact', yue: '精簡' }, { value: 'icon', en: 'Icon only', yue: '淨係圖示' }]} />;
          if (row.key === 'tabHeight') return <SearchablePicker key={row.key} id="rail-tabHeight" labelText={label(settings, row.en, row.yue)} settings={settings} value={rail.tabHeight} onChange={(next) => set('tabHeight', next as TabRailLayout['tabHeight'])} options={[{ value: 'compact', en: 'Compact', yue: '緊湊' }, { value: 'comfortable', en: 'Comfortable', yue: '舒適' }, { value: 'tall', en: 'Tall', yue: '高' }]} />;
          if (row.key === 'overflowMode') return <SearchablePicker key={row.key} id="rail-overflowMode" labelText={label(settings, row.en, row.yue)} settings={settings} value={rail.overflowMode} onChange={(next) => set('overflowMode', next as TabRailLayout['overflowMode'])} options={[{ value: 'menu', en: 'Overflow menu', yue: '溢出選單' }, { value: 'scroll', en: 'Scroll', yue: '捲動' }]} />;
          if (row.key === 'width') return <label key={row.key} htmlFor="rail-width">{label(settings, row.en, row.yue)} <span>{rail.width}px</span><input id="rail-width" type="range" min={64} max={420} step={2} value={rail.width} aria-valuetext={`${rail.width} pixels`} onChange={(event) => set('width', Number(event.target.value))} /></label>;
          const checked = Boolean(rail[row.key]);
          return <div className="switch-row" key={row.key}><label><input type="checkbox" checked={checked} onChange={(event) => set(row.key as 'showBadges', event.target.checked)} />{label(settings, row.en, row.yue)}</label></div>;
        })}
        {!rows.length && <p className="supporting">{label(settings, 'No rail option matches the search.', '冇導覽選項配到搜尋。')}</p>}
        <div className="appearance-preview" aria-hidden="true" data-label-mode={rail.labelMode} data-tab-height={rail.tabHeight} data-side={rail.side}>
          {workspace.workspace.tabs.slice(0, 4).map((tab) => (
            <span className="preview-tab" key={tab.id} data-selected={workspace.workspace.activeTabId === tab.id}>
              <Icon>{TAB_META[tab.id].icon}</Icon>
              {rail.labelMode !== 'icon' && <span>{TAB_META[tab.id].en}</span>}
            </span>
          ))}
        </div>
        <div className="card-actions">
          <button className="text-button" onClick={() => void workspace.reset()}><Icon>restart_alt</Icon>{label(settings, 'Reset tab layout', '重設分頁版面')}</button>
          <button className="text-button" onClick={() => void workspace.exportLayout().then((content) => downloadText('ding-ding-app-store-tabs.json', content, 'application/json'))}><Icon>download</Icon>{label(settings, 'Export tab layout', '匯出分頁版面')}</button>
          <button className="text-button" disabled={!isExternalEditorBridgeAvailable()} onClick={() => void openLayoutInCode()} title={isExternalEditorBridgeAvailable() ? undefined : 'Unavailable: no validated Visual Studio Code adapter.'}><Icon>code</Icon>{label(settings, 'Open tab layout in VS Code', '喺 VS Code 開分頁版面')}</button>
          <button className="text-button" onClick={() => void pickTextFile().then((picked) => {
            if (!picked) return;
            if (!picked.ok) { notify({ ok: false, message: picked.message.slice(0, 200) }); return; }
            void workspace.importLayout(picked.text);
          })}><Icon>upload</Icon>{label(settings, 'Import tab layout', '匯入分頁版面')}</button>
        </div>
      </div>

      <div className="settings-card" {...el('settings-card')}>
        <h2>{label(settings, 'Element appearance', '元素外觀')}</h2>
        <div className="switch-row">
          <label>
            <input type="checkbox" checked={appearance.editMode} onChange={(event) => appearance.setEditMode(event.target.checked)} />
            {label(settings, 'Appearance edit mode (Ctrl+Shift+E)', '外觀編輯模式（Ctrl+Shift+E）')}
          </label>
        </div>
        <p className="supporting">
          {label(settings, 'In edit mode a click or a keyboard focus selects the nearest editable element instead of running its action. Confirmation controls are never selectable.', '編輯模式下，撳一下或者用鍵盤 focus 都係揀最近嘅可編輯元素，唔會執行原本動作。確認控制永遠揀唔到。')}
        </p>
        <h3>{label(settings, `Overridden elements (${overridden.length})`, `已改嘅元素（${overridden.length}）`)}</h3>
        {overridden.length ? (
          <ul className="override-list">
            {overridden.map((entry) => (
              <li key={entry.key}>
                <strong>{label(settings, ELEMENT_BY_KEY.get(entry.key)?.en ?? entry.key, ELEMENT_BY_KEY.get(entry.key)?.yue ?? entry.key)}</strong>
                <span className="supporting">{entry.tokens.map((token) => TOKEN_META[token as keyof typeof TOKEN_META]?.en ?? token).join(', ')}</span>
                <div className="card-actions">{entry.tokens.map((token) => {
                  const target = { targetKind: 'appearance-property' as const, targetId: `${entry.key}:${token}` };
                  const locked = locks?.isLocked(target) ?? false;
                  const disabled = schoolModeEnabled || locks?.state.vaultAvailable === false || !onManageLock;
                  return <button key={token} className="text-button" type="button" disabled={disabled} title={disabled ? label(settings, schoolModeEnabled ? 'Appearance locks are unavailable in restricted mode.' : 'Credential vault unavailable; appearance locks are disabled.', schoolModeEnabled ? '限制模式唔支援外觀鎖。' : '憑證庫用唔到；外觀鎖已停用。') : undefined} onClick={(event) => onManageLock?.(target, event.currentTarget)} aria-label={`${locked ? 'Manage' : 'Lock'} ${TOKEN_META[token as TokenId]?.en ?? token} property`}><Icon>{locked ? 'lock' : 'lock_open'}</Icon>{locked ? label(settings, 'Manage property lock', '管理屬性鎖') : label(settings, 'Lock this property', '鎖定呢個屬性')}</button>;
                })}</div>
                <button className="text-button" onClick={() => { appearance.select(entry.key); appearance.setEditMode(true); }}>{label(settings, 'Edit this element', '編輯呢個元素')}</button>
                <button className="text-button" onClick={() => appearance.resetElement(entry.key)}>{label(settings, 'Reset', '重設')}</button>
              </li>
            ))}
          </ul>
        ) : <p className="supporting">{label(settings, 'No element has an override yet.', '暫時冇元素改過外觀。')}</p>}
        <div className="card-actions">
          <button className="text-button danger" onClick={() => appearance.resetAll()}><Icon>restart_alt</Icon>{label(settings, 'Reset all appearance', '全部外觀重設')}</button>
          <button className="text-button" onClick={() => void appearance.exportDocument().then((content) => downloadText('ding-ding-app-store-appearance.json', content, 'application/json'))}><Icon>download</Icon>{label(settings, 'Export appearance', '匯出外觀')}</button>
          <button className="text-button" disabled={!isExternalEditorBridgeAvailable()} onClick={() => void openAppearanceInCode()} title={isExternalEditorBridgeAvailable() ? undefined : 'Unavailable: no validated Visual Studio Code adapter.'}><Icon>code</Icon>{label(settings, 'Open appearance in VS Code', '喺 VS Code 開外觀')}</button>
          <button className="text-button" onClick={() => void pickTextFile().then((picked) => {
            if (!picked) return;
            if (!picked.ok) { notify({ ok: false, message: picked.message.slice(0, 200) }); return; }
            void appearance.importDocument(picked.text);
          })}><Icon>upload</Icon>{label(settings, 'Import appearance', '匯入外觀')}</button>
          {appearance.canUndo && <button className="text-button" onClick={() => appearance.undo()}><Icon>undo</Icon>{label(settings, 'Undo last reset', '復原上次重設')}</button>}
        </div>
      </div>
    </section>
  );
}
