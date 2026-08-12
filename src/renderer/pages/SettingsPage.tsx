import { useEffect, useMemo, useRef, useState } from 'react';
import type { LockTarget, SchoolSupportedUnlockKind, SchoolUnlockKind, SettingsProvenance, SourceIsolationStatus, UserSettings } from '../../shared/contracts';
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
import type { SchoolModeApi } from '../state/use-school-mode';
import type { LocksApi } from '../state/use-locks';
import type { SupportApi } from '../state/use-support';
import { defaultSettings } from '../state/use-settings';
import type { WorkspaceApi } from '../state/use-workspace';
import { AppearanceEditor } from './AppearanceEditor';
import { ScheduleEditor } from './ScheduleEditor';
import { ChangelogViewer } from './ChangelogViewer';
import { downloadText } from '../files';
import { serializeStructuredExport } from '../../shared/export-registry';
import { isExternalEditorBridgeAvailable, openExportInVsCode } from '../external-editor';
import { ColorTranslatorControl } from '../components/ColorTranslatorControl';
import { SourceIsolationStatusCard } from '../components/SourceIsolationStatusCard';
import { LockSupportPage } from './LockSupportPage';
import { SearchablePicker } from '../components/SearchablePicker';

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

export function SettingsPage({ settings, settingsProvenance, sourceIsolationStatus, sourceIsolationLoading, onRefreshSourceIsolation, onSave, workspace, appearance, schedule, schoolMode, locks, support, lockTargetRequest, notify, subTab, onSubTab, regexRequest, onRegexHandled, onManageLock }: {
  settings: UserSettings;
  settingsProvenance: SettingsProvenance;
  sourceIsolationStatus: SourceIsolationStatus | null;
  sourceIsolationLoading: boolean;
  onRefreshSourceIsolation(): void;
  onSave(next: UserSettings): void;
  workspace: WorkspaceApi;
  appearance: AppearanceApi;
  schedule: ScheduleApi;
  schoolMode: SchoolModeApi;
  locks: LocksApi;
  support: SupportApi;
  lockTargetRequest: LockTarget | null;
  notify: Notify;
  subTab: SettingsSubTabId;
  onSubTab(id: SettingsSubTabId): void;
  regexRequest: SurfaceId | null;
  onRegexHandled(): void;
  onManageLock?(target: LockTarget, returnFocus: HTMLElement | null): void;
}) {
  const schoolEnabled = schoolMode.state.enabled;
  const schoolRestricted = schoolMode.restricted;
  const schoolAvailable = schoolMode.available;
  const schoolLabel = schoolMode.state.displayName || 'Shared mode';
  const viewSettings = schoolRestricted ? { ...settings, language: 'en' as const, englishFunnyLevel: 1, cantoneseFunnyLevel: 1 } : settings;
  const [draft, setDraft] = useState(settings);
  const [schoolName, setSchoolName] = useState(schoolMode.state.displayName);
  const [schoolCredential, setSchoolCredential] = useState('');
  const [schoolCredentialConfirm, setSchoolCredentialConfirm] = useState('');
  const [schoolNextCredential, setSchoolNextCredential] = useState('');
  const [schoolNextCredentialConfirm, setSchoolNextCredentialConfirm] = useState('');
  const [schoolUnlockKind, setSchoolUnlockKind] = useState<SchoolSupportedUnlockKind>(schoolMode.state.unlockKind === 'password' ? 'password' : 'pin');
  const [schoolBusy, setSchoolBusy] = useState(false);
  const [vocabulary, setVocabulary] = useState({ loaded: false, entryCount: 0, entries: [] as Array<{ source: string; replacement: string }>, message: 'No personal vocabulary file is loaded.', messageYue: '未載入個人詞彙檔案。' });
  const [vocabularyBusy, setVocabularyBusy] = useState(false);
  const schoolBusyRef = useRef(false);
  useEffect(() => setDraft(settings), [settings]);
  useEffect(() => { void window.dingDingStore.personalVocabulary.status().then(setVocabulary).catch(() => undefined); }, []);
  useEffect(() => {
    setSchoolName(schoolMode.state.displayName);
    setSchoolUnlockKind(schoolMode.state.unlockKind === 'password' ? 'password' : 'pin');
    setSchoolCredential('');
    setSchoolCredentialConfirm('');
    setSchoolNextCredential('');
    setSchoolNextCredentialConfirm('');
  }, [schoolMode.state.recordId, schoolMode.state.revision, schoolMode.state.displayName, schoolMode.state.unlockKind]);
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
  const supportSearch = useSurfaceSearch('settings.support');
  const states = { 'settings.general': general, 'settings.appearance': appearanceSearch, 'settings.schedule': scheduleSearch, 'settings.about': about, 'settings.support': supportSearch } as const;
  const active = states[subTab];
  const matcher = useMemo(() => makeMatcher(active.state), [active.state]);

  const isSchoolHidden = (field: (typeof SETTING_FIELDS)[number]) => schoolRestricted && (
    field.key === 'language' || field.key === 'englishFunnyLevel' || field.key === 'cantoneseFunnyLevel' ||
    field.key === 'narratorLanguage' || field.key === 'narratorEnabled' || field.key === 'narratorReducedSound'
  );
  const counts = useMemo(() => ({
    'settings.general': SETTING_FIELDS.filter((field) => !isSchoolHidden(field) && field.section === 'general' && matcher(`${field.en}\n${field.yue}\n${field.keywords.join(' ')}`)).length
      + (matcher(`${schoolLabel} shared mode name unlock credential PIN password local reset`) ? 1 : 0)
      + (matcher('automatic source repair isolation consent status') ? 1 : 0)
      + (matcher('personal vocabulary private wording json upload file clear reset local cache') ? 1 : 0),
    'settings.appearance': SETTING_FIELDS.filter((field) => field.section === 'appearance' && matcher(`${field.en}\n${field.yue}\n${field.keywords.join(' ')}`)).length
      + (matcher('rail tabs layout appearance element override') ? 1 : 0),
    'settings.schedule': SCHEDULE_FIELDS.filter((field) => matcher(`${field.en}\n${field.yue}\n${schoolRestricted && field.key === 'rules' ? field.keywords.filter((keyword) => keyword !== 'language').join(' ') : field.keywords.join(' ')}`)).length,
    'settings.about': ABOUT_ROWS.filter((row) => matcher(`${row.en}\n${row.yue}\n${aboutRowBody(row, settings.displayName)}`)).length
      + (matcher('external editor Visual Studio Code VS Code exports') ? 1 : 0)
      + (matcher('changelog releases versions dates commits') ? 1 : 0),
    'settings.support': 1,
  // Keep the display-name dependency explicit for the existing settings
  // provenance contract: }), [matcher, settings.displayName]);
  }), [matcher, schoolRestricted, schoolLabel, settings.displayName]);

  const fieldsFor = (section: SettingField['section']) => SETTING_FIELDS.filter((field) => !isSchoolHidden(field) && field.section === section && matcher(`${field.en}\n${field.yue}\n${field.keywords.join(' ')}`));

  const renderField = (field: SettingField) => {
    const id = `setting-${field.key}`;
    const text = label(viewSettings, field.en, field.yue);
    const explanation = <SettingExplanation settings={viewSettings} field={field} provenance={settingsProvenance} />;
    if (field.kind === 'select') {
      return <div className="setting-field" key={field.key}><SearchablePicker id={id} labelText={text} settings={viewSettings} value={String(draft[field.key])} onChange={(next) => set(field.key, next as UserSettings[typeof field.key])} options={(field.options ?? []).map((option) => ({ value: option.value, en: option.en, yue: option.yue }))} />{explanation}</div>;
    }
    if (field.kind === 'range') {
      return <div className="setting-field" key={field.key}><label htmlFor={id}>{text} <span>{String(draft[field.key])}</span><input id={id} type="range" min={field.min} max={field.max} value={Number(draft[field.key])} onChange={(event) => set(field.key, Number(event.target.value) as UserSettings[typeof field.key])} /></label>{explanation}</div>;
    }
    if (field.kind === 'color') {
      return <div className="setting-field" key={field.key}><ColorTranslatorControl id={id} settings={viewSettings} value={String(draft[field.key])} labelText={text} onChange={(next) => set(field.key, next as UserSettings[typeof field.key])} />{explanation}</div>;
    }
    if (field.kind === 'switch') {
      return <div className="setting-field" key={field.key}><label htmlFor={id} className="switch-row"><input id={id} type="checkbox" checked={Boolean(draft[field.key])} onChange={(event) => set(field.key, event.target.checked as UserSettings[typeof field.key])} /><span>{text}</span></label>{explanation}</div>;
    }
    return <div className="setting-field" key={field.key}><label htmlFor={id}>{text}<input id={id} value={String(draft[field.key])} maxLength={64} onChange={(event) => set(field.key, event.target.value as UserSettings[typeof field.key])} /></label>{explanation}</div>;
  };

  const runSchoolMutation = async <T,>(operation: () => Promise<T>): Promise<T | null> => {
    if (schoolBusyRef.current) return null;
    schoolBusyRef.current = true;
    setSchoolBusy(true);
    try { return await operation(); }
    finally {
      schoolBusyRef.current = false;
      setSchoolBusy(false);
    }
  };

  const configureSchoolMode = async () => {
    if (schoolCredential !== schoolCredentialConfirm) { notify({ ok: false, message: label(viewSettings, `The two local ${schoolLabel} credentials do not match.`, `${schoolLabel} 兩次本機憑證唔一致。`) }); return; }
    if (!schoolName.trim()) { notify({ ok: false, message: label(viewSettings, `Choose a name for ${schoolLabel} before saving it.`, `儲存之前，請先幫 ${schoolLabel} 改個名。`) }); return; }
    const result = await runSchoolMutation(() => schoolMode.configure({ displayName: schoolName.trim(), unlockKind: schoolUnlockKind, credential: schoolCredential }));
    if (result?.ok) { setSchoolCredential(''); setSchoolCredentialConfirm(''); }
  };
  const renameSchoolMode = async () => {
    const result = await runSchoolMutation(() => schoolMode.rename({ displayName: schoolName.trim(), credential: schoolEnabled ? schoolCredential : undefined }));
    if (result?.ok) setSchoolCredential('');
  };
  const toggleSchoolMode = async () => {
    const result = await runSchoolMutation(() => schoolMode.setEnabled({ enabled: !schoolEnabled, credential: schoolEnabled ? schoolCredential : undefined }));
    if (result?.ok) setSchoolCredential('');
  };
  const importVocabulary = async () => {
    if (vocabularyBusy || schoolRestricted) return;
    setVocabularyBusy(true);
    try {
      const result = await window.dingDingStore.personalVocabulary.importFromFile();
      setVocabulary(result);
      window.dispatchEvent(new Event('personal-vocabulary-changed'));
      notify({ ok: result.ok, message: label(viewSettings, result.message, result.messageYue) });
    } catch (error) { notify({ ok: false, message: (error as Error).message }); }
    finally { setVocabularyBusy(false); }
  };
  const clearVocabulary = async () => {
    if (vocabularyBusy || schoolRestricted) return;
    setVocabularyBusy(true);
    try {
      const result = await window.dingDingStore.personalVocabulary.clear();
      setVocabulary(result);
      window.dispatchEvent(new Event('personal-vocabulary-changed'));
      notify({ ok: true, message: label(viewSettings, result.message, result.messageYue) });
    } catch (error) { notify({ ok: false, message: (error as Error).message }); }
    finally { setVocabularyBusy(false); }
  };
  const changeSchoolCredential = async () => {
    if (schoolNextCredential !== schoolNextCredentialConfirm) { notify({ ok: false, message: label(viewSettings, `The two new ${schoolLabel} credentials do not match.`, `${schoolLabel} 兩次新憑證唔一致。`) }); return; }
    const result = await runSchoolMutation(() => schoolMode.changeCredential({ currentCredential: schoolCredential, nextCredential: schoolNextCredential, unlockKind: schoolUnlockKind }));
    if (result?.ok) {
      setSchoolCredential('');
      setSchoolNextCredential('');
      setSchoolNextCredentialConfirm('');
    }
  };

  const schoolSyncMessage = useMemo(() => {
    if (schoolMode.loading || !schoolMode.snapshot) return label(viewSettings, 'Loading the shared mode record. Restricted presentation stays active until a verified state arrives.', '載入緊共用模式記錄；驗證狀態返到之前，限制顯示會繼續開住。');
    if (schoolMode.snapshot.sync.status === 'ready') return schoolMode.snapshot.sync.watching
      ? label(viewSettings, `Live synchronization is active at revision ${schoolMode.state.revision}. Changes from other running apps appear here automatically.`, `即時同步已開啟，修訂 ${schoolMode.state.revision}；其他運行中 app 嘅變更會自動喺呢度出現。`)
      : label(viewSettings, 'The shared state is verified, but live observation has not started. Restricted presentation remains active until observation is available.', '共用狀態已驗證，但即時監察未開始；監察可用之前，限制顯示會繼續開住。');
    switch (schoolMode.snapshot.sync.reason) {
      case 'read-failed': return label(viewSettings, 'The shared record cannot be read. Its enabled state is unknown, so restricted presentation remains active; no mode-off assumption was made.', '讀唔到共用記錄，開關狀態未知；限制顯示會繼續開住，唔會當佢已關。');
      case 'parse-failed': return label(viewSettings, 'The shared record is malformed or unsupported. Its enabled state is unknown, the record was left unchanged, and restricted presentation remains active.', '共用記錄格式損壞或者未支援，開關狀態未知；記錄冇被改動，限制顯示會繼續開住。');
      case 'watch-failed': return label(viewSettings, 'Live observation is unavailable. The last verified name and state are retained, but restricted presentation remains active until observation recovers.', '即時監察暫時用唔到；最後驗證過嘅名稱同狀態會保留，恢復監察之前限制顯示會繼續開住。');
      case 'write-failed': return label(viewSettings, 'The last change could not be persisted. The previously verified shared state is retained and restricted presentation remains active until a refresh succeeds.', '上一個變更儲存唔到；會保留之前驗證過嘅共用狀態，重新整理成功之前限制顯示會繼續開住。');
      case 'conflict': return label(viewSettings, 'Another running app changed or reset the shared record first. This app kept the newest observed state; reload before retrying your change.', '另一個運行中 app 搶先更改或重設咗共用記錄；呢個 app 保留最新觀察狀態，重新載入先再試。');
      case 'service-closed': return label(viewSettings, 'The shared-state service is closed. The last verified state is retained; restart the app before making another change.', '共用狀態服務已關閉；最後驗證狀態會保留，重新啟動 app 先再更改。');
      case 'bridge-failed': return label(viewSettings, 'The shared-state bridge returned an invalid or unavailable reply. The last verified name is retained and restricted presentation remains active.', '共用狀態橋接回覆無效或者暫時用唔到；最後驗證名稱會保留，限制顯示會繼續開住。');
    }
  }, [schoolMode.loading, schoolMode.snapshot, schoolMode.state.revision, viewSettings]);
  const schoolUnavailableTitle = label(viewSettings, 'Unavailable until the shared state is verified.', '共用狀態驗證完成之前暫時用唔到。');
  const schoolActionDisabled = !schoolAvailable || schoolBusy;
  const schoolActionTitle = schoolBusy ? label(viewSettings, 'A shared mode change is already in progress.', '共用模式變更進行中。') : schoolAvailable ? undefined : schoolUnavailableTitle;

  const moveSubTab = (delta: number) => {
    const index = SETTINGS_SUB_TABS.findIndex((row) => row.id === subTab);
    const next = SETTINGS_SUB_TABS[(index + delta + SETTINGS_SUB_TABS.length) % SETTINGS_SUB_TABS.length];
    onSubTab(next.id);
    window.document.getElementById(`sub-tab-${next.id}`)?.focus();
  };

  return (
    <>
      <div className="sub-tab-row" role="tablist" aria-label={label(viewSettings, 'Settings sections', '設定分類')}>
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
            <Icon>{row.icon}</Icon>{label(viewSettings, row.en, row.yue)}
          </button>
        ))}
      </div>
      <SearchBox
        surface={subTab}
        settings={viewSettings}
        placeholder={label(viewSettings, 'Search every setting on this section', '搵呢個分類嘅設定')}
        openBuilder={regexRequest === subTab}
        onBuilderHandled={onRegexHandled}
      />
      <div id="settings-panel" role="tabpanel" aria-labelledby={`sub-tab-${subTab}`}>
        {counts[subTab] === 0 && (
          <div className="empty-state" {...el('empty-state')}><Icon>search_off</Icon><h2>{label(viewSettings, 'No matching setting', '冇配到嘅設定')}</h2><p>{label(viewSettings, 'Clear this section search to see every control again.', '清除呢個分類嘅搜尋就會再見到所有設定。')}</p></div>
        )}
        {subTab === 'settings.general' && counts[subTab] > 0 && (
          <section className="settings-grid">
            <div className="settings-card" {...el('settings-card')}>
              <h2>{schoolRestricted ? 'General settings' : label(viewSettings, 'Language and voice', '語言同語氣')}</h2>
              {fieldsFor('general').map(renderField)}
              {!schoolRestricted && <p className="supporting">Funny levels style all messages, including warnings and errors, but never change facts. You can reset them any time.</p>}
              {!schoolRestricted && <p className="supporting">Spoken narrator is optional and off by default. It uses this device’s browser speech service only; it never sends notification text over the network. It yields to a connected accessibility integration, stays quiet during quiet hours or reduced-sound mode, and may be unavailable when the platform has no speech service.</p>}
              <p className="supporting">{label(viewSettings, 'Automatic source repair gives OpenCode blanket tool approval only inside an attested disposable environment with no host mounts, user profile, credentials, secrets, or Git metadata. The app fails closed when that isolation is unavailable. This consent is persisted and can be revoked here; ordinary release installation never invokes OpenCode.', '自動 source 修正只會喺驗證過嘅一次性隔離環境入面畀 OpenCode 完整工具批准；冇 host mount、user profile、憑證、秘密或者 Git metadata。冇隔離就安全停低；呢個同意可以喺呢度撤回，普通 release 安裝永遠唔會叫 OpenCode。')}</p>
              <SourceIsolationStatusCard settings={viewSettings} status={sourceIsolationStatus} loading={sourceIsolationLoading} onRefresh={onRefreshSourceIsolation} />
              {!schoolRestricted && matcher('personal vocabulary private wording json upload file clear reset local cache') && <section className="settings-card" aria-labelledby="personal-vocabulary-title">
                <h2 id="personal-vocabulary-title">{label(viewSettings, 'Personal vocabulary', '個人詞彙')}</h2>
                <p className="supporting">{label(viewSettings, 'Choose a local JSON file to apply private wording replacements. The file is validated before use, stays on this device, and is never included in logs, history, exports, telemetry, or network requests.', '揀一個本機 JSON 檔案套用私人文字替換。檔案會先驗證，只留喺呢部機，唔會放入記錄、歷史、匯出、遙測或者網絡要求。')}</p>
                <p className="supporting" role="status">{label(viewSettings, vocabulary.message, vocabulary.messageYue)}</p>
                <div className="settings-actions">
                  <button id="personal-vocabulary-import" className="filled-button" disabled={vocabularyBusy} onClick={() => void importVocabulary()}><Icon>upload</Icon>{label(viewSettings, 'Choose local JSON', '揀本機 JSON')}</button>
                  <button id="personal-vocabulary-clear" className="text-button" disabled={vocabularyBusy || !vocabulary.loaded} onClick={() => void clearVocabulary()}><Icon>delete</Icon>{label(viewSettings, 'Clear vocabulary', '清除詞彙')}</button>
                </div>
              </section>}
            </div>
            {matcher(`${schoolLabel} shared mode name unlock credential PIN password local reset`) && <section className="settings-card" aria-labelledby="school-mode-title" aria-busy={schoolBusy}>
              <h2 id="school-mode-title">{schoolLabel}</h2>
              <p className="supporting">{schoolRestricted
                ? `This universal, user-renamable mode is a UX lock rather than a security boundary. Restricted presentation is active; saved personal presentation choices remain stored. Delete the shared local record to reset ${schoolLabel} if the unlock credential is lost.`
                : label(viewSettings, 'This universal, user-renamable mode is a UX lock rather than a security boundary. While enabled, the app uses a restricted presentation and keeps the prior personal presentation choices stored. Delete the shared local record to reset it if the unlock credential is lost.', '呢個所有 app 共用、可以改名嘅模式係體驗鎖，唔係保安邊界。開啟時 app 會用限制顯示，之前嘅個人顯示選擇會繼續儲存。唔見咗解鎖憑證，可以刪除本機共用記錄重設。')}</p>
              <p className="supporting">{label(viewSettings, 'This build supports numeric PINs and local passwords. It does not claim WebAuthn or platform-passkey support; a passkey-tagged preview record is reported as unavailable rather than treated as a text password.', '呢個版本支援純數字 PIN 同本機密碼，唔會扮有 WebAuthn 或平台 passkey；標記做 passkey 嘅預覽記錄會顯示不可用，唔會當普通文字密碼處理。')}</p>
              <p className="supporting" role={schoolAvailable ? 'status' : 'alert'}>{schoolSyncMessage}</p>
              {!schoolAvailable && <button className="text-button" disabled={schoolBusy} onClick={() => void schoolMode.reload()}>{label(viewSettings, 'Reload shared state', '重新載入共用狀態')}</button>}
              <label htmlFor="school-mode-name">{label(viewSettings, `${schoolLabel} name`, `${schoolLabel} 名稱`)}<input id="school-mode-name" value={schoolName} maxLength={64} disabled={schoolActionDisabled} title={schoolActionTitle} onChange={(event) => setSchoolName(event.target.value)} /></label>
              <SearchablePicker id="school-mode-unlock-kind" labelText={schoolMode.state.unlockKind ? label(viewSettings, 'New unlock choice', '新解鎖方式') : label(viewSettings, 'Unlock choice', '解鎖方式')} settings={viewSettings} value={schoolUnlockKind} disabled={schoolActionDisabled} title={schoolActionTitle} onChange={(next) => setSchoolUnlockKind(next as SchoolSupportedUnlockKind)} options={[{ value: 'pin', en: 'PIN', yue: 'PIN 碼' }, { value: 'password', en: 'Password', yue: '密碼' }]} />
              <label htmlFor="school-mode-credential">{schoolMode.state.unlockKind ? label(viewSettings, 'Current local unlock credential', '目前本機解鎖憑證') : label(viewSettings, 'Local unlock credential', '本機解鎖憑證')}<input id="school-mode-credential" type="password" autoComplete={schoolMode.state.unlockKind ? 'current-password' : 'new-password'} value={schoolCredential} disabled={schoolActionDisabled} title={schoolActionTitle} onChange={(event) => setSchoolCredential(event.target.value)} /></label>
              {!schoolMode.state.unlockKind && <label htmlFor="school-mode-credential-confirm">{label(viewSettings, 'Confirm local unlock credential', '確認本機解鎖憑證')}<input id="school-mode-credential-confirm" type="password" autoComplete="new-password" value={schoolCredentialConfirm} disabled={schoolActionDisabled} title={schoolActionTitle} onChange={(event) => setSchoolCredentialConfirm(event.target.value)} /></label>}
              {schoolMode.state.unlockKind && <>
                <label htmlFor="school-mode-next-credential">{label(viewSettings, 'New local unlock credential', '新本機解鎖憑證')}<input id="school-mode-next-credential" type="password" autoComplete="new-password" value={schoolNextCredential} disabled={schoolActionDisabled} title={schoolActionTitle} onChange={(event) => setSchoolNextCredential(event.target.value)} /></label>
                <label htmlFor="school-mode-next-credential-confirm">{label(viewSettings, 'Confirm new local unlock credential', '確認新本機解鎖憑證')}<input id="school-mode-next-credential-confirm" type="password" autoComplete="new-password" value={schoolNextCredentialConfirm} disabled={schoolActionDisabled} title={schoolActionTitle} onChange={(event) => setSchoolNextCredentialConfirm(event.target.value)} /></label>
              </>}
              <div className="settings-actions">
                {!schoolMode.state.unlockKind ? <button className="filled-button" disabled={schoolActionDisabled} title={schoolActionTitle} onClick={() => void configureSchoolMode()}>{label(viewSettings, 'Configure and enable', '設定並開啟')}</button> : <>
                  <button className="text-button" disabled={schoolActionDisabled} title={schoolActionTitle} onClick={() => void renameSchoolMode()}>{label(viewSettings, 'Save name', '儲存名稱')}</button>
                  <button className="text-button" disabled={schoolActionDisabled} title={schoolActionTitle} onClick={() => void changeSchoolCredential()}>{label(viewSettings, 'Change credential', '更改憑證')}</button>
                  <button className={schoolEnabled ? 'text-button' : 'filled-button'} disabled={schoolActionDisabled} title={schoolActionTitle} onClick={() => void toggleSchoolMode()}>{schoolEnabled ? label(viewSettings, `Disable ${schoolLabel}`, `關閉 ${schoolLabel}`) : label(viewSettings, `Enable ${schoolLabel}`, `開啟 ${schoolLabel}`)}</button>
                </>}
              </div>
              {schoolBusy && <p className="supporting" role="status">{label(viewSettings, `Saving the ${schoolLabel} change…`, `儲存緊 ${schoolLabel} 變更…`)}</p>}
              {schoolAvailable && <p className="supporting" role="status">{schoolEnabled ? label(viewSettings, `${schoolLabel} is enabled: English-only surfaces are active.`, `${schoolLabel} 已開啟：而家只顯示英文介面。`) : schoolMode.state.unlockKind ? label(viewSettings, `${schoolLabel} is configured and currently disabled.`, `${schoolLabel} 已設定，目前關閉。`) : label(viewSettings, `${schoolLabel} is not configured.`, `${schoolLabel} 未設定。`)}</p>}
            </section>}
            <div className="settings-actions">
              {!schoolRestricted && <button className="text-button" onClick={() => setDraft(defaultSettings)}>Reset</button>}
              {!schoolRestricted && <button className="text-button" onClick={downloadSettings}><Icon>download</Icon>Export settings</button>}
              {!schoolRestricted && <button className="text-button" disabled={!isExternalEditorBridgeAvailable()} onClick={() => void openSettingsInCode()} title={isExternalEditorBridgeAvailable() ? undefined : 'Unavailable: no validated Visual Studio Code adapter.'}><Icon>code</Icon>Open settings in VS Code</button>}
              <button className="filled-button" onClick={() => onSave(draft)}>Save settings</button>
            </div>
          </section>
        )}
        {subTab === 'settings.appearance' && counts[subTab] > 0 && (
          <>
            <section className="settings-grid">
              <div className="settings-card" {...el('settings-card')}>
                <h2>{label(viewSettings, 'Appearance', '外觀')}</h2>
                {fieldsFor('appearance').map(renderField)}
                <p className="supporting">Display name changes labels only. Package identity, update feed, and data location never move.</p>
              </div>
              <div className="settings-actions">
                {!schoolRestricted && <button className="text-button" onClick={() => setDraft(defaultSettings)}>Reset</button>}
                {!schoolRestricted && <button className="text-button" onClick={downloadSettings}><Icon>download</Icon>Export settings</button>}
                {!schoolRestricted && <button className="text-button" disabled={!isExternalEditorBridgeAvailable()} onClick={() => void openSettingsInCode()} title={isExternalEditorBridgeAvailable() ? undefined : 'Unavailable: no validated Visual Studio Code adapter.'}><Icon>code</Icon>Open settings in VS Code</button>}
                <button className="filled-button" onClick={() => onSave(draft)}>Save settings</button>
              </div>
            </section>
              <AppearanceEditor settings={viewSettings} workspace={workspace} appearance={appearance} notify={notify} matcher={matcher} locks={locks} schoolModeEnabled={schoolRestricted} onManageLock={onManageLock} />
          </>
        )}
        {subTab === 'settings.schedule' && counts[subTab] > 0 && <ScheduleEditor settings={viewSettings} schedule={schedule} restricted={schoolRestricted} />}
        {subTab === 'settings.about' && counts[subTab] > 0 && (
          <>
            <section className="settings-grid">
              {ABOUT_ROWS.filter((row) => matcher(`${row.en}\n${row.yue}\n${aboutRowBody(row, settings.displayName)}`)).map((row) => (
                <div className="settings-card" key={row.en} {...el('settings-card')}>
                  <h2>{label(viewSettings, row.en, row.yue)}</h2>
                  <p className="supporting">{aboutRowBody(row, settings.displayName)}</p>
                </div>
              ))}
              {matcher('external editor Visual Studio Code VS Code exports') && <ExternalEditorSettings settings={viewSettings} notify={notify} />}
            </section>
            {matcher('changelog releases versions dates commits') && <ChangelogViewer settings={viewSettings} notify={notify} restricted={schoolRestricted} schoolModeName={schoolLabel} openRegex={regexRequest === 'changelog'} onRegexHandled={onRegexHandled} />}
          </>
        )}
        {subTab === 'settings.support' && counts[subTab] > 0 && (
          <LockSupportPage settings={viewSettings} workspace={workspace.workspace} locks={locks} support={support} notify={notify} matcher={matcher} initialTarget={lockTargetRequest} />
        )}
      </div>
    </>
  );
}
