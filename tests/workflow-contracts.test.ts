import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

describe('self-hosted workflow and bootstrap contract', () => {
  it('keeps every job on the explicit isolated Windows runner labels', async () => {
    for (const file of ['.github/workflows/ci.yml', '.github/workflows/pages.yml', '.github/workflows/release.yml']) {
      const workflow = await read(file);
      const runsOn = [...workflow.matchAll(/^\s+runs-on:\s*(.+)$/gm)].map((match) => match[1]);
      expect(runsOn.length).toBeGreaterThan(0);
      for (const labels of runsOn) {
        expect(labels).toContain('self-hosted');
        expect(labels).toContain('Windows');
        expect(labels).toContain('X64');
        expect(labels).toContain('ding-ding-app-store');
      }
      expect(workflow).not.toMatch(/(?:ubuntu|windows|macos)-latest/);
    }
  });

  it('runs validation on every push and manual dispatch without pull-request execution', async () => {
    const workflow = await read('.github/workflows/ci.yml');
    expect(workflow).toMatch(/^\s*push:\s*$/m);
    expect(workflow).toMatch(/^\s*workflow_dispatch:\s*\{\}\s*$/m);
    expect(workflow).not.toMatch(/^\s*pull_request:/m);
    expect(workflow).toContain('cancel-in-progress: true');
  });

  it('bootstraps release tooling from a pinned canonical archive with SHA-256 verification', async () => {
    const bootstrap = await read('scripts/bootstrap-gh-cli.ps1');
    expect(bootstrap).toContain("$version = '2.97.0'");
    expect(bootstrap).toContain('https://github.com/cli/cli/releases/download/');
    expect(bootstrap).toContain('Get-FileHash');
    expect(bootstrap).toContain('SHA-256 mismatch');
    expect(bootstrap).not.toMatch(/winget|choco|scoop|Start-Process|Invoke-Expression/i);
  });

  it('declares the custom runner label for structural workflow validation', async () => {
    const config = await read('.github/actionlint.yaml');
    expect(config).toContain('self-hosted-runner:');
    expect(config).toContain('- ding-ding-app-store');
  });
});
