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

