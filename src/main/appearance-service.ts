import { readFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { AppearanceDocument, AppearanceElements, AppearanceImportResult, ElementKey, ElementOverride } from '../shared/contracts.js';
import {
  appearanceDocumentSchema,
  appearanceExportSchema,
  elementOverrideSchema,
  ELEMENT_KEYS,
  MAX_IMPORT_BYTES,
} from '../shared/contracts.js';
import { writeJsonAtomic } from './json-store.js';

const EMPTY: AppearanceDocument = { schemaVersion: 1, elements: {} };
const MAX_ISSUES = 10;
const MAX_ISSUE_LENGTH = 160;
function parseElementKey(value: unknown): ElementKey {
  if (typeof value !== 'string' || !(ELEMENT_KEYS as readonly string[]).includes(value)) throw new Error('Unknown appearance element.');
  return value as ElementKey;
}

export class AppearanceService {
  private readonly filePath = path.join(app.getPath('userData'), 'appearance.v1.json');
  private readonly invalidPath = path.join(app.getPath('userData'), 'appearance.v1.invalid.json');
  private quarantined = false;

  async load(): Promise<AppearanceDocument> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { ...EMPTY, elements: {} };
      return { ...EMPTY, elements: {}, warning: 'Appearance overrides could not be read; defaults are in use.' };
    }
    let candidate: unknown;
    try {
      candidate = JSON.parse(raw) as unknown;
    } catch {
      candidate = null;
    }
    const parsed = appearanceDocumentSchema.safeParse(candidate);
    if (parsed.success) return { schemaVersion: 1, elements: parsed.data.elements };
    await this.quarantine();
    return { ...EMPTY, elements: {}, warning: 'Stored appearance overrides were unreadable and have been set aside; defaults are in use.' };
  }

  async setElement(key: unknown, override: unknown): Promise<AppearanceDocument> {
    const elementKey = parseElementKey(key);
    const value = elementOverrideSchema.parse(override);
    const current = await this.load();
    const elements: AppearanceElements = { ...current.elements };
    if (Object.keys(value).length === 0) delete elements[elementKey];
    else elements[elementKey] = value;
    return this.persist(elements);
  }

  async resetElement(key: unknown): Promise<AppearanceDocument> {
    const elementKey = parseElementKey(key);
    const current = await this.load();
    const elements: AppearanceElements = { ...current.elements };
    delete elements[elementKey];
    return this.persist(elements);
  }

  async resetAll(): Promise<AppearanceDocument> {
    return this.persist({});
  }

  async export(): Promise<string> {
    const current = await this.load();
    const payload = {
      kind: 'ding-ding-app-store.appearance' as const,
      schemaVersion: 1 as const,
      exportedAt: new Date().toISOString(),
      appVersion: app.getVersion().slice(0, 32),
      elements: current.elements,
    };
    return `${JSON.stringify(payload, null, 2)}\n`;
  }

  async import(payload: unknown): Promise<AppearanceImportResult> {
    if (typeof payload !== 'string' || Buffer.byteLength(payload, 'utf8') > MAX_IMPORT_BYTES) {
      return { ok: false, message: 'Appearance file is larger than the 64 KB limit.', issues: [] };
    }
    let candidate: unknown;
    try {
      candidate = JSON.parse(payload) as unknown;
    } catch {
      return { ok: false, message: 'Appearance file is not valid JSON.', issues: [] };
    }
    const parsed = appearanceExportSchema.safeParse(candidate);
    if (!parsed.success) {
      const issues = parsed.error.issues.slice(0, MAX_ISSUES).map((issue) => {
        const field = issue.path.map((segment) => String(segment).replace(/[^A-Za-z0-9._[\]-]/g, '')).join('.') || 'document';
        return `${field}: ${issue.message}`.slice(0, MAX_ISSUE_LENGTH);
      });
      return { ok: false, message: 'Appearance file does not match the supported appearance format.', issues };
    }
    const document = await this.persist(parsed.data.elements);
    return { ok: true, document, applied: Object.keys(document.elements).length };
  }

  private async persist(elements: AppearanceElements): Promise<AppearanceDocument> {
    const pruned: AppearanceElements = {};
    for (const [key, override] of Object.entries(elements) as Array<[ElementKey, ElementOverride | undefined]>) {
      if (override && Object.keys(override).length > 0) pruned[key] = override;
    }
    const document = appearanceDocumentSchema.parse({ schemaVersion: 1, elements: pruned });
    await writeJsonAtomic(this.filePath, document);
    return { schemaVersion: 1, elements: document.elements };
  }

  private async quarantine(): Promise<void> {
    if (this.quarantined) return;
    this.quarantined = true;
    await rename(this.filePath, this.invalidPath).catch(() => undefined);
  }
}
