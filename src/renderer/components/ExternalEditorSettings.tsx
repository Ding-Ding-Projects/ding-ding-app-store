import { useEffect, useState } from 'react';
import type { ExternalEditorCandidate, UserSettings } from '../../shared/contracts';
import { addValidatedExternalEditor, detectExternalEditors, isExternalEditorBridgeAvailable, loadExternalEditorPreference, setExternalEditorPreference } from '../external-editor';
import { Icon } from '../icons';
import { label } from '../i18n';
import type { Notify } from '../notify';

export function ExternalEditorSettings({ settings, notify }: { settings: UserSettings; notify: Notify }) {
  const [candidates, setCandidates] = useState<ExternalEditorCandidate[]>([]);
  const [checking, setChecking] = useState(true);
  const [preferred, setPreferred] = useState<ExternalEditorCandidate['edition']>('stable');
  const refresh = async () => { setChecking(true); try { setCandidates(await detectExternalEditors()); } finally { setChecking(false); } };
  useEffect(() => { void Promise.all([refresh(), loadExternalEditorPreference().then((value) => setPreferred(value.edition))]); }, []);
  const vscode = candidates.find((candidate) => candidate.id === 'vscode' && candidate.edition === preferred) ?? candidates.find((candidate) => candidate.id === 'vscode');
  const bridgeAvailable = isExternalEditorBridgeAvailable();
  const choose = async (edition: ExternalEditorCandidate['edition']) => {
    setPreferred(edition);
    const saved = await setExternalEditorPreference(edition);
    if (saved.edition !== edition) notify({ ok: false, message: label(settings, 'The Visual Studio Code preference could not be saved; the app will continue using its validated fallback.', 'Visual Studio Code 偏好未能儲存；程式會繼續用已驗證嘅後備選擇。') });
    await refresh();
  };
  const add = async () => {
    const added = await addValidatedExternalEditor();
    if (!added) { notify({ ok: false, message: label(settings, 'No validated Visual Studio Code executable was selected. Choose Code.exe or Code - Insiders.exe from the native picker.', '未有揀到已驗證嘅 Visual Studio Code 執行檔；請用原生選擇器揀 Code.exe 或 Code - Insiders.exe。') }); return; }
    setPreferred(added.edition);
    setCandidates((current) => [...current.filter((candidate) => candidate.edition !== 'portable'), added]);
    notify({ ok: true, message: label(settings, `${added.label} is now the selected export editor.`, `而家用 ${added.label} 做匯出編輯器。`) });
  };
  return (
    <section className="settings-card external-editor-settings" aria-labelledby="external-editor-title">
      <h2 id="external-editor-title">{label(settings, 'External editor', '外置編輯器')}</h2>
      <p className="supporting">{label(settings, 'Exports are written to an app-owned workspace folder and opened as a VS Code workspace. The renderer never supplies an executable path or shell command; the main process validates PATH, stable, Insiders, and explicitly selected portable builds.', '匯出檔案會寫入程式自己擁有嘅工作區資料夾，再以 VS Code 工作區開啟。Renderer 永遠唔會提供執行檔路徑或者 shell 指令；主程序會驗證 PATH、Stable、Insiders 同明確揀選嘅 portable 版本。')}</p>
      <label htmlFor="external-editor-edition">{label(settings, 'Preferred VS Code edition', '偏好 VS Code 版本')}<select id="external-editor-edition" aria-label={label(settings, 'Preferred VS Code edition', '偏好 VS Code 版本')} value={preferred} onChange={(event) => void choose(event.target.value as ExternalEditorCandidate['edition'])}><option value="stable">{label(settings, 'Visual Studio Code · Stable', 'Visual Studio Code · Stable')}</option><option value="insiders">{label(settings, 'Visual Studio Code · Insiders', 'Visual Studio Code · Insiders')}</option><option value="portable">{label(settings, 'Visual Studio Code · Portable', 'Visual Studio Code · Portable')}</option><option value="unknown">{label(settings, 'Validated fallback', '已驗證後備選擇')}</option></select></label>
      <div className={`editor-status ${vscode?.available ? 'available' : 'unavailable'}`} role="status"><Icon>{vscode?.available ? 'check_circle' : 'info'}</Icon><span>{checking ? label(settings, 'Checking for Visual Studio Code…', '檢查緊 Visual Studio Code…') : vscode?.available ? label(settings, `${vscode.label} (${vscode.edition}) is available.`, `${vscode.label}（${vscode.edition}）可用。`) : label(settings, 'Visual Studio Code opening is unavailable in this build. Exports still download normally.', '呢個版本未能開啟 Visual Studio Code；匯出仍然可以正常下載。')}</span></div>
      <div className="card-actions"><button className="text-button" disabled={checking || !bridgeAvailable} title={bridgeAvailable ? undefined : label(settings, 'Unavailable: this build has no reviewed Visual Studio Code adapter.', '未能使用：呢個版本冇已審核嘅 Visual Studio Code adapter。')} onClick={() => void refresh()}><Icon>refresh</Icon>{bridgeAvailable ? label(settings, 'Detect again', '再檢查') : label(settings, 'Detection unavailable', '未能檢查')}</button><button className="text-button" disabled={!bridgeAvailable} onClick={() => void add()} title={label(settings, 'Choose Code.exe or Code - Insiders.exe with the native file picker.', '請用原生選擇器揀 Code.exe 或 Code - Insiders.exe。')}><Icon>folder_open</Icon>{label(settings, 'Add validated VS Code', '加入已驗證 VS Code')}</button>{!vscode?.available && <button className="text-button" onClick={() => void navigator.clipboard.writeText('https://code.visualstudio.com/Download').then(() => notify({ ok: true, message: label(settings, 'Copied the Visual Studio Code download URL.', '已複製 Visual Studio Code 下載網址。') }), (error: unknown) => notify({ ok: false, message: (error as Error).message }))}>{label(settings, 'Copy VS Code download URL', '複製 VS Code 下載網址')} <Icon>content_copy</Icon></button>}</div>
    </section>
  );
}
