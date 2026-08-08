import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { CLOUD_INSTALL_PROOF_TARGETS, cloudInstallProofTargetFor } from '../src/main/install-proof-targets.js';

const read = (path: string) => readFile(path, 'utf8');

describe('cloud install adapter proof boundary', () => {
  it('keeps the executable proof allowlist closed to one reviewed Squirrel and one reviewed MSI adapter', () => {
    expect(Object.keys(CLOUD_INSTALL_PROOF_TARGETS)).toEqual([
      'dim-sum-atlas', 'winforge', 'wimforge', 'qbittorrent-material', 'keepassxc',
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
    expect(cloudInstallProofTargetFor('material-download-manager')).toBeNull();
    expect(cloudInstallProofTargetFor('../qbittorrent-material')).toBeNull();
  });

  it('uses the real OperationService, records detection and cleanup, and never invokes source runtime', async () => {
    const script = await read('scripts/prove-install-adapter.mjs');
    expect(script).toContain("const { OperationService } = await import('../dist/main/operation-service.js')");
    expect(script).toContain("operationService.install({ appId, decision: 'install' })");
    expect(script).toContain("operationService.uninstall({ appId, decision: 'uninstall' })");
    expect(script).toContain("sourceRuntimeInvoked: false");
    expect(script).toContain("schemaVersion: PROOF_SCHEMA");
    expect(script).not.toMatch(/sourceJobs|OpenCode|source-runtime|child_process/);
  });

  it('loads a typed allowlist for portable and explicitly reviewed non-portable targets', async () => {
    const script = await read('scripts/prove-install-adapter.mjs');
    const targets = await read('src/main/install-proof-targets.ts');
    expect(targets).toContain("'dim-sum-atlas': {");
    expect(targets).toContain('winforge: {');
    expect(targets).toContain('wimforge: {');
    expect(targets).toContain("'qbittorrent-material': {");
    expect(targets).toContain('keepassxc: {');
    expect(targets).toContain("adapterId: 'qbittorrent-material-squirrel'");
    expect(targets).toContain("adapterId: 'keepassxc-msi'");
    expect(targets).toContain("family: 'squirrel'");
    expect(targets).toContain("ownershipKind: 'registry'");
    expect(targets).toContain('requiresCleanStart: true');
    expect(targets).toContain('requiresDirectSha256: true');
    expect(targets).toContain('satisfies Partial<Record<CatalogAppId, CloudInstallProofTarget>>');
    expect(script).toContain("cloudInstallProofTargetFor(appId)");
    expect(script).toContain("adapter.family !== target.family");
    expect(script).toContain('target.requiresCleanStart && !cleanStart');
    expect(script).toContain('refusing to adopt or uninstall a pre-existing application');
    expect(script).toContain("downloadVerification: 'operation-service-sha256'");
    expect(script).toContain("event.phase === 'downloading' && event.progress === 100");
    expect(script).toContain('sha256Verified: result.ok && downloadCompleted && releaseMatchedResult');
    expect(script).toContain('&& integrity.sha256Verified');
    expect(script).toContain('persistedAfterCleanup.length === 0');
    expect(script).toContain('const MAX_PROGRESS_EVENTS = 256');
    expect(script).toContain('phaseChanged || progressChanged || event.final');
    expect(script).toContain('droppedProgressEvents');
    expect(script).toContain('setInterval');
    expect(script).toContain('withProofTimeout');
    expect(script).toContain('DING_DING_INSTALL_PROOF_TIMEOUT_MS');
    expect(script).toContain('app.exit(exitCode)');
    expect(script).toContain("logMilestone('electron-readiness-skipped')");
    expect(script).toContain('const repositoryRoot = path.resolve(\'.\')');
    expect(script).toContain('app.getAppPath = () => repositoryRoot');
    expect(script).toContain('process.noAsar = true');
    expect(script).not.toContain('app.whenReady()');
    expect(script).toContain("app.commandLine.appendSwitch('disable-gpu')");
    expect(script).toContain("app.commandLine.appendSwitch('no-sandbox')");
    expect(script).toContain("APP_ID_PATTERN");
  });

  it('pins the proof to a Windows cloud runner and uploads only the bounded manifest', async () => {
    const workflow = await read('.github/workflows/install-adapter-proof.yml');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('app_id:');
    expect(workflow).toContain('- dim-sum-atlas');
    expect(workflow).toContain('- winforge');
    expect(workflow).toContain('- wimforge');
    expect(workflow).toContain('- qbittorrent-material');
    expect(workflow).toContain('- keepassxc');
    expect(workflow).toContain('runs-on: windows-2022');
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npx electron scripts/prove-install-adapter.mjs');
    expect(workflow).toContain('PROOF_APP_ID: ${{ inputs.app_id }}');
    expect(workflow).toContain('--app-id $env:PROOF_APP_ID');
    expect(workflow).not.toContain("--app-id '${{ inputs.app_id }}'");
    expect(workflow).toContain('timeout-minutes: 25');
    expect(workflow).toContain('if: always()');
    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('proof-output/install-proof.json');
    expect(workflow).toContain("$proof.integrity.expectedSha256 -notmatch '^[0-9a-f]{64}$'");
    expect(workflow).toContain('$proof.integrity.sha256Verified -ne $true');
    expect(workflow).toContain('$proof.integrity.releaseMatchedResult -ne $true');
    expect(workflow).toContain("$proof.target.ownershipKind -ne 'registry'");
    expect(workflow).toContain("$proof.family -ne 'msi' -or $proof.target.uninstallKind -ne 'msi'");
    expect(workflow).toContain('@($proof.persistedAfterCleanup).Count -ne 0');
    expect(workflow).not.toContain('expectation:');
    expect(workflow).not.toContain('ubuntu-latest');
    expect(workflow).not.toContain('source-runtime');
  });
});
