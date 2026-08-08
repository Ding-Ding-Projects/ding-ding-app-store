import { createHash } from 'node:crypto';
import path from 'node:path';

export interface RegistryUninstallEntry {
  key: string;
  displayName: string;
  displayVersion: string;
  installLocation: string;
  uninstallString: string;
}

export function parseRegistryUninstallOutput(input: string): RegistryUninstallEntry[] {
  const entries: RegistryUninstallEntry[] = [];
  let current: Record<string, string> | null = null;
  const flush = () => {
    if (!current?.key || !current.DisplayName) return;
    entries.push({
      key: current.key,
      displayName: current.DisplayName,
      displayVersion: current.DisplayVersion ?? '',
      installLocation: current.InstallLocation ?? '',
      uninstallString: current.UninstallString ?? '',
    });
  };
  for (const rawLine of input.replace(/\r/g, '').split('\n')) {
    const line = rawLine.trimEnd();
    if (/^HKEY_/i.test(line.trim())) {
      flush();
      current = { key: line.trim() };
      continue;
    }
    const match = line.match(/^\s+([^\s]+)\s+REG_[A-Z0-9_]+\s+(.*)$/i);
    if (match && current) current[match[1]] = match[2].trim();
  }
  flush();
  return entries;
}

export function extractMsiProductCode(uninstallString: string): string | null {
  const normalized = uninstallString.trim().replace(/^"|"$/g, '');
  const match = normalized.match(/^msiexec(?:\.exe)?\s+\/[ix]\s*({[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}})(?:\s.*)?$/i);
  return match?.[1].toUpperCase() ?? null;
}

export interface RegistrySnapshotResult {
  entries: RegistryUninstallEntry[];
  failedKeys: string[];
}

export async function collectRegistrySnapshotResult(
  keys: readonly string[],
  query: (key: string) => Promise<string>,
): Promise<RegistrySnapshotResult> {
  const results = await Promise.all(keys.map(async (key) => {
    try { return { key, output: await query(key), failed: false }; }
    catch { return { key, output: '', failed: true }; }
  }));
  return {
    entries: results.flatMap((result) => parseRegistryUninstallOutput(result.output)),
    failedKeys: results.filter((result) => result.failed).map((result) => result.key),
  };
}

export async function collectRegistrySnapshot(
  keys: readonly string[],
  query: (key: string) => Promise<string>,
  bestEffort = false,
): Promise<RegistryUninstallEntry[]> {
  const snapshot = await collectRegistrySnapshotResult(keys, query);
  if (!bestEffort && snapshot.failedKeys.length) {
    throw new Error(`Registry ownership snapshot is incomplete for ${snapshot.failedKeys.join(', ')}.`);
  }
  return snapshot.entries;
}

export function ownershipHiveKey(registryKey: string, configuredKeys: readonly string[]): string | null {
  const expand = (value: string) => value
    .replace(/^HKCU(?=\\)/i, 'HKEY_CURRENT_USER')
    .replace(/^HKLM(?=\\)/i, 'HKEY_LOCAL_MACHINE')
    .toLocaleLowerCase();
  const normalized = expand(registryKey);
  return [...configuredKeys]
    .sort((left, right) => right.length - left.length)
    .find((key) => normalized.startsWith(`${expand(key)}\\`)) ?? null;
}

export function exactDisplayNameMatch(displayName: string, allowedNames: readonly string[]): boolean {
  return allowedNames.some((name) => name.localeCompare(displayName, undefined, { sensitivity: 'accent' }) === 0);
}

export function registryEntryFingerprint(entry: RegistryUninstallEntry): string {
  return createHash('sha256').update(JSON.stringify({
    key: entry.key,
    displayName: entry.displayName,
    displayVersion: entry.displayVersion,
    installLocation: entry.installLocation,
    uninstallString: entry.uninstallString,
  })).digest('hex');
}

