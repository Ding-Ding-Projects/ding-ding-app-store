import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import semver from 'semver';
import type { InstalledAppRecord, InstallOwnership, UninstallDescriptor } from '../shared/contracts.js';
import type { CatalogRecord } from './catalog-service.js';
import { CatalogService } from './catalog-service.js';
import { adapterFor, type ExecutableInstallAdapter } from './install-adapters.js';
import {
  collectRegistrySnapshot,
  collectRegistrySnapshotResult,
  exactDisplayNameMatch,
  extractMsiProductCode,
  isConfirmedMissingRegistryKey,
  latestSquirrelVersion,
  ownershipHiveKey,
  registryEntryFingerprint,
  selectChangedRegistryEntry,
  selectSameVersionOwnedRegistryEntry,
  selectOwnedRegistryEntry,
  selectUniqueReviewedRegistryEntry,
  safeReviewedUninstaller,
  type RegistryUninstallEntry,
} from './installed-detection.js';
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
    let overflow = false;
    child.stdout.on('data', (chunk: string) => {
      if (stdout.length + chunk.length > 8_000_000) overflow = true;
      else stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length + chunk.length > 256_000) overflow = true;
      else stderr += chunk;
    });
    const timer = setTimeout(() => { child.kill(); reject(new Error('Installed-app discovery timed out.')); }, timeoutMs);
    child.once('error', (error) => { clearTimeout(timer); reject(error); });
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (overflow) reject(new Error('Registry discovery output exceeded its safety limit.'));
      else if (code === 0 || isConfirmedMissingRegistryKey(code, stderr)) resolve(stdout);
      else reject(new Error(`Registry discovery failed with code ${code}: ${stderr.trim()}`));
    });
  });
}

export class InstalledService {
  readonly installedPath = path.join(app.getPath('userData'), 'installed-apps.v1.json');
  readonly managedPortableRoot = path.join(app.getPath('userData'), 'portable');

  constructor(private readonly catalog: CatalogService) {}

  async list(discover = true): Promise<InstalledAppRecord[]> {
    if (discover) return await this.discover();
    return await readJson<InstalledAppRecord[]>(this.installedPath, []);
  }

  async discover(): Promise<InstalledAppRecord[]> {
    const manifest = await this.catalog.manifest();
    const previous = new Map((await readJson<InstalledAppRecord[]>(this.installedPath, [])).map((record) => [record.appId, record]));
    const snapshot = await this.registrySnapshotBestEffort();
    const now = new Date().toISOString();
    const result: InstalledAppRecord[] = [];
    const retained: InstalledAppRecord[] = [];
    for (const record of manifest.apps) {
      const prior = previous.get(record.id);
      if (prior?.ownership?.kind === 'registry') {
        const hive = ownershipHiveKey(prior.ownership.registryKey, REGISTRY_KEYS);
        if (hive && snapshot.failedKeys.includes(hive)) {
          retained.push(prior);
          continue;
        }
      }
      if (!prior?.ownership && snapshot.failedKeys.length > 0) continue;
      const discovered = await this.discoverRecord(record, snapshot.entries, now, prior?.ownership ?? null);
      if (!discovered) continue;
      result.push({ ...discovered, installedAt: prior?.installedAt ?? discovered.installedAt });
      if (discovered.ownership) retained.push({ ...discovered, installedAt: prior?.installedAt ?? discovered.installedAt });
    }
    result.sort((left, right) => left.displayName.localeCompare(right.displayName));
    await writeJsonAtomic(this.installedPath, retained.sort((left, right) => left.displayName.localeCompare(right.displayName)));
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
    const record = await this.catalog.recordFor(appId);
    const prior = (await this.list(false)).find((candidate) => candidate.appId === appId);
    if (!prior?.ownership) return null;
    // Managed portable installs have no registry authority. Re-discover them
    // from their app-owned path without touching the Windows registry, which
    // may be unavailable or incomplete on a fresh cloud runner.
    if (prior.ownership.kind === 'portable') {
      return await this.discoverRecord(record, [], new Date().toISOString(), prior.ownership);
    }
    const registry = await this.registrySnapshot();
    return await this.discoverRecord(record, registry, new Date().toISOString(), prior.ownership);
  }

