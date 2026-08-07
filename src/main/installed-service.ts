import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { InstalledAppRecord, PackageType } from '../shared/contracts.js';
import type { CatalogRecord } from './catalog-service.js';
import { CatalogService } from './catalog-service.js';
import { extractMsiProductCode, latestSquirrelVersion, parseRegistryUninstallOutput, safeSquirrelLocation, type RegistryUninstallEntry } from './installed-detection.js';
import { readJson, writeJsonAtomic } from './json-store.js';

const REGISTRY_KEYS = [
  'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
  'HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
];

async function exists(filePath: string): Promise<boolean> {
  try { await access(filePath, constants.F_OK); return true; } catch { return false; }
}

async function capture(executable: string, arguments_: string[], timeoutMs = 30_000): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(executable, arguments_, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { if (stdout.length < 8_000_000) stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { if (stderr.length < 256_000) stderr += chunk; });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Installed-app discovery timed out.')); }, timeoutMs);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (code === 0 || code === 1) resolve(stdout);
      else reject(new Error(`Registry discovery failed with code ${code}: ${stderr.trim()}`));
    });
  });
}

export class InstalledService {
  readonly installedPath = path.join(app.getPath('userData'), 'installed-apps.v1.json');
  private readonly managedPortableRoot = path.join(app.getPath('userData'), 'portable');

  constructor(private readonly catalog: CatalogService) {}

  async list(discover = true): Promise<InstalledAppRecord[]> {
    if (discover) return await this.discover();
    return await readJson<InstalledAppRecord[]>(this.installedPath, []);
  }

  async discover(): Promise<InstalledAppRecord[]> {
    const manifest = await this.catalog.manifest();
    const existing = await readJson<InstalledAppRecord[]>(this.installedPath, []);
    const byId = new Map(existing.filter((record) => record?.appId).map((record) => [record.appId, record]));
    const registry = await this.registryEntries();
    const now = new Date().toISOString();

    for (const record of manifest.apps) {
      const squirrel = await this.discoverSquirrel(record, now);
      if (squirrel) byId.set(record.id, { ...byId.get(record.id), ...squirrel });
      const msi = this.discoverMsi(record, registry, now);
      if (msi) byId.set(record.id, { ...byId.get(record.id), ...msi });
      const portable = await this.discoverPortable(record, now);
      if (portable) byId.set(record.id, { ...byId.get(record.id), ...portable });
    }

    const result = [...byId.values()].sort((left, right) => left.displayName.localeCompare(right.displayName));
    await writeJsonAtomic(this.installedPath, result);
    return result;
  }

  async record(record: InstalledAppRecord): Promise<void> {
    const installed = await this.list(false);
    await writeJsonAtomic(this.installedPath, [...installed.filter((item) => item.appId !== record.appId), record].sort((left, right) => left.displayName.localeCompare(right.displayName)));
  }

  async remove(appId: string): Promise<void> {
    await writeJsonAtomic(this.installedPath, (await this.list(false)).filter((record) => record.appId !== appId));
  }

  async get(appId: string): Promise<InstalledAppRecord | null> {
    return (await this.list(true)).find((record) => record.appId === appId) ?? null;
  }

  private async registryEntries(): Promise<RegistryUninstallEntry[]> {
    const reg = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'reg.exe');
    const outputs = await Promise.all(REGISTRY_KEYS.map((key) => capture(reg, ['query', key, '/s']).catch(() => '')));
    return outputs.flatMap(parseRegistryUninstallOutput);
  }

  private async discoverSquirrel(record: CatalogRecord, detectedAt: string): Promise<InstalledAppRecord | null> {
    if (record.uninstallStrategy !== 'squirrel' || !record.installerName) return null;
    const location = safeSquirrelLocation(process.env.LOCALAPPDATA ?? app.getPath('home'), record.installerName);
    if (!location || !await exists(location.updateExecutable)) return null;
    const version = latestSquirrelVersion(await readdir(location.root).catch(() => [])) ?? 'unknown';
    return {
      appId: record.id, displayName: record.displayName, version, packageType: 'squirrel', source: 'squirrel-discovery',
      installRoot: location.root, uninstall: { kind: 'squirrel', executable: location.updateExecutable, arguments: ['--uninstall', '-s'] },
      installedAt: null, detectedAt,
    };
  }

  private discoverMsi(record: CatalogRecord, entries: RegistryUninstallEntry[], detectedAt: string): InstalledAppRecord | null {
    if (record.uninstallStrategy !== 'msi-registry') return null;
    const entry = entries.find((candidate) => candidate.displayName.localeCompare(record.displayName, undefined, { sensitivity: 'accent' }) === 0);
    const productCode = entry && extractMsiProductCode(entry.uninstallString);
    if (!entry || !productCode) return null;
    return {
      appId: record.id, displayName: record.displayName, version: entry.displayVersion || 'unknown', packageType: 'msi', source: 'msi-registry',
      installRoot: entry.installLocation || null, uninstall: { kind: 'msi', executable: 'msiexec.exe', arguments: ['/x', productCode, '/qn', '/norestart'] },
      installedAt: null, detectedAt,
    };
  }

  private async discoverPortable(record: CatalogRecord, detectedAt: string): Promise<InstalledAppRecord | null> {
    if (record.uninstallStrategy !== 'portable-folder') return null;
    const root = path.join(this.managedPortableRoot, record.id);
    if (!await exists(root)) return null;
    return {
      appId: record.id, displayName: record.displayName, version: 'managed', packageType: record.packageType as PackageType, source: 'portable-managed',
      installRoot: root, uninstall: { kind: 'portable', executable: null, arguments: [] }, installedAt: null, detectedAt,
    };
  }
}

