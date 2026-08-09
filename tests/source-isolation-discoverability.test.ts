import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

describe('source isolation status discoverability', () => {
  it('renders the safety status card in General without a hidden search prerequisite', async () => {
    const settings = await read('src/renderer/pages/SettingsPage.tsx');
    expect(settings).toContain("import { SourceIsolationStatusCard } from '../components/SourceIsolationStatusCard';");
    expect(settings).toContain('<SourceIsolationStatusCard settings={viewSettings} status={sourceIsolationStatus}');
    expect(settings).not.toContain("matcher('automatic source repair OpenCode isolation guest transport sandbox') && <SourceIsolationStatusCard");
  });

  it('registers and handles a typed palette destination for the safety card', async () => {
    const [registry, app] = await Promise.all([read('src/renderer/registry.ts'), read('src/renderer/App.tsx')]);
    expect(registry).toContain("'open-source-details'");
    expect(registry).toContain("focusId: 'source-isolation-title'");
    expect(app).toContain("case 'open-source-details': openSurface('settings.general'); focusLater('source-isolation-title'); return;");
  });
});
