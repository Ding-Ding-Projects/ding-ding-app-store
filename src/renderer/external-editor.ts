import type { ExternalEditorCandidate, ExternalEditorEdition, ExternalEditorOpenRequest, ExternalEditorPreference, ExternalEditorResult } from '../shared/contracts';

export const EXTERNAL_EDITOR_PREFERENCE_KEY = 'ding-ding-app-store.external-editor.v1';

export function isExternalEditorBridgeAvailable(): boolean {
  return Boolean(window.dingDingStore.externalEditor);
}

export async function detectExternalEditors(): Promise<ExternalEditorCandidate[]> {
  const bridge = window.dingDingStore.externalEditor;
  if (!bridge) return [{ id: 'vscode', label: 'Visual Studio Code', available: false, edition: 'unknown' }];
  try { return await bridge.detect(); }
  catch { return [{ id: 'vscode', label: 'Visual Studio Code', available: false, edition: 'unknown' }]; }
}

export async function loadExternalEditorPreference(): Promise<ExternalEditorPreference> {
  const bridge = window.dingDingStore.externalEditor;
  if (!bridge) return { editor: 'vscode', edition: 'unknown' };
  try { return await bridge.preference(); }
  catch { return { editor: 'vscode', edition: 'unknown' }; }
}

export async function setExternalEditorPreference(edition: ExternalEditorEdition): Promise<ExternalEditorPreference> {
  const bridge = window.dingDingStore.externalEditor;
  if (!bridge) return { editor: 'vscode', edition: 'unknown' };
  try { return await bridge.setPreference({ editor: 'vscode', edition }); }
  catch { return { editor: 'vscode', edition: 'unknown' }; }
}

export async function addValidatedExternalEditor(): Promise<ExternalEditorCandidate | null> {
  const bridge = window.dingDingStore.externalEditor;
  if (!bridge) return null;
  try { return await bridge.addValidated(); }
  catch { return null; }
}

export async function openExportInVsCode(request: Omit<ExternalEditorOpenRequest, 'editor'>): Promise<ExternalEditorResult> {
  const bridge = window.dingDingStore.externalEditor;
  if (!bridge) {
    return { ok: false, reason: 'bridge-unavailable', message: 'Opening exports in Visual Studio Code is unavailable in this build. The privileged adapter has not been implemented, so no path or command was guessed.' };
  }
  return bridge.openExport({ ...request, editor: 'vscode' });
}
