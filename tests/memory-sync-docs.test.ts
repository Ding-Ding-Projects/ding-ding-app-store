import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const read = (relative: string) => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');

describe('memory synchronization documentation coverage', () => {
  it('keeps the category and both canonical articles on the hand-written inventory', async () => {
    const generator = await read('scripts/docs-generate.mjs');
    expect(generator).toContain("id: 'memory-sync'");
    expect(generator).toContain("'status-hub'");
    expect(generator).toContain("'convenience-skills'");
    const statusHub = await read('docs/features/memory-sync/status-hub.md');
    const skills = await read('docs/features/memory-sync/convenience-skills.md');
    for (const article of [statusHub, skills]) {
      expect(article).toContain('## Behaviour');
      expect(article).toContain('## Configuration');
      expect(article).toContain('## Failure modes');
      expect(article).toContain('## Security considerations');
      expect(article).toContain('## Verification');
      expect(article).toContain('## Suggested articles');
      expect(article).toMatch(/fail(?:s)? closed/);
      expect(article).not.toMatch(/(?:access[_ -]?token|password|private key)\s*[:=]\s*\S+/i);
    }
  });

  it('keeps memory synchronization documentation honest about runtime authority', async () => {
    const statusHub = await read('docs/features/memory-sync/status-hub.md');
    const skills = await read('docs/features/memory-sync/convenience-skills.md');
    expect(statusHub).toContain('does not claim that this packaged desktop app hosts the hub');
    expect(statusHub).toContain('do not prove a live service deployment');
    expect(skills).toContain('does not authorize source execution or automatic repair');
    expect(skills).toContain('never guesses a replacement path, runs a downloaded script');
  });
});
