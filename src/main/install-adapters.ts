import { z } from 'zod';
import type { PackageType } from '../shared/contracts.js';

export const CATALOG_APP_IDS = [
  'lowlevel-computer-use-mcp', 'material-download-manager', 'material-designer', 'material-bluemap',
  'desktop-material', 'home-assistant-ac-defender', 'material-email', 'opencodex',
  'qbittorrent-material', 'material-winscp', 'dim-sum-atlas', 'win-ssh-copy-id',
  'material-office', 'minecraft-world-downloader', 'codex-material', 'libreoffice-material',
  'thunderbird-desktop', 'bambu-studio', 'keepassxc', 'jdownloader-material', 'ha-bambulab',
  'winforge', 'wimforge', 'photo-viewer',
] as const;

export type CatalogAppId = (typeof CATALOG_APP_IDS)[number];
export const catalogAppIdSchema = z.enum(CATALOG_APP_IDS);

export const INSTALL_ADAPTER_IDS = [
  'lowlevel-computer-use-mcp-squirrel', 'material-download-manager-squirrel', 'material-designer-squirrel',
  'material-bluemap-squirrel', 'desktop-material-squirrel', 'home-assistant-ac-defender-squirrel',
  'material-email-nsis', 'opencodex-squirrel', 'qbittorrent-material-squirrel', 'material-winscp-squirrel',
  'dim-sum-atlas-portable-zip', 'win-ssh-copy-id-no-release', 'material-office-nsis',
  'minecraft-world-downloader-nsis', 'codex-material-msi', 'libreoffice-material-msi',
  'thunderbird-desktop-mozilla-nsis', 'bambu-studio-nsis', 'keepassxc-msi',
  'jdownloader-material-jpackage', 'ha-bambulab-external-home-assistant', 'winforge-portable-zip',
  'wimforge-portable-zip', 'photo-viewer-empty-release',
] as const;

export type InstallAdapterId = (typeof INSTALL_ADAPTER_IDS)[number];
export const installAdapterIdSchema = z.enum(INSTALL_ADAPTER_IDS);

export type InstallerFamily = 'squirrel' | 'msi' | 'nsis' | 'mozilla-nsis' | 'jpackage' | 'portable-zip';

interface AdapterBase {
  readonly id: InstallAdapterId;
  readonly appId: CatalogAppId;
  readonly packageType: PackageType;
  readonly evidence: readonly string[];
}

export interface ExecutableInstallAdapter extends AdapterBase {
  readonly supported: true;
  readonly family: Exclude<InstallerFamily, 'portable-zip'>;
  readonly assetPattern: RegExp;
  readonly checksumAssetPattern?: RegExp;
  readonly installArguments: readonly string[];
  readonly registryDisplayNames: readonly string[];
  readonly uninstallExecutableNames?: readonly string[];
  readonly uninstallArguments?: readonly string[];
}

export interface PortableZipInstallAdapter extends AdapterBase {
  readonly supported: true;
  readonly family: 'portable-zip';
  readonly assetPattern: RegExp;
  readonly checksumAssetPattern?: RegExp;
  readonly executableRelativePath: string;
}

export interface UnsupportedInstallAdapter extends AdapterBase {
  readonly supported: false;
  readonly family: 'unsupported';
  readonly blockerCode: 'no-release' | 'empty-release' | 'external-target-required';
  readonly blocker: string;
}

export type InstallAdapter = ExecutableInstallAdapter | PortableZipInstallAdapter | UnsupportedInstallAdapter;

const squirrel = (
  id: InstallAdapterId,
  appId: CatalogAppId,
  assetPattern: RegExp,
  registryDisplayNames: readonly string[],
  evidence: readonly string[],
  checksumAssetPattern?: RegExp,
): ExecutableInstallAdapter => ({
  id, appId, supported: true, family: 'squirrel', packageType: 'squirrel', assetPattern,
  checksumAssetPattern, installArguments: ['--silent'], registryDisplayNames, evidence,
  uninstallExecutableNames: ['Update.exe'], uninstallArguments: ['--uninstall', '-s'],
});

