import { useEffect, useMemo, useState } from 'react';
import type { SettingsProvenance, UserSettings } from '../../shared/contracts';
import { SearchBox } from '../components/SearchBox';
import { ExternalEditorSettings } from '../components/ExternalEditorSettings';
import { el } from '../el';
import { Icon } from '../icons';
import { label } from '../i18n';
import type { Notify } from '../notify';
import { SETTINGS_SUB_TABS, SETTING_FIELDS, SCHEDULE_FIELDS } from '../registry';
import type { SettingField, SettingsSubTabId } from '../registry';
import { makeMatcher, useSurfaceSearch } from '../search';
import type { SurfaceId } from '../search';
import type { AppearanceApi } from '../state/use-appearance';
import type { ScheduleApi } from '../state/use-schedule';
import { defaultSettings } from '../state/use-settings';
import type { WorkspaceApi } from '../state/use-workspace';
import { AppearanceEditor } from './AppearanceEditor';
import { ScheduleEditor } from './ScheduleEditor';
import { ChangelogViewer } from './ChangelogViewer';
import { downloadText } from '../files';
import { serializeStructuredExport } from '../../shared/export-registry';
import { isExternalEditorBridgeAvailable, openExportInVsCode } from '../external-editor';

const ABOUT_ROWS = [
  { en: 'Version', yue: '版本', body: 'Ding Ding App Store preview 0.1.0.' },
  { en: 'Unsigned artifacts', yue: '未簽名檔案', body: 'Code signing is permanently prohibited for this project. Update packages are verified by HTTPS feed metadata and package hashes; no code signature is claimed.' },
  { en: 'Data location', yue: '資料位置', body: 'Settings, tab layout, appearance, schedule, and activity history are stored in the application data directory owned by the main process. The renderer never receives a filesystem path.' },
  { en: 'Licence', yue: '授權', body: 'Apache-2.0. The catalog lists only reviewed public Ding Ding Projects applications.' },
] as const;

/** Keep About search text identical to the value rendered in the card. */
export function aboutRowBody(row: { en: string; body: string }, displayName: string): string {
  return row.en === 'Version' ? `${displayName} preview 0.1.0.` : row.body;
}

function SettingExplanation({ settings, field, provenance }: { settings: UserSettings; field: SettingField; provenance: SettingsProvenance }) {
  const persisted = provenance.source === 'persisted';
  return (
    <details className="setting-help">
      <summary>{label(settings, 'What this controls', '呢個控制咩')}</summary>
      <p>{label(settings, field.explanation.en, field.explanation.yue)}</p>
      <p className="provenance-line">
        {persisted
          ? label(settings, 'Current value: persisted in the validated settings file.', '目前值：已儲存喺驗證過嘅設定檔。')
          : label(settings, `Current value: compiled fallback (${field.defaultValue}).`, `目前值：編譯內置後備值（${field.defaultValue}）。`)}
      </p>
    </details>
  );
}