export function selectChangedRegistryEntry(
  before: readonly RegistryUninstallEntry[],
  after: readonly RegistryUninstallEntry[],
  allowedDisplayNames: readonly string[],
): RegistryUninstallEntry {
  const previous = new Map(before.map((entry) => [entry.key.toLocaleLowerCase(), registryEntryFingerprint(entry)]));
  const changed = after.filter((entry) => exactDisplayNameMatch(entry.displayName, allowedDisplayNames)
    && previous.get(entry.key.toLocaleLowerCase()) !== registryEntryFingerprint(entry));
  if (changed.length !== 1) throw new Error(`Expected exactly one new or changed reviewed registry entry after installation; found ${changed.length}.`);
  return changed[0];
}

export function selectSameVersionOwnedRegistryEntry(
  priorVersion: string | undefined,
  requestedVersion: string,
  ownership: { adapterId: string; registryKey: string; fingerprint: string } | null,
  adapterId: string,
  after: readonly RegistryUninstallEntry[],
  allowedDisplayNames: readonly string[],
): RegistryUninstallEntry | null {
  if (priorVersion !== requestedVersion || ownership?.adapterId !== adapterId) return null;
  return after.find((entry) => entry.key.localeCompare(ownership.registryKey, undefined, { sensitivity: 'accent' }) === 0
    && registryEntryFingerprint(entry) === ownership.fingerprint
    && exactDisplayNameMatch(entry.displayName, allowedDisplayNames)) ?? null;
}

export function extractQuotedExecutable(uninstallString: string): string | null {
  const value = uninstallString.trim();
  const quoted = value.match(/^"([^"\r\n]+\.exe)"(?:\s|$)/i);
  if (quoted) return quoted[1];
  const unquoted = value.match(/^([^\s"\r\n]+\.exe)(?:\s|$)/i);
  return unquoted?.[1] ?? null;
}

export function pathWithinRoots(candidate: string, roots: readonly string[]): boolean {
  const target = path.resolve(candidate);
  return roots.some((rootValue) => {
    if (!rootValue) return false;
    const root = path.resolve(rootValue);
    const relative = path.relative(root, target);
    return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
  });
}

export function safeReviewedUninstaller(
  entry: RegistryUninstallEntry,
  executableNames: readonly string[],
  allowedRoots: readonly string[],
): { executable: string; installRoot: string } | null {
  const expected = new Set(executableNames.map((name) => name.toLocaleLowerCase()));
  const commandExecutable = extractQuotedExecutable(entry.uninstallString);
  const candidates = commandExecutable
    ? [commandExecutable]
    : executableNames.map((name) => entry.installLocation ? path.join(entry.installLocation, name) : null)
      .filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (!expected.has(path.basename(candidate).toLocaleLowerCase()) || !pathWithinRoots(candidate, allowedRoots)) continue;
    const installRoot = entry.installLocation && pathWithinRoots(entry.installLocation, allowedRoots)
      ? path.resolve(entry.installLocation)
      : path.dirname(path.resolve(candidate));
    if (!pathWithinRoots(candidate, [installRoot])) continue;
    return { executable: path.resolve(candidate), installRoot };
  }
  return null;
}

export function safeSquirrelLocation(localAppData: string, installerName: string): { root: string; updateExecutable: string } | null {
  if (!/^[A-Za-z0-9_. -]{1,80}$/.test(installerName)) return null;
  const base = path.resolve(localAppData);
  const root = path.resolve(base, installerName);
  if (path.dirname(root).toLocaleLowerCase() !== base.toLocaleLowerCase()) return null;
  return { root, updateExecutable: path.join(root, 'Update.exe') };
}

export function latestSquirrelVersion(directoryNames: string[]): string | null {
  const versions = directoryNames.map((name) => name.match(/^app-([0-9]+(?:\.[0-9]+){1,3}(?:-[0-9A-Za-z.-]+)?)$/)?.[1]).filter((value): value is string => Boolean(value));
  const compare = (left: string, right: string) => {
    const a = left.split(/[.-]/).map((part) => /^\d+$/.test(part) ? Number(part) : part);
    const b = right.split(/[.-]/).map((part) => /^\d+$/.test(part) ? Number(part) : part);
    for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
      const av = a[index] ?? 0;
      const bv = b[index] ?? 0;
      if (typeof av === 'number' && typeof bv === 'number' && av !== bv) return av - bv;
      if (String(av) !== String(bv)) return String(av).localeCompare(String(bv));
    }
    return 0;
  };
  return versions.sort(compare).at(-1) ?? null;
}