const nsis = (
  id: InstallAdapterId,
  appId: CatalogAppId,
  assetPattern: RegExp,
  registryDisplayNames: readonly string[],
  uninstallExecutableNames: readonly string[],
  evidence: readonly string[],
  checksumAssetPattern?: RegExp,
): ExecutableInstallAdapter => ({
  id, appId, supported: true, family: 'nsis', packageType: 'nsis', assetPattern,
  checksumAssetPattern, installArguments: ['/S'], registryDisplayNames, evidence,
  uninstallExecutableNames, uninstallArguments: ['/S'],
});

const msi = (
  id: InstallAdapterId,
  appId: CatalogAppId,
  assetPattern: RegExp,
  registryDisplayNames: readonly string[],
  evidence: readonly string[],
  checksumAssetPattern?: RegExp,
): ExecutableInstallAdapter => ({
  id, appId, supported: true, family: 'msi', packageType: 'msi', assetPattern,
  checksumAssetPattern, installArguments: ['/qn', '/norestart'], registryDisplayNames, evidence,
});

const portable = (
  id: InstallAdapterId,
  appId: CatalogAppId,
  assetPattern: RegExp,
  executableRelativePath: string,
  evidence: readonly string[],
): PortableZipInstallAdapter => ({
  id, appId, supported: true, family: 'portable-zip', packageType: 'archive', assetPattern,
  executableRelativePath, evidence,
});

