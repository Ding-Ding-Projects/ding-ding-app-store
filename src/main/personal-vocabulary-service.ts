import path from 'node:path';
import { lstat, open, unlink } from 'node:fs/promises';
import { app, dialog, type WebContents } from 'electron';
import { writeJsonAtomic } from './json-store.js';
import { parsePersonalVocabularyJson, PERSONAL_VOCABULARY_MAX_BYTES, type PersonalVocabularyDocument } from '../shared/personal-vocabulary.js';

export interface PersonalVocabularyStatus {
  loaded: boolean;
  entryCount: number;
  entries: Array<{ source: string; replacement: string }>;
  message: string;
  messageYue: string;
}

export type PersonalVocabularyImportResult = PersonalVocabularyStatus & { ok: boolean };

const EMPTY_STATUS: PersonalVocabularyStatus = {
  loaded: false,
  entryCount: 0,
  entries: [],
  message: 'No personal vocabulary file is loaded. Choose a local JSON file to enable private replacements.',
  messageYue: '未載入個人詞彙檔案。揀一個本機 JSON 檔案先可以啟用私人替換。',
};

export class PersonalVocabularyService {
  private readonly filePath: string;

  constructor(filePath = path.join(app.getPath('userData'), 'personal-vocabulary.v1.json')) {
    this.filePath = filePath;
  }

  async status(): Promise<PersonalVocabularyStatus> {
    const document = await this.readCache();
    return document
      ? { loaded: true, entryCount: document.entries.length, entries: document.entries.map((entry) => ({ ...entry })), message: `${document.entries.length} private vocabulary entries are active locally.`, messageYue: `而家本機啟用緊 ${document.entries.length} 項私人詞彙。` }
      : { ...EMPTY_STATUS };
  }

  async importFromPicker(sender: WebContents): Promise<PersonalVocabularyImportResult> {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Personal vocabulary JSON', extensions: ['json'] }],
      title: 'Choose a local personal vocabulary JSON file',
      defaultPath: undefined,
    });
    if (result.canceled || result.filePaths.length !== 1) return { ok: false, ...(await this.status()), message: 'No file was selected; the last valid vocabulary remains active.', messageYue: '未揀檔案；上一次有效詞彙會繼續啟用。' };
    if (!sender || sender.isDestroyed()) return { ok: false, ...(await this.status()), message: 'The vocabulary picker was closed before the file could be read.', messageYue: '詞彙揀檔案器關閉咗，未能讀取檔案。' };
    try {
      const bytes = await readBoundedBytes(result.filePaths[0]);
      const parsed = parsePersonalVocabularyJson(bytes);
      if (!parsed.ok) return { ok: false, ...(await this.status()), message: `The vocabulary file was rejected (${parsed.reason}); the last valid cache remains active.`, messageYue: `詞彙檔案被拒絕（${parsed.reason}）；上一次有效 cache 會繼續啟用。` };
      await writeJsonAtomic(this.filePath, parsed.document);
      const status = await this.status();
      return { ok: true, ...status, message: `${status.entryCount} private vocabulary entries loaded locally. Source path and file metadata were not saved.`, messageYue: `已喺本機載入 ${status.entryCount} 項私人詞彙；來源路徑同檔案資料冇被儲存。` };
    } catch {
      return { ok: false, ...(await this.status()), message: 'The vocabulary file could not be read safely; the last valid cache remains active.', messageYue: '未能安全讀取詞彙檔案；上一次有效 cache 會繼續啟用。' };
    }
  }

  async clear(): Promise<PersonalVocabularyStatus> {
    await unlink(this.filePath).catch(() => undefined);
    return { ...EMPTY_STATUS, message: 'Personal vocabulary was cleared. Original shipped wording is active again.', messageYue: '個人詞彙已清除，而家恢復出廠原文。' };
  }

  private async readCache(): Promise<PersonalVocabularyDocument | null> {
    try {
      const bytes = await readBoundedBytes(this.filePath);
      const parsed = parsePersonalVocabularyJson(bytes);
      return parsed.ok ? parsed.document : null;
    } catch {
      return null;
    }
  }
}

async function readBoundedBytes(filePath: string): Promise<Uint8Array> {
  const info = await lstat(filePath);
  if (!info.isFile() || info.size > PERSONAL_VOCABULARY_MAX_BYTES) throw new Error('The vocabulary file is not a bounded regular file.');
  const handle = await open(filePath, 'r');
  try {
    const bytes = new Uint8Array(info.size);
    let offset = 0;
    while (offset < bytes.byteLength) {
      const result = await handle.read(bytes, offset, bytes.byteLength - offset, offset);
      if (result.bytesRead === 0) break;
      offset += result.bytesRead;
    }
    return offset === bytes.byteLength ? bytes : bytes.slice(0, offset);
  } finally {
    await handle.close();
  }
}
