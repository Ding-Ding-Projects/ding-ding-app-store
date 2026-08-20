import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { isIP } from 'node:net';
import { safeStorage } from 'electron';
import { z } from 'zod';
import type {
  ScheduleConfig,
  ScheduledExternalStatus,
  ScheduledSettingRule,
  ScheduledSource,
  UserSettings,
} from '../shared/contracts.js';
import { scheduledSettingsValuesSchema, scheduledSourceSchema } from '../shared/contracts.js';
import { isScheduledRuleActive } from '../shared/scheduled-settings.js';

const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;
const ACTIVATION_POLL_MS = 30_000;
const MAX_TOKEN_BYTES = 4_096;
const apiPayloadSchema = z.object({ version: z.literal(1), values: scheduledSettingsValuesSchema }).strict();
const homeAssistantPayloadSchema = z.object({ state: z.enum(['on', 'off']) }).strict();

type ExternalValues = Partial<Pick<UserSettings, 'language' | 'englishFunnyLevel' | 'cantoneseFunnyLevel' | 'theme' | 'density' | 'accent' | 'displayName'>>;

export interface CredentialVault {
  has(key: string): Promise<boolean>;
  read(key: string): Promise<string | null>;
  write(key: string, value: string): Promise<void>;
}

/** Encrypts the token with Electron's OS-backed safeStorage boundary. */
export class SafeStorageCredentialVault implements CredentialVault {
  private readonly filePath: string;
  private cache: Record<string, string> | null = null;

  constructor(userDataPath: string) {
    this.filePath = path.join(userDataPath, 'schedule-credentials.v1.json');
  }

  async has(key: string): Promise<boolean> {
    const values = await this.load();
    return typeof values[key] === 'string' && values[key].length > 0;
  }

  async read(key: string): Promise<string | null> {
    const values = await this.load();
    const encrypted = values[key];
    if (!encrypted || !safeStorage.isEncryptionAvailable()) return null;
    try { return safeStorage.decryptString(Buffer.from(encrypted, 'base64')); } catch { return null; }
  }

