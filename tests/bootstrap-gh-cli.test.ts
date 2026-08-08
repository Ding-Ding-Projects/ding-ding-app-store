import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const script = path.join(root, 'scripts', 'bootstrap-gh-cli.ps1');
let scratch = '';

beforeAll(async () => {
  scratch = await mkdtemp(path.join(os.tmpdir(), 'ding-ding-gh-version-'));
});

afterAll(async () => {
  if (scratch.startsWith(os.tmpdir())) await rm(scratch, { recursive: true, force: true });
});

async function fakeGh(version: string, exitCode = 0) {
  const executable = path.join(scratch, `gh-${version.replaceAll('.', '-')}-${exitCode}.cmd`);
  await writeFile(executable, `@echo off\r\necho gh version ${version} ^(2026-07-31^)\r\necho https://github.com/cli/cli/releases/tag/v${version}\r\nexit /b ${exitCode}\r\n`, 'utf8');
  return executable;
}

async function fakeGhWithLines(name: string, lines: string[]) {
  const executable = path.join(scratch, `${name}.cmd`);
  await writeFile(executable, `@echo off\r\n${lines.map((line) => `echo ${line}`).join('\r\n')}\r\nexit /b 0\r\n`, 'utf8');
  return executable;
}

function validate(executable: string) {
  const command = `. '${script.replaceAll("'", "''")}' -FunctionsOnly; Assert-GitHubCliVersion -Executable '${executable.replaceAll("'", "''")}' -ExpectedVersion '2.97.0'`;
  return spawnSync('pwsh', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8', windowsHide: true });
}

describe('pinned GitHub CLI version validation', () => {
  it('accepts the real two-line gh version shape when the first line matches', async () => {
    const result = validate(await fakeGh('2.97.0'));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('gh version 2.97.0 (2026-07-31)');
    expect(result.stdout).toContain('https://github.com/cli/cli/releases/tag/v2.97.0');
  });

  it('rejects a different version even when its output is otherwise well formed', async () => {
    const result = validate(await fakeGh('2.96.0'));
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain('did not report pinned version 2.97.0');
  });

  it('rejects matching version text from an executable that exits nonzero', async () => {
    const result = validate(await fakeGh('2.97.0', 9));
    expect(result.status).not.toBe(0);
  });

  it('rejects expected version text that appears only after a wrong first line', async () => {
    const executable = await fakeGhWithLines('gh-late-match', [
      'gh version 2.96.0 ^(2026-07-01^)',
      'gh version 2.97.0 ^(2026-07-31^)',
    ]);
    expect(validate(executable).status).not.toBe(0);
  });
});
