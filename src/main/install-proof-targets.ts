import type { CatalogAppId, InstallAdapterId, InstallerFamily } from './install-adapters.js';

export type InstallProofOwnershipKind = 'portable' | 'registry';
export type InstallProofUninstallKind = 'portable' | 'squirrel';

export interface CloudInstallProofTarget {
  readonly appId: CatalogAppId;
  readonly adapterId: InstallAdapterId;
  readonly family: Extract<InstallerFamily, 'portable-zip' | 'squirrel'>;
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
} as const satisfies Partial<Record<CatalogAppId, CloudInstallProofTarget>>;

export type CloudInstallProofAppId = keyof typeof CLOUD_INSTALL_PROOF_TARGETS;

export function cloudInstallProofTargetFor(appId: string): CloudInstallProofTarget | null {
  if (!Object.hasOwn(CLOUD_INSTALL_PROOF_TARGETS, appId)) return null;
  return CLOUD_INSTALL_PROOF_TARGETS[appId as CloudInstallProofAppId];
}
