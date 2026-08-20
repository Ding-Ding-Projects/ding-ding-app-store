import type { CatalogAppId, InstallAdapterId, InstallerFamily } from './install-adapters.js';

export type InstallProofOwnershipKind = 'portable' | 'registry';
export type InstallProofUninstallKind = 'portable' | 'squirrel' | 'msi' | 'reviewed-executable';

export interface CloudInstallProofTarget {
  readonly appId: CatalogAppId;
  readonly adapterId: InstallAdapterId;
  readonly family: Extract<InstallerFamily, 'portable-zip' | 'squirrel' | 'msi' | 'nsis' | 'inno'>;
  readonly ownershipKind: InstallProofOwnershipKind;
  readonly uninstallKind: InstallProofUninstallKind;
  readonly requiresCleanStart: boolean;
  readonly requiresDirectSha256: boolean;
}

/**
 * Dispatch-only install proofs are an explicit allowlist, not a second copy of
 * the complete adapter registry. Adding an adapter here authorizes a disposable
 * Windows runner to install and remove that one reviewed public release route.
 */
export const CLOUD_INSTALL_PROOF_TARGETS = {
  'dim-sum-atlas': {
    appId: 'dim-sum-atlas', adapterId: 'dim-sum-atlas-portable-zip', family: 'portable-zip',
    ownershipKind: 'portable', uninstallKind: 'portable', requiresCleanStart: false, requiresDirectSha256: false,
  },
  winforge: {
    appId: 'winforge', adapterId: 'winforge-portable-zip', family: 'portable-zip',
    ownershipKind: 'portable', uninstallKind: 'portable', requiresCleanStart: false, requiresDirectSha256: false,
  },
  wimforge: {
    appId: 'wimforge', adapterId: 'wimforge-portable-zip', family: 'portable-zip',
    ownershipKind: 'portable', uninstallKind: 'portable', requiresCleanStart: false, requiresDirectSha256: false,
  },
  'qbittorrent-material': {
    appId: 'qbittorrent-material', adapterId: 'qbittorrent-material-squirrel', family: 'squirrel',
    ownershipKind: 'registry', uninstallKind: 'squirrel', requiresCleanStart: true, requiresDirectSha256: true,
  },
  opencodex: {
    appId: 'opencodex', adapterId: 'opencodex-squirrel', family: 'squirrel',
    ownershipKind: 'registry', uninstallKind: 'squirrel', requiresCleanStart: true, requiresDirectSha256: true,
  },
  keepassxc: {
    appId: 'keepassxc', adapterId: 'keepassxc-msi', family: 'msi',
    ownershipKind: 'registry', uninstallKind: 'msi', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'codex-material': {
    appId: 'codex-material', adapterId: 'codex-material-msi', family: 'msi',
    ownershipKind: 'registry', uninstallKind: 'msi', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'farming-game': {
    appId: 'farming-game', adapterId: 'farming-game-squirrel', family: 'squirrel',
    ownershipKind: 'registry', uninstallKind: 'squirrel', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'material-cookie-clicker': {
    appId: 'material-cookie-clicker', adapterId: 'material-cookie-clicker-squirrel', family: 'squirrel',
    ownershipKind: 'registry', uninstallKind: 'squirrel', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'material-encryption': {
    appId: 'material-encryption', adapterId: 'material-encryption-squirrel', family: 'squirrel',
    ownershipKind: 'registry', uninstallKind: 'squirrel', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'material-ollama': {
    appId: 'material-ollama', adapterId: 'material-ollama-inno', family: 'inno',
    ownershipKind: 'registry', uninstallKind: 'reviewed-executable', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'material-sandbox': {
    appId: 'material-sandbox', adapterId: 'material-sandbox-inno', family: 'inno',
    ownershipKind: 'registry', uninstallKind: 'reviewed-executable', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'material-tools': {
    appId: 'material-tools', adapterId: 'material-tools-squirrel', family: 'squirrel',
    ownershipKind: 'registry', uninstallKind: 'squirrel', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'material-virtualbox': {
    appId: 'material-virtualbox', adapterId: 'material-virtualbox-nsis', family: 'nsis',
    ownershipKind: 'registry', uninstallKind: 'reviewed-executable', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'material-winforge': {
    appId: 'material-winforge', adapterId: 'material-winforge-squirrel', family: 'squirrel',
    ownershipKind: 'registry', uninstallKind: 'squirrel', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'material-winutil': {
    appId: 'material-winutil', adapterId: 'material-winutil-squirrel', family: 'squirrel',
    ownershipKind: 'registry', uninstallKind: 'squirrel', requiresCleanStart: true, requiresDirectSha256: true,
  },
  meadowmark: {
    appId: 'meadowmark', adapterId: 'meadowmark-squirrel', family: 'squirrel',
    ownershipKind: 'registry', uninstallKind: 'squirrel', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'minecraft-server-command-center': {
    appId: 'minecraft-server-command-center', adapterId: 'minecraft-server-command-center-squirrel', family: 'squirrel',
    ownershipKind: 'registry', uninstallKind: 'squirrel', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'minecraft-server-studio': {
    appId: 'minecraft-server-studio', adapterId: 'minecraft-server-studio-squirrel', family: 'squirrel',
    ownershipKind: 'registry', uninstallKind: 'squirrel', requiresCleanStart: true, requiresDirectSha256: true,
  },
  'sprout-hollow-valley': {
    appId: 'sprout-hollow-valley', adapterId: 'sprout-hollow-valley-squirrel', family: 'squirrel',
    ownershipKind: 'registry', uninstallKind: 'squirrel', requiresCleanStart: true, requiresDirectSha256: true,
  },
} as const satisfies Partial<Record<CatalogAppId, CloudInstallProofTarget>>;

export type CloudInstallProofAppId = keyof typeof CLOUD_INSTALL_PROOF_TARGETS;

export function cloudInstallProofTargetFor(appId: string): CloudInstallProofTarget | null {
  if (!Object.hasOwn(CLOUD_INSTALL_PROOF_TARGETS, appId)) return null;
  return CLOUD_INSTALL_PROOF_TARGETS[appId as CloudInstallProofAppId];
}
