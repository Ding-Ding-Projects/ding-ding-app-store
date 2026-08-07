import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractMsiProductCode, latestSquirrelVersion, parseRegistryUninstallOutput, safeSquirrelLocation } from '../src/main/installed-detection';

describe('installed-app detection', () => {
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
});
