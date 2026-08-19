import { readFile } from 'node:fs/promises';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
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
    expect(common).toContain('function Get-PeSignatureStatus');
    expect(common).toContain('IMAGE_DIRECTORY_ENTRY_SECURITY');
    expect(common).toContain('CertificateTablePresent');
    expect(common).toContain("Status -ne 'NotSigned'");
    expect(common).toContain('local-installer.v1');
    expect(common).not.toMatch(/gh\s+release|git\s+(?:push|tag)|forceCodeSigning\s*=\s*\$true/i);
    expect(local).toContain('param([switch]$Silent)');
    expect(installer).toContain('param([switch]$Silent)');
    expect(installer).toContain('Invoke-ProjectInstaller');
    expect(installer).toContain('Get-Sha256 -LiteralPath $result.Setup.FullName');
    expect(installer).not.toMatch(/\bGet-FileHash\b/);
  });

  it('has a fail-closed regression for removing the bounded PE inspection route', async () => {
    const common = await read('scripts/build-common.ps1');
    const required = [
      'function Get-PeSignatureStatus',
      'CertificateTablePresent',
      'Get-PeSignatureStatus -LiteralPath $setup.FullName',
    ];
    const assertInspectionRoute = (source: string) => {
      for (const marker of required) if (!source.includes(marker)) throw new Error(`Missing signature inspection marker: ${marker}`);
    };
    assertInspectionRoute(common);
    const broken = common.replaceAll('Get-PeSignatureStatus -LiteralPath $setup.FullName', '');
    expect(() => assertInspectionRoute(broken)).toThrow(/Missing signature inspection marker/);
  });

  it('grades deterministic PE fixtures and rejects malformed or truncated input', async () => {
    if (process.platform !== 'win32') return;
    const directory = await mkdtemp(path.join(os.tmpdir(), 'ding-ding-pe-signature-'));
    const fixture = (certificateOffset = 0, certificateSize = 0): Buffer => {
      const bytes = Buffer.alloc(512);
      bytes.writeUInt16LE(0x5a4d, 0);
      bytes.writeUInt32LE(0x80, 0x3c);
      bytes.writeUInt32LE(0x00004550, 0x80);
      bytes.writeUInt16LE(0x00e0, 0x94);
      bytes.writeUInt16LE(0x010b, 0x98);
      bytes.writeUInt32LE(certificateOffset, 0x98 + 96 + 32);
      bytes.writeUInt32LE(certificateSize, 0x98 + 96 + 36);
      return bytes;
    };
    const run = (file: string) => {
      const escapedFile = file.replaceAll("'", "''");
      return spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', `$ErrorActionPreference = 'Stop'; . '${path.join(root, 'scripts/build-common.ps1')}'; (Get-PeSignatureStatus -LiteralPath '${escapedFile}').Status`], { encoding: 'utf8' });
    };
    try {
      const unsigned = path.join(directory, 'unsigned.exe');
      const present = path.join(directory, 'certificate-table.exe');
      const malformed = path.join(directory, 'malformed.exe');
      const truncated = path.join(directory, 'truncated.exe');
      await writeFile(unsigned, fixture());
      await writeFile(present, fixture(400, 32));
      await writeFile(malformed, Buffer.from('not-a-pe'));
      const truncatedBytes = Buffer.alloc(64);
      truncatedBytes.writeUInt16LE(0x5a4d, 0);
      truncatedBytes.writeUInt32LE(0x80, 0x3c);
      await writeFile(truncated, truncatedBytes);
      const requireStatus = (result: ReturnType<typeof run>, expected: string) => {
        if (result.status !== 0) throw new Error(`PowerShell fixture probe failed: ${result.stderr}`);
        expect(result.stdout.trim()).toBe(expected);
      };
      requireStatus(run(unsigned), 'NotSigned');
      requireStatus(run(present), 'CertificateTablePresent');
      expect(run(malformed).status).not.toBe(0);
      expect(run(truncated).status).not.toBe(0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
