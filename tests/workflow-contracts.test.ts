import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const read = async (file: string) => (await readFile(path.join(root, file), 'utf8')).replace(/\r\n?/g, '\n');

describe('GitHub-hosted workflow and bootstrap contract', () => {
  it('redeploys Pages after a successful main Release so generated release history cannot go stale', async () => {
    const pages = await read('.github/workflows/pages.yml');
    expect(pages).toContain('workflow_run:');
    expect(pages).toContain('workflows: [Release]');
    expect(pages).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(pages).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(pages).toContain('generate-release-changelog.mjs --fallback');
    expect(pages).toContain('test -s site/assets/generated-changelog.mjs');
  });
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

  it('keeps Actions build and release paths free of test, lint, and typecheck gates', async () => {
    const ci = await read('.github/workflows/ci.yml');
    const release = await read('.github/workflows/release.yml');
    const proof = await read('.github/workflows/install-adapter-proof.yml');
    for (const workflow of [ci, release, proof]) {
      expect(workflow).not.toMatch(/npm run (?:check|test)|npm test|vitest|tsc\s+-p|eslint|lint/i);
      expect(workflow).toContain('npm ci');
      expect(workflow).toContain('if: always()');
      expect(workflow).toContain('continue-on-error: true');
      expect(workflow).toContain('if-no-files-found: warn');
      expect(workflow).toContain('retention-days: 7');
    }
    expect(ci).toContain('npm run build');
    expect(release).toContain('\n  prepare:\n');
    expect(release).not.toContain('\n  test:\n');
    expect(release).not.toContain('needs: test');
    expect(release).toContain('npx electron-builder --win squirrel --publish never');
  });

  it('runs releases only for main pushes and manual dispatch, with a fresh-main-tip assertion', async () => {
    const workflow = await read('.github/workflows/release.yml');
    expect(workflow).toMatch(/^on:\s*\n\s+push:\s*\n\s+branches:\s*\n\s+- main\s*$/m);
    expect(workflow).toMatch(/^\s*workflow_dispatch:\s*\{\}\s*$/m);
    expect(workflow).not.toMatch(/^\s+tags(?:-ignore)?:/m);
    expect(workflow.match(/\$mainTip = git rev-parse origin\/main/gm)).toHaveLength(2);
    expect(workflow.match(/\$mainTip -ne \$env:GITHUB_SHA/gm)).toHaveLength(2);
  });

  it('bootstraps release tooling from a pinned canonical archive with SHA-256 verification', async () => {
    const bootstrap = await read('scripts/bootstrap-gh-cli.ps1');
    expect(bootstrap).toContain("$version = '2.97.0'");
    expect(bootstrap).toContain('https://github.com/cli/cli/releases/download/');
    expect(bootstrap).toContain('Get-FileHash');
    expect(bootstrap).toContain('SHA-256 mismatch');
    expect(bootstrap).toContain('$reportedText = ($reportedLines');
    expect(bootstrap).toContain('$firstLine = if ($reportedLines.Count -gt 0)');
    expect(bootstrap).toContain('$firstLine -notmatch $expectedPattern');
    expect(bootstrap).toContain("Join-Path $extractRoot 'bin\\gh.exe'");
    expect(bootstrap).not.toContain('Get-ChildItem -LiteralPath $extractRoot -Recurse');
    expect(bootstrap).not.toMatch(/winget|choco|scoop|Start-Process|Invoke-Expression/i);
  });

  it('resolves an unused public dim-sum code name without attaching a copied photo', async () => {
    const release = await read('.github/workflows/release.yml');
    expect(release).toContain('scripts/select-dim-sum-release.mjs');
    expect(release).toContain('Dim sum code name:');
    expect(release).toContain('Public dish photo:');
    expect(release).toContain('$dish.photoUrl');
    expect(release).not.toMatch(/gh release create[^\n]*\$dish\.(?:assetName|photoUrl)/);
    expect(release).toContain('gh release create $env:RELEASE_TAG $setup $releases $nupkg --repo $env:GITHUB_REPOSITORY --target $env:GITHUB_SHA');
    expect(release).toContain('scripts/prepare-release-version.mjs');
    expect(release).toContain('$tag = "v$version"');
    expect(release).toContain('$expectedPackageName = "DingDingAppStore-$env:RELEASE_VERSION-full.nupkg"');
    expect(release).toContain("Resolve-Path \"release-stage/DingDingAppStore-$env:RELEASE_VERSION-full.nupkg\"");
    expect(release).toContain('Assert release source is the fresh origin/main tip');
    expect(release).toContain('Assert transferred package version matches the release version');
    expect(release).not.toContain('$tagRef = gh api');
    expect(release).not.toContain('if ($tagSha -ne $env:GITHUB_SHA)');
    expect(release).toContain('if ($publishedSha -ne $env:GITHUB_SHA)');
    expect(release.indexOf('gh release edit $env:RELEASE_TAG --repo $env:GITHUB_REPOSITORY --draft=false')).toBeLessThan(release.indexOf('if ($publishedSha -ne $env:GITHUB_SHA)'));
  });

  it('generates and reconciles the bounded current-release changelog without a repository loop', async () => {
    const release = await read('.github/workflows/release.yml');
    const tag = release.indexOf('- name: Compute unique release tag');
    const generate = release.indexOf('- name: Generate bounded in-app release manifest');
    const build = release.indexOf('- name: Build renderer, main process, and preload');
    expect(tag).toBeGreaterThan(-1);
    expect(generate).toBeGreaterThan(tag);
    expect(build).toBeGreaterThan(generate);
    expect(release).toContain("gh api --paginate --slurp \"repos/$env:GITHUB_REPOSITORY/releases?per_page=100\"");
    expect(release).toContain('release-inventory.raw.json');
    expect(release).toContain('scripts/compact-release-inventory.mjs');
    expect(release).toContain('scripts/generate-release-changelog.mjs');
    expect(release).toContain('--reconcile');
    expect(release).toContain('release-changelog.json');
    expect(release).not.toMatch(/git\s+(?:add|commit|push)\b/);
    const initialSource = release.indexOf('"- Source commit: ``$env:GITHUB_SHA``"');
    const publish = release.indexOf('gh release edit $env:RELEASE_TAG --repo $env:GITHUB_REPOSITORY --draft=false');
    expect(initialSource).toBeGreaterThan(-1);
    expect(initialSource).toBeLessThan(publish);
  });

  it('keeps every workspace Vitest package on the finite shared timeout policy', async () => {
    for (const packageName of ['catalog-contract', 'domain']) {
      const packageJson = JSON.parse(await readFile(path.join(root, 'packages', packageName, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
      expect(packageJson.scripts?.test).toContain('vitest run');
      const config = await readFile(path.join(root, 'packages', packageName, 'vitest.config.ts'), 'utf8');
      expect(config).toContain('testTimeout: 30_000');
      expect(config).toContain('hookTimeout: 30_000');
    }
  });

  it('compares generated documentation independently of checkout line endings', async () => {
    const generator = await read('scripts/docs-generate.mjs');
    expect(generator).toContain("replaceAll('\\r\\n', '\\n')");
    expect(generator).toContain('raw = normalizeNewlines(raw)');
    expect(generator).toContain('normalizeNewlines(actual) !== normalizeNewlines(content)');
  });
});
