import path from 'node:path';
import { app } from 'electron';
import { z } from 'zod';
import type { UserSettings } from '../shared/contracts.js';
import { readJson, writeJsonAtomic } from './json-store.js';

const settingsSchema = z.object({
  language: z.enum(['en', 'yue', 'bilingual']),
  englishFunnyLevel: z.number().int().min(1).max(5),
  cantoneseFunnyLevel: z.number().int().min(1).max(5),
  theme: z.enum(['system', 'light', 'dark']),
  density: z.enum(['comfortable', 'compact', 'spacious']),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  displayName: z.string().trim().min(1).max(64),
  automaticRepairConsent: z.boolean().default(false),
});

const defaults: UserSettings = {
  language: 'bilingual',
  englishFunnyLevel: 2,
  cantoneseFunnyLevel: 4,
  theme: 'system',
  density: 'comfortable',
  accent: '#6750A4',
  displayName: 'Ding Ding App Store',
  automaticRepairConsent: false,
};

export class SettingsService {
  private readonly filePath = path.join(app.getPath('userData'), 'settings.v1.json');

  async load(): Promise<UserSettings> {
    const stored = await readJson<unknown>(this.filePath, defaults);
    const parsed = settingsSchema.safeParse(stored);
    return parsed.success ? parsed.data : defaults;
  }

  async save(input: UserSettings): Promise<UserSettings> {
    const value = settingsSchema.parse(input);
    await writeJsonAtomic(this.filePath, value);
    return value;
  }
}