export function SettingsPage({ settings, settingsProvenance, onSave, workspace, appearance, schedule, notify, subTab, onSubTab, regexRequest, onRegexHandled }: {
  settings: UserSettings;
  settingsProvenance: SettingsProvenance;
  onSave(next: UserSettings): void;
  workspace: WorkspaceApi;
  appearance: AppearanceApi;
  schedule: ScheduleApi;
  notify: Notify;
  subTab: SettingsSubTabId;
  onSubTab(id: SettingsSubTabId): void;
  regexRequest: SurfaceId | null;
  onRegexHandled(): void;
}) {
  const [draft, setDraft] = useState(settings);
  useEffect(() => setDraft(settings), [settings]);
  const set = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const settingsExport = () => serializeStructuredExport({ kind: 'ding-ding-app-store.settings', schemaVersion: 1, exportedAt: new Date().toISOString(), settings: draft });
  const downloadSettings = () => { downloadText('ding-ding-app-store-settings.json', settingsExport(), 'application/json'); notify({ ok: true, message: 'Settings export downloaded.' }); };
  const openSettingsInCode = async () => {
    const result = await openExportInVsCode({ recordKind: 'settings', suggestedName: 'ding-ding-app-store-settings.json', mime: 'application/json', content: settingsExport() });
    notify({ ok: result.ok, message: result.ok ? 'Settings opened in Visual Studio Code.' : result.message });
  };

  const general = useSurfaceSearch('settings.general');
  const appearanceSearch = useSurfaceSearch('settings.appearance');
  const scheduleSearch = useSurfaceSearch('settings.schedule');
  const about = useSurfaceSearch('settings.about');
  const states = { 'settings.general': general, 'settings.appearance': appearanceSearch, 'settings.schedule': scheduleSearch, 'settings.about': about } as const;
  const active = states[subTab];
  const matcher = useMemo(() => makeMatcher(active.state), [active.state]);

  const counts = useMemo(() => ({
    'settings.general': SETTING_FIELDS.filter((field) => field.section === 'general' && matcher(`${field.en}\n${field.yue}\n${field.keywords.join(' ')}`)).length,
    'settings.appearance': SETTING_FIELDS.filter((field) => field.section === 'appearance' && matcher(`${field.en}\n${field.yue}\n${field.keywords.join(' ')}`)).length
      + (matcher('rail tabs layout appearance element override') ? 1 : 0),
    'settings.schedule': SCHEDULE_FIELDS.filter((field) => matcher(`${field.en}\n${field.yue}\n${field.keywords.join(' ')}`)).length,
    'settings.about': ABOUT_ROWS.filter((row) => matcher(`${row.en}\n${row.yue}\n${aboutRowBody(row, settings.displayName)}`)).length
      + (matcher('external editor Visual Studio Code VS Code exports') ? 1 : 0)
      + (matcher('changelog releases versions dates commits') ? 1 : 0),
  }), [matcher]);

  const fieldsFor = (section: SettingField['section']) => SETTING_FIELDS.filter((field) => field.section === section && matcher(`${field.en}\n${field.yue}\n${field.keywords.join(' ')}`));

  const renderField = (field: SettingField) => {
    const id = `setting-${field.key}`;
    const text = label(settings, field.en, field.yue);
    const explanation = <SettingExplanation settings={settings} field={field} provenance={settingsProvenance} />;
    if (field.kind === 'select') {
      return <div className="setting-field" key={field.key}><label htmlFor={id}>{text}<select id={id} value={String(draft[field.key])} onChange={(event) => set(field.key, event.target.value as UserSettings[typeof field.key])}>{(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{label(settings, option.en, option.yue)}</option>)}</select></label>{explanation}</div>;
    }
    if (field.kind === 'range') {
      return <div className="setting-field" key={field.key}><label htmlFor={id}>{text} <span>{String(draft[field.key])}</span><input id={id} type="range" min={field.min} max={field.max} value={Number(draft[field.key])} onChange={(event) => set(field.key, Number(event.target.value) as UserSettings[typeof field.key])} /></label>{explanation}</div>;
    }
    if (field.kind === 'color') {
      return <div className="setting-field" key={field.key}><label htmlFor={id}>{text}<input id={id} type="color" value={String(draft[field.key])} onChange={(event) => set(field.key, event.target.value as UserSettings[typeof field.key])} /></label>{explanation}</div>;
    }
    if (field.kind === 'switch') {
      return <div className="setting-field" key={field.key}><label htmlFor={id} className="switch-row"><input id={id} type="checkbox" checked={Boolean(draft[field.key])} onChange={(event) => set(field.key, event.target.checked as UserSettings[typeof field.key])} /><span>{text}</span></label>{explanation}</div>;
    }
    return <div className="setting-field" key={field.key}><label htmlFor={id}>{text}<input id={id} value={String(draft[field.key])} maxLength={64} onChange={(event) => set(field.key, event.target.value as UserSettings[typeof field.key])} /></label>{explanation}</div>;
  };

  const moveSubTab = (delta: number) => {
    const index = SETTINGS_SUB_TABS.findIndex((row) => row.id === subTab);
    const next = SETTINGS_SUB_TABS[(index + delta + SETTINGS_SUB_TABS.length) % SETTINGS_SUB_TABS.length];
    onSubTab(next.id);
    window.document.getElementById(`sub-tab-${next.id}`)?.focus();
  };

  return (
    <>
      <div className="sub-tab-row" role="tablist" aria-label={label(settings, 'Settings sections', '設定分類')}>
        {SETTINGS_SUB_TABS.map((row) => (
          <button
            key={row.id}
            id={`sub-tab-${row.id}`}
            role="tab"
            aria-selected={subTab === row.id}
            aria-controls="settings-panel"
            tabIndex={subTab === row.id ? 0 : -1}
            disabled={counts[row.id] === 0 && subTab !== row.id}
            onClick={() => onSubTab(row.id)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowRight') { event.preventDefault(); moveSubTab(1); }
              if (event.key === 'ArrowLeft') { event.preventDefault(); moveSubTab(-1); }
            }}
          >
            <Icon>{row.icon}</Icon>{label(settings, row.en, row.yue)}
          </button>
        ))}
      </div>
      <SearchBox
        surface={subTab}
        placeholder={label(settings, 'Search every setting on this section', '搵呢個分類嘅設定')}
        openBuilder={regexRequest === subTab}
        onBuilderHandled={onRegexHandled}
      />
      <div id="settings-panel" role="tabpanel" aria-labelledby={`sub-tab-${subTab}`}>
        {counts[subTab] === 0 && (
          <div className="empty-state" {...el('empty-state')}><Icon>search_off</Icon><h2>{label(settings, 'No matching setting', '冇配到嘅設定')}</h2><p>{label(settings, 'Clear this section search to see every control again.', '清除呢個分類嘅搜尋就會再見到所有設定。')}</p></div>
        )}
        {subTab === 'settings.general' && counts[subTab] > 0 && (
          <section className="settings-grid">
            <div className="settings-card" {...el('settings-card')}>
              <h2>Language &amp; voice · 語言同語氣</h2>
              {fieldsFor('general').map(renderField)}
              <p className="supporting">Funny levels style all messages, including warnings and errors, but never change facts. You can reset them any time.</p>
              <p className="supporting">Spoken narrator is optional and off by default. It uses this device’s browser speech service only; it never sends notification text over the network. It yields to a connected accessibility integration, stays quiet during quiet hours or reduced-sound mode, and may be unavailable when the platform has no speech service.</p>
              <p className="supporting">Automatic source repair gives OpenCode blanket tool approval only inside an attested disposable environment with no host mounts, user profile, credentials, secrets, or Git metadata. The app fails closed when that isolation is unavailable. This consent is persisted and can be revoked here; ordinary release installation never invokes OpenCode.</p>
            </div>
            <div className="settings-actions">
              <button className="text-button" onClick={() => setDraft(defaultSettings)}>Reset</button>
              <button className="text-button" onClick={downloadSettings}><Icon>download</Icon>Export settings</button>
              <button className="text-button" disabled={!isExternalEditorBridgeAvailable()} onClick={() => void openSettingsInCode()} title={isExternalEditorBridgeAvailable() ? undefined : 'Unavailable: no validated Visual Studio Code adapter.'}><Icon>code</Icon>Open settings in VS Code</button>
              <button className="filled-button" onClick={() => onSave(draft)}>Save settings</button>
            </div>
          </section>
        )}
        {subTab === 'settings.appearance' && counts[subTab] > 0 && (
          <>
            <section className="settings-grid">
              <div className="settings-card" {...el('settings-card')}>
                <h2>Appearance · 外觀</h2>
                {fieldsFor('appearance').map(renderField)}
                <p className="supporting">Display name changes labels only. Package identity, update feed, and data location never move.</p>
              </div>
              <div className="settings-actions">
                <button className="text-button" onClick={() => setDraft(defaultSettings)}>Reset</button>
                <button className="text-button" onClick={downloadSettings}><Icon>download</Icon>Export settings</button>
                <button className="text-button" disabled={!isExternalEditorBridgeAvailable()} onClick={() => void openSettingsInCode()} title={isExternalEditorBridgeAvailable() ? undefined : 'Unavailable: no validated Visual Studio Code adapter.'}><Icon>code</Icon>Open settings in VS Code</button>
                <button className="filled-button" onClick={() => onSave(draft)}>Save settings</button>
              </div>
            </section>
            <AppearanceEditor settings={settings} workspace={workspace} appearance={appearance} notify={notify} matcher={matcher} />
          </>
        )}
        {subTab === 'settings.schedule' && counts[subTab] > 0 && <ScheduleEditor settings={settings} schedule={schedule} />}
        {subTab === 'settings.about' && counts[subTab] > 0 && (
          <>
            <section className="settings-grid">
              {ABOUT_ROWS.filter((row) => matcher(`${row.en}\n${row.yue}\n${aboutRowBody(row, settings.displayName)}`)).map((row) => (
                <div className="settings-card" key={row.en} {...el('settings-card')}>
                  <h2>{label(settings, row.en, row.yue)}</h2>
                  <p className="supporting">{aboutRowBody(row, settings.displayName)}</p>
                </div>
              ))}
              {matcher('external editor Visual Studio Code VS Code exports') && <ExternalEditorSettings settings={settings} notify={notify} />}
            </section>
            {matcher('changelog releases versions dates commits') && <ChangelogViewer settings={settings} notify={notify} openRegex={regexRequest === 'changelog'} onRegexHandled={onRegexHandled} />}
          </>
        )}
      </div>
    </>
  );
}