export const INSTALL_ADAPTERS: Readonly<Record<CatalogAppId, InstallAdapter>> = {
  'lowlevel-computer-use-mcp': squirrel('lowlevel-computer-use-mcp-squirrel', 'lowlevel-computer-use-mcp', /^lowlevel-computer-use-manual-[0-9A-Za-z.+-]+-win-x64\.exe$/, ['Low-Level Computer-Use Manual', 'Lowlevel Computer Use MCP'], ['electron/package.json: electron-builder --win squirrel', '.github/workflows/ci-release.yml: Squirrel release assets']),
  'material-download-manager': squirrel('material-download-manager-squirrel', 'material-download-manager', /^Setup\.exe$/, ['Material Download Manager'], ['design/package.json: electron-builder squirrel target']),
  'material-designer': squirrel('material-designer-squirrel', 'material-designer', /^material-designer-[0-9A-Za-z.+-]+-win-x64-setup\.exe$/, ['Material Designer', 'Open Design'], ['.github/workflows/release.yml: Squirrel.Windows build and installed smoke'], /^material-designer-[0-9A-Za-z.+-]+-win-x64-setup\.exe\.sha256$/),
  'material-bluemap': squirrel('material-bluemap-squirrel', 'material-bluemap', /^Worldlens-[0-9A-Za-z.+-]+-Setup\.exe$/, ['Worldlens', 'Material BlueMap'], ['design/packages/app/electron-builder.config.cjs: Squirrel target and Worldlens package identity']),
  'desktop-material': squirrel('desktop-material-squirrel', 'desktop-material', /^GitHubDesktopSetup-x64\.exe$/, ['GitHub Desktop', 'Desktop Material'], ['app/package.json and build-installers workflow: Squirrel Windows release']),
  'home-assistant-ac-defender': squirrel('home-assistant-ac-defender-squirrel', 'home-assistant-ac-defender', /^AC\.Defender\.Controller\.Setup\.[0-9A-Za-z.+-]+\.exe$/, ['AC Defender Controller', 'Home Assistant AC Defender'], ['desktop-electron/package.json: Squirrel target and ACDefenderController identity']),
  'material-email': nsis('material-email-nsis', 'material-email', /^Material-Email-[0-9A-Za-z.+-]+-Windows-x64\.exe$/, ['Material Email', 'Material Email 0.105.1'], ['Uninstall Material Email.exe'], ['package.json: electron-builder NSIS x64 target', '.github/workflows/windows-release.yml: installed/uninstalled lifecycle proof', 'GitHub Actions proof 31271436306: v0.105.1 wrote the exact HKCU display name Material Email 0.105.1']),
  opencodex: squirrel('opencodex-squirrel', 'opencodex', /^opencodex\.Setup\.[0-9A-Za-z.+-]+\.exe$/, ['opencodex', 'OpenCodex'], ['electron-builder.yml: explicit Squirrel.Windows target and lifecycle hooks']),
  'qbittorrent-material': squirrel('qbittorrent-material-squirrel', 'qbittorrent-material', /^qBittorrent-Material-[0-9A-Za-z.+-]+-windows-x64-Setup\.exe$/, ['qBittorrent Material'], ['.github/workflows/release-every-push.yml: built and smoke-tested Squirrel installer']),
  'material-winscp': squirrel('material-winscp-squirrel', 'material-winscp', /^WinSCP\.Material\.[0-9A-Za-z.+-]+\.Setup\.exe$/, ['WinSCP Material'], ['forge.config.js: maker-squirrel and WinSCPMaterial executable identity']),
  'dim-sum-atlas': portable('dim-sum-atlas-portable-zip', 'dim-sum-atlas', /^DimSumAtlas-v?[0-9A-Za-z.+-]+-windows-x64\.zip$/, 'DimSumAtlas.exe', ['package.json and release.yml: self-contained Windows x64 archive']),
  'win-ssh-copy-id': { id: 'win-ssh-copy-id-no-release', appId: 'win-ssh-copy-id', supported: false, family: 'unsupported', packageType: 'unsupported', blockerCode: 'no-release', blocker: 'The public repository has no published release, so there is no immutable installer asset to verify or run.', evidence: ['GitHub releases/latest returned 404 on 2026-08-07'] },
  'material-office': nsis('material-office-nsis', 'material-office', /^Material-Office-[0-9A-Za-z.+-]+-x64-Setup\.exe$/, ['Material Office'], ['Uninstall Material Office.exe'], ['package.json: electron-builder NSIS x64 target', 'docs/release/windows-installer.md: silent install/uninstall lifecycle']),
  'minecraft-world-downloader': nsis('minecraft-world-downloader-nsis', 'minecraft-world-downloader', /^WorldDownloaderManager-Setup\.exe$/, ['Minecraft World Downloader', 'World Downloader Manager'], ['Uninstall.exe'], ['installer/installer.nsi: fixed NSIS identity, install root, and uninstaller']),
  'codex-material': msi('codex-material-msi', 'codex-material', /^Codex\.Studio-[0-9A-Za-z.+-]+-x64\.msi$/, ['Codex Studio', 'Codex Material'], ['package.json: electron-builder MSI x64 target']),
  'libreoffice-material': msi('libreoffice-material-msi', 'libreoffice-material', /^LibreOfficeMaterial-Windows-x64\.msi$/, ['LibreOffice Material'], ['.github/workflows/windows-installer.yml: CPack MSI release'], /^LibreOfficeMaterial-Windows-x64\.msi\.sha256$/),
  'thunderbird-desktop': { id: 'thunderbird-desktop-mozilla-nsis', appId: 'thunderbird-desktop', supported: true, family: 'mozilla-nsis', packageType: 'nsis', assetPattern: /^thunderbird-[0-9A-Za-z.+-]+\.en-US\.win64\.installer\.exe$/, installArguments: ['-ms'], registryDisplayNames: ['Mozilla Thunderbird', 'Thunderbird', 'Material Mail'], uninstallExecutableNames: ['helper.exe'], uninstallArguments: ['/S'], evidence: ['.github/workflows/windows-installer.yml: Mozilla NSIS package built by mach package'] },
  'bambu-studio': nsis('bambu-studio-nsis', 'bambu-studio', /^BambuStudioMD3-Setup\.exe$/, ['Bambu Studio MD3', 'Bambu Studio'], ['Uninstall.exe'], ['packaging/windows/BambuStudioMD3.nsi: fixed per-user NSIS identity and owned uninstall'], /^BambuStudioMD3-Setup\.exe\.sha256$/),
  keepassxc: msi('keepassxc-msi', 'keepassxc', /^KeePassXC-[0-9A-Za-z.+-]+-snapshot-x64\.msi$/, ['KeePassXC'], ['.github/workflows/material-release.yml: CPack/WiX MSI and portable release']),
  'jdownloader-material': { id: 'jdownloader-material-jpackage', appId: 'jdownloader-material', supported: true, family: 'jpackage', packageType: 'jpackage', assetPattern: /^JDownloader-Material-windows-x64\.exe$/, installArguments: ['/quiet', '/norestart'], registryDisplayNames: ['JDownloader Material'], evidence: ['.github/workflows/release.yml: jpackage --type exe with bundled Java runtime'] },
  'ha-bambulab': { id: 'ha-bambulab-external-home-assistant', appId: 'ha-bambulab', supported: false, family: 'unsupported', packageType: 'unsupported', blockerCode: 'external-target-required', blocker: 'The release is a HACS custom-component ZIP. A fresh Windows installation has no canonical local Home Assistant configuration target, and choosing a remote Home Assistant instance requires account/host authorization that this catalog adapter cannot infer.', evidence: ['release v3.0.8: bambu_lab.zip', 'README.md: HACS repository installation route'] },
  winforge: portable('winforge-portable-zip', 'winforge', /^WinForge-portable-x64-[0-9A-Za-z.+-]+\.zip$/, 'WinForge.exe', ['.github/workflows/release.yml: validated self-contained portable archive with WinForge.exe']),
  wimforge: portable('wimforge-portable-zip', 'wimforge', /^WimForge-portable-x64-[0-9A-Za-z.+-]+\.zip$/, 'WimForge.exe', ['.github/workflows/release.yml: self-contained portable Qt archive']),
  'photo-viewer': { id: 'photo-viewer-empty-release', appId: 'photo-viewer', supported: false, family: 'unsupported', packageType: 'unsupported', blockerCode: 'empty-release', blocker: 'The latest public release exists but contains no assets, so there is no installer byte stream to verify or run.', evidence: ['release v0.1.0 had zero assets on 2026-08-07', 'package.json proves a future NSIS target but not a published installer'] },
};

