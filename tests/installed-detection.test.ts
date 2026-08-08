import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectRegistrySnapshot, collectRegistrySnapshotResult, exactDisplayNameMatch, extractMsiProductCode, extractQuotedExecutable, isConfirmedMissingRegistryKey, latestSquirrelVersion, ownershipHiveKey, parseRegistryUninstallOutput, pathWithinRoots, registryEntryFingerprint, safeReviewedUninstaller, safeSquirrelLocation, selectChangedRegistryEntry, selectSameVersionOwnedRegistryEntry, selectUniqueReviewedRegistryEntry } from '../src/main/installed-detection';

describe('installed-app detection', () => {
  it('accepts only the exact reg.exe key-not-found result as a confirmed empty hive', () => {
    const missing = 'ERROR: The system was unable to find the specified registry key or value.\r\n';
    expect(isConfirmedMissingRegistryKey(1, missing)).toBe(true);
    expect(isConfirmedMissingRegistryKey(0, missing)).toBe(false);
    expect(isConfirmedMissingRegistryKey(1, 'ERROR: Access is denied.')).toBe(false);
    expect(isConfirmedMissingRegistryKey(1, `${missing}unexpected detail`)).toBe(false);
    expect(isConfirmedMissingRegistryKey(null, missing)).toBe(false);
  });

  it('parses multiple Windows uninstall registry records', () => {
    const records = parseRegistryUninstallOutput(`
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\One
    DisplayName    REG_SZ    Desktop Material
    DisplayVersion    REG_SZ    3.4.5
    InstallLocation    REG_SZ    C:\\Users\\Ada\\AppData\\Local\\DesktopMaterial
    UninstallString    REG_SZ    MsiExec.exe /I{12345678-1234-1234-1234-1234567890ab}

HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Two
    DisplayName    REG_SZ    Material BlueMap
    DisplayVersion    REG_SZ    1.2.3
`);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ displayName: 'Desktop Material', displayVersion: '3.4.5' });
    expect(records[1].displayName).toBe('Material BlueMap');
  });

  it('ignores registry keys without a display name', () => {
    expect(parseRegistryUninstallOutput('HKEY_LOCAL_MACHINE\\Software\\Empty\n    Version    REG_SZ    1.0')).toEqual([]);
  });

  it('accepts only exact MSI product-code uninstall shapes', () => {
    expect(extractMsiProductCode('MsiExec.exe /I{12345678-1234-1234-1234-1234567890ab}')).toBe('{12345678-1234-1234-1234-1234567890AB}');
    expect(extractMsiProductCode('msiexec /x {12345678-1234-1234-1234-1234567890ab} /quiet')).toBe('{12345678-1234-1234-1234-1234567890AB}');
    expect(extractMsiProductCode('cmd.exe /c del C:\\data')).toBeNull();
    expect(extractMsiProductCode('MsiExec.exe /x {not-a-guid}')).toBeNull();
  });

  it('keeps Squirrel discovery directly below LocalAppData', () => {
    const result = safeSquirrelLocation('C:\\Users\\Ada\\AppData\\Local', 'DesktopMaterial');
    expect(result?.root).toBe(path.resolve('C:\\Users\\Ada\\AppData\\Local', 'DesktopMaterial'));
    expect(result?.updateExecutable.endsWith(path.join('DesktopMaterial', 'Update.exe'))).toBe(true);
    expect(safeSquirrelLocation('C:\\Users\\Ada\\AppData\\Local', '..\\Escape')).toBeNull();
  });

  it('selects the newest Squirrel app directory version', () => {
    expect(latestSquirrelVersion(['packages', 'app-1.9.0', 'app-1.10.0', 'app-2.0.0-beta.1'])).toBe('2.0.0-beta.1');
    expect(latestSquirrelVersion(['packages', 'temp'])).toBeNull();
  });

  it('matches only exact reviewed registry display names', () => {
    expect(exactDisplayNameMatch('Material Email', ['Material Email'])).toBe(true);
    expect(exactDisplayNameMatch('Material Email Preview', ['Material Email'])).toBe(false);
  });

  it('surfaces discovery-only registry identity only when the reviewed match is unique', () => {
    const first = { key: 'HKEY_CURRENT_USER\\Software\\One', displayName: 'Codex Material', displayVersion: '1.0.0', installLocation: 'C:\\Apps\\One', uninstallString: 'MsiExec.exe /x {12345678-1234-1234-1234-1234567890AB}' };
    const second = { ...first, key: 'HKEY_LOCAL_MACHINE\\Software\\Two' };
    expect(selectUniqueReviewedRegistryEntry([first], ['Codex Studio', 'Codex Material'])).toEqual(first);
    expect(selectUniqueReviewedRegistryEntry([first, second], ['Codex Studio', 'Codex Material'])).toBeNull();
    expect(selectUniqueReviewedRegistryEntry([{ ...first, displayName: 'Codex Material Preview' }], ['Codex Material'])).toBeNull();
  });

  it('parses only safely delimited executable command prefixes', () => {
    expect(extractQuotedExecutable('"C:\\Apps\\Material Email\\Uninstall Material Email.exe" /S')).toBe('C:\\Apps\\Material Email\\Uninstall Material Email.exe');
    expect(extractQuotedExecutable('C:\\Apps\\Update.exe --uninstall')).toBe('C:\\Apps\\Update.exe');
    expect(extractQuotedExecutable('cmd.exe /c erase C:\\data')).toBe('cmd.exe');
    expect(extractQuotedExecutable('C:\\Program Files\\Bad App\\uninstall.exe /S')).toBeNull();
  });

  it('keeps reviewed uninstallers under an allowlisted root with an exact basename', () => {
    const entry = {
      key: 'HKCU\\Software\\Uninstall\\MaterialEmail', displayName: 'Material Email', displayVersion: '1.0.0',
      installLocation: 'C:\\Users\\Ada\\AppData\\Local\\Programs\\Material Email',
      uninstallString: '"C:\\Users\\Ada\\AppData\\Local\\Programs\\Material Email\\Uninstall Material Email.exe" /S',
    };
    expect(pathWithinRoots(entry.installLocation, ['C:\\Users\\Ada\\AppData\\Local'])).toBe(true);
    expect(safeReviewedUninstaller(entry, ['Uninstall Material Email.exe'], ['C:\\Users\\Ada\\AppData\\Local']))
      .toMatchObject({ installRoot: path.resolve(entry.installLocation) });
    expect(safeReviewedUninstaller({ ...entry, uninstallString: '"C:\\Windows\\System32\\cmd.exe" /c erase' }, ['cmd.exe'], ['C:\\Users\\Ada\\AppData\\Local'])).toBeNull();
  });

  it('binds ownership to the complete exact registry entry', () => {
    const entry = { key: 'HKEY_CURRENT_USER\\Software\\App', displayName: 'App', displayVersion: '1', installLocation: 'C:\\App', uninstallString: '"C:\\App\\Uninstall.exe" /S' };
    const fingerprint = registryEntryFingerprint(entry);
    expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(registryEntryFingerprint({ ...entry, uninstallString: '"C:\\Other\\Uninstall.exe" /S' })).not.toBe(fingerprint);
    expect(registryEntryFingerprint({ ...entry, key: `${entry.key}-other` })).not.toBe(fingerprint);
  });

  it('selects exactly one new or changed registry identity and rejects ambiguity', () => {
    const upstream = { key: 'HKEY_CURRENT_USER\\Software\\Upstream', displayName: 'GitHub Desktop', displayVersion: '1', installLocation: 'C:\\Upstream', uninstallString: '"C:\\Upstream\\Update.exe" --uninstall' };
    const owned = { ...upstream, key: 'HKEY_CURRENT_USER\\Software\\Owned', installLocation: 'C:\\Owned', uninstallString: '"C:\\Owned\\Update.exe" --uninstall' };
    expect(selectChangedRegistryEntry([upstream], [upstream, owned], ['GitHub Desktop'])).toEqual(owned);
    expect(() => selectChangedRegistryEntry([upstream], [upstream], ['GitHub Desktop'])).toThrow(/found 0/);
    expect(() => selectChangedRegistryEntry([], [upstream, owned], ['GitHub Desktop'])).toThrow(/found 2/);
  });

  it('fails closed when any ownership-snapshot hive is incomplete', async () => {
    const output = 'HKEY_CURRENT_USER\\Software\\App\n    DisplayName    REG_SZ    App';
    const query = async (key: string) => {
      if (key === 'broken') throw new Error('query failed');
      return output;
    };
    await expect(collectRegistrySnapshot(['good', 'broken'], query)).rejects.toThrow(/snapshot is incomplete.*broken/);
    await expect(collectRegistrySnapshot(['good', 'broken'], query, true)).resolves.toHaveLength(1);
    await expect(collectRegistrySnapshotResult(['good', 'broken'], query)).resolves.toMatchObject({ failedKeys: ['broken'] });
  });

  it('maps persisted ownership to the failed hive so metadata survives a transient outage', () => {
    const keys = ['HKCU\\Software\\Uninstall', 'HKLM\\Software\\Uninstall', 'HKLM\\Software\\WOW6432Node\\Uninstall'];
    expect(ownershipHiveKey('HKEY_LOCAL_MACHINE\\Software\\WOW6432Node\\Uninstall\\App', keys)).toBe(keys[2]);
    expect(ownershipHiveKey('HKEY_CURRENT_USER\\Software\\Uninstall\\App', keys)).toBe(keys[0]);
    expect(ownershipHiveKey('HKEY_USERS\\Other\\App', keys)).toBeNull();
  });

  it('reuses an unchanged owned identity only for the same persisted version', () => {
    const entry = { key: 'HKEY_CURRENT_USER\\Software\\Owned', displayName: 'App', displayVersion: '1', installLocation: 'C:\\App', uninstallString: 'MsiExec.exe /x {12345678-1234-1234-1234-1234567890AB}' };
    const ownership = { adapterId: 'app-msi-v1', registryKey: entry.key, fingerprint: registryEntryFingerprint(entry) };
    expect(selectSameVersionOwnedRegistryEntry('v1', 'v1', ownership, 'app-msi-v1', [entry], ['App'])).toEqual(entry);
    expect(selectSameVersionOwnedRegistryEntry('v1', 'v2', ownership, 'app-msi-v1', [entry], ['App'])).toBeNull();
    expect(selectSameVersionOwnedRegistryEntry('v1', 'v1', ownership, 'other-adapter', [entry], ['App'])).toBeNull();
  });
});
