import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => process.env.DING_DING_AUTH_HISTORY_TEST_ROOT ?? process.cwd() },
}));

describe('authenticator Activity HistoryService seam', () => {
  it('records, parses, and exports one redacted localized settings event through the real service', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'ding-ding-auth-history-'));
    const previousRoot = process.env.DING_DING_AUTH_HISTORY_TEST_ROOT;
    process.env.DING_DING_AUTH_HISTORY_TEST_ROOT = root;
    try {
      vi.resetModules();
      const { HistoryService, parseHistoryEntry } = await import('../src/main/history-service.js');
      const { serializeHistoryEntries } = await import('../src/shared/export-registry.js');
      const service = new HistoryService();
      vi.spyOn(service as unknown as { snapshot: (label: string, force?: boolean) => Promise<boolean> }, 'snapshot').mockResolvedValue(true);

      const recorded = await service.record({
        appId: 'authenticator',
        displayName: 'Authenticator',
        kind: 'settings',
        ok: true,
        message: 'Renamed an authenticator entry (opaque entry ID 11111111-1111-4111-8111-111111111111).',
        messageYue: '已改名驗證器項目（不透明項目 ID 11111111-1111-4111-8111-111111111111。）',
      });
      expect(recorded.kind).toBe('settings');

      const logLine = (await readFile(path.join(root, 'history', 'operations.v1.jsonl'), 'utf8')).trim();
      const parsed = parseHistoryEntry(JSON.parse(logLine));
      expect(parsed).toMatchObject({
        appId: 'authenticator',
        kind: 'settings',
        message: expect.stringContaining('opaque entry ID'),
        messageYue: expect.stringContaining('不透明項目 ID'),
      });
      expect(await service.list()).toEqual([parsed]);

      const json = JSON.parse(await service.export('json')) as Array<Record<string, unknown>>;
      expect(json[0]).toMatchObject({ kind: 'settings', messageYue: expect.stringContaining('不透明項目 ID') });
      expect(serializeHistoryEntries([parsed!], 'jsonl')).toContain('messageYue');
      const schema = JSON.parse(serializeHistoryEntries([], 'json-schema')) as { properties: { kind: { enum: string[] } } };
      expect(schema.properties.kind.enum).toContain('settings');
      expect(parseHistoryEntry({ ...parsed, messageYue: 42 })).toBeNull();
    } finally {
      if (previousRoot === undefined) delete process.env.DING_DING_AUTH_HISTORY_TEST_ROOT;
      else process.env.DING_DING_AUTH_HISTORY_TEST_ROOT = previousRoot;
      await rm(root, { recursive: true, force: true });
    }
  });
});
