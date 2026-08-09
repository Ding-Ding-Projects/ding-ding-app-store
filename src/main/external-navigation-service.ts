import type { OperationResult } from '../shared/contracts.js';

const APP_ID = 'ding-ding-app-store';
const COMMIT_SHA = /^[0-9a-f]{40}$/i;
const COMMIT_URL_PREFIX = 'https://github.com/Ding-Ding-Projects/ding-ding-app-store/commit/';

export interface ExternalNavigationOpener {
  openExternal(url: string): Promise<void>;
}

/**
 * Opens only a commit in this repository. The renderer supplies a SHA, never a
 * URL, and the privileged boundary constructs the fixed allowlisted URL.
 */
export class ExternalNavigationService {
  constructor(private readonly opener: ExternalNavigationOpener | null) {}

  async openCommit(commit: unknown): Promise<OperationResult> {
    if (typeof commit !== 'string' || !COMMIT_SHA.test(commit)) {
      return {
        ok: false,
        appId: APP_ID,
        message: 'The commit identifier must be a full 40-character hexadecimal SHA.',
        messageYue: 'Commit 識別碼必須係完整 40 位十六進制 SHA。',
      };
    }
    if (!this.opener || typeof this.opener.openExternal !== 'function') {
      return {
        ok: false,
        appId: APP_ID,
        message: 'Opening commit links is unavailable in this build. Copy the commit URL instead.',
        messageYue: '呢個版本未能開啟 commit 連結；請改為複製 commit URL。',
      };
    }

    try {
      await this.opener.openExternal(`${COMMIT_URL_PREFIX}${commit}`);
      return {
        ok: true,
        appId: APP_ID,
        message: 'Commit link opened.',
        messageYue: '已開啟 commit 連結。',
      };
    } catch {
      return {
        ok: false,
        appId: APP_ID,
        message: 'The commit link could not be opened. Copy the commit URL instead.',
        messageYue: '未能開啟 commit 連結；請改為複製 commit URL。',
      };
    }
  }
}
