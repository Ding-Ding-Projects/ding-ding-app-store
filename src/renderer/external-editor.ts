import type { ExternalEditorCandidate, ExternalEditorOpenRequest, ExternalEditorResult } from '../shared/contracts';

export const EXTERNAL_EDITOR_PREFERENCE_KEY = 'ding-ding-app-store.external-editor.v1';

export async function detectExternalEditors(): Promise<ExternalEditorCandidate[]> {
  const bridge = window.dingDingStore.externalEditor;
  if (!bridge) return [{ id: 'vscode', label: 'Visual Studio Code', available: false, edition: 'unknown' }];
  try { return await bridge.detect(); }
  catch { return [{ id: 'vscode', label: 'Visual Studio Code', available: false, edition: 'unknown' }]; }
}

export async function openExportInVsCode(request: Omit<ExternalEditorOpenRequest, 'editor'>): Promise<ExternalEditorResult> {
  const bridge = window.dingDingStore.externalEditor;
  if (!bridge) {
    return { ok: false, reason: 'bridge-unavailable', message: 'Opening exports in Visual Studio Code is unavailable in this build. The privileged adapter has not been implemented, so no path or command was guessed.' };
  }
  return bridge.openExport({ ...request, editor: 'vscode' });
}
