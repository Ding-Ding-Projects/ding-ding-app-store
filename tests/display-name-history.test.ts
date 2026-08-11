import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { GENERATED_DOCS } from '../src/renderer/generated-docs';
import { buildRegistry } from '../src/renderer/registry';
import { DEFAULT_SCHEDULE, DEFAULT_TAB_WORKSPACE, DEFAULT_USER_SETTINGS } from '../src/shared/contracts';

describe('shared display-name history boundary', () => {
  it('records a display-name mutation as a typed non-secret settings event', async () => {
    const [settingsService, contracts, activity] = await Promise.all([
      readFile(new URL('../src/main/settings-service.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/shared/contracts.ts', import.meta.url), 'utf8'),
      readFile(new URL('../src/renderer/pages/ActivityPage.tsx', import.meta.url), 'utf8'),
    ]);

    expect(contracts).toContain("export type OperationKind = 'install' | 'build' | 'uninstall' | 'update' | 'settings';");
    expect(settingsService).toContain("kind: 'settings'");
    expect(settingsService).toContain('local history entry contains no credential material');
    expect(settingsService).toContain('previous.displayName !== value.displayName');
    expect(settingsService).toContain('Settings persistence remains successful when the best-effort audit write is unavailable.');
    expect(activity).toContain("settings: label(settings, 'Settings', '設定')");
  });

  it('keeps the stricter protected-secret contract visibly limited and palette-reachable', async () => {
    const article = GENERATED_DOCS.find((item) => item.id === 'secret-and-display-name-history');
    expect(article).toMatchObject({ id: 'secret-and-display-name-history', category: 'memory-sync', status: 'limited' });
    expect(article?.body).toContain('not implemented');
    expect(article?.body).toContain('authenticator');

    const registry = buildRegistry({
      settings: DEFAULT_USER_SETTINGS,
      workspace: structuredClone(DEFAULT_TAB_WORKSPACE),
      appearance: {},
      schedule: structuredClone(DEFAULT_SCHEDULE),
      apps: [],
    });
    expect(registry.find((entry) => entry.id === 'cmd:open-doc:secret-and-display-name-history')?.action).toMatchObject({
      type: 'command',
      target: { surface: 'docs', articleId: 'secret-and-display-name-history', focusId: 'docs-tab-secret-and-display-name-history' },
    });
  });
});
