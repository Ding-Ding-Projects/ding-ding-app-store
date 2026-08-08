import type { OperationResult } from '../shared/contracts';

export function isCommitNavigationAvailable(): boolean {
  return Boolean(window.dingDingStore.externalNavigation);
}

export async function openCommit(commit: string): Promise<OperationResult> {
  if (!/^[0-9a-f]{40}$/.test(commit)) return { ok: false, appId: 'ding-ding-app-store', message: 'The commit identifier is invalid.' };
  const bridge = window.dingDingStore.externalNavigation;
  if (!bridge) return { ok: false, appId: 'ding-ding-app-store', message: 'Opening commit links is unavailable in this build. Copy the commit URL instead.' };
  return bridge.openCommit(commit);
}

export function commitUrl(commit: string): string {
  return `https://github.com/Ding-Ding-Projects/ding-ding-app-store/commit/${commit}`;
}
