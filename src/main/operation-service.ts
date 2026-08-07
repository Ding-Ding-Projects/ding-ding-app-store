import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { access, mkdir, open, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { app } from 'electron';
import type { OperationRequest, OperationResult } from '../shared/contracts.js';
import { CatalogService, type CatalogRecord, type ReleaseAsset } from './catalog-service.js';
import { readJson, writeJsonAtomic } from './json-store.js';

const MAX_DOWNLOAD_BYTES = 1_500_000_000;
const REDIRECT_HOSTS = new Set(['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com']);

interface InstalledRecord {
  appId: string;
  displayName: string;
  version: string;
  installedAt: string;
  packageType: string;
  installRoot: string | null;
  uninstallExecutable: string | null;
  uninstallArguments: string[];
}

async function run(executable: string, args: string[], timeoutMs = 15 * 60_000): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      stdio: 'ignore',
      env: {
        SystemRoot: process.env.SystemRoot,
        WINDIR: process.env.WINDIR,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
        LOCALAPPDATA: process.env.LOCALAPPDATA,
        PATH: process.env.SystemRoot ? `${process.env.SystemRoot}\\System32` : undefined,
      },
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('The installer exceeded the 15-minute safety limit.'));
    }, timeoutMs);
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve(code ?? -1);
    });
  });
}

async function downloadVerified(asset: ReleaseAsset, destination: string): Promise<void> {
  const digest = asset.digest?.match(/^sha256:([a-fA-F0-9]{64})$/)?.[1]?.toLowerCase();
  if (!digest) throw new Error('This release asset has no GitHub SHA-256 digest, so safe installation is unavailable.');
  if (asset.size <= 0 || asset.size > MAX_DOWNLOAD_BYTES) throw new Error('The release asset size is outside the allowed range.');

  let url = new URL(asset.browser_download_url);
  let response: Response | null = null;
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    if (url.protocol !== 'https:' || url.username || url.password || !REDIRECT_HOSTS.has(url.hostname)) {
      throw new Error(`Blocked release asset origin: ${url.origin}`);
    }
    response = await fetch(url, {
      redirect: 'manual',
      headers: { 'User-Agent': 'Ding-Ding-App-Store' },
      signal: AbortSignal.timeout(120_000),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Release download redirected without a destination.');
      url = new URL(location, url);
      continue;
    }
    break;
  }
  if (!response?.ok || !response.body) throw new Error(`Release download failed: HTTP ${response?.status ?? 0}`);

  const handle = await open(destination, 'wx', 0o600);
  const hash = createHash('sha256');
  let received = 0;
  try {
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > asset.size || received > MAX_DOWNLOAD_BYTES) throw new Error('Release download exceeded its declared size.');
      hash.update(value);
      await handle.write(value);
    }
  } finally {
    await handle.close();
  }
  if (received !== asset.size) throw new Error(`Release download size mismatch: expected ${asset.size}, received ${received}.`);
  if (hash.digest('hex') !== digest) throw new Error('Release asset SHA-256 digest mismatch.');
}

export class OperationService {
  private readonly installedPath = path.join(app.getPath('userData'), 'installed-apps.v1.json');
  private readonly stagingRoot = path.join(app.getPath('userData'), 'staging');

  constructor(private readonly catalog: CatalogService) {}

