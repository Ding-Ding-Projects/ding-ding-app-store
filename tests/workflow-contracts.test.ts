import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

describe('GitHub-hosted workflow and bootstrap contract', () => {
  it('keeps validation and release jobs on pinned cloud runner images', async () => {
    const ci = await read('.github/workflows/ci.yml');
    const release = await read('.github/workflows/release.yml');
    const pages = await read('.github/workflows/pages.yml');
    expect(ci).toMatch(/^\s+runs-on:\s*windows-2022\s*$/m);
    expect(release.match(/^\s+runs-on:\s*windows-2022\s*$/gm)).toHaveLength(3);
    expect(pages).toMatch(/^\s+runs-on:\s*ubuntu-24\.04\s*$/m);
    for (const workflow of [ci, release, pages]) {
      expect(workflow).not.toContain('self-hosted');
      expect(workflow).not.toContain('ding-ding-app-store]');
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

  it('resolves an unused public dim-sum code name without attaching a copied photo', async () => {
    const release = await read('.github/workflows/release.yml');
    expect(release).toContain('scripts/select-dim-sum-release.mjs');
    expect(release).toContain('Dim sum code name:');
    expect(release).toContain('Public dish photo:');
    expect(release).toContain('$dish.photoUrl');
    expect(release).not.toMatch(/gh release create[^\n]*\$dish\.(?:assetName|photoUrl)/);
  });
});
