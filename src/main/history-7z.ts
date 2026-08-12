import { history7zRequestSchema, type History7zExportResult, type History7zRequest } from '../shared/contracts.js';

/** Typed fail-closed boundary until an approved in-process 7z encoder is declared. */
export function createHistory7zUnavailable(request: History7zRequest): History7zExportResult {
  history7zRequestSchema.parse(request);
  return {
    ok: false,
    format: '7z',
    filename: 'ding-ding-app-store-history.7z',
    mime: 'application/x-7z-compressed',
    reason: 'dependency-unavailable',
    message: '7z export is unavailable because this build has no approved in-process 7z dependency. Use ZIP export instead; no external executable was started.',
    messageYue: '7z 匯出暫時未能使用，因為呢個版本未有已審核嘅內置 7z 依賴。請改用 ZIP 匯出；程式冇啟動任何外部執行檔。',
  };
}