  async install(request: OperationRequest): Promise<OperationResult> {
    const record = await this.catalog.recordFor(request.appId);
    if (request.confirmation !== `INSTALL ${record.displayName}`) {
      return { ok: false, appId: request.appId, message: `Type INSTALL ${record.displayName} to confirm.` };
    }
    if (!['squirrel', 'msi'].includes(record.packageType) || !record.assetPattern) {
      return { ok: false, appId: request.appId, message: 'A reviewed silent-install adapter is not available for this application yet.' };
    }

    const release = await this.catalog.latestRelease(record.repository);
    if (!release || release.draft || release.prerelease) {
      return { ok: false, appId: request.appId, message: 'No stable published release is available.' };
    }
    const pattern = new RegExp(record.assetPattern, 'i');
    const matches = release.assets.filter((asset) => pattern.test(asset.name));
    if (matches.length !== 1) {
      return { ok: false, appId: request.appId, message: `Expected exactly one reviewed installer asset; found ${matches.length}.` };
    }

    const operationId = randomUUID();
    const operationDir = path.join(this.stagingRoot, operationId);
    await mkdir(operationDir, { recursive: true });
    const installerPath = path.join(operationDir, path.basename(matches[0].name));
    try {
      await downloadVerified(matches[0], installerPath);
      const exitCode = record.packageType === 'squirrel'
        ? await run(installerPath, ['--silent'])
        : await run(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'msiexec.exe'), ['/i', installerPath, '/qn', '/norestart']);
      if (exitCode !== 0) throw new Error(`Installer exited with code ${exitCode}.`);
      await this.recordInstalled(record, release.tag_name);
      return { ok: true, appId: request.appId, operationId, message: `${record.displayName} ${release.tag_name} installed successfully.` };
    } catch (error) {
      return { ok: false, appId: request.appId, operationId, message: (error as Error).message };
    } finally {
      await rm(operationDir, { recursive: true, force: true });
    }
  }

  async build(request: OperationRequest): Promise<OperationResult> {
    const record = await this.catalog.recordFor(request.appId);
    if (request.confirmation !== `BUILD ${record.displayName}`) {
      return { ok: false, appId: request.appId, message: `Type BUILD ${record.displayName} to confirm.` };
    }
    if (!record.sourceManifest) {
      return { ok: false, appId: request.appId, message: 'This application has no reviewed source-build manifest.' };
    }
    return {
      ok: false,
      appId: request.appId,
      message: 'The source recipe is catalogued, but execution is withheld until the disposable Windows Sandbox runner is available. Host-side scripts are never executed directly.',
    };
  }

  async uninstall(request: OperationRequest): Promise<OperationResult> {
    const record = await this.catalog.recordFor(request.appId);
    if (request.confirmation !== `UNINSTALL ${record.displayName}`) {
      return { ok: false, appId: request.appId, message: `Type UNINSTALL ${record.displayName} to confirm.` };
    }
    const installed = await readJson<InstalledRecord[]>(this.installedPath, []);
    const current = installed.find((item) => item.appId === request.appId);
    if (!current?.uninstallExecutable) {
      return { ok: false, appId: request.appId, message: 'No verified uninstall entry was recorded for this application.' };
    }
    try {
      await access(current.uninstallExecutable, constants.X_OK);
      const exitCode = await run(current.uninstallExecutable, current.uninstallArguments);
      if (exitCode !== 0) throw new Error(`Uninstaller exited with code ${exitCode}.`);
      await writeJsonAtomic(this.installedPath, installed.filter((item) => item.appId !== request.appId));
      return { ok: true, appId: request.appId, message: `${record.displayName} was uninstalled.` };
    } catch (error) {
      return { ok: false, appId: request.appId, message: (error as Error).message };
    }
  }

  private async recordInstalled(record: CatalogRecord, version: string): Promise<void> {
    const installed = await readJson<InstalledRecord[]>(this.installedPath, []);
    const installRoot = record.packageType === 'squirrel' && record.installerName
      ? path.join(process.env.LOCALAPPDATA ?? app.getPath('home'), record.installerName)
      : null;
    const entry: InstalledRecord = {
      appId: record.id,
      displayName: record.displayName,
      version,
      installedAt: new Date().toISOString(),
      packageType: record.packageType,
      installRoot,
      uninstallExecutable: installRoot ? path.join(installRoot, 'Update.exe') : null,
      uninstallArguments: installRoot ? ['--uninstall', '-s'] : [],
    };
    await writeJsonAtomic(this.installedPath, [...installed.filter((item) => item.appId !== record.id), entry]);
  }
}
