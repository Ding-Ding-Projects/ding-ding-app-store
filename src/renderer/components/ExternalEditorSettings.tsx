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
    if (saved.edition !== edition) notify({ ok: false, message: 'The Visual Studio Code preference could not be saved; the app will continue using its validated fallback.' });
    await refresh();
  };
  const add = async () => {
    const added = await addValidatedExternalEditor();
    if (!added) { notify({ ok: false, message: 'No validated Visual Studio Code executable was selected. Choose Code.exe or Code - Insiders.exe from the native picker.' }); return; }
    setPreferred(added.edition);
    setCandidates((current) => [...current.filter((candidate) => candidate.edition !== 'portable'), added]);
    notify({ ok: true, message: `${added.label} is now the selected export editor.` });
  };
  return (
    <section className="settings-card external-editor-settings" aria-labelledby="external-editor-title">
      <h2 id="external-editor-title">{label(settings, 'External editor', '外置編輯器')}</h2>
      <p className="supporting">Exports are written to an app-owned workspace folder and opened as a VS Code workspace. The renderer never supplies an executable path or shell command; the main process validates PATH, stable, Insiders, and explicitly selected portable builds.</p>
      <label htmlFor="external-editor-edition">Preferred VS Code edition<select id="external-editor-edition" value={preferred} onChange={(event) => void choose(event.target.value as ExternalEditorCandidate['edition'])}><option value="stable">Visual Studio Code · Stable</option><option value="insiders">Visual Studio Code · Insiders</option><option value="portable">Visual Studio Code · Portable</option><option value="unknown">Validated fallback</option></select></label>
      <div className={`editor-status ${vscode?.available ? 'available' : 'unavailable'}`} role="status"><Icon>{vscode?.available ? 'check_circle' : 'info'}</Icon><span>{checking ? 'Checking for Visual Studio Code…' : vscode?.available ? `${vscode.label} (${vscode.edition}) is available.` : 'Visual Studio Code opening is unavailable in this build. Exports still download normally.'}</span></div>
      <div className="card-actions"><button className="text-button" disabled={checking || !bridgeAvailable} title={bridgeAvailable ? undefined : 'Unavailable: this build has no reviewed Visual Studio Code adapter.'} onClick={() => void refresh()}><Icon>refresh</Icon>{bridgeAvailable ? 'Detect again' : 'Detection unavailable'}</button><button className="text-button" disabled={!bridgeAvailable} onClick={() => void add()} title="Choose Code.exe or Code - Insiders.exe with the native file picker."><Icon>folder_open</Icon>Add validated VS Code</button>{!vscode?.available && <button className="text-button" onClick={() => void navigator.clipboard.writeText('https://code.visualstudio.com/Download').then(() => notify({ ok: true, message: 'Copied the Visual Studio Code download URL.' }), (error: unknown) => notify({ ok: false, message: (error as Error).message }))}>Copy VS Code download URL <Icon>content_copy</Icon></button>}</div>
    </section>
  );
}
