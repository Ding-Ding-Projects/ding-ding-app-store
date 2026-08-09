import type { OperationResult } from '../shared/contracts';

export function isCommitNavigationAvailable(): boolean {
  return Boolean(window.dingDingStore.externalNavigation);
}

export async function openCommit(commit: string): Promise<OperationResult> {
  if (!/^[0-9a-f]{40}$/i.test(commit)) return { ok: false, appId: 'ding-ding-app-store', message: 'The commit identifier must be a full 40-character hexadecimal SHA.', messageYue: 'Commit 識別碼必須係完整 40 位十六進制 SHA。' };
  const bridge = window.dingDingStore.externalNavigation;
  if (!bridge) return { ok: false, appId: 'ding-ding-app-store', message: 'Opening commit links is unavailable in this build. Copy the commit URL instead.', messageYue: '呢個版本未能開啟 commit 連結；請改為複製 commit URL。' };
  return bridge.openCommit(commit);
}

export function commitUrl(commit: string): string {
  return `https://github.com/Ding-Ding-Projects/ding-ding-app-store/commit/${commit}`;
}
