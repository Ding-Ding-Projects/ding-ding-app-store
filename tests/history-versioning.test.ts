import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const read = (file: string) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

describe('local history/version browser contract', () => {
  it('keeps revisions local, bounded, and restricted to fixed App Store snapshots', async () => {
    const service = await read('src/main/history-service.ts');
    expect(service).toContain('MAX_REVISIONS = 200');
    expect(service).toContain('MAX_REVISION_BYTES = 2_000_000');
    expect(service).toContain("const REVISION_ID = /^[0-9a-f]{40}$/i");
    expect(service).toContain("'state/installed-apps.json', 'state/settings.json'");
    expect(service).toContain("GIT_CONFIG_NOSYSTEM: '1'");
    expect(service).toContain("['merge-base', '--is-ancestor', id, 'HEAD']");
    expect(service).toContain("['show', source]");
    expect(service).toContain('JSON.parse(content)');
  });

  it('records labels and restores as append-only commits with a before snapshot', async () => {
    const service = await read('src/main/history-service.ts');
    expect(service).toContain("state/labels.v1.json");
    expect(service).toContain("git(this.repositoryPath, ['commit', '-m', `label: ${label}`])");
    expect(service).toContain("await this.snapshot(`before restore: ${id}`)");
    expect(service).toContain("await this.snapshot(`restore: ${id}`, true)");
    expect(service).toContain("'--allow-empty'");
  });

  it('exposes typed diff, label, and restore bridge controls and the Activity UI', async () => {
    const contracts = await read('src/shared/contracts.ts');
    const preload = await read('src/preload/index.ts');
    const main = await read('src/main/main.ts');
    const activity = await read('src/renderer/pages/ActivityPage.tsx');
    const settings = await read('src/renderer/state/use-settings.ts');
    const app = await read('src/renderer/App.tsx');
    expect(contracts).toContain('HistoryRevision');
    for (const method of ['history:revisions', 'history:diff', 'history:label', 'history:restore']) expect(preload).toContain(method);
    for (const method of ['history:revisions', 'history:diff', 'history:label', 'history:restore']) expect(main).toContain(method);
    for (const control of ['Local versions', 'View diff', 'Save label', 'Restore local version', 'DestructiveConfirmDialog']) expect(activity.toLowerCase()).toContain(control.toLowerCase());
    expect(settings).toContain('reload(): Promise<void>');
    expect(settings).toContain('Settings could not be reloaded after the local history change');
    expect(app).toContain('reloadHistoryAndSettings');
  });
});