  async write(key: string, value: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('The operating-system credential vault is unavailable.');
    if (Buffer.byteLength(value, 'utf8') > MAX_TOKEN_BYTES) throw new Error('The Home Assistant token is too large.');
    const values = await this.load();
    values[key] = safeStorage.encryptString(value).toString('base64');
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(values)}\n`, { encoding: 'utf8', mode: 0o600 });
    this.cache = values;
  }

  private async load(): Promise<Record<string, string>> {
    if (this.cache) return this.cache;
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8')) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return (this.cache = {});
      const values: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (/^ha_[a-z0-9_-]+$/.test(key) && typeof value === 'string' && value.length <= 8192) values[key] = value;
      }
      return (this.cache = values);
    } catch {
      return (this.cache = {});
    }
  }
}

export class MemoryCredentialVault implements CredentialVault {
  private readonly values = new Map<string, string>();
  async has(key: string): Promise<boolean> { return this.values.has(key); }
  async read(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async write(key: string, value: string): Promise<void> { this.values.set(key, value); }
}

export interface ScheduledSourceFetcher {
  api(url: string, signal: AbortSignal): Promise<ExternalValues>;
  homeAssistant(baseUrl: string, entityId: string, token: string, signal: AbortSignal): Promise<'on' | 'off'>;
}

function rejectPrivateHost(value: string): void {
  const url = new URL(value);
  if (url.username || url.password) throw new Error('Credentials in schedule source URLs are not allowed.');
  const host = url.hostname.toLowerCase();
  if (isIP(host) || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
    if (!(url.protocol === 'http:' && (host === '127.0.0.1' || host === '::1'))) throw new Error('Schedule source host is not an allowed public endpoint.');
  }
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.ok) throw new Error(`Schedule source returned HTTP ${response.status}.`);
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error('Schedule source response exceeded the size limit.');
  if (!response.body) return JSON.parse(await response.text());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw new Error('Schedule source response exceeded the size limit.');
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))));
}

function requestSignal(): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  timer.unref?.();
  return { signal: controller.signal, cancel: () => clearTimeout(timer) };
}

export const defaultScheduledSourceFetcher: ScheduledSourceFetcher = {
  async api(url, signal) {
    rejectPrivateHost(url);
    const request = requestSignal();
    try {
      const response = await fetch(url, { method: 'GET', redirect: 'error', signal: AbortSignal.any([signal, request.signal]), headers: { accept: 'application/json' } });
      return apiPayloadSchema.parse(await readBoundedJson(response)).values;
    } finally { request.cancel(); }
  },
  async homeAssistant(baseUrl, entityId, token, signal) {
    const url = new URL(`/api/states/${encodeURIComponent(entityId)}`, baseUrl).toString();
    rejectPrivateHost(url);
    const request = requestSignal();
    try {
      const response = await fetch(url, { method: 'GET', redirect: 'error', signal: AbortSignal.any([signal, request.signal]), headers: { accept: 'application/json', authorization: `Bearer ${token}` } });
      return homeAssistantPayloadSchema.parse(await readBoundedJson(response)).state;
    } finally { request.cancel(); }
  },
};

interface RuntimeState {
  status: ScheduledExternalStatus;
  values?: ExternalValues;
  lastRefreshMs: number | null;
}

/** Resolves external rules in the privileged process and never exposes credentials. */
export class ScheduledSourceService {
  private generation = 0;
  private timer: NodeJS.Timeout | null = null;
  private config: ScheduleConfig | null = null;
  private readonly states = new Map<string, RuntimeState>();
  private readonly controllers = new Map<string, AbortController>();

  constructor(
    private readonly vault: CredentialVault,
    private readonly fetcher: ScheduledSourceFetcher = defaultScheduledSourceFetcher,
    private readonly onChange: () => void = () => undefined,
  ) {}

  async sync(config: ScheduleConfig, now = new Date()): Promise<void> {
    this.generation += 1;
    const generation = this.generation;
    this.config = config;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
    this.states.clear();
    const active = config.rules.filter((rule) => rule.source?.kind && rule.source.kind !== 'local');
    for (const rule of active) this.ensureState(rule, isScheduledRuleActive(rule, now));
    await Promise.all(active.filter((rule) => isScheduledRuleActive(rule, now)).map((rule) => this.refresh(rule, generation)));
    this.arm(generation);
    this.onChange();
  }

  async setHomeAssistantToken(key: string, token: string): Promise<{ ok: true } | { ok: false; message: string }> {
    if (!/^ha_[a-z0-9_-]{1,63}$/.test(key)) return { ok: false, message: 'The credential key is invalid.' };
    const value = token.trim();
    if (!value || Buffer.byteLength(value, 'utf8') > MAX_TOKEN_BYTES) return { ok: false, message: 'Enter a non-empty token shorter than 4096 bytes.' };
    try { await this.vault.write(key, value); return { ok: true }; } catch (error) { return { ok: false, message: (error as Error).message.slice(0, 240) }; }
  }

  status(): ScheduledExternalStatus[] {
    return [...this.states.values()].map(({ status }) => ({ ...status }));
  }

  values(): Record<string, ExternalValues> {
    const result: Record<string, ExternalValues> = {};
    for (const [id, state] of this.states) if (state.values && state.status.state === 'active') result[id] = { ...state.values };
    return result;
  }

  stop(): void {
    this.generation += 1;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (const controller of this.controllers.values()) controller.abort();
    this.controllers.clear();
  }

  private ensureState(rule: ScheduledSettingRule, active: boolean): RuntimeState {
    const source = rule.source?.kind === 'api' ? 'api' : 'home-assistant';
    const existing = this.states.get(rule.id);
    if (existing) return existing;
    const state: RuntimeState = {
      status: { ruleId: rule.id, source, state: active ? 'refreshing' : 'inactive', lastRefreshAt: null, nextRefreshAt: null, message: active ? 'Waiting for the first source response.' : 'The rule is outside its schedule window.' },
      lastRefreshMs: null,
    };
    this.states.set(rule.id, state);
    return state;
  }

  private async refresh(rule: ScheduledSettingRule, generation: number): Promise<void> {
    if (generation !== this.generation || !this.config || !rule.source || rule.source.kind === 'local') return;
    const state = this.ensureState(rule, true);
    const controller = new AbortController();
    this.controllers.set(rule.id, controller);
    state.status = { ...state.status, state: 'refreshing', message: 'Refreshing the validated external source.' };
    this.onChange();
    try {
      if (rule.source.kind === 'api') {
        const values = await this.fetcher.api(rule.source.url, controller.signal);
        if (generation !== this.generation) return;
        state.values = values;
        this.mark(state, 'active', 'The API source returned a validated settings document.', rule.source.refreshMinutes);
      } else {
        const token = await this.vault.read(rule.source.credentialKey);
        if (!token) {
          state.values = undefined;
          this.mark(state, 'missing-token', 'No Home Assistant token is stored in the operating-system credential vault.', rule.source.refreshMinutes);
        } else {
          const value = await this.fetcher.homeAssistant(rule.source.baseUrl, rule.source.entityId, token, controller.signal);
          if (generation !== this.generation) return;
          state.values = undefined;
          this.mark(state, value === 'on' ? 'active' : 'off', value === 'on' ? 'Home Assistant is on; the rule is active.' : 'Home Assistant is off; the local base setting remains active.', rule.source.refreshMinutes);
        }
      }
    } catch (error) {
      if (generation !== this.generation || controller.signal.aborted) return;
      state.values = undefined;
      this.mark(state, 'failed', `External source unavailable: ${(error as Error).message.slice(0, 160)}`, rule.source.refreshMinutes);
    } finally {
      if (this.controllers.get(rule.id) === controller) this.controllers.delete(rule.id);
      this.onChange();
    }
  }

  private mark(state: RuntimeState, status: ScheduledExternalStatus['state'], message: string, refreshMinutes: number): void {
    const now = Date.now();
    state.lastRefreshMs = now;
    state.status = { ...state.status, state: status, lastRefreshAt: new Date(now).toISOString(), nextRefreshAt: new Date(now + refreshMinutes * 60_000).toISOString(), message };
  }

  private arm(generation: number): void {
    if (this.timer || !this.config) return;
    const now = Date.now();
    let next = now + ACTIVATION_POLL_MS;
    for (const rule of this.config.rules) {
      if (!rule.source || rule.source.kind === 'local') continue;
      const state = this.states.get(rule.id);
      const refreshMinutes = rule.source.refreshMinutes;
      const due = state?.lastRefreshMs ? state.lastRefreshMs + refreshMinutes * 60_000 : now;
      next = Math.min(next, due);
    }
    const timer = setTimeout(() => {
      this.timer = null;
      void this.tick(generation);
    }, Math.max(1_000, Math.min(ACTIVATION_POLL_MS, next - now)));
    timer.unref?.();
    this.timer = timer;
  }

  private async tick(generation: number): Promise<void> {
    if (generation !== this.generation || !this.config) return;
    const now = new Date();
    const pending: Promise<void>[] = [];
    for (const rule of this.config.rules) {
      if (!rule.source || rule.source.kind === 'local') continue;
      const active = isScheduledRuleActive(rule, now);
      const state = this.ensureState(rule, active);
      if (!active) {
        state.values = undefined;
        state.status = { ...state.status, state: 'inactive', nextRefreshAt: null, message: 'The rule is outside its schedule window.' };
      } else if (!state.lastRefreshMs || Date.now() >= state.lastRefreshMs + rule.source.refreshMinutes * 60_000) {
        pending.push(this.refresh(rule, generation));
      }
    }
    await Promise.all(pending);
    this.arm(generation);
    this.onChange();
  }
}

export function sourceFingerprint(source: ScheduledSource): string {
  return createHash('sha256').update(JSON.stringify(source)).digest('hex').slice(0, 16);
}
