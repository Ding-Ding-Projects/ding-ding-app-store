import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('source isolation status presentation boundary', () => {
  it('wires the typed status bridge into Settings and the read-only terminal', async () => {
    const app = await readFile(new URL('../src/renderer/App.tsx', import.meta.url), 'utf8');
    const settings = await readFile(new URL('../src/renderer/pages/SettingsPage.tsx', import.meta.url), 'utf8');
    const terminal = await readFile(new URL('../src/renderer/components/SourceTerminalPanel.tsx', import.meta.url), 'utf8');
    const card = await readFile(new URL('../src/renderer/components/SourceIsolationStatusCard.tsx', import.meta.url), 'utf8');
    expect(app).toContain('window.dingDingStore.sourceJobs.status()');
    expect(app).toContain('sourceIsolationStatus={sourceIsolationStatus}');
    expect(app).toContain('isolationStatus={sourceIsolationStatus}');
    expect(settings).toContain('<SourceIsolationStatusCard');
    for (const field of ['available', 'reason', 'evidence', 'remediation', 'checkedAt']) expect(card).toContain(field);
    expect(card).toContain('Check again');
    expect(terminal).toContain('Read-only structured output');
    expect(terminal).not.toMatch(/<input|<textarea|contentEditable/i);
  });
});
