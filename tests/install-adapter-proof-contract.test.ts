import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { LIFECYCLE_PRODUCTS, LIFECYCLE_PROOF_SCHEMA, LIFECYCLE_STAGES } from '../scripts/lifecycle-proof-matrix.mjs';
import { CLOUD_INSTALL_PROOF_TARGETS, cloudInstallProofTargetFor } from '../src/main/install-proof-targets.js';

describe('lifecycle proof replacement', () => {
  it('retires the side-effect install-adapter workflow', async () => {
    await expect(readFile('.github/workflows/install-adapter-proof.yml', 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('keeps the local disposable proof allowlist closed to reviewed adapters', () => {
    expect(Object.keys(CLOUD_INSTALL_PROOF_TARGETS)).toEqual([
      'dim-sum-atlas', 'winforge', 'wimforge', 'qbittorrent-material', 'keepassxc', 'jdownloader-material', 'codex-material',
      'farming-game', 'material-cookie-clicker', 'material-encryption', 'material-ollama', 'material-sandbox',
      'material-tools', 'material-virtualbox', 'material-winforge', 'material-winutil', 'meadowmark',
      'minecraft-server-command-center', 'minecraft-server-studio', 'sprout-hollow-valley',
    ]);
    expect(cloudInstallProofTargetFor('qbittorrent-material')).toEqual({
      appId: 'qbittorrent-material',
      adapterId: 'qbittorrent-material-squirrel',
      family: 'squirrel',
      ownershipKind: 'registry',
      uninstallKind: 'squirrel',
      requiresCleanStart: true,
      requiresDirectSha256: true,
    });
    expect(cloudInstallProofTargetFor('keepassxc')).toEqual({
      appId: 'keepassxc',
      adapterId: 'keepassxc-msi',
      family: 'msi',
      ownershipKind: 'registry',
      uninstallKind: 'msi',
      requiresCleanStart: true,
      requiresDirectSha256: true,
    });
    expect(cloudInstallProofTargetFor('jdownloader-material')).toEqual({
      appId: 'jdownloader-material',
      adapterId: 'jdownloader-material-jpackage',
      family: 'jpackage',
      ownershipKind: 'registry',
      uninstallKind: 'msi',
      requiresCleanStart: true,
      requiresDirectSha256: true,
    });
    expect(cloudInstallProofTargetFor('codex-material')).toEqual({
      appId: 'codex-material',
      adapterId: 'codex-material-msi',
      family: 'msi',
      ownershipKind: 'registry',
      uninstallKind: 'msi',
      requiresCleanStart: true,
      requiresDirectSha256: true,
    });
    expect(cloudInstallProofTargetFor('material-download-manager')).toBeNull();
    expect(cloudInstallProofTargetFor('../qbittorrent-material')).toBeNull();
    expect(cloudInstallProofTargetFor('material-ollama')).toMatchObject({
      adapterId: 'material-ollama-inno', family: 'inno', ownershipKind: 'registry', uninstallKind: 'reviewed-executable',
      requiresCleanStart: true, requiresDirectSha256: true,
    });
    expect(cloudInstallProofTargetFor('material-sandbox')).toMatchObject({
      adapterId: 'material-sandbox-inno', family: 'inno', ownershipKind: 'registry', uninstallKind: 'reviewed-executable',
    });
  });

  it('keeps the receipt contract exact and source-runtime integration explicit', () => {
    expect(LIFECYCLE_PROOF_SCHEMA).toBe('ding-ding-app-store.lifecycle-proof.v2');
    expect(LIFECYCLE_PRODUCTS).toHaveLength(13);
    expect(LIFECYCLE_STAGES).toContain('source-run-readiness');
    expect(LIFECYCLE_STAGES).toContain('installed-window-readiness');
    expect(LIFECYCLE_STAGES).toContain('guest-disposal');
  });
});
