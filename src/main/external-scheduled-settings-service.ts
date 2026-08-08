import { z } from 'zod';
import type { ExternalScheduleSourceStatus, ScheduleConfig, ScheduledSettingRule } from '../shared/contracts.js';
import { scheduledSettingsOverrideSchema } from '../shared/contracts.js';
import { isScheduledRuleActive } from '../shared/scheduled-settings.js';

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 32 * 1024;

const apiResponseSchema = z.object({
  version: z.literal(1),
  settings: scheduledSettingsOverrideSchema,
}).strict();

const homeAssistantResponseSchema = z.object({ state: z.enum(['on', 'off']) }).passthrough();

export interface HomeAssistantTokenStore {
  /** Resolves the token from the OS-protected vault. It is never persisted in schedule data or returned to a renderer. */
  getHomeAssistantToken(): Promise<string | null>;
}

export interface ExternalScheduledSettingsOptions {
  tokenStore: HomeAssistantTokenStore;
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
}

function safeMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'The request timed out or was replaced by a newer schedule.';
  return 'The external setting source could not be validated; local scheduled values remain in effect.';
}

async function readBoundedJson(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error('Response exceeds the 32 KB limit.');
  if (!response.body) throw new Error('Response body missing.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error('Response exceeds the 32 KB limit.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

function sourceStatus(rule: ScheduledSettingRule, state: ExternalScheduleSourceStatus['state'], checkedAt: string | null, message: string | null, values: ExternalScheduleSourceStatus['values']): ExternalScheduleSourceStatus {
  return { ruleId: rule.id, kind: rule.source.kind, state, checkedAt, message, values };
}

/**
 * Main-process-only resolver for remote schedule sources. A remote failure never writes base settings,
 * schedule data, or a renderer-visible credential; callers retain the local rule value or base setting.
 */
export class ExternalScheduledSettingsService {
  private readonly fetcher: typeof globalThis.fetch;
  private readonly now: () => Date;
  private controller: AbortController | null = null;
  private generation = 0;
  private statuses = new Map<string, ExternalScheduleSourceStatus>();

  constructor(private readonly options: ExternalScheduledSettingsOptions) {
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? (() => new Date());
  }

  status(): ExternalScheduleSourceStatus[] {
    return [...this.statuses.values()].sort((left, right) => left.ruleId.localeCompare(right.ruleId));
  }

  overrides(): Record<string, NonNullable<ExternalScheduleSourceStatus['values']>> {
    return Object.fromEntries([...this.statuses.values()]
      .filter((status): status is ExternalScheduleSourceStatus & { values: NonNullable<ExternalScheduleSourceStatus['values']> } => status.state === 'active' && status.values !== null)
      .map((status) => [status.ruleId, status.values]));
  }

  async refresh(config: ScheduleConfig): Promise<void> {
    this.generation += 1;
    const generation = this.generation;
    this.controller?.abort();
    const controller = new AbortController();
    this.controller = controller;
    const at = this.now().toISOString();
    const externalRules = config.rules.filter((rule) => rule.source.kind !== 'local');
    const next = new Map<string, ExternalScheduleSourceStatus>();
    await Promise.all(externalRules.map(async (rule) => {
      if (!isScheduledRuleActive(rule, this.now())) {
        next.set(rule.id, sourceStatus(rule, 'idle', at, 'The local time window is not active.', null));
        return;
      }
      try {
        next.set(rule.id, await this.resolveRule(rule, controller.signal, at));
      } catch (error) {
        next.set(rule.id, sourceStatus(rule, 'failed', at, safeMessage(error), null));
      }
    }));
    if (generation === this.generation && !controller.signal.aborted) this.statuses = next;
  }

  cancel(): void {
    this.generation += 1;
    this.controller?.abort();
    this.controller = null;
  }

  private async resolveRule(rule: ScheduledSettingRule, signal: AbortSignal, checkedAt: string): Promise<ExternalScheduleSourceStatus> {
    if (rule.source.kind === 'api') {
      const payload = await this.requestJson(rule.source.url, undefined, signal);
      const parsed = apiResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid versioned API payload.');
      return sourceStatus(rule, 'active', checkedAt, 'Validated API settings applied temporarily.', parsed.data.settings);
    }
    if (rule.source.kind === 'home-assistant') {
      const token = await this.options.tokenStore.getHomeAssistantToken();
      if (!token) return sourceStatus(rule, 'failed', checkedAt, 'A Home Assistant token is unavailable in the OS credential vault; local scheduled values remain in effect.', null);
      const url = new URL(`/api/states/${encodeURIComponent(rule.source.entityId)}`, rule.source.baseUrl);
      const payload = await this.requestJson(url.toString(), { Authorization: `Bearer ${token}` }, signal);
      const parsed = homeAssistantResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid Home Assistant state payload.');
      return parsed.data.state === 'on'
        ? sourceStatus(rule, 'active', checkedAt, 'Home Assistant entity is on; local scheduled values apply temporarily.', rule.values)
        : sourceStatus(rule, 'off', checkedAt, 'Home Assistant entity is off; local scheduled values remain inactive.', null);
    }
    return sourceStatus(rule, 'idle', checkedAt, null, null);
  }

  private async requestJson(url: string, headers: Record<string, string> | undefined, outerSignal: AbortSignal): Promise<unknown> {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = AbortSignal.any([outerSignal, timeout]);
    const response = await this.fetcher(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...(headers ?? {}) },
      redirect: 'error',
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await readBoundedJson(response);
  }
}
