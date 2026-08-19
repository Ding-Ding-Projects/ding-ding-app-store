import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '..');
const read = (file: string) => readFile(path.join(root, file), 'utf8');

describe('fresh-machine build entry points', () => {
  it('exposes silent and interactive Windows wrappers', async () => {
    const build = await read('build.bat');
    const installer = await read('build-installer.bat');
    for (const wrapper of [build, installer]) {
      expect(wrapper).toContain('powershell.exe -NoProfile -ExecutionPolicy Bypass');
      expect(wrapper).toContain('/s');
      expect(wrapper).toContain('--silent');
      expect(wrapper).toContain('SILENT');
      expect(wrapper).toContain('exit /b %ERRORLEVEL%');
    }
    expect(build).toContain('scripts\\build-local.ps1');
    expect(installer).toContain('scripts\\build-installer.ps1');
  });

  it('builds from the lockfile and verifies the unsigned Squirrel artifact', async () => {
    const common = await read('scripts/build-common.ps1');
    const local = await read('scripts/build-local.ps1');
    const installer = await read('scripts/build-installer.ps1');
    expect(common).toContain('npm ci');
    expect(common).toContain("@('run', 'build')");
    expect(common).toContain('https://nodejs.org/dist/');
    expect(common).toContain('function Get-Sha256');
    expect(common).toContain('[Security.Cryptography.SHA256]::Create()');
    expect(common).toContain('[IO.File]::OpenRead($LiteralPath)');
    expect(common).toContain('Get-Sha256 -LiteralPath $archive');
    expect(common).not.toMatch(/\bGet-FileHash\b/);
    expect(common).toContain('electron-builder');
    expect(common).toContain("'--win', 'squirrel', '--publish', 'never'");
    expect(common).toContain('function Get-SafeAuthenticodeSignature');
    expect(common).toContain('Import-Module Microsoft.PowerShell.Security -Force -ErrorAction Stop');
    expect(common).toContain('Microsoft.PowerShell.Security\\Get-AuthenticodeSignature');
    expect(common).toContain("Status -ne 'NotSigned'");
    expect(common).toContain('local-installer.v1');
    expect(common).not.toMatch(/gh\s+release|git\s+(?:push|tag)|forceCodeSigning\s*=\s*\$true/i);
    expect(local).toContain('param([switch]$Silent)');
    expect(installer).toContain('param([switch]$Silent)');
    expect(installer).toContain('Invoke-ProjectInstaller');
    expect(installer).toContain('Get-Sha256 -LiteralPath $result.Setup.FullName');
    expect(installer).not.toMatch(/\bGet-FileHash\b/);
  });

  it('has a fail-closed regression for removing the explicit signature inspection route', async () => {
    const common = await read('scripts/build-common.ps1');
    const required = [
      'Import-Module Microsoft.PowerShell.Security -Force -ErrorAction Stop',
      'Microsoft.PowerShell.Security\\Get-AuthenticodeSignature',
      'Get-SafeAuthenticodeSignature -LiteralPath $setup.FullName',
    ];
    const assertInspectionRoute = (source: string) => {
      for (const marker of required) if (!source.includes(marker)) throw new Error(`Missing signature inspection marker: ${marker}`);
    };
    assertInspectionRoute(common);
    const broken = common.replaceAll('Get-SafeAuthenticodeSignature -LiteralPath $setup.FullName', 'Get-AuthenticodeSignature -LiteralPath $setup.FullName');
    expect(() => assertInspectionRoute(broken)).toThrow(/Missing signature inspection marker/);
  });
});
