import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import type { IncomingMessage } from 'node:http';
import { checkServerIdentity } from 'node:tls';
import { z } from 'zod';
import type { ExternalScheduleSourceStatus, ScheduleConfig, ScheduledSettingRule } from '../shared/contracts.js';
import { allowedHomeAssistantBaseUrl, privateOrLoopbackHost, scheduledSettingsOverrideSchema } from '../shared/contracts.js';
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
  /** Test-only transport hook. Production uses the pinned Node transport below. */
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  resolve?: (hostname: string) => Promise<ReadonlyArray<{ address: string; family: 4 | 6 }>>;
}

interface PinnedDestination {
  readonly address: string;
  readonly family: 4 | 6;
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

async function readBoundedNodeJson(response: IncomingMessage): Promise<unknown> {
  const declared = Number(response.headers['content-length'] ?? '0');
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error('Response exceeds the 32 KB limit.');
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of response) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += bytes.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      response.destroy();
      throw new Error('Response exceeds the 32 KB limit.');
    }
    chunks.push(bytes);
  }
  return JSON.parse(Buffer.concat(chunks, total).toString('utf8'));
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
  private readonly resolveHost: NonNullable<ExternalScheduledSettingsOptions['resolve']>;
  private controller: AbortController | null = null;
  private generation = 0;
  private statuses = new Map<string, ExternalScheduleSourceStatus>();

  constructor(private readonly options: ExternalScheduledSettingsOptions) {
    this.fetcher = options.fetch ?? globalThis.fetch;
    this.now = options.now ?? (() => new Date());
    this.resolveHost = options.resolve ?? (async (hostname) => (await dnsLookup(hostname, { all: true, verbatim: true }))
      .filter((record): record is { address: string; family: 4 | 6 } => record.family === 4 || record.family === 6));
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
      const payload = await this.requestJson(new URL(rule.source.url), undefined, signal);
      const parsed = apiResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid versioned API payload.');
      return sourceStatus(rule, 'active', checkedAt, 'Validated API settings applied temporarily.', parsed.data.settings);
    }
    if (rule.source.kind === 'home-assistant') {
      if (!allowedHomeAssistantBaseUrl(rule.source.baseUrl)) {
        throw new Error('Home Assistant URL is not an allowed public HTTPS host or explicit loopback development endpoint.');
      }
      const url = new URL(`/api/states/${encodeURIComponent(rule.source.entityId)}`, rule.source.baseUrl);
      const destination = await this.resolveDestination(url);
      const token = await this.options.tokenStore.getHomeAssistantToken();
      if (!token) return sourceStatus(rule, 'failed', checkedAt, 'A Home Assistant token is unavailable in the OS credential vault; local scheduled values remain in effect.', null);
      const payload = await this.requestJson(url, { Authorization: `Bearer ${token}` }, signal, destination);
      const parsed = homeAssistantResponseSchema.safeParse(payload);
      if (!parsed.success) throw new Error('Invalid Home Assistant state payload.');
      return parsed.data.state === 'on'
        ? sourceStatus(rule, 'active', checkedAt, 'Home Assistant entity is on; local scheduled values apply temporarily.', rule.values)
        : sourceStatus(rule, 'off', checkedAt, 'Home Assistant entity is off; local scheduled values remain inactive.', null);
    }
    return sourceStatus(rule, 'idle', checkedAt, null, null);
  }

  private async resolveDestination(url: URL): Promise<PinnedDestination> {
    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (url.protocol === 'http:') return { address: '127.0.0.1', family: 4 };
    const addresses = await this.resolveHost(hostname);
    if (addresses.length === 0 || addresses.some((address) => privateOrLoopbackHost(address.address))) {
      throw new Error('The external HTTPS host resolved to a private or loopback address.');
    }
    return addresses[0];
  }

  private async requestJson(url: URL, headers: Record<string, string> | undefined, outerSignal: AbortSignal, pinnedDestination?: PinnedDestination): Promise<unknown> {
    const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const signal = AbortSignal.any([outerSignal, timeout]);
    const destination = pinnedDestination ?? await this.resolveDestination(url);
    if (!this.options.fetch) return await this.requestPinnedJson(url, headers, signal, destination);
    const response = await this.fetcher(url, {
      method: 'GET',
      headers: { Accept: 'application/json', ...(headers ?? {}) },
      redirect: 'error',
      signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await readBoundedJson(response);
  }

  private async requestPinnedJson(url: URL, headers: Record<string, string> | undefined, signal: AbortSignal, destination: PinnedDestination): Promise<unknown> {
    const targetHost = url.hostname.replace(/^\[|\]$/g, '');
    const request = url.protocol === 'https:' ? httpsRequest : httpRequest;
    return await new Promise<unknown>((resolve, reject) => {
      const handle = request({
        protocol: url.protocol,
        hostname: destination.address,
        family: destination.family,
        port: url.port ? Number(url.port) : undefined,
        path: `${url.pathname}${url.search}`,
        headers: { Accept: 'application/json', Host: url.host, ...(headers ?? {}) },
        ...(url.protocol === 'https:' ? {
          servername: targetHost,
          checkServerIdentity: (_host, certificate) => checkServerIdentity(targetHost, certificate),
        } : {}),
      }, async (response) => {
        try {
          if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) throw new Error(`HTTP ${response.statusCode ?? 0}`);
          resolve(await readBoundedNodeJson(response));
        } catch (error) { reject(error); }
      });
      const abort = () => handle.destroy(new DOMException('Request aborted.', 'AbortError'));
      if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
      handle.once('close', () => signal.removeEventListener('abort', abort));
      handle.once('error', reject);
      handle.end();
    });
  }
}
