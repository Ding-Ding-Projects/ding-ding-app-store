import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('catalog language coverage', () => {
  it('routes collection controls, progress, and fallback states through the shared language helper', async () => {
    const source = await readFile(new URL('../src/renderer/pages/AppsPage.tsx', import.meta.url), 'utf8');
    for (const copy of [
      "label(settings, 'Select all shown', '揀晒目前顯示')",
      "label(settings, 'Install ",
      "label(settings, 'Bulk operation progress', '批量操作進度')",
      "label(settings, 'Loading catalog', '載入緊目錄')",
      "label(settings, 'No matching apps', '冇符合嘅 app')",
      "label(settings, 'Open in VS Code', '喺 VS Code 開')",
    ]) expect(source).toContain(copy);
    expect(source).not.toContain('>Select all shown<');
    expect(source).not.toContain('>No matching apps</h2>');
  });
});