export function adapterFor(appId: string): InstallAdapter {
  const parsed = catalogAppIdSchema.parse(appId);
  return INSTALL_ADAPTERS[parsed];
}

export function selectInstallerAsset<T extends { name: string }>(adapter: InstallAdapter, assets: readonly T[]): T {
  if (!adapter.supported) throw new Error(adapter.blocker);
  const matches = assets.filter((asset) => adapter.assetPattern.test(asset.name));
  if (matches.length !== 1) throw new Error(`Expected exactly one asset for ${adapter.id}; found ${matches.length}.`);
  return matches[0];
}

export function validateAdapterCoverage(): void {
  const keys = Object.keys(INSTALL_ADAPTERS).sort();
  const expected = [...CATALOG_APP_IDS].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error('The hand-written 24-application adapter map is incomplete.');
  }
  for (const appId of CATALOG_APP_IDS) {
    const adapter = INSTALL_ADAPTERS[appId];
    if (adapter.appId !== appId) throw new Error(`Adapter ${adapter.id} is assigned to the wrong application.`);
    if (adapter.supported && adapter.packageType === 'unsupported') throw new Error(`Supported adapter ${adapter.id} has an unsupported package type.`);
    if (!adapter.supported && adapter.packageType !== 'unsupported') throw new Error(`Blocked adapter ${adapter.id} is silently labelled installable.`);
  }
}

validateAdapterCoverage();
