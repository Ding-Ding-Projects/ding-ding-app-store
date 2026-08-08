import { useEffect, useState } from 'react';
import type { ExternalEditorCandidate, UserSettings } from '../../shared/contracts';
import { detectExternalEditors, EXTERNAL_EDITOR_PREFERENCE_KEY, isExternalEditorBridgeAvailable } from '../external-editor';
import { Icon } from '../icons';
import { label } from '../i18n';
import type { Notify } from '../notify';

export function ExternalEditorSettings({ settings, notify }: { settings: UserSettings; notify: Notify }) {
  const [candidates, setCandidates] = useState<ExternalEditorCandidate[]>([]);
  const [checking, setChecking] = useState(true);
  const [preferred, setPreferred] = useState(() => window.localStorage.getItem(EXTERNAL_EDITOR_PREFERENCE_KEY) ?? 'vscode');
  const refresh = async () => { setChecking(true); try { setCandidates(await detectExternalEditors()); } finally { setChecking(false); } };
  useEffect(() => { void refresh(); }, []);
  const vscode = candidates.find((candidate) => candidate.id === 'vscode');
  const bridgeAvailable = isExternalEditorBridgeAvailable();
  return (
    <section className="settings-card external-editor-settings" aria-labelledby="external-editor-title">
      <h2 id="external-editor-title">{label(settings, 'External editor', '外置編輯器')}</h2>
      <p className="supporting">Exports can be handed to Visual Studio Code only when a reviewed privileged adapter is present. Such an adapter can check the command, user and machine installs, Insiders, and portable builds without letting the renderer supply an executable or filesystem path. This build does not include that adapter.</p>
      <label>Preferred editor<select value={preferred} onChange={(event) => { setPreferred(event.target.value); window.localStorage.setItem(EXTERNAL_EDITOR_PREFERENCE_KEY, event.target.value); }}><option value="vscode">Visual Studio Code</option></select></label>
      <div className={`editor-status ${vscode?.available ? 'available' : 'unavailable'}`} role="status"><Icon>{vscode?.available ? 'check_circle' : 'info'}</Icon><span>{checking ? 'Checking for Visual Studio Code…' : vscode?.available ? `${vscode.label} (${vscode.edition}) is available.` : 'Visual Studio Code opening is unavailable in this build. Exports still download normally.'}</span></div>
      <div className="card-actions"><button className="text-button" disabled={checking || !bridgeAvailable} title={bridgeAvailable ? undefined : 'Unavailable: this build has no reviewed Visual Studio Code adapter.'} onClick={() => void refresh()}><Icon>refresh</Icon>{bridgeAvailable ? 'Detect again' : 'Detection unavailable'}</button>{!vscode?.available && <button className="text-button" onClick={() => void navigator.clipboard.writeText('https://code.visualstudio.com/Download').then(() => notify({ ok: true, message: 'Copied the Visual Studio Code download URL.' }), (error: unknown) => notify({ ok: false, message: (error as Error).message }))}>Copy VS Code download URL <Icon>content_copy</Icon></button>}</div>
    </section>
  );
}
