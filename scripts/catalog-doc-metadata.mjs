// Catalog documentation is deliberately derived only from reviewed repository metadata.
// It is not a provider README importer and must never contain installer commands, paths,
// release URLs, or external assets.

export const CATALOG_ARTICLE_PREFIX = 'catalog-app-';

/**
 * Hand-written completeness inventory for every reviewed adapter. Keep the explanation
 * intentionally high-level: `src/main/install-adapters.ts` remains the executable authority.
 */
export const CATALOG_ADAPTER_DOCUMENTATION = Object.freeze({
  'lowlevel-computer-use-mcp': { adapterId: 'lowlevel-computer-use-mcp-squirrel', status: 'reviewed', family: 'Squirrel.Windows' },
  'material-download-manager': { adapterId: 'material-download-manager-squirrel', status: 'reviewed', family: 'Squirrel.Windows' },
  'material-designer': { adapterId: 'material-designer-squirrel', status: 'reviewed', family: 'Squirrel.Windows' },
  'material-bluemap': { adapterId: 'material-bluemap-squirrel', status: 'reviewed', family: 'Squirrel.Windows' },
  'desktop-material': { adapterId: 'desktop-material-squirrel', status: 'reviewed', family: 'Squirrel.Windows' },
  'home-assistant-ac-defender': { adapterId: 'home-assistant-ac-defender-squirrel', status: 'reviewed', family: 'Squirrel.Windows' },
  'material-email': { adapterId: 'material-email-nsis', status: 'reviewed', family: 'NSIS' },
  opencodex: { adapterId: 'opencodex-squirrel', status: 'reviewed', family: 'Squirrel.Windows' },
  'qbittorrent-material': { adapterId: 'qbittorrent-material-squirrel', status: 'reviewed', family: 'Squirrel.Windows' },
  'material-winscp': { adapterId: 'material-winscp-squirrel', status: 'reviewed', family: 'Squirrel.Windows' },
  'dim-sum-atlas': { adapterId: 'dim-sum-atlas-portable-zip', status: 'reviewed', family: 'managed portable ZIP' },
  'win-ssh-copy-id': { adapterId: 'win-ssh-copy-id-no-release', status: 'blocked', blocker: 'The public repository has no published release, so there is no immutable installer asset to verify or run.' },
  'material-office': { adapterId: 'material-office-nsis', status: 'reviewed', family: 'NSIS' },
  'minecraft-world-downloader': { adapterId: 'minecraft-world-downloader-nsis', status: 'reviewed', family: 'NSIS' },
  'codex-material': { adapterId: 'codex-material-msi', status: 'reviewed', family: 'MSI' },
  'libreoffice-material': { adapterId: 'libreoffice-material-msi', status: 'reviewed', family: 'MSI' },
  'thunderbird-desktop': { adapterId: 'thunderbird-desktop-mozilla-nsis', status: 'reviewed', family: 'Mozilla NSIS' },
  'bambu-studio': { adapterId: 'bambu-studio-nsis', status: 'reviewed', family: 'NSIS' },
  keepassxc: { adapterId: 'keepassxc-msi', status: 'reviewed', family: 'MSI' },
  'jdownloader-material': { adapterId: 'jdownloader-material-jpackage', status: 'reviewed', family: 'jpackage EXE' },
  'ha-bambulab': { adapterId: 'ha-bambulab-external-home-assistant', status: 'blocked', blocker: 'The release is a HACS custom-component ZIP. A fresh Windows installation has no canonical local Home Assistant configuration target, and choosing a remote Home Assistant instance requires account/host authorization that this catalog adapter cannot infer.' },
  winforge: { adapterId: 'winforge-portable-zip', status: 'reviewed', family: 'managed portable ZIP' },
  wimforge: { adapterId: 'wimforge-portable-zip', status: 'reviewed', family: 'managed portable ZIP' },
  'photo-viewer': { adapterId: 'photo-viewer-empty-release', status: 'blocked', blocker: 'The latest public release exists but contains no assets, so there is no installer byte stream to verify or run.' },
  'material-minecraft-map-editor': { adapterId: 'material-minecraft-map-editor-squirrel', status: 'reviewed', family: 'Squirrel.Windows' },
  'material-gitlab': { adapterId: 'material-gitlab-no-reviewed-installer', status: 'blocked', blocker: 'The public repository has no reviewed Windows installer asset for this catalog route.' },
  'material-tax-reporting': { adapterId: 'material-tax-reporting-no-reviewed-installer', status: 'blocked', blocker: 'The public repository has no reviewed Windows installer asset for this catalog route.' },
});

export function catalogArticleId(appId) {
  if (!Object.hasOwn(CATALOG_ADAPTER_DOCUMENTATION, appId)) throw new Error(`Unknown catalog application ID: ${appId}`);
  return `${CATALOG_ARTICLE_PREFIX}${appId}`;
}

export function catalogAdapterDocumentation(record) {
  const metadata = CATALOG_ADAPTER_DOCUMENTATION[record.id];
  if (!metadata) throw new Error(`Unknown catalog application ID: ${record.id}`);
  if (metadata.adapterId !== record.adapterId) throw new Error(`${record.id}: catalog adapter ID does not match generated documentation metadata`);
  if (metadata.status === 'reviewed' && record.availability !== 'installable') throw new Error(`${record.id}: reviewed adapter must be installable`);
  if (metadata.status === 'blocked' && record.availability !== 'unsupported') throw new Error(`${record.id}: blocked adapter must be unsupported`);
  return metadata;
}