  async registrySnapshot(): Promise<RegistryUninstallEntry[]> {
    const reg = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'reg.exe');
    return await collectRegistrySnapshot(REGISTRY_KEYS, async (key) => await capture(reg, ['query', key, '/s']));
  }

  private async registrySnapshotBestEffort(): Promise<{ entries: RegistryUninstallEntry[]; failedKeys: string[] }> {
    const reg = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'reg.exe');
    return await collectRegistrySnapshotResult(REGISTRY_KEYS, async (key) => await capture(reg, ['query', key, '/s']));
  }

  async recordInstalledFromRegistry(record: CatalogRecord, before: readonly RegistryUninstallEntry[], version: string): Promise<InstalledAppRecord> {
    const adapter = adapterFor(record.id);
    if (!adapter.supported || adapter.family === 'portable-zip') throw new Error('The application does not use a registry-owned installer adapter.');
    const after = await this.registrySnapshot();
    let changed: RegistryUninstallEntry;
    let requiresInstalledVersionProof = false;
    try {
      changed = selectChangedRegistryEntry(before, after, adapter.registryDisplayNames);
    } catch (error) {
      if (!(error as Error).message.endsWith('found 0.')) throw error;
      const prior = (await this.list(false)).find((candidate) => candidate.appId === record.id);
      const priorOwnership = prior?.ownership?.kind === 'registry' ? prior.ownership : null;
      const retained = selectSameVersionOwnedRegistryEntry(prior?.version, version, priorOwnership, adapter.id, after, adapter.registryDisplayNames);
      if (retained) changed = retained;
      else {
        const unchangedOwned = selectOwnedRegistryEntry(priorOwnership, adapter.id, after, adapter.registryDisplayNames);
        if (!unchangedOwned) throw error;
        changed = unchangedOwned;
        requiresInstalledVersionProof = true;
      }
    }
    const ownership: InstallOwnership = {
      kind: 'registry', adapterId: adapter.id, registryKey: changed.key, fingerprint: registryEntryFingerprint(changed),
    };
    const discovered = await this.discoverRegistry(record, adapter, [changed], new Date().toISOString(), ownership);
    if (!discovered?.uninstall) throw new Error('The new registry entry did not contain the reviewed uninstall identity.');
    if (requiresInstalledVersionProof) {
      const requested = semver.coerce(version);
      const observed = semver.coerce(discovered.version);
      if (!requested || !observed || !semver.eq(requested, observed)) {
        throw new Error(`The installer exited successfully, but the unchanged owned registry entry did not expose the requested installed version. Observed ${discovered.version || 'unknown'}.`);
      }
    }
    const installedRecord = { ...discovered, version, source: 'store' as const, installedAt: new Date().toISOString() };
    if (adapter.family === 'squirrel') {
      const requested = semver.coerce(version);
      const observed = semver.coerce(discovered.version);
      const appDirectory = discovered.installRoot && requested ? path.join(discovered.installRoot, `app-${requested.version}`) : null;
      if (!requested || !observed || semver.compare(requested, observed) !== 0 || !appDirectory || !await exists(appDirectory)) {
        throw new Error('The installer exited successfully, but the requested Squirrel app directory did not independently prove the installed version.');
      }
    }
    await this.record(installedRecord);
    return installedRecord;
  }

  private async discoverRecord(
    record: CatalogRecord,
    entries: RegistryUninstallEntry[],
    detectedAt: string,
    ownership: InstallOwnership | null,
  ): Promise<InstalledAppRecord | null> {
    const adapter = adapterFor(record.id);
    if (!adapter.supported) return null;
    if (adapter.family === 'portable-zip') return await this.discoverPortable(record, adapter.executableRelativePath, detectedAt, ownership);
    return await this.discoverRegistry(record, adapter, entries, detectedAt, ownership);
  }

  private async discoverRegistry(
    record: CatalogRecord,
    adapter: ExecutableInstallAdapter,
    entries: RegistryUninstallEntry[],
    detectedAt: string,
    ownership: InstallOwnership | null,
  ): Promise<InstalledAppRecord | null> {
    const owned = ownership?.kind === 'registry'
      && ownership.adapterId === adapter.id
      && /^[0-9a-f]{64}$/.test(ownership.fingerprint)
      && /^HKEY_(?:CURRENT_USER|LOCAL_MACHINE)\\/i.test(ownership.registryKey);
    if (ownership && (!owned || ownership.kind !== 'registry')) return null;
    const entry = owned && ownership?.kind === 'registry'
      ? entries.find((candidate) => candidate.key.localeCompare(ownership.registryKey, undefined, { sensitivity: 'accent' }) === 0
        && registryEntryFingerprint(candidate) === ownership.fingerprint
        && exactDisplayNameMatch(candidate.displayName, adapter.registryDisplayNames)) ?? null
      : selectUniqueReviewedRegistryEntry(entries, adapter.registryDisplayNames);
    if (!entry) return null;
    {
      let uninstall: UninstallDescriptor | null = null;
      if (adapter.family === 'msi' || adapter.family === 'jpackage') {
        const productCode = extractMsiProductCode(entry.uninstallString);
        if (!productCode) return null;
        if (owned) uninstall = { kind: 'msi', executable: 'msiexec.exe', arguments: ['/x', productCode, '/qn', '/norestart'] };
        return {
          appId: record.id, displayName: record.displayName, version: entry.displayVersion || 'unknown', packageType: adapter.packageType,
          source: owned ? 'store' : 'msi-registry', installRoot: owned ? entry.installLocation || null : null, uninstall,
          ownership: owned ? ownership : null, installedAt: null, detectedAt,
        };
      }

      const localAppData = process.env.LOCALAPPDATA ?? app.getPath('home');
      const allowedRoots = adapter.family === 'squirrel'
        ? [localAppData]
        : [localAppData, process.env.ProgramFiles ?? 'C:\\Program Files', process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)'];
      const reviewed = safeReviewedUninstaller(entry, adapter.uninstallExecutableNames ?? [], allowedRoots);
      if (!reviewed || !await exists(reviewed.executable)) return null;
      const version = adapter.family === 'squirrel'
        ? ((latestSquirrelVersion(await readdir(reviewed.installRoot).catch(() => [])) ?? entry.displayVersion) || 'unknown')
        : entry.displayVersion || 'unknown';
      if (owned) {
        uninstall = adapter.family === 'squirrel'
          ? { kind: 'squirrel', executable: reviewed.executable, arguments: ['--uninstall', '-s'] }
          : { kind: 'reviewed-executable', executable: reviewed.executable, arguments: [...(adapter.uninstallArguments ?? [])], adapterId: adapter.id };
      }
      return {
        appId: record.id, displayName: record.displayName, version, packageType: adapter.packageType,
        source: owned ? 'store' : adapter.family === 'squirrel' ? 'squirrel-discovery' : 'reviewed-registry',
        installRoot: owned ? reviewed.installRoot : null,
        uninstall, ownership: owned ? ownership : null, installedAt: null, detectedAt,
      };
    }
  }

  private async discoverPortable(record: CatalogRecord, executableRelativePath: string, detectedAt: string, ownership: InstallOwnership | null): Promise<InstalledAppRecord | null> {
    const root = path.join(this.managedPortableRoot, record.id);
    if (!await exists(path.join(root, executableRelativePath))) return null;
    const prior = (await this.list(false)).find((item) => item.appId === record.id);
    const adapter = adapterFor(record.id);
    const owned = ownership?.kind === 'portable'
      && ownership.adapterId === adapter.id
      && path.resolve(ownership.installRoot).toLocaleLowerCase() === path.resolve(root).toLocaleLowerCase();
    if (!owned) return null;
    return {
      appId: record.id, displayName: record.displayName, version: prior?.version ?? 'managed', packageType: record.packageType,
      source: 'portable-managed', installRoot: root, uninstall: { kind: 'portable', executable: null, arguments: [] },
      ownership, installedAt: prior?.installedAt ?? null, detectedAt,
    };
  }
}
