import { useEffect, useState } from 'react';
import type { ExternalEditorCandidate, UserSettings } from '../../shared/contracts';
import { detectExternalEditors, EXTERNAL_EDITOR_PREFERENCE_KEY } from '../external-editor';
import { Icon } from '../icons';
import { label } from '../i18n';

export function ExternalEditorSettings({ settings }: { settings: UserSettings }) {
  const [candidates, setCandidates] = useState<ExternalEditorCandidate[]>([]);
  const [checking, setChecking] = useState(true);
  const [preferred, setPreferred] = useState(() => window.localStorage.getItem(EXTERNAL_EDITOR_PREFERENCE_KEY) ?? 'vscode');
  const refresh = async () => { setChecking(true); try { setCandidates(await detectExternalEditors()); } finally { setChecking(false); } };
  useEffect(() => { void refresh(); }, []);
  const vscode = candidates.find((candidate) => candidate.id === 'vscode');
  return (
    <section className="settings-card external-editor-settings" aria-labelledby="external-editor-title">
      <h2 id="external-editor-title">{label(settings, 'External editor', '外置編輯器')}</h2>
      <p className="supporting">Exports can be handed to Visual Studio Code as a workspace-owned temporary file. Detection checks the command, user and machine installs, Insiders, and portable builds in the privileged process; the renderer never supplies an executable or filesystem path.</p>
      <label>Preferred editor<select value={preferred} onChange={(event) => { setPreferred(event.target.value); window.localStorage.setItem(EXTERNAL_EDITOR_PREFERENCE_KEY, event.target.value); }}><option value="vscode">Visual Studio Code</option></select></label>
      <div className={`editor-status ${vscode?.available ? 'available' : 'unavailable'}`} role="status"><Icon>{vscode?.available ? 'check_circle' : 'info'}</Icon><span>{checking ? 'Checking for Visual Studio Code…' : vscode?.available ? `${vscode.label} (${vscode.edition}) is available.` : 'Visual Studio Code opening is unavailable in this build. Exports still download normally.'}</span></div>
      <div className="card-actions"><button className="text-button" disabled={checking} onClick={() => void refresh()}><Icon>refresh</Icon>Detect again</button>{!vscode?.available && <a className="text-button" href="https://code.visualstudio.com/Download" target="_blank" rel="noreferrer">Download Visual Studio Code <Icon>open_in_new</Icon></a>}</div>
    </section>
  );
}
