import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { app } from 'electron';
import { z } from 'zod';
import { DEFAULT_USER_SETTINGS } from '../shared/contracts.js';
import type { SettingsProvenance, UserSettings } from '../shared/contracts.js';
import { writeJsonAtomic } from './json-store.js';

const settingsSchema = z.object({
  language: z.enum(['en', 'yue', 'bilingual']),
  englishFunnyLevel: z.number().int().min(1).max(5),
  cantoneseFunnyLevel: z.number().int().min(1).max(5),
  theme: z.enum(['system', 'light', 'dark']),
  density: z.enum(['comfortable', 'compact', 'spacious']),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/),
  displayName: z.string().trim().min(1).max(64),
  automaticRepairConsent: z.boolean().default(false),
  narratorEnabled: z.boolean().default(false),
  narratorLanguage: z.enum(['en', 'yue', 'both']).default('both'),
  narratorReducedSound: z.boolean().default(false),
});

export class SettingsService {
  private readonly filePath = path.join(app.getPath('userData'), 'settings.v1.json');
  private lastProvenance: SettingsProvenance = { source: 'fallback', fallback: { ...DEFAULT_USER_SETTINGS } };

  async load(): Promise<UserSettings> {
    return (await this.loadWithProvenance()).settings;
  }

  async loadWithProvenance(): Promise<{ settings: UserSettings; provenance: SettingsProvenance }> {
    try {
      const stored = JSON.parse(await readFile(this.filePath, 'utf8')) as unknown;
      const parsed = settingsSchema.safeParse(stored);
      if (parsed.success) {
        this.lastProvenance = { source: 'persisted', fallback: { ...DEFAULT_USER_SETTINGS } };
        return { settings: parsed.data, provenance: this.lastProvenance };
      }
    } catch {
      // Missing, malformed, or unreadable settings use the explicit compiled fallback below.
    }
    this.lastProvenance = { source: 'fallback', fallback: { ...DEFAULT_USER_SETTINGS } };
    return { settings: { ...DEFAULT_USER_SETTINGS }, provenance: this.lastProvenance };
  }

  async provenance(): Promise<SettingsProvenance> {
    if (!this.lastProvenance) await this.loadWithProvenance();
    return { source: this.lastProvenance.source, fallback: { ...this.lastProvenance.fallback } };
  }

  async save(input: UserSettings): Promise<UserSettings> {
    const value = settingsSchema.parse(input);
    await writeJsonAtomic(this.filePath, value);
    this.lastProvenance = { source: 'persisted', fallback: { ...DEFAULT_USER_SETTINGS } };
    return value;
  }
}

