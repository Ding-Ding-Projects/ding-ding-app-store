import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { app, safeStorage } from 'electron';
import type { HomeAssistantTokenStore } from './external-scheduled-settings-service.js';

/**
 * The stable vault account is deliberately private to the main process. The schedule stores only
 * endpoint/entity metadata; this adapter never returns a secret to IPC, logs, history, or exports.
 * Electron safeStorage is backed by Windows DPAPI on the supported platform.
 */
export class HomeAssistantVault implements HomeAssistantTokenStore {
  private readonly filePath = path.join(app.getPath('userData'), 'credential-vault', 'home-assistant.token.dpapi');

  async getHomeAssistantToken(): Promise<string | null> {
    if (!safeStorage.isEncryptionAvailable()) return null;
    try {
      const encrypted = await readFile(this.filePath);
      const token = safeStorage.decryptString(encrypted).trim();
      return token || null;
    } catch {
      return null;
    }
  }
}
