import { describe, expect, it } from 'vitest';
import { DEFAULT_SCHEDULE, scheduleSchema } from '../src/shared/contracts';
import { ExternalScheduledSettingsService } from '../src/main/external-scheduled-settings-service';
import { migrateScheduleDocument } from '../src/main/schedule-service';
import { resolveScheduledSettings } from '../src/shared/scheduled-settings';

const apiRule = (overrides: Record<string, unknown> = {}) => ({
  id: 'rule_aaaa1111', label: 'Remote work theme', enabled: true, startDate: null, endDate: null,
  startMinute: 22 * 60, endMinute: 7 * 60, weekdays: [1, 2, 3, 4, 5, 6, 7], timeZone: 'UTC', priority: 50,
  values: { theme: 'dark' as const }, source: { kind: 'api' as const, url: 'https://settings.example.test/v1' }, ...overrides,
});

const config = (rule: Record<string, unknown>) => ({ ...DEFAULT_SCHEDULE, rules: [rule] });
const at = () => new Date('2026-08-10T23:30:00.000Z');
const tokenStore = { getHomeAssistantToken: async () => 'vault-only-token' };

describe('external scheduled settings sources', () => {
  it('applies only a bounded versioned API payload and preserves a local rule fallback on malformed/offline results', async () => {
    const service = new ExternalScheduledSettingsService({
      tokenStore,
      now: at,
      fetch: async (_url, init) => {
        expect(init?.redirect).toBe('error');
        return new Response(JSON.stringify({ version: 1, settings: { theme: 'light', density: 'compact' } }), { headers: { 'content-type': 'application/json' } });
      },
    });
    await service.refresh(config(apiRule()));
    expect(service.status()).toMatchObject([{ state: 'active', values: { theme: 'light', density: 'compact' } }]);
    const base = { language: 'en' as const, englishFunnyLevel: 1, cantoneseFunnyLevel: 1, theme: 'system' as const, density: 'comfortable' as const, accent: '#6750A4', displayName: 'Ding Ding App Store', automaticRepairConsent: false };
    expect(resolveScheduledSettings(base, config(apiRule()), at(), service.overrides())).toMatchObject({ theme: 'light', density: 'compact' });

    const offline = new ExternalScheduledSettingsService({ tokenStore, now: at, fetch: async () => { throw new Error('network unavailable'); } });
    await offline.refresh(config(apiRule()));
    expect(offline.status()).toMatchObject([{ state: 'failed', values: null }]);
    expect(resolveScheduledSettings(base, config(apiRule()), at(), offline.overrides()).theme).toBe('dark');
  });

  it('handles Home Assistant on, off, and missing-vault-token without exposing the token', async () => {
    const ha = apiRule({ source: { kind: 'home-assistant', baseUrl: 'https://ha.example.test', entityId: 'input_boolean.work_mode' }, values: { displayName: 'Work Store' } });
    const on = new ExternalScheduledSettingsService({ tokenStore, now: at, fetch: async (_url, init) => {
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer vault-only-token' });
      return new Response(JSON.stringify({ state: 'on' }));
    } });
    await on.refresh(config(ha));
    expect(on.status()).toMatchObject([{ kind: 'home-assistant', state: 'active', values: { displayName: 'Work Store' } }]);
    expect(JSON.stringify(on.status())).not.toContain('vault-only-token');

    const off = new ExternalScheduledSettingsService({ tokenStore, now: at, fetch: async () => new Response(JSON.stringify({ state: 'off' })) });
    await off.refresh(config(ha));
    expect(off.status()).toMatchObject([{ state: 'off', values: null }]);

    const missing = new ExternalScheduledSettingsService({ tokenStore: { getHomeAssistantToken: async () => null }, now: at, fetch: async () => { throw new Error('must not fetch'); } });
    await missing.refresh(config(ha));
    expect(missing.status()).toMatchObject([{ state: 'failed', values: null }]);
  });

  it('rejects URL credentials/fragments and invalid entities while allowing literal loopback development only for Home Assistant', () => {
    expect(scheduleSchema.safeParse(config(apiRule({ source: { kind: 'api', url: 'https://token@example.test/v1' } }))).success).toBe(false);
    expect(scheduleSchema.safeParse(config(apiRule({ source: { kind: 'api', url: 'https://example.test/v1#fragment' } }))).success).toBe(false);
    expect(scheduleSchema.safeParse(config(apiRule({ source: { kind: 'api', url: 'https://127.0.0.1/v1' } }))).success).toBe(false);
    expect(scheduleSchema.safeParse(config(apiRule({ source: { kind: 'api', url: 'https://192.168.50.10/v1' } }))).success).toBe(false);
    expect(scheduleSchema.safeParse(config(apiRule({ source: { kind: 'api', url: 'https://localhost/v1' } }))).success).toBe(false);
    expect(scheduleSchema.safeParse(config(apiRule({ source: { kind: 'home-assistant', baseUrl: 'http://localhost:8123', entityId: 'input_boolean.ok' } }))).success).toBe(false);
    expect(scheduleSchema.safeParse(config(apiRule({ source: { kind: 'home-assistant', baseUrl: 'http://127.0.0.1:8123', entityId: 'input_boolean.ok' } }))).success).toBe(true);
    expect(scheduleSchema.safeParse(config(apiRule({ source: { kind: 'home-assistant', baseUrl: 'https://ha.example.test', entityId: 'sensor.not_boolean' } }))).success).toBe(false);
  });

  it('migrates v2 rules to v3 without losing their local scheduled values', () => {
    const v2 = { ...config(apiRule()), schemaVersion: 2 } as Record<string, unknown>;
    const migrated = scheduleSchema.parse(migrateScheduleDocument(v2));
    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.rules[0]).toMatchObject({ values: { theme: 'dark' }, source: { kind: 'local' } });
  });

  it('discards a stale source result after a newer generation replaces it', async () => {
    let resolveOld: ((response: Response) => void) | undefined;
    let calls = 0;
    const service = new ExternalScheduledSettingsService({
      tokenStore, now: at,
      fetch: async () => {
        calls += 1;
        if (calls === 1) return await new Promise<Response>((resolve) => { resolveOld = resolve; });
        return new Response(JSON.stringify({ version: 1, settings: { theme: 'light' } }));
      },
    });
    const first = service.refresh(config(apiRule()));
    await Promise.resolve();
    const second = service.refresh(config(apiRule({ source: { kind: 'api', url: 'https://settings.example.test/new' } })));
    await second;
    resolveOld?.(new Response(JSON.stringify({ version: 1, settings: { theme: 'dark' } })));
    await first;
    expect(service.status()).toMatchObject([{ state: 'active', values: { theme: 'light' } }]);
  });
});
