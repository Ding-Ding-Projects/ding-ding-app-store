/**
 * Renderer-only failure vocabulary for the registration bridge. Raw bridge or
 * parser errors are deliberately not surfaced: they can contain implementation
 * details and are not actionable copy for a user.
 */
export type AuthenticatorRegistrationAction = 'prepare' | 'confirm';
export type AuthenticatorRegistrationFailureReason = 'response-invalid' | 'transport' | 'unexpected';

export interface AuthenticatorRegistrationFailureNotice {
  action: AuthenticatorRegistrationAction;
  reason: AuthenticatorRegistrationFailureReason;
  title: string;
  titleYue: string;
  message: string;
  messageYue: string;
}

function errorDetails(error: unknown): { code: string; message: string } {
  if (!error || typeof error !== 'object') return { code: '', message: '' };
  const candidate = error as { code?: unknown; message?: unknown };
  return {
    code: typeof candidate.code === 'string' ? candidate.code.slice(0, 80) : '',
    message: typeof candidate.message === 'string' ? candidate.message.slice(0, 240) : '',
  };
}

export function classifyAuthenticatorRegistrationFailure(error: unknown): AuthenticatorRegistrationFailureReason {
  const details = errorDetails(error);
  if (/authenticator (registration|mutation) response was invalid/i.test(details.message)) return 'response-invalid';
  if (['ERR_IPC_CHANNEL_CLOSED', 'ERR_IPC_MESSAGE_TOO_LARGE', 'ERR_FAILED', 'ERR_ABORTED'].includes(details.code)
    || /\b(ipc|bridge|channel|transport|invoke|renderer process|webcontents|destroyed|disconnected)\b/i.test(`${details.code} ${details.message}`)) return 'transport';
  return 'unexpected';
}

const TITLES: Record<AuthenticatorRegistrationAction, { en: string; yue: string }> = {
  prepare: { en: 'Authenticator registration failed', yue: '驗證器註冊失敗' },
  confirm: { en: 'Authenticator confirmation needs review', yue: '驗證器確認要再檢查' },
};

const COPY: Record<AuthenticatorRegistrationAction, Record<AuthenticatorRegistrationFailureReason, { en: string; yue: string }>> = {
  prepare: {
    'response-invalid': {
      en: 'The authenticator registration response was invalid; the form and any existing preview are unchanged. The app attempted to clear this pending attempt. Wait for the list to settle before trying again.',
      yue: '驗證器註冊回應無效；表格同現有預覽保持不變。應用程式已嘗試清走呢次待處理嘅註冊。等清單穩定咗先再試。',
    },
    transport: {
      en: 'The authenticator registration service could not be reached; the form and any existing preview are unchanged. The app attempted to clear this pending attempt. Wait for the list to settle before trying again.',
      yue: '未能連到驗證器註冊服務；表格同現有預覽保持不變。應用程式已嘗試清走呢次待處理嘅註冊。等清單穩定咗先再試。',
    },
    unexpected: {
      en: 'The authenticator registration could not be prepared; the form and any existing preview are unchanged. The app attempted to clear this pending attempt. Wait for the list to settle before trying again.',
      yue: '未能準備驗證器註冊；表格同現有預覽保持不變。應用程式已嘗試清走呢次待處理嘅註冊。等清單穩定咗先再試。',
    },
  },
  confirm: {
    'response-invalid': {
      en: 'The authenticator confirmation result could not be verified; the pairing preview remains active, and the saved-entry list may already contain this entry. Refresh the list before retrying.',
      yue: '驗證器確認結果未能核實；配對預覽仍然有效，而已儲存項目清單可能已經有呢個項目。重整清單之後先再試。',
    },
    transport: {
      en: 'The authenticator confirmation service could not be reached; the pairing preview remains active, and the saved-entry list may already contain this entry. Refresh the list before retrying.',
      yue: '未能連到驗證器確認服務；配對預覽仍然有效，而已儲存項目清單可能已經有呢個項目。重整清單之後先再試。',
    },
    unexpected: {
      en: 'The authenticator confirmation could not be completed; the result is unverified, the pairing preview remains active, and the saved-entry list may already contain this entry. Refresh the list before retrying.',
      yue: '未能完成驗證器確認；結果未能核實，配對預覽仍然有效，而已儲存項目清單可能已經有呢個項目。重整清單之後先再試。',
    },
  },
};

export function authenticatorRegistrationFailureNotice(action: AuthenticatorRegistrationAction, error: unknown): AuthenticatorRegistrationFailureNotice {
  const reason = classifyAuthenticatorRegistrationFailure(error);
  const copy = COPY[action][reason];
  const title = TITLES[action];
  return { action, reason, title: title.en, titleYue: title.yue, message: copy.en, messageYue: copy.yue };
}
